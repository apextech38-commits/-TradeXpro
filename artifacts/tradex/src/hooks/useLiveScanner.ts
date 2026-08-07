import { useEffect, useRef, useState } from "react";

// Real, public-data market scanner. No fabricated numbers: every field here
// is computed directly from the live tick stream. "Confidence" is nothing
// more than how lopsided the recent rise/fall count is -- a simple, honest
// heuristic, not a predictive model. Volatility/Boom/Crash indices are
// synthetic random-walk instruments, so this should never be presented as
// more than "recent short-term skew."
const WS_URL = "wss://api.derivws.com/trading/v1/options/ws/public";
const TICK_HISTORY_COUNT = 60; // rolling window per symbol

const SCANNED_SYMBOLS = [
  { id: "R_100",     label: "Volatility 100" },
  { id: "R_75",      label: "Volatility 75" },
  { id: "BOOM500N",  label: "Boom 500" },
  { id: "CRASH300N", label: "Crash 300" },
] as const;

export interface ScannerMarket {
  id: string;
  label: string;
  price: number | null;
  risePct: number;   // 0-100, share of up-ticks in the rolling window
  fallPct: number;   // 0-100, share of down-ticks in the rolling window
  trend: "bullish" | "bearish" | "flat";
  confidence: number; // 0-100, how lopsided rise vs fall is -- not a win probability
  ticksSeen: number;
  connected: boolean;
}

function computeRiseFall(prices: number[]) {
  let rn = 0, fn = 0;
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > prices[i - 1]) rn++;
    else if (prices[i] < prices[i - 1]) fn++;
  }
  const t = rn + fn;
  return t ? { r: (rn / t) * 100, f: (fn / t) * 100 } : { r: 50, f: 50 };
}

export function useLiveScanner(enabled: boolean) {
  const [markets, setMarkets] = useState<Record<string, ScannerMarket>>(() =>
    Object.fromEntries(
      SCANNED_SYMBOLS.map(s => [
        s.id,
        { id: s.id, label: s.label, price: null, risePct: 50, fallPct: 50, trend: "flat" as const, confidence: 0, ticksSeen: 0, connected: false },
      ])
    )
  );
  const wsRef = useRef<WebSocket | null>(null);
  const pricesRef = useRef<Record<string, number[]>>(
    Object.fromEntries(SCANNED_SYMBOLS.map(s => [s.id, []]))
  );

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (cancelled) return;
      SCANNED_SYMBOLS.forEach(s => {
        ws.send(JSON.stringify({
          ticks_history: s.id,
          adjust_start_time: 1,
          count: TICK_HISTORY_COUNT,
          end: "latest",
          style: "ticks",
          subscribe: 1,
        }));
      });
    };

    ws.onmessage = (event) => {
      if (cancelled) return;
      try {
        const msg = JSON.parse(event.data);
        const symbol: string | undefined = msg.echo_req?.ticks_history;
        if (!symbol) return;

        if (msg.msg_type === "history" && Array.isArray(msg.history?.prices)) {
          pricesRef.current[symbol] = msg.history.prices.map((p: string) => Number(p));
        } else if (msg.msg_type === "tick" && msg.tick?.quote != null) {
          const arr = pricesRef.current[symbol] ?? [];
          arr.push(Number(msg.tick.quote));
          if (arr.length > TICK_HISTORY_COUNT) arr.shift();
          pricesRef.current[symbol] = arr;
        } else {
          return;
        }

        const prices = pricesRef.current[symbol] ?? [];
        const { r, f } = computeRiseFall(prices);
        const skew = Math.abs(r - f);
        const trend: ScannerMarket["trend"] = skew < 8 ? "flat" : r > f ? "bullish" : "bearish";

        setMarkets(prev => ({
          ...prev,
          [symbol]: {
            ...prev[symbol],
            price: prices.length ? prices[prices.length - 1] : null,
            risePct: r,
            fallPct: f,
            trend,
            confidence: Math.round(50 + skew / 2), // 50 (no skew) .. 100 (maximally lopsided)
            ticksSeen: prices.length,
            connected: true,
          },
        }));
      } catch {
        // ignore malformed frames
      }
    };

    ws.onerror = () => {
      if (cancelled) return;
    };

    ws.onclose = () => {
      if (cancelled) return;
      setMarkets(prev =>
        Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { ...v, connected: false }]))
      );
    };

    return () => {
      cancelled = true;
      try { ws.close(); } catch { /* already closed */ }
      wsRef.current = null;
    };
  }, [enabled]);

  const marketList = SCANNED_SYMBOLS.map(s => markets[s.id]);
  // The "top" market for the hero panel: whichever has seen enough ticks to
  // be meaningful and has the most lopsided (highest-confidence) skew.
  const topMarket = marketList
    .filter(m => m.ticksSeen >= 10)
    .sort((a, b) => b.confidence - a.confidence)[0] ?? null;

  return { markets: marketList, topMarket };
}
