import { useState } from "react";

// Real backtest: fetches actual historical ticks from Deriv's public API and
// replays the exact same rise/fall-skew logic used live (useLiveScanner),
// with NO lookahead -- each simulated decision only ever sees ticks strictly
// before it. Reports directional accuracy (win rate) only, not a dollar P&L
// figure: Deriv's real payout ratio for Rise/Fall is below 100% (that's the
// house edge) and isn't reproducible from raw tick history alone, so
// presenting a 1:1 simulated profit would overstate what a real account
// would actually earn. Win rate is the honest thing to show here.
const WS_URL = "wss://api.derivws.com/trading/v1/options/ws/public";
const ROLLING_WINDOW = 60;

export interface StrategyPreset {
  id: string;
  name: string;
  symbol: string;
  symbolLabel: string;
  confidenceThreshold: number;
  durationTicks: number;
}

export const STRATEGY_PRESETS: StrategyPreset[] = [
  { id: "trend-hunter-v100",  name: "Trend Hunter",   symbol: "R_100",    symbolLabel: "Volatility 100", confidenceThreshold: 65, durationTicks: 5 },
  { id: "scalper-v75",        name: "Scalper",        symbol: "R_75",     symbolLabel: "Volatility 75",  confidenceThreshold: 60, durationTicks: 3 },
  { id: "sniper-boom500",     name: "Breakout Sniper",symbol: "BOOM500N", symbolLabel: "Boom 500",       confidenceThreshold: 75, durationTicks: 5 },
  { id: "sniper-crash300",    name: "Reversal Watch", symbol: "CRASH300N",symbolLabel: "Crash 300",      confidenceThreshold: 75, durationTicks: 5 },
];

export interface BacktestResult {
  presetId: string;
  ticksAnalyzed: number;
  trades: number;
  wins: number;
  losses: number;
  winRatePct: number | null;
  sampleWindowLabel: string;
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

function fetchHistoricalPrices(symbol: string, count: number): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const timeout = setTimeout(() => { ws.close(); reject(new Error("Timed out fetching historical data.")); }, 15000);
    ws.onopen = () => {
      ws.send(JSON.stringify({ ticks_history: symbol, adjust_start_time: 1, count, end: "latest", style: "ticks" }));
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.msg_type === "history" && Array.isArray(msg.history?.prices)) {
          clearTimeout(timeout);
          ws.close();
          resolve(msg.history.prices.map((p: string) => Number(p)));
        } else if (msg.error) {
          clearTimeout(timeout);
          ws.close();
          reject(new Error(msg.error.message || "Historical data request failed."));
        }
      } catch {
        // ignore malformed frames
      }
    };
    ws.onerror = () => { clearTimeout(timeout); reject(new Error("Connection failed while fetching historical data.")); };
  });
}

export function useStrategyBacktest() {
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, BacktestResult>>({});
  const [error, setError] = useState<string | null>(null);

  const run = async (preset: StrategyPreset) => {
    setRunning(preset.id);
    setError(null);
    try {
      // Enough history for a real sample: rolling window + a meaningful
      // number of simulated decision points.
      const SAMPLE_DECISIONS = 300;
      const totalNeeded = ROLLING_WINDOW + SAMPLE_DECISIONS + preset.durationTicks;
      const prices = await fetchHistoricalPrices(preset.symbol, totalNeeded);

      let trades = 0, wins = 0, losses = 0;
      for (let i = ROLLING_WINDOW; i < prices.length - preset.durationTicks; i++) {
        const window = prices.slice(i - ROLLING_WINDOW, i); // strictly before decision point -- no lookahead
        const { r, f } = computeRiseFall(window);
        const skew = Math.abs(r - f);
        if (skew < 8) continue; // "flat" -- same threshold as the live scanner, no trade
        const confidence = Math.round(50 + skew / 2);
        if (confidence < preset.confidenceThreshold) continue;

        const direction: "CALL" | "PUT" = r > f ? "CALL" : "PUT";
        const entrySpot = prices[i];
        const exitSpot = prices[i + preset.durationTicks];
        const won = direction === "CALL" ? exitSpot > entrySpot : exitSpot < entrySpot;

        trades++;
        if (won) wins++; else losses++;
      }

      setResults(prev => ({
        ...prev,
        [preset.id]: {
          presetId: preset.id,
          ticksAnalyzed: prices.length,
          trades, wins, losses,
          winRatePct: trades ? Math.round((wins / trades) * 100) : null,
          sampleWindowLabel: `Last ${prices.length} live ticks`,
        },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backtest failed.");
    } finally {
      setRunning(null);
    }
  };

  return { run, running, results, error };
}
