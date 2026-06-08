import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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

/* ─── colour tokens (dark theme matching smarttradex.site) ─── */
const C = { bg: "hsl(var(--background))", panel: "hsl(var(--card))", card: "hsl(var(--card))", border: "hsl(var(--border))", text: "hsl(var(--foreground))", muted: "hsl(var(--muted-foreground))", accent: "hsl(var(--primary))", accentHov: "hsl(var(--accent))", blue: "hsl(var(--primary))", red: "#ec3f3f", amber: "#f6c544" };

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
  { label: "Boom 300 Index",             short: "B300",     id: "BOOM300N",pip: 2 },
  { label: "Boom 500 Index",             short: "B500",     id: "BOOM500N",pip: 2 },
  { label: "Boom 1000 Index",            short: "B1K",      id: "BOOM1000N",pip:2 },
  { label: "Crash 300 Index",            short: "C300",     id: "CRASH300N",pip:2 },
  { label: "Crash 500 Index",            short: "C500",     id: "CRASH500N",pip:2 },
  { label: "Crash 1000 Index",           short: "C1K",      id: "CRASH1000N",pip:2},
  { label: "Jump 10 Index",              short: "J10",      id: "JD10",    pip: 2 },
  { label: "Jump 25 Index",              short: "J25",      id: "JD25",    pip: 2 },
  { label: "Jump 50 Index",              short: "J50",      id: "JD50",    pip: 2 },
  { label: "Jump 75 Index",              short: "J75",      id: "JD75",    pip: 2 },
  { label: "Jump 100 Index",             short: "J100",     id: "JD100",   pip: 2 },
];

/* ─────────────────────────────────────────────────────────────
   TRADE TYPES
───────────────────────────────────────────────────────────── */
interface TradeType {
  id: string; label: string; icon: string;
  hasGrowthRate: boolean; hasDuration: boolean; hasBarrier: boolean;
  hasTakeProfit: boolean; hasMultiplier: boolean; hasAllowEquals?: boolean;
  maxPayout: number; maxTicks?: number;
  buttonType: "single" | "dual";
  buyLabel: string; sellLabel?: string;
  buyColor: string; sellColor?: string;
}
const TRADE_TYPES: TradeType[] = [
  { id:"accumulators", label:"Accumulators", icon:"📈",
    hasGrowthRate:true,  hasDuration:false, hasBarrier:false,
    hasTakeProfit:true,  hasMultiplier:false, maxPayout:6000, maxTicks:85,
    buttonType:"single", buyLabel:"Buy", buyColor:C.accent },
  { id:"rise_fall",    label:"Rise/Fall",    icon:"↕️",
    hasGrowthRate:false, hasDuration:true,  hasBarrier:false,
    hasTakeProfit:false, hasMultiplier:false, hasAllowEquals:true, maxPayout:50000,
    buttonType:"dual", buyLabel:"Rise", sellLabel:"Fall", buyColor:C.accent, sellColor:C.red },
  { id:"higher_lower", label:"Higher/Lower", icon:"⬆️",
    hasGrowthRate:false, hasDuration:true,  hasBarrier:true,
    hasTakeProfit:false, hasMultiplier:false, maxPayout:50000,
    buttonType:"dual", buyLabel:"Higher", sellLabel:"Lower", buyColor:C.accent, sellColor:C.red },
  { id:"touch",        label:"Touch/No Touch", icon:"👆",
    hasGrowthRate:false, hasDuration:true,  hasBarrier:true,
    hasTakeProfit:false, hasMultiplier:false, maxPayout:50000,
    buttonType:"dual", buyLabel:"Touch", sellLabel:"No Touch", buyColor:C.accent, sellColor:C.red },
  { id:"multipliers",  label:"Multipliers",   icon:"✖️",
    hasGrowthRate:false, hasDuration:false, hasBarrier:false,
    hasTakeProfit:true,  hasMultiplier:true, maxPayout:100000,
    buttonType:"dual", buyLabel:"Up", sellLabel:"Down", buyColor:C.accent, sellColor:C.red },
  { id:"digits",       label:"Even/Odd",      icon:"🔢",
    hasGrowthRate:false, hasDuration:true,  hasBarrier:false,
    hasTakeProfit:false, hasMultiplier:false, maxPayout:50000,
    buttonType:"dual", buyLabel:"Even", sellLabel:"Odd", buyColor:C.accent, sellColor:C.red },
];
const GROWTH_RATES = [1,2,3,4,5];
const MULTIPLIERS  = [10,20,30,40,50,100,200,500];
const DURATION_UNITS = [
  { id:"t", label:"Ticks",   presets:[1,3,5,7,10,15,20,30,50,100] },
  { id:"s", label:"Seconds", presets:[15,30,45,60,90,120,180,300] },
  { id:"m", label:"Minutes", presets:[1,2,3,5,10,15,30,60] },
  { id:"h", label:"Hours",   presets:[1,2,3,4,6,8,12,24] },
];

/* ─────────────────────────────────────────────────────────────
   LIVE PRICE HOOK
───────────────────────────────────────────────────────────── */
function useLivePrice(symbol: string) {
  const [price, setPrice]    = useState<number | null>(null);
  const [prevPrice, setPrev] = useState<number | null>(null);
  const [openPrice, setOpen] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    setPrice(null); setPrev(null); setOpen(null);
    const ws = new WebSocket(WS_URL);
    ws.onopen  = () => ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
    ws.onmessage = (e) => {
      if (!alive) return;
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
    return () => { alive = false; ws.onclose = null; ws.close(); };
  }, [symbol]);

  const dir = price != null && prevPrice != null
    ? price > prevPrice ? "up" as const : price < prevPrice ? "down" as const : "flat" as const
    : "flat" as const;

  const change = useMemo(() => {
    if (price == null || openPrice == null) return { val:"0.00", pct:"0.000", dir:"flat" as const };
    const diff = price - openPrice;
    const pct  = (diff / openPrice) * 100;
    return { val:Math.abs(diff).toFixed(2), pct:Math.abs(pct).toFixed(2), dir:diff>0?"up" as const:diff<0?"down" as const:"flat" as const };
  }, [price, openPrice]);

  return { price, change, dir };
}

/* ─────────────────────────────────────────────────────────────
   DARK CHART — lightweight-charts styled like DTrader dark mode
───────────────────────────────────────────────────────────── */
function DarkChart({ symbol, pip, barrierPct, showBarriers }: {
  symbol: string; pip: number; barrierPct: number; showBarriers: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef   = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const areaRef      = useRef<ISeriesApi<"Area"> | null>(null);
  const upperRef     = useRef<ISeriesApi<"Line"> | null>(null);
  const lowerRef     = useRef<ISeriesApi<"Line"> | null>(null);
  const lastPx       = useRef<number | null>(null);
  const rafRef       = useRef<number>(0);

  const positionOverlay = useCallback(() => {
    if (!chartRef.current || !overlayRef.current || !lastPx.current || !showBarriers) return;
    try {
      const p = lastPx.current;
      const ps = chartRef.current.priceScale("right") as any;
      const yU = ps?.priceToCoordinate(p * (1 + barrierPct / 100));
      const yL = ps?.priceToCoordinate(p * (1 - barrierPct / 100));
      if (yU != null && yL != null && yL > yU) {
        overlayRef.current.style.top    = `${yU}px`;
        overlayRef.current.style.height = `${yL - yU}px`;
        overlayRef.current.style.opacity = "1";
      }
    } catch (_) {}
  }, [showBarriers, barrierPct]);

  useEffect(() => {
    if (!containerRef.current) return;
    let alive = true;
    const el = containerRef.current;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "#0e1824" },
        textColor: "#6b8099",
        fontSize: 11,
        fontFamily: "'Inter', system-ui, sans-serif",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: "rgba(255,255,255,0.2)", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#1a2a3a" },
        horzLine: { color: "rgba(255,255,255,0.2)", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#1a1a1a" },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.06)",
        scaleMargins: { top: 0.18, bottom: 0.12 },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.06)",
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
      lineColor: "#00cc84",
      topColor: "rgba(0,204,132,0.15)",
      bottomColor: "rgba(0,204,132,0)",
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 5,
      crosshairMarkerBackgroundColor: "#00cc84",
      crosshairMarkerBorderColor: "#0e1824",
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
    });
    const lower = chart.addSeries(LineSeries, {
      color: "#2196f3",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      lastValueVisible: true,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });
    upperRef.current = upper;
    lowerRef.current = lower;

    const ro = new ResizeObserver(() => {
      if (!chartRef.current) return;
      chartRef.current.applyOptions({ width: el.clientWidth, height: el.clientHeight });
      rafRef.current = requestAnimationFrame(positionOverlay);
    });
    ro.observe(el);

    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      rafRef.current = requestAnimationFrame(positionOverlay);
    });

    const ws = new WebSocket(WS_URL);
    ws.onopen = () => {
      if (!alive) return;
      ws.send(JSON.stringify({ ticks_history: symbol, count: 180, end: "latest", style: "ticks", subscribe: 1 }));
    };
    ws.onmessage = (evt) => {
      if (!alive) return;
      try {
        const msg = JSON.parse(evt.data);
        if (msg.msg_type === "history") {
          const { times, prices } = msg.history as { times: number[]; prices: number[] };
          const pts = times.map((t, i) => ({ time: t as UTCTimestamp, value: prices[i] }));
          if (areaRef.current && pts.length > 0) {
            areaRef.current.setData(pts);
            lastPx.current = prices[prices.length - 1];
            chart.timeScale().fitContent();
            rafRef.current = requestAnimationFrame(positionOverlay);
          }
        }
        if (msg.msg_type === "tick") {
          const { epoch, quote } = msg.tick as { epoch: number; quote: number };
          areaRef.current?.update({ time: epoch as UTCTimestamp, value: quote });
          lastPx.current = quote;
          if (showBarriers && upperRef.current && lowerRef.current) {
            const up = +(quote * (1 + barrierPct / 100)).toFixed(pip);
            const dn = +(quote * (1 - barrierPct / 100)).toFixed(pip);
            upperRef.current.update({ time: epoch as UTCTimestamp, value: up });
            lowerRef.current.update({ time: epoch as UTCTimestamp, value: dn });
          }
          rafRef.current = requestAnimationFrame(positionOverlay);
        }
      } catch (_) {}
    };

    return () => {
      alive = false;
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      ws.onclose = null;
      ws.close();
      chart.remove();
      chartRef.current = null; areaRef.current = null;
      upperRef.current = null; lowerRef.current = null;
    };
  }, [symbol, pip, showBarriers, barrierPct, positionOverlay]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      {showBarriers && (
        <div ref={overlayRef} style={{
          position: "absolute", left: 0, right: 0, opacity: 0, zIndex: 1, pointerEvents: "none",
          background: "rgba(33,150,243,0.08)",
          borderTop: "1px dashed rgba(33,150,243,0.5)",
          borderBottom: "1px dashed rgba(33,150,243,0.5)",
          transition: "opacity 0.3s",
        }}/>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   BOTTOM SHEET
───────────────────────────────────────────────────────────── */
function Sheet({ open, onClose, title, children }: {
  open: boolean; onClose:()=>void; title: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ background:"rgba(0,0,0,0.65)" }}
      onClick={e => { if (e.target===e.currentTarget) onClose(); }}
    >
      <div
        className="w-full rounded-t-2xl flex flex-col"
        style={{ background:C.panel, border:`1px solid ${C.border}`, borderBottom:"none", maxHeight:"80vh",
          animation:"sheet-up 0.22s cubic-bezier(0.22,1,0.36,1) both" }}
      >
        <div className="relative flex items-center justify-center px-4 pt-4 pb-3 shrink-0">
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full" style={{background:C.border}} />
          <span className="text-sm font-bold" style={{color:C.text}}>{title}</span>
          <button onClick={onClose}
            className="absolute right-4 w-8 h-8 flex items-center justify-center rounded-full transition-colors"
            style={{color:C.muted}}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="h-px shrink-0" style={{background:C.border}} />
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
      <style>{`@keyframes sheet-up{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   CONTRACT CARD
───────────────────────────────────────────────────────────── */
interface Contract {
  id:string; label:string; subType:string; symbol:string;
  stake:number; payout:number; status:"open"|"won"|"lost"; expiresAt:number;
}
function ContractCard({ c, onClose }:{ c:Contract; onClose:(id:string)=>void }) {
  const [now,setNow] = useState(Date.now());
  useEffect(() => {
    if (c.status!=="open") return;
    const t = setInterval(()=>setNow(Date.now()),500);
    return ()=>clearInterval(t);
  },[c.status]);
  const secsLeft = Math.max(0,Math.round((c.expiresAt-now)/1000));
  const isUp  = ["rise","higher","up","buy","touch","even"].includes(c.subType);
  const isWon = c.status==="won";
  const isDone= c.status!=="open";
  const profit= isWon ? c.payout-c.stake : -c.stake;
  return (
    <div className="rounded-xl border p-3 flex items-center gap-3"
      style={{
        borderColor: isDone?(isWon?"#166534":"#7f1d1d"):C.border,
        background:  isDone?(isWon?"#14532d22":"#7f1d1d22"):C.card,
      }}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{background:isUp?"#14532d44":"#7f1d1d44",color:isUp?"#4ade80":"#f87171"}}>
        {isUp ? <TrendingUp className="w-4 h-4"/> : <TrendingDown className="w-4 h-4"/>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold" style={{color:C.text}}>{c.label} · {c.subType}</div>
        <div className="text-[11px]" style={{color:C.muted}}>{c.symbol} · Stake ${c.stake.toFixed(2)} · Payout ${c.payout.toFixed(2)}</div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {isDone
          ? <><span className="text-xs font-bold" style={{color:isWon?"#4ade80":"#f87171"}}>{isWon?"+":""}{profit.toFixed(2)}</span>
              {isWon?<CheckCircle2 className="w-4 h-4 text-green-400"/>:<AlertCircle className="w-4 h-4 text-red-400"/>}</>
          : <span className="text-[10px] flex items-center gap-0.5" style={{color:C.muted}}><Clock className="w-3 h-3"/>{secsLeft}s</span>
        }
        <button onClick={()=>onClose(c.id)} className="w-5 h-5 flex items-center justify-center rounded"
          style={{color:C.muted}}>
          <X className="w-3 h-3"/>
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────────────────────── */
export default function ManualTraders() {
  const { isLoggedIn, currency } = useAuth();
  const cur = currency || "USD";

  /* state */
  const [market,         setMarket]        = useState(MARKETS[0]);
  const [stake,          setStake]         = useState(10);
  const [stakeStr,       setStakeStr]      = useState("10");
  const [growthRate,     setGrowthRate]    = useState(3);
  const [multiplier,     setMultiplier]    = useState(20);
  const [durUnitIdx,     setDurUnitIdx]    = useState(0);
  const [durVal,         setDurVal]        = useState(5);
  const [barrier,        setBarrier]       = useState("+0.01");
  const [hasTakeProfit,  setHasTakeProfit] = useState(false);
  const [takeProfit,     setTakeProfit]    = useState(100);
  const [tpStr,          setTpStr]         = useState("100");
  const [allowEquals,    setAllowEquals]   = useState(false);
  const [contracts,      setContracts]     = useState<Contract[]>([]);
  const [buying,         setBuying]        = useState(false);

  /* sheets */
  const [mktSheet,       setMktSheet]      = useState(false);
  const [typeSheet,      setTypeSheet]     = useState(false);
  const [durSheet,       setDurSheet]      = useState(false);
  const [growthSheet,    setGrowthSheet]   = useState(false);
  const [typeId,          setTypeId]        = useState(TRADE_TYPES[0].id);
  const [multSheet,      setMultSheet]     = useState(false);
  const [barrierSheet,   setBarrierSheet]  = useState(false);
  const [authSheet,      setAuthSheet]     = useState(false);
  const [riskSheet,      setRiskSheet]     = useState(false);
  const [posSheet,       setPosSheet]      = useState(false);

  const tradeType = TRADE_TYPES.find(t=>t.id===typeId) || TRADE_TYPES[0];
  const durUnit   = DURATION_UNITS[durUnitIdx];

  /* barrier pct for accumulator zone */
  const barrierPct = growthRate===1?0.226:growthRate===2?0.284:growthRate===3?0.351:growthRate===4?0.432:0.519;


  const { price, change, dir } = useLivePrice(market.id);

  /* helpers */
  const commitStake = useCallback(()=>{
    const v = parseFloat(stakeStr);
    if (!isNaN(v) && v>=0.35){ setStake(v); setStakeStr(String(v)); }
    else setStakeStr(String(stake));
  },[stakeStr,stake]);

  const nudgeStake = (d:number)=>{
    setStake(s=>{ const n=Math.max(0.35,+(s+d).toFixed(2)); setStakeStr(String(n)); return n; });
  };

  const commitTp = useCallback(()=>{
    const v = parseFloat(tpStr);
    if (!isNaN(v) && v>0){ setTakeProfit(v); setTpStr(String(v)); }
    else setTpStr(String(takeProfit));
  },[tpStr,takeProfit]);

  const durLabel = `${durVal} ${durUnit.label.toLowerCase().replace(/s$/,"")+(durVal!==1?"s":"")}`;

  const handleBuy = useCallback((subType:string)=>{
    if (!isLoggedIn){ setAuthSheet(true); return; }
    if (!price || buying) return;
    setBuying(true);
    const durMs = tradeType.hasDuration
      ? durVal*(durUnit.id==="t"?1500:durUnit.id==="s"?1000:durUnit.id==="m"?60000:3600000)
      : 15000;
    const payout = tradeType.id==="accumulators"
      ? stake*Math.pow(1+growthRate/100,Math.floor(durMs/1500))
      : tradeType.id==="multipliers"?stake*(1+multiplier*0.01):+(stake*1.85).toFixed(2);

    setTimeout(()=>{
      const won = Math.random()>0.45;
      const id  = `C${Date.now()}`;
      setContracts(prev=>[{
        id,label:tradeType.label,subType,symbol:market.short,
        stake:stake,payout:payout,status:("open" as "open"|"won"|"lost"),expiresAt:Date.now()+durMs,
      },...prev].slice(0,8));
      setBuying(false);
      setTimeout(()=>{
        setContracts(prev=>prev.map(c=>c.id===id?{...c,status:won?"won":"lost"}:c));
      },durMs);
    },350);
  },[isLoggedIn,price,buying,tradeType,durVal,durUnit,market,stake,growthRate,multiplier]);

  /* ── row helper ──────────────────────────────────────────── */
  const RowDivider = ()=><div className="h-px mx-4" style={{background:C.border}}/>;

  /* ─────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-full overflow-hidden select-none" style={{background:C.bg, fontFamily:"'Inter',system-ui,sans-serif"}}>

      {/* ── MARKET HEADER ───────────────────────────────── */}
      <div className="shrink-0 px-3 py-2.5 border-b" style={{background:C.panel,borderColor:C.border}}>
        <button
          onClick={()=>setMktSheet(true)}
          className="flex items-center gap-3 w-full text-left rounded-xl px-2 py-1.5 -mx-2 transition-colors"
          style={{["--tw-hover-bg" as string]:C.card}}
          onMouseEnter={e=>(e.currentTarget.style.background=C.card)}
          onMouseLeave={e=>(e.currentTarget.style.background="transparent")}
        >
          {/* icon badge */}
          <div className="relative shrink-0">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-xs text-white" style={{background:"#e65c00"}}>
              {market.short.replace(/[^0-9]/g,"")||"V"}
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 flex items-center justify-center" style={{background:"#dc2626",borderColor:C.panel}}>
              <div className="w-1.5 h-1.5 bg-white rounded-full"/>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold leading-tight" style={{color:C.text}}>{market.label}</div>
            <div className="flex items-center gap-2 mt-0.5">
              {price!=null ? (
                <>
                  <span className="text-xs font-mono" style={{color:C.muted}}>
                    {price.toFixed(market.pip)}
                  </span>
                  <span className="text-xs font-semibold"
                    style={{color:change.dir==="up"?"#4ade80":change.dir==="down"?"#f87171":C.muted}}>
                    {change.dir==="up"?"+":change.dir==="down"?"-":""}{change.val} ({change.pct}%)
                  </span>
                  <span style={{color:dir==="up"?"#4ade80":dir==="down"?"#f87171":C.muted}} className="text-xs font-bold">
                    {dir==="up"?"▲":dir==="down"?"▼":"●"}
                  </span>
                </>
              ):(
                <span className="text-xs animate-pulse" style={{color:C.muted}}>Connecting…</span>
              )}
            </div>
          </div>
          <ChevronDown className="w-5 h-5 shrink-0" style={{color:C.muted}}/>
        </button>
      </div>

      {/* ── DARK CHART (lightweight-charts, DTrader dark style) ── */}
      <div className="flex-1 min-h-0 relative">
        <DarkChart
          symbol={market.id}
          pip={market.pip}
          barrierPct={barrierPct}
        />

        {/* open positions badge */}
        {contracts.filter(c=>c.status==="open").length>0 && (
          <button
            onClick={()=>setPosSheet(true)}
            className="absolute top-2 left-2 z-10 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold transition-opacity"
            style={{background:"rgba(0,0,0,0.7)",color:"#e8edf2",border:`1px solid ${C.border}`}}
          >
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
            {contracts.filter(c=>c.status==="open").length} open
          </button>
        )}

        {/* Live price badge (top-right, DTrader style) */}
        {price!=null && (
          <div
            className="absolute top-2 right-10 z-10 rounded-lg px-2.5 py-1 text-sm font-bold font-mono pointer-events-none"
            style={{background:"#1a1a1a",color:"#ffffff",boxShadow:"0 2px 8px rgba(0,0,0,0.5)"}}
          >
            {price.toFixed(market.pip)}
          </div>
        )}
      </div>

      {/* ── BOTTOM PARAMS PANEL ─────────────────────────── */}
      <div className="shrink-0 border-t flex flex-col" style={{background:C.panel,borderColor:C.border}}>

        {/* drag handle + learn link */}
        <div className="flex flex-col items-center gap-1 pt-2.5 pb-1.5 px-4">
          <div className="w-10 h-1 rounded-full" style={{background:C.border}}/>
          <button className="text-xs underline underline-offset-2 transition-colors mt-1"
            style={{color:C.muted}}>
            Learn about this trade type
          </button>
        </div>

        <RowDivider/>

        {/* ── Trade type row ─────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            {/* Accumulators icon (two horizontal lines + zigzag — DTrader style) */}
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background:"#00cc8422"}}>
              <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
                <path d="M1 7h3l2-4 3 6 2-3 2 3h4" stroke={C.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <button
              onClick={()=>setTypeSheet(true)}
              className="flex items-center gap-1 rounded-lg px-1 py-0.5 -mx-1 transition-colors"
            >
              <span className="text-sm font-bold" style={{color:C.text}}>{tradeType.label}</span>
              <ChevronDown className="w-4 h-4" style={{color:C.muted}}/>
            </button>
          </div>

          {/* right control per trade type */}
          {tradeType.hasGrowthRate && (
            <div className="flex items-center gap-2">
              <button onClick={()=>setGrowthSheet(true)}
                className="px-3 py-1 rounded-lg text-sm font-bold transition-colors"
                style={{background:C.card,color:C.text,border:`1px solid ${C.border}`}}>
                {growthRate}%
              </button>
              <button style={{color:C.muted}}><Info className="w-4 h-4"/></button>
            </div>
          )}
          {tradeType.hasMultiplier && (
            <div className="flex items-center gap-2">
              <button onClick={()=>setMultSheet(true)}
                className="px-3 py-1 rounded-lg text-sm font-bold transition-colors"
                style={{background:C.card,color:C.text,border:`1px solid ${C.border}`}}>
                x{multiplier}
              </button>
              <button style={{color:C.muted}}><Info className="w-4 h-4"/></button>
            </div>
          )}
          {tradeType.hasDuration && (
            <button onClick={()=>setDurSheet(true)}
              className="flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-bold"
              style={{background:C.card,color:C.text,border:`1px solid ${C.border}`}}>
              {durLabel}<ChevronDown className="w-3.5 h-3.5" style={{color:C.muted}}/>
            </button>
          )}
          {tradeType.hasBarrier && (
            <button onClick={()=>setBarrierSheet(true)}
              className="flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-bold"
              style={{background:C.card,color:C.text,border:`1px solid ${C.border}`}}>
              {barrier}<ChevronDown className="w-3.5 h-3.5" style={{color:C.muted}}/>
            </button>
          )}
        </div>

        <RowDivider/>

        {/* ── Stake row ──────────────────────────────────── */}
        <div className="flex items-center px-4 py-3 gap-2">
          <button onClick={()=>nudgeStake(-1)}
            className="w-10 h-10 flex items-center justify-center text-2xl font-light rounded-full transition-colors"
            style={{color:C.text,background:C.card,border:`1px solid ${C.border}`}}>
            −
          </button>
          <div className="flex-1 flex items-center justify-center gap-2">
            <input
              value={stakeStr}
              onChange={e=>setStakeStr(e.target.value)}
              onBlur={commitStake}
              onFocus={e=>e.target.select()}
              onKeyDown={e=>e.key==="Enter"&&commitStake()}
              className="w-24 text-2xl font-bold text-center bg-transparent focus:outline-none"
              style={{color:C.text}}
            />
            <span className="text-sm font-medium" style={{color:C.muted}}>{cur}</span>
          </div>
          <button onClick={()=>nudgeStake(1)}
            className="w-10 h-10 flex items-center justify-center text-2xl font-light rounded-full transition-colors"
            style={{color:C.text,background:C.card,border:`1px solid ${C.border}`}}>
            +
          </button>
          <span className="ml-1 text-sm font-medium" style={{color:C.muted}}>Stake</span>
        </div>

        <RowDivider/>

        {/* ── Take profit ────────────────────────────────── */}
        {tradeType.hasTakeProfit && (<>
          <div className="flex items-center px-4 py-3">
            <button
              onClick={()=>setHasTakeProfit(v=>!v)}
              className="w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0"
              style={{borderColor:hasTakeProfit?C.accent:C.border,background:hasTakeProfit?C.accent:"transparent"}}>
              {hasTakeProfit && <Check className="w-3 h-3 text-white"/>}
            </button>
            <span className="ml-2 text-sm font-medium" style={{color:C.text}}>Take profit</span>
            {hasTakeProfit && (
              <div className="flex items-center gap-1.5 ml-3">
                <input
                  value={tpStr}
                  onChange={e=>setTpStr(e.target.value)}
                  onBlur={commitTp}
                  onFocus={e=>e.target.select()}
                  onKeyDown={e=>e.key==="Enter"&&commitTp()}
                  className="w-20 text-sm font-bold text-right rounded-lg px-2 py-1.5 focus:outline-none"
                  style={{color:C.text,background:C.card,border:`1px solid ${C.border}`}}
                />
                <span className="text-xs" style={{color:C.muted}}>{cur}</span>
              </div>
            )}
            <div className="ml-auto">
              <button style={{color:C.muted}}><Info className="w-4 h-4"/></button>
            </div>
          </div>
          <RowDivider/>
        </>)}

        {/* ── Allow equals (Rise/Fall) ───────────────────── */}
        {tradeType.hasAllowEquals && (<>
          <div className="flex items-center px-4 py-3">
            <button
              onClick={()=>setAllowEquals(v=>!v)}
              className="w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0"
              style={{borderColor:allowEquals?C.accent:C.border,background:allowEquals?C.accent:"transparent"}}>
              {allowEquals && <Check className="w-3 h-3 text-white"/>}
            </button>
            <span className="ml-2 text-sm font-medium" style={{color:C.text}}>Allow equals</span>
          </div>
          <RowDivider/>
        </>)}

        {/* ── Max payout + Risk Disclaimer row ──────────── */}
        <div className="flex items-center justify-between px-4 py-3 gap-4">
          <button
            onClick={()=>setRiskSheet(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors shrink-0"
            style={{background:C.amber,color:"#78350f"}}>
            <AlertTriangle className="w-3.5 h-3.5"/>
            <span className="text-xs font-bold">Risk Disclaimer</span>
          </button>
          <div className="flex flex-col items-end gap-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{color:C.muted}}>Max. payout</span>
              <span className="text-xs font-bold whitespace-nowrap" style={{color:C.text}}>
                {tradeType.maxPayout.toLocaleString()}.00 {cur}
              </span>
            </div>
            {tradeType.maxTicks && (
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{color:C.muted}}>Max. ticks</span>
                <span className="text-xs font-bold" style={{color:C.text}}>{tradeType.maxTicks} ticks</span>
              </div>
            )}
          </div>
        </div>

        {/* ── BUY / SELL BUTTONS ────────────────────────── */}
        <div className="px-4 pb-4 pt-1">
          {tradeType.buttonType==="single" ? (
            <button
              onClick={()=>handleBuy("buy")}
              disabled={buying||!price}
              className="w-full py-4 rounded-xl font-bold text-base text-white transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              style={{background:C.accent}}>
              {buying ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Buying…</>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
                    <path d="M13 13l6 6"/>
                  </svg>
                  Buy
                </>
              )}
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={()=>handleBuy(tradeType.buyLabel.toLowerCase())}
                disabled={buying||!price}
                className="flex-1 py-4 rounded-xl font-bold text-sm text-white active:scale-95 disabled:opacity-50 transition-all"
                style={{background:tradeType.buyColor}}>
                {tradeType.buyLabel}
              </button>
              <button
                onClick={()=>handleBuy((tradeType.sellLabel||"sell").toLowerCase())}
                disabled={buying||!price}
                className="flex-1 py-4 rounded-xl font-bold text-sm text-white active:scale-95 disabled:opacity-50 transition-all"
                style={{background:tradeType.sellColor||C.red}}>
                {tradeType.sellLabel}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─────────── SHEETS ─────────────────────────────── */}

      {/* Market */}
      <Sheet open={mktSheet} onClose={()=>setMktSheet(false)} title="Select market">
        {MARKETS.map(m=>(
          <button key={m.id} onClick={()=>{setMarket(m);setMktSheet(false);}}
            className="w-full flex items-center justify-between px-5 py-4 border-b transition-colors"
            style={{borderColor:C.border,background:m.id===market.id?C.card:"transparent"}}
            onMouseEnter={e=>(e.currentTarget.style.background=C.card)}
            onMouseLeave={e=>(e.currentTarget.style.background=m.id===market.id?C.card:"transparent")}>
            <div className="text-left">
              <div className="text-sm font-semibold" style={{color:C.text}}>{m.label}</div>
              <div className="text-xs mt-0.5" style={{color:C.muted}}>{m.short}</div>
            </div>
            {m.id===market.id && <Check className="w-4 h-4" style={{color:C.accent}}/>}
          </button>
        ))}
      </Sheet>

      {/* Trade type */}
      <Sheet open={typeSheet} onClose={()=>setTypeSheet(false)} title="Trade types">
        {TRADE_TYPES.map(tt=>(
          <button key={tt.id} onClick={()=>{setTypeId(tt.id);setTypeSheet(false);}}
            className="w-full flex items-center gap-3 px-5 py-4 border-b transition-colors"
            style={{borderColor:C.border,background:tt.id===typeId?C.card:"transparent"}}
            onMouseEnter={e=>(e.currentTarget.style.background=C.card)}
            onMouseLeave={e=>(e.currentTarget.style.background=tt.id===typeId?C.card:"transparent")}>
            <span className="text-xl">{tt.icon}</span>
            <span className="text-sm font-semibold flex-1 text-left" style={{color:C.text}}>{tt.label}</span>
            {tt.id===typeId && <Check className="w-4 h-4" style={{color:C.accent}}/>}
          </button>
        ))}
      </Sheet>

      {/* Duration */}
      <Sheet open={durSheet} onClose={()=>setDurSheet(false)} title="Duration">
        <div className="p-4">
          <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
            {DURATION_UNITS.map((u,i)=>(
              <button key={u.id} onClick={()=>{setDurUnitIdx(i);setDurVal(u.presets[0]);}}
                className="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors"
                style={durUnitIdx===i?{background:C.accent,borderColor:C.accent,color:"#fff"}:{background:"transparent",borderColor:C.border,color:C.text}}>
                {u.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {durUnit.presets.map(v=>(
              <button key={v} onClick={()=>{setDurVal(v);setDurSheet(false);}}
                className="px-4 py-2 rounded-full text-sm font-medium border transition-colors"
                style={durVal===v?{background:C.accent,borderColor:C.accent,color:"#fff"}:{background:"transparent",borderColor:C.border,color:C.text}}>
                {v} {durUnit.label.toLowerCase().replace(/s$/,"")+(v!==1?"s":"")}
              </button>
            ))}
          </div>
        </div>
      </Sheet>

      {/* Growth rate */}
      <Sheet open={growthSheet} onClose={()=>setGrowthSheet(false)} title="Growth rate">
        <div className="p-4 space-y-2">
          <p className="text-xs pb-2" style={{color:C.muted}}>Your stake grows by the selected rate with each successful tick.</p>
          {GROWTH_RATES.map(r=>(
            <button key={r} onClick={()=>{setGrowthRate(r);setGrowthSheet(false);}}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors"
              style={{borderColor:r===growthRate?C.accent:C.border,background:r===growthRate?C.card:"transparent"}}>
              <span className="text-sm font-semibold" style={{color:C.text}}>{r}%</span>
              {r===growthRate && <Check className="w-4 h-4" style={{color:C.accent}}/>}
            </button>
          ))}
        </div>
      </Sheet>

      {/* Multiplier */}
      <Sheet open={multSheet} onClose={()=>setMultSheet(false)} title="Multiplier">
        <div className="p-4 flex flex-wrap gap-2">
          {MULTIPLIERS.map(m=>(
            <button key={m} onClick={()=>{setMultiplier(m);setMultSheet(false);}}
              className="px-4 py-2.5 rounded-full text-sm font-semibold border transition-colors"
              style={m===multiplier?{background:C.accent,borderColor:C.accent,color:"#fff"}:{background:"transparent",borderColor:C.border,color:C.text}}>
              x{m}
            </button>
          ))}
        </div>
      </Sheet>

      {/* Barrier */}
      <Sheet open={barrierSheet} onClose={()=>setBarrierSheet(false)} title="Barrier">
        <div className="p-4 flex flex-wrap gap-2">
          {["+0.01","+0.02","+0.05","+0.10","+0.20","+0.50","+1.00"].map(b=>(
            <button key={b} onClick={()=>{setBarrier(b);setBarrierSheet(false);}}
              className="px-4 py-2 rounded-full text-sm font-medium border transition-colors"
              style={barrier===b?{background:C.accent,borderColor:C.accent,color:"#fff"}:{background:"transparent",borderColor:C.border,color:C.text}}>
              {b}
            </button>
          ))}
        </div>
      </Sheet>

      {/* Risk Disclaimer */}
      <Sheet open={riskSheet} onClose={()=>setRiskSheet(false)} title="Risk Disclaimer">
        <div className="p-5 space-y-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{color:C.amber}}/>
            <p className="text-sm leading-relaxed" style={{color:C.text}}>
                {typeId==="accumulators"
                  ?"Accumulator contracts can result in rapid gains or complete loss of your stake. Your stake grows by the selected growth rate per tick while the spot price stays within the barrier range. If the spot price exits the range, you lose your stake."
                  :"This product carries a high risk of losing your stake. Only trade with money you can afford to lose. Options and multipliers are complex instruments."}
            </p>
          </div>
          <p className="text-xs" style={{color:C.muted}}>Past performance is not indicative of future results.</p>
          <button onClick={()=>setRiskSheet(false)}
            className="w-full py-3.5 font-bold rounded-xl text-white transition-colors"
            style={{background:C.accent}}>
            I understand
          </button>
        </div>
      </Sheet>

      {/* Open positions */}
      <Sheet open={posSheet} onClose={()=>setPosSheet(false)} title={`Positions (${contracts.length})`}>
        <div className="p-4 flex flex-col gap-3">
          {contracts.length===0
            ? <p className="text-sm text-center py-8" style={{color:C.muted}}>No positions yet</p>
            : contracts.map(c=>(
                <ContractCard key={c.id} c={c} onClose={id=>setContracts(prev=>prev.filter(x=>x.id!==id))}/>
              ))
          }
        </div>
      </Sheet>

      {/* Auth gate */}
      <AuthGateModal open={authSheet} onClose={()=>setAuthSheet(false)}/>
    </div>
  );
}
