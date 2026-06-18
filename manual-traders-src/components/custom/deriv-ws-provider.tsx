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

  useEffect(() => {
    if (ws && wsUrl) {
      const isDemoEnv = activeAccount?.type === 'demo';
      const strictUrlVerified = isDemoEnv 
        ? wsUrl.includes('/demo') || wsUrl.includes('demo?otp=')
        : wsUrl.includes('/real') || wsUrl.includes('real?otp=');

      if (strictUrlVerified && ws.url !== wsUrl) {
        ws.swapSocketAuthenticated(wsUrl).catch(console.error);
      }
    }
  }, [wsUrl, ws, activeAccountId, activeAccount?.type]);

  useEffect(() => {
    if (!isConnected) {
      setIsAuthenticatedSocketOpen(false);
      return;
    }
    
    // If no explicit auth URL is present, default to true if the primary socket is connected safely
    if (!wsUrl) {
      setIsAuthenticatedSocketOpen(true);
      return;
    }

    const isDemoEnv = activeAccount?.type === 'demo';
    const strictUrlVerified = isDemoEnv 
      ? wsUrl.includes('/demo') || wsUrl.includes('demo?otp=')
      : wsUrl.includes('/real') || wsUrl.includes('real?otp=');

    setIsAuthenticatedSocketOpen(!!(isConnected && strictUrlVerified));
  }, [wsUrl, isConnected, activeAccount?.type]);

  const value: DerivWSContextValue = {
    ws,
    isConnected,
    isExhausted,
    isAuthenticatedSocketOpen,
    wsUrl,
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
