'use client';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';

const TOKEN_KEY = "tradex_access_token";
const ACCOUNTS_KEY = "tradex-deriv-accounts";
const API_BASE = "https://api.derivws.com/trading/v1/options";
const OAUTH_APP_ID = "33ughhvgtxloGWBQQZEeD";

export default function ManualTraders() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { activeAccount, accounts } = useAuth();

  useEffect(() => {
    const sendAuth = async () => {
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) return;
      const token = localStorage.getItem(TOKEN_KEY);
      const storedAccounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
      if (!token || storedAccounts.length === 0) return;

      const activeId = activeAccount?.account || storedAccounts[0]?.account;

      // Fetch OTP here using the working OAUTH_APP_ID
      let wsUrl: string | undefined;
      try {
        const otpRes = await fetch(`${API_BASE}/accounts/${activeId}/otp`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Deriv-App-ID': OAUTH_APP_ID,
          },
        });
        if (otpRes.ok) {
          const otpJson = await otpRes.json();
          wsUrl = otpJson.data?.url;
        }
      } catch (e) {
        console.warn('[ManualTraders] OTP fetch failed:', e);
      }

      iframe.contentWindow.postMessage({
        type: 'TRADEX_AUTH',
        token,
        accounts: storedAccounts,
        activeAccountId: activeId,
        wsUrl, // send the ready-made wsUrl
      }, '*');
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'TRADEX_READY') {
        sendAuth();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [activeAccount, accounts]);

  return (
    <iframe
      ref={iframeRef}
      src="/manualtraders/"
      title="Manual Traders"
      style={{ width: "100%", height: "calc(100vh - 56px)", border: "none" }}
    />
  );
}
