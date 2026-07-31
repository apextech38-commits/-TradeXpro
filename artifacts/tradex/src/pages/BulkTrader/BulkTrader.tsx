import { useMemo, useState } from "react";
import { Layers3, Settings2, StopCircle, Cpu, Loader2, RotateCcw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useDigitStats } from "@/hooks/useDigitStats";
import { useBulkTrading, TDigitDirection } from "@/hooks/useBulkTrading";
import { useMarketScanner, MarketScanResult } from "./useMarketScanner";
import AiMarketScannerModal from "./AiMarketScannerModal";
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

const DIRECTION_LABELS: Record<TDigitDirection, string> = {
  DIGITEVEN: "Even",
  DIGITODD: "Odd",
  DIGITOVER: "Over",
  DIGITUNDER: "Under",
  DIGITMATCH: "Matches",
  DIGITDIFF: "Differs",
};

type TradeTypeGroup = "evenodd" | "overunder" | "matchdiffer";

const TRADE_TYPE_OPTIONS: { value: TradeTypeGroup; label: string }[] = [
  { value: "evenodd", label: "Even/Odd" },
  { value: "overunder", label: "Over/Under" },
  { value: "matchdiffer", label: "Matches/Differs" },
];

export default function BulkTrader() {
  const { isLoggedIn, currency } = useAuth();

  const [symbol, setSymbol] = useState("R_100");
  const [tradeType, setTradeType] = useState<TradeTypeGroup>("evenodd");
  const [barrierDigit, setBarrierDigit] = useState(5);
  const [lookbackInput, setLookbackInput] = useState("120");
  const [ticksInput, setTicksInput] = useState("1");
  const [stakeInput, setStakeInput] = useState("0.5");
  const [bulkCountInput, setBulkCountInput] = useState("1");

  const [isAutoPanelOpen, setIsAutoPanelOpen] = useState(false);
  const [profitTargetInput, setProfitTargetInput] = useState("");
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const scanner = useMarketScanner();

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

  const overPct = useMemo(
    () => digitStats.filter(d => d.digit > barrierDigit).reduce((sum, d) => sum + d.percentage, 0),
    [digitStats, barrierDigit]
  );
  const underPct = useMemo(
    () => digitStats.filter(d => d.digit < barrierDigit).reduce((sum, d) => sum + d.percentage, 0),
    [digitStats, barrierDigit]
  );

  const matchPct = useMemo(
    () => digitStats.find(d => d.digit === barrierDigit)?.percentage ?? 0,
    [digitStats, barrierDigit]
  );
  const differPct = 100 - matchPct;

  const highestDigit = useMemo(
    () => digitStats.reduce((best, d) => (d.percentage > best.percentage ? d : best), digitStats[0]),
    [digitStats]
  );
  const lowestDigit = useMemo(
    () => digitStats.reduce((worst, d) => (d.percentage < worst.percentage ? d : worst), digitStats[0]),
    [digitStats]
  );

  // The two tradeable sides for whichever trade type is currently selected --
  // drives the buy buttons, Auto Trader's direction pick, and the barrier
  // requirement, all from one place instead of three separate switches.
  const sides = useMemo(() => {
    switch (tradeType) {
      case "overunder":
        return [
          { direction: "DIGITOVER" as TDigitDirection, label: "Over", pct: overPct, color: "teal" as const },
          { direction: "DIGITUNDER" as TDigitDirection, label: "Under", pct: underPct, color: "red" as const },
        ];
      case "matchdiffer":
        return [
          { direction: "DIGITMATCH" as TDigitDirection, label: "Matches", pct: matchPct, color: "teal" as const },
          { direction: "DIGITDIFF" as TDigitDirection, label: "Differs", pct: differPct, color: "red" as const },
        ];
      case "evenodd":
      default:
        return [
          { direction: "DIGITEVEN" as TDigitDirection, label: "Even", pct: evenPct, color: "teal" as const },
          { direction: "DIGITODD" as TDigitDirection, label: "Odd", pct: oddPct, color: "red" as const },
        ];
    }
  }, [tradeType, evenPct, oddPct, overPct, underPct, matchPct, differPct]);

  const needsBarrier = tradeType !== "evenodd";

  const getAutoDirection = (): TDigitDirection =>
    sides[0].pct >= sides[1].pct ? sides[0].direction : sides[1].direction;

  const runner = useBulkTrading({
    symbol,
    currency: currency || "USD",
    stake,
    ticksDuration,
    bulkCount,
    barrier: needsBarrier ? barrierDigit : undefined,
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

  const handleScan = () => {
    scanner.scan(MARKETS.map(m => ({ symbol: m.symbol, name: m.label })), lookback);
  };

  const handleApplyScanResult = (result: MarketScanResult) => {
    setSymbol(result.symbol);
    setIsScannerOpen(false);
  };

  return (
    <div className="flex flex-col w-full h-full p-4 md:p-6 gap-5">
      <div className="flex items-center gap-2">
        <Layers3 className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold text-foreground">Bulk Trader</h1>
      </div>

      <div className="flex flex-col gap-5 bg-card border border-border rounded-xl p-5 max-w-3xl w-full mx-auto">
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
              onChange={e => setTradeType(e.target.value as TradeTypeGroup)}
              disabled={runner.isRunning}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground disabled:opacity-50"
            >
              {TRADE_TYPE_OPTIONS.map(t => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {needsBarrier && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {tradeType === "matchdiffer" ? "Target Digit" : "Barrier Digit"} &mdash; tap a digit below or pick here
            </label>
            <select
              value={barrierDigit}
              onChange={e => setBarrierDigit(Number(e.target.value))}
              disabled={runner.isRunning}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground disabled:opacity-50 w-24"
            >
              {Array.from({ length: 10 }, (_, d) => d).map(d => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        )}

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

        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="flex-1 w-full flex items-center justify-between rounded-md bg-muted/40 px-4 py-3">
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

          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="w-full md:w-auto flex items-center justify-center gap-2 h-[3.25rem] px-4 rounded-md border border-primary/40 bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/15 transition-colors"
          >
            <Cpu className="w-4 h-4" />
            AI Scanner
          </button>
        </div>

        <div className="flex flex-wrap justify-center gap-x-3 gap-y-4 py-2">
          {digitStats.map(d => (
            <DigitWheel
              key={d.digit}
              digit={d.digit}
              percentage={d.percentage}
              isLastDigit={lastDigit === d.digit}
              isHighest={!needsBarrier && d.digit === highestDigit?.digit}
              isLowest={!needsBarrier && d.digit === lowestDigit?.digit}
              isBarrier={needsBarrier && d.digit === barrierDigit}
              showEvenOddBadge={tradeType === "evenodd"}
              onClick={needsBarrier && !runner.isRunning ? () => setBarrierDigit(d.digit) : undefined}
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
              ({sides[0].label}/{sides[1].label}) has better odds as stats update, and you can stop it manually at
              any time.
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

        <div className="flex flex-col sm:flex-row gap-3">
          {sides.map(side => (
            <button
              key={side.direction}
              type="button"
              onClick={() => handleManualBuy(side.direction)}
              disabled={!canTrade}
              className={`flex-1 flex items-center justify-between rounded-md ${
                side.color === "teal" ? "bg-teal-600 hover:bg-teal-700" : "bg-red-600 hover:bg-red-700"
              } disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-4 transition-colors`}
            >
              <span className="font-semibold">{side.label}</span>
              {runner.isRunning && runner.isAwaitingResult ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <span className="text-sm font-medium">{side.pct.toFixed(1)}%</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 rounded-md border border-border bg-muted/20 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {runner.isRunning ? (isAutoMode ? "Auto Trader Running" : "Bulk Run In Progress") : "Last Run"}
            </span>
            {runner.isRunning && runner.isAwaitingResult && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Waiting for result&hellip;
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
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

        <div className="flex flex-col gap-3 rounded-md border border-border bg-muted/20 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Session Summary
            </span>
            <button
              type="button"
              onClick={runner.resetSession}
              disabled={runner.isRunning}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="flex flex-col">
              <span className="text-muted-foreground text-xs">Trades</span>
              <span className="font-semibold text-foreground tabular-nums">{runner.sessionTradesCompleted}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-muted-foreground text-xs">Win / Loss</span>
              <span className="font-semibold text-foreground tabular-nums">
                {runner.sessionWins} / {runner.sessionLosses}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-muted-foreground text-xs">Win Rate</span>
              <span className="font-semibold text-foreground tabular-nums">
                {runner.sessionTradesCompleted > 0
                  ? `${((runner.sessionWins / runner.sessionTradesCompleted) * 100).toFixed(1)}%`
                  : "—"}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-muted-foreground text-xs">Net P/L</span>
              <span
                className={`font-semibold tabular-nums ${
                  runner.sessionTotalProfit > 0
                    ? "text-green-600"
                    : runner.sessionTotalProfit < 0
                      ? "text-red-600"
                      : "text-foreground"
                }`}
              >
                {runner.sessionTotalProfit >= 0 ? "+" : ""}
                {runner.sessionTotalProfit.toFixed(2)} {currency || "USD"}
              </span>
            </div>
          </div>
        </div>

        {runner.trades.length > 0 && (
          <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Recent Trades
            </span>
            {[...runner.trades].reverse().map(t => (
              <div
                key={t.id}
                className="flex items-center justify-between text-xs py-1.5 px-3 rounded-md bg-muted/20"
              >
                <span className="text-muted-foreground">{DIRECTION_LABELS[t.direction]}</span>
                <span className={t.isWin ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                  {t.profit >= 0 ? "+" : ""}
                  {t.profit.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {isScannerOpen && (
        <AiMarketScannerModal
          scanner={scanner}
          onClose={() => setIsScannerOpen(false)}
          onScan={handleScan}
          onApply={handleApplyScanResult}
        />
      )}
    </div>
  );
}
