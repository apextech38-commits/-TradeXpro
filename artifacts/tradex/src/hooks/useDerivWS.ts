import { useState, useRef, useEffect } from 'react';

// 2) Keep the guard strict
export function isAuthenticatedSocketOpen(ws, wsUrl, activeAccountType, activeAccountId, lastOtp) {
  if (!ws || !wsUrl) return false;
  if (ws.readyState !== WebSocket.OPEN) return false;
  
  const urlHasRightEnv = activeAccountType === 'demo' 
    ? wsUrl.includes('/trading/v1/options/ws/demo') 
    : wsUrl.includes('/trading/v1/options/ws/real');
    
  const otpMatchesAccount = lastOtp?.account_id === activeAccountId;
  return urlHasRightEnv && otpMatchesAccount;
}

export function useDerivWS(accessToken, activeAccountId, activeAccountType, appId) {
  const [transitionState, setTransitionState] = useState('closed');
  const [tradingEnabled, setTradingEnabled] = useState(false);
  
  const wsRef = useRef(null);
  const wsUrlRef = useRef(undefined);
  const lastOtpRef = useRef(null);
  const subsRef = useRef(new Map());
  const tradeQueueRef = useRef([]);

  // 3) Readiness promise pointers to avoid race clicks
  const wsReadyResolveRef = useRef(() => {});
  const wsReadyPromiseRef = useRef(Promise.resolve());

  const canTrade = () => isAuthenticatedSocketOpen(
    wsRef.current, 
    wsUrlRef.current, 
    activeAccountType, 
    activeAccountId, 
    lastOtpRef.current
  );

  // 3) Controlled sender queueing up commands cleanly
  async function sendTrading(message) {
    if (!canTrade()) {
      tradeQueueRef.current.push(message);
      return;
    }
    await wsReadyPromiseRef.current;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }

  // 4 & 5) Atomic Refresh, Close, Flush, & Re-open Sequence
  async function replaceSocketWithAuth(accountId) {
    // Step 1: Freeze trading UI
    setTradingEnabled(false);
    
    // Reset readiness promise container
    wsReadyPromiseRef.current = new Promise((resolve) => {
      wsReadyResolveRef.current = resolve;
    });

    // Step 2: Capture and clean subscriptions on the OLD socket instance
    const oldWs = wsRef.current;
    if (oldWs && oldWs.readyState === WebSocket.OPEN) {
      console.log(`[SWAP LOG] ${new Date().toISOString()} Sending forgets to old socket`);
      try {
        const ids = Array.from(subsRef.current.values()).map(s => s.id).filter(Boolean);
        if (ids.length) {
          ids.forEach(id => oldWs.send(JSON.stringify({ forget: id, req_id: Math.floor(Math.random() * 1000) })));
        } else {
          oldWs.send(JSON.stringify({ forget_all: ['ticks', 'proposal'], req_id: Math.floor(Math.random() * 1000) }));
        }
      } catch (e) { console.error(e); }
    }
    
    // Step 3: Wait a short tick to flush stream blocks
    await new Promise(r => setTimeout(r, 150));
    
    // Step 4: Close old socket instance safely
    if (oldWs) {
      console.log(`[SWAP LOG] ${new Date().toISOString()} Closing old socket channel`);
      try { oldWs.close(); } catch (_) {}
    }

    // Step 5: Fetch fresh OTP payload & Open the raw unmodified URL
    console.log(`[SWAP LOG] ${new Date().toISOString()} Requesting new authenticated connection URL`);
    const response = await fetch(`https://api.derivws.com/trading/v1/options/accounts/${accountId}/otp`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Deriv-App-ID': appId }
    });
    const otpData = await response.json();
    const rawUrl = otpData.data.url; // 1) exact URL as-is
    
    console.log("[DIAGNOSTIC URL]: Passed directly to connection client:", rawUrl);
    
    lastOtpRef.current = { account_id: accountId, issued_at: Date.now() };
    wsUrlRef.current = rawUrl;
    
    const newWs = new WebSocket(rawUrl);
    wsRef.current = newWs;
    setTransitionState('connecting');

    newWs.onopen = () => {
      console.log(`[SWAP LOG] ${new Date().toISOString()} New socket verified OPEN`);
      wsReadyResolveRef.current();
      setTransitionState('open');
      setTradingEnabled(true);

      // Step 6: Flush any queued operations or desired subscriptions
      while (tradeQueueRef.current.length) {
        const msg = tradeQueueRef.current.shift();
        newWs.send(JSON.stringify(msg));
      }
    };
  }

  return { canTrade, sendTrading, replaceSocketWithAuth, tradingEnabled };
}
