import { useState, useEffect, useRef } from "react";
import { Settings, RefreshCw, TrendingUp, TrendingDown, X } from "lucide-react";
import { DERIV_APP_ID, OAUTH_APP_ID } from "@/context/AuthContext";
import { useAuth } from "@/context/AuthContext";
import AuthGateModal from "@/components/AuthGateModal";

const WS_URL       = `wss://ws.binaryws.com/websockets/v3?app_id=${DERIV_APP_ID}`;
const REDIRECT_URI = "https://dev-utility-hub--apexricky20.replit.app/callback";
const LOGIN_URL    = `https://oauth.deriv.com/oauth2/authorize?app_id=${OAUTH_APP_ID}&l=EN&brand=deriv&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

// ── Helpers ──────────────────────────────────────────────────────────────────
function lastDigit(q: number): number {
  return Number(q.toString().at(-1));
}

function calcRiseFall(prices: number[]): { r: number; f: number; rn: number; fn: number } {
  let rn = 0, fn = 0;
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > prices[i - 1]) rn++;
    else if (prices[i] < prices[i - 1]) fn++;
  }
  const t = rn + fn;
  return t ? { r: (rn / t) * 100, f: (fn / t) * 100, rn, fn }
           : { r: 50, f: 50, rn: 0, fn: 0 };
}

// ── Symbol lists ──────────────────────────────────────────────────────────────
const SYMBOLS = [
  { label: "Volatility 10 Index",        id: "R_10"       },
  { label: "Volatility 10 (1s) Index",   id: "1HZ10V"     },
  { label: "Volatility 25 Index",        id: "R_25"       },
  { label: "Volatility 25 (1s) Index",   id: "1HZ25V"     },
  { label: "Volatility 50 Index",        id: "R_50"       },
  { label: "Volatility 50 (1s) Index",   id: "1HZ50V"     },
  { label: "Volatility 75 Index",        id: "R_75"       },
  { label: "Volatility 75 (1s) Index",   id: "1HZ75V"     },
  { label: "Volatility 100 Index",       id: "R_100"      },
  { label: "Volatility 100 (1s) Index",  id: "1HZ100V"    },
  { label: "Boom 300 Index",             id: "BOOM300N"   },
  { label: "Boom 500 Index",             id: "BOOM500N"   },
  { label: "Boom 1000 Index",            id: "BOOM1000N"  },
  { label: "Crash 300 Index",            id: "CRASH300N"  },
  { label: "Crash 500 Index",            id: "CRASH500N"  },
  { label: "Crash 1000 Index",           id: "CRASH1000N" },
  { label: "Step Index 100",             id: "stpRNG100"  },
  { label: "Jump 10 Index",              id: "JD10"       },
  { label: "Jump 25 Index",              id: "JD25"       },
  { label: "Jump 50 Index",              id: "JD50"       },
  { label: "Jump 75 Index",              id: "JD75"       },
  { label: "Jump 100 Index",             id: "JD100"      },
];

const ALL_ANALYSIS_MARKETS = [
  { label: "Volatility 10",       id: "R_10"       },
  { label: "Volatility 25",       id: "R_25"       },
  { label: "Volatility 50",       id: "R_50"       },
  { label: "Volatility 75",       id: "R_75"       },
  { label: "Volatility 100",      id: "R_100"      },
  { label: "Vol 10 (1s)",         id: "1HZ10V"     },
  { label: "Vol 25 (1s)",         id: "1HZ25V"     },
  { label: "Vol 50 (1s)",         id: "1HZ50V"     },
  { label: "Vol 75 (1s)",         id: "1HZ75V"     },
  { label: "Vol 100 (1s)",        id: "1HZ100V"    },
  { label: "Boom 300",            id: "BOOM300N"   },
  { label: "Boom 500",            id: "BOOM500N"   },
  { label: "Boom 1000",           id: "BOOM1000N"  },
  { label: "Crash 300",           id: "CRASH300N"  },
  { label: "Crash 500",           id: "CRASH500N"  },
  { label: "Crash 1000",          id: "CRASH1000N" },
];

const TABS = [
  { id: "circles",      label: "DcIrcles"       },
  { id: "signals",      label: "Signals"         },
  { id: "apex",         label: "Apex Analysis"   },
  { id: "dptools",      label: "DP Tools"        },
  { id: "smart",        label: "Smart Analysis"  },
  { id: "allanalysis",  label: "All Analysis"    },
  { id: "tickanalyser", label: "Tick Analyser"   },
  { id: "apexai",       label: "Apex AI"         },
];

// ── Shared WebSocket Hook ─────────────────────────────────────────────────────
function useDerivWS(symbol: string, count = 1000) {
  const [digits,      setDigits]      = useState<number[]>([]);
  const [prices,      setPrices]      = useState<number[]>([]);
  const [latestPrice, setLatestPrice] = useState<number | null>(null);
  const [connected,   setConnected]   = useState(false);

  const wsRef    = useRef<WebSocket | null>(null);
  const pingRef  = useRef<ReturnType<typeof setInterval>  | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout>   | null>(null);
  const mountRef = useRef(true);

  useEffect(() => {
    mountRef.current = true;
    setDigits([]); setPrices([]); setLatestPrice(null); setConnected(false);

    function connect() {
      if (!mountRef.current) return;
      if (pingRef.current)  { clearInterval(pingRef.current);  pingRef.current  = null; }
      if (retryRef.current) { clearTimeout(retryRef.current);  retryRef.current = null; }
      if (wsRef.current)    { wsRef.current.onclose = null; wsRef.current.close(); }

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ ticks_history: symbol, count, end: "latest", style: "ticks", subscribe: 1 }));
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ ping: 1 }));
        }, 25_000);
      };

      ws.onmessage = (e) => {
        if (!mountRef.current) return;
        try {
          const msg = JSON.parse(e.data as string);
          if (msg.error || msg.msg_type === "pong") return;
          if (msg.msg_type === "history") {
            const ps: number[] = msg.history?.prices ?? [];
            setPrices(ps); setDigits(ps.map(lastDigit));
            if (ps.length) setLatestPrice(ps[ps.length - 1]);
            setConnected(true);
          }
          if (msg.msg_type === "tick") {
            const q: number = msg.tick.quote;
            setLatestPrice(q);
            const d = lastDigit(q);
            setPrices(prev => { const n = [...prev, q]; return n.length > count ? n.slice(-count) : n; });
            setDigits(prev => { const n = [...prev, d]; return n.length > count ? n.slice(-count) : n; });
          }
        } catch (_) {}
      };

      ws.onerror  = () => { if (mountRef.current) setConnected(false); };
      ws.onclose  = () => {
        if (!mountRef.current) return;
        setConnected(false);
        retryRef.current = setTimeout(connect, 3_000);
      };
    }

    connect();
    return () => {
      mountRef.current = false;
      if (pingRef.current)  clearInterval(pingRef.current);
      if (retryRef.current) clearTimeout(retryRef.current);
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); }
    };
  }, [symbol, count]);

  return { digits, prices, latestPrice, connected };
}

// ── Shared UI primitives ──────────────────────────────────────────────────────
function ConnDot({ connected }: { connected: boolean }) {
  return (
    <span className={`w-2 h-2 rounded-full inline-block shrink-0 ${connected ? "bg-[#22C55E]" : "bg-[#EF4444] animate-pulse"}`} />
  );
}

function SymSel({ value, onChange, dark = false, className = "" }: { value: string; onChange: (v: string) => void; dark?: boolean; className?: string }) {
  const base = dark
    ? "bg-[#1E2D42] border-[#2D4060] text-white focus:border-[#1E90FF]"
    : "bg-white border-[#E5E7EB] text-[#1A1A1A] focus:border-[#1E90FF]";
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className={`border rounded-lg px-3 py-2 text-sm focus:outline-none ${base} ${className}`}>
      {SYMBOLS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
    </select>
  );
}

function Bar({ label, value, color, count }: { label: string; value: number; color: string; count: number }) {
  return (
    <div>
      <div className="flex justify-between items-center text-sm mb-1">
        <span className="font-medium" style={{ color }}>{label} ({value.toFixed(2)}%)</span>
        <span className="text-[#6B7280] text-xs">{count}</span>
      </div>
      <div className="h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function RecentRow({ items, label, colorFn, labelFn }: {
  items: number[]; label: string;
  colorFn: (d: number) => string; labelFn: (d: number) => string;
}) {
  const [more, setMore] = useState(false);
  const shown = more ? items.slice(-50) : items.slice(-10);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-[#6B7280]">{label}:</span>
        {items.length > 10 && (
          <button onClick={() => setMore(v => !v)} className="text-[10px] text-[#1E90FF] hover:underline">{more ? "Less" : "More"}</button>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {shown.map((d, i) => (
          <div key={i} className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
               style={{ backgroundColor: colorFn(d) }}>
            {labelFn(d)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 1 — DcIrcles
// ══════════════════════════════════════════════════════════════════════════════
function DcIrclesTab({ digits, latestPrice, connected, tickWindow, setTickWindow }: {
  digits: number[]; latestPrice: number | null; connected: boolean;
  tickWindow: number; setTickWindow: (n: number) => void;
}) {
  const [overThresh, setOverThresh] = useState(5);
  const [matchDig,   setMatchDig]   = useState(0);

  const total = digits.length || 1;
  const cur   = digits.length > 0 ? digits[digits.length - 1] : null;

  const dc: number[] = Array(10).fill(0);
  let even = 0, odd = 0, over = 0, under = 0, eq = 0, match = 0, differ = 0;
  digits.forEach(d => {
    dc[d]++;
    if (d % 2 === 0) even++; else odd++;
    if (d > overThresh) over++; else if (d < overThresh) under++; else eq++;
    if (d === matchDig) match++; else differ++;
  });

  const maxC   = Math.max(...dc);
  const nonZ   = dc.filter(c => c > 0);
  const minC   = nonZ.length ? Math.min(...nonZ) : 0;
  const sDesc  = [...new Set(dc)].sort((a, b) => b - a);
  const secondMax = sDesc[1] ?? 0;
  const sAsc   = [...new Set(dc)].filter(c => c > 0).sort((a, b) => a - b);
  const secondMin = sAsc[1] ?? 0;

  function circleColor(i: number, c: number): string {
    if (i === cur)                           return "#1E90FF";
    if (c === maxC && c > 0)                 return "#22C55E";
    if (c === minC && minC > 0 && c !== maxC) return "#EF4444";
    if (c === secondMax && c > 0 && c !== maxC) return "#3B82F6";
    if (c === secondMin && c > 0 && c !== minC && c !== maxC) return "#F97316";
    return "#D1D5DB";
  }

  return (
    <div className="space-y-4">
      {/* Digit distribution */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[#1A1A1A]">Digit Distribution</h3>
            <ConnDot connected={connected} />
            <span className="text-xs text-[#9CA3AF]">{digits.length} ticks</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#6B7280]">Ticks window:</span>
            <input type="number" value={tickWindow}
              onChange={e => setTickWindow(Math.max(50, Math.min(5000, Number(e.target.value))))}
              className="w-20 border border-[#E5E7EB] rounded px-2 py-1 text-xs focus:outline-none focus:border-[#1E90FF]"
            />
          </div>
        </div>

        <div className="flex justify-between items-end gap-0.5">
          {dc.map((c, i) => {
            const bg       = circleColor(i, c);
            const isCur    = i === cur;
            const pctColor = bg === "#D1D5DB" ? "#9CA3AF" : bg;
            return (
              <div key={i} className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
                <div className="h-4 flex items-end justify-center">
                  {isCur && <svg width="10" height="7"><path d="M5 7L0 0H10L5 7Z" fill="#1E90FF"/></svg>}
                </div>
                <div className="rounded-full flex items-center justify-center font-bold text-white transition-all duration-200"
                     style={{ width:"clamp(28px,8vw,48px)", height:"clamp(28px,8vw,48px)", backgroundColor: bg, fontSize:"clamp(11px,3vw,17px)" }}>
                  {i}
                </div>
                <span className="font-semibold" style={{ fontSize:"clamp(9px,2vw,11px)", color: pctColor }}>
                  {((c / total) * 100).toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-[#6B7280]">
          {([["#22C55E","Highest"],["#3B82F6","2nd Highest"],["#F97316","2nd Lowest"],["#EF4444","Lowest"],["#1E90FF","Current"]] as [string,string][]).map(([c, l]) => (
            <span key={l} className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: c }} />{l}
            </span>
          ))}
        </div>

        {latestPrice !== null && (
          <div className="mt-2 text-xs text-[#9CA3AF]">Last price: <span className="font-mono text-[#1A1A1A]">{latestPrice.toFixed(3)}</span></div>
        )}
      </div>

      {/* Three stat panels */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Even/Odd */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-[#1A1A1A]">Even / Odd</h3>
          <Bar label="Even" value={(even/total)*100} color="#22C55E" count={even} />
          <Bar label="Odd"  value={(odd /total)*100} color="#EF4444" count={odd}  />
          <RecentRow items={digits} label="Recent (last 10)"
            colorFn={d => d%2===0 ? "#1E90FF" : "#EF4444"}
            labelFn={d => d%2===0 ? "E" : "O"}
          />
        </div>

        {/* Over/Under */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#1A1A1A]">Over / Under</h3>
            <select value={overThresh} onChange={e => setOverThresh(Number(e.target.value))}
              className="border border-[#E5E7EB] rounded px-2 py-1 text-xs focus:outline-none focus:border-[#1E90FF]">
              {[0,1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <Bar label="Over"  value={(over /total)*100} color="#22C55E" count={over}  />
          <Bar label="Equal" value={(eq   /total)*100} color="#9CA3AF" count={eq}    />
          <Bar label="Under" value={(under/total)*100} color="#EF4444" count={under} />
          <RecentRow items={digits} label="Recent (last 10)"
            colorFn={d => d>overThresh ? "#EF4444" : d<overThresh ? "#22C55E" : "#9CA3AF"}
            labelFn={d => d>overThresh ? "O" : d<overThresh ? "U" : "="}
          />
        </div>

        {/* Matches/Differs */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#1A1A1A]">Matches / Differs</h3>
            <select value={matchDig} onChange={e => setMatchDig(Number(e.target.value))}
              className="border border-[#E5E7EB] rounded px-2 py-1 text-xs focus:outline-none focus:border-[#1E90FF]">
              {[0,1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>Digit: {n}</option>)}
            </select>
          </div>
          <Bar label="Matches" value={(match /total)*100} color="#22C55E" count={match}  />
          <Bar label="Differs" value={(differ/total)*100} color="#EF4444" count={differ} />
          <RecentRow items={digits} label="Recent (last 10)"
            colorFn={d => d===matchDig ? "#22C55E" : "#EF4444"}
            labelFn={d => d===matchDig ? "M" : "D"}
          />
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 2 — Signals
// ══════════════════════════════════════════════════════════════════════════════
function SignalsTab({ digits, prices, connected }: { digits: number[]; prices: number[]; connected: boolean }) {
  const total = digits.length || 1;
  let even = 0, odd = 0, over5 = 0, under5 = 0;
  digits.forEach(d => { if (d%2===0) even++; else odd++; if (d>5) over5++; else if (d<5) under5++; });
  const { r: riseP, f: fallP } = calcRiseFall(prices.slice(-100));
  const dc: number[] = Array(10).fill(0);
  digits.forEach(d => dc[d]++);
  const bestDig = dc.indexOf(Math.max(...dc));
  const matchP  = (dc[bestDig] / total) * 100;

  const signals = [
    { type:"Even / Odd",       dir: even>=odd   ? "BUY EVEN"      : "BUY ODD",    conf: Math.max((even/total)*100,(odd/total)*100)   },
    { type:"Rise / Fall",      dir: riseP>=fallP ? "BUY RISE"     : "BUY FALL",   conf: Math.max(riseP, fallP)                       },
    { type:"Over / Under 5",   dir: over5>=under5? "BUY OVER 5"   : "BUY UNDER 5",conf: Math.max((over5/total)*100,(under5/total)*100)},
    { type:`Matches digit ${bestDig}`, dir:`BUY MATCHES ${bestDig}`,              conf: matchP                                       },
  ];

  function sc(c: number) { return c>=65?"#22C55E":c>=55?"#FACC15":"#9CA3AF"; }
  function sl(c: number) { return c>=65?"STRONG":c>=55?"MODERATE":"WEAK"; }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <ConnDot connected={connected} />
        <span className="text-xs text-[#6B7280]">{connected ? `${digits.length} ticks analyzed` : "Connecting..."}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {signals.map(s => (
          <div key={s.type} className="border-2 rounded-2xl p-4 shadow-sm bg-white" style={{ borderColor: sc(s.conf) }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wide">{s.type}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: sc(s.conf) }}>{sl(s.conf)}</span>
            </div>
            <div className="text-lg font-bold text-[#1A1A1A] mb-1">{s.dir}</div>
            <div className="text-3xl font-bold mb-1" style={{ color: sc(s.conf) }}>{s.conf.toFixed(2)}%</div>
            <div className="text-xs text-[#9CA3AF] mb-2">Based on last {digits.length} ticks</div>
            <div className="h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width:`${s.conf}%`, backgroundColor: sc(s.conf) }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 3 — Apex Analysis Tool
// ══════════════════════════════════════════════════════════════════════════════
function ApexAnalysisTab() {
  const [sym,   setSym]   = useState("1HZ25V");
  const [ttype, setTtype] = useState<"even_odd"|"over_under"|"matches_differs"|"rise_fall">("even_odd");
  const [n,     setN]     = useState(120);
  const { digits, prices, latestPrice, connected } = useDerivWS(sym, n);

  const total = digits.length || 1;
  let even = 0, odd = 0, over5 = 0, under5 = 0, m0 = 0;
  digits.forEach(d => { if(d%2===0) even++; else odd++; if(d>5) over5++; else under5++; if(d===0) m0++; });
  const { r: rp, f: fp } = calcRiseFall(prices.slice(-n));

  const bars = ttype==="even_odd"
    ? [{label:"Even",value:(even/total)*100,color:"#22C55E"},{label:"Odd",value:(odd/total)*100,color:"#EF4444"}]
    : ttype==="over_under"
    ? [{label:"Over 5",value:(over5/total)*100,color:"#22C55E"},{label:"Under 5",value:(under5/total)*100,color:"#EF4444"}]
    : ttype==="matches_differs"
    ? [{label:"Matches 0",value:(m0/total)*100,color:"#22C55E"},{label:"Differs",value:((total-m0)/total)*100,color:"#EF4444"}]
    : [{label:"Rise",value:rp,color:"#22C55E"},{label:"Fall",value:fp,color:"#EF4444"}];

  const pat = ttype==="rise_fall"
    ? prices.slice(1).map((p,i) => prices[i]!==undefined && p > prices[i] ? 0 : 1)
    : digits;
  function pc(v:number){
    if(ttype==="even_odd") return v%2===0?"#1E90FF":"#EF4444";
    if(ttype==="over_under") return v>5?"#22C55E":"#EF4444";
    if(ttype==="matches_differs") return v===0?"#22C55E":"#EF4444";
    return v===0?"#22C55E":"#EF4444";
  }
  function pl(v:number){
    if(ttype==="even_odd") return v%2===0?"E":"O";
    if(ttype==="over_under") return v>5?"O":"U";
    if(ttype==="matches_differs") return v===0?"M":"D";
    return v===0?"R":"F";
  }

  return (
    <div className="space-y-4">
      {/* Inputs */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[170px]">
            <label className="text-xs text-[#6B7280] mb-1 block">Synthetic Market</label>
            <SymSel value={sym} onChange={setSym} className="w-full" />
          </div>
          <div>
            <label className="text-xs text-[#6B7280] mb-1 block">Trade Type</label>
            <select value={ttype} onChange={e => setTtype(e.target.value as typeof ttype)}
              className="bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1E90FF]">
              <option value="even_odd">Even / Odd</option>
              <option value="over_under">Over / Under</option>
              <option value="matches_differs">Matches / Differs</option>
              <option value="rise_fall">Rise / Fall</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-[#6B7280] mb-1 block">Ticks to Analyze</label>
            <input type="number" value={n}
              onChange={e => setN(Math.max(10, Math.min(5000, Number(e.target.value))))}
              className="w-28 border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1E90FF]" />
          </div>
          <div className="flex items-center gap-2 pb-1">
            <ConnDot connected={connected} />
            <span className="text-xs text-[#6B7280]">{connected ? `${digits.length} ticks` : "Connecting..."}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Current Price */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-sm flex flex-col items-center justify-center gap-3">
          <div className="text-xs font-bold text-[#9CA3AF] uppercase tracking-widest">Current Price</div>
          <div className="text-4xl font-bold font-mono text-[#1E90FF]">{latestPrice?.toFixed(3) ?? "---"}</div>
          <div className="flex gap-6 text-xs text-[#6B7280]">
            <span className="text-center"><span className="text-[#22C55E] font-bold block text-base">{even}</span>Even</span>
            <span className="text-center"><span className="text-[#EF4444] font-bold block text-base">{odd}</span>Odd</span>
          </div>
        </div>

        {/* Pattern Grid */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-sm md:col-span-2">
          <h3 className="text-sm font-bold text-[#1A1A1A] mb-3">Pattern Grid — last {pat.slice(-80).length} ticks (8 per row)</h3>
          <div className="flex flex-wrap gap-1">
            {pat.slice(-80).map((v,i) => (
              <div key={i} className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                   style={{ backgroundColor: pc(v) }}>
                {pl(v)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Probability bars */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-[#1A1A1A] mb-4">Probability Analysis</h3>
        <div className="space-y-3">
          {bars.map(b => (
            <div key={b.label} className="flex items-center gap-3">
              <span className="text-sm font-medium text-[#1A1A1A] w-28 shrink-0">{b.label}</span>
              <div className="flex-1 h-8 bg-[#E5E7EB] rounded-lg overflow-hidden">
                <div className="h-full rounded-lg flex items-center pl-3 text-sm font-bold text-white transition-all duration-300"
                     style={{ width:`${b.value}%`, backgroundColor: b.color, minWidth:"50px" }}>
                  {b.value.toFixed(2)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Guide */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-[#1A1A1A] mb-3">Trading Probability Guide</h3>
          <div className="space-y-1.5 text-xs">
            <div className="font-semibold text-[#22C55E] mb-1">Over Probabilities</div>
            {([[1,90],[2,85],[3,70],[4,60],[5,55],[6,40],[7,30],[8,25]] as [number,number][]).map(([s,p]) => (
              <div key={s} className="flex justify-between border-b border-[#F3F4F6] pb-1">
                <span className="text-[#6B7280]">Streak {s}</span>
                <span className="font-bold text-[#1A1A1A]">{p}%</span>
              </div>
            ))}
            <div className="font-semibold text-[#EF4444] mt-2 mb-1">Under Probabilities</div>
            {([[1,25],[2,30],[3,40],[4,55],[5,60],[6,70],[7,85],[8,90]] as [number,number][]).map(([s,p]) => (
              <div key={s} className="flex justify-between border-b border-[#F3F4F6] pb-1">
                <span className="text-[#6B7280]">Streak {s}</span>
                <span className="font-bold text-[#1A1A1A]">{p}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {/* Signal guide */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-sm">
            <h3 className="text-sm font-bold text-[#1A1A1A] mb-3">Signal Strength Guide</h3>
            <div className="space-y-2 text-xs">
              {([["#22C55E","Strong Signal","Above 65% (Even/Odd + Rise/Fall)"],["#FACC15","Moderate Signal","55–65%"],["#9CA3AF","Weak Signal","Below 55%"]] as [string,string,string][]).map(([c,l,d]) => (
                <div key={l} className="flex items-start gap-2">
                  <span className="w-3 h-3 rounded-full mt-0.5 shrink-0" style={{ backgroundColor: c }} />
                  <div>
                    <div className="font-semibold text-[#1A1A1A]">{l}</div>
                    <div className="text-[#6B7280]">{d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Tip */}
          <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-2xl p-4">
            <p className="text-xs text-[#1E90FF]">
              <span className="font-bold">ⓘ Tip:</span> Combine pattern analysis with probability indicators for better trade decisions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 4 — DP Tools
// ══════════════════════════════════════════════════════════════════════════════
function DPToolsTab() {
  const [sym, setSym]   = useState("R_100");
  const [n,   setN]     = useState(60);
  const { digits, latestPrice, connected } = useDerivWS(sym, n);

  const total = digits.length || 1;
  let even = 0, odd = 0;
  digits.forEach(d => { if(d%2===0) even++; else odd++; });
  const dc: number[] = Array(10).fill(0);
  digits.forEach(d => dc[d]++);
  const maxC  = Math.max(...dc);
  const nonZ  = dc.filter(c => c > 0);
  const minC  = nonZ.length ? Math.min(...nonZ) : 0;

  return (
    <div className="space-y-4">
      <div className="bg-[#0E1C2F] rounded-2xl p-5 shadow-sm space-y-4">
        {/* Inputs */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[170px]">
            <label className="text-xs text-[#9CA3AF] mb-1 block">Volatility Index</label>
            <SymSel value={sym} onChange={setSym} dark className="w-full" />
          </div>
          <div>
            <label className="text-xs text-[#9CA3AF] mb-1 block">Number of Digits</label>
            <input type="number" value={n}
              onChange={e => setN(Math.max(10, Math.min(5000, Number(e.target.value))))}
              className="w-28 bg-[#1E2D42] border border-[#2D4060] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#1E90FF]" />
          </div>
          <div className="flex items-center gap-2 pb-1">
            <ConnDot connected={connected} />
            <span className="text-xs text-[#9CA3AF]">{connected ? `${digits.length} ticks` : "Connecting..."}</span>
          </div>
        </div>

        {/* Even/Odd pills */}
        <div className="flex gap-3">
          <div className="flex-1 rounded-xl px-4 py-3 text-center font-bold text-white text-lg" style={{ backgroundColor:"#1E90FF" }}>
            Even: {((even/total)*100).toFixed(2)}%
          </div>
          <div className="flex-1 rounded-xl px-4 py-3 text-center font-bold text-white text-lg" style={{ backgroundColor:"#EF4444" }}>
            Odd: {((odd/total)*100).toFixed(2)}%
          </div>
        </div>

        {/* Current price */}
        <div className="bg-[#1E2D42] rounded-xl p-4">
          <div className="text-xs text-[#9CA3AF] mb-0.5 uppercase tracking-widest">Current Price</div>
          <div className="text-xs text-[#9CA3AF]">Latest Price:</div>
          <div className="text-3xl font-bold font-mono text-[#1E90FF] mt-1">{latestPrice?.toFixed(3) ?? "---"}</div>
        </div>

        {/* Digit frequency */}
        <div>
          <h3 className="text-sm font-bold text-white mb-3">Digits</h3>
          <div className="space-y-2">
            {dc.map((c, i) => {
              const p   = (c / total) * 100;
              const col = c===maxC&&c>0 ? "#22C55E" : c===minC&&c>0&&minC>0 ? "#EF4444" : "#1E90FF";
              return (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                       style={{ backgroundColor: col }}>{i}</div>
                  <div className="flex-1 h-6 bg-[#1E2D42] rounded-full overflow-hidden">
                    <div className="h-full rounded-full flex items-center pl-2 text-[10px] font-bold text-white transition-all duration-300"
                         style={{ width:`${p}%`, backgroundColor: col, minWidth:"46px" }}>
                      {p.toFixed(2)}%
                    </div>
                  </div>
                  <span className="text-xs text-[#9CA3AF] w-6 text-right shrink-0">{c}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 5 — Smart Analysis
// ══════════════════════════════════════════════════════════════════════════════
function SmartAnalysisTab({ digits, prices, connected }: { digits: number[]; prices: number[]; connected: boolean }) {
  const total = digits.length || 1;
  let even = 0, odd = 0, over5 = 0, under5 = 0;
  digits.forEach(d => { if(d%2===0) even++; else odd++; if(d>5) over5++; else if(d<5) under5++; });
  const { r: rp, f: fp } = calcRiseFall(prices.slice(-100));
  const dc: number[] = Array(10).fill(0);
  digits.forEach(d => dc[d]++);
  const bestDig = dc.indexOf(Math.max(...dc));
  const matchP  = (dc[bestDig] / total) * 100;

  const inds = [
    { label:"Even / Odd",         signal: even>=odd    ? "BUY EVEN"      : "BUY ODD",    pct: Math.max((even/total)*100,(odd/total)*100),    buy: even>=odd    },
    { label:"Rise / Fall",        signal: rp>=fp       ? "BUY RISE"      : "BUY FALL",   pct: Math.max(rp,fp),                               buy: rp>=fp       },
    { label:"Over / Under 5",     signal: over5>=under5 ? "BUY OVER 5"   : "BUY UNDER 5",pct: Math.max((over5/total)*100,(under5/total)*100), buy: over5>=under5 },
    { label:`Matches ${bestDig}`, signal: `BUY MATCHES ${bestDig}`,                       pct: matchP,                                        buy: true          },
  ];

  const avgPct   = inds.reduce((a,b) => a+b.pct, 0) / inds.length;
  const buys     = inds.filter(i => i.buy).length;
  const conLabel = buys>=3 ? "STRONG BUY" : buys===2 ? "NEUTRAL" : "STRONG SELL";
  const conColor = buys>=3 ? "#22C55E"    : buys===2 ? "#FACC15"  : "#EF4444";
  function sc(p:number){ return p>=65?"#22C55E":p>=55?"#FACC15":"#9CA3AF"; }

  return (
    <div className="space-y-4">
      <div className="border-2 rounded-2xl p-5 shadow-sm bg-white text-center" style={{ borderColor: conColor }}>
        <div className="text-xs font-bold text-[#9CA3AF] uppercase tracking-widest mb-2">Consensus Signal</div>
        <div className="text-4xl font-bold mb-1" style={{ color: conColor }}>{conLabel}</div>
        <div className="text-sm text-[#6B7280]">Avg confidence: <span className="font-bold text-[#1A1A1A]">{avgPct.toFixed(2)}%</span> · {digits.length} ticks</div>
        <div className="flex items-center justify-center gap-1.5 mt-1">
          <ConnDot connected={connected} />
          <span className="text-xs text-[#6B7280]">{connected ? "Live" : "Connecting..."}</span>
        </div>
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-3 text-xs font-bold text-white bg-[#4B5563] px-4 py-2.5">
          <span>Indicator</span><span className="text-center">Signal</span><span className="text-right">Confidence</span>
        </div>
        {inds.map(ind => (
          <div key={ind.label} className="grid grid-cols-3 items-center px-4 py-3 border-b border-[#E5E7EB] last:border-0">
            <span className="text-xs font-medium text-[#1A1A1A]">{ind.label}</span>
            <span className="text-xs font-bold text-center" style={{ color: sc(ind.pct) }}>{ind.signal}</span>
            <div className="flex items-center justify-end gap-2">
              <div className="w-16 h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width:`${ind.pct}%`, backgroundColor: sc(ind.pct) }} />
              </div>
              <span className="text-xs font-bold text-[#1A1A1A]">{ind.pct.toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-2xl p-4">
        <p className="text-xs text-[#1E90FF]">
          <span className="font-bold">ⓘ Smart Analysis</span> combines all 4 indicators. Strong Buy = 3–4 agree · Neutral = 2 agree · Strong Sell = 0–1 agree.
        </p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 6 — All Analysis
// ══════════════════════════════════════════════════════════════════════════════
type MktStat = { rise: number | null; fall: number | null };

function AllAnalysisTab() {
  const [stats,      setStats]      = useState<Record<string, MktStat>>(
    () => Object.fromEntries(ALL_ANALYSIS_MARKETS.map(m => [m.id, { rise:null, fall:null }]))
  );
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setStats(Object.fromEntries(ALL_ANALYSIS_MARKETS.map(m => [m.id, { rise:null, fall:null }])));
    const conns: WebSocket[] = [];
    let alive = true;

    ALL_ANALYSIS_MARKETS.forEach(mkt => {
      const ws = new WebSocket(WS_URL);
      conns.push(ws);
      ws.onopen = () => { ws.send(JSON.stringify({ ticks_history: mkt.id, count:100, end:"latest", style:"ticks" })); };
      ws.onmessage = (e) => {
        if (!alive) return;
        try {
          const msg = JSON.parse(e.data as string);
          if (msg.msg_type === "history") {
            const ps: number[] = msg.history?.prices ?? [];
            const { r, f } = calcRiseFall(ps);
            setStats(prev => ({ ...prev, [mkt.id]: { rise: r, fall: f } }));
            ws.close();
          }
        } catch (_) {}
      };
      ws.onerror = () => {}; ws.onclose = () => {};
    });

    return () => { alive = false; conns.forEach(w => { w.onclose = null; w.close(); }); };
  }, [refreshKey]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[#1E90FF] font-bold text-lg">Rise / Fall</h3>
        <button onClick={() => setRefreshKey(k => k+1)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1E90FF] text-white rounded-lg text-xs font-semibold hover:bg-[#1a7fe0] transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="bg-[#0E1C2F] rounded-2xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-3 text-xs font-bold text-white bg-[#1E2D42] px-4 py-3">
          <span>MARKET</span><span className="text-center">RISE</span><span className="text-right">FALL</span>
        </div>
        {ALL_ANALYSIS_MARKETS.map(mkt => {
          const s = stats[mkt.id];
          const loading = s.rise === null;
          return (
            <div key={mkt.id} className="grid grid-cols-3 items-center px-4 py-3 border-b border-[#1E2D42] last:border-0">
              <span className="text-xs font-medium text-[#E5E7EB]">{mkt.label}</span>
              <div className="text-center">
                {loading
                  ? <div className="w-4 h-4 border-2 border-[#1E90FF]/30 border-t-[#1E90FF] rounded-full animate-spin mx-auto" />
                  : <span className="text-sm font-bold" style={{ color: s.rise!>=50?"#22C55E":"#EF4444" }}>{s.rise!.toFixed(1)}%</span>
                }
              </div>
              <div className="text-right">
                {loading
                  ? <div className="w-4 h-4 border-2 border-[#EF4444]/30 border-t-[#EF4444] rounded-full animate-spin ml-auto" />
                  : <span className="text-sm font-bold" style={{ color: s.fall!>=50?"#22C55E":"#EF4444" }}>{s.fall!.toFixed(1)}%</span>
                }
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 7 — Tick Analyser
// ══════════════════════════════════════════════════════════════════════════════
function TickAnalyserTab() {
  const [sym,  setSym]  = useState("R_10");
  const [view, setView] = useState<"summary"|"detailed">("summary");
  const { digits, prices, latestPrice, connected } = useDerivWS(sym, 1000);

  const total   = digits.length || 1;
  const cur     = digits.length > 0 ? digits[digits.length - 1] : null;
  const { r: rp, f: fp, rn, fn } = calcRiseFall(prices);
  let over7 = 0, under3 = 0;
  digits.forEach(d => { if(d>7) over7++; if(d<3) under3++; });
  const prevPrice = prices.length > 1 ? prices[prices.length - 2] : null;
  const goingUp   = latestPrice !== null && prevPrice !== null ? latestPrice > prevPrice : null;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex rounded-lg overflow-hidden border border-[#E5E7EB]">
          {(["summary","detailed"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-2 text-sm font-semibold transition-colors ${view===v ? "bg-[#EF4444] text-white" : "bg-white text-[#6B7280] hover:bg-[#F4F6FA]"}`}>
              {v.charAt(0).toUpperCase()+v.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex-1">
          <SymSel value={sym} onChange={setSym} className="w-full" />
        </div>
        <div className="flex items-center gap-2">
          <ConnDot connected={connected} />
          <span className="text-xs text-[#6B7280]">{connected ? `${digits.length} ticks` : "Connecting..."}</span>
        </div>
      </div>

      {/* Current price row */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-sm flex items-center gap-3">
        <div className="flex-1">
          <div className="text-xs text-[#9CA3AF]">Current Price</div>
          <div className="text-2xl font-bold text-[#1A1A1A] font-mono">{latestPrice?.toFixed(3) ?? "---"}</div>
        </div>
        {cur !== null && (
          <div className="w-11 h-11 rounded-lg flex items-center justify-center text-xl font-bold text-white"
               style={{ backgroundColor:"#EF4444" }}>{cur}</div>
        )}
        {goingUp !== null && (
          <div className={`text-3xl font-bold ${goingUp?"text-[#22C55E]":"text-[#EF4444]"}`}>
            {goingUp ? <TrendingUp className="w-7 h-7" /> : <TrendingDown className="w-7 h-7" />}
          </div>
        )}
      </div>

      {/* Rise / Fall cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-sm">
          <div className="text-xs text-[#9CA3AF] mb-1">Rise</div>
          <div className="text-3xl font-bold text-[#1E90FF]">{rp.toFixed(2)}%</div>
          <div className="text-xs text-[#9CA3AF] mt-1">{rn} ticks</div>
        </div>
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-sm">
          <div className="text-xs text-[#9CA3AF] mb-1">Fall</div>
          <div className="text-3xl font-bold text-[#EF4444]">{fp.toFixed(2)}%</div>
          <div className="text-xs text-[#9CA3AF] mt-1">{fn} ticks</div>
        </div>
      </div>

      {/* Over/Under Analysis */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-sm">
        <h3 className="text-sm font-bold text-[#1A1A1A] mb-3">Over / Under Analysis</h3>
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <span className="text-xs text-[#9CA3AF]">Over 7</span>
            <div className="text-2xl font-bold text-[#22C55E]">{((over7/total)*100).toFixed(2)}%</div>
            <div className="text-xs text-[#9CA3AF]">Over 7: {over7}</div>
          </div>
          <div>
            <span className="text-xs text-[#9CA3AF]">Under 3</span>
            <div className="text-2xl font-bold text-[#EF4444]">{((under3/total)*100).toFixed(2)}%</div>
            <div className="text-xs text-[#9CA3AF]">Under 3: {under3}</div>
          </div>
        </div>
        <div className="h-5 bg-[#E5E7EB] rounded-full overflow-hidden flex">
          <div className="h-full bg-[#22C55E] transition-all" style={{ width:`${(over7/total)*100}%` }} />
          <div className="h-full bg-[#EF4444] transition-all" style={{ width:`${(under3/total)*100}%` }} />
        </div>
      </div>

      {/* Detailed: 50 digits grid */}
      {view === "detailed" && (
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-[#1A1A1A] mb-3">Last 50 Digits (green=even, red=odd)</h3>
          <div className="flex flex-wrap gap-1">
            {digits.slice(-50).map((d, i) => (
              <div key={i}
                className="w-9 h-9 rounded flex items-center justify-center text-sm font-bold text-white"
                style={{ backgroundColor: d%2===0 ? "#22C55E" : "#EF4444" }}>
                {d}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 8 — Apex AI
// ══════════════════════════════════════════════════════════════════════════════
function ApexAITab() {
  const { isLoggedIn } = useAuth();
  const [sym,      setSym]      = useState("1HZ25V");
  const [ctype,    setCtype]    = useState("EVEN");
  const [pred,     setPred]     = useState(0);
  const [stake,    setStake]    = useState(10);
  const [status,   setStatus]   = useState<string | null>(null);
  const [payout,   setPayout]   = useState<number | null>(null);
  const [propId,   setPropId]   = useState<string | null>(null);

  const { digits, prices, latestPrice, connected } = useDerivWS(sym, 100);

  const total = digits.length || 1;
  let even = 0, odd = 0, matchC = 0;
  digits.forEach(d => { if(d%2===0) even++; else odd++; if(d===pred) matchC++; });
  const { r: rp, f: fp } = calcRiseFall(prices.slice(-100));

  function getProb(): number {
    switch(ctype) {
      case "EVEN":    return (even/total)*100;
      case "ODD":     return (odd/total)*100;
      case "RISE":    return rp;
      case "FALL":    return fp;
      case "OVER":    return (digits.filter(d=>d>pred).length/total)*100;
      case "UNDER":   return (digits.filter(d=>d<pred).length/total)*100;
      case "MATCHES": return (matchC/total)*100;
      case "DIFFERS": return ((total-matchC)/total)*100;
      default:        return 50;
    }
  }

  const prob     = getProb();
  const strength = prob>=65 ? "STRONG" : prob>=55 ? "MODERATE" : "WEAK";
  const action   = prob>=55 ? `BUY ${ctype}` : "WAIT — Low probability";
  const sc       = prob>=65 ? "#22C55E" : prob>=55 ? "#FACC15" : "#9CA3AF";
  const needPred = ["OVER","UNDER","MATCHES","DIFFERS"].includes(ctype);
  const CTYPES   = ["EVEN","ODD","OVER","UNDER","MATCHES","DIFFERS","RISE","FALL"];

  const ctMap: Record<string,string> = {
    EVEN:"DIGITEVEN", ODD:"DIGITODD", OVER:"DIGITOVER", UNDER:"DIGITUNDER",
    MATCHES:"DIGITMATCH", DIFFERS:"DIGITDIFF", RISE:"CALL", FALL:"PUT",
  };

  const handleAnalyze = () => {
    if (!isLoggedIn) { window.location.href = LOGIN_URL; return; }
    const token = localStorage.getItem("deriv_token");
    if (!token) { setStatus("Please log in first"); return; }
    setStatus("Getting proposal..."); setPayout(null); setPropId(null);

    const ws = new WebSocket(WS_URL);
    ws.onopen = () => { ws.send(JSON.stringify({ authorize: token })); };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string);
        if (msg.error) { setStatus(`Error: ${msg.error.message}`); ws.close(); return; }
        if (msg.msg_type === "authorize") {
          const p: Record<string,unknown> = {
            proposal:1, amount:stake, basis:"stake",
            contract_type: ctMap[ctype] ?? "DIGITEVEN",
            currency:"USD", symbol:sym, duration:1, duration_unit:"t",
          };
          if (needPred) p.barrier = pred;
          ws.send(JSON.stringify(p));
        }
        if (msg.msg_type === "proposal") {
          setPayout(msg.proposal.payout);
          setPropId(msg.proposal.id);
          setStatus(`Payout: ${msg.proposal.payout.toFixed(2)} USD — ready to buy`);
          ws.close();
        }
      } catch (_) {}
    };
    ws.onerror = () => setStatus("Connection error");
  };

  const handleBuy = () => {
    if (!propId) { handleAnalyze(); return; }
    const token = localStorage.getItem("deriv_token");
    if (!token) { setStatus("Please log in first"); return; }
    setStatus("Placing trade...");
    const ws = new WebSocket(WS_URL);
    ws.onopen = () => { ws.send(JSON.stringify({ authorize: token })); };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string);
        if (msg.error) { setStatus(`Error: ${msg.error.message}`); ws.close(); return; }
        if (msg.msg_type === "authorize") { ws.send(JSON.stringify({ buy: propId, price: stake })); }
        if (msg.msg_type === "buy") {
          setStatus(`✓ Trade placed — Contract #${msg.buy.contract_id}`);
          setPayout(null); setPropId(null); ws.close();
          setTimeout(() => setStatus(null), 5000);
        }
      } catch (_) {}
    };
    ws.onerror = () => setStatus("Connection error");
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-[#1A1A1A]">Apex Tool - v2</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Inputs */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-sm space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#6B7280] mb-1 block">Volatility:</label>
            <SymSel value={sym} onChange={v => { setSym(v); setStatus(null); setPropId(null); setPayout(null); }} className="w-full" />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#6B7280] mb-1 block">Contract Type:</label>
            <select value={ctype} onChange={e => { setCtype(e.target.value); setStatus(null); setPropId(null); setPayout(null); }}
              className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1E90FF]">
              {CTYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {needPred && (
            <div>
              <label className="text-xs font-semibold text-[#6B7280] mb-1 block">Prediction (0–9):</label>
              <input type="number" min={0} max={9} value={pred}
                onChange={e => setPred(Math.max(0, Math.min(9, Number(e.target.value))))}
                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1E90FF]" />
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-[#6B7280] mb-1 block">Stake (USD):</label>
            <input type="number" min={1} step={1} value={stake}
              onChange={e => setStake(Math.max(1, Number(e.target.value)))}
              className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1E90FF]" />
          </div>
        </div>

        {/* Analysis output */}
        <div className="bg-white border-2 rounded-2xl p-5 shadow-sm space-y-4" style={{ borderColor: sc }}>
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-[#9CA3AF] uppercase tracking-widest">Live Analysis</div>
            <div className="flex items-center gap-1.5"><ConnDot connected={connected} /><span className="text-xs text-[#6B7280]">{connected?"Live":"..."}</span></div>
          </div>

          <div className="text-center">
            <div className="text-xs text-[#9CA3AF] mb-1">Current Price</div>
            <div className="text-4xl font-bold font-mono text-[#1E90FF]">{latestPrice?.toFixed(3) ?? "---"}</div>
          </div>

          <div className="space-y-2.5">
            {[
              ["Signal Strength",  <span className="text-sm font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor:sc }}>{strength}</span>],
              ["Recommendation",   <span className="text-sm font-bold" style={{ color:sc }}>{action}</span>],
              ["Probability",      <span className="text-sm font-bold text-[#1A1A1A]">{prob.toFixed(2)}%</span>],
              ...(payout !== null ? [["Expected Payout", <span className="text-sm font-bold text-[#22C55E]">{payout.toFixed(2)} USD</span>]] : []),
            ].map(([lbl, val], i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-xs text-[#6B7280]">{lbl as string}</span>{val as React.ReactNode}
              </div>
            ))}
          </div>

          <div className="h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width:`${prob}%`, backgroundColor: sc }} />
          </div>

          {status && (
            <div className="text-xs text-center font-medium py-1 px-2 rounded-lg"
                 style={{ color: status.startsWith("✓")?"#22C55E":status.startsWith("Error")?"#EF4444":"#1E90FF",
                          backgroundColor: status.startsWith("✓")?"#F0FDF4":status.startsWith("Error")?"#FEF2F2":"#EFF6FF" }}>
              {status}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button onClick={handleAnalyze}
              className="px-4 py-2.5 border-2 border-[#1E90FF] text-[#1E90FF] text-sm font-bold rounded-lg hover:bg-[#1E90FF] hover:text-white transition-colors">
              Analyze
            </button>
            <button onClick={handleBuy}
              className="px-4 py-2.5 text-sm font-bold text-white rounded-lg hover:opacity-90 transition-opacity"
              style={{ backgroundColor: sc }}>
              {propId ? "Place Trade" : "Buy"}
            </button>
          </div>
        </div>
      </div>

      {/* Pattern preview */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-sm">
        <h3 className="text-sm font-bold text-[#1A1A1A] mb-3">Last 100 digits — blue=even, red=odd</h3>
        <div className="flex flex-wrap gap-1">
          {digits.slice(-100).map((d,i) => (
            <div key={i} className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                 style={{ backgroundColor: d%2===0?"#1E90FF":"#EF4444" }}>
              {d}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TRADING CONFIGURATION MODAL
// ══════════════════════════════════════════════════════════════════════════════

const VOLATILITY_OPTS = [
  { label: "Volatility 10 Index",        value: "R_10"      },
  { label: "Volatility 25 Index",        value: "R_25"      },
  { label: "Volatility 50 Index",        value: "R_50"      },
  { label: "Volatility 75 Index",        value: "R_75"      },
  { label: "Volatility 100 Index",       value: "R_100"     },
  { label: "Volatility 10 (1s) Index",   value: "1HZ10V"    },
  { label: "Volatility 25 (1s) Index",   value: "1HZ25V"    },
  { label: "Volatility 50 (1s) Index",   value: "1HZ50V"    },
  { label: "Volatility 75 (1s) Index",   value: "1HZ75V"    },
  { label: "Volatility 100 (1s) Index",  value: "1HZ100V"   },
  { label: "Volatility 150 (1s) Index",  value: "1HZ150V"   },
  { label: "Volatility 200 (1s) Index",  value: "1HZ200V"   },
  { label: "Volatility 250 (1s) Index",  value: "1HZ250V"   },
  { label: "Boom 300 Index",             value: "BOOM300N"  },
  { label: "Boom 500 Index",             value: "BOOM500N"  },
  { label: "Boom 1000 Index",            value: "BOOM1000N" },
  { label: "Crash 300 Index",            value: "CRASH300N" },
  { label: "Crash 500 Index",            value: "CRASH500N" },
  { label: "Crash 1000 Index",           value: "CRASH1000N"},
  { label: "Jump 10 Index",              value: "JD10"      },
  { label: "Jump 25 Index",              value: "JD25"      },
  { label: "Jump 50 Index",              value: "JD50"      },
  { label: "Jump 75 Index",              value: "JD75"      },
  { label: "Jump 100 Index",             value: "JD100"     },
  { label: "Step Index 100",             value: "stpRNG100" },
];

const MARKET_OPTS = [
  "Continuous Indices", "Crash / Boom Indices", "Jump Indices",
  "Step Indices", "Forex", "Cryptocurrencies", "Metals",
];

const TRADE_TYPE_OPTS = [
  { label: "Rise / Fall",       value: "rise_fall"    },
  { label: "Higher / Lower",    value: "higher_lower" },
  { label: "Even / Odd",        value: "even_odd"     },
  { label: "Matches / Differs", value: "matches"      },
  { label: "Over / Under",      value: "over_under"   },
  { label: "Touch / No Touch",  value: "touch"        },
  { label: "Accumulators",      value: "accumulators" },
  { label: "Multipliers",       value: "multipliers"  },
];

const TYPE_OPTS = [
  { label: "Call (Rise)", value: "call"   },
  { label: "Put (Fall)",  value: "put"    },
  { label: "Even",        value: "even"   },
  { label: "Odd",         value: "odd"    },
  { label: "Over",        value: "over"   },
  { label: "Under",       value: "under"  },
  { label: "Match",       value: "match"  },
  { label: "Differ",      value: "differ" },
];

const CONTRACT_OPTS = [
  { label: "CALL",       value: "CALL"       },
  { label: "PUT",        value: "PUT"        },
  { label: "DIGITEVEN",  value: "DIGITEVEN"  },
  { label: "DIGITODD",   value: "DIGITODD"   },
  { label: "DIGITMATCH", value: "DIGITMATCH" },
  { label: "DIGITDIFF",  value: "DIGITDIFF"  },
  { label: "DIGITOVER",  value: "DIGITOVER"  },
  { label: "DIGITUNDER", value: "DIGITUNDER" },
  { label: "ACCU",       value: "ACCU"       },
  { label: "MULTUP",     value: "MULTUP"     },
  { label: "MULTDOWN",   value: "MULTDOWN"   },
];

const CURRENCY_OPTS = ["USD", "EUR", "GBP", "AUD", "JPY"];

interface TradingConfig {
  volatility:     string;
  market:         string;
  tradeType:      string;
  type:           string;
  contract:       string;
  prediction:     number;
  prediction2:    number;
  duration:       number;
  stake:          number;
  currency:       string;
  candleInterval: number;
}

const DEFAULT_CONFIG: TradingConfig = {
  volatility:     "R_100",
  market:         "Continuous Indices",
  tradeType:      "rise_fall",
  type:           "call",
  contract:       "CALL",
  prediction:     5,
  prediction2:    3,
  duration:       5,
  stake:          10,
  currency:       "USD",
  candleInterval: 60,
};

/* ── Reusable dropdown ────────────────────────────────────────────────────── */
function CFGSelect({ label, value, onChange, opts }: {
  label:    string;
  value:    string;
  onChange: (v: string) => void;
  opts:     { label: string; value: string }[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide">
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full appearance-none rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2.5 pr-8 text-sm text-[#1A1A1A] outline-none focus:border-[#1E90FF] focus:ring-2 focus:ring-[#1E90FF]/15 transition-all cursor-pointer"
        >
          {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {/* chevron */}
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-xs">▾</span>
      </div>
    </div>
  );
}

/* ── Reusable number input with optional right suffix ─────────────────────── */
function CFGNumber({ label, value, onChange, suffix, min = 0, step = 1 }: {
  label:    string;
  value:    number;
  onChange: (v: number) => void;
  suffix?:  string;
  min?:     number;
  step?:    number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide">
        {label}
      </label>
      <div className="relative flex items-center">
        <input
          type="number"
          value={value}
          min={min}
          step={step}
          onChange={e => onChange(Number(e.target.value))}
          className={`w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2.5 text-sm text-[#1A1A1A] outline-none focus:border-[#1E90FF] focus:ring-2 focus:ring-[#1E90FF]/15 transition-all ${suffix ? "pr-16" : ""}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 text-xs font-semibold text-[#9CA3AF]">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Modal component ──────────────────────────────────────────────────────── */
function TradingConfigModal({ open, onClose, config, onChange, onRun, runStatus, isRunning }: {
  open:       boolean;
  onClose:    () => void;
  config:     TradingConfig;
  onChange:   (k: keyof TradingConfig, v: string | number) => void;
  onRun:      () => void;
  runStatus?: string | null;
  isRunning?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxWidth: 400, maxHeight: "90dvh", animation: "tcm-in 0.2s cubic-bezier(0.34,1.26,0.64,1) both" }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0F0F0] shrink-0 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0E1C2F] flex items-center justify-center shrink-0">
              <Settings className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1A1A1A] leading-tight">Trading Configuration</h2>
              <p className="text-[10px] text-[#9CA3AF] leading-tight">Adjust your trading parameters</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-[#9CA3AF] hover:text-[#1A1A1A] hover:bg-[#F4F6FA] transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Scrollable form body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3.5">

          <CFGSelect
            label="Volatility"
            value={config.volatility}
            onChange={v => onChange("volatility", v)}
            opts={VOLATILITY_OPTS}
          />

          <CFGSelect
            label="Market"
            value={config.market}
            onChange={v => onChange("market", v)}
            opts={MARKET_OPTS.map(m => ({ label: m, value: m }))}
          />

          <CFGSelect
            label="Trade Type"
            value={config.tradeType}
            onChange={v => onChange("tradeType", v)}
            opts={TRADE_TYPE_OPTS}
          />

          <CFGSelect
            label="Type"
            value={config.type}
            onChange={v => onChange("type", v)}
            opts={TYPE_OPTS}
          />

          <CFGSelect
            label="Contract"
            value={config.contract}
            onChange={v => onChange("contract", v)}
            opts={CONTRACT_OPTS}
          />

          {/* Two prediction fields side-by-side */}
          <div className="grid grid-cols-2 gap-3">
            <CFGNumber
              label="Prediction"
              value={config.prediction}
              onChange={v => onChange("prediction", v)}
              min={0}
            />
            <CFGNumber
              label="Prediction 2"
              value={config.prediction2}
              onChange={v => onChange("prediction2", v)}
              min={0}
            />
          </div>

          <CFGNumber
            label="Duration"
            value={config.duration}
            onChange={v => onChange("duration", v)}
            suffix="Ticks"
            min={1}
          />

          {/* Stake with inline currency selector */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide">Stake</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={config.stake}
                min={1}
                step={0.01}
                onChange={e => onChange("stake", Number(e.target.value))}
                className="flex-1 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2.5 text-sm text-[#1A1A1A] outline-none focus:border-[#1E90FF] focus:ring-2 focus:ring-[#1E90FF]/15 transition-all"
              />
              <div className="relative">
                <select
                  value={config.currency}
                  onChange={e => onChange("currency", e.target.value)}
                  className="h-full appearance-none rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 pr-7 py-2.5 text-sm font-semibold text-[#1A1A1A] outline-none focus:border-[#1E90FF] focus:ring-2 focus:ring-[#1E90FF]/15 transition-all cursor-pointer"
                  style={{ minWidth: 72 }}
                >
                  {CURRENCY_OPTS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-xs">▾</span>
              </div>
            </div>
          </div>

          <CFGNumber
            label="Candle Interval"
            value={config.candleInterval}
            onChange={v => onChange("candleInterval", v)}
            min={1}
          />
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-4 border-t border-[#F0F0F0] shrink-0 bg-[#FAFAFA] flex flex-col gap-2">
          {/* Status message */}
          {runStatus && (
            <div
              className="w-full text-xs font-medium text-center px-3 py-2 rounded-lg"
              style={{
                color: runStatus.startsWith("✓") ? "#16A34A"
                     : runStatus.startsWith("Error") || runStatus.startsWith("!") ? "#EF4444"
                     : "#1E90FF",
                backgroundColor: runStatus.startsWith("✓") ? "#F0FDF4"
                                : runStatus.startsWith("Error") || runStatus.startsWith("!") ? "#FEF2F2"
                                : "#EFF6FF",
              }}
            >
              {runStatus}
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={onRun}
              disabled={isRunning}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#22C55E] hover:bg-[#16A34A] active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all shadow-sm shadow-[#22C55E]/30"
            >
              {isRunning
                ? <RefreshCw className="w-4 h-4 animate-spin" />
                : <TrendingUp className="w-4 h-4" />}
              {isRunning ? "Placing..." : "Run"}
            </button>
            <span className="text-[11px] text-[#9CA3AF] text-right leading-tight">
              Executes trade<br />with your config
            </span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes tcm-in {
          from { opacity: 0; transform: scale(0.92) translateY(12px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);    }
        }
      `}</style>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN — AnalysisTool
// ══════════════════════════════════════════════════════════════════════════════
export default function AnalysisTool() {
  const { isLoggedIn } = useAuth();

  const [activeTab,    setActiveTab]    = useState("circles");
  const [globalSym,    setGlobalSym]    = useState("R_10");
  const [tickWindow,   setTickWindow]   = useState(1000);
  const [showConfig,   setShowConfig]   = useState(false);
  const [config,       setConfig]       = useState<TradingConfig>(DEFAULT_CONFIG);
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [runStatus,    setRunStatus]    = useState<string | null>(null);
  const [isRunning,    setIsRunning]    = useState(false);

  const handleConfigChange = (k: keyof TradingConfig, v: string | number) =>
    setConfig(prev => ({ ...prev, [k]: v }));

  const handleRun = () => {
    if (!isLoggedIn) {
      setShowAuthGate(true);
      return;
    }
    const token = localStorage.getItem("deriv_token");
    if (!token) {
      setShowAuthGate(true);
      return;
    }
    setIsRunning(true);
    setRunStatus("Connecting...");

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      ws.send(JSON.stringify({ authorize: token }));
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data as string);
        if (msg.error) {
          setRunStatus(`! ${msg.error.message}`);
          setIsRunning(false);
          ws.close();
          return;
        }
        if (msg.msg_type === "authorize") {
          setRunStatus("Getting price...");
          const params: Record<string, unknown> = {
            proposal:       1,
            amount:         config.stake,
            basis:          "stake",
            contract_type:  config.contract,
            currency:       config.currency,
            symbol:         config.volatility,
            duration:       config.duration,
            duration_unit:  "t",
          };
          if (["DIGITMATCH","DIGITDIFF","DIGITOVER","DIGITUNDER"].includes(config.contract)) {
            params.barrier = String(config.prediction);
          }
          ws.send(JSON.stringify(params));
        }
        if (msg.msg_type === "proposal") {
          setRunStatus("Placing trade...");
          ws.send(JSON.stringify({ buy: msg.proposal.id, price: config.stake }));
        }
        if (msg.msg_type === "buy") {
          setRunStatus(`✓ Trade placed — Contract #${msg.buy.contract_id}`);
          setIsRunning(false);
          ws.close();
          setTimeout(() => {
            setRunStatus(null);
            setShowConfig(false);
          }, 4000);
        }
      } catch (_) {
        setRunStatus("! Unexpected error");
        setIsRunning(false);
        ws.close();
      }
    };

    ws.onerror = () => {
      setRunStatus("Error: connection failed");
      setIsRunning(false);
    };
  };

  const globalWS = useDerivWS(globalSym, tickWindow);
  const usesGlobal = ["circles","signals","smart"].includes(activeTab);

  const renderTab = () => {
    switch (activeTab) {
      case "circles":      return <DcIrclesTab {...globalWS} tickWindow={tickWindow} setTickWindow={setTickWindow} />;
      case "signals":      return <SignalsTab digits={globalWS.digits} prices={globalWS.prices} connected={globalWS.connected} />;
      case "apex":         return <ApexAnalysisTab />;
      case "dptools":      return <DPToolsTab />;
      case "smart":        return <SmartAnalysisTab digits={globalWS.digits} prices={globalWS.prices} connected={globalWS.connected} />;
      case "allanalysis":  return <AllAnalysisTab />;
      case "tickanalyser": return <TickAnalyserTab />;
      case "apexai":       return <ApexAITab />;
      default:             return null;
    }
  };

  return (
    <div className="flex flex-col bg-[#F4F6FA]" style={{ minHeight:"calc(100dvh - 132px)" }}>

      <AuthGateModal
        open={showAuthGate}
        onClose={() => setShowAuthGate(false)}
      />

      <TradingConfigModal
        open={showConfig}
        onClose={() => { setShowConfig(false); setRunStatus(null); setIsRunning(false); }}
        config={config}
        onChange={handleConfigChange}
        onRun={handleRun}
        runStatus={runStatus}
        isRunning={isRunning}
      />

      {/* Top controls bar */}
      <div className="bg-white border-b border-[#E5E7EB] px-4 py-2.5 flex items-center gap-3 flex-wrap shrink-0">
        {usesGlobal && (
          <SymSel value={globalSym} onChange={setGlobalSym} className="flex-1 min-w-[160px] max-w-[240px]" />
        )}
        <div className="flex items-center gap-1.5 text-xs text-[#6B7280] ml-auto">
          <ConnDot connected={usesGlobal ? globalWS.connected : true} />
          <span>{usesGlobal ? (globalWS.connected ? `${globalWS.digits.length} ticks · Live` : "Connecting...") : "Live data per tab"}</span>
        </div>
        <button
          onClick={() => setShowConfig(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#0E1C2F] text-white rounded-lg text-xs font-semibold hover:bg-[#1E2D42] transition-colors shrink-0"
        >
          <Settings className="w-3.5 h-3.5" /> Trading Configuration
        </button>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-[#E5E7EB] overflow-x-auto no-scrollbar shrink-0">
        <div className="flex w-max min-w-full px-2 pt-2">
          {TABS.map(t => {
            const isActive = activeTab === t.id;
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`px-4 py-2 text-xs font-semibold whitespace-nowrap border-b-2 transition-all mr-0.5 rounded-t-md ${
                  isActive ? "border-[#1E90FF] text-[#1E90FF] bg-[#EFF6FF]" : "border-transparent text-[#9CA3AF] hover:text-[#1A1A1A] hover:bg-[#F4F6FA]"
                }`}>
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-3 md:p-4">
        {renderTab()}
      </div>
    </div>
  );
}
