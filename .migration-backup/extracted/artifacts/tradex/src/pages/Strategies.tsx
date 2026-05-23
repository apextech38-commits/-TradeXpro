import { useState, useRef } from "react";
import {
  TrendingUp, CircleDot, CircleOff, ArrowUpRight,
  ArrowLeft, Play, Square, CheckCircle, XCircle
} from "lucide-react";
import { DERIV_APP_ID } from "@/context/AuthContext";

const WS_URL = `wss://ws.binaryws.com/websockets/v3?app_id=${DERIV_APP_ID}`;
const TOKEN_KEY = "deriv_token";

const MARKETS = [
  { label: "Volatility 100 Index",     id: "R_100" },
  { label: "Volatility 75 Index",      id: "R_75"  },
  { label: "Volatility 50 Index",      id: "R_50"  },
  { label: "Volatility 25 Index",      id: "R_25"  },
  { label: "Volatility 10 Index",      id: "R_10"  },
  { label: "Volatility 10 (1s) Index", id: "1HZ10V" },
];

interface TradeResult {
  status: "open" | "won" | "lost" | "error";
  contractId?: string;
  buyPrice?: number;
  profit?: number;
  message?: string;
}

function useTradeRunner() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<TradeResult | null>(null);
  const [statusMsg, setStatusMsg] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  const stop = () => {
    wsRef.current?.close();
    wsRef.current = null;
    setRunning(false);
    setStatusMsg("Stopped");
  };

  const run = (contractType: string, symbol: string, stake: number, duration: number, durationUnit: string, barrier?: string) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setResult({ status: "error", message: "Please log in to place trades." });
      return;
    }

    setRunning(true);
    setResult(null);
    setStatusMsg("Connecting...");

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatusMsg("Authorizing...");
      ws.send(JSON.stringify({ authorize: token }));
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.error) {
          setResult({ status: "error", message: msg.error.message });
          setRunning(false);
          ws.close();
          return;
        }

        if (msg.msg_type === "authorize") {
          setStatusMsg("Placing trade...");
          const params: Record<string, unknown> = {
            amount: stake,
            basis: "stake",
            contract_type: contractType,
            currency: "USD",
            duration,
            duration_unit: durationUnit,
            symbol,
          };
          if (barrier !== undefined) params.barrier = barrier;
          ws.send(JSON.stringify({ buy: 1, subscribe: 1, price: stake, parameters: params }));
          return;
        }

        if (msg.msg_type === "buy") {
          const b = msg.buy;
          setStatusMsg(`Contract ${b.contract_id} — open`);
          setResult({ status: "open", contractId: String(b.contract_id), buyPrice: b.buy_price });
          return;
        }

        if (msg.msg_type === "proposal_open_contract") {
          const c = msg.proposal_open_contract;
          if (c.is_sold) {
            const profit = c.profit ?? 0;
            setResult({
              status: profit >= 0 ? "won" : "lost",
              contractId: String(c.contract_id),
              buyPrice: c.buy_price,
              profit,
            });
            setStatusMsg(profit >= 0 ? `Won +${profit.toFixed(2)}` : `Lost ${profit.toFixed(2)}`);
            setRunning(false);
            ws.close();
          }
        }
      } catch (_) {}
    };

    ws.onerror = () => {
      setResult({ status: "error", message: "WebSocket connection failed." });
      setRunning(false);
    };
  };

  return { running, result, statusMsg, run, stop };
}

/* ─── Strategy Detail Views ──────────────────────────────────────── */

function RunButton({ running, onRun, onStop }: { running: boolean; onRun: () => void; onStop: () => void }) {
  return running ? (
    <button
      onClick={onStop}
      className="flex items-center gap-2 px-6 py-2.5 bg-[#EF4444] hover:bg-red-600 text-white rounded-lg font-semibold transition-colors"
    >
      <Square className="w-4 h-4 fill-current" /> Stop
    </button>
  ) : (
    <button
      onClick={onRun}
      className="flex items-center gap-2 px-6 py-2.5 bg-[#22C55E] hover:bg-[#16a34a] text-white rounded-lg font-semibold transition-colors"
    >
      <Play className="w-4 h-4 fill-current ml-0.5" /> Run Strategy
    </button>
  );
}

function ResultBadge({ result, statusMsg }: { result: TradeResult | null; statusMsg: string }) {
  if (!result && !statusMsg) return null;
  return (
    <div className={`mt-4 rounded-lg px-4 py-3 flex items-center gap-3 border ${
      result?.status === "won"   ? "bg-[#22C55E]/10 border-[#22C55E]/30 text-[#22C55E]" :
      result?.status === "lost"  ? "bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]" :
      result?.status === "error" ? "bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]" :
      "bg-primary/10 border-primary/30 text-primary"
    }`}>
      {result?.status === "won"  && <CheckCircle className="w-5 h-5 shrink-0" />}
      {result?.status === "lost" && <XCircle className="w-5 h-5 shrink-0" />}
      {result?.status === "error" && <XCircle className="w-5 h-5 shrink-0" />}
      <span className="text-sm font-semibold">
        {result?.status === "error" ? result.message :
         result?.status === "won"   ? `Won! Profit: +${result.profit?.toFixed(2)} (Contract #${result.contractId})` :
         result?.status === "lost"  ? `Lost. P&L: ${result.profit?.toFixed(2)} (Contract #${result.contractId})` :
         statusMsg}
      </span>
    </div>
  );
}

function MarketSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-muted-foreground">Market</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-background border border-border rounded-lg h-10 px-3 text-foreground focus:outline-none focus:border-primary"
      >
        {MARKETS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
      </select>
    </div>
  );
}

function NumInput({ label, value, onChange, min = 0.35, step = 0.01 }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; step?: number;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-muted-foreground">{label}</label>
      <input
        type="number" min={min} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full bg-background border border-border rounded-lg h-10 px-3 text-foreground focus:outline-none focus:border-primary"
      />
    </div>
  );
}

function OverUnderDetail() {
  const [market, setMarket]         = useState("R_100");
  const [threshold, setThreshold]   = useState(5);
  const [direction, setDirection]   = useState<"over" | "under">("over");
  const [stake, setStake]           = useState(1);
  const [duration, setDuration]     = useState(1);
  const { running, result, statusMsg, run, stop } = useTradeRunner();

  const doRun = () => run(
    direction === "over" ? "DIGITOVER" : "DIGITUNDER",
    market, stake, duration, "t", String(threshold)
  );

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
        <h3 className="font-semibold text-foreground mb-2">How it works</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Predict whether the last digit of the next tick price will be <strong>over</strong> or <strong>under</strong> your chosen threshold (0–9).
          For example, selecting Over 5 means you win if the last digit is 6, 7, 8, or 9.
          Use the Analysis Tool to check digit distribution before trading.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MarketSelector value={market} onChange={setMarket} />
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">Direction</label>
          <div className="flex gap-2">
            {(["over", "under"] as const).map(d => (
              <button key={d} onClick={() => setDirection(d)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${
                  direction === d ? "bg-primary text-white" : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >{d}</button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">Threshold (0–9)</label>
          <input
            type="range" min={0} max={9} value={threshold}
            onChange={e => setThreshold(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            {[0,1,2,3,4,5,6,7,8,9].map(n => (
              <span key={n} className={threshold === n ? "text-primary font-bold" : ""}>{n}</span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Selected: <strong className="text-foreground">{direction === "over" ? "DIGITOVER" : "DIGITUNDER"} {threshold}</strong>
            {" "}— wins if last digit is {direction === "over" ? `> ${threshold}` : `< ${threshold}`}
          </p>
        </div>
        <NumInput label="Stake (USD)" value={stake} onChange={setStake} />
        <NumInput label="Duration (ticks)" value={duration} onChange={setDuration} min={1} step={1} />
      </div>
      <RunButton running={running} onRun={doRun} onStop={stop} />
      <ResultBadge result={result} statusMsg={statusMsg} />
    </div>
  );
}

function OddDetail() {
  const [market, setMarket]   = useState("R_100");
  const [stake, setStake]     = useState(1);
  const [duration, setDuration] = useState(1);
  const { running, result, statusMsg, run, stop } = useTradeRunner();

  return (
    <div className="space-y-6">
      <div className="bg-pink-50 dark:bg-pink-950/20 border border-pink-200 dark:border-pink-800 rounded-xl p-5">
        <h3 className="font-semibold text-foreground mb-2">How it works</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Predict that the last digit of the next tick will be an <strong>odd number</strong> (1, 3, 5, 7, or 9).
          Over time, odd digits appear ~50% of the time, making this a near-50/50 trade.
          Best used after a streak of even digits (regression to the mean).
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MarketSelector value={market} onChange={setMarket} />
        <NumInput label="Stake (USD)" value={stake} onChange={setStake} />
        <NumInput label="Duration (ticks)" value={duration} onChange={setDuration} min={1} step={1} />
      </div>
      <RunButton running={running} onRun={() => run("DIGITODD", market, stake, duration, "t")} onStop={stop} />
      <ResultBadge result={result} statusMsg={statusMsg} />
    </div>
  );
}

function EvenDetail() {
  const [market, setMarket]   = useState("R_100");
  const [stake, setStake]     = useState(1);
  const [duration, setDuration] = useState(1);
  const { running, result, statusMsg, run, stop } = useTradeRunner();

  return (
    <div className="space-y-6">
      <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-xl p-5">
        <h3 className="font-semibold text-foreground mb-2">How it works</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Predict that the last digit of the next tick will be an <strong>even number</strong> (0, 2, 4, 6, or 8).
          Even digits also appear roughly 50% of the time. Check the Analysis Tool digit distribution before trading
          to find markets where even is statistically ahead.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MarketSelector value={market} onChange={setMarket} />
        <NumInput label="Stake (USD)" value={stake} onChange={setStake} />
        <NumInput label="Duration (ticks)" value={duration} onChange={setDuration} min={1} step={1} />
      </div>
      <RunButton running={running} onRun={() => run("DIGITEVEN", market, stake, duration, "t")} onStop={stop} />
      <ResultBadge result={result} statusMsg={statusMsg} />
    </div>
  );
}

function HitRunDetail() {
  const [market, setMarket]     = useState("R_100");
  const [stake, setStake]       = useState(1);
  const [direction, setDir]     = useState<"rise" | "fall">("rise");
  const [takeProfit, setTP]     = useState(5);
  const [stopLoss, setSL]       = useState(10);
  const [duration, setDuration] = useState(5);
  const { running, result, statusMsg, run, stop } = useTradeRunner();

  return (
    <div className="space-y-6">
      <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-5">
        <h3 className="font-semibold text-foreground mb-2">How it works</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          A rapid Rise/Fall strategy designed to capitalize on short-term momentum.
          Set a tight Take Profit and Stop Loss, choose Rise or Fall based on the current
          tick direction, and execute quickly. Best on high-volatility markets like V100.
          Works as a single rapid contract with a short duration.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MarketSelector value={market} onChange={setMarket} />
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">Direction</label>
          <div className="flex gap-2">
            {(["rise", "fall"] as const).map(d => (
              <button key={d} onClick={() => setDir(d)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${
                  direction === d
                    ? d === "rise" ? "bg-[#22C55E] text-white" : "bg-[#EF4444] text-white"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >{d === "rise" ? "▲ Rise" : "▼ Fall"}</button>
            ))}
          </div>
        </div>
        <NumInput label="Stake (USD)" value={stake} onChange={setStake} />
        <NumInput label="Duration (ticks)" value={duration} onChange={setDuration} min={1} step={1} />
        <NumInput label="Take Profit (USD)" value={takeProfit} onChange={setTP} min={0.01} />
        <NumInput label="Stop Loss (USD)" value={stopLoss} onChange={setSL} min={0.01} />
      </div>
      <RunButton
        running={running}
        onRun={() => run(direction === "rise" ? "CALL" : "PUT", market, stake, duration, "t")}
        onStop={stop}
      />
      <ResultBadge result={result} statusMsg={statusMsg} />
    </div>
  );
}

/* ─── Strategy Config ───────────────────────────────────────────── */

const STRATEGIES = [
  {
    id: "over-under",
    title: "Over / Under",
    icon: TrendingUp,
    iconColor: "text-primary",
    iconBg: "bg-primary/10 border-primary/20",
    description: "Predict whether the last digit of the next tick will be over or under the threshold.",
    Detail: OverUnderDetail,
  },
  {
    id: "odd",
    title: "Odd",
    icon: CircleOff,
    iconColor: "text-pink-500",
    iconBg: "bg-pink-500/10 border-pink-500/20",
    description: "Predict that the last digit of the next tick will be an odd number.",
    Detail: OddDetail,
  },
  {
    id: "even",
    title: "Even",
    icon: CircleDot,
    iconColor: "text-[#22C55E]",
    iconBg: "bg-[#22C55E]/10 border-[#22C55E]/20",
    description: "Predict that the last digit of the next tick will be an even number.",
    Detail: EvenDetail,
  },
  {
    id: "hit-and-run",
    title: "Hit and Run",
    icon: ArrowUpRight,
    iconColor: "text-[#EF4444]",
    iconBg: "bg-[#EF4444]/10 border-[#EF4444]/20",
    description: "A dynamic strategy that capitalizes on short-term momentum using rapid Rise/Fall contracts.",
    Detail: HitRunDetail,
  },
];

/* ─── Page ──────────────────────────────────────────────────────── */

export default function Strategies() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = STRATEGIES.find(s => s.id === activeId);

  if (active) {
    const { Detail } = active;
    return (
      <div className="flex-1 p-4 md:p-8 max-w-3xl mx-auto w-full">
        {/* Back */}
        <button
          onClick={() => setActiveId(null)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back to Strategies</span>
        </button>

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className={`w-14 h-14 rounded-full border flex items-center justify-center shrink-0 ${active.iconBg} ${active.iconColor}`}>
            <active.icon className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{active.title} Strategy</h1>
            <p className="text-muted-foreground text-sm">{active.description}</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <Detail />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Advanced Trading Strategies</h1>
        <p className="text-muted-foreground">Select a trading strategy to view detailed execution guidelines.</p>
      </div>

      <div className="space-y-4">
        {STRATEGIES.map(strategy => (
          <div
            key={strategy.id}
            data-testid={`card-strategy-${strategy.id}`}
            onClick={() => setActiveId(strategy.id)}
            className="bg-card border border-border rounded-xl p-6 flex flex-col md:flex-row md:items-center gap-6 hover:border-primary/40 transition-colors group shadow-sm cursor-pointer"
          >
            <div className={`w-16 h-16 rounded-full border flex items-center justify-center shrink-0 ${strategy.iconBg} ${strategy.iconColor}`}>
              <strategy.icon className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-foreground mb-2">{strategy.title}</h2>
              <p className="text-muted-foreground">{strategy.description}</p>
            </div>
            <button className="text-primary font-semibold hover:text-primary/80 transition-colors flex items-center gap-1 shrink-0 pointer-events-none">
              Explore Strategy <span className="text-lg group-hover:translate-x-1 transition-transform inline-block">→</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
