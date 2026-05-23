import { useState, useEffect, useCallback, useRef } from 'react';
import { DERIV_APP_ID } from '@/context/AuthContext';

const WS_URL = `wss://ws.binaryws.com/websockets/v3?app_id=${DERIV_APP_ID}`;
const TOKEN_KEY = "deriv_token";

export interface Tick {
  epoch: number;
  quote: number;
  symbol: string;
}

export function useDerivWS() {
  const [isConnected, setIsConnected] = useState(false);
  const [ticks, setTicks] = useState<Tick[]>([]);
  const [latestTick, setLatestTick] = useState<Tick | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const activeSymbolRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setIsConnected(true);
      // Authorize if token exists (enables private data access)
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) {
        ws.send(JSON.stringify({ authorize: token }));
      } else if (activeSymbolRef.current) {
        ws.send(JSON.stringify({ ticks: activeSymbolRef.current, subscribe: 1 }));
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setIsConnected(false);
      setTimeout(connect, 3000);
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const data = JSON.parse(event.data);
        if (data.error) return;

        // After authorization succeeds, subscribe to the pending symbol
        if (data.msg_type === 'authorize' && activeSymbolRef.current) {
          ws.send(JSON.stringify({ ticks: activeSymbolRef.current, subscribe: 1 }));
          return;
        }

        if (data.msg_type === 'tick') {
          const newTick: Tick = {
            epoch: data.tick.epoch,
            quote: data.tick.quote,
            symbol: data.tick.symbol,
          };
          setLatestTick(newTick);
          setTicks(prev => {
            const updated = [...prev, newTick];
            return updated.length > 5000 ? updated.slice(-5000) : updated;
          });
        }
      } catch (_) {}
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      wsRef.current?.close();
    };
  }, [connect]);

  const subscribe = useCallback((symbol: string) => {
    activeSymbolRef.current = symbol;
    setTicks([]);
    setLatestTick(null);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
    }
  }, []);

  const unsubscribe = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && activeSymbolRef.current) {
      wsRef.current.send(JSON.stringify({ forget_all: 'ticks' }));
      activeSymbolRef.current = null;
    }
  }, []);

  return { ticks, latestTick, isConnected, subscribe, unsubscribe };
}
