import { useEffect, useRef, useState } from "react";
import { getDomainConfig } from "@/components/shared/utils/config/config";

// Real, public-data market scanner covering every market Deriv reports as
// currently open -- fetched live via active_symbols, not a hardcoded list.
//
// Uses the same "classic" WS endpoint (wss://ws.derivws.com/websockets/v3)
// with a real app_id that the rest of this app's proven, working
// authenticated connection relies on (see components/shared/utils/config/
// config.ts's getSocketURL/getLegacyServerURL) -- NOT the newer
// /trading/v1/options/ws/public endpoint this scanner previously used.
// That endpoint has a documented limitation elsewhere in this codebase
// ("legacy api.authorize(token) will not complete there") and, in
// practice, returned only a single symbol from active_symbols with no
// app_id attached -- almost certainly treated as a bare, unidentified,
// heavily-restricted connection. The classic endpoint + real app_id is
// what actually returns Deriv's full symbol list.
//
// No fabricated numbers: every field here is computed directly from the
// live tick stream. "Confidence" is nothing more than how lopsided the
// recent rise/fall count is -- a simple, honest heuristic, not a predictive
// model. Synthetic indices are random-walk instruments by design, so this
// should never be presented as more than "recent short-term skew." Real
// (forex/stocks/commodities) markets carry the same caveat plus normal
// market unpredictability -- treat this the same way regardless of market type.
const TICK_HISTORY_COUNT = 60; // rolling window per symbol
const SYMBOLS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getScannerWsUrl(): string {
  const { appId } = getDomainConfig();
  return `wss://ws.derivws.com/websockets/v3?app_id=${encodeURIComponent(appId)}`;
}

// Module-level cache, shared across every hook instance/remount: repeated
// scan starts (navigating away and back, the toolbar's "Restart Scan", or
// just testing the page a lot) were each firing a brand new active_symbols
// request with zero reuse -- that's what actually produced the real
// "reached the rate limit for active_symbols" error from Deriv. Caching the
// result removes almost all of that traffic outright, which is the real
// fix; retry-with-backoff below is only for the cache-miss case.
let symbolsCache: { data: any[]; fetchedAt: number } | null = null;

export interface ScannerMarket {
  id: string;
  label: string;
  market: string; // Deriv's market category (synthetic_index, forex, indices, commodities, ...)
  price: number | null;
  risePct: number;
  fallPct: number;
  trend: "bullish" | "bearish" | "flat";
  confidence: number;
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
  const [markets, setMarkets] = useState<Record<string, ScannerMarket>>({});
  const [symbolsLoading, setSymbolsLoading] = useState(false);
  const [symbolsError, setSymbolsError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pricesRef = useRef<Record<string, number[]>>({});

  useEffect(() => {
    if (!enabled) {
      setMarkets({});
      return;
    }
    let cancelled = false;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let retryAttempt = 0;
    setSymbolsLoading(true);
    setSymbolsError(null);
    pricesRef.current = {};

    const ws = new WebSocket(getScannerWsUrl());
    wsRef.current = ws;

    const subscribeToSymbols = (list: any[]) => {
      // Deriv's API can return exchange_is_open as either a number or a
      // string depending on the value -- a strict === 1 check silently
      // matched nothing, which is what produced "No markets are currently
      // open" even though synthetic indices trade 24/7. Coerce instead.
      const open = list.filter(s => Number(s.exchange_is_open) === 1);

      const initial: Record<string, ScannerMarket> = {};
      open.forEach(s => {
        initial[s.symbol] = {
          id: s.symbol, label: s.display_name, market: s.market,
          price: null, risePct: 50, fallPct: 50, trend: "flat", confidence: 0, ticksSeen: 0, connected: false,
        };
        pricesRef.current[s.symbol] = [];
      });
      setMarkets(initial);

      // Subscribe to every open symbol. Errors on an individual symbol
      // (e.g. one this account/region isn't entitled to trade) are
      // caught per-symbol below and just drop that one market rather
      // than breaking the scan.
      open.forEach(s => {
        ws.send(JSON.stringify({
          ticks_history: s.symbol, adjust_start_time: 1, count: TICK_HISTORY_COUNT,
          end: "latest", style: "ticks", subscribe: 1,
        }));
      });
    };

    const requestActiveSymbols = () => {
      const fresh = symbolsCache && Date.now() - symbolsCache.fetchedAt < SYMBOLS_CACHE_TTL_MS;
      if (fresh) {
        setSymbolsLoading(false);
        subscribeToSymbols(symbolsCache!.data);
        return;
      }
      ws.send(JSON.stringify({ active_symbols: "brief" }));
    };

    ws.onopen = () => {
      if (cancelled) return;
      requestActiveSymbols();
    };

    ws.onmessage = (event) => {
      if (cancelled) return;
      try {
        const msg = JSON.parse(event.data);

        if (msg.msg_type === "active_symbols") {
          if (msg.error) {
            // Real, transient, retryable condition (rate limit or similar) --
            // back off and retry rather than dead-ending on a red error the
            // user can't do anything about. Capped attempts so a genuinely
            // broken/misconfigured request doesn't retry forever.
            retryAttempt++;
            if (retryAttempt <= 4) {
              const delayMs = 3000 * retryAttempt; // 3s, 6s, 9s, 12s
              setSymbolsError(`${msg.error.message || "Failed to load market list."} Retrying in ${Math.round(delayMs / 1000)}s...`);
              retryTimeout = setTimeout(() => {
                if (!cancelled) requestActiveSymbols();
              }, delayMs);
            } else {
              setSymbolsLoading(false);
              setSymbolsError(msg.error.message || "Failed to load market list.");
            }
            return;
          }
          setSymbolsLoading(false);
          setSymbolsError(null);
          const list: any[] = msg.active_symbols ?? [];
          symbolsCache = { data: list, fetchedAt: Date.now() };
          subscribeToSymbols(list);
          return;
        }

        const symbol: string | undefined = msg.echo_req?.ticks_history;
        if (!symbol) return;

        if (msg.error) {
          // This specific symbol isn't subscribable (entitlement/region
          // restriction, etc.) -- drop it from the scan rather than leaving
          // it stuck at "Searching..." with no path forward.
          setMarkets(prev => {
            const next = { ...prev };
            delete next[symbol];
            return next;
          });
          delete pricesRef.current[symbol];
          return;
        }

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

        setMarkets(prev => {
          if (!prev[symbol]) return prev; // dropped (e.g. errored) since this update was queued
          return {
            ...prev,
            [symbol]: {
              ...prev[symbol],
              price: prices.length ? prices[prices.length - 1] : null,
              risePct: r, fallPct: f, trend,
              confidence: Math.round(50 + skew / 2),
              ticksSeen: prices.length,
              connected: true,
            },
          };
        });
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      if (cancelled) return;
      setMarkets(prev =>
        Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { ...v, connected: false }]))
      );
    };

    return () => {
      cancelled = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      try { ws.close(); } catch { /* already closed */ }
      wsRef.current = null;
    };
  }, [enabled]);

  const marketList = Object.values(markets);
  const topMarket = marketList
    .filter(m => m.ticksSeen >= 10)
    .sort((a, b) => b.confidence - a.confidence)[0] ?? null;

  return { markets: marketList, topMarket, symbolsLoading, symbolsError };
}
