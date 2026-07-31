import { useCallback, useRef, useState } from "react";
import { getLastDigit } from "@/hooks/useDigitStats";

const WS_URL = `wss://api.derivws.com/trading/v1/options/ws/public`;

export interface MarketScanResult {
  symbol: string;
  name: string;
  /** The two sides relevant to whichever trade type the scan was run for */
  sideALabel: string;
  sideAPct: number;
  sideBLabel: string;
  sideBPct: number;
  /** Whichever side is currently ahead */
  favoredLabel: string;
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
  scan: (
    targets: ScanTarget[],
    lookback: number,
    tradeType: "evenodd" | "overunder" | "matchdiffer",
    barrierDigit: number
  ) => Promise<void>;
  reset: () => void;
}

/**
 * One-shot ticks_history fetch (no subscribe) for a single symbol, resolved
 * with the full 0-9 digit percentage breakdown. Real computation against
 * live data - not a scripted animation - since this decides where real
 * money goes. Returning the whole histogram (not just even/odd) lets the
 * caller derive whichever two sides matter for the currently selected
 * trade type -- Over/Under and Matches/Differs both need this, not just
 * Even/Odd.
 */
function fetchDigitHistogram(symbol: string, lookback: number): Promise<number[]> {
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
          const counts = new Array(10).fill(0);
          digits.forEach(d => counts[d]++);
          const percentages = digits.length ? counts.map(c => (c / digits.length) * 100) : new Array(10).fill(10);
          clearTimeout(timeout);
          ws.close();
          resolve(percentages);
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

/** Derives the two sides relevant to a trade type from a full digit histogram. */
function deriveSides(
  percentages: number[],
  tradeType: "evenodd" | "overunder" | "matchdiffer",
  barrierDigit: number
): { sideALabel: string; sideAPct: number; sideBLabel: string; sideBPct: number } {
  if (tradeType === "overunder") {
    const overPct = percentages.filter((_, digit) => digit > barrierDigit).reduce((s, p) => s + p, 0);
    const underPct = percentages.filter((_, digit) => digit < barrierDigit).reduce((s, p) => s + p, 0);
    return { sideALabel: "Over", sideAPct: overPct, sideBLabel: "Under", sideBPct: underPct };
  }
  if (tradeType === "matchdiffer") {
    const matchPct = percentages[barrierDigit] ?? 0;
    return { sideALabel: "Matches", sideAPct: matchPct, sideBLabel: "Differs", sideBPct: 100 - matchPct };
  }
  const evenPct = percentages.filter((_, digit) => digit % 2 === 0).reduce((s, p) => s + p, 0);
  return { sideALabel: "Even", sideAPct: evenPct, sideBLabel: "Odd", sideBPct: 100 - evenPct };
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

  const scan = useCallback(
    async (
      targets: ScanTarget[],
      lookback: number,
      tradeType: "evenodd" | "overunder" | "matchdiffer",
      barrierDigit: number
    ) => {
      cancelledRef.current = false;
      setIsScanning(true);
      setError(null);
      setResults([]);

      const collected: MarketScanResult[] = [];

      for (const target of targets) {
        if (cancelledRef.current) break;
        setProgressLabel(`Scanning ${target.name}...`);
        try {
          const percentages = await fetchDigitHistogram(target.symbol, lookback);
          const sides = deriveSides(percentages, tradeType, barrierDigit);
          collected.push({
            symbol: target.symbol,
            name: target.name,
            ...sides,
            favoredLabel: sides.sideAPct >= sides.sideBPct ? sides.sideALabel : sides.sideBLabel,
            skew: Math.abs(sides.sideAPct - sides.sideBPct),
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
    },
    []
  );

  return { isScanning, progressLabel, results, error, scan, reset };
}
