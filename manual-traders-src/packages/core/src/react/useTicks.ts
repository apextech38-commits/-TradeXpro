// manual-traders-src/packages/core/src/react/useTicks.ts
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { DerivWS } from '../ws';
import type { ActiveSymbol, Tick, TicksHistoryResponse } from '../types';

const DEFAULT_TICK_COUNT = 1000;

interface UseTicksReturn {
  currentTick: Tick | null;
  prices: number[];
  pipSize: number;
}

export function useTicks(
  ws: DerivWS | null,
  isConnected: boolean,
  activeSymbol: ActiveSymbol | null,
  tickCount: number = DEFAULT_TICK_COUNT,
  isAuthenticatedSocketOpen: boolean = false // New param
): UseTicksReturn {
  const pricesRef = useRef<number[]>([]);
  const pipSizeRef = useRef<number>(2);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const subscriptionIdRef = useRef<string | null>(null);

  const [currentTick, setCurrentTick] = useState<Tick | null>(null);
  const [prices, setPrices] = useState<number[]>([]);
  const [pipSize, setPipSize] = useState<number>(2);

  const pipSizeFromPip = useCallback((pip: number): number => {
    if (pip >= 1) return 0;
    const str = pip.toString();
    const dotIndex = str.indexOf('.');
    return dotIndex === -1 ? 0 : str.length - dotIndex - 1;
  }, []);

  useEffect(() => {
    // 🔐 CRITICAL: Check authentication before subscribing to ticks
    if (!ws || !isConnected || !activeSymbol) {
      return;
    }

    if (!isAuthenticatedSocketOpen) {
      console.warn('⛔ Ticks subscription blocked: Not authenticated', {
        wsUrl: (ws as any)?.url,
        isConnected,
        isAuthenticatedSocketOpen
      });
      // Clear existing data
      setCurrentTick(null);
      setPrices([]);
      pricesRef.current = [];
      return;
    }

    let disposed = false;

    // Unsubscribe from previous subscription
    const cleanupPrevious = async () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      
      // Send forget_all for ticks to clean up server-side subscription
      if (ws?.isConnected) {
        try {
          await ws.send({ forget_all: 'ticks' });
          console.log('🧹 Cleaned up previous ticks subscription');
        } catch (err) {
          // Ignore errors on cleanup
          console.debug('Cleanup error (ignored):', err);
        }
      }
    };

    // Reset refs
    pricesRef.current = [];

    const ps = pipSizeFromPip(activeSymbol.pip_size);
    pipSizeRef.current = ps;

    async function subscribe() {
      // Clean up previous subscription first
      await cleanupPrevious();
      
      if (disposed) return;

      // Small delay so Deriv server can process forget_all from previous connection
      // before we resubscribe — prevents "Already subscribed"
      await new Promise(resolve => setTimeout(resolve, 300));
      if (disposed) return;

      console.log('📡 Subscribing to ticks:', {
        symbol: activeSymbol!.underlying_symbol,
        isAuthenticated: isAuthenticatedSocketOpen,
        wsUrl: (ws as any)?.url
      });

      const historyResponse = await ws!.send<TicksHistoryResponse>({
        ticks_history: activeSymbol!.underlying_symbol,
        end: 'latest',
        start: 1,
        count: tickCount,
        style: 'ticks',
      });
      if (disposed) return;

      setPipSize(ps);
      const historyPrices = historyResponse.history?.prices ?? [];
      pricesRef.current = historyPrices;
      setPrices([...historyPrices]);

      // Subscribe to live ticks
      const sub = await ws!.subscribe(
        { ticks: activeSymbol!.underlying_symbol },
        (data) => {
          const tick = (data as { tick?: Tick }).tick;
          if (tick) {
            const tickPs = tick.pip_size ?? pipSizeRef.current;
            if (tick.pip_size && tick.pip_size !== pipSizeRef.current) {
              pipSizeRef.current = tick.pip_size;
            }

            setCurrentTick(tick);

            // Sliding window update
            pricesRef.current = [...pricesRef.current, tick.quote];
            if (pricesRef.current.length > tickCount) {
              pricesRef.current = pricesRef.current.slice(-tickCount);
            }
            setPrices([...pricesRef.current]);
            setPipSize(tickPs);
          }
        }
      );
      if (disposed) {
        sub.unsubscribe();
        return;
      }
      unsubscribeRef.current = sub.unsubscribe;
      console.log('✅ Ticks subscription active');
    }

    subscribe().catch((err) => {
      console.error('❌ Ticks subscription error:', err);
    });

    return () => {
      disposed = true;
      setCurrentTick(null);
      setPrices([]);
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      // Send forget_all for ticks so the server clears the stream
      if (ws?.isConnected) {
        ws.send({ forget_all: 'ticks' }).catch(() => {});
      }
    };
  }, [ws, isConnected, activeSymbol, tickCount, pipSizeFromPip, isAuthenticatedSocketOpen]);

  return { currentTick, prices, pipSize };
}