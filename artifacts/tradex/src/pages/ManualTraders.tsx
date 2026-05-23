import {
  useState, useEffect, useRef, useCallback, useMemo,
} from "react";
import {
  ChevronDown, ChevronRight, Minus, Plus, X, Check,
  TrendingUp, TrendingDown, Loader2, Clock, Info,
  Activity, AlertCircle, CheckCircle2, RefreshCw,
} from "lucide-react";
import AuthGateModal from "@/components/AuthGateModal";
import { useAuth, DERIV_APP_ID } from "@/context/AuthContext";
import {
  createChart, ColorType, AreaSeries, LineSeries, LineStyle,
} from "lightweight-charts";
import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";

const WS_URL = `wss://ws.binaryws.com/websockets/v3?app_id=${DERIV_APP_ID}`;

/* ─────────────────────────────────────────────────────────────────────
   TRADE TYPES — matching DTrader taxonomy
────────────────────────────────────────────────────────────────────── */
const TRADE_TYPES = [
  {
    id: "rise_fall",
    label: "Rise/Fall",
    description: "Predict if the market will go higher or lower than its current level at the end of the contract period.",
    hasTabs: true,
    tabs: [{ id: "rise", label: "Rise" }, { id: "fall", label: "Fall" }],
    hasDuration: true,
    hasBarrier: false,
    hasGrowthRate: false,
    hasTakeProfit: false,
    hasMultiplier: false,
    buyLabel: "Rise",
    sellLabel: "Fall",
    maxPayout: 50000,
  },
  {
    id: "higher_lower",
    label: "Higher/Lower",
    description: "Predict if the exit spot will be higher or lower than a target price.",
    hasTabs: true,
    tabs: [{ id: "higher", label: "Higher" }, { id: "lower", label: "Lower" }],
    hasDuration: true,
    hasBarrier: true,
    hasGrowthRate: false,
    hasTakeProfit: false,
    hasMultiplier: false,
    buyLabel: "Higher",
    sellLabel: "Lower",
    maxPayout: 50000,
  },
  {
    id: "touch",
    label: "Touch/No Touch",
    description: "Predict if the market will touch the target level at any point before the contract expires.",
    hasTabs: true,
    tabs: [{ id: "touch", label: "Touch" }, { id: "no_touch", label: "No Touch" }],
    hasDuration: true,
    hasBarrier: true,
    hasGrowthRate: false,
    hasTakeProfit: false,
    hasMultiplier: false,
    buyLabel: "Touch",
    sellLabel: "No Touch",
    maxPayout: 50000,
  },
  {
    id: "multipliers",
    label: "Multipliers",
    description: "Trade with a multiplier to amplify potential profits while limiting losses to the stake amount.",
    hasTabs: true,
    tabs: [{ id: "up", label: "Up" }, { id: "down", label: "Down" }],
    hasDuration: false,
    hasBarrier: false,
    hasGrowthRate: false,
    hasTakeProfit: true,
    hasMultiplier: true,
    buyLabel: "Up",
    sellLabel: "Down",
    maxPayout: 100000,
  },
  {
    id: "accumulators",
    label: "Accumulators",
    description: "Your stake grows by a set percentage for each tick the spot price remains within a price range.",
    hasTabs: false,
    tabs: [],
    hasDuration: false,
    hasBarrier: false,
    hasGrowthRate: true,
    hasTakeProfit: true,
    hasMultiplier: false,
    buyLabel: "Buy",
    sellLabel: "",
    maxPayout: 6000,
  },
  {
    id: "digits",
    label: "Digits",
    description: "Predict the last digit of the final tick price.",
    hasTabs: true,
    tabs: [
      { id: "even", label: "Even" }, { id: "odd", label: "Odd" },
      { id: "matches", label: "Matches" }, { id: "differs", label: "Differs" },
      { id: "over", label: "Over" }, { id: "under", label: "Under" },
    ],
    hasDuration: true,
    hasBarrier: false,
    hasGrowthRate: false,
    hasTakeProfit: false,
    hasMultiplier: false,
    buyLabel: "Buy",
    sellLabel: "",
    maxPayout: 50000,
  },
] as const;

type TradeTypeId = typeof TRADE_TYPES[number]["id"];

/* ─── Markets ─────────────────────────────────────────────────────── */
const MARKETS = [
  { label: "Volatility 100 (1s) Index", short: "V100(1s)", id: "1HZ100V", pip: 2 },
  { label: "Volatility 100 Index",      short: "V 100",    id: "R_100",   pip: 2 },
  { label: "Volatility 75 (1s) Index",  short: "V75(1s)",  id: "1HZ75V",  pip: 4 },
  { label: "Volatility 75 Index",       short: "V 75",     id: "R_75",    pip: 4 },
  { label: "Volatility 50 (1s) Index",  short: "V50(1s)",  id: "1HZ50V",  pip: 4 },
  { label: "Volatility 50 Index",       short: "V 50",     id: "R_50",    pip: 4 },
  { label: "Volatility 25 (1s) Index",  short: "V25(1s)",  id: "1HZ25V",  pip: 4 },
  { label: "Volatility 25 Index",       short: "V 25",     id: "R_25",    pip: 4 },
  { label: "Volatility 10 (1s) Index",  short: "V10(1s)",  id: "1HZ10V",  pip: 3 },
  { label: "Volatility 10 Index",       short: "V 10",     id: "R_10",    pip: 3 },
];

/* ─── Growth rates ────────────────────────────────────────────────── */
const GROWTH_RATES = [1, 2, 3, 4, 5];

/* ─── Multipliers ─────────────────────────────────────────────────── */
const MULTIPLIERS = [10, 20, 30, 40, 50, 100, 200, 500];

/* ─── Duration units ──────────────────────────────────────────────── */
const DURATION_UNITS = [
  { id: "t", label: "Ticks",   values: [1, 3, 5, 7, 10, 15, 20, 30, 50, 100] },
  { id: "m", label: "Minutes", values: [1, 2, 3, 5, 10, 15, 30, 60] },
  { id: "h", label: "Hours",   values: [1, 2, 3, 4, 6, 8, 12, 24] },
  { id: "d", label: "Days",    values: [1, 2, 3, 5, 7, 14, 30, 90] },
];

/* ─────────────────────────────────────────────────────────────────────
   CHART — DTrader white style with barrier bands for Accumulators
────────────────────────────────────────────────────────────────────── */
function TradingChart({
  symbol,
  pip,
  showBarriers,
}: { symbol: string; pip: number; showBarriers: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const areaRef      = useRef<ISeriesApi<"Area"> | null>(null);
  const upperRef     = useRef<ISeriesApi<"Line"> | null>(null);
  const lowerRef     = useRef<ISeriesApi<"Line"> | null>(null);
  const lastPriceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let mounted = true;
    const el = containerRef.current;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#9ca3af",
        fontSize: 11,
        fontFamily: "'Inter', system-ui, sans-serif",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "#f3f4f6" },
        horzLines: { color: "#f3f4f6" },
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
        borderColor: "#f3f4f6",
        scaleMargins: { top: 0.15, bottom: 0.08 },
      },
      timeScale: {
        borderColor: "#f3f4f6",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 4,
        barSpacing: 6,
      },
      width:  el.clientWidth,
      height: el.clientHeight || 240,
    });
    chartRef.current = chart;

    /* Area series (price) */
    const area = chart.addSeries(AreaSeries, {
      lineColor: "#4b4b4b",
      topColor: "rgba(0,0,0,0.07)",
      bottomColor: "rgba(0,0,0,0)",
      lineWidth: 1,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      crosshairMarkerBackgroundColor: "#1a1a1a",
      crosshairMarkerBorderColor: "#ffffff",
      crosshairMarkerBorderWidth: 2,
      lastValueVisible: true,
      priceLineVisible: false,
    });
    areaRef.current = area;

    /* Barrier lines (Accumulators only) */
    const upper = chart.addSeries(LineSeries, {
      color: "#5b9cf6",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      lastValueVisible: true,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });
    const lower = chart.addSeries(LineSeries, {
      color: "#5b9cf6",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      lastValueVisible: true,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });
    upperRef.current = upper;
    lowerRef.current = lower;

    const ro = new ResizeObserver(() => {
      if (!el || !chartRef.current) return;
      chartRef.current.applyOptions({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);

    const ws = new WebSocket(WS_URL);
    ws.onopen = () => {
      if (!mounted) return;
      ws.send(JSON.stringify({ ticks_history: symbol, count: 200, end: "latest", style: "ticks", subscribe: 1 }));
    };
    ws.onmessage = (evt) => {
      if (!mounted) return;
      try {
        const msg = JSON.parse(evt.data);
        if (msg.error) return;
        if (msg.msg_type === "history") {
          const { times, prices } = msg.history as { times: number[]; prices: number[] };
          const pts = times.map((t, i) => ({ time: t as UTCTimestamp, value: prices[i] }));
          if (areaRef.current && pts.length > 0) {
            areaRef.current.setData(pts);
            const last = prices[prices.length - 1];
            lastPriceRef.current = last;
            chartRef.current?.timeScale().fitContent();
          }
        }
        if (msg.msg_type === "tick") {
          const { epoch, quote } = msg.tick as { epoch: number; quote: number };
          areaRef.current?.update({ time: epoch as UTCTimestamp, value: quote });
          lastPriceRef.current = quote;

          /* Update barrier bands */
          if (showBarriers && upperRef.current && lowerRef.current) {
            const BARRIER_PCT = 0.00351; // typical 1s accumulator barrier
            const up  = +(quote * (1 + BARRIER_PCT)).toFixed(pip);
            const dn  = +(quote * (1 - BARRIER_PCT)).toFixed(pip);
            upperRef.current.update({ time: epoch as UTCTimestamp, value: up });
            lowerRef.current.update({ time: epoch as UTCTimestamp, value: dn });
          }
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
      areaRef.current  = null;
      upperRef.current = null;
      lowerRef.current = null;
    };
  }, [symbol, pip, showBarriers]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}

/* ─────────────────────────────────────────────────────────────────────
   LIVE PRICE HOOK
────────────────────────────────────────────────────────────────────── */
function useLivePrice(symbol: string) {
  const [price, setPrice]     = useState<number | null>(null);
  const [prevPrice, setPrev]  = useState<number | null>(null);
  const [openPrice, setOpen]  = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    setPrice(null); setPrev(null); setOpen(null);
    const ws = new WebSocket(WS_URL);
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
    const pct  = (diff / openPrice) * 100;
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
   BOTTOM SHEET
────────────────────────────────────────────────────────────────────── */
function BottomSheet({
  open, onClose, title, children,
}: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
    >
      <div
        className="w-full bg-white rounded-t-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: "78vh", animation: "sheet-up 0.2s cubic-bezier(0.22,1,0.36,1) both" }}
      >
        <div className="relative flex items-center justify-center px-4 pt-4 pb-3">
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-gray-200" />
          <span className="text-base font-bold text-gray-900">{title}</span>
          <button onClick={onClose} className="absolute right-4 w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="h-px bg-gray-100" />
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
      <style>{`@keyframes sheet-up{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   CONTRACT CARD
────────────────────────────────────────────────────────────────────── */
interface Contract {
  id: string; tradeType: string; subType: string; symbol: string;
  stake: number; payout: number; entryPrice: number;
  status: "open" | "won" | "lost"; expiresAt: number;
}

function ContractCard({ c, onClose }: { c: Contract; onClose: (id: string) => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (c.status !== "open") return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [c.status]);
  const secsLeft = Math.max(0, Math.round((c.expiresAt - now) / 1000));
  const isUp   = c.subType === "rise" || c.subType === "higher" || c.subType === "up" || c.subType === "buy";
  const isWon  = c.status === "won";
  const isDone = c.status !== "open";
  const profit = isWon ? c.payout - c.stake : -c.stake;

  return (
    <div className={`rounded-xl border p-3 flex items-center gap-3 transition-all ${
      isDone ? isWon ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50" : "border-gray-200 bg-white"
    }`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
        isUp ? "bg-green-100 text-green-600" : "bg-red-100 text-red-500"
      }`}>
        {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold text-gray-800">{c.tradeType} · {c.subType}</div>
        <div className="text-[11px] text-gray-400">{c.symbol}</div>
        <div className="text-[11px] text-gray-500 mt-0.5">
          Stake: <span className="font-semibold text-gray-700">${c.stake.toFixed(2)}</span>
          {" · "}Payout: <span className="font-semibold text-gray-700">${c.payout.toFixed(2)}</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {isDone ? (
          <>
            {isWon ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <AlertCircle className="w-4 h-4 text-red-500" />}
            <span className={`text-xs font-bold ${isWon ? "text-green-600" : "text-red-600"}`}>
              {isWon ? "+" : ""}{profit.toFixed(2)}
            </span>
          </>
        ) : (
          <div className="flex items-center gap-1 text-[10px] text-gray-400">
            <Clock className="w-3 h-3" />{secsLeft}s
          </div>
        )}
        <button onClick={() => onClose(c.id)} className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100">
          <X className="w-3 h-3 text-gray-400" />
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
  const cur = currency || "USD";

  /* ── Core state ─────────────────────────────────────────────────── */
  const [market,      setMarket]     = useState(MARKETS[0]);
  const [typeIdx,     setTypeIdx]    = useState(4); // default: Accumulators
  const [tabIdx,      setTabIdx]     = useState(0);
  const [stake,       setStake]      = useState(10);
  const [stakeStr,    setStakeStr]   = useState("10");
  const [growthRate,  setGrowthRate] = useState(3);
  const [multiplier,  setMultiplier] = useState(20);
  const [durUnitIdx,  setDurUnitIdx] = useState(0);
  const [durVal,      setDurVal]     = useState(5);
  const [hasTakeProfit, setHasTakeProfit] = useState(false);
  const [takeProfit,  setTakeProfit] = useState(100);
  const [takeProfitStr, setTakeProfitStr] = useState("100");
  const [contracts,   setContracts]  = useState<Contract[]>([]);
  const [buying,      setBuying]     = useState(false);

  /* ── Sheet visibility ────────────────────────────────────────────── */
  const [marketSheet,    setMarketSheet]    = useState(false);
  const [tradeTypeSheet, setTradeTypeSheet] = useState(false);
  const [durSheet,       setDurSheet]       = useState(false);
  const [growthSheet,    setGrowthSheet]    = useState(false);
  const [multSheet,      setMultSheet]      = useState(false);
  const [infoSheet,      setInfoSheet]      = useState(false);
  const [authSheet,      setAuthSheet]      = useState(false);
  const [riskSheet,      setRiskSheet]      = useState(false);

  const tradeType = TRADE_TYPES[typeIdx];
  const durUnit   = DURATION_UNITS[durUnitIdx];

  /* ── Reset tab when type changes ─────────────────────────────────── */
  useEffect(() => { setTabIdx(0); }, [typeIdx]);

  /* ── Live price ─────────────────────────────────────────────────── */
  const { price, change, dir } = useLivePrice(market.id);

  /* ── Stake helpers ───────────────────────────────────────────────── */
  const commitStake = useCallback(() => {
    const v = parseFloat(stakeStr);
    if (!isNaN(v) && v >= 0.35) { setStake(v); setStakeStr(String(v)); }
    else setStakeStr(String(stake));
  }, [stakeStr, stake]);

  const nudgeStake = useCallback((d: number) => {
    setStake(s => {
      const n = Math.max(0.35, +(s + d).toFixed(2));
      setStakeStr(String(n));
      return n;
    });
  }, []);

  /* ── Payout calc ─────────────────────────────────────────────────── */
  const maxPayout  = tradeType.maxPayout;
  const payoutMult = tradeType.id === "accumulators" ? 0 :
                     tradeType.id === "multipliers"  ? multiplier :
                     1.85;
  const estPayout = tradeType.id === "accumulators" ? maxPayout : +(stake * payoutMult).toFixed(2);
  const estProfit  = +(estPayout - stake).toFixed(2);
  const retPct     = stake > 0 ? Math.round((estProfit / stake) * 100) : 0;

  /* ── Duration label ──────────────────────────────────────────────── */
  const durLabel = `${durVal} ${
    durUnit.id === "t" ? "tick" + (durVal !== 1 ? "s" : "")
    : durUnit.label.toLowerCase().replace(/s$/, "") + (durVal !== 1 ? "s" : "")
  }`;

  /* ── Barrier % for display ───────────────────────────────────────── */
  const BARRIER_PCT = 0.351;
  const upperBarrier = price != null ? +(price * 1.00351).toFixed(market.pip) : null;
  const lowerBarrier = price != null ? +(price * 0.99649).toFixed(market.pip) : null;

  /* ── Buy handler ─────────────────────────────────────────────────── */
  const handleBuy = useCallback((subType: string) => {
    if (!isLoggedIn) { setAuthSheet(true); return; }
    if (!price || buying) return;
    setBuying(true);
    const durMs = tradeType.hasDuration
      ? Math.max(3000, durVal * (durUnit.id === "t" ? 1500 : durUnit.id === "m" ? 60000 : durUnit.id === "h" ? 3600000 : 86400000))
      : 15000;

    setTimeout(() => {
      const id = `C${Date.now()}`;
      setContracts(prev => [{
        id, tradeType: tradeType.label, subType, symbol: market.short,
        stake, payout: estPayout, entryPrice: price, status: "open", expiresAt: Date.now() + durMs,
      }, ...prev].slice(0, 6));
      setBuying(false);
      setTimeout(() => {
        const won = Math.random() > 0.42;
        setContracts(prev => prev.map(c => c.id === id ? { ...c, status: won ? "won" : "lost" } : c));
      }, durMs);
    }, 500);
  }, [isLoggedIn, price, buying, stake, estPayout, tradeType, market, durVal, durUnit]);

  /* ── Tab current sub-label ───────────────────────────────────────── */
  const currentTab = tradeType.tabs[tabIdx]?.label ?? "";
  const currentTabId = tradeType.tabs[tabIdx]?.id ?? "buy";

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">

      {/* ══════════════════════════════════════════════════════════════
          MARKET HEADER — matches DTrader header
      ══════════════════════════════════════════════════════════════ */}
      <button
        className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 hover:bg-gray-50 transition-colors"
        onClick={() => setMarketSheet(true)}
      >
        {/* Market icon */}
        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
          <Activity className="w-5 h-5 text-gray-600" />
        </div>
        <div className="flex-1 text-left">
          <div className="font-bold text-gray-900 text-sm">{market.label}</div>
          <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
            {price != null ? (
              <>
                <span>{price.toFixed(market.pip)}</span>
                <span className={change.dir === "up" ? "text-green-500" : change.dir === "down" ? "text-red-500" : "text-gray-400"}>
                  {change.dir === "up" ? "▲" : change.dir === "down" ? "▼" : "●"} {change.val} ({change.pct}%)
                </span>
              </>
            ) : (
              <span className="text-gray-400">Loading…</span>
            )}
          </div>
        </div>
        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </button>

      {/* ══════════════════════════════════════════════════════════════
          CHART AREA
      ══════════════════════════════════════════════════════════════ */}
      <div className="bg-white relative" style={{ height: 240 }}>
        <TradingChart
          symbol={market.id}
          pip={market.pip}
          showBarriers={tradeType.id === "accumulators"}
        />

        {/* Barrier labels overlay — only for Accumulators, matching screenshot */}
        {tradeType.id === "accumulators" && upperBarrier && lowerBarrier && (
          <div className="absolute right-16 inset-y-0 flex flex-col justify-center pointer-events-none gap-1">
            <div className="text-[11px] font-bold text-[#5b9cf6] bg-white/80 px-1 rounded">
              +{BARRIER_PCT.toFixed(3)}
            </div>
            <div className="text-[11px] font-bold text-[#5b9cf6] bg-white/80 px-1 rounded">
              -{BARRIER_PCT.toFixed(3)}
            </div>
          </div>
        )}

        {/* Live price badge */}
        {price != null && (
          <div className={`absolute right-1 top-1/2 -translate-y-1/2 px-2 py-1 rounded text-white text-xs font-bold ${
            dir === "up" ? "bg-green-500" : dir === "down" ? "bg-red-500" : "bg-gray-700"
          }`}>
            {price.toFixed(market.pip)}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          TRADE PANEL — scrollable white panel, DTrader style
      ══════════════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto bg-white">

        {/* "Learn about this trade type" link */}
        <div className="px-4 pt-3 pb-2">
          <button
            className="text-xs text-gray-500 underline hover:text-gray-700"
            onClick={() => setInfoSheet(true)}
          >
            Learn about this trade type
          </button>
        </div>

        {/* ── Trade type row — "Accumulators >" with badge ──────── */}
        <div className="border-t border-gray-100">
          <button
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors"
            onClick={() => setTradeTypeSheet(true)}
          >
            {/* Icon */}
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
              {tradeType.id === "accumulators" ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-600">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
              ) : tradeType.id === "rise_fall" ? (
                <TrendingUp className="w-4 h-4 text-gray-600" />
              ) : tradeType.id === "multipliers" ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-600">
                  <line x1="5" y1="12" x2="19" y2="12" /><line x1="12" y1="5" x2="12" y2="19" />
                </svg>
              ) : (
                <Activity className="w-4 h-4 text-gray-600" />
              )}
            </div>

            <span className="flex-1 text-left text-sm font-semibold text-gray-800">{tradeType.label}</span>

            <div className="flex items-center gap-2">
              {/* Growth rate badge (Accumulators) */}
              {tradeType.hasGrowthRate && (
                <span className="text-sm font-bold text-gray-700">{growthRate}%</span>
              )}
              {/* Multiplier badge */}
              {tradeType.hasMultiplier && (
                <span className="text-sm font-bold text-gray-700">×{multiplier}</span>
              )}
              {/* Duration badge (Rise/Fall etc.) */}
              {tradeType.hasDuration && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{durLabel}</span>
              )}
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
          </button>
        </div>

        {/* ── Sub-tabs for multi-outcome types (Rise/Fall, etc.) ─── */}
        {tradeType.hasTabs && tradeType.tabs.length > 0 && (
          <div className="border-t border-gray-100 px-4 py-3">
            <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-xl">
              {tradeType.tabs.map((t, i) => (
                <button
                  key={t.id}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                    i === tabIdx
                      ? "bg-white shadow-sm " + (t.id.includes("rise") || t.id.includes("higher") || t.id.includes("touch") || t.id.includes("up") || t.id.includes("even") || t.id.includes("over") || t.id.includes("matches") ? "text-[#22C55E]" : "text-[#EF4444]")
                      : "text-gray-500"
                  }`}
                  onClick={() => setTabIdx(i)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Stake row: "- 10 + Stake" — matches DTrader exactly ── */}
        <div className="border-t border-gray-100">
          <div className="flex items-center px-4 py-3.5 gap-3">
            <button
              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 flex-shrink-0"
              onClick={() => nudgeStake(-1)}
            >
              <Minus className="w-3.5 h-3.5 text-gray-700" />
            </button>

            <div className="flex-1 flex items-center justify-center gap-1">
              <input
                type="number"
                value={stakeStr}
                onChange={e => setStakeStr(e.target.value)}
                onBlur={commitStake}
                className="w-20 text-center text-xl font-bold text-gray-900 bg-transparent outline-none border-none"
                min={0.35}
                step={1}
              />
              <span className="text-sm text-gray-400 font-medium">{cur}</span>
            </div>

            <button
              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 flex-shrink-0"
              onClick={() => nudgeStake(1)}
            >
              <Plus className="w-3.5 h-3.5 text-gray-700" />
            </button>

            <span className="text-sm font-semibold text-gray-500 flex-shrink-0">Stake</span>
          </div>
        </div>

        {/* ── Take Profit row — checkbox style, matches DTrader ──── */}
        {tradeType.hasTakeProfit && (
          <div className="border-t border-gray-100">
            <div className="flex items-center px-4 py-3.5 gap-3">
              <button
                className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  hasTakeProfit ? "bg-green-500 border-green-500" : "border-gray-400 bg-white"
                }`}
                onClick={() => setHasTakeProfit(p => !p)}
              >
                {hasTakeProfit && <Check className="w-3 h-3 text-white" />}
              </button>
              <span className="flex-1 text-sm font-medium text-gray-700">Take profit</span>
              {hasTakeProfit && (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={takeProfitStr}
                    onChange={e => setTakeProfitStr(e.target.value)}
                    onBlur={() => {
                      const v = parseFloat(takeProfitStr);
                      if (!isNaN(v) && v > 0) setTakeProfit(v);
                      else setTakeProfitStr(String(takeProfit));
                    }}
                    className="w-16 text-right text-sm font-semibold text-gray-900 bg-transparent outline-none border-b border-gray-300"
                  />
                  <span className="text-xs text-gray-500">{cur}</span>
                </div>
              )}
              <button onClick={() => setInfoSheet(true)} className="ml-1">
                <Info className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
        )}

        {/* ── Multiplier picker row ──────────────────────────────── */}
        {tradeType.hasMultiplier && (
          <div className="border-t border-gray-100">
            <button
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50"
              onClick={() => setMultSheet(true)}
            >
              <span className="text-sm font-medium text-gray-700">Multiplier</span>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-gray-900">×{multiplier}</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </button>
          </div>
        )}

        {/* ── Growth rate row (Accumulators) ──────────────────────── */}
        {tradeType.hasGrowthRate && (
          <div className="border-t border-gray-100">
            <button
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50"
              onClick={() => setGrowthSheet(true)}
            >
              <span className="text-sm font-medium text-gray-700">Growth rate</span>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-gray-900">{growthRate}%</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </button>
          </div>
        )}

        {/* ── Max. payout / payout info row — DTrader layout ─────── */}
        <div className="border-t border-gray-100 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Max. payout</span>
            <div className="text-right">
              <div className="text-sm font-bold text-gray-900">
                {tradeType.id === "accumulators"
                  ? `${maxPayout.toLocaleString("en-AU", { minimumFractionDigits: 2 })} ${cur}`
                  : `${estPayout.toFixed(2)} ${cur}`
                }
              </div>
              {tradeType.id !== "accumulators" && (
                <div className="text-xs text-green-600 font-medium">+{retPct}% return</div>
              )}
              {tradeType.id === "accumulators" && (
                <div className="text-xs text-gray-500">{Math.round(maxPayout / (stake * growthRate / 100))} ticks</div>
              )}
            </div>
          </div>
        </div>

        {/* ── Balance strip ──────────────────────────────────────── */}
        {isLoggedIn && balance != null && (
          <div className="border-t border-gray-100 px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs text-gray-500">Balance</span>
            <span className="text-sm font-bold text-gray-800">{balance.toFixed(2)} {cur}</span>
          </div>
        )}

        {/* ── Buttons — Risk Disclaimer + Buy ─────────────────────── */}
        <div className="border-t border-gray-100 px-4 pt-3 pb-5 flex flex-col gap-2">

          {/* Risk Disclaimer button — amber, matches screenshot */}
          <button
            className="w-full py-3 rounded-lg font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ backgroundColor: "#FFCD00", color: "#1a1a1a" }}
            onClick={() => setRiskSheet(true)}
          >
            Risk Disclaimer
          </button>

          {/* BUY / RISE+FALL buttons */}
          {tradeType.hasTabs && tradeType.tabs.length >= 2 ? (
            <div className="grid grid-cols-2 gap-2">
              {/* Sell/Fall side */}
              <button
                disabled={buying || !price}
                className="flex flex-col items-center justify-center gap-1 py-3.5 rounded-2xl font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50"
                style={{ backgroundColor: "#EF4444" }}
                onClick={() => {
                  const sellTab = tradeType.tabs.find(t =>
                    t.id === "fall" || t.id === "lower" || t.id === "no_touch" || t.id === "down" || t.id === "odd" || t.id === "differs" || t.id === "under"
                  );
                  handleBuy(sellTab?.id ?? tradeType.tabs[1].id);
                }}
              >
                {buying ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingDown className="w-4 h-4" />}
                <span className="text-sm">{tradeType.sellLabel}</span>
                <span className="text-xs opacity-70">${stake.toFixed(2)}</span>
              </button>

              {/* Buy/Rise side */}
              <button
                disabled={buying || !price}
                className="flex flex-col items-center justify-center gap-1 py-3.5 rounded-2xl font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50"
                style={{ backgroundColor: "#22C55E" }}
                onClick={() => {
                  const buyTab = tradeType.tabs.find(t =>
                    t.id === "rise" || t.id === "higher" || t.id === "touch" || t.id === "up" || t.id === "even" || t.id === "matches" || t.id === "over"
                  );
                  handleBuy(buyTab?.id ?? tradeType.tabs[0].id);
                }}
              >
                {buying ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                <span className="text-sm">{tradeType.buyLabel}</span>
                <span className="text-xs opacity-70">${stake.toFixed(2)}</span>
              </button>
            </div>
          ) : (
            /* Single wide BUY button — Accumulators style */
            <button
              disabled={buying || !price}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-white font-bold text-base transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ backgroundColor: "#22C55E" }}
              onClick={() => handleBuy("buy")}
            >
              {buying ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              )}
              <span>Buy</span>
            </button>
          )}

          {!isLoggedIn && (
            <p className="text-center text-xs text-gray-400 mt-1">Log in with Deriv to place real trades</p>
          )}
        </div>

        {/* ── Open / recent contracts ──────────────────────────────── */}
        {contracts.length > 0 && (
          <div className="border-t border-gray-100 px-4 pb-6 pt-3 flex flex-col gap-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wide">
                <RefreshCw className="w-3.5 h-3.5" /> Positions
              </div>
              <span className="text-xs text-gray-400">{contracts.length}</span>
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

      {/* Market selector */}
      <BottomSheet open={marketSheet} onClose={() => setMarketSheet(false)} title="Select Market">
        <div className="flex flex-col py-2">
          {MARKETS.map(m => (
            <button
              key={m.id}
              className={`flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors ${m.id === market.id ? "bg-green-50" : ""}`}
              onClick={() => { setMarket(m); setMarketSheet(false); }}
            >
              <span className={`text-sm font-semibold ${m.id === market.id ? "text-green-600" : "text-gray-800"}`}>{m.label}</span>
              {m.id === market.id && <Check className="w-4 h-4 text-green-500" />}
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* Trade type selector */}
      <BottomSheet open={tradeTypeSheet} onClose={() => setTradeTypeSheet(false)} title="Trade Types">
        <div className="flex flex-col py-2">
          {TRADE_TYPES.map((tt, i) => (
            <button
              key={tt.id}
              className={`flex items-center justify-between px-5 py-4 hover:bg-gray-50 border-b border-gray-50 transition-colors ${i === typeIdx ? "bg-green-50" : ""}`}
              onClick={() => { setTypeIdx(i); setTradeTypeSheet(false); }}
            >
              <div className="text-left">
                <div className={`text-sm font-bold ${i === typeIdx ? "text-green-600" : "text-gray-800"}`}>{tt.label}</div>
                <div className="text-xs text-gray-400 mt-0.5 max-w-[260px] leading-relaxed">{tt.description}</div>
              </div>
              {i === typeIdx && <Check className="w-4 h-4 text-green-500 flex-shrink-0 ml-2" />}
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* Duration picker */}
      <BottomSheet open={durSheet} onClose={() => setDurSheet(false)} title="Duration">
        <div className="px-4 py-4 flex flex-col gap-4">
          <div className="flex gap-1.5 p-1 bg-gray-100 rounded-xl">
            {DURATION_UNITS.map((du, i) => (
              <button
                key={du.id}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${i === durUnitIdx ? "bg-white text-green-600 shadow-sm" : "text-gray-500"}`}
                onClick={() => setDurUnitIdx(i)}
              >
                {du.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-5 gap-2">
            {DURATION_UNITS[durUnitIdx].values.map(v => (
              <button
                key={v}
                className={`py-3 rounded-xl text-sm font-bold ${v === durVal ? "bg-green-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                onClick={() => setDurVal(v)}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
            <button className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center" onClick={() => setDurVal(v => Math.max(1, v - 1))}>
              <Minus className="w-4 h-4" />
            </button>
            <div className="flex-1 text-center text-2xl font-bold">{durVal} <span className="text-sm text-gray-400 font-normal">{DURATION_UNITS[durUnitIdx].label.toLowerCase()}</span></div>
            <button className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center" onClick={() => setDurVal(v => Math.min(DURATION_UNITS[durUnitIdx].values.at(-1)!, v + 1))}>
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <button className="w-full py-4 rounded-2xl bg-green-500 text-white font-bold" onClick={() => setDurSheet(false)}>
            Confirm · {durLabel}
          </button>
        </div>
      </BottomSheet>

      {/* Growth rate picker */}
      <BottomSheet open={growthSheet} onClose={() => setGrowthSheet(false)} title="Growth Rate">
        <div className="px-4 py-4 flex flex-col gap-4">
          <div className="grid grid-cols-5 gap-2">
            {GROWTH_RATES.map(r => (
              <button
                key={r}
                className={`py-4 rounded-xl text-sm font-bold ${r === growthRate ? "bg-green-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                onClick={() => setGrowthRate(r)}
              >
                {r}%
              </button>
            ))}
          </div>
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-xs text-blue-700 leading-relaxed">
              Your stake will grow at <strong>{growthRate}%</strong> per tick as long as the spot price remains within ±{BARRIER_PCT}% from the previous spot.
            </p>
          </div>
          <button className="w-full py-4 rounded-2xl bg-green-500 text-white font-bold" onClick={() => setGrowthSheet(false)}>
            Confirm · {growthRate}%
          </button>
        </div>
      </BottomSheet>

      {/* Multiplier picker */}
      <BottomSheet open={multSheet} onClose={() => setMultSheet(false)} title="Multiplier">
        <div className="px-4 py-4 flex flex-col gap-4">
          <div className="grid grid-cols-4 gap-2">
            {MULTIPLIERS.map(m => (
              <button
                key={m}
                className={`py-4 rounded-xl text-sm font-bold ${m === multiplier ? "bg-green-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                onClick={() => setMultiplier(m)}
              >
                ×{m}
              </button>
            ))}
          </div>
          <button className="w-full py-4 rounded-2xl bg-green-500 text-white font-bold" onClick={() => setMultSheet(false)}>
            Confirm · ×{multiplier}
          </button>
        </div>
      </BottomSheet>

      {/* Info / about sheet */}
      <BottomSheet open={infoSheet} onClose={() => setInfoSheet(false)} title={tradeType.label}>
        <div className="px-5 py-5">
          <p className="text-sm text-gray-700 leading-relaxed">{tradeType.description}</p>
          {tradeType.id === "accumulators" && (
            <div className="mt-4 space-y-3">
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">How it works</div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Each tick the spot price stays within the ±{BARRIER_PCT}% barrier range, your stake grows by the growth rate ({growthRate}%).
                  The contract closes when the price exits the range, or when you click Sell.
                </p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="text-xs font-bold text-blue-500 uppercase tracking-wide mb-1">Max Payout</div>
                <p className="text-sm text-blue-700">{maxPayout.toLocaleString()} {cur}</p>
              </div>
            </div>
          )}
        </div>
      </BottomSheet>

      {/* Risk disclaimer sheet */}
      <BottomSheet open={riskSheet} onClose={() => setRiskSheet(false)} title="Risk Disclaimer">
        <div className="px-5 py-5 space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <p className="text-sm font-bold text-yellow-800 mb-2">Important Risk Warning</p>
            <p className="text-xs text-yellow-700 leading-relaxed">
              Trading binary options involves significant risk of loss and is not suitable for all investors.
              The high leverage associated with trading can work against you as well as for you.
              Before using TradeX you should carefully consider your investment objectives, level of experience, and risk appetite.
            </p>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            The possibility exists that you could sustain a loss of some or all of your initial investment and therefore you should not invest money that you cannot afford to lose.
            You should be aware of all the risks associated with trading and seek advice from an independent financial advisor if you have any doubts.
          </p>
          <button
            className="w-full py-4 rounded-2xl font-bold text-sm"
            style={{ backgroundColor: "#FFCD00", color: "#1a1a1a" }}
            onClick={() => setRiskSheet(false)}
          >
            I Understand
          </button>
        </div>
      </BottomSheet>

      {/* Auth modal */}
      <AuthGateModal open={authSheet} onClose={() => setAuthSheet(false)} />
    </div>
  );
}
