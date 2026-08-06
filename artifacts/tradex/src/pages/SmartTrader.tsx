import { useMemo, useState } from "react";
import {
  Brain, Target, Bot, Crosshair, ShieldCheck, Flag, LineChart as LineChartIcon,
  Users, BookOpen, ChevronLeft, AlertTriangle, CheckCircle2, Construction,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

// ── Section registry ─────────────────────────────────────────────────────────
// Only "risk-manager" is fully wired to real data below. Everything else is a
// real page shell with an honest "in development" state -- no fabricated
// numbers, confidence scores, or backtest results. Each placeholder says what
// real data source it will eventually run on, so it's clear this isn't meant
// to stay a stub.
type SectionId =
  | "one-click" | "autopilot" | "sniper" | "risk-manager"
  | "goal-mode" | "strategies" | "smart-copy" | "auto-exit";

interface SectionDef {
  id: SectionId;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  tagline: string;
  ready: boolean;
}

const SECTIONS: SectionDef[] = [
  { id: "one-click",     label: "Smart One-Click Trade", Icon: Target,        tagline: "Scans the market and prepares a complete trade for your review.", ready: false },
  { id: "autopilot",     label: "AutoPilot",             Icon: Bot,           tagline: "Trades automatically within rules and stop conditions you set.",   ready: false },
  { id: "sniper",        label: "Smart Sniper",          Icon: Crosshair,     tagline: "Watches the market for high-probability setups so you don't have to.", ready: false },
  { id: "risk-manager",  label: "Risk Manager",          Icon: ShieldCheck,   tagline: "Checks your stake against your balance before you trade.",        ready: true },
  { id: "goal-mode",     label: "Goal Mode",             Icon: Flag,          tagline: "Set a daily target and a loss limit, and trade within them.",     ready: false },
  { id: "strategies",    label: "Strategy Marketplace",  Icon: LineChartIcon, tagline: "Built-in approaches with honest, disclaimed backtest summaries.", ready: false },
  { id: "smart-copy",    label: "Smart Copy",            Icon: Users,         tagline: "Copy only the trades that pass filters you define.",             ready: false },
  { id: "auto-exit",     label: "Auto Exit Manager",     Icon: BookOpen,      tagline: "Monitors an open trade and flags exit conditions you set.",      ready: false },
];

export default function SmartTrader() {
  const [active, setActive] = useState<SectionId | null>(null);
  const activeSection = SECTIONS.find(s => s.id === active) ?? null;

  return (
    <div className="w-full h-full overflow-y-auto bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {activeSection ? (
          <SectionView section={activeSection} onBack={() => setActive(null)} />
        ) : (
          <DashboardView onSelect={setActive} />
        )}
      </div>
    </div>
  );
}

// ── Dashboard shell ───────────────────────────────────────────────────────────
function DashboardView({ onSelect }: { onSelect: (id: SectionId) => void }) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="w-7 h-7 text-primary" />
          Smart Trader
        </h1>
        <p className="text-muted-foreground mt-1">
          Your AI-powered trading assistant that scans, analyzes, executes, protects, and improves every trade.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {SECTIONS.map(({ id, label, Icon, tagline, ready }) => (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className="text-left rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-sm transition-all p-4 flex items-start gap-3"
          >
            <div className="rounded-lg bg-primary/10 p-2 shrink-0">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{label}</span>
                {!ready && (
                  <span className="text-[10px] uppercase tracking-wide bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                    In development
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{tagline}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Section router ────────────────────────────────────────────────────────────
function SectionView({ section, onBack }: { section: SectionDef; onBack: () => void }) {
  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ChevronLeft className="w-4 h-4" />
        Smart Trader
      </button>

      {section.id === "risk-manager" ? (
        <RiskManagerSection />
      ) : (
        <ComingSoonSection section={section} />
      )}
    </div>
  );
}

// ── Honest placeholder for the seven not-yet-built sections ─────────────────
function ComingSoonSection({ section }: { section: SectionDef }) {
  const { Icon, label, tagline } = section;

  const dataSourceNote: Record<SectionId, string> = {
    "one-click": "Will run on the same live tick stream and digit-stats engine already powering Bulk Trader's AI Scanner -- no fabricated confidence scores.",
    "autopilot": "Will execute against real user-defined rules and stop conditions only -- always opt-in, never on by default.",
    "sniper": "Will reuse the Bulk Trader market scanner's real skew calculations, not simulated alerts.",
    "risk-manager": "",
    "goal-mode": "Will track real trade history against a daily target/loss limit you set -- no gamified pressure tactics.",
    "strategies": "Each strategy will ship with an honest, disclaimed backtest summary -- past performance won't be presented as predictive.",
    "smart-copy": "Will filter against real trader statistics once a copy-trading data source is wired up.",
    "auto-exit": "Will monitor open positions against real stop-loss/take-profit/volatility rules you configure.",
  };

  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center">
      <div className="mx-auto rounded-full bg-muted p-3 w-fit mb-3">
        <Icon className="w-6 h-6 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold">{label}</h2>
      <p className="text-muted-foreground mt-1">{tagline}</p>
      <div className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground bg-muted rounded-lg px-3 py-2">
        <Construction className="w-4 h-4 shrink-0" />
        <span>In development. {dataSourceNote[section.id]}</span>
      </div>
    </div>
  );
}

// ── Smart Risk Manager: fully real, no placeholders ──────────────────────────
// Uses the actual live balance from AuthContext (the same balance shown in
// the header) rather than any separate/cached source, so it can't drift out
// of sync with what the user actually has.
const RECOMMENDED_MAX_RISK_PCT = 2; // conservative default: 2% of balance per trade

function RiskManagerSection() {
  const { balance, currency, isLoggedIn } = useAuth();
  const [stakeInput, setStakeInput] = useState("");

  const stake = Number(stakeInput);
  const hasValidStake = stakeInput.trim() !== "" && Number.isFinite(stake) && stake > 0;
  const recommendedStake = useMemo(() => {
    if (balance == null) return null;
    return Math.max(0, (balance * RECOMMENDED_MAX_RISK_PCT) / 100);
  }, [balance]);

  const riskPct = hasValidStake && balance ? (stake / balance) * 100 : null;

  let riskLevel: "LOW" | "MEDIUM" | "HIGH" | null = null;
  if (riskPct != null) {
    if (riskPct <= RECOMMENDED_MAX_RISK_PCT) riskLevel = "LOW";
    else if (riskPct <= RECOMMENDED_MAX_RISK_PCT * 5) riskLevel = "MEDIUM";
    else riskLevel = "HIGH";
  }

  const riskColor = {
    LOW: "text-green-600 bg-green-50 border-green-200",
    MEDIUM: "text-amber-600 bg-amber-50 border-amber-200",
    HIGH: "text-red-600 bg-red-50 border-red-200",
  } as const;

  if (!isLoggedIn) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
        Log in to check a stake against your real balance.
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Smart Risk Manager</h2>
      </div>

      <div className="flex justify-between text-sm mb-4">
        <span className="text-muted-foreground">Balance</span>
        <span className="font-semibold">
          {balance != null ? `${currency} ${balance.toFixed(2)}` : "—"}
        </span>
      </div>

      <label className="block text-sm text-muted-foreground mb-1">Your stake</label>
      <input
        type="number"
        min="0"
        step="0.01"
        value={stakeInput}
        onChange={e => setStakeInput(e.target.value)}
        placeholder="0.00"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-primary/40"
      />

      {recommendedStake != null && (
        <div className="flex justify-between text-sm mb-1">
          <span className="text-muted-foreground">Recommended stake (≤{RECOMMENDED_MAX_RISK_PCT}% of balance)</span>
          <span className="font-medium">{currency} {recommendedStake.toFixed(2)}</span>
        </div>
      )}

      {hasValidStake && riskPct != null && riskLevel && (
        <div className={`mt-3 rounded-lg border px-3 py-3 ${riskColor[riskLevel]}`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Risk level</span>
            <span className="font-bold flex items-center gap-1">
              {riskLevel === "LOW" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              {riskLevel}
            </span>
          </div>
          <div className="text-sm mt-1">
            {riskPct.toFixed(1)}% of your balance
            {balance != null && stake > balance && " -- exceeds your available balance"}
          </div>
        </div>
      )}

      {hasValidStake && balance != null && stake > balance && (
        <p className="text-xs text-red-600 mt-2">
          This stake is larger than your current balance. It would be rejected at purchase time regardless of this check.
        </p>
      )}

      <p className="text-xs text-muted-foreground mt-4">
        This is a simple percentage-of-balance guideline, not a guarantee against loss. It doesn't account for your personal risk tolerance or trading plan.
      </p>
    </div>
  );
}
