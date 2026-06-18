// manual-traders-src/components/custom/deriv-ws-provider.tsx
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
  auth: ReturnType<typeof useAuth>;
}

const DerivWSContext = createContext<DerivWSContextValue | null>(null);

export function DerivWSProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const { wsUrl, activeAccountId } = auth;

  const { ws, isConnected, isExhausted } = useDerivWS({
    url: wsUrl || undefined,
    accountId: activeAccountId ?? undefined,
  });

  const [isAuthenticatedSocketOpen, setIsAuthenticatedSocketOpen] = useState(false);

  useEffect(() => {
    const isAuthUrl = wsUrl?.includes('/demo') || wsUrl?.includes('/real');
    setIsAuthenticatedSocketOpen(!!(isAuthUrl && isConnected));
  }, [wsUrl, isConnected]);

  const value: DerivWSContextValue = {
    ws,
    isConnected,
    isExhausted,
    isAuthenticatedSocketOpen,
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
