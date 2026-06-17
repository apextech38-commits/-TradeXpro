// manual-traders-src/components/custom/deriv-ws-provider.tsx
'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { useDerivWS } from '@deriv/core';
import { useAuth } from '@/hooks/use-auth';
import type { DerivWS } from '@deriv/core';

interface DerivWSContextValue {
  ws: DerivWS | null;
  isConnected: boolean;
  isAuthenticatedSocketOpen: boolean;
  wsUrl: string | undefined;
  readyState: number;
}

const DerivWSContext = createContext<DerivWSContextValue | null>(null);

export function DerivWSProvider({ children }: { children: React.ReactNode }) {
  const { wsUrl: authWsUrl, accountId } = useAuth();

  const { ws, isConnected, wsUrl, readyState } = useDerivWS({
    wsUrl: authWsUrl || undefined,
    reconnectKey: accountId ? `auth:${accountId}` : 'public',
  });

  const [isAuthenticatedSocketOpen, setIsAuthenticatedSocketOpen] = useState(false);

  useEffect(() => {
    // SIMPLE CHECK: Is the URL authenticated AND is the socket open?
    const isAuthUrl = wsUrl?.includes('/demo') || wsUrl?.includes('/real');
    const isOpen = readyState === 1;
    const result = isAuthUrl && isOpen;

    setIsAuthenticatedSocketOpen(result);

    // Log what's happening
    console.log('🔐 Auth status:', {
      wsUrl,
      isAuthUrl,
      isOpen,
      result,
      accountId
    });
  }, [wsUrl, readyState, accountId]);

  const value: DerivWSContextValue = {
    ws,
    isConnected,
    isAuthenticatedSocketOpen,
    wsUrl,
    readyState,
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