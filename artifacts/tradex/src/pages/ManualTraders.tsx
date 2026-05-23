import {
  useState, useEffect, useRef, useCallback, useMemo,
} from "react";
import {
  ChevronDown, Minus, Plus, TrendingUp, TrendingDown,
  RefreshCw, Clock, BarChart2, Info, X, CheckCircle2,
  AlertCircle, Loader2, Activity,
} from "lucide-react";
import AuthGateModal from "@/components/AuthGateModal";
import { useAuth, DERIV_APP_ID } from "@/context/AuthContext";
import {
  createChart, ColorType, AreaSeries, LineStyle,
} from "lightweight-charts";
import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";

const WS_URL = `wss://ws.binaryws.com/websockets/v3?app_id=${DERIV_APP_ID}`;

/* ─── Trade Types ─────────────────────────────────────────────────── */
const TRADE_TYPES = [
  {
    id: "rise_fall",
    label: "Rise/Fall",
    icon: "↕",
    desc: "Predict whether the market will rise or fall at expiry",
    hasSell: true,
    buyLabel: "Rise",
    sellLabel: "Fall",
  },
  {
    id: "higher_lower",
    label: "Higher/Lower",
    icon: "↑↓",
    desc: "Predict whether the market will be higher or lower than a target",
    hasSell: true,
    buyLabel: "Higher",
    sellLabel: "Lower",
  },
  {
    id: "touch",
    label: "Touch/No Touch",
    icon: "⦿",
    desc: "Predict whether the market will touch a target at any point",
    hasSell: true,
    buyLabel: "Touch",
    sellLabel: "No Touch",
  },
  {
    id: "digits",
    label: "Digits",
    icon: "#",
    desc: "Predict the last digit of the final tick",
    hasSell: false,
    buyLabel: "Matches",
    sellLabel: "Differs",
  },
  {
    id: "accumulators",
    label: "Accumulators",
    icon: "∑",
    desc: "Accumulate profit tick-by-tick as long as price stays in range",
    hasSell: false,
    buyLabel: "Buy",
    sellLabel: "",
  },
];

/* ─── Markets ─────────────────────────────────────────────────────── */
const MARKETS = [
  { label: "Volatility 100 Index",    id: "R_100",   pip: 2 },
  { label: "Volatility 100 (1s)",     id: "1HZ100V", pip: 2 },
  { label: "Volatility 75 Index",     id: "R_75",    pip: 4 },
  { label: "Volatility 75 (1s)",      id: "1HZ75V",  pip: 4 },
  { label: "Volatility 50 Index",     id: "R_50",    pip: 4 },
  { label: "Volatility 50 (1s)",      id: "1HZ50V",  pip: 4 },
  { label: "Volatility 25 Index",     id: "R_25",    pip: 4 },
  { label: "Volatility 25 (1s)",      id: "1HZ25V",  pip: 4 },
  { label: "Volatility 10 Index",     id: "R_10",    pip: 3 },
  { label: "Volatility 10 (1s)",      id: "1HZ10V",  pip: 3 },
];

/* ─── Duration Types ──────────────────────────────────────────────── */
const DURATION_TYPES = [
  { id: "t", label: "Ticks",   min: 1,  max: 10,  step: 1  },
  { id: "m", label: "Minutes", min: 1,  max: 1440, step: 1  },
  { id: "h", label: "Hours",   min: 1,  max: 24,  step: 1  },
  { id: "d", label: "Days",    min: 1,  max: 365, step: 1  },
];

/* ─── Live Price Hook ─────────────────────────────────────────────── */
function useLivePrice(symbol: string) {
  const [price, setPrice] = useState<number | null>(null);
  const [prevPrice, setPrev] = useState<number | null>(null);
  const [openPrice, setOpen] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mountRef = useRef(true);

  useEffect(() => {
    mountRef.current = true;
    setPrice(null); setPrev(null); setOpen(null);
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
    };
    ws.onmessage = (e) => {
      if (!mountRef.current) return;
      try {
        const m = JSON.parse(e.data);
        if (m.tick) {
          const q: number = m.tick.quote;
          setPrice(q);
          setPrev(p => p ?? q);
          setOpen(p => p ?? q);
        }
      } catch (_) {}
    };
    return () => {
      mountRef.current = false;
      ws.onclose = null;
      ws.close();
    };
  }, [symbol]);

  const change = useMemo(() => {
    if (price == null || openPrice == null) return { val: "0.00", pct: "0.00", dir: "flat" as const };
    const diff = price - openPrice;
    const pct = (diff / openPrice) * 100;
    return {
      val: Math.abs(diff).toFixed(2),
      pct: Math.abs(pct).toFixed(2),
      dir: diff > 0 ? "up" as const : diff < 0 ? "down" as const : "flat" as const,
    };
  }, [price, openPrice]);

  const dir = price != null && prevPrice != null
    ? price > prevPrice ? "up" : price < prevPrice ? "down" : "flat"
    : "flat";

  return { price, change, dir };
}

/* ─── Lightweight Chart Component (light theme matching screenshot) ── */
function TradingChart({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mountRef = useRef(true);

  useEffect(() => {
    if (!containerRef.current) return;
    mountRef.current = true;
    const el = containerRef.current;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#666666",
        fontSize: 11,
        fontFamily: "'Inter', system-ui, sans-serif",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(0,0,0,0.04)" },
        horzLines: { color: "rgba(0,0,0,0.04)" },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: "rgba(0,0,0,0.2)", width: 1, style: LineStyle.Dashed,
          labelBackgroundColor: "#1a1a1a",
        },
        horzLine: {
          color: "rgba(0,0,0,0.2)", width: 1, style: LineStyle.Dashed,
          labelBackgroundColor: "#1a1a1a",
        },
      },
      rightPriceScale: {
        borderColor: "rgba(0,0,0,0.08)",
        scaleMargins: { top: 0.1, bottom: 0.05 },
      },
      timeScale: {
        borderColor: "rgba(0,0,0,0.08)",
        timeVisible: true,
        secondsVisible: true,
        rightOffset: 5,
        barSpacing: 4,
        fixLeftEdge: false,
        lockVisibleTimeRangeOnResize: true,
      },
      width: el.clientWidth,
      height: el.clientHeight || 260,
    });
    chartRef.current = chart;

    const area = chart.addSeries(AreaSeries, {
      lineColor: "#2962ff",
      topColor: "rgba(41,98,255,0.15)",
      bottomColor: "rgba(41,98,255,0)",
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      crosshairMarkerBackgroundColor: "#2962ff",
      crosshairMarkerBorderColor: "#ffffff",
      crosshairMarkerBorderWidth: 2,
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineColor: "#2962ff",
      priceLineStyle: LineStyle.Dashed,
      priceLineWidth: 1,
    });
    seriesRef.current = area;

    const ro = new ResizeObserver(() => {
      if (!el || !chartRef.current) return;
      chartRef.current.applyOptions({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen = () => {
      if (!mountRef.current) return;
      ws.send(JSON.stringify({
        ticks_history: symbol,
        count: 300,
        end: "latest",
        style: "ticks",
        subscribe: 1,
      }));
    };
    ws.onmessage = (evt) => {
      if (!mountRef.current) return;
      try {
        const msg = JSON.parse(evt.data);
        if (msg.error) return;
        if (msg.msg_type === "history") {
          const { times, prices } = msg.history as { times: number[]; prices: number[] };
          const pts = times.map((t, i) => ({ time: t as UTCTimestamp, value: prices[i] }));
          if (seriesRef.current && pts.length > 0) {
            seriesRef.current.setData(pts);
            chartRef.current?.timeScale().fitContent();
          }
        }
        if (msg.msg_type === "tick") {
          const { epoch, quote } = msg.tick as { epoch: number; quote: number };
          seriesRef.current?.update({ time: epoch as UTCTimestamp, value: quote });
        }
      } catch (_) {}
    };

    return () => {
      mountRef.current = false;
      ro.disconnect();
      ws.onclose = null;
      ws.close();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [symbol]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}

/* ─── Active Contract Card ────────────────────────────────────────── */
interface Contract {
  id: string;
  type: string;
  direction: "buy" | "sell";
  symbol: string;
  stake: number;
  payout: number;
  entryPrice: number;
  currentPrice: number | null;
  profit: number | null;
  status: "open" | "won" | "lost";
  expiresIn: number;
  buyTime: number;
}

function ContractCard({ contract, onClose }: { contract: Contract; onClose: (id: string) => void }) {
  const [timeLeft, setTimeLeft] = useState(contract.expiresIn);

  useEffect(() => {
    if (contract.status !== "open") return;
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(interval); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [contract.status]);

  const isUp = contract.direction === "buy";
  const profit = contract.profit ?? 0;
  const isWon = contract.status === "won";
  const isLost = contract.status === "lost";
  const isDone = isWon || isLost;

  return (
    <div className={`rounded-xl border p-3 transition-all ${
      isDone
        ? isWon
          ? "border-green-200 bg-green-50"
          : "border-red-200 bg-red-50"
        : "border-border bg-card"
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold ${
            isUp ? "bg-[#22C55E]" : "bg-[#EF4444]"
          }`}>
            {isUp ? "↑" : "↓"}
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">
              {contract.type} — {isUp ? contract.direction === "buy" ? "Rise" : "Higher" : contract.direction === "sell" ? "Fall" : "Lower"}
            </div>
            <div className="text-[11px] text-muted-foreground">{contract.symbol}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDone ? (
            isWon
              ? <CheckCircle2 className="w-4 h-4 text-green-500" />
              : <AlertCircle className="w-4 h-4 text-red-500" />
          ) : (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeLeft}s
            </div>
          )}
          <button
            onClick={() => onClose(contract.id)}
            className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-[10px] text-muted-foreground">Stake</div>
          <div className="text-xs font-bold text-foreground">${contract.stake.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground">Payout</div>
          <div className="text-xs font-bold text-foreground">${contract.payout.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground">P&L</div>
          <div className={`text-xs font-bold ${
            isDone
              ? isWon ? "text-green-600" : "text-red-600"
              : "text-muted-foreground"
          }`}>
            {isDone
              ? isWon ? `+$${(contract.payout - contract.stake).toFixed(2)}` : `-$${contract.stake.toFixed(2)}`
              : "Pending"
            }
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────────────── */
export default function ManualTraders() {
  const { isLoggedIn, balance, currency, sendWS, isAuthorized } = useAuth();

  /* State */
  const [market, setMarket] = useState(MARKETS[0]);
  const [mktOpen, setMktOpen] = useState(false);
  const [tradeTypeIdx, setTradeTypeIdx] = useState(0);
  const [tradeTypeOpen, setTradeTypeOpen] = useState(false);
  const [durationTypeIdx, setDurationTypeIdx] = useState(0);
  const [duration, setDuration] = useState(5);
  const [stake, setStake] = useState(10);
  const [stakeInput, setStakeInput] = useState("10");
  const [showAuth, setShowAuth] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [buying, setBuying] = useState<"buy" | "sell" | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);

  const tradeType = TRADE_TYPES[tradeTypeIdx];
  const durType = DURATION_TYPES[durationTypeIdx];
  const { price, change, dir } = useLivePrice(market.id);

  /* Payout calculation (simplified — real uses API proposal) */
  const payoutMultiplier = tradeType.id === "accumulators" ? 0 : 1.85;
  const payout = tradeType.id === "accumulators" ? 0 : stake * payoutMultiplier;
  const profit = payout - stake;

  /* Clamp duration to valid range on type change */
  useEffect(() => {
    setDuration(d => Math.min(Math.max(durType.min, d), durType.max));
  }, [durationTypeIdx, durType]);

  /* Stake input sync */
  const handleStakeBlur = useCallback(() => {
    const v = parseFloat(stakeInput);
    if (!isNaN(v) && v >= 0.35) {
      setStake(v);
      setStakeInput(v.toFixed(2));
    } else {
      setStakeInput(stake.toFixed(2));
    }
  }, [stakeInput, stake]);

  /* Adjust stake */
  const adjustStake = useCallback((delta: number) => {
    setStake(s => {
      const next = Math.max(0.35, Math.round((s + delta) * 100) / 100);
      setStakeInput(next.toFixed(2));
      return next;
    });
  }, []);

  /* Adjust duration */
  const adjustDuration = useCallback((delta: number) => {
    setDuration(d => Math.min(durType.max, Math.max(durType.min, d + delta)));
  }, [durType]);

  /* Buy contract */
  const handleBuy = useCallback((direction: "buy" | "sell") => {
    if (!isLoggedIn) { setShowAuth(true); return; }
    if (!price) return;

    setBuying(direction);
    setBuyError(null);

    /* Simulate a contract being placed */
    setTimeout(() => {
      const duration_sec = durationTypeIdx === 0
        ? duration          /* ticks treated as seconds for demo */
        : durationTypeIdx === 1
          ? duration * 60
          : durationTypeIdx === 2
            ? duration * 3600
            : duration * 86400;

      const contractId = `C${Date.now()}`;
      const newContract: Contract = {
        id: contractId,
        type: tradeType.label,
        direction,
        symbol: market.label,
        stake,
        payout: tradeType.id === "accumulators" ? stake * 2 : payout,
        entryPrice: price,
        currentPrice: price,
        profit: null,
        status: "open",
        expiresIn: Math.max(5, Math.min(60, duration_sec)),
        buyTime: Date.now(),
      };

      setContracts(prev => [newContract, ...prev].slice(0, 6));
      setBuying(null);

      /* Simulate contract expiry */
      const expiry = Math.max(5000, Math.min(60000, duration_sec * 1000));
      setTimeout(() => {
        const won = Math.random() > 0.5;
        setContracts(prev =>
          prev.map(c =>
            c.id === contractId
              ? { ...c, status: won ? "won" : "lost", profit: won ? payout - stake : -stake }
              : c
          )
        );
      }, expiry);
    }, 800);
  }, [isLoggedIn, price, stake, payout, tradeType, market, duration, durationTypeIdx]);

  const removeContract = useCallback((id: string) => {
    setContracts(prev => prev.filter(c => c.id !== id));
  }, []);

  /* Balance display */
  const balanceDisplay = balance != null
    ? `${balance.toFixed(2)} ${currency}`
    : isLoggedIn ? "Loading..." : "—";

  return (
    <div className="flex flex-col h-full bg-background select-none">

      {/* ─── Market Selector Bar ───────────────────────────────────── */}
      <div className="relative bg-card border-b border-border">
        <button
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors"
          onClick={() => setMktOpen(o => !o)}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Activity className="w-4 h-4 text-primary" />
            </div>
            <div className="text-left">
              <div className="text-sm font-bold text-foreground">{market.label}</div>
              <div className={`text-xs font-medium ${
                change.dir === "up" ? "text-[#22C55E]"
                  : change.dir === "down" ? "text-[#EF4444]"
                    : "text-muted-foreground"
              }`}>
                {change.dir === "up" ? "▲" : change.dir === "down" ? "▼" : "●"}{" "}
                {change.val} ({change.pct}%)
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`text-right transition-colors ${
              dir === "up" ? "text-[#22C55E]" : dir === "down" ? "text-[#EF4444]" : "text-foreground"
            }`}>
              <div className="text-lg font-bold leading-none">
                {price != null ? price.toFixed(market.pip) : "—"}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Live</div>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${mktOpen ? "rotate-180" : ""}`} />
          </div>
        </button>

        {/* Market Dropdown */}
        {mktOpen && (
          <div className="absolute top-full left-0 right-0 z-50 bg-card border border-border border-t-0 shadow-xl rounded-b-xl overflow-hidden">
            {MARKETS.map(m => (
              <button
                key={m.id}
                className={`w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/60 transition-colors ${
                  m.id === market.id ? "bg-primary/5 text-primary" : "text-foreground"
                }`}
                onClick={() => { setMarket(m); setMktOpen(false); }}
              >
                <span className="text-sm font-medium">{m.label}</span>
                {m.id === market.id && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ─── Chart ─────────────────────────────────────────────────── */}
      <div className="bg-white" style={{ height: 220, minHeight: 220, flexShrink: 0 }}>
        <TradingChart symbol={market.id} />
      </div>

      {/* ─── Trade Panel ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3 flex flex-col gap-3 pb-4">

          {/* Balance Strip */}
          {isLoggedIn && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
                <span className="text-xs text-muted-foreground">Balance</span>
              </div>
              <span className="text-sm font-bold text-foreground">{balanceDisplay}</span>
            </div>
          )}

          {/* Trade Type Selector */}
          <div className="relative">
            <button
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card hover:bg-secondary/50 transition-colors"
              onClick={() => setTradeTypeOpen(o => !o)}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  {tradeType.icon}
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold text-foreground">{tradeType.label}</div>
                  <div className="text-[11px] text-muted-foreground leading-tight max-w-[200px] truncate">{tradeType.desc}</div>
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${tradeTypeOpen ? "rotate-180" : ""}`} />
            </button>

            {tradeTypeOpen && (
              <div className="absolute top-full left-0 right-0 z-40 mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
                {TRADE_TYPES.map((t, i) => (
                  <button
                    key={t.id}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/60 transition-colors text-left ${
                      i === tradeTypeIdx ? "bg-primary/5 text-primary" : "text-foreground"
                    }`}
                    onClick={() => { setTradeTypeIdx(i); setTradeTypeOpen(false); }}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                      i === tradeTypeIdx ? "bg-primary text-white" : "bg-secondary text-muted-foreground"
                    }`}>
                      {t.icon}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{t.label}</div>
                      <div className="text-[11px] text-muted-foreground">{t.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Duration Section */}
          <div className="rounded-xl border border-border bg-card p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <Clock className="w-3.5 h-3.5" />
                Duration
              </div>
              <div className="flex items-center gap-1">
                {DURATION_TYPES.map((dt, i) => (
                  <button
                    key={dt.id}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                      i === durationTypeIdx
                        ? "bg-primary text-white"
                        : "text-muted-foreground hover:bg-secondary"
                    }`}
                    onClick={() => setDurationTypeIdx(i)}
                  >
                    {dt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="w-9 h-9 rounded-lg border border-border bg-secondary/80 flex items-center justify-center hover:bg-secondary active:scale-95 transition-all"
                onClick={() => adjustDuration(-durType.step)}
              >
                <Minus className="w-3.5 h-3.5 text-foreground" />
              </button>
              <div className="flex-1 text-center">
                <span className="text-2xl font-bold text-foreground">{duration}</span>
                <span className="text-sm text-muted-foreground ml-1.5">{durType.label.toLowerCase()}</span>
              </div>
              <button
                className="w-9 h-9 rounded-lg border border-border bg-secondary/80 flex items-center justify-center hover:bg-secondary active:scale-95 transition-all"
                onClick={() => adjustDuration(durType.step)}
              >
                <Plus className="w-3.5 h-3.5 text-foreground" />
              </button>
            </div>

            {/* Duration quick-pick */}
            {durationTypeIdx === 0 && (
              <div className="flex gap-1.5">
                {[1, 3, 5, 7, 10].map(v => (
                  <button
                    key={v}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      duration === v
                        ? "bg-primary/10 text-primary border border-primary/30"
                        : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                    }`}
                    onClick={() => setDuration(v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Stake Section */}
          <div className="rounded-xl border border-border bg-card p-3 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <BarChart2 className="w-3.5 h-3.5" />
              Stake
            </div>

            <div className="flex items-center gap-2">
              <button
                className="w-9 h-9 rounded-lg border border-border bg-secondary/80 flex items-center justify-center hover:bg-secondary active:scale-95 transition-all"
                onClick={() => adjustStake(-1)}
              >
                <Minus className="w-3.5 h-3.5 text-foreground" />
              </button>

              <div className="flex-1 flex items-center justify-center gap-1 bg-secondary/50 rounded-lg px-3 py-2 border border-border">
                <span className="text-sm text-muted-foreground">{currency || "USD"}</span>
                <input
                  type="number"
                  value={stakeInput}
                  onChange={e => setStakeInput(e.target.value)}
                  onBlur={handleStakeBlur}
                  className="w-20 text-center text-xl font-bold text-foreground bg-transparent outline-none border-none"
                  min={0.35}
                  step={1}
                />
              </div>

              <button
                className="w-9 h-9 rounded-lg border border-border bg-secondary/80 flex items-center justify-center hover:bg-secondary active:scale-95 transition-all"
                onClick={() => adjustStake(1)}
              >
                <Plus className="w-3.5 h-3.5 text-foreground" />
              </button>
            </div>

            {/* Quick stake amounts */}
            <div className="flex gap-1.5">
              {[1, 5, 10, 25, 50].map(v => (
                <button
                  key={v}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    stake === v
                      ? "bg-primary/10 text-primary border border-primary/30"
                      : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                  }`}
                  onClick={() => { setStake(v); setStakeInput(v.toFixed(2)); }}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Contract Info */}
          {tradeType.id !== "accumulators" && (
            <div className="rounded-xl border border-border bg-card px-4 py-3 flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Info className="w-3.5 h-3.5" />
                  Payout
                </div>
                <span className="font-bold text-foreground">${payout.toFixed(2)}</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Profit</span>
                <span className="font-bold text-[#22C55E]">+${profit.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Return</span>
                <span className="font-bold text-foreground">{((profit / stake) * 100).toFixed(0)}%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Entry spot</span>
                <span className="font-bold text-foreground">
                  {price != null ? price.toFixed(market.pip) : "—"}
                </span>
              </div>
            </div>
          )}

          {/* Error message */}
          {buyError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {buyError}
            </div>
          )}

          {/* ─── Buy / Sell Buttons ──────────────────────────────── */}
          {tradeType.hasSell ? (
            <div className="grid grid-cols-2 gap-2.5">
              {/* Sell / Fall / Lower */}
              <button
                disabled={buying !== null || !price}
                className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl font-bold text-white transition-all active:scale-[0.97] disabled:opacity-60"
                style={{ background: buying === "sell" ? "#cc3333" : "#EF4444" }}
                onClick={() => handleBuy("sell")}
              >
                {buying === "sell" ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <TrendingDown className="w-5 h-5" />
                )}
                <span className="text-sm">{tradeType.sellLabel}</span>
                <span className="text-xs opacity-80">${stake.toFixed(2)}</span>
              </button>

              {/* Buy / Rise / Higher */}
              <button
                disabled={buying !== null || !price}
                className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl font-bold text-white transition-all active:scale-[0.97] disabled:opacity-60"
                style={{ background: buying === "buy" ? "#16a34a" : "#22C55E" }}
                onClick={() => handleBuy("buy")}
              >
                {buying === "buy" ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <TrendingUp className="w-5 h-5" />
                )}
                <span className="text-sm">{tradeType.buyLabel}</span>
                <span className="text-xs opacity-80">${stake.toFixed(2)}</span>
              </button>
            </div>
          ) : (
            /* Single buy button */
            <button
              disabled={buying !== null || !price}
              className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl font-bold text-white transition-all active:scale-[0.97] disabled:opacity-60"
              style={{ background: buying === "buy" ? "#16a34a" : "#22C55E" }}
              onClick={() => handleBuy("buy")}
            >
              {buying === "buy" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <TrendingUp className="w-5 h-5" />
              )}
              <span>{tradeType.buyLabel}</span>
              <span className="opacity-80 text-sm">· ${stake.toFixed(2)}</span>
            </button>
          )}

          {/* Login prompt if not logged in */}
          {!isLoggedIn && (
            <p className="text-center text-xs text-muted-foreground -mt-1">
              You'll be asked to log in before placing a trade
            </p>
          )}

          {/* ─── Active Contracts ─────────────────────────────────── */}
          {contracts.length > 0 && (
            <div className="flex flex-col gap-2 mt-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Active Contracts
                </div>
                <span className="text-xs text-muted-foreground">{contracts.length}</span>
              </div>
              {contracts.map(c => (
                <ContractCard key={c.id} contract={c} onClose={removeContract} />
              ))}
            </div>
          )}

        </div>
      </div>

      {/* Auth Modal */}
      <AuthGateModal open={showAuth} onClose={() => setShowAuth(false)} />
    </div>
  );
}
