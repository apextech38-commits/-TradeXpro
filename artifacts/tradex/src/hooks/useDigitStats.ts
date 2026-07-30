import { useEffect, useRef, useState } from 'react';

// Same public market-data endpoint already used by AIScanner, DerivSmartChart,
// BottomBar, Dashboard, Strategies, and AnalysisTool - no auth needed for
// ticks_history / tick subscriptions, so this stays fully decoupled from
// AuthContext's own authenticated WS session.
const WS_URL = `wss://api.derivws.com/trading/v1/options/ws/public`;

// Matches AIScanner's getLastDigit exactly (toFixed(2) is correct for the
// standard Volatility/1HZ synthetic indices this hook targets - all of them
// quote at 2 decimal places on Deriv).
export function getLastDigit(price: number): number {
    return parseInt(price.toFixed(2).slice(-1), 10);
}

export interface DigitStat {
    digit: number;
    percentage: number;
}

export interface UseDigitStatsResult {
    /** Always length 10, indexed 0-9, percentage of `lookback` window ending in that digit */
    digitStats: DigitStat[];
    lastDigit: number | null;
    currentTick: number | null;
    /** How many ticks are actually in the rolling window right now (ramps up to `lookback`) */
    sampleSize: number;
    isConnected: boolean;
    isLoading: boolean;
    error: string | null;
}

const MIN_LOOKBACK = 10;
const MAX_LOOKBACK = 5000;

/**
 * Subscribes to a live tick stream for `symbol` and maintains a rolling
 * window of the last `lookback` ticks' last-digit distribution, recomputed
 * on every new tick. Backfills the window immediately via ticks_history so
 * percentages are meaningful from the first render, not just after
 * `lookback` live ticks have arrived.
 */
export function useDigitStats(symbol: string, lookback: number): UseDigitStatsResult {
    const clampedLookback = Math.min(Math.max(Math.floor(lookback) || MIN_LOOKBACK, MIN_LOOKBACK), MAX_LOOKBACK);

    const [digitStats, setDigitStats] = useState<DigitStat[]>(() =>
        Array.from({ length: 10 }, (_, digit) => ({ digit, percentage: 0 }))
    );
    const [lastDigit, setLastDigit] = useState<number | null>(null);
    const [currentTick, setCurrentTick] = useState<number | null>(null);
    const [sampleSize, setSampleSize] = useState(0);
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const digitsRef = useRef<number[]>([]);
    const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        setIsLoading(true);
        setError(null);
        digitsRef.current = [];
        setSampleSize(0);

        const recompute = () => {
            const digits = digitsRef.current;
            const total = digits.length;
            setSampleSize(total);
            if (total === 0) return;
            const counts = new Array(10).fill(0);
            for (let i = 0; i < digits.length; i += 1) {
                counts[digits[i]] += 1;
            }
            setDigitStats(
                counts.map((count, digit) => ({
                    digit,
                    percentage: Math.round((count / total) * 1000) / 10,
                }))
            );
        };

        const connect = () => {
            if (!mountedRef.current) return;

            const ws = new WebSocket(WS_URL);
            wsRef.current = ws;

            ws.onopen = () => {
                if (!mountedRef.current) return;
                setIsConnected(true);
                ws.send(
                    JSON.stringify({
                        ticks_history: symbol,
                        count: clampedLookback,
                        end: 'latest',
                        style: 'ticks',
                        subscribe: 1,
                    })
                );
            };

            ws.onmessage = event => {
                if (!mountedRef.current) return;
                try {
                    const data = JSON.parse(event.data);

                    if (data.error) {
                        setError(data.error.message || 'Failed to load tick data');
                        setIsLoading(false);
                        return;
                    }

                    // Backfill: initial ticks_history response
                    if (data.history && data.history.prices) {
                        const prices = (data.history.prices as (number | string)[]).map(p =>
                            typeof p === 'string' ? parseFloat(p) : p
                        );
                        const digits = prices.map(getLastDigit).slice(-clampedLookback);
                        digitsRef.current = digits;

                        const lastPrice = prices[prices.length - 1];
                        if (lastPrice !== undefined) {
                            setCurrentTick(lastPrice);
                            setLastDigit(getLastDigit(lastPrice));
                        }
                        recompute();
                        setIsLoading(false);
                        return;
                    }

                    // Live updates: one new tick at a time
                    if (data.tick) {
                        const price = parseFloat(data.tick.quote);
                        const digit = getLastDigit(price);
                        setCurrentTick(price);
                        setLastDigit(digit);
                        digitsRef.current = [...digitsRef.current, digit].slice(-clampedLookback);
                        recompute();
                    }
                } catch {
                    // Ignore malformed frames - matches AIScanner's existing behavior
                }
            };

            ws.onerror = () => {
                if (!mountedRef.current) return;
                setError('Connection error while loading tick data');
                setIsConnected(false);
            };

            ws.onclose = () => {
                if (!mountedRef.current) return;
                setIsConnected(false);
                // Auto-reconnect so a dropped connection doesn't leave the
                // digit stats permanently frozen mid-session.
                reconnectRef.current = setTimeout(connect, 3000);
            };
        };

        connect();

        return () => {
            mountedRef.current = false;
            if (reconnectRef.current) clearTimeout(reconnectRef.current);
            if (wsRef.current) {
                wsRef.current.onclose = null;
                wsRef.current.close();
                wsRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [symbol, clampedLookback]);

    return { digitStats, lastDigit, currentTick, sampleSize, isConnected, isLoading, error };
}
