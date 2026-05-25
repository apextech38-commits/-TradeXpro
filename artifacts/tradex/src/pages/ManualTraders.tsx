import {
  useState, useEffect, useRef, useCallback, useMemo,
} from "react";
import {
  ChevronDown, X, Info, AlertTriangle, Check,
  TrendingUp, TrendingDown, Clock, CheckCircle2, AlertCircle,
} from "lucide-react";
import AuthGateModal from "@/components/AuthGateModal";
import { useAuth, DERIV_APP_ID } from "@/context/AuthContext";
import {
  createChart, ColorType, AreaSeries, LineSeries, LineStyle,
} from "lightweight-charts";
import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";

const WS_URL = `wss://ws.binaryws.com/websockets/v3?app_id=${DERIV_APP_ID}`;

/* ─────────────────────────────────────────────────────────────────────
   MARKETS
────────────────────────────────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────────────────────────────
   TRADE TYPES
────────────────────────────────────────────────────────────────────── */
interface TradeType {
  id: string;
  label: string;
  icon: string;
  hasDuration: boolean;
  hasBarrier: boolean;
  hasGrowthRate: boolean;
  hasTakeProfit: boolean;
  hasMultiplier: boolean;
  hasAllowEquals?: boolean;
  maxPayout: number;
  maxTicks?: number;
  buttonType: "single" | "dual";
  buyLabel: string;
  sellLabel?: string;
  buyColor: string;
  sellColor?: string;
}

const TRADE_TYPES: TradeType[] = [
  {
    id: "accumulators", label: "Accumulators", icon: "📈",
    hasDuration: false, hasBarrier: false, hasGrowthRate: true,
    hasTakeProfit: true, hasMultiplier: false, maxPayout: 6000, maxTicks: 85,
    buttonType: "single", buyLabel: "Buy", buyColor: "#00a79e",
  },
  {
    id: "rise_fall", label: "Rise/Fall", icon: "↕️",
    hasDuration: true, hasBarrier: false, hasGrowthRate: false,
    hasTakeProfit: false, hasMultiplier: false, hasAllowEquals: true, maxPayout: 50000,
    buttonType: "dual", buyLabel: "Rise", sellLabel: "Fall",
    buyColor: "#00a79e", sellColor: "#ec3f3f",
  },
  {
    id: "higher_lower", label: "Higher/Lower", icon: "⬆️",
    hasDuration: true, hasBarrier: true, hasGrowthRate: false,
    hasTakeProfit: false, hasMultiplier: false, maxPayout: 50000,
    buttonType: "dual", buyLabel: "Higher", sellLabel: "Lower",
    buyColor: "#00a79e", sellColor: "#ec3f3f",
  },
  {
    id: "touch", label: "Touch/No Touch", icon: "👆",
    hasDuration: true, hasBarrier: true, hasGrowthRate: false,
    hasTakeProfit: false, hasMultiplier: false, maxPayout: 50000,
    buttonType: "dual", buyLabel: "Touch", sellLabel: "No Touch",
    buyColor: "#00a79e", sellColor: "#ec3f3f",
  },
  {
    id: "multipliers", label: "Multipliers", icon: "✖️",
    hasDuration: false, hasBarrier: false, hasGrowthRate: false,
    hasTakeProfit: true, hasMultiplier: true, maxPayout: 100000,
    buttonType: "dual", buyLabel: "Up", sellLabel: "Down",
    buyColor: "#00a79e", sellColor: "#ec3f3f",
  },
  {
    id: "digits", label: "Even/Odd", icon: "🔢",
    hasDuration: true, hasBarrier: false, hasGrowthRate: false,
    hasTakeProfit: false, hasMultiplier: false, maxPayout: 50000,
    buttonType: "dual", buyLabel: "Even", sellLabel: "Odd",
    buyColor: "#00a79e", sellColor: "#ec3f3f",
  },
];

const GROWTH_RATES = [1, 2, 3, 4, 5];
const MULTIPLIERS  = [10, 20, 30, 40, 50, 100, 200, 500];
const DURATION_UNITS = [
  { id: "t", label: "Ticks",   presets: [1, 3, 5, 7, 10, 15, 20, 30, 50, 100] },
  { id: "s", label: "Seconds", presets: [15, 30, 45, 60, 90, 120, 180, 300] },
  { id: "m", label: "Minutes", presets: [1, 2, 3, 5, 10, 15, 30, 60] },
  { id: "h", label: "Hours",   presets: [1, 2, 3, 4, 6, 8, 12, 24] },
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
    if (price == null || openPrice == null) return { val: "0.00", pct: "0.000", dir: "flat" as const };
    const diff = price - openPrice;
    const pct  = (diff / openPrice) * 100;
    return {
      val: Math.abs(diff).toFixed(2),
      pct: Math.abs(pct).toFixed(2),
      dir: diff > 0 ? "up" as const : diff < 0 ? "down" as const : "flat" as const,
    };
  }, [price, openPrice]);

  return { price, change, dir };
}

/* ─────────────────────────────────────────────────────────────────────
   CHART — with blue barrier band zone (DTrader style)
────────────────────────────────────────────────────────────────────── */
function TradingChart({ symbol, pip, showBarriers, barrierPct }: {
  symbol: string; pip: number; showBarriers: boolean; barrierPct: number;
}) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const overlayRef    = useRef<HTMLDivElement>(null);
  const chartRef      = useRef<IChartApi | null>(null);
  const areaRef       = useRef<ISeriesApi<"Area"> | null>(null);
  const upperRef      = useRef<ISeriesApi<"Line"> | null>(null);
  const lowerRef      = useRef<ISeriesApi<"Line"> | null>(null);
  const lastPriceRef  = useRef<number | null>(null);
  const animFrameRef  = useRef<number>(0);

  const updateOverlay = useCallback(() => {
    if (!chartRef.current || !overlayRef.current || !lastPriceRef.current || !showBarriers) return;
    try {
      const price = lastPriceRef.current;
      const upper = price * (1 + barrierPct / 100);
      const lower = price * (1 - barrierPct / 100);
      const ps = chartRef.current.priceScale("right");
      const yUpper = ps.priceToCoordinate(upper);
      const yLower = ps.priceToCoordinate(lower);
      if (yUpper != null && yLower != null) {
        overlayRef.current.style.top    = `${yUpper}px`;
        overlayRef.current.style.height = `${Math.max(0, yLower - yUpper)}px`;
        overlayRef.current.style.opacity = "1";
      }
    } catch (_) {}
  }, [showBarriers, barrierPct]);

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
      rightPriceScale: {
        borderColor: "#f3f4f6",
        scaleMargins: { top: 0.18, bottom: 0.12 },
      },
      timeScale: {
        borderColor: "#f3f4f6",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 4,
        barSpacing: 6,
      },
      width:  el.clientWidth,
      height: el.clientHeight || 300,
    });
    chartRef.current = chart;

    const area = chart.addSeries(AreaSeries, {
      lineColor: "#374151",
      topColor: "rgba(55,65,81,0.08)",
      bottomColor: "rgba(55,65,81,0)",
      lineWidth: 1,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 5,
      crosshairMarkerBackgroundColor: "#1a1a1a",
      crosshairMarkerBorderColor: "#ffffff",
      crosshairMarkerBorderWidth: 2,
      lastValueVisible: true,
      priceLineVisible: false,
    });
    areaRef.current = area;

    const upper = chart.addSeries(LineSeries, {
      color: "#2196f3",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      lastValueVisible: true,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
      priceFormat: { type: "price", precision: pip, minMove: Math.pow(10, -pip) },
    });
    const lower = chart.addSeries(LineSeries, {
      color: "#2196f3",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      lastValueVisible: true,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
      priceFormat: { type: "price", precision: pip, minMove: Math.pow(10, -pip) },
    });
    upperRef.current = upper;
    lowerRef.current = lower;

    const ro = new ResizeObserver(() => {
      if (!el || !chartRef.current) return;
      chartRef.current.applyOptions({ width: el.clientWidth, height: el.clientHeight });
      animFrameRef.current = requestAnimationFrame(updateOverlay);
    });
    ro.observe(el);

    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      animFrameRef.current = requestAnimationFrame(updateOverlay);
    });

    const ws = new WebSocket(WS_URL);
    ws.onopen = () => {
      if (!mounted) return;
      ws.send(JSON.stringify({ ticks_history: symbol, count: 150, end: "latest", style: "ticks", subscribe: 1 }));
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
            lastPriceRef.current = prices[prices.length - 1];
            chartRef.current?.timeScale().fitContent();
            animFrameRef.current = requestAnimationFrame(updateOverlay);
          }
        }
        if (msg.msg_type === "tick") {
          const { epoch, quote } = msg.tick as { epoch: number; quote: number };
          areaRef.current?.update({ time: epoch as UTCTimestamp, value: quote });
          lastPriceRef.current = quote;
          if (showBarriers && upperRef.current && lowerRef.current) {
            const up = +(quote * (1 + barrierPct / 100)).toFixed(pip);
            const dn = +(quote * (1 - barrierPct / 100)).toFixed(pip);
            upperRef.current.update({ time: epoch as UTCTimestamp, value: up });
            lowerRef.current.update({ time: epoch as UTCTimestamp, value: dn });
          }
          animFrameRef.current = requestAnimationFrame(updateOverlay);
        }
      } catch (_) {}
    };

    return () => {
      mounted = false;
      cancelAnimationFrame(animFrameRef.current);
      ro.disconnect();
      ws.onclose = null;
      ws.close();
      chart.remove();
      chartRef.current = null;
      areaRef.current  = null;
      upperRef.current = null;
      lowerRef.current = null;
    };
  }, [symbol, pip, showBarriers, barrierPct, updateOverlay]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* Blue barrier band overlay — positioned by JS via priceToCoordinate */}
      {showBarriers && (
        <div
          ref={overlayRef}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            opacity: 0,
            background: "rgba(33, 150, 243, 0.08)",
            borderTop: "1px dashed rgba(33,150,243,0.6)",
            borderBottom: "1px dashed rgba(33,150,243,0.6)",
            pointerEvents: "none",
            zIndex: 1,
            transition: "opacity 0.3s",
          }}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   MODAL SHEET — bottom drawer
────────────────────────────────────────────────────────────────────── */
function Sheet({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ background: "rgba(0,0,0,0.45)" }}
    >
      <div
        className="w-full bg-white rounded-t-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: "80vh", animation: "sheet-up 0.22s cubic-bezier(0.22,1,0.36,1) both" }}
      >
        <div className="relative flex items-center justify-center px-4 pt-4 pb-3 shrink-0">
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-gray-200" />
          <span className="text-sm font-bold text-gray-900">{title}</span>
          <button onClick={onClose} className="absolute right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
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
   CONTRACT CARD
────────────────────────────────────────────────────────────────────── */
interface Contract {
  id: string; label: string; subType: string; symbol: string;
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
  const isUp   = ["rise", "higher", "up", "buy", "touch", "even"].includes(c.subType);
  const isWon  = c.status === "won";
  const isDone = c.status !== "open";
  const profit = isWon ? c.payout - c.stake : -c.stake;
  return (
    <div className={`rounded-xl border p-3 flex items-center gap-3 text-left ${isDone
      ? (isWon ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50")
      : "border-gray-200 bg-white"}`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isUp ? "bg-green-100 text-green-600" : "bg-red-100 text-red-500"}`}>
        {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold text-gray-800">{c.label} · {c.subType}</div>
        <div className="text-[11px] text-gray-400">{c.symbol} · Stake ${c.stake.toFixed(2)} · Payout ${c.payout.toFixed(2)}</div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {isDone
          ? <><span className={`text-xs font-bold ${isWon ? "text-green-600" : "text-red-500"}`}>{isWon ? "+" : ""}{profit.toFixed(2)}</span>
              {isWon ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <AlertCircle className="w-4 h-4 text-red-500" />}</>
          : <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><Clock className="w-3 h-3" />{secsLeft}s</span>
        }
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
  const { isLoggedIn, currency } = useAuth();
  const cur = currency || "USD";

  /* ── State ───────────────────────────────────────────────────────── */
  const [market,        setMarket]       = useState(MARKETS[0]);
  const [typeId,        setTypeId]       = useState("accumulators");
  const [stake,         setStake]        = useState(10);
  const [stakeStr,      setStakeStr]     = useState("10");
  const [growthRate,    setGrowthRate]   = useState(3);
  const [multiplier,    setMultiplier]   = useState(20);
  const [durUnitIdx,    setDurUnitIdx]   = useState(0);
  const [durVal,        setDurVal]       = useState(5);
  const [barrier,       setBarrier]      = useState("+0.01");
  const [hasTakeProfit, setHasTakeProfit]= useState(false);
  const [takeProfit,    setTakeProfit]   = useState(100);
  const [tpStr,         setTpStr]        = useState("100");
  const [allowEquals,   setAllowEquals]  = useState(false);
  const [contracts,     setContracts]    = useState<Contract[]>([]);
  const [buying,        setBuying]       = useState(false);

  /* ── Sheet visibility ─────────────────────────────────────────────── */
  const [mktSheet,    setMktSheet]    = useState(false);
  const [typeSheet,   setTypeSheet]   = useState(false);
  const [durSheet,    setDurSheet]    = useState(false);
  const [growthSheet, setGrowthSheet] = useState(false);
  const [multSheet,   setMultSheet]   = useState(false);
  const [barrierSheet,setBarrierSheet]= useState(false);
  const [authSheet,   setAuthSheet]   = useState(false);
  const [riskSheet,   setRiskSheet]   = useState(false);
  const [contractsOpen,setContractsOpen]=useState(false);

  const tradeType  = TRADE_TYPES.find(t => t.id === typeId) || TRADE_TYPES[0];
  const durUnit    = DURATION_UNITS[durUnitIdx];
  const barrierPct = growthRate === 1 ? 0.226
                   : growthRate === 2 ? 0.284
                   : growthRate === 3 ? 0.351
                   : growthRate === 4 ? 0.432
                   :                   0.519;

  const { price, change, dir } = useLivePrice(market.id);

  /* ── Helpers ─────────────────────────────────────────────────────── */
  const commitStake = useCallback(() => {
    const v = parseFloat(stakeStr);
    if (!isNaN(v) && v >= 0.35) { setStake(v); setStakeStr(String(v)); }
    else setStakeStr(String(stake));
  }, [stakeStr, stake]);

  const nudgeStake = (d: number) => {
    setStake(s => { const n = Math.max(0.35, +(s + d).toFixed(2)); setStakeStr(String(n)); return n; });
  };

  const commitTp = useCallback(() => {
    const v = parseFloat(tpStr);
    if (!isNaN(v) && v > 0) { setTakeProfit(v); setTpStr(String(v)); }
    else setTpStr(String(takeProfit));
  }, [tpStr, takeProfit]);

  const durLabel = `${durVal} ${durUnit.label.toLowerCase().replace(/s$/, "") + (durVal !== 1 ? "s" : "")}`;

  const handleBuy = useCallback((subType: string) => {
    if (!isLoggedIn) { setAuthSheet(true); return; }
    if (!price || buying) return;
    setBuying(true);
    const durMs = tradeType.hasDuration
      ? durVal * (durUnit.id === "t" ? 1500 : durUnit.id === "s" ? 1000 : durUnit.id === "m" ? 60000 : 3600000)
      : 15000;
    const payout = tradeType.id === "accumulators"
      ? stake * Math.pow(1 + growthRate / 100, Math.floor(durMs / 1500))
      : tradeType.id === "multipliers" ? stake * (1 + multiplier * 0.01) : +(stake * 1.85).toFixed(2);

    setTimeout(() => {
      const won = Math.random() > 0.45;
      const id  = `C${Date.now()}`;
      setContracts(prev => [{
        id, label: tradeType.label, subType,
        symbol: market.short, stake, payout, status: "open", expiresAt: Date.now() + durMs,
      }, ...prev].slice(0, 8));
      setBuying(false);
      setTimeout(() => {
        setContracts(prev => prev.map(c => c.id === id ? { ...c, status: won ? "won" : "lost" } : c));
      }, durMs);
    }, 350);
  }, [isLoggedIn, price, buying, tradeType, durVal, durUnit, market, stake, growthRate, multiplier]);

  /* ─────────────────────────────────────────────────────────────────
     RENDER — mobile-first, matches DTrader screenshot layout
  ───────────────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-full overflow-hidden bg-white select-none"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── MARKET HEADER CARD ──────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-4 py-2.5 shrink-0">
        <button
          onClick={() => setMktSheet(true)}
          className="flex items-center gap-3 w-full text-left hover:bg-gray-50 rounded-xl px-2 py-1.5 -mx-2 transition-colors"
        >
          {/* Market icon placeholder (100 badge) */}
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-white font-bold text-xs leading-none">
              100
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-gray-900 leading-tight">{market.label}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {price != null ? (
                <>
                  <span className="text-xs text-gray-500 font-mono">
                    {price.toFixed(market.pip)}
                    {" - "}
                    <span className={change.dir === "up" ? "text-green-500" : change.dir === "down" ? "text-red-500" : "text-gray-400"}>
                      {change.val} ({change.pct}%)
                    </span>
                  </span>
                  <span className={`text-[10px] font-bold ${
                    dir === "up" ? "text-green-500" : dir === "down" ? "text-red-500" : "text-gray-400"
                  }`}>
                    {dir === "up" ? "▲" : dir === "down" ? "▼" : "●"}
                  </span>
                </>
              ) : (
                <span className="text-xs text-gray-300 animate-pulse">Connecting…</span>
              )}
            </div>
          </div>
          <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
        </button>
      </div>

      {/* ── CHART ────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 relative">
        <TradingChart
          symbol={market.id}
          pip={market.pip}
          showBarriers={tradeType.id === "accumulators" || tradeType.id === "multipliers"}
          barrierPct={barrierPct}
        />

        {/* Open contracts mini button */}
        {contracts.length > 0 && (
          <button
            onClick={() => setContractsOpen(true)}
            className="absolute top-2 right-2 z-10 bg-black/70 text-white text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5"
          >
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            {contracts.filter(c => c.status === "open").length} open
          </button>
        )}
      </div>

      {/* ── BOTTOM PARAMS PANEL ──────────────────────────────────── */}
      <div className="shrink-0 bg-white border-t border-gray-200 flex flex-col">

        {/* Drag handle + "Learn about this trade type" */}
        <div className="flex items-center justify-between px-4 pt-2 pb-1.5">
          <div className="flex-1 flex justify-center">
            <div className="w-10 h-1 rounded-full bg-gray-200" />
          </div>
        </div>
        <div className="px-4 pb-2">
          <button className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-600 transition-colors">
            Learn about this trade type
          </button>
        </div>

        {/* ── Trade type row ────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            {/* Accumulator / trade type icon */}
            <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
              <div className="w-4 h-0.5 bg-teal-500 rounded-full relative">
                <div className="absolute -top-1 left-0 w-3 h-0.5 bg-teal-500 rotate-45 origin-left" />
                <div className="absolute -bottom-1 left-0 w-3 h-0.5 bg-teal-500 -rotate-45 origin-left" />
              </div>
            </div>
            <button
              onClick={() => setTypeSheet(true)}
              className="flex items-center gap-1 hover:bg-gray-50 rounded-lg px-1 py-0.5 -mx-1 transition-colors"
            >
              <span className="text-sm font-bold text-gray-900">{tradeType.label}</span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          {/* Growth rate / Multiplier selector (right of trade type row) */}
          {tradeType.hasGrowthRate && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setGrowthSheet(true)}
                className="flex items-center gap-1 text-sm font-bold text-gray-900 hover:bg-gray-50 rounded-lg px-2 py-1 transition-colors"
              >
                {growthRate}%
              </button>
              <button className="text-gray-400 hover:text-gray-600">
                <Info className="w-4 h-4" />
              </button>
            </div>
          )}
          {tradeType.hasMultiplier && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMultSheet(true)}
                className="flex items-center gap-1 text-sm font-bold text-gray-900 hover:bg-gray-50 rounded-lg px-2 py-1 transition-colors"
              >
                x{multiplier}
              </button>
              <button className="text-gray-400 hover:text-gray-600">
                <Info className="w-4 h-4" />
              </button>
            </div>
          )}
          {tradeType.hasDuration && (
            <button
              onClick={() => setDurSheet(true)}
              className="flex items-center gap-1 text-sm font-bold text-gray-900 hover:bg-gray-50 rounded-lg px-2 py-1 transition-colors"
            >
              {durLabel}
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>
          )}
          {tradeType.hasBarrier && (
            <button
              onClick={() => setBarrierSheet(true)}
              className="flex items-center gap-1 text-sm font-bold text-gray-900 hover:bg-gray-50 rounded-lg px-2 py-1 transition-colors"
            >
              {barrier}
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>
          )}
        </div>

        {/* ── Stake row ─────────────────────────────────────────── */}
        <div className="flex items-center border-t border-gray-100 px-4 py-3">
          <button
            onClick={() => nudgeStake(-1)}
            className="w-9 h-9 flex items-center justify-center text-2xl font-light text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
          >
            −
          </button>
          <div className="flex-1 flex items-center justify-center gap-2">
            <input
              value={stakeStr}
              onChange={e => setStakeStr(e.target.value)}
              onBlur={commitStake}
              onFocus={e => e.target.select()}
              onKeyDown={e => e.key === "Enter" && commitStake()}
              className="w-20 text-2xl font-bold text-gray-900 text-center bg-transparent focus:outline-none"
            />
            <span className="text-sm font-medium text-gray-500">{cur}</span>
          </div>
          <button
            onClick={() => nudgeStake(1)}
            className="w-9 h-9 flex items-center justify-center text-2xl font-light text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
          >
            +
          </button>
          <span className="ml-3 text-sm font-medium text-gray-400">Stake</span>
        </div>

        {/* ── Take profit row ───────────────────────────────────── */}
        {tradeType.hasTakeProfit && (
          <div className="flex items-center border-t border-gray-100 px-4 py-3">
            <button
              onClick={() => setHasTakeProfit(v => !v)}
              className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
                hasTakeProfit ? "border-[#00a79e] bg-[#00a79e]" : "border-gray-300"
              }`}
            >
              {hasTakeProfit && <Check className="w-3 h-3 text-white" />}
            </button>
            <span className="ml-2 text-sm font-medium text-gray-800">Take profit</span>
            {hasTakeProfit && (
              <div className="flex items-center gap-1.5 ml-3">
                <input
                  value={tpStr}
                  onChange={e => setTpStr(e.target.value)}
                  onBlur={commitTp}
                  onFocus={e => e.target.select()}
                  onKeyDown={e => e.key === "Enter" && commitTp()}
                  className="w-20 text-sm font-bold text-gray-900 text-right border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 focus:outline-none focus:border-[#00a79e]"
                />
                <span className="text-xs text-gray-400">{cur}</span>
              </div>
            )}
            <div className="ml-auto">
              <button className="text-gray-400 hover:text-gray-600">
                <Info className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Allow Equals (Rise/Fall only) ─────────────────────── */}
        {tradeType.hasAllowEquals && (
          <div className="flex items-center border-t border-gray-100 px-4 py-3">
            <button
              onClick={() => setAllowEquals(v => !v)}
              className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
                allowEquals ? "border-[#00a79e] bg-[#00a79e]" : "border-gray-300"
              }`}
            >
              {allowEquals && <Check className="w-3 h-3 text-white" />}
            </button>
            <span className="ml-2 text-sm font-medium text-gray-800">Allow equals</span>
          </div>
        )}

        {/* ── Max. payout + Risk Disclaimer row ────────────────── */}
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 gap-4">
          <div className="flex items-center gap-3">
            {/* Risk Disclaimer amber pill */}
            <button
              onClick={() => setRiskSheet(true)}
              className="flex items-center gap-1.5 bg-[#f6c544] rounded-lg px-3 py-1.5 hover:bg-[#e5b73e] transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-900" />
              <span className="text-xs font-bold text-yellow-900">Risk Disclaimer</span>
            </button>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Max. payout</span>
              <span className="text-xs font-bold text-gray-800">
                {tradeType.maxPayout.toLocaleString()}.00 {cur}
              </span>
            </div>
            {tradeType.maxTicks && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Max. ticks</span>
                <span className="text-xs font-bold text-gray-800">{tradeType.maxTicks} ticks</span>
              </div>
            )}
          </div>
        </div>

        {/* ── BUY / SELL BUTTONS ───────────────────────────────── */}
        <div className="px-4 pb-4 pt-1">
          {tradeType.buttonType === "single" ? (
            <button
              onClick={() => handleBuy("buy")}
              disabled={buying || !price}
              className="w-full py-4 rounded-xl font-bold text-base text-white transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: "#00cc84" }}
            >
              {buying ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Buying…</>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
                    <path d="M13 13l6 6" />
                  </svg>
                  Buy
                </>
              )}
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => handleBuy(tradeType.buyLabel.toLowerCase())}
                disabled={buying || !price}
                className="flex-1 py-4 rounded-xl font-bold text-sm text-white active:scale-95 disabled:opacity-50 transition-all"
                style={{ background: tradeType.buyColor }}
              >
                {tradeType.buyLabel}
              </button>
              <button
                onClick={() => handleBuy((tradeType.sellLabel || "sell").toLowerCase())}
                disabled={buying || !price}
                className="flex-1 py-4 rounded-xl font-bold text-sm text-white active:scale-95 disabled:opacity-50 transition-all"
                style={{ background: tradeType.sellColor || "#ec3f3f" }}
              >
                {tradeType.sellLabel}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SHEETS
      ───────────────────────────────────────────────────────────── */}

      {/* Market selector */}
      <Sheet open={mktSheet} onClose={() => setMktSheet(false)} title="Select market">
        {MARKETS.map(m => (
          <button
            key={m.id}
            onClick={() => { setMarket(m); setMktSheet(false); }}
            className={`w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors ${m.id === market.id ? "bg-teal-50" : ""}`}
          >
            <div className="text-left">
              <div className="text-sm font-semibold text-gray-900">{m.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{m.short}</div>
            </div>
            {m.id === market.id && <Check className="w-4 h-4 text-[#00a79e]" />}
          </button>
        ))}
      </Sheet>

      {/* Trade type selector */}
      <Sheet open={typeSheet} onClose={() => setTypeSheet(false)} title="Trade types">
        {TRADE_TYPES.map(tt => (
          <button
            key={tt.id}
            onClick={() => { setTypeId(tt.id); setTypeSheet(false); }}
            className={`w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors ${tt.id === typeId ? "bg-teal-50" : ""}`}
          >
            <span className="text-xl">{tt.icon}</span>
            <span className="text-sm font-semibold text-gray-900 flex-1 text-left">{tt.label}</span>
            {tt.id === typeId && <Check className="w-4 h-4 text-[#00a79e]" />}
          </button>
        ))}
      </Sheet>

      {/* Duration sheet */}
      <Sheet open={durSheet} onClose={() => setDurSheet(false)} title="Duration">
        <div className="p-4">
          <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
            {DURATION_UNITS.map((u, i) => (
              <button
                key={u.id}
                onClick={() => { setDurUnitIdx(i); setDurVal(u.presets[0]); }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors ${
                  durUnitIdx === i ? "bg-[#00a79e] border-[#00a79e] text-white" : "bg-white border-gray-200 text-gray-600"
                }`}
              >
                {u.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {durUnit.presets.map(v => (
              <button
                key={v}
                onClick={() => { setDurVal(v); setDurSheet(false); }}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                  durVal === v ? "bg-[#00a79e] border-[#00a79e] text-white" : "bg-white border-gray-200 text-gray-700 hover:border-gray-400"
                }`}
              >
                {v} {durUnit.label.toLowerCase().replace(/s$/, "") + (v !== 1 ? "s" : "")}
              </button>
            ))}
          </div>
        </div>
      </Sheet>

      {/* Growth rate sheet */}
      <Sheet open={growthSheet} onClose={() => setGrowthSheet(false)} title="Growth rate">
        <div className="p-4 space-y-2">
          <p className="text-xs text-gray-400 mb-4">The growth rate determines how much your stake grows with each successful tick.</p>
          {GROWTH_RATES.map(r => (
            <button
              key={r}
              onClick={() => { setGrowthRate(r); setGrowthSheet(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                r === growthRate ? "border-[#00a79e] bg-teal-50" : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <span className="text-sm font-semibold text-gray-900">{r}%</span>
              {r === growthRate && <Check className="w-4 h-4 text-[#00a79e]" />}
            </button>
          ))}
        </div>
      </Sheet>

      {/* Multiplier sheet */}
      <Sheet open={multSheet} onClose={() => setMultSheet(false)} title="Multiplier">
        <div className="p-4 flex flex-wrap gap-2">
          {MULTIPLIERS.map(m => (
            <button
              key={m}
              onClick={() => { setMultiplier(m); setMultSheet(false); }}
              className={`px-4 py-2.5 rounded-full text-sm font-semibold border transition-colors ${
                m === multiplier ? "bg-[#00a79e] border-[#00a79e] text-white" : "bg-white border-gray-200 text-gray-700 hover:border-gray-400"
              }`}
            >
              x{m}
            </button>
          ))}
        </div>
      </Sheet>

      {/* Barrier sheet */}
      <Sheet open={barrierSheet} onClose={() => setBarrierSheet(false)} title="Barrier">
        <div className="p-4">
          <div className="flex gap-2 mb-4">
            {["Above spot", "Below spot"].map(t => (
              <button key={t} className="px-3 py-1.5 rounded-full text-xs font-semibold border border-gray-200 text-gray-600 hover:border-gray-400">
                {t}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {["+0.01", "+0.02", "+0.05", "+0.10", "+0.20", "+0.50", "+1.00"].map(b => (
              <button
                key={b}
                onClick={() => { setBarrier(b); setBarrierSheet(false); }}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                  barrier === b ? "bg-[#00a79e] border-[#00a79e] text-white" : "bg-white border-gray-200 text-gray-700 hover:border-gray-400"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>
      </Sheet>

      {/* Risk disclaimer */}
      <Sheet open={riskSheet} onClose={() => setRiskSheet(false)} title="Risk Disclaimer">
        <div className="p-5 space-y-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm text-gray-700 leading-relaxed">
              {tradeType.id === "accumulators"
                ? "Accumulator contracts can result in rapid gains or complete loss of stake. Your stake grows by the selected growth rate per tick while spot price stays within the barrier range."
                : "This product carries a high risk of losing your stake. Only trade with money you can afford to lose."}
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Options and multipliers are complex instruments. Past performance is not indicative of future results.
          </p>
          <button
            onClick={() => setRiskSheet(false)}
            className="w-full py-3.5 bg-[#00a79e] text-white font-bold rounded-xl hover:bg-[#009188] transition-colors"
          >
            I understand
          </button>
        </div>
      </Sheet>

      {/* Open contracts */}
      <Sheet open={contractsOpen} onClose={() => setContractsOpen(false)} title={`Open positions (${contracts.length})`}>
        <div className="p-4 flex flex-col gap-3">
          {contracts.length === 0
            ? <p className="text-sm text-gray-400 text-center py-8">No open positions</p>
            : contracts.map(c => (
                <ContractCard key={c.id} c={c} onClose={id => setContracts(prev => prev.filter(x => x.id !== id))} />
              ))
          }
        </div>
      </Sheet>

      {/* Auth gate */}
      <AuthGateModal open={authSheet} onClose={() => setAuthSheet(false)} />
    </div>
  );
}
