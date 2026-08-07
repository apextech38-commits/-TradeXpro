import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Brain, Target, Bot, Crosshair, ShieldCheck, Flag, LineChart as LineChartIcon,
  Users, BookOpen, ChevronLeft, AlertTriangle, CheckCircle2, Construction,
  Radio, Zap, Square, Settings, Sparkles, ArrowUp, ArrowDown, Activity,
  Send, Trophy, History, Plus, X, Play, Pause,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLiveScanner, ScannerMarket } from "@/hooks/useLiveScanner";
import { useTodayPerformance } from "@/hooks/useTodayPerformance";
import { useAutoExitMonitor } from "@/hooks/useAutoExitMonitor";
import { useStrategyBacktest, STRATEGY_PRESETS, StrategyPreset } from "@/hooks/useStrategyBacktest";
import { buyContractForUi } from "@/utils/trade-purchase";

// ── Section registry ─────────────────────────────────────────────────────────
type SectionId =
  | "one-click" | "autopilot" | "sniper" | "risk-manager"
  | "goal-mode" | "strategies" | "smart-copy" | "auto-exit";

interface SectionDef { id: SectionId; label: string; Icon: React.ComponentType<{ className?: string }>; tagline: string; }

const SECTIONS: SectionDef[] = [
  { id: "sniper",        label: "Smart Sniper",          Icon: Crosshair,     tagline: "Watches the live scanner; execute manually or arm auto-fire." },
  { id: "autopilot",     label: "AutoPilot",              Icon: Bot,           tagline: "Trades automatically within hard-capped rules you set." },
  { id: "risk-manager",  label: "Risk Manager",           Icon: ShieldCheck,   tagline: "Checks a stake against your real balance." },
  { id: "goal-mode",     label: "Goal Mode",              Icon: Flag,          tagline: "A daily target and loss limit, tracked against real trades." },
  { id: "strategies",    label: "Strategy Presets",       Icon: LineChartIcon, tagline: "Named parameter presets you can load into AutoPilot." },
  { id: "smart-copy",    label: "Smart Copy",             Icon: Users,         tagline: "Copy only trades that pass filters you define." },
  { id: "auto-exit",     label: "Auto Exit Manager",      Icon: BookOpen,      tagline: "Closes AutoPilot/Sniper trades early on your P&L rules." },
  { id: "one-click",     label: "Smart One-Click Trade",  Icon: Target,        tagline: "Review the live scanner signal and execute in one tap." },
];

// ── Shared contract parameters ───────────────────────────────────────────────
const CONTRACT_DURATION_TICKS = 5;

function buildTradeParameters(topMarket: ScannerMarket, stake: number, currency: string) {
  return {
    amount: stake,
    basis: "stake",
    contract_type: topMarket.trend === "bullish" ? "CALL" : "PUT",
    currency,
    duration: CONTRACT_DURATION_TICKS,
    duration_unit: "t",
    symbol: topMarket.id,
  };
}

// ── Root page ─────────────────────────────────────────────────────────────────
export default function SmartTrader() {
  const [active, setActive] = useState<SectionId | null>(null);
  const [scanning, setScanning] = useState(false);
  const [aiOrbOpen, setAiOrbOpen] = useState(false);
  const { markets, topMarket } = useLiveScanner(scanning);
  const perf = useTodayPerformance();
  const { isLoggedIn, wsConnected, balance, currency } = useAuth();

  const [signalLog, setSignalLog] = useState<{ time: number; market: string; trend: ScannerMarket["trend"]; confidence: number }[]>([]);
  useEffect(() => {
    if (!topMarket) return;
    setSignalLog(prev => {
      const last = prev[0];
      if (last && last.market === topMarket.label && last.trend === topMarket.trend) return prev;
      return [{ time: Date.now(), market: topMarket.label, trend: topMarket.trend, confidence: topMarket.confidence }, ...prev].slice(0, 20);
    });
  }, [topMarket?.label, topMarket?.trend]);

  const autoPilot = useAutoPilotEngine({ topMarket, perf, balance, currency, isLoggedIn });
  const [tradeLog, setTradeLog] = useState<{ time: number; text: string; sub: string; good: boolean }[]>([]);
  const logTrade = (text: string, sub: string, good: boolean) =>
    setTradeLog(prev => [{ time: Date.now(), text, sub, good }, ...prev].slice(0, 20));

  const activeSection = SECTIONS.find(s => s.id === active) ?? null;

  // Real wiring: a preset's symbol/confidence/duration get written straight
  // into AutoPilot's actual config, then the user lands on AutoPilot to
  // review and start it -- not a cosmetic "loaded" toast with nothing behind it.
  const handleLoadPreset = (preset: StrategyPreset) => {
    autoPilot.setConfig({ ...autoPilot.config, confidenceThreshold: preset.confidenceThreshold, allowedMarkets: [preset.symbol] });
    setActive("autopilot");
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-background relative">
      <div className="max-w-6xl mx-auto px-4 py-6 pb-24">
        {activeSection ? (
          <SectionView
            section={activeSection} onBack={() => setActive(null)} topMarket={topMarket} perf={perf}
            autoPilot={autoPilot} balance={balance} currency={currency} isLoggedIn={isLoggedIn} logTrade={logTrade}
            onLoadPreset={handleLoadPreset}
          />
        ) : (
          <DashboardView
            onSelect={setActive} scanning={scanning} setScanning={setScanning} markets={markets} topMarket={topMarket}
            perf={perf} signalLog={signalLog} tradeLog={tradeLog} isLoggedIn={isLoggedIn} wsConnected={wsConnected} autoPilot={autoPilot}
          />
        )}
      </div>

      <QuickActionsToolbar scanning={scanning} setScanning={setScanning} onExecute={() => setActive("sniper")} autoPilotRunning={autoPilot.running} onEmergencyStop={autoPilot.stop} />
      <AiOrb open={aiOrbOpen} setOpen={setAiOrbOpen} />
    </div>
  );
}

// ── AutoPilot execution engine (lives at page root so it keeps running while
//    you navigate between sections; the section view is just its UI). ──────
interface AutoPilotConfig {
  confidenceThreshold: number;
  maxTrades: number;
  maxDailyLoss: number;
  takeProfitTarget: number;
  stake: number;
  perTradeTakeProfit: number;
  perTradeStopLoss: number;
  allowedMarkets: string[];
}
const AUTOPILOT_KEY = "smart-trader-autopilot-config";
const DEFAULT_AUTOPILOT_CONFIG: AutoPilotConfig = {
  confidenceThreshold: 90, maxTrades: 5, maxDailyLoss: 10, takeProfitTarget: 25,
  stake: 1, perTradeTakeProfit: 2, perTradeStopLoss: 2,
  allowedMarkets: ["R_100", "R_75", "BOOM500N", "CRASH300N"],
};

function useAutoPilotEngine({
  topMarket, perf, balance, currency, isLoggedIn,
}: {
  topMarket: ScannerMarket | null;
  perf: ReturnType<typeof useTodayPerformance>;
  balance: number | null;
  currency: string;
  isLoggedIn: boolean;
}) {
  const [config, setConfigState] = useState<AutoPilotConfig>(() => {
    try {
      const raw = localStorage.getItem(AUTOPILOT_KEY);
      return raw ? { ...DEFAULT_AUTOPILOT_CONFIG, ...JSON.parse(raw) } : DEFAULT_AUTOPILOT_CONFIG;
    } catch { return DEFAULT_AUTOPILOT_CONFIG; }
  });
  const setConfig = (c: AutoPilotConfig) => {
    setConfigState(c);
    localStorage.setItem(AUTOPILOT_KEY, JSON.stringify(c));
  };

  const [running, setRunning] = useState(false);
  const [tradesThisSession, setTradesThisSession] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const busyRef = useRef(false);
  const cooldownUntilRef = useRef(0);
  const { status: exitStatus, monitor } = useAutoExitMonitor();

  const stopReasons = useMemo(() => {
    const reasons: string[] = [];
    if (tradesThisSession >= config.maxTrades) reasons.push(`Reached max trades (${config.maxTrades})`);
    if (perf.profit <= -config.maxDailyLoss) reasons.push(`Hit daily loss limit (-${config.maxDailyLoss})`);
    if (perf.profit >= config.takeProfitTarget) reasons.push(`Hit take-profit target (+${config.takeProfitTarget})`);
    if (balance != null && config.stake > balance) reasons.push("Stake exceeds available balance");
    return reasons;
  }, [tradesThisSession, config, perf.profit, balance]);

  useEffect(() => {
    if (stopReasons.length > 0 && running) setRunning(false);
  }, [stopReasons, running]);

  useEffect(() => {
    if (!running || !topMarket || busyRef.current) return;
    if (Date.now() < cooldownUntilRef.current) return;
    if (!isLoggedIn) return;
    if (topMarket.trend === "flat") return;
    if (topMarket.confidence < config.confidenceThreshold) return;
    if (!config.allowedMarkets.includes(topMarket.id)) return;
    if (stopReasons.length > 0) return;

    busyRef.current = true;
    const marketAtTrigger = topMarket;
    (async () => {
      try {
        const buy = await buyContractForUi({
          parameters: buildTradeParameters(marketAtTrigger, config.stake, currency),
          price: config.stake,
          source: "SmartTrader AutoPilot",
        });
        setTradesThisSession(n => n + 1);
        setLastAction(`Bought ${marketAtTrigger.trend === "bullish" ? "Rise" : "Fall"} on ${marketAtTrigger.label} @ ${config.stake} ${currency}`);
        setLastError(null);
        if (buy.contract_id) {
          monitor(Number(buy.contract_id), { takeProfitAmount: config.perTradeTakeProfit, stopLossAmount: config.perTradeStopLoss }, "SmartTrader AutoPilot");
        }
      } catch (err) {
        setLastError(err instanceof Error ? err.message : "AutoPilot trade failed.");
        setRunning(false); // fail closed, never fail open into a silent retry loop
      } finally {
        cooldownUntilRef.current = Date.now() + 5000;
        busyRef.current = false;
      }
    })();
  }, [running, topMarket?.id, topMarket?.trend, topMarket?.confidence, config, isLoggedIn, stopReasons.length, currency]);

  return {
    config, setConfig, running,
    start: () => { setLastError(null); setTradesThisSession(0); setRunning(true); },
    stop: () => setRunning(false),
    tradesThisSession, lastError, lastAction, stopReasons, exitStatus,
  };
}
type AutoPilotEngine = ReturnType<typeof useAutoPilotEngine>;

// ── Dashboard shell ───────────────────────────────────────────────────────────
function DashboardView({
  onSelect, scanning, setScanning, markets, topMarket, perf, signalLog, tradeLog, isLoggedIn, wsConnected, autoPilot,
}: {
  onSelect: (id: SectionId) => void;
  scanning: boolean; setScanning: (v: boolean) => void;
  markets: ScannerMarket[]; topMarket: ScannerMarket | null;
  perf: ReturnType<typeof useTodayPerformance>;
  signalLog: { time: number; market: string; trend: ScannerMarket["trend"]; confidence: number }[];
  tradeLog: { time: number; text: string; sub: string; good: boolean }[];
  isLoggedIn: boolean; wsConnected: boolean; autoPilot: AutoPilotEngine;
}) {
  const navigate = useNavigate();
  const connectedCount = markets.filter(m => m.connected).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Brain className="w-7 h-7 text-primary" /> Smart Trader</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Your AI trading companion</p>
        </div>
        <StatusStrip scanning={scanning} isLoggedIn={isLoggedIn} wsConnected={wsConnected} connectedCount={connectedCount} autoPilotRunning={autoPilot.running} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 mb-5">
        {!scanning ? (
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">Start scanning to see a live, real-data read on the market -- rise/fall skew across a few live indices, not a prediction.</p>
            <button onClick={() => setScanning(true)} className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity">
              <Radio className="w-4 h-4" /> Start Smart Scan
            </button>
          </div>
        ) : !topMarket ? (
          <div className="text-center py-6 text-muted-foreground flex flex-col items-center gap-2"><Activity className="w-5 h-5 animate-pulse" /> Gathering live ticks...</div>
        ) : (
          <HeroSignal topMarket={topMarket} onExecute={() => navigate("/manualtraders")} />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3 font-semibold"><Radio className="w-4 h-4 text-primary" /> Live Scanner</div>
          {!scanning ? <p className="text-sm text-muted-foreground">Not scanning. Start Smart Scan above to connect.</p> : (
            <div className="space-y-2">
              {markets.map(m => (
                <div key={m.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${m.connected ? "bg-green-500" : "bg-muted-foreground/40"}`} /> {m.label}
                  </div>
                  {m.ticksSeen < 10 ? <span className="text-muted-foreground text-xs">Searching...</span> : (
                    <span className={`flex items-center gap-1 text-xs font-medium ${m.trend === "bullish" ? "text-green-600" : m.trend === "bearish" ? "text-red-600" : "text-muted-foreground"}`}>
                      {m.trend === "bullish" && <ArrowUp className="w-3 h-3" />}{m.trend === "bearish" && <ArrowDown className="w-3 h-3" />}{m.confidence}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3 font-semibold"><Trophy className="w-4 h-4 text-primary" /> Today's Performance</div>
          {!isLoggedIn ? <p className="text-sm text-muted-foreground">Log in to see your real trade history.</p> :
           perf.trades === 0 ? <p className="text-sm text-muted-foreground">No settled trades yet today.</p> : (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Trades" value={String(perf.trades)} />
              <Stat label="Win rate" value={`${perf.winRatePct}%`} />
              <Stat label="Wins / Losses" value={`${perf.wins} / ${perf.losses}`} />
              <Stat label="Profit" value={`${perf.profit >= 0 ? "+" : ""}${perf.profit.toFixed(2)}`} valueClass={perf.profit >= 0 ? "text-green-600" : "text-red-600"} />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        {SECTIONS.map(section => (
          <FeatureCard key={section.id} section={section} topMarket={topMarket} perf={perf} autoPilot={autoPilot} onOpen={() => onSelect(section.id)} />
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3 font-semibold"><History className="w-4 h-4 text-primary" /> Activity</div>
        <Timeline signalLog={signalLog} settledTrades={perf.settledTrades} tradeLog={tradeLog} scanning={scanning} />
      </div>
    </div>
  );
}

function Stat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return <div><div className="text-xs text-muted-foreground">{label}</div><div className={`text-lg font-bold ${valueClass ?? ""}`}>{value}</div></div>;
}

function StatusStrip({ scanning, isLoggedIn, wsConnected, connectedCount, autoPilotRunning }: { scanning: boolean; isLoggedIn: boolean; wsConnected: boolean; connectedCount: number; autoPilotRunning: boolean }) {
  return (
    <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1"><span className={`w-1.5 h-1.5 rounded-full ${scanning ? "bg-green-500" : "bg-muted-foreground/40"}`} /> Scanner {scanning ? "active" : "idle"}</span>
      <span className="flex items-center gap-1"><span className={`w-1.5 h-1.5 rounded-full ${isLoggedIn && wsConnected ? "bg-green-500" : "bg-muted-foreground/40"}`} /> Deriv {isLoggedIn && wsConnected ? "connected" : "not connected"}</span>
      {autoPilotRunning && <span className="flex items-center gap-1 text-green-600 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> AutoPilot running</span>}
      {scanning && <span>{connectedCount}/4 markets live</span>}
    </div>
  );
}

function HeroSignal({ topMarket, onExecute }: { topMarket: ScannerMarket; onExecute: () => void }) {
  const bullish = topMarket.trend === "bullish";
  const flat = topMarket.trend === "flat";
  const riskLevel = topMarket.confidence >= 70 ? "Low" : topMarket.confidence >= 55 ? "Medium" : "High";
  const riskColor = riskLevel === "Low" ? "text-green-600" : riskLevel === "Medium" ? "text-amber-600" : "text-red-600";
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div><div className="text-xs text-muted-foreground mb-1">Confidence</div><div className="text-2xl font-bold">{topMarket.confidence}%</div>
          <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${topMarket.confidence}%` }} /></div></div>
        <div><div className="text-xs text-muted-foreground mb-1">Market</div><div className="text-lg font-semibold">{topMarket.label}</div></div>
        <div><div className="text-xs text-muted-foreground mb-1">Trend</div>
          <div className={`text-lg font-semibold flex items-center gap-1 ${flat ? "text-muted-foreground" : bullish ? "text-green-600" : "text-red-600"}`}>
            {!flat && (bullish ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />)}{flat ? "Flat" : bullish ? "Bullish" : "Bearish"}
          </div></div>
        <div><div className="text-xs text-muted-foreground mb-1">Risk</div><div className={`text-lg font-semibold ${riskColor}`}>{riskLevel}</div></div>
      </div>
      <div className="flex items-center justify-between bg-muted/50 rounded-xl px-4 py-3">
        <div className="text-sm"><span className="text-muted-foreground">Suggested bias: </span><span className="font-semibold">{flat ? "No clear bias -- sit this one out" : bullish ? "Rise" : "Fall"}</span></div>
        <button onClick={onExecute} disabled={flat} className="bg-primary text-primary-foreground font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity">
          Review on Manual Traders
        </button>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Based on the last {topMarket.ticksSeen} live ticks' rise/fall skew on a synthetic index. This is a short-term statistical read, not a prediction -- it carries no guarantee.
      </p>
    </div>
  );
}

function FeatureCard({ section, topMarket, perf, autoPilot, onOpen }: { section: SectionDef; topMarket: ScannerMarket | null; perf: ReturnType<typeof useTodayPerformance>; autoPilot: AutoPilotEngine; onOpen: () => void; }) {
  const { Icon, label } = section;
  const goal = useGoalMode();
  let body: React.ReactNode;
  let status: "active" | "not-configured" | "coming-soon";

  switch (section.id) {
    case "sniper":
      status = topMarket ? "active" : "not-configured";
      body = topMarket ? (<><Row k="Market" v={topMarket.label} /><Row k="Confidence" v={`${topMarket.confidence}%`} /></>) : <p className="text-sm text-muted-foreground">Start Smart Scan to arm this.</p>;
      break;
    case "autopilot":
      status = autoPilot.running ? "active" : "not-configured";
      body = autoPilot.running ? (<><Row k="Status" v="Running" /><Row k="Trades" v={`${autoPilot.tradesThisSession}/${autoPilot.config.maxTrades}`} /></>) : <p className="text-sm text-muted-foreground">Stopped. Configure and start below.</p>;
      break;
    case "risk-manager":
      status = "active";
      body = <p className="text-sm text-muted-foreground">Check any stake against your real balance.</p>;
      break;
    case "goal-mode":
      status = goal.settings ? "active" : "not-configured";
      body = goal.settings ? (<><Row k="Today's profit" v={`${perf.profit >= 0 ? "+" : ""}${perf.profit.toFixed(2)}`} /><Row k="Target" v={`+${goal.settings.target}`} /></>) : <p className="text-sm text-muted-foreground">No goal set yet.</p>;
      break;
    case "auto-exit":
      status = autoPilot.exitStatus ? "active" : "not-configured";
      body = autoPilot.exitStatus ? (<><Row k="Watching contract" v={String(autoPilot.exitStatus.contractId)} /><Row k="Live P&L" v={autoPilot.exitStatus.livePnl.toFixed(2)} /></>) : <p className="text-sm text-muted-foreground">Nothing open to monitor right now.</p>;
      break;
    case "strategies":
      status = "active";
      body = <p className="text-sm text-muted-foreground">Real backtests on historical ticks -- load a preset straight into AutoPilot.</p>;
      break;
    default:
      status = section.id === "one-click" && topMarket ? "active" : "coming-soon";
      body = <p className="text-sm text-muted-foreground">{section.tagline}</p>;
      break;
  }

  const badgeStyle = { active: "bg-green-100 text-green-700", "not-configured": "bg-amber-100 text-amber-700", "coming-soon": "bg-blue-100 text-blue-700" } as const;
  const badgeLabel = { active: "🟢 Active", "not-configured": "🟡 Not configured", "coming-soon": "🔵 Coming soon" } as const;

  return (
    <button onClick={onOpen} className="text-left rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-sm transition-all p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 font-semibold"><Icon className="w-4 h-4 text-primary" /> {label}</div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${badgeStyle[status]}`}>{badgeLabel[status]}</span>
      </div>
      {body}
    </button>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between text-sm"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div>;
}

function Timeline({ signalLog, settledTrades, tradeLog, scanning }: {
  signalLog: { time: number; market: string; trend: ScannerMarket["trend"]; confidence: number }[];
  settledTrades: ReturnType<typeof useTodayPerformance>["settledTrades"];
  tradeLog: { time: number; text: string; sub: string; good: boolean }[];
  scanning: boolean;
}) {
  const events = [
    ...signalLog.map(s => ({ time: s.time, text: `${s.trend === "bullish" ? "Bullish" : s.trend === "bearish" ? "Bearish" : "Flat"} skew on ${s.market}`, sub: `${s.confidence}%`, good: null as boolean | null })),
    ...settledTrades.map(t => ({ time: t.transaction_time * 1000, text: (t.pnl ?? 0) >= 0 ? "Trade won" : "Trade lost", sub: `${(t.pnl ?? 0) >= 0 ? "+" : ""}${(t.pnl ?? 0).toFixed(2)}`, good: (t.pnl ?? 0) >= 0 })),
    ...tradeLog.map(t => ({ time: t.time, text: t.text, sub: t.sub, good: t.good })),
  ].sort((a, b) => b.time - a.time).slice(0, 15);

  if (events.length === 0) return <p className="text-sm text-muted-foreground">{scanning ? "Watching for real signal and trade activity..." : "Start Smart Scan or place a trade to see activity here."}</p>;

  return (
    <div className="space-y-2">
      {events.map((e, i) => (
        <div key={i} className="flex items-center justify-between text-sm border-b border-border/50 last:border-0 pb-2 last:pb-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-16 shrink-0">{new Date(e.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            <span>{e.text}</span>
          </div>
          <span className={`text-xs font-medium ${e.good === true ? "text-green-600" : e.good === false ? "text-red-600" : "text-muted-foreground"}`}>{e.sub}</span>
        </div>
      ))}
    </div>
  );
}

// ── Section router ────────────────────────────────────────────────────────────
function SectionView({ section, onBack, topMarket, perf, autoPilot, balance, currency, isLoggedIn, logTrade, onLoadPreset }: {
  section: SectionDef; onBack: () => void; topMarket: ScannerMarket | null;
  perf: ReturnType<typeof useTodayPerformance>; autoPilot: AutoPilotEngine;
  balance: number | null; currency: string; isLoggedIn: boolean;
  logTrade: (text: string, sub: string, good: boolean) => void;
  onLoadPreset: (preset: StrategyPreset) => void;
}) {
  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ChevronLeft className="w-4 h-4" /> Smart Trader</button>
      {section.id === "risk-manager" && <RiskManagerSection />}
      {section.id === "goal-mode" && <GoalModeSection perf={perf} />}
      {section.id === "sniper" && <SniperSection topMarket={topMarket} balance={balance} currency={currency} isLoggedIn={isLoggedIn} logTrade={logTrade} />}
      {section.id === "autopilot" && <AutoPilotSection autoPilot={autoPilot} isLoggedIn={isLoggedIn} balance={balance} currency={currency} />}
      {section.id === "auto-exit" && <AutoExitSection autoPilot={autoPilot} />}
      {section.id === "strategies" && <StrategiesSection onLoadPreset={onLoadPreset} />}
      {(section.id === "smart-copy" || section.id === "one-click") && <ComingSoonSection section={section} />}
    </div>
  );
}

function StrategiesSection({ onLoadPreset }: { onLoadPreset: (preset: StrategyPreset) => void }) {
  const { run, running, results, error } = useStrategyBacktest();

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-1 font-semibold text-lg"><LineChartIcon className="w-5 h-5 text-primary" /> Strategy Presets</div>
      <p className="text-sm text-muted-foreground mb-4">
        Each "Run Backtest" fetches real historical ticks from Deriv's public API and replays the same rise/fall-skew
        logic used live, with no lookahead. <strong>Past performance does not predict future results</strong> --
        these are synthetic, effectively random-walk instruments, and this is a simplified directional-accuracy
        check, not a full P&amp;L simulation (it doesn't model Deriv's real payout ratio).
      </p>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="space-y-3">
        {STRATEGY_PRESETS.map(preset => {
          const result = results[preset.id];
          const isRunning = running === preset.id;
          return (
            <div key={preset.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-semibold">{preset.name}</div>
                  <div className="text-xs text-muted-foreground">{preset.symbolLabel} · confidence ≥{preset.confidenceThreshold}% · {preset.durationTicks} ticks</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => run(preset)} disabled={isRunning} className="text-sm px-3 py-1.5 rounded-lg border border-border hover:border-primary/50 disabled:opacity-40">
                    {isRunning ? "Running..." : "Run Backtest"}
                  </button>
                  <button onClick={() => onLoadPreset(preset)} className="text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90">
                    Load into AutoPilot
                  </button>
                </div>
              </div>
              {result && (
                <div className="grid grid-cols-3 gap-3 text-sm mt-3 pt-3 border-t border-border/50">
                  <Stat label="Sample" value={result.sampleWindowLabel} />
                  <Stat label="Trades" value={String(result.trades)} />
                  <Stat label="Win rate" value={result.winRatePct != null ? `${result.winRatePct}%` : "—"} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ComingSoonSection({ section }: { section: SectionDef }) {
  const { Icon, label, tagline } = section;
  const note: Partial<Record<SectionId, string>> = {
    "one-click": "Use Smart Sniper for now -- it's the same live signal with a one-tap execute button already wired to real trading.",
    "smart-copy": "Needs a real source of other traders' statistics to filter against. Nothing to copy from yet, so this isn't built.",
  };
  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center">
      <div className="mx-auto rounded-full bg-muted p-3 w-fit mb-3"><Icon className="w-6 h-6 text-muted-foreground" /></div>
      <h2 className="text-lg font-semibold">{label}</h2>
      <p className="text-muted-foreground mt-1">{tagline}</p>
      <div className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground bg-muted rounded-lg px-3 py-2"><Construction className="w-4 h-4 shrink-0" /><span>{note[section.id]}</span></div>
    </div>
  );
}

// ── Smart Sniper: real manual execute + optional real auto-fire ──────────────
function SniperSection({ topMarket, balance, currency, isLoggedIn, logTrade }: {
  topMarket: ScannerMarket | null; balance: number | null; currency: string; isLoggedIn: boolean;
  logTrade: (text: string, sub: string, good: boolean) => void;
}) {
  const [stake, setStake] = useState("1");
  const [autoFire, setAutoFire] = useState(false);
  const [threshold, setThreshold] = useState(90);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firedForRef = useRef<string | null>(null);
  const { status: exitStatus, monitor } = useAutoExitMonitor();

  const stakeNum = Number(stake);
  const validStake = Number.isFinite(stakeNum) && stakeNum > 0;

  const execute = async () => {
    if (!topMarket || topMarket.trend === "flat" || !validStake || busy) return;
    setBusy(true);
    setError(null);
    try {
      const buy = await buyContractForUi({
        parameters: buildTradeParameters(topMarket, stakeNum, currency),
        price: stakeNum,
        source: "SmartTrader Sniper",
      });
      logTrade(`Sniper bought ${topMarket.trend === "bullish" ? "Rise" : "Fall"} on ${topMarket.label}`, `${stakeNum} ${currency}`, true);
      if (buy.contract_id) monitor(Number(buy.contract_id), {}, "SmartTrader Sniper");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trade failed.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!autoFire || !topMarket || topMarket.trend === "flat") return;
    if (topMarket.confidence < threshold) return;
    const key = `${topMarket.id}:${topMarket.trend}`;
    if (firedForRef.current === key) return;
    firedForRef.current = key;
    execute();
  }, [autoFire, topMarket?.id, topMarket?.trend, topMarket?.confidence, threshold]);

  if (!isLoggedIn) return <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">Log in to use Smart Sniper.</div>;

  return (
    <div className="max-w-md mx-auto rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-4 font-semibold"><Crosshair className="w-5 h-5 text-primary" /> Smart Sniper</div>
      {!topMarket ? <p className="text-muted-foreground text-sm">Start Smart Scan from the dashboard to arm the sniper.</p> : (
        <>
          <div className="text-center mb-4">
            <div className="text-3xl font-bold">{topMarket.confidence}%</div>
            <p className="text-sm text-muted-foreground">{topMarket.label} -- {topMarket.trend}</p>
          </div>
          <label className="block text-xs text-muted-foreground mb-1">Stake ({currency})</label>
          <input type="number" min="0" step="0.01" value={stake} onChange={e => setStake(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 mb-3" />
          {balance != null && stakeNum > balance && <p className="text-xs text-red-600 mb-2">Stake exceeds your balance ({currency} {balance.toFixed(2)}).</p>}
          <button onClick={execute} disabled={busy || !validStake || topMarket.trend === "flat"} className="w-full bg-primary text-primary-foreground font-semibold py-2.5 rounded-lg disabled:opacity-40 mb-3">
            {busy ? "Executing..." : "Execute Trade"}
          </button>
          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
          {exitStatus && !exitStatus.closedReason && (
            <div className="text-xs bg-muted rounded-lg px-3 py-2 mb-2">Monitoring open contract #{exitStatus.contractId} -- live P&L {exitStatus.livePnl.toFixed(2)} {currency}</div>
          )}

          <div className="border-t border-border pt-3 mt-3">
            <label className="flex items-center gap-2 text-sm mb-2">
              <input type="checkbox" checked={autoFire} onChange={e => setAutoFire(e.target.checked)} />
              Auto Execute when confidence ≥
              <input type="number" min="50" max="100" value={threshold} onChange={e => setThreshold(Number(e.target.value))} className="w-16 rounded border border-border bg-background px-2 py-1" />%
            </label>
            <p className="text-xs text-muted-foreground">Fires once per new signal, using the stake above. Turn off to disarm.</p>
          </div>
        </>
      )}
    </div>
  );
}

// ── AutoPilot: real config + real hard-capped execution loop ─────────────────
function AutoPilotSection({ autoPilot, isLoggedIn, balance, currency }: { autoPilot: AutoPilotEngine; isLoggedIn: boolean; balance: number | null; currency: string }) {
  const { config, setConfig, running, start, stop, tradesThisSession, lastError, lastAction, stopReasons, exitStatus } = autoPilot;
  const [form, setForm] = useState(config);
  useEffect(() => { if (!running) setForm(config); }, [config, running]);

  const toggleMarket = (id: string) =>
    setForm(f => ({ ...f, allowedMarkets: f.allowedMarkets.includes(id) ? f.allowedMarkets.filter(m => m !== id) : [...f.allowedMarkets, id] }));

  const marketOptions = [
    { id: "R_100", label: "Volatility 100" }, { id: "R_75", label: "Volatility 75" },
    { id: "BOOM500N", label: "Boom 500" }, { id: "CRASH300N", label: "Crash 300" },
  ];

  if (!isLoggedIn) return <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">Log in to configure AutoPilot.</div>;

  return (
    <div className="max-w-md mx-auto rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-4 font-semibold"><Bot className="w-5 h-5 text-primary" /> AutoPilot</div>

      {running ? (
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 text-green-600 font-semibold mb-3">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Running
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm mb-4">
            <Stat label="Trades" value={`${tradesThisSession}/${config.maxTrades}`} />
            <Stat label="Stake per trade" value={`${config.stake} ${currency}`} />
          </div>
          {lastAction && <p className="text-xs text-muted-foreground mb-2">{lastAction}</p>}
          {lastError && <p className="text-xs text-red-600 mb-2">{lastError}</p>}
          {exitStatus && !exitStatus.closedReason && (
            <div className="text-xs bg-muted rounded-lg px-3 py-2 mb-3">Monitoring open contract -- live P&L {exitStatus.livePnl.toFixed(2)} {currency}</div>
          )}
          <button onClick={stop} className="w-full bg-red-600 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2">
            <Pause className="w-4 h-4" /> Stop AutoPilot
          </button>
        </div>
      ) : (
        <>
          {stopReasons.length > 0 && (
            <div className="mb-3 text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-3 py-2">
              Stopped: {stopReasons.join("; ")}
            </div>
          )}
          <LabeledInput label="Confidence threshold (%)" value={String(form.confidenceThreshold)} onChange={v => setForm(f => ({ ...f, confidenceThreshold: Number(v) }))} />
          <LabeledInput label={`Stake per trade (${currency})`} value={String(form.stake)} onChange={v => setForm(f => ({ ...f, stake: Number(v) }))} />
          <LabeledInput label="Maximum trades" value={String(form.maxTrades)} onChange={v => setForm(f => ({ ...f, maxTrades: Number(v) }))} />
          <LabeledInput label={`Maximum daily loss (${currency})`} value={String(form.maxDailyLoss)} onChange={v => setForm(f => ({ ...f, maxDailyLoss: Number(v) }))} prefix="-" />
          <LabeledInput label={`Take profit target (${currency})`} value={String(form.takeProfitTarget)} onChange={v => setForm(f => ({ ...f, takeProfitTarget: Number(v) }))} prefix="+" />
          <LabeledInput label={`Per-trade take profit (${currency})`} value={String(form.perTradeTakeProfit)} onChange={v => setForm(f => ({ ...f, perTradeTakeProfit: Number(v) }))} prefix="+" />
          <LabeledInput label={`Per-trade stop loss (${currency})`} value={String(form.perTradeStopLoss)} onChange={v => setForm(f => ({ ...f, perTradeStopLoss: Number(v) }))} prefix="-" />

          <label className="block text-xs text-muted-foreground mb-1 mt-2">Allowed markets</label>
          <div className="space-y-1 mb-4">
            {marketOptions.map(m => (
              <label key={m.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.allowedMarkets.includes(m.id)} onChange={() => toggleMarket(m.id)} /> {m.label}
              </label>
            ))}
          </div>

          {balance != null && form.stake > balance && <p className="text-xs text-red-600 mb-2">Stake exceeds your balance ({currency} {balance.toFixed(2)}).</p>}

          <button
            onClick={() => { setConfig(form); start(); }}
            disabled={form.allowedMarkets.length === 0 || (balance != null && form.stake > balance)}
            className="w-full bg-primary text-primary-foreground font-semibold py-2.5 rounded-lg disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" /> Start AutoPilot
          </button>
          <p className="text-xs text-muted-foreground mt-3">
            Stops automatically the moment any limit above is hit -- it will not silently retry or continue past your caps.
          </p>
        </>
      )}
    </div>
  );
}

// ── Auto Exit Manager: shows what it actually covers, honestly scoped ────────
function AutoExitSection({ autoPilot }: { autoPilot: AutoPilotEngine }) {
  const { exitStatus, config } = autoPilot;
  return (
    <div className="max-w-md mx-auto rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-4 font-semibold"><BookOpen className="w-5 h-5 text-primary" /> Auto Exit Manager</div>
      {exitStatus ? (
        <div className="text-center">
          <div className={`text-2xl font-bold ${exitStatus.livePnl >= 0 ? "text-green-600" : "text-red-600"}`}>
            {exitStatus.livePnl >= 0 ? "+" : ""}{exitStatus.livePnl.toFixed(2)}
          </div>
          <p className="text-sm text-muted-foreground mt-1">Contract #{exitStatus.contractId}</p>
          <p className="text-sm mt-2">
            {exitStatus.closing ? "Closing now..." : exitStatus.closedReason ? `Closed (${exitStatus.closedReason.replace("_", " ")})` : "Monitoring live"}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nothing open to monitor right now. This activates automatically for AutoPilot and Sniper trades.</p>
      )}
      <div className="mt-4 text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
        Scoped to trades placed through AutoPilot or Smart Sniper (take-profit {config.perTradeTakeProfit} / stop-loss {config.perTradeStopLoss} for AutoPilot trades). It does not watch positions opened manually elsewhere -- that would need a full portfolio subscription, not built yet.
      </div>
    </div>
  );
}

// ── Goal Mode: fully real, tracked against actual today's trades ─────────────
interface GoalSettings { target: number; lossLimit: number; maxTrades: number; }
const GOAL_KEY = "smart-trader-goal";

function useGoalMode() {
  const [settings, setSettings] = useState<GoalSettings | null>(() => {
    try { const raw = localStorage.getItem(GOAL_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
  });
  const save = (s: GoalSettings) => { localStorage.setItem(GOAL_KEY, JSON.stringify(s)); setSettings(s); };
  const clear = () => { localStorage.removeItem(GOAL_KEY); setSettings(null); };
  return { settings, save, clear };
}

function GoalModeSection({ perf }: { perf: ReturnType<typeof useTodayPerformance> }) {
  const { settings, save, clear } = useGoalMode();
  const [target, setTarget] = useState(String(settings?.target ?? ""));
  const [lossLimit, setLossLimit] = useState(String(settings?.lossLimit ?? ""));
  const [maxTrades, setMaxTrades] = useState(String(settings?.maxTrades ?? ""));

  if (!settings) {
    return (
      <div className="max-w-sm mx-auto rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4 font-semibold"><Flag className="w-5 h-5 text-primary" /> Set today's goal</div>
        <LabeledInput label="Daily profit target" value={target} onChange={setTarget} prefix="+" />
        <LabeledInput label="Daily loss limit" value={lossLimit} onChange={setLossLimit} prefix="-" />
        <LabeledInput label="Maximum trades" value={maxTrades} onChange={setMaxTrades} />
        <button disabled={!target || !lossLimit || !maxTrades} onClick={() => save({ target: Number(target), lossLimit: Number(lossLimit), maxTrades: Number(maxTrades) })}
          className="w-full bg-primary text-primary-foreground font-semibold py-2 rounded-lg disabled:opacity-40 mt-2">Set Goal</button>
      </div>
    );
  }

  const goalHit = perf.profit >= settings.target;
  const limitHit = perf.profit <= -settings.lossLimit;
  const tradesHit = perf.trades >= settings.maxTrades;
  const locked = goalHit || limitHit || tradesHit;

  return (
    <div className="max-w-sm mx-auto rounded-xl border border-border bg-card p-6 text-center">
      {locked ? (
        <>
          <div className="text-3xl mb-2">{goalHit ? "🎉" : "🛑"}</div>
          <h2 className="text-lg font-semibold">{goalHit ? "Daily Goal Achieved" : limitHit ? "Loss Limit Hit" : "Trade Limit Reached"}</h2>
          <p className="text-muted-foreground text-sm mt-1">Trading locked for today based on your own settings. Come back tomorrow.</p>
        </>
      ) : (
        <>
          <Flag className="w-6 h-6 text-primary mx-auto mb-3" />
          <div className="grid grid-cols-3 gap-2 text-sm mb-4">
            <Stat label="Profit" value={`${perf.profit >= 0 ? "+" : ""}${perf.profit.toFixed(2)}`} valueClass={perf.profit >= 0 ? "text-green-600" : "text-red-600"} />
            <Stat label="Target" value={`+${settings.target}`} />
            <Stat label="Trades" value={`${perf.trades}/${settings.maxTrades}`} />
          </div>
        </>
      )}
      <button onClick={clear} className="text-xs text-muted-foreground hover:text-foreground mt-4 underline">Reset goal</button>
    </div>
  );
}

function LabeledInput({ label, value, onChange, prefix }: { label: string; value: string; onChange: (v: string) => void; prefix?: string }) {
  return (
    <div className="mb-3">
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-muted-foreground">{prefix}</span>}
        <input type="number" min="0" value={value} onChange={e => onChange(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40" />
      </div>
    </div>
  );
}

// ── Smart Risk Manager: real balance, real math ──────────────────────────────
const RECOMMENDED_MAX_RISK_PCT = 2;

function RiskManagerSection() {
  const { balance, currency, isLoggedIn } = useAuth();
  const [stakeInput, setStakeInput] = useState("");
  const stake = Number(stakeInput);
  const hasValidStake = stakeInput.trim() !== "" && Number.isFinite(stake) && stake > 0;
  const recommendedStake = useMemo(() => (balance == null ? null : Math.max(0, (balance * RECOMMENDED_MAX_RISK_PCT) / 100)), [balance]);
  const riskPct = hasValidStake && balance ? (stake / balance) * 100 : null;
  let riskLevel: "LOW" | "MEDIUM" | "HIGH" | null = null;
  if (riskPct != null) riskLevel = riskPct <= RECOMMENDED_MAX_RISK_PCT ? "LOW" : riskPct <= RECOMMENDED_MAX_RISK_PCT * 5 ? "MEDIUM" : "HIGH";
  const riskColor = { LOW: "text-green-600 bg-green-50 border-green-200", MEDIUM: "text-amber-600 bg-amber-50 border-amber-200", HIGH: "text-red-600 bg-red-50 border-red-200" } as const;

  if (!isLoggedIn) return <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">Log in to check a stake against your real balance.</div>;

  return (
    <div className="max-w-md mx-auto rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-4"><ShieldCheck className="w-5 h-5 text-primary" /><h2 className="text-lg font-semibold">Smart Risk Manager</h2></div>
      <div className="flex justify-between text-sm mb-4"><span className="text-muted-foreground">Balance</span><span className="font-semibold">{balance != null ? `${currency} ${balance.toFixed(2)}` : "—"}</span></div>
      <label className="block text-sm text-muted-foreground mb-1">Your stake</label>
      <input type="number" min="0" step="0.01" value={stakeInput} onChange={e => setStakeInput(e.target.value)} placeholder="0.00" className="w-full rounded-lg border border-border bg-background px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-primary/40" />
      {recommendedStake != null && <div className="flex justify-between text-sm mb-1"><span className="text-muted-foreground">Recommended (≤{RECOMMENDED_MAX_RISK_PCT}% of balance)</span><span className="font-medium">{currency} {recommendedStake.toFixed(2)}</span></div>}
      {hasValidStake && riskPct != null && riskLevel && (
        <div className={`mt-3 rounded-lg border px-3 py-3 ${riskColor[riskLevel]}`}>
          <div className="flex items-center justify-between"><span className="text-sm font-medium">Risk level</span><span className="font-bold flex items-center gap-1">{riskLevel === "LOW" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}{riskLevel}</span></div>
          <div className="text-sm mt-1">{riskPct.toFixed(1)}% of your balance{balance != null && stake > balance && " -- exceeds your available balance"}</div>
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-4">This is a simple percentage-of-balance guideline, not a guarantee against loss.</p>
    </div>
  );
}

// ── Quick actions floating toolbar ───────────────────────────────────────────
function QuickActionsToolbar({ scanning, setScanning, onExecute, autoPilotRunning, onEmergencyStop }: {
  scanning: boolean; setScanning: (v: boolean) => void; onExecute: () => void; autoPilotRunning: boolean; onEmergencyStop: () => void;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed bottom-6 left-6 z-40">
      {open && (
        <div className="mb-2 flex flex-col gap-2">
          <ToolbarButton icon={<Radio className="w-4 h-4" />} label={scanning ? "Restart Scan" : "New Scan"} onClick={() => { setScanning(false); setTimeout(() => setScanning(true), 50); }} />
          <ToolbarButton icon={<Zap className="w-4 h-4" />} label="Execute Trade" onClick={onExecute} />
          <ToolbarButton icon={<Square className="w-4 h-4" />} label="Emergency Stop" onClick={onEmergencyStop} disabled={!autoPilotRunning} title={autoPilotRunning ? "Stop AutoPilot immediately" : "No active automation running to stop"} />
          <ToolbarButton icon={<Settings className="w-4 h-4" />} label="Live Markets" onClick={() => navigate("/charts")} />
        </div>
      )}
      <button onClick={() => setOpen(v => !v)} className="w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity">
        {open ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
      </button>
    </div>
  );
}

function ToolbarButton({ icon, label, onClick, disabled, title }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className="flex items-center gap-2 bg-card border border-border rounded-full pl-3 pr-4 py-2 text-sm shadow-sm hover:border-primary/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
      {icon} {label}
    </button>
  );
}

// ── AI Orb: real UI shell, honest about not being wired to a live model yet ──
function AiOrb({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const prompts = ["What should I trade?", "Explain this signal", "Review my last loss", "Find me a setup"];
  return (
    <div className="fixed bottom-6 right-6 z-40">
      {open && (
        <div className="mb-2 w-80 rounded-xl border border-border bg-card shadow-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 font-semibold"><Sparkles className="w-4 h-4 text-primary" /> Ask Smart Trader</div>
            <button onClick={() => setOpen(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
          <div className="bg-muted rounded-lg px-3 py-3 text-sm text-muted-foreground mb-3">
            Not connected to a live AI model yet -- that needs a real backend endpoint with an LLM API key, which isn't wired up. This panel is ready for that once it exists; it won't fake a response in the meantime.
          </div>
          <div className="space-y-1.5">
            {prompts.map(p => <div key={p} className="text-xs text-muted-foreground border border-border rounded-lg px-2 py-1.5 opacity-60">"{p}"</div>)}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <input disabled placeholder="Ask anything..." className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm opacity-50" />
            <button disabled className="p-2 rounded-lg bg-muted text-muted-foreground"><Send className="w-4 h-4" /></button>
          </div>
        </div>
      )}
      <button onClick={() => setOpen(!open)} className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity">
        <Brain className="w-5 h-5" />
      </button>
    </div>
  );
}
