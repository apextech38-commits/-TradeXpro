// manual-traders-src/components/custom/deriv-ws-provider.tsx
'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
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
  const { accessToken, accountId, accountType, getWebSocketOTP, wsUrl: authWsUrl } = useAuth();
  const [isAuthenticatedSocketOpen, setIsAuthenticatedSocketOpen] = useState(false);
  const lastOtpRef = useRef<{ accountId: string; timestamp: number } | null>(null);

  const { ws, isConnected, wsUrl, readyState } = useDerivWS({
    wsUrl: authWsUrl || undefined,
    reconnectKey: accountId ? `auth:${accountId}` : 'public',
  });

  // Check if we have a valid authenticated socket
  useEffect(() => {
    const isAuthUrl = wsUrl?.includes('/demo') || wsUrl?.includes('/real');
    const isOpen = readyState === 1; // WebSocket.OPEN
    const accountMatches = lastOtpRef.current?.accountId === accountId;
    const isOtpFresh = lastOtpRef.current && 
      (Date.now() - lastOtpRef.current.timestamp) < 300000; // 5 minutes

    const isOpenAndAuth = isAuthUrl && isOpen && accountMatches && isOtpFresh;
    
    setIsAuthenticatedSocketOpen(!!isOpenAndAuth);
    
    // Debug logging
    console.log('🔐 Auth socket status:', {
      isAuthUrl,
      isOpen,
      accountMatches,
      isOtpFresh,
      wsUrl,
      readyState,
      accountId,
      isOpenAndAuth
    });
  }, [wsUrl, readyState, accountId]);

  // When account changes or token refreshes, get fresh OTP
  useEffect(() => {
    if (accessToken && accountId && accountType) {
      const getOTP = async () => {
        try {
          const wsUrl = await getWebSocketOTP(accountId);
          console.log('✅ Fresh OTP obtained:', wsUrl);
          
          // Mark OTP as refreshed
          lastOtpRef.current = {
            accountId,
            timestamp: Date.now()
          };
        } catch (error) {
          console.error('❌ Failed to get OTP:', error);
        }
      };
      
      getOTP();
    }
  }, [accessToken, accountId, accountType, getWebSocketOTP]);

  const value: DerivWSContextValue = {
    ws,
    isConnected,
    isAuthenticatedSocketOpen,
    wsUrl,
    readyState
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