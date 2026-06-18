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

  // Synchronize authenticated session state across framework contexts
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

  // Handle fallback to verify the socket context has authentication credentials
  useEffect(() => {
    if (!isConnected) {
      setIsAuthenticatedSocketOpen(false);
      return;
    }
    
    // Attempt to pull a fallback session token if the local hook context is currently empty
    let tokenPresent = !!wsUrl;
    if (!tokenPresent && typeof window !== 'undefined') {
      const fallbackToken = localStorage.getItem('authToken') || localStorage.getItem('config.token');
      if (fallbackToken) {
        tokenPresent = true;
      }
    }

    const isDemoEnv = activeAccount?.type === 'demo' || (!activeAccount && typeof window !== 'undefined' && window.location.href.includes('demo'));
    
    setIsAuthenticatedSocketOpen(!!(isConnected && tokenPresent));
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
