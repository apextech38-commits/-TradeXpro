import { useMemo, useState } from "react";
import { Layers, Settings2, StopCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useDigitStats } from "@/hooks/useDigitStats";
import { useBulkTrading, TDigitDirection } from "@/hooks/useBulkTrading";
import DigitWheel from "./DigitWheel";

const MARKETS = [
  { label: "Volatility 10 (1s) Index", symbol: "1HZ10V" },
  { label: "Volatility 15 (1s) Index", symbol: "1HZ15V" },
  { label: "Volatility 25 (1s) Index", symbol: "1HZ25V" },
  { label: "Volatility 30 (1s) Index", symbol: "1HZ30V" },
  { label: "Volatility 50 (1s) Index", symbol: "1HZ50V" },
  { label: "Volatility 75 (1s) Index", symbol: "1HZ75V" },
  { label: "Volatility 90 (1s) Index", symbol: "1HZ90V" },
  { label: "Volatility 100 (1s) Index", symbol: "1HZ100V" },
  { label: "Volatility 10 Index", symbol: "R_10" },
  { label: "Volatility 25 Index", symbol: "R_25" },
  { label: "Volatility 50 Index", symbol: "R_50" },
  { label: "Volatility 75 Index", symbol: "R_75" },
  { label: "Volatility 100 Index", symbol: "R_100" },
];

export default function BulkTrader() {
  const { isLoggedIn, currency } = useAuth();

  const [symbol, setSymbol] = useState("R_100");
  const [tradeType, setTradeType] = useState<"even-odd" | "over-under" | "matches-differs">("even-odd");
  const [lookbackInput, setLookbackInput] = useState("120");
  const [ticksInput, setTicksInput] = useState("1");
  const [stakeInput, setStakeInput] = useState("0.5");
  const [bulkCountInput, setBulkCountInput] = useState("1");

  const [isAutoPanelOpen, setIsAutoPanelOpen] = useState(false);
  const [profitTargetInput, setProfitTargetInput] = useState("");
  const [isAutoMode, setIsAutoMode] = useState(false);

  const lookback = Math.max(10, Math.min(5000, Number(lookbackInput) || 120));
  const ticksDuration = Math.max(1, Number(ticksInput) || 1);
  const stake = Math.max(0.35, Number(stakeInput) || 0.35);
  const bulkCount = Math.max(1, Math.min(1000, Number(bulkCountInput) || 1));
  const profitTarget = profitTargetInput ? Number(profitTargetInput) : undefined;

  const { digitStats, lastDigit, currentTick, sampleSize, isLoading, error: statsError } = useDigitStats(
    symbol,
    lookback
  );

  const evenPct = useMemo(
    () => digitStats.filter(d => d.digit % 2 === 0).reduce((sum, d) => sum + d.percentage, 0),
    [digitStats]
  );
  const oddPct = 100 - evenPct;

  const highestDigit = useMemo(
    () => digitStats.reduce((best, d) => (d.percentage > best.percentage ? d : best), digitStats[0]),
    [digitStats]
  );
  const lowestDigit = useMemo(
    () => digitStats.reduce((worst, d) => (d.percentage < worst.percentage ? d : worst), digitStats[0]),
    [digitStats]
  );

  const getAutoDirection = (): TDigitDirection => (evenPct >= oddPct ? "DIGITEVEN" : "DIGITODD");

  const runner = useBulkTrading({
    symbol,
    currency: currency || "USD",
    stake,
    ticksDuration,
    bulkCount,
    profitTarget,
    isAuto: isAutoMode,
    getAutoDirection,
  });

  const canTrade = isLoggedIn && !runner.isRunning;

  const handleManualBuy = (direction: TDigitDirection) => {
    setIsAutoMode(false);
    runner.start(direction);
  };

  const handleAutoStart = () => {
    setIsAutoMode(true);
    setIsAutoPanelOpen(false);
    runner.start(getAutoDirection());
  };

  return (
    <div className="flex flex-col w-full h-full p-4 md:p-6 gap-6">
      <div className="flex items-center gap-2">
        <Layers className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold text-foreground">Bulk Trader</h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: market/config + digit wheels */}
        <div className="flex-1 flex flex-col gap-5 bg-card border border-border rounded-xl p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Market</label>
              <select
                value={symbol}
                onChange={e => setSymbol(e.target.value)}
                disabled={runner.isRunning}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground disabled:opacity-50"
              >
                {MARKETS.map(m => (
                  <option key={m.symbol} value={m.symbol}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Trade Type</label>
              <select
                value={tradeType}
                onChange={e => setTradeType(e.target.value as typeof tradeType)}
                disabled={runner.isRunning}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground disabled:opacity-50"
              >
                <option value="even-odd">Even / Odd</option>
                <option value="over-under" disabled>
                  Over / Under (coming soon)
                </option>
                <option value="matches-differs" disabled>
                  Matches / Differs (coming soon)
                </option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Number of Ticks (lookback window)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={lookbackInput}
              onChange={e => setLookbackInput(e.target.value.replace(/[^\d]/g, ""))}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
              placeholder="120"
            />
          </div>

          <div className="flex items-center justify-between rounded-md bg-muted/40 px-4 py-3">
            <div className="flex flex-col">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Current Tick</span>
              <span className="text-lg font-bold text-foreground tabular-nums">
                {currentTick !== null ? currentTick.toFixed(2) : "--"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={`w-2 h-2 rounded-full ${statsError ? "bg-red-500" : "bg-green-500"}`} />
              {statsError ? "Disconnected" : isLoading ? "Loading..." : `Live · ${sampleSize} ticks`}
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-x-3 gap-y-4 py-2">
            {digitStats.map(d => (
              <DigitWheel
                key={d.digit}
                digit={d.digit}
                percentage={d.percentage}
                isLastDigit={lastDigit === d.digit}
                isHighest={d.digit === highestDigit?.digit}
                isLowest={d.digit === lowestDigit?.digit}
              />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ticks</label>
              <input
                type="text"
                inputMode="numeric"
                value={ticksInput}
                onChange={e => setTicksInput(e.target.value.replace(/[^\d]/g, ""))}
                disabled={runner.isRunning}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground disabled:opacity-50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Stake ({currency || "USD"})
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={stakeInput}
                onChange={e => setStakeInput(e.target.value.replace(/[^\d.]/g, ""))}
                disabled={runner.isRunning}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground disabled:opacity-50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                No. of Bulk Trades
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={bulkCountInput}
                onChange={e => setBulkCountInput(e.target.value.replace(/[^\d]/g, ""))}
                disabled={runner.isRunning}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsAutoPanelOpen(v => !v)}
              disabled={runner.isRunning}
              className="flex items-center gap-1.5 text-sm text-primary hover:underline disabled:opacity-50"
            >
              <Settings2 className="w-4 h-4" />
              Auto Trader
            </button>

            {runner.isRunning && (
              <button
                type="button"
                onClick={runner.stop}
                className="flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700"
              >
                <StopCircle className="w-4 h-4" />
                Stop
              </button>
            )}
          </div>

          {isAutoPanelOpen && !runner.isRunning && (
            <div className="flex flex-col gap-3 rounded-md border border-primary/30 bg-primary/5 p-4">
              <p className="text-xs text-muted-foreground">
                Auto Trader stops automatically after 3 losses in a row, once total profit reaches your target
                below, or after {bulkCount} trades &mdash; whichever comes first. Direction follows whichever side
                (Even/Odd) has better odds as stats update, and you can stop it manually at any time.
              </p>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Target Profit ({currency || "USD"}) &mdash; optional
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={profitTargetInput}
                  onChange={e => setProfitTargetInput(e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="e.g. 5.00"
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                />
              </div>
              <button
                type="button"
                onClick={handleAutoStart}
                disabled={!canTrade}
                className="h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
              >
                Start Auto Trader
              </button>
            </div>
          )}

          {!isLoggedIn && (
            <p className="text-xs text-amber-600 bg-amber-500/10 rounded-md px-3 py-2">
              Log in to your Deriv account to start trading.
            </p>
          )}
          {runner.lastError && (
            <p className="text-xs text-red-600 bg-red-500/10 rounded-md px-3 py-2">{runner.lastError}</p>
          )}
          {runner.stopReason && !runner.isRunning && (
            <p className="text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2">{runner.stopReason}</p>
          )}
        </div>

        {/* Right: manual Even/Odd buy buttons + live run stats */}
        <div className="w-full lg:w-80 flex flex-col gap-4">
          <div className="flex flex-col gap-3 bg-card border border-border rounded-xl p-5">
            <button
              type="button"
              onClick={() => handleManualBuy("DIGITEVEN")}
              disabled={!canTrade}
              className="flex items-center justify-between rounded-md bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-4 transition-colors"
            >
              <span className="font-semibold">Even</span>
              <span className="text-sm font-medium">{evenPct.toFixed(1)}%</span>
            </button>
            <button
              type="button"
              onClick={() => handleManualBuy("DIGITODD")}
              disabled={!canTrade}
              className="flex items-center justify-between rounded-md bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-4 transition-colors"
            >
              <span className="font-semibold">Odd</span>
              <span className="text-sm font-medium">{oddPct.toFixed(1)}%</span>
            </button>
          </div>

          <div className="flex flex-col gap-3 bg-card border border-border rounded-xl p-5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {runner.isRunning ? (isAutoMode ? "Auto Trader Running" : "Bulk Run In Progress") : "Session Summary"}
            </span>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex flex-col">
                <span className="text-muted-foreground text-xs">Trades</span>
                <span className="font-semibold text-foreground tabular-nums">
                  {runner.tradesCompleted} / {bulkCount}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground text-xs">Win / Loss</span>
                <span className="font-semibold text-foreground tabular-nums">
                  {runner.wins} / {runner.losses}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground text-xs">Loss Streak</span>
                <span className="font-semibold text-foreground tabular-nums">{runner.consecutiveLosses} / 3</span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground text-xs">Net P/L</span>
                <span
                  className={`font-semibold tabular-nums ${
                    runner.totalProfit > 0
                      ? "text-green-600"
                      : runner.totalProfit < 0
                        ? "text-red-600"
                        : "text-foreground"
                  }`}
                >
                  {runner.totalProfit >= 0 ? "+" : ""}
                  {runner.totalProfit.toFixed(2)} {currency || "USD"}
                </span>
              </div>
            </div>
          </div>

          {runner.trades.length > 0 && (
            <div className="flex flex-col gap-1.5 bg-card border border-border rounded-xl p-5 max-h-64 overflow-y-auto">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Recent Trades
              </span>
              {[...runner.trades].reverse().map(t => (
                <div key={t.id} className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0">
                  <span className="text-muted-foreground">{t.direction === "DIGITEVEN" ? "Even" : "Odd"}</span>
                  <span className={t.isWin ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                    {t.profit >= 0 ? "+" : ""}
                    {t.profit.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
