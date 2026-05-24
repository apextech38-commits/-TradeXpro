import {
  useState, useEffect, useRef, useCallback, useMemo,
} from "react";
import {
  X, ChevronDown, Plus, Minus, Check,
  TrendingUp, TrendingDown, Clock, AlertCircle, CheckCircle2,
  Flame,
} from "lucide-react";
import AuthGateModal from "@/components/AuthGateModal";
import { useAuth, DERIV_APP_ID } from "@/context/AuthContext";
import {
  createChart, ColorType, AreaSeries, LineSeries, LineStyle,
} from "lightweight-charts";
import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";

const WS_URL = `wss://ws.binaryws.com/websockets/v3?app_id=${DERIV_APP_ID}`;

/* ─────────────────────────────────────────────────────────────────────
   TRADE TYPE DEFINITIONS — mirrors DTrader taxonomy
────────────────────────────────────────────────────────────────────── */
interface TradeType {
  id: string;
  label: string;
  isPopular?: boolean;
  isHot?: boolean;
  hasTabs: boolean;
  tabs: { id: string; label: string; color: "buy" | "sell" }[];
  hasDuration: boolean;
  hasBarrier: boolean;
  hasGrowthRate: boolean;
  hasTakeProfit: boolean;
  hasMultiplier: boolean;
  hasAllowEquals?: boolean;
  maxPayout: number;
}

const TRADE_TYPES: TradeType[] = [
  {
    id: "accumulators",
    label: "Accumulators",
    isHot: true,
    hasTabs: false,
    tabs: [],
    hasDuration: false,
    hasBarrier: false,
    hasGrowthRate: true,
    hasTakeProfit: true,
    hasMultiplier: false,
    maxPayout: 6000,
  },
  {
    id: "rise_fall",
    label: "Rise/Fall",
    isPopular: true,
    hasTabs: true,
    tabs: [
      { id: "rise", label: "Rise", color: "buy" },
      { id: "fall", label: "Fall", color: "sell" },
    ],
    hasDuration: true,
    hasBarrier: false,
    hasGrowthRate: false,
    hasTakeProfit: false,
    hasMultiplier: false,
    hasAllowEquals: true,
    maxPayout: 50000,
  },
  {
    id: "higher_lower",
    label: "Higher/Lower",
    hasTabs: true,
    tabs: [
      { id: "higher", label: "Higher", color: "buy" },
      { id: "lower", label: "Lower", color: "sell" },
    ],
    hasDuration: true,
    hasBarrier: true,
    hasGrowthRate: false,
    hasTakeProfit: false,
    hasMultiplier: false,
    maxPayout: 50000,
  },
  {
    id: "touch",
    label: "Touch/No Touch",
    hasTabs: true,
    tabs: [
      { id: "touch", label: "Touch", color: "buy" },
      { id: "no_touch", label: "No Touch", color: "sell" },
    ],
    hasDuration: true,
    hasBarrier: true,
    hasGrowthRate: false,
    hasTakeProfit: false,
    hasMultiplier: false,
    maxPayout: 50000,
  },
  {
    id: "multipliers",
    label: "Multipliers",
    hasTabs: true,
    tabs: [
      { id: "up", label: "Up", color: "buy" },
      { id: "down", label: "Down", color: "sell" },
    ],
    hasDuration: false,
    hasBarrier: false,
    hasGrowthRate: false,
    hasTakeProfit: true,
    hasMultiplier: true,
    maxPayout: 100000,
  },
  {
    id: "digits",
    label: "Digits",
    hasTabs: true,
    tabs: [
      { id: "even", label: "Even", color: "buy" },
      { id: "odd", label: "Odd", color: "sell" },
    ],
    hasDuration: true,
    hasBarrier: false,
    hasGrowthRate: false,
    hasTakeProfit: false,
    hasMultiplier: false,
    maxPayout: 50000,
  },
];

const MARKETS = [
  { label: "Volatility 100 (1s) Index", short: "V100(1s)", id: "1HZ100V", pip: 2 },
  { label: "Volatility 100 Index",       short: "V 100",    id: "R_100",   pip: 2 },
  { label: "Volatility 75 (1s) Index",   short: "V75(1s)",  id: "1HZ75V",  pip: 4 },
  { label: "Volatility 75 Index",        short: "V 75",     id: "R_75",    pip: 4 },
  { label: "Volatility 50 (1s) Index",   short: "V50(1s)",  id: "1HZ50V",  pip: 4 },
  { label: "Volatility 50 Index",        short: "V 50",     id: "R_50",    pip: 4 },
  { label: "Volatility 25 (1s) Index",   short: "V25(1s)",  id: "1HZ25V",  pip: 4 },
  { label: "Volatility 25 Index",        short: "V 25",     id: "R_25",    pip: 4 },
  { label: "Volatility 10 (1s) Index",   short: "V10(1s)",  id: "1HZ10V",  pip: 3 },
  { label: "Volatility 10 Index",        short: "V 10",     id: "R_10",    pip: 3 },
];

const GROWTH_RATES = [1, 2, 3, 4, 5];
const MULTIPLIERS  = [10, 20, 30, 40, 50, 100, 200, 500];
const STAKE_PRESETS = [1, 5, 10, 20, 50, 100, 200, 500];
const BARRIER_PRESETS = [
  { label: "+0.01", value: "+0.01" },
  { label: "+0.02", value: "+0.02" },
  { label: "+0.05", value: "+0.05" },
  { label: "+0.10", value: "+0.10" },
  { label: "+0.20", value: "+0.20" },
  { label: "+0.50", value: "+0.50" },
];
const DURATION_UNITS = [
  { id: "t", label: "Ticks",   presets: [1, 3, 5, 7, 10, 15, 20, 30, 50, 100] },
  { id: "s", label: "Seconds", presets: [15, 30, 45, 60, 90, 120, 180, 300] },
  { id: "m", label: "Minutes", presets: [1, 2, 3, 5, 10, 15, 30, 60] },
  { id: "h", label: "Hours",   presets: [1, 2, 3, 4, 6, 8, 12, 24] },
  { id: "d", label: "Days",    presets: [1, 2, 3, 5, 7, 14, 30] },
];

/* ─────────────────────────────────────────────────────────────────────
   LIVE PRICE HOOK
────────────────────────────────────────────────────────────────────── */
function useLivePrice(symbol: string) {
  const [price, setPrice]    = useState<number | null>(null);
  const [prevPrice, setPrev] = useState<number | null>(null);
  const [openPrice, setOpen] = useState<number | null>(null);

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

  const dir: "up" | "down" | "flat" =
    price != null && prevPrice != null
      ? price > prevPrice ? "up" : price < prevPrice ? "down" : "flat"
      : "flat";

  const change = useMemo(() => {
    if (price == null || openPrice == null) return { pct: "0.00", dir: "flat" as const };
    const diff = price - openPrice;
    const pct  = (diff / openPrice) * 100;
    return { pct: Math.abs(pct).toFixed(3), dir: diff > 0 ? "up" as const : diff < 0 ? "down" as const : "flat" as const };
  }, [price, openPrice]);

  return { price, change, dir };
}

/* ─────────────────────────────────────────────────────────────────────
   CHART
────────────────────────────────────────────────────────────────────── */
function TradingChart({ symbol, pip, showBarriers }: {
  symbol: string; pip: number; showBarriers: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const areaRef      = useRef<ISeriesApi<"Area"> | null>(null);
  const upperRef     = useRef<ISeriesApi<"Line"> | null>(null);
  const lowerRef     = useRef<ISeriesApi<"Line"> | null>(null);

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
        vertLine: { color: "rgba(0,0,0,0.15)", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#1a1a1a" },
        horzLine: { color: "rgba(0,0,0,0.15)", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#1a1a1a" },
      },
      rightPriceScale: { borderColor: "#f3f4f6", scaleMargins: { top: 0.15, bottom: 0.08 } },
      timeScale: { borderColor: "#f3f4f6", timeVisible: true, secondsVisible: false, rightOffset: 4, barSpacing: 6 },
      width:  el.clientWidth,
      height: el.clientHeight || 400,
    });
    chartRef.current = chart;

    const area = chart.addSeries(AreaSeries, {
      lineColor: "#4b4b4b", topColor: "rgba(0,0,0,0.06)", bottomColor: "rgba(0,0,0,0)",
      lineWidth: 1, crosshairMarkerVisible: true, crosshairMarkerRadius: 4,
      crosshairMarkerBackgroundColor: "#1a1a1a", crosshairMarkerBorderColor: "#ffffff",
      crosshairMarkerBorderWidth: 2, lastValueVisible: true, priceLineVisible: false,
    });
    areaRef.current = area;

    const upper = chart.addSeries(LineSeries, {
      color: "#2196f3", lineWidth: 1, lineStyle: LineStyle.Dashed,
      lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
    });
    const lower = chart.addSeries(LineSeries, {
      color: "#2196f3", lineWidth: 1, lineStyle: LineStyle.Dashed,
      lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
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
            chartRef.current?.timeScale().fitContent();
          }
        }
        if (msg.msg_type === "tick") {
          const { epoch, quote } = msg.tick as { epoch: number; quote: number };
          areaRef.current?.update({ time: epoch as UTCTimestamp, value: quote });
          if (showBarriers && upperRef.current && lowerRef.current) {
            const pct = 0.00351;
            upperRef.current.update({ time: epoch as UTCTimestamp, value: +(quote * (1 + pct)).toFixed(pip) });
            lowerRef.current.update({ time: epoch as UTCTimestamp, value: +(quote * (1 - pct)).toFixed(pip) });
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
   BOTTOM SHEET (mobile utility)
────────────────────────────────────────────────────────────────────── */
function BottomSheet({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
    >
      <div className="w-full bg-white rounded-t-2xl shadow-2xl flex flex-col max-h-[80vh]"
        style={{ animation: "sheet-up 0.22s cubic-bezier(0.22,1,0.36,1) both" }}>
        <div className="relative flex items-center justify-center px-4 pt-4 pb-3 shrink-0">
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-gray-200" />
          <span className="text-sm font-bold text-gray-900">{title}</span>
          <button onClick={onClose} className="absolute right-4 w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="h-px bg-gray-100 shrink-0" />
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
      <style>{`@keyframes sheet-up{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   PARAM ROW — the DTrader clickable parameter row pattern
   Label on left, value on right; clicking opens a popover / sheet
────────────────────────────────────────────────────────────────────── */
function ParamRow({ label, value, onClick, disabled = false, children, noBorder = false }: {
  label: string; value: string; onClick?: () => void;
  disabled?: boolean; children?: React.ReactNode; noBorder?: boolean;
}) {
  return (
    <div className={`relative ${noBorder ? "" : "border-b border-gray-100"}`}>
      <button
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        className={`w-full flex items-center justify-between px-4 py-3 min-h-[64px] text-left transition-colors ${
          disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-50 cursor-pointer"
        }`}
      >
        <span className="text-xs font-medium text-gray-500 leading-none">{label}</span>
        <span className="text-sm font-semibold text-gray-900 leading-none flex items-center gap-1">
          {value}
          {!disabled && onClick && <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
        </span>
      </button>
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   CHIP GRID — reusable chip selector grid (DTrader popover style)
────────────────────────────────────────────────────────────────────── */
function ChipGrid<T extends string | number>({
  values, selected, onSelect, format,
}: { values: T[]; selected: T; onSelect: (v: T) => void; format?: (v: T) => string; }) {
  return (
    <div className="flex flex-wrap gap-2 p-4">
      {values.map(v => (
        <button
          key={String(v)}
          onClick={() => onSelect(v)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
            v === selected
              ? "bg-[#ff444f] border-[#ff444f] text-white"
              : "bg-white border-gray-200 text-gray-700 hover:border-gray-400"
          }`}
        >
          {format ? format(v) : String(v)}
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   SEGMENTED CONTROL — DTrader trade-type-tabs style
────────────────────────────────────────────────────────────────────── */
function SegmentedControl({ tabs, selectedIdx, onSelect }: {
  tabs: { label: string; color: "buy" | "sell" }[];
  selectedIdx: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="flex mx-4 my-3 rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
      {tabs.map((tab, i) => (
        <button
          key={tab.label}
          onClick={() => onSelect(i)}
          className={`flex-1 py-2 text-xs font-bold tracking-wide transition-all ${
            selectedIdx === i
              ? tab.color === "buy"
                ? "bg-[#4bb4b3] text-white shadow-sm"
                : "bg-[#ec3f3f] text-white shadow-sm"
              : "bg-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   CONTRACT CARD — open / settled trade cards
────────────────────────────────────────────────────────────────────── */
interface Contract {
  id: string; tradeType: string; subType: string; symbol: string;
  stake: number; payout: number; status: "open" | "won" | "lost"; expiresAt: number;
}

function ContractCard({ c, onClose }: { c: Contract; onClose: (id: string) => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (c.status !== "open") return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [c.status]);
  const secsLeft = Math.max(0, Math.round((c.expiresAt - now) / 1000));
  const isUp  = ["rise", "higher", "up", "buy", "touch", "even"].includes(c.subType);
  const isWon = c.status === "won";
  const isDone = c.status !== "open";
  const profit = isWon ? c.payout - c.stake : -c.stake;

  return (
    <div className={`rounded-xl border p-3 flex items-center gap-3 text-left ${
      isDone ? (isWon ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50") : "border-gray-200 bg-white"
    }`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
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
      <div className="flex flex-col items-end gap-1 shrink-0">
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
  const [market,         setMarket]        = useState(MARKETS[0]);
  const [typeId,         setTypeId]        = useState("accumulators");
  const [tabIdx,         setTabIdx]        = useState(0);
  const [stake,          setStake]         = useState(10);
  const [stakeStr,       setStakeStr]      = useState("10");
  const [growthRate,     setGrowthRate]    = useState(3);
  const [multiplier,     setMultiplier]    = useState(20);
  const [durUnitIdx,     setDurUnitIdx]    = useState(0);
  const [durVal,         setDurVal]        = useState(5);
  const [barrier,        setBarrier]       = useState("+0.01");
  const [hasTakeProfit,  setHasTakeProfit] = useState(false);
  const [takeProfit,     setTakeProfit]    = useState(100);
  const [takeProfitStr,  setTpStr]         = useState("100");
  const [allowEquals,    setAllowEquals]   = useState(false);
  const [contracts,      setContracts]     = useState<Contract[]>([]);
  const [buying,         setBuying]        = useState(false);

  /* ── Sheet/popover visibility ─────────────────────────────────────── */
  const [marketSheet,   setMarketSheet]   = useState(false);
  const [durSheet,      setDurSheet]      = useState(false);
  const [stakePopover,  setStakePopover]  = useState(false);
  const [growthPopover, setGrowthPopover] = useState(false);
  const [multPopover,   setMultPopover]   = useState(false);
  const [barrierSheet,  setBarrierSheet]  = useState(false);
  const [authSheet,     setAuthSheet]     = useState(false);
  const [riskSheet,     setRiskSheet]     = useState(false);

  const tradeType = TRADE_TYPES.find(t => t.id === typeId) || TRADE_TYPES[0];
  const durUnit   = DURATION_UNITS[durUnitIdx];

  useEffect(() => { setTabIdx(0); }, [typeId]);

  const { price, change, dir } = useLivePrice(market.id);

  /* ── Stake helpers ────────────────────────────────────────────────── */
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

  /* ── Take Profit helpers ──────────────────────────────────────────── */
  const commitTp = useCallback(() => {
    const v = parseFloat(takeProfitStr);
    if (!isNaN(v) && v > 0) { setTakeProfit(v); setTpStr(String(v)); }
    else setTpStr(String(takeProfit));
  }, [takeProfitStr, takeProfit]);

  /* ── Payout calc ─────────────────────────────────────────────────── */
  const maxPayout   = tradeType.maxPayout;
  const payoutMult  = tradeType.id === "accumulators" ? 0 : tradeType.id === "multipliers" ? multiplier : 1.85;
  const estPayout   = tradeType.id === "accumulators" ? maxPayout : +(stake * payoutMult).toFixed(2);
  const estProfit   = +(estPayout - stake).toFixed(2);
  const retPct      = stake > 0 ? Math.round((estProfit / stake) * 100) : 0;

  /* ── Duration label ───────────────────────────────────────────────── */
  const durLabel = `${durVal} ${durUnit.label.toLowerCase().replace(/s$/, "") + (durVal !== 1 ? "s" : "")}`;

  /* ── Barrier display ──────────────────────────────────────────────── */
  const barrierPct = 0.351;
  const upperBarrier = price != null ? +(price * 1.00351).toFixed(market.pip) : null;
  const lowerBarrier = price != null ? +(price * 0.99649).toFixed(market.pip) : null;

  /* ── Buy handler ──────────────────────────────────────────────────── */
  const handleBuy = useCallback((subType: string) => {
    if (!isLoggedIn) { setAuthSheet(true); return; }
    if (!price || buying) return;
    setBuying(true);
    const durMs = tradeType.hasDuration
      ? Math.max(3000, durVal * (
          durUnit.id === "t" ? 1500 :
          durUnit.id === "s" ? 1000 :
          durUnit.id === "m" ? 60000 :
          durUnit.id === "h" ? 3600000 : 86400000
        ))
      : 15000;

    setTimeout(() => {
      const id = `C${Date.now()}`;
      const won = Math.random() > 0.45;
      setContracts(prev => [{
        id,
        tradeType: tradeType.label,
        subType,
        symbol: market.short,
        stake,
        payout: estPayout,
        status: "open",
        expiresAt: Date.now() + durMs,
      }, ...prev].slice(0, 10));
      setBuying(false);

      setTimeout(() => {
        setContracts(prev => prev.map(c =>
          c.id === id ? { ...c, status: won ? "won" : "lost" } : c
        ));
      }, durMs);
    }, 400);
  }, [isLoggedIn, price, buying, tradeType, durVal, durUnit, market, stake, estPayout]);

  /* ── Stake popover ref (close on outside click) ─────────────────── */
  const stakePopRef = useRef<HTMLDivElement>(null);
  const growthPopRef = useRef<HTMLDivElement>(null);
  const multPopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!stakePopover && !growthPopover && !multPopover) return;
    const h = (e: MouseEvent) => {
      if (stakePopover && stakePopRef.current && !stakePopRef.current.contains(e.target as Node)) setStakePopover(false);
      if (growthPopover && growthPopRef.current && !growthPopRef.current.contains(e.target as Node)) setGrowthPopover(false);
      if (multPopover && multPopRef.current && !multPopRef.current.contains(e.target as Node)) setMultPopover(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [stakePopover, growthPopover, multPopover]);

  /* ─────────────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-full overflow-hidden bg-white" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── TOP HEADER: Trade type chips + Account ────────────────── */}
      <div className="flex items-center border-b border-gray-100 bg-white shrink-0" style={{ minHeight: "56px" }}>

        {/* Trade type chips — scrollable, no scrollbar */}
        <div className="flex items-center gap-3 px-4 overflow-x-auto no-scrollbar flex-1 min-w-0" style={{ minHeight: "56px" }}>
          {TRADE_TYPES.map(tt => (
            <button
              key={tt.id}
              onClick={() => setTypeId(tt.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap shrink-0 transition-all border ${
                typeId === tt.id
                  ? "bg-[#ff444f] border-[#ff444f] text-white shadow-sm"
                  : "bg-transparent border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-800"
              }`}
            >
              {tt.isHot && (
                <Flame className={`w-3.5 h-3.5 ${typeId === tt.id ? "text-orange-200" : "text-orange-400"}`} />
              )}
              {tt.label}
            </button>
          ))}
        </div>

        {/* Account header */}
        <div className="shrink-0 flex items-center gap-2 pr-4 pl-2 border-l border-gray-100 ml-2">
          {isLoggedIn ? (
            <>
              <div className="text-right">
                <div className="text-[10px] text-gray-400 leading-none">Real account</div>
                <div className="text-sm font-bold text-gray-900 leading-tight mt-0.5">
                  {balance ?? "0.00"} {cur}
                </div>
              </div>
              <button className="bg-[#ff444f] text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-[#d93d47] transition-colors">
                Deposit
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAuthSheet(true)}
                className="text-xs font-bold text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Log in
              </button>
              <button
                onClick={() => setAuthSheet(true)}
                className="text-xs font-bold text-white bg-[#ff444f] px-3 py-1.5 rounded-lg hover:bg-[#d93d47] transition-colors"
              >
                Sign up
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── MAIN GRID: Chart | Trade Params ───────────────────────── */}
      <div className="flex-1 overflow-hidden flex">

        {/* LEFT — Chart column */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden relative">
          {/* Market selector bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-white shrink-0">
            <button
              onClick={() => setMarketSheet(true)}
              className="flex items-center gap-2 hover:bg-gray-50 rounded-lg px-2 py-1.5 transition-colors"
            >
              <div>
                <div className="text-sm font-bold text-gray-900 leading-none">{market.short}</div>
                <div className="text-[11px] text-gray-400 leading-none mt-0.5">{market.label}</div>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
            <div className="text-right">
              {price != null ? (
                <>
                  <div className={`text-base font-bold font-mono leading-none ${
                    dir === "up" ? "text-[#4bb4b3]" : dir === "down" ? "text-[#ec3f3f]" : "text-gray-900"
                  }`}>
                    {price.toFixed(market.pip)}
                  </div>
                  <div className={`text-[11px] font-medium leading-none mt-0.5 ${
                    change.dir === "up" ? "text-[#4bb4b3]" : change.dir === "down" ? "text-[#ec3f3f]" : "text-gray-400"
                  }`}>
                    {change.dir === "up" ? "+" : change.dir === "down" ? "-" : ""}{change.pct}%
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-300 animate-pulse">Loading…</div>
              )}
            </div>
          </div>

          {/* Accumulator barrier labels on chart */}
          {tradeType.id === "accumulators" && upperBarrier && lowerBarrier && (
            <div className="absolute top-16 right-0 z-10 flex flex-col items-end gap-1 pointer-events-none pr-[60px]">
              <div className="bg-[#e3f0ff] text-[#2196f3] text-[10px] font-bold px-2 py-0.5 rounded">
                +{barrierPct}% {upperBarrier}
              </div>
              <div className="bg-[#e3f0ff] text-[#2196f3] text-[10px] font-bold px-2 py-0.5 rounded">
                -{barrierPct}% {lowerBarrier}
              </div>
            </div>
          )}

          {/* Chart */}
          <div className="flex-1 overflow-hidden">
            <TradingChart
              symbol={market.id}
              pip={market.pip}
              showBarriers={tradeType.id === "accumulators"}
            />
          </div>

          {/* Open contracts panel at bottom of chart (desktop) */}
          {contracts.length > 0 && (
            <div className="border-t border-gray-100 max-h-48 overflow-y-auto bg-white shrink-0">
              <div className="px-3 py-2 flex flex-col gap-2">
                {contracts.map(c => (
                  <ContractCard key={c.id} c={c} onClose={id => setContracts(prev => prev.filter(x => x.id !== id))} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — Trade Parameters Panel (28rem fixed, matches DTrader) */}
        <div
          className="shrink-0 flex flex-col border-l border-gray-100 bg-white overflow-y-auto"
          style={{ width: "min(28rem, 100vw)" }}
        >
          {/* Trade type tabs (Rise/Fall, Higher/Lower, etc.) */}
          {tradeType.hasTabs && tradeType.tabs.length > 1 && (
            <SegmentedControl
              tabs={tradeType.tabs}
              selectedIdx={tabIdx}
              onSelect={setTabIdx}
            />
          )}

          {/* ── PARAMETERS ──────────────────────────────────────── */}

          {/* Duration */}
          {tradeType.hasDuration && (
            <div ref={null} className="relative">
              <ParamRow
                label="Duration"
                value={durLabel}
                onClick={() => setDurSheet(true)}
              />
            </div>
          )}

          {/* Barrier */}
          {tradeType.hasBarrier && (
            <ParamRow
              label="Barrier"
              value={barrier}
              onClick={() => setBarrierSheet(true)}
            />
          )}

          {/* Stake — with inline minus/plus stepper + popover chips */}
          <div ref={stakePopRef} className="relative border-b border-gray-100">
            <div className="flex items-center justify-between px-4 min-h-[64px]">
              <span className="text-xs font-medium text-gray-500">Stake</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => nudgeStake(-1)}
                  className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
                >
                  <Minus className="w-3.5 h-3.5 text-gray-600" />
                </button>
                <button
                  onClick={() => setStakePopover(v => !v)}
                  className="flex items-center gap-1 hover:bg-gray-50 rounded-lg px-2 py-1 transition-colors"
                >
                  <input
                    value={stakeStr}
                    onChange={e => setStakeStr(e.target.value)}
                    onBlur={commitStake}
                    onFocus={e => e.target.select()}
                    onKeyDown={e => e.key === "Enter" && commitStake()}
                    className="w-20 text-sm font-bold text-gray-900 text-right bg-transparent focus:outline-none"
                    onClick={e => e.stopPropagation()}
                  />
                  <span className="text-xs text-gray-400 font-medium">{cur}</span>
                  <ChevronDown className="w-3 h-3 text-gray-400" />
                </button>
                <button
                  onClick={() => nudgeStake(1)}
                  className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-gray-600" />
                </button>
              </div>
            </div>
            {/* Stake popover chips */}
            {stakePopover && (
              <div className="absolute right-4 top-full z-20 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 min-w-[220px]">
                <ChipGrid
                  values={STAKE_PRESETS}
                  selected={stake}
                  onSelect={v => { setStake(v); setStakeStr(String(v)); setStakePopover(false); }}
                  format={v => `${v} ${cur}`}
                />
              </div>
            )}
          </div>

          {/* Multiplier */}
          {tradeType.hasMultiplier && (
            <div ref={multPopRef} className="relative border-b border-gray-100">
              <button
                onClick={() => setMultPopover(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 min-h-[64px] hover:bg-gray-50 transition-colors"
              >
                <span className="text-xs font-medium text-gray-500">Multiplier</span>
                <span className="text-sm font-bold text-gray-900 flex items-center gap-1">
                  x{multiplier}
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                </span>
              </button>
              {multPopover && (
                <div className="absolute right-4 top-full z-20 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 min-w-[220px]">
                  <ChipGrid
                    values={MULTIPLIERS}
                    selected={multiplier}
                    onSelect={v => { setMultiplier(v); setMultPopover(false); }}
                    format={v => `x${v}`}
                  />
                </div>
              )}
            </div>
          )}

          {/* Growth Rate */}
          {tradeType.hasGrowthRate && (
            <div ref={growthPopRef} className="relative border-b border-gray-100">
              <button
                onClick={() => setGrowthPopover(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 min-h-[64px] hover:bg-gray-50 transition-colors"
              >
                <span className="text-xs font-medium text-gray-500">Growth rate</span>
                <span className="text-sm font-bold text-gray-900 flex items-center gap-1">
                  {growthRate}%
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                </span>
              </button>
              {growthPopover && (
                <div className="absolute right-4 top-full z-20 bg-white border border-gray-200 rounded-xl shadow-lg mt-1">
                  <ChipGrid
                    values={GROWTH_RATES}
                    selected={growthRate}
                    onSelect={v => { setGrowthRate(v); setGrowthPopover(false); }}
                    format={v => `${v}%`}
                  />
                </div>
              )}
            </div>
          )}

          {/* Take Profit toggle + input */}
          {tradeType.hasTakeProfit && (
            <div className="border-b border-gray-100">
              <div className="flex items-center justify-between px-4 py-3 min-h-[64px]">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setHasTakeProfit(v => !v)}
                    className={`w-10 h-5 rounded-full transition-colors relative ${
                      hasTakeProfit ? "bg-[#ff444f]" : "bg-gray-200"
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                      hasTakeProfit ? "left-[calc(100%-18px)]" : "left-0.5"
                    }`} />
                  </button>
                  <span className="text-xs font-medium text-gray-500">Take profit</span>
                </div>
                {hasTakeProfit && (
                  <div className="flex items-center gap-1.5">
                    <input
                      value={takeProfitStr}
                      onChange={e => setTpStr(e.target.value)}
                      onBlur={commitTp}
                      onFocus={e => e.target.select()}
                      onKeyDown={e => e.key === "Enter" && commitTp()}
                      className="w-20 text-sm font-bold text-gray-900 text-right bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-[#ff444f]"
                    />
                    <span className="text-xs text-gray-400 font-medium">{cur}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Allow Equals (Rise/Fall) */}
          {tradeType.hasAllowEquals && (
            <div className="flex items-center justify-between px-4 py-3 min-h-[56px] border-b border-gray-100">
              <span className="text-xs font-medium text-gray-500">Allow equals</span>
              <button
                onClick={() => setAllowEquals(v => !v)}
                className={`w-10 h-5 rounded-full transition-colors relative ${
                  allowEquals ? "bg-[#ff444f]" : "bg-gray-200"
                }`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                  allowEquals ? "left-[calc(100%-18px)]" : "left-0.5"
                }`} />
              </button>
            </div>
          )}

          {/* ── Payout / Max Payout info row ─────────────────────── */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {tradeType.id === "accumulators" ? "Max. payout" : "Est. payout"}
            </span>
            <span className="text-sm font-bold text-gray-800">
              {tradeType.id === "accumulators"
                ? `${maxPayout.toLocaleString()} ${cur}`
                : `${estPayout.toFixed(2)} ${cur}`}
            </span>
          </div>

          {/* Stake recap line (DTrader shows "− 10 USD + Stake" style) */}
          {tradeType.id !== "accumulators" && (
            <div className="px-4 py-2 flex items-center gap-1.5 border-b border-gray-100">
              <span className="text-[11px] text-gray-400">−</span>
              <span className="text-xs font-semibold text-gray-600">{stake} {cur}</span>
              <span className="text-[11px] text-gray-300 mx-1">·</span>
              <span className="text-[11px] text-gray-400">+</span>
              <span className="text-xs font-semibold text-green-600">{estProfit.toFixed(2)} {cur}</span>
              <span className="text-[11px] text-gray-300 mx-1">·</span>
              <span className="text-[11px] text-gray-400">{retPct}% return</span>
            </div>
          )}

          {/* ── Risk Disclaimer (Accumulators) ───────────────────── */}
          {(tradeType.id === "accumulators" || tradeType.id === "multipliers") && (
            <div className="px-4 py-3 border-b border-gray-100">
              <button
                onClick={() => setRiskSheet(true)}
                className="w-full flex items-center gap-2 text-left"
              >
                <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <span className="text-amber-600 text-[10px] font-bold">!</span>
                </div>
                <span className="text-xs text-amber-700 font-medium">
                  Risk Disclaimer
                </span>
              </button>
            </div>
          )}

          {/* ── PURCHASE BUTTON(S) ──────────────────────────────── */}
          <div className="p-4 mt-auto shrink-0">
            {!tradeType.hasTabs || tradeType.tabs.length === 0 ? (
              /* Single "Buy" button (Accumulators, single-tab Digits) */
              <button
                onClick={() => handleBuy("buy")}
                disabled={buying || !price}
                className="w-full py-4 rounded-xl font-bold text-base text-white transition-all disabled:opacity-50 bg-[#4bb4b3] hover:bg-[#3da09f] active:scale-95"
              >
                {buying ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Buying…
                  </span>
                ) : (
                  <>
                    Buy
                    {estPayout > 0 && (
                      <span className="ml-2 text-sm font-normal opacity-80">
                        Payout: {estPayout.toFixed(2)} {cur}
                      </span>
                    )}
                  </>
                )}
              </button>
            ) : tradeType.tabs.length === 1 ? (
              /* Single-tab trade (shouldn't normally happen) */
              <button
                onClick={() => handleBuy(tradeType.tabs[0].id)}
                disabled={buying || !price}
                className="w-full py-4 rounded-xl font-bold text-base text-white bg-[#4bb4b3] hover:bg-[#3da09f] active:scale-95 disabled:opacity-50 transition-all"
              >
                {tradeType.tabs[0].label}
              </button>
            ) : (
              /* Two-button layout: Rise↑ / Fall↓ style */
              <div className="flex gap-2">
                {tradeType.tabs.map((tab, i) => (
                  <button
                    key={tab.id}
                    onClick={() => { setTabIdx(i); handleBuy(tab.id); }}
                    disabled={buying || !price}
                    className={`flex-1 py-4 rounded-xl font-bold text-sm text-white transition-all active:scale-95 disabled:opacity-50 ${
                      tab.color === "buy"
                        ? "bg-[#4bb4b3] hover:bg-[#3da09f]"
                        : "bg-[#ec3f3f] hover:bg-[#d03636]"
                    }`}
                  >
                    <span className="flex flex-col items-center gap-0.5">
                      <span>{tab.label}</span>
                      {tradeType.id !== "digits" && tradeType.id !== "touch" && (
                        <span className="text-[10px] font-normal opacity-80">
                          {estPayout.toFixed(2)} {cur}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Trade Footer info ───────────────────────────────── */}
          <div className="px-4 pb-4 text-[11px] text-gray-400 text-center">
            {tradeType.id === "accumulators" && (
              <p>Your stake grows by {growthRate}% per tick while the spot price remains within ±{barrierPct}% of the entry spot.</p>
            )}
            {tradeType.id === "multipliers" && (
              <p>Your profit/loss = position size × multiplier × price change. Losses are limited to your stake.</p>
            )}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          BOTTOM SHEETS
      ───────────────────────────────────────────────────────────── */}

      {/* Market selector */}
      <BottomSheet open={marketSheet} onClose={() => setMarketSheet(false)} title="Select Market">
        {MARKETS.map(m => (
          <button
            key={m.id}
            onClick={() => { setMarket(m); setMarketSheet(false); }}
            className={`w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${
              m.id === market.id ? "bg-[#fff5f5]" : ""
            }`}
          >
            <div className="text-left">
              <div className="text-sm font-semibold text-gray-800">{m.short}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">{m.label}</div>
            </div>
            {m.id === market.id && <Check className="w-4 h-4 text-[#ff444f]" />}
          </button>
        ))}
      </BottomSheet>

      {/* Duration selector */}
      <BottomSheet open={durSheet} onClose={() => setDurSheet(false)} title="Duration">
        <div className="p-4">
          <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
            {DURATION_UNITS.map((u, i) => (
              <button
                key={u.id}
                onClick={() => { setDurUnitIdx(i); setDurVal(u.presets[0]); }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors ${
                  durUnitIdx === i
                    ? "bg-[#ff444f] border-[#ff444f] text-white"
                    : "bg-white border-gray-200 text-gray-600 hover:border-gray-400"
                }`}
              >
                {u.label}
              </button>
            ))}
          </div>
          <ChipGrid
            values={durUnit.presets}
            selected={durVal}
            onSelect={v => { setDurVal(v); setDurSheet(false); }}
            format={v => `${v} ${durUnit.label.toLowerCase().replace(/s$/, "") + (v !== 1 ? "s" : "")}`}
          />
        </div>
      </BottomSheet>

      {/* Barrier selector */}
      <BottomSheet open={barrierSheet} onClose={() => setBarrierSheet(false)} title="Barrier">
        <div className="p-4">
          <div className="flex flex-wrap gap-2 mb-4">
            {["Above spot", "Below spot"].map(type => (
              <button
                key={type}
                className="px-3 py-1.5 rounded-full text-xs font-semibold border border-gray-200 text-gray-600 hover:border-gray-400"
              >
                {type}
              </button>
            ))}
          </div>
          <ChipGrid
            values={BARRIER_PRESETS.map(b => b.value)}
            selected={barrier}
            onSelect={v => { setBarrier(v); setBarrierSheet(false); }}
          />
        </div>
      </BottomSheet>

      {/* Risk disclaimer */}
      <BottomSheet open={riskSheet} onClose={() => setRiskSheet(false)} title="Risk Disclaimer">
        <div className="p-5 space-y-3">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <span className="text-amber-600 font-bold">!</span>
            </div>
            <div className="text-sm text-gray-700 leading-relaxed">
              {tradeType.id === "accumulators"
                ? "Accumulator contracts can result in rapid gains or complete loss of stake if the spot price exits the barrier range. Please trade responsibly."
                : "Multiplier contracts amplify both profits and losses. Your entire stake can be lost if the market moves against your position."}
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Options and CFDs are complex instruments and come with a high risk of losing money rapidly due to leverage.
          </p>
          <button
            onClick={() => setRiskSheet(false)}
            className="w-full py-3 bg-[#ff444f] text-white font-bold rounded-xl hover:bg-[#d93d47] transition-colors"
          >
            I understand
          </button>
        </div>
      </BottomSheet>

      {/* Auth gate */}
      <AuthGateModal open={authSheet} onClose={() => setAuthSheet(false)} />
    </div>
  );
}
