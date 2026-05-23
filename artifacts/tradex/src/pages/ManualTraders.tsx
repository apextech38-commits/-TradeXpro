import {
  useState, useEffect, useRef, useCallback, useMemo,
} from "react";
import {
  ChevronDown, ChevronLeft, ChevronRight, Minus, Plus,
  TrendingUp, TrendingDown, X, Check, Clock, AlertCircle,
  CheckCircle2, Loader2, Info, Activity, RefreshCw,
} from "lucide-react";
import AuthGateModal from "@/components/AuthGateModal";
import { useAuth, DERIV_APP_ID } from "@/context/AuthContext";
import {
  createChart, ColorType, AreaSeries, LineStyle,
} from "lightweight-charts";
import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";

const WS_URL = `wss://ws.binaryws.com/websockets/v3?app_id=${DERIV_APP_ID}`;

/* ─────────────────────────────────────────────────────────────────────
   DATA: Trade categories, types and their sub-tabs
   Mirrors the dtrader-template contract type taxonomy
────────────────────────────────────────────────────────────────────── */
const TRADE_CATEGORIES = [
  {
    id: "rise_fall",
    label: "Rise/Fall",
    tabs: [
      { id: "rise",  label: "Rise",  direction: "buy"  as const },
      { id: "fall",  label: "Fall",  direction: "sell" as const },
    ],
    hasBarrier: false,
    hasDuration: true,
    description: "Predict if the price will rise or fall at expiry",
  },
  {
    id: "higher_lower",
    label: "Higher/Lower",
    tabs: [
      { id: "higher", label: "Higher", direction: "buy"  as const },
      { id: "lower",  label: "Lower",  direction: "sell" as const },
    ],
    hasBarrier: true,
    hasDuration: true,
    description: "Predict if the exit spot will be higher or lower than a target",
  },
  {
    id: "touch",
    label: "Touch/No Touch",
    tabs: [
      { id: "touch",    label: "Touch",    direction: "buy"  as const },
      { id: "no_touch", label: "No Touch", direction: "sell" as const },
    ],
    hasBarrier: true,
    hasDuration: true,
    description: "Predict if the price will touch the barrier or not",
  },
  {
    id: "multipliers",
    label: "Multipliers",
    tabs: [
      { id: "mult_up",   label: "Up",   direction: "buy"  as const },
      { id: "mult_down", label: "Down", direction: "sell" as const },
    ],
    hasBarrier: false,
    hasDuration: false,
    description: "Amplify your returns with a multiplier",
  },
  {
    id: "accumulators",
    label: "Accumulators",
    tabs: [
      { id: "accum", label: "Buy", direction: "buy" as const },
    ],
    hasBarrier: false,
    hasDuration: false,
    description: "Accumulate profits on each tick as long as price stays in range",
  },
  {
    id: "digits",
    label: "Digits",
    tabs: [
      { id: "even",    label: "Even",    direction: "buy"  as const },
      { id: "odd",     label: "Odd",     direction: "sell" as const },
      { id: "matches", label: "Matches", direction: "buy"  as const },
      { id: "differs", label: "Differs", direction: "sell" as const },
      { id: "over",    label: "Over",    direction: "buy"  as const },
      { id: "under",   label: "Under",   direction: "sell" as const },
    ],
    hasBarrier: false,
    hasDuration: true,
    description: "Predict the last digit of the final tick price",
  },
];

/* ─── Markets ─────────────────────────────────────────────────────── */
const MARKETS = [
  { label: "Volatility 100 Index",    short: "V 100",  id: "R_100",   pip: 2 },
  { label: "Volatility 100 (1s)",     short: "V100(1s)", id: "1HZ100V", pip: 2 },
  { label: "Volatility 75 Index",     short: "V 75",   id: "R_75",    pip: 4 },
  { label: "Volatility 75 (1s)",      short: "V75(1s)", id: "1HZ75V",  pip: 4 },
  { label: "Volatility 50 Index",     short: "V 50",   id: "R_50",    pip: 4 },
  { label: "Volatility 50 (1s)",      short: "V50(1s)", id: "1HZ50V",  pip: 4 },
  { label: "Volatility 25 Index",     short: "V 25",   id: "R_25",    pip: 4 },
  { label: "Volatility 25 (1s)",      short: "V25(1s)", id: "1HZ25V",  pip: 4 },
  { label: "Volatility 10 Index",     short: "V 10",   id: "R_10",    pip: 3 },
  { label: "Volatility 10 (1s)",      short: "V10(1s)", id: "1HZ10V",  pip: 3 },
];

/* ─── Duration presets ────────────────────────────────────────────── */
const DURATION_UNITS = [
  { id: "t", label: "Ticks",   values: [1, 3, 5, 7, 10, 15, 20, 30, 50, 100] },
  { id: "s", label: "Seconds", values: [15, 30, 45, 60, 90, 120] },
  { id: "m", label: "Minutes", values: [1, 2, 3, 5, 10, 15, 30, 60] },
  { id: "h", label: "Hours",   values: [1, 2, 3, 4, 6, 8, 12, 24] },
  { id: "d", label: "Days",    values: [1, 2, 3, 5, 7, 14, 30, 90] },
];

/* ─── Quick stake amounts ─────────────────────────────────────────── */
const STAKE_PRESETS = [1, 5, 10, 25, 50, 100, 250, 500];

/* ─────────────────────────────────────────────────────────────────────
   HOOKS
────────────────────────────────────────────────────────────────────── */
function useLivePrice(symbol: string) {
  const [price, setPrice] = useState<number | null>(null);
  const [prevPrice, setPrev] = useState<number | null>(null);
  const [openPrice, setOpen] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let mounted = true;
    setPrice(null); setPrev(null); setOpen(null);
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen = () => ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
    ws.onmessage = (e) => {
      if (!mounted) return;
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
    return () => { mounted = false; ws.onclose = null; ws.close(); };
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

  const dir: "up" | "down" | "flat" =
    price != null && prevPrice != null
      ? price > prevPrice ? "up" : price < prevPrice ? "down" : "flat"
      : "flat";

  return { price, change, dir };
}

/* ─────────────────────────────────────────────────────────────────────
   CHART COMPONENT — dtrader-style white area chart
────────────────────────────────────────────────────────────────────── */
function TradingChart({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let mounted = true;
    const el = containerRef.current;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#6b7280",
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
        vertLine: { color: "rgba(0,0,0,0.15)", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#1a1a1a" },
        horzLine: { color: "rgba(0,0,0,0.15)", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#1a1a1a" },
      },
      rightPriceScale: { borderColor: "rgba(0,0,0,0.06)", scaleMargins: { top: 0.12, bottom: 0.06 } },
      timeScale: {
        borderColor: "rgba(0,0,0,0.06)",
        timeVisible: true,
        secondsVisible: true,
        rightOffset: 5,
        barSpacing: 4,
        lockVisibleTimeRangeOnResize: true,
      },
      width: el.clientWidth,
      height: el.clientHeight || 220,
    });
    chartRef.current = chart;

    const area = chart.addSeries(AreaSeries, {
      lineColor: "#ff444f",
      topColor: "rgba(255,68,79,0.12)",
      bottomColor: "rgba(255,68,79,0)",
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      crosshairMarkerBackgroundColor: "#ff444f",
      crosshairMarkerBorderColor: "#ffffff",
      crosshairMarkerBorderWidth: 2,
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineColor: "rgba(255,68,79,0.4)",
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
    ws.onopen = () => {
      if (!mounted) return;
      ws.send(JSON.stringify({ ticks_history: symbol, count: 300, end: "latest", style: "ticks", subscribe: 1 }));
    };
    ws.onmessage = (evt) => {
      if (!mounted) return;
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
      mounted = false;
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

/* ─────────────────────────────────────────────────────────────────────
   BOTTOM SHEET — dtrader-template ActionSheet equivalent
────────────────────────────────────────────────────────────────────── */
function BottomSheet({
  open, onClose, title, children,
}: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ backgroundColor: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
    >
      <div
        className="w-full bg-card rounded-t-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: "75vh", animation: "sheet-up 0.22s cubic-bezier(0.22,1,0.36,1) both" }}
      >
        {/* Handle + title */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-border mx-auto absolute left-1/2 -translate-x-1/2 top-2" />
          <span className="text-sm font-bold text-foreground pt-1">{title}</span>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-secondary text-muted-foreground transition-colors ml-auto"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="h-px bg-border" />
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
      <style>{`
        @keyframes sheet-up {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   CONTRACT CARD — dtrader-template ContractCard equivalent
────────────────────────────────────────────────────────────────────── */
interface Contract {
  id: string;
  tradeType: string;
  tab: string;
  direction: "buy" | "sell";
  symbol: string;
  stake: number;
  payout: number;
  entryPrice: number;
  status: "open" | "won" | "lost";
  expiresAt: number;
}

function ContractCard({ c, onClose }: { c: Contract; onClose: (id: string) => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (c.status !== "open") return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [c.status]);
  const secsLeft = Math.max(0, Math.round((c.expiresAt - now) / 1000));
  const isUp = c.direction === "buy";
  const isDone = c.status !== "open";
  const isWon = c.status === "won";
  const profit = isWon ? c.payout - c.stake : -c.stake;

  return (
    <div className={`rounded-xl border p-3 flex items-center gap-3 transition-all ${
      isDone
        ? isWon ? "border-green-200 bg-green-50/80" : "border-red-200 bg-red-50/80"
        : "border-border bg-card"
    }`}>
      {/* Direction icon */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
        isUp ? "bg-[#22C55E]/15 text-[#22C55E]" : "bg-[#EF4444]/15 text-[#EF4444]"
      }`}>
        {isUp ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-foreground truncate">{c.tradeType} · {c.tab}</span>
          {!isDone && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Clock className="w-3 h-3" />{secsLeft}s
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground">{c.symbol}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-muted-foreground">Stake: <span className="text-foreground font-semibold">${c.stake.toFixed(2)}</span></span>
          <span className="text-[11px] text-muted-foreground">Payout: <span className="text-foreground font-semibold">${c.payout.toFixed(2)}</span></span>
        </div>
      </div>

      {/* P&L / status */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {isDone ? (
          <>
            {isWon
              ? <CheckCircle2 className="w-4 h-4 text-green-500" />
              : <AlertCircle className="w-4 h-4 text-red-500" />
            }
            <span className={`text-xs font-bold ${isWon ? "text-green-600" : "text-red-600"}`}>
              {isWon ? "+" : ""}{profit.toFixed(2)}
            </span>
          </>
        ) : (
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] text-muted-foreground">Open</span>
          </div>
        )}
        <button
          onClick={() => onClose(c.id)}
          className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   MAIN PAGE
────────────────────────────────────────────────────────────────────── */
export default function ManualTraders() {
  const { isLoggedIn, balance, currency } = useAuth();

  /* ── State ──────────────────────────────────────────────────────── */
  const [market, setMarket]       = useState(MARKETS[0]);
  const [catIdx, setCatIdx]       = useState(0);
  const [tabIdx, setTabIdx]       = useState(0);
  const [durUnitIdx, setDurUnitIdx] = useState(0);
  const [durVal, setDurVal]       = useState(5);
  const [stake, setStake]         = useState(10);
  const [stakeStr, setStakeStr]   = useState("10.00");

  /* bottom sheets */
  const [marketSheet, setMarketSheet] = useState(false);
  const [durSheet, setDurSheet]     = useState(false);
  const [stakeSheet, setStakeSheet]  = useState(false);
  const [authSheet, setAuthSheet]   = useState(false);

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [buying, setBuying]       = useState(false);

  const cat  = TRADE_CATEGORIES[catIdx];
  const tab  = cat.tabs[tabIdx] ?? cat.tabs[0];
  const durUnit = DURATION_UNITS[durUnitIdx];

  /* ── Live price ─────────────────────────────────────────────────── */
  const { price, change, dir } = useLivePrice(market.id);

  /* ── Reset tab when category changes ────────────────────────────── */
  useEffect(() => { setTabIdx(0); }, [catIdx]);

  /* ── Clamp durVal when unit changes ─────────────────────────────── */
  useEffect(() => {
    setDurVal(durUnit.values[Math.min(2, durUnit.values.length - 1)]);
  }, [durUnitIdx]);

  /* ── Stake input sync ────────────────────────────────────────────── */
  const commitStake = useCallback(() => {
    const v = parseFloat(stakeStr);
    if (!isNaN(v) && v >= 0.35) {
      setStake(v);
      setStakeStr(v.toFixed(2));
    } else {
      setStakeStr(stake.toFixed(2));
    }
  }, [stakeStr, stake]);

  const nudgeStake = useCallback((delta: number) => {
    setStake(s => {
      const next = Math.max(0.35, +(s + delta).toFixed(2));
      setStakeStr(next.toFixed(2));
      return next;
    });
  }, []);

  /* ── Payout / profit (simplified proposal) ──────────────────────── */
  const payoutMultiplier = ["accumulators", "multipliers"].includes(cat.id) ? 1 : 1.85;
  const payout = cat.id === "accumulators" ? 0 : +(stake * payoutMultiplier).toFixed(2);
  const profit = +(payout - stake).toFixed(2);
  const returnPct = stake > 0 ? +((profit / stake) * 100).toFixed(0) : 0;

  /* ── Buy ─────────────────────────────────────────────────────────── */
  const handleBuy = useCallback(() => {
    if (!isLoggedIn) { setAuthSheet(true); return; }
    if (!price || buying) return;
    setBuying(true);

    const durSec =
      durUnit.id === "t" ? durVal * 2
      : durUnit.id === "s" ? durVal
      : durUnit.id === "m" ? durVal * 60
      : durUnit.id === "h" ? durVal * 3600
      : durVal * 86400;

    const lifeMs = Math.max(4000, Math.min(90000, durSec * 1000));

    setTimeout(() => {
      const id = `C${Date.now()}`;
      const newC: Contract = {
        id,
        tradeType: cat.label,
        tab: tab.label,
        direction: tab.direction,
        symbol: market.short,
        stake,
        payout: cat.id === "accumulators" ? stake * 2 : payout,
        entryPrice: price,
        status: "open",
        expiresAt: Date.now() + lifeMs,
      };
      setContracts(prev => [newC, ...prev].slice(0, 6));
      setBuying(false);

      setTimeout(() => {
        const won = Math.random() > 0.45;
        setContracts(prev =>
          prev.map(c => c.id === id ? { ...c, status: won ? "won" : "lost" } : c)
        );
      }, lifeMs);
    }, 600);
  }, [isLoggedIn, price, buying, stake, payout, cat, tab, market, durUnit, durVal]);

  /* ── Trade-type category scroller ref ───────────────────────────── */
  const catScrollRef = useRef<HTMLDivElement>(null);

  /* ── Duration label ─────────────────────────────────────────────── */
  const durLabel = `${durVal} ${durUnit.id === "t" ? "tick" + (durVal !== 1 ? "s" : "") : durUnit.label.slice(0, -1) + (durVal !== 1 ? "s" : "")}`;

  /* ── Colors ──────────────────────────────────────────────────────── */
  const buyColor   = tab.direction === "buy"  ? "#22C55E" : "#EF4444";
  const sellColor  = tab.direction === "sell" ? "#EF4444" : "#22C55E";

  return (
    <div className="flex flex-col h-full bg-[#f7f8fa] overflow-hidden">

      {/* ══════════════════════════════════════════════════════════════
          CHART AREA (white, dtrader-style)
      ══════════════════════════════════════════════════════════════ */}
      <div className="bg-white flex flex-col" style={{ flex: "0 0 auto" }}>

        {/* Market header */}
        <button
          className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-100"
          onClick={() => setMarketSheet(true)}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Activity className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="text-left">
              <div className="text-sm font-bold text-gray-900 leading-none">{market.label}</div>
              <div className={`text-xs font-medium mt-0.5 ${
                change.dir === "up" ? "text-green-500"
                : change.dir === "down" ? "text-red-500"
                : "text-gray-400"
              }`}>
                {change.dir === "up" ? "▲" : change.dir === "down" ? "▼" : "●"} {change.val} ({change.pct}%)
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className={`text-xl font-bold tabular-nums transition-colors ${
              dir === "up" ? "text-green-500" : dir === "down" ? "text-red-500" : "text-gray-900"
            }`}>
              {price != null ? price.toFixed(market.pip) : "—"}
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </div>
        </button>

        {/* Chart canvas */}
        <div style={{ height: 210 }}>
          <TradingChart symbol={market.id} />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          TRADE PANEL — scrollable
      ══════════════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Trade type category pills (dtrader horizontal scroll) ── */}
        <div className="bg-white border-b border-gray-100 px-4 py-3">
          <div
            ref={catScrollRef}
            className="flex items-center gap-2 overflow-x-auto no-scrollbar"
          >
            {TRADE_CATEGORIES.map((tc, i) => (
              <button
                key={tc.id}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  i === catIdx
                    ? "bg-primary text-white shadow-sm shadow-primary/30"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                onClick={() => setCatIdx(i)}
              >
                {tc.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Trade type tabs (dtrader SegmentedControl) ─────────── */}
        {cat.tabs.length > 1 && (
          <div className="bg-white border-b border-gray-100 px-4 py-3">
            <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl">
              {cat.tabs.map((t, i) => (
                <button
                  key={t.id}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                    i === tabIdx
                      ? t.direction === "buy"
                        ? "bg-white text-green-600 shadow-sm"
                        : "bg-white text-red-500 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                  onClick={() => setTabIdx(i)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Parameters chips row (dtrader chip-tap-opens-sheet UX) ─ */}
        <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-2">
          {/* Duration chip */}
          {cat.hasDuration && (
            <button
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:border-primary hover:bg-primary/5 transition-all group"
              onClick={() => setDurSheet(true)}
            >
              <Clock className="w-3.5 h-3.5 text-gray-400 group-hover:text-primary" />
              <span className="text-xs font-bold text-gray-700 group-hover:text-primary">{durLabel}</span>
              <ChevronDown className="w-3 h-3 text-gray-300 group-hover:text-primary" />
            </button>
          )}

          {/* Stake chip */}
          <button
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:border-primary hover:bg-primary/5 transition-all group"
            onClick={() => setStakeSheet(true)}
          >
            <span className="text-[10px] font-bold text-gray-400 group-hover:text-primary">{currency || "USD"}</span>
            <span className="text-xs font-bold text-gray-700 group-hover:text-primary">{stake.toFixed(2)}</span>
            <ChevronDown className="w-3 h-3 text-gray-300 group-hover:text-primary" />
          </button>

          {/* Balance (if logged in) */}
          {isLoggedIn && balance != null && (
            <div className="ml-auto flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-xs text-gray-500 font-medium">
                {balance.toFixed(2)} {currency}
              </span>
            </div>
          )}
        </div>

        {/* ── Contract info bar (dtrader PayoutInfo equivalent) ────── */}
        {cat.id !== "accumulators" && (
          <div className="bg-white border-b border-gray-100 px-4 py-2.5 flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">Payout</span>
              <span className="text-sm font-bold text-gray-900">${payout.toFixed(2)}</span>
            </div>
            <div className="w-px h-4 bg-gray-200" />
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">Profit</span>
              <span className="text-sm font-bold text-green-500">+${profit.toFixed(2)}</span>
            </div>
            <div className="w-px h-4 bg-gray-200" />
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">Return</span>
              <span className="text-sm font-bold text-gray-900">{returnPct}%</span>
            </div>
            {price != null && (
              <>
                <div className="w-px h-4 bg-gray-200" />
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400">Spot</span>
                  <span className="text-sm font-bold text-gray-900">{price.toFixed(market.pip)}</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Accumulators info ────────────────────────────────────── */}
        {cat.id === "accumulators" && (
          <div className="bg-blue-50 border-b border-blue-100 px-4 py-2.5 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-600 leading-relaxed">
              Accumulate profit on each tick. The contract closes if the price moves outside the range, or you can sell at any time.
            </p>
          </div>
        )}

        {/* ── BUY BUTTON — dtrader pinned to bottom of panel ────── */}
        <div className="p-4">
          {cat.tabs.length > 1 ? (
            /* Rise/Fall style — two separate buy/sell buttons */
            <div className="grid grid-cols-2 gap-3">
              {/* Sell / Lower / Fall */}
              <button
                disabled={buying || !price}
                className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl text-white font-bold transition-all active:scale-[0.97] disabled:opacity-50"
                style={{ backgroundColor: "#EF4444" }}
                onClick={() => { setTabIdx(cat.tabs.findIndex(t => t.direction === "sell") >= 0 ? cat.tabs.findIndex(t => t.direction === "sell") : tabIdx); handleBuy(); }}
              >
                {buying ? <Loader2 className="w-5 h-5 animate-spin" /> : <TrendingDown className="w-5 h-5" />}
                <span className="text-sm">{cat.tabs.find(t => t.direction === "sell")?.label ?? "Fall"}</span>
                <span className="text-xs opacity-70">${stake.toFixed(2)}</span>
              </button>

              {/* Buy / Rise / Higher */}
              <button
                disabled={buying || !price}
                className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl text-white font-bold transition-all active:scale-[0.97] disabled:opacity-50"
                style={{ backgroundColor: "#22C55E" }}
                onClick={() => { setTabIdx(cat.tabs.findIndex(t => t.direction === "buy")); handleBuy(); }}
              >
                {buying ? <Loader2 className="w-5 h-5 animate-spin" /> : <TrendingUp className="w-5 h-5" />}
                <span className="text-sm">{cat.tabs.find(t => t.direction === "buy")?.label ?? "Rise"}</span>
                <span className="text-xs opacity-70">${stake.toFixed(2)}</span>
              </button>
            </div>
          ) : (
            /* Single buy button (Accumulators, etc.) */
            <button
              disabled={buying || !price}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-white font-bold text-base transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ backgroundColor: "#22C55E" }}
              onClick={handleBuy}
            >
              {buying ? <Loader2 className="w-5 h-5 animate-spin" /> : <TrendingUp className="w-5 h-5" />}
              <span>Buy {cat.label}</span>
              <span className="opacity-70 text-sm">· ${stake.toFixed(2)}</span>
            </button>
          )}

          {!isLoggedIn && (
            <p className="text-center text-xs text-gray-400 mt-2">
              You'll be prompted to log in before placing a trade
            </p>
          )}
        </div>

        {/* ── Open / recent contracts ──────────────────────────────── */}
        {contracts.length > 0 && (
          <div className="px-4 pb-6 flex flex-col gap-2">
            <div className="flex items-center justify-between mb-0.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wide">
                <RefreshCw className="w-3.5 h-3.5" />
                Positions
              </div>
              <span className="text-xs text-gray-400">{contracts.length} contract{contracts.length !== 1 ? "s" : ""}</span>
            </div>
            {contracts.map(c => (
              <ContractCard key={c.id} c={c} onClose={id => setContracts(p => p.filter(x => x.id !== id))} />
            ))}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          BOTTOM SHEETS
      ══════════════════════════════════════════════════════════════ */}

      {/* Market selector sheet */}
      <BottomSheet open={marketSheet} onClose={() => setMarketSheet(false)} title="Select Market">
        <div className="flex flex-col py-2">
          {MARKETS.map(m => (
            <button
              key={m.id}
              className={`flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors ${m.id === market.id ? "bg-primary/5" : ""}`}
              onClick={() => { setMarket(m); setMarketSheet(false); }}
            >
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${m.id === market.id ? "bg-primary" : "bg-gray-200"}`} />
                <span className={`text-sm font-semibold ${m.id === market.id ? "text-primary" : "text-gray-800"}`}>
                  {m.label}
                </span>
              </div>
              {m.id === market.id && <Check className="w-4 h-4 text-primary" />}
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* Duration picker sheet */}
      <BottomSheet open={durSheet} onClose={() => setDurSheet(false)} title="Select Duration">
        <div className="px-4 py-4 flex flex-col gap-5">
          {/* Unit tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl">
            {DURATION_UNITS.map((du, i) => (
              <button
                key={du.id}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                  i === durUnitIdx ? "bg-white text-primary shadow-sm" : "text-gray-500"
                }`}
                onClick={() => setDurUnitIdx(i)}
              >
                {du.label}
              </button>
            ))}
          </div>

          {/* Value grid */}
          <div className="grid grid-cols-4 gap-2">
            {DURATION_UNITS[durUnitIdx].values.map(v => (
              <button
                key={v}
                className={`py-3 rounded-xl text-sm font-bold transition-all ${
                  v === durVal
                    ? "bg-primary text-white shadow-sm shadow-primary/30"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                onClick={() => setDurVal(v)}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Manual input row */}
          <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
            <button
              className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center active:bg-gray-100"
              onClick={() => setDurVal(v => Math.max(DURATION_UNITS[durUnitIdx].values[0], v - 1))}
            >
              <Minus className="w-4 h-4 text-gray-600" />
            </button>
            <div className="flex-1 text-center">
              <span className="text-2xl font-bold text-gray-900">{durVal}</span>
              <span className="text-sm text-gray-400 ml-1.5">{DURATION_UNITS[durUnitIdx].label.toLowerCase()}</span>
            </div>
            <button
              className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center active:bg-gray-100"
              onClick={() => setDurVal(v => Math.min(DURATION_UNITS[durUnitIdx].values.slice(-1)[0], v + 1))}
            >
              <Plus className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          <button
            className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-sm"
            onClick={() => setDurSheet(false)}
          >
            Confirm — {durLabel}
          </button>
        </div>
      </BottomSheet>

      {/* Stake picker sheet */}
      <BottomSheet open={stakeSheet} onClose={() => { commitStake(); setStakeSheet(false); }} title="Set Stake">
        <div className="px-4 py-4 flex flex-col gap-5">
          {/* Manual amount */}
          <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
            <button
              className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center active:bg-gray-100"
              onClick={() => nudgeStake(-1)}
            >
              <Minus className="w-4 h-4 text-gray-600" />
            </button>
            <div className="flex-1 flex items-center justify-center gap-2">
              <span className="text-sm text-gray-400 font-bold">{currency || "USD"}</span>
              <input
                type="number"
                value={stakeStr}
                onChange={e => setStakeStr(e.target.value)}
                onBlur={commitStake}
                className="w-28 text-center text-2xl font-bold text-gray-900 bg-transparent outline-none border-none"
                min={0.35}
                step={1}
              />
            </div>
            <button
              className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center active:bg-gray-100"
              onClick={() => nudgeStake(1)}
            >
              <Plus className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* Preset grid */}
          <div className="grid grid-cols-4 gap-2">
            {STAKE_PRESETS.map(v => (
              <button
                key={v}
                className={`py-3 rounded-xl text-sm font-bold transition-all ${
                  stake === v
                    ? "bg-primary text-white shadow-sm shadow-primary/30"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                onClick={() => { setStake(v); setStakeStr(v.toFixed(2)); }}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Payout preview */}
          {cat.id !== "accumulators" && (
            <div className="flex items-center justify-between bg-green-50 rounded-xl px-4 py-3 border border-green-100">
              <span className="text-sm text-gray-600">Estimated payout</span>
              <span className="text-base font-bold text-green-600">${(stake * payoutMultiplier).toFixed(2)}</span>
            </div>
          )}

          <button
            className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-sm"
            onClick={() => { commitStake(); setStakeSheet(false); }}
          >
            Confirm — {currency || "USD"} {stake.toFixed(2)}
          </button>
        </div>
      </BottomSheet>

      {/* Auth modal */}
      <AuthGateModal open={authSheet} onClose={() => setAuthSheet(false)} />
    </div>
  );
}
