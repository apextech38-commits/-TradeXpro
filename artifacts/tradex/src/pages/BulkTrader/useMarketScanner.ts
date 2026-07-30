import { useCallback, useRef, useState } from "react";
import { getLastDigit } from "@/hooks/useDigitStats";

const WS_URL = `wss://api.derivws.com/trading/v1/options/ws/public`;

export interface MarketScanResult {
  symbol: string;
  name: string;
  evenPct: number;
  oddPct: number;
  /** Whichever of Even/Odd is currently favored */
  favored: "Even" | "Odd";
  /** How far from a 50/50 split - the actual "edge" this market is showing right now */
  skew: number;
}

export interface ScanTarget {
  symbol: string;
  name: string;
}

export interface UseMarketScannerResult {
  isScanning: boolean;
  progressLabel: string | null;
  results: MarketScanResult[];
  error: string | null;
  scan: (targets: ScanTarget[], lookback: number) => Promise<void>;
  reset: () => void;
}

/**
 * One-shot ticks_history fetch (no subscribe) for a single symbol, resolved
 * with that symbol's current even/odd split. Real computation against live
 * data - not a scripted animation - since this decides where real money
 * goes.
 */
function fetchDigitSplit(symbol: string, lookback: number): Promise<{ evenPct: number; oddPct: number }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error(`Timed out scanning ${symbol}`));
    }, 8000);

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          ticks_history: symbol,
          count: lookback,
          end: "latest",
          style: "ticks",
        })
      );
    };

    ws.onmessage = event => {
      try {
        const data = JSON.parse(event.data);
        if (data.error) {
          clearTimeout(timeout);
          ws.close();
          reject(new Error(data.error.message || `Failed to scan ${symbol}`));
          return;
        }
        if (data.history && data.history.prices) {
          const prices = (data.history.prices as (number | string)[]).map(p =>
            typeof p === "string" ? parseFloat(p) : p
          );
          const digits: number[] = prices.map(getLastDigit);
          const evenCount = digits.filter(d => d % 2 === 0).length;
          const evenPct = digits.length ? (evenCount / digits.length) * 100 : 50;
          clearTimeout(timeout);
          ws.close();
          resolve({ evenPct, oddPct: 100 - evenPct });
        }
      } catch {
        // ignore malformed frames, let the timeout handle it
      }
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      reject(new Error(`Connection error while scanning ${symbol}`));
    };
  });
}

export function useMarketScanner(): UseMarketScannerResult {
  const [isScanning, setIsScanning] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [results, setResults] = useState<MarketScanResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const reset = useCallback(() => {
    setResults([]);
    setError(null);
    setProgressLabel(null);
  }, []);

  const scan = useCallback(async (targets: ScanTarget[], lookback: number) => {
    cancelledRef.current = false;
    setIsScanning(true);
    setError(null);
    setResults([]);

    const collected: MarketScanResult[] = [];

    for (const target of targets) {
      if (cancelledRef.current) break;
      setProgressLabel(`Scanning ${target.name}...`);
      try {
        const { evenPct, oddPct } = await fetchDigitSplit(target.symbol, lookback);
        collected.push({
          symbol: target.symbol,
          name: target.name,
          evenPct,
          oddPct,
          favored: evenPct >= oddPct ? "Even" : "Odd",
          skew: Math.abs(evenPct - oddPct),
        });
      } catch (err) {
        // Skip markets that fail to scan rather than aborting the whole run
        // eslint-disable-next-line no-console
        console.warn(err instanceof Error ? err.message : `Failed to scan ${target.symbol}`);
      }
    }

    if (!cancelledRef.current) {
      collected.sort((a, b) => b.skew - a.skew);
      setResults(collected);
      if (collected.length === 0) {
        setError("Could not scan any markets. Check your connection and try again.");
      }
    }

    setProgressLabel(null);
    setIsScanning(false);
  }, []);

  return { isScanning, progressLabel, results, error, scan, reset };
}
