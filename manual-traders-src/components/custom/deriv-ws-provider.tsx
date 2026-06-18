'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { useDerivWS } from '@/packages/core/src/react/useDerivWS';
import { useAuth } from '@/hooks/use-auth';
import type { DerivWS } from '@/packages/core/src/ws/deriv-ws';

interface DerivWSContextValue {
  ws: DerivWS | null;
  isConnected: boolean;
  isExhausted: boolean;
  isAuthenticatedSocketOpen: boolean;
  wsUrl: string | null;
  lastOtp: any;
  auth: ReturnType<typeof useAuth>;
}

const DerivWSContext = createContext<DerivWSContextValue | null>(null);

export function DerivWSProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const { wsUrl, activeAccountId, activeAccount } = auth;

  const { ws, isConnected, isExhausted } = useDerivWS({
    url: wsUrl || undefined,
    accountId: activeAccountId ?? undefined,
  });

  const [isAuthenticatedSocketOpen, setIsAuthenticatedSocketOpen] = useState(false);
  const [lastOtp, setLastOtp] = useState<any>(null);

  // 4) Monitor URL state transitions and update/swap the socket configuration
  useEffect(() => {
    if (ws && wsUrl) {
      const isDemoEnv = activeAccount?.type === 'demo';
      const strictUrlVerified = isDemoEnv 
        ? wsUrl.includes('/trading/v1/options/ws/demo') 
        : wsUrl.includes('/trading/v1/options/ws/real');

      if (strictUrlVerified && ws.url !== wsUrl) {
        setLastOtp({ account_id: activeAccountId, timestamp: Date.now() });
        ws.swapSocketAuthenticated(wsUrl).catch(console.error);
      }
    }
  }, [wsUrl, ws, activeAccountId, activeAccount?.type]);

  // 2) Run the strict connection readiness guard check
  useEffect(() => {
    if (!ws || !wsUrl) {
      setIsAuthenticatedSocketOpen(false);
      return;
    }
    const isDemoEnv = activeAccount?.type === 'demo';
    const strictUrlVerified = isDemoEnv 
      ? wsUrl.includes('/trading/v1/options/ws/demo') 
      : wsUrl.includes('/trading/v1/options/ws/real');

    const matchedAccount = lastOtp?.account_id === activeAccountId;
    
    setIsAuthenticatedSocketOpen(!!(isConnected && strictUrlVerified && matchedAccount));
  }, [wsUrl, isConnected, ws, activeAccountId, activeAccount?.type, lastOtp]);

  const value: DerivWSContextValue = {
    ws,
    isConnected,
    isExhausted,
    isAuthenticatedSocketOpen,
    wsUrl,
    lastOtp,
    auth,
  };

  return (
    <DerivWSContext.Provider value={value}>
      {children}
    </DerivWSContext.Provider>
  );
}

export function useDerivWSContext() {
  const context = useContext(DerivWSContext);
  if (!context) {
    throw new Error('useDerivWSContext must be used within DerivWSProvider');
  }
  return context;
}
