import { useState, useRef } from "react";
import { X, Search, Star, ChevronDown, ChevronRight, Play, RotateCcw } from "lucide-react";
import LightweightChart from "@/components/LightweightChart";
import { useBot } from "@/context/BotContext";

interface Market { id: string; label: string; badge: string }
const mk = (id: string, label: string, badge: string): Market => ({ id, label, badge });

const FAV_KEY = "tradex-charts-fav-markets";

const COMMODITIES_BASKET = [mk("WLDGOLD","Gold Basket","GLD")];
const FOREX_BASKET = [mk("WLDAUD","AUD Basket","AUD"),mk("WLDEUR","EUR Basket","EUR"),mk("WLDGBP","GBP Basket","GBP"),mk("WLDUSD","USD Basket","USD")];
const CONTINUOUS = [mk("1HZ10V","Volatility 10 (1s) Index","10"),mk("R_10","Volatility 10 Index","10"),mk("1HZ25V","Volatility 25 (1s) Index","25"),mk("R_25","Volatility 25 Index","25"),mk("1HZ50V","Volatility 50 (1s) Index","50"),mk("R_50","Volatility 50 Index","50"),mk("1HZ75V","Volatility 75 (1s) Index","75"),mk("R_75","Volatility 75 Index","75"),mk("1HZ100V","Volatility 100 (1s) Index","100"),mk("R_100","Volatility 100 Index","100"),mk("1HZ150V","Volatility 150 (1s) Index","150"),mk("1HZ200V","Volatility 200 (1s) Index","200"),mk("1HZ250V","Volatility 250 (1s) Index","250")];
const CRASH_BOOM = [mk("BOOM300N","Boom 300 Index","B300"),mk("BOOM500N","Boom 500 Index","B500"),mk("BOOM600N","Boom 600 Index","B600"),mk("BOOM900N","Boom 900 Index","B900"),mk("BOOM1000N","Boom 1000 Index","B1K"),mk("CRASH300N","Crash 300 Index","C300"),mk("CRASH500N","Crash 500 Index","C500"),mk("CRASH600N","Crash 600 Index","C600"),mk("CRASH900N","Crash 900 Index","C900"),mk("CRASH1000N","Crash 1000 Index","C1K")];
const DAILY_RESET = [mk("BRMIDX","Bear Market Index","BEAR"),mk("BULIDX","Bull Market Index","BULL")];
const JUMP = [mk("JD10","Jump 10 Index","J10"),mk("JD25","Jump 25 Index","J25"),mk("JD50","Jump 50 Index","J50"),mk("JD75","Jump 75 Index","J75"),mk("JD100","Jump 100 Index","J100")];
const RANGE_BREAK = [mk("RB100","Range Break 100 Index","RB100"),mk("RB200","Range Break 200 Index","RB200")];
const STEP = [mk("stpRNG100","Step Index 100","S100"),mk("stpRNG200","Step Index 200","S200"),mk("stpRNG300","Step Index 300","S300"),mk("stpRNG400","Step Index 400","S400"),mk("stpRNG500","Step Index 500","S500")];
const MAJOR_PAIRS = [mk("frxAUDJPY","AUD/JPY","AUDJPY"),mk("frxAUDUSD","AUD/USD","AUDUSD"),mk("frxEURAUD","EUR/AUD","EURAUD"),mk("frxEURCAD","EUR/CAD","EURCAD"),mk("frxEURCHF","EUR/CHF","EURCHF"),mk("frxEURGBP","EUR/GBP","EURGBP"),mk("frxEURJPY","EUR/JPY","EURJPY"),mk("frxEURUSD","EUR/USD","EURUSD"),mk("frxGBPAUD","GBP/AUD","GBPAUD"),mk("frxGBPJPY","GBP/JPY","GBPJPY"),mk("frxGBPUSD","GBP/USD","GBPUSD"),mk("frxUSDCAD","USD/CAD","USDCAD"),mk("frxUSDCHF","USD/CHF","USDCHF"),mk("frxUSDJPY","USD/JPY","USDJPY")];
const MINOR_PAIRS = [mk("frxAUDCHF","AUD/CHF","AUDCHF"),mk("frxAUDNZD","AUD/NZD","AUDNZD"),mk("frxEURNZD","EUR/NZD","EURNZD"),mk("frxGBPCAD","GBP/CAD","GBPCAD"),mk("frxGBPCHF","GBP/CHF","GBPCHF"),mk("frxGBPNZD","GBP/NZD","GBPNZD"),mk("frxNZDJPY","NZD/JPY","NZDJPY"),mk("frxNZDUSD","NZD/USD","NZDUSD"),mk("frxUSDMXN","USD/MXN","USDMXN"),mk("frxUSDNOK","USD/NOK","USDNOK"),mk("frxUSDPLN","USD/PLN","USDPLN"),mk("frxUSDSEK","USD/SEK","USDSEK")];
const AMERICAN_INDICES = [mk("SPC","US 500","US500"),mk("USTECH100","US Tech 100","NAS"),mk("DJI","Wall Street 30","DJ30")];
const ASIAN_INDICES = [mk("AS51","Australia 200","AUS200"),mk("HSI","Hong Kong 50","HK50"),mk("N225","Japan 225","JPN225")];
const EUROPEAN_INDICES = [mk("STOXX50E","Europe 50","EU50"),mk("CAC","France 40","FR40"),mk("GER40","Germany 40","GER40"),mk("AEX","Netherlands 25","NL25"),mk("SMI","Swiss 20","CH20"),mk("UK100","UK 100","UK100")];
const CRYPTOS = [mk("cryBTCUSD","BTC/USD","BTC"),mk("cryETHUSD","ETH/USD","ETH")];
const METALS = [mk("frxXAUAUD","Gold/AUD","XAUAUD"),mk("frxXAUUSD","Gold/USD","XAUUSD"),mk("frxXPDUSD","Palladium/USD","XPDUSD"),mk("frxXPTUSD","Platinum/USD","XPTUSD")];

const MARKET_GROUPS = [
  { label: "Commodities Basket",  items: COMMODITIES_BASKET,  color: "#F59E0B" },
  { label: "Forex Basket",        items: FOREX_BASKET,        color: "#22C55E" },
  { label: "Continuous Indices",  items: CONTINUOUS,          color: "#1E90FF" },
  { label: "Crash/Boom Indices",  items: CRASH_BOOM,          color: "#EF4444" },
  { label: "Daily Reset Indices", items: DAILY_RESET,         color: "#6B7280" },
  { label: "Jump Indices",        items: JUMP,                color: "#F59E0B" },
  { label: "Range Break Indices", items: RANGE_BREAK,         color: "#7C3AED" },
  { label: "Step Indices",        items: STEP,                color: "#1A1A1A" },
  { label: "Major Pairs",         items: MAJOR_PAIRS,         color: "#22C55E" },
  { label: "Minor Pairs",         items: MINOR_PAIRS,         color: "#22C55E" },
  { label: "American Indices",    items: AMERICAN_INDICES,    color: "#EF4444" },
  { label: "Asian Indices",       items: ASIAN_INDICES,       color: "#F59E0B" },
  { label: "European Indices",    items: EUROPEAN_INDICES,    color: "#1E90FF" },
  { label: "Cryptocurrencies",    items: CRYPTOS,             color: "#F59E0B" },
  { label: "Metals",              items: METALS,              color: "#FACC15" },
];

const ALL_MARKETS = MARKET_GROUPS.flatMap(g => g.items);
const DEFAULT_MKT = CONTINUOUS.find(m => m.id === "R_100")!;

function MarketsBottomSheet({ selected, onSelect, onClose }: {
  selected: Market; onSelect: (m: Market) => void; onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [favIds, setFavIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(FAV_KEY) || "[]"); } catch { return []; }
  });
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleFav = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavIds(prev => {
      const next = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
      localStorage.setItem(FAV_KEY, JSON.stringify(next));
      return next;
    });
  };

  const q = query.trim().toLowerCase();
  const filtered = q ? ALL_MARKETS.filter(m => m.label.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)) : null;
  const favMarkets = ALL_MARKETS.filter(m => favIds.includes(m.id));

  const MarketRow = ({ m, color }: { m: Market; color?: string }) => (
    <button onClick={() => { onSelect(m); onClose(); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#F4F6FA] transition-colors">
      <button onClick={e => toggleFav(m.id, e)} className="shrink-0">
        <Star className={`w-4 h-4 transition-colors ${favIds.includes(m.id) ? "text-[#1E90FF] fill-[#1E90FF]" : "text-[#D1D5DB] hover:text-[#1E90FF]"}`} />
      </button>
      <div className="w-10 h-7 rounded flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ backgroundColor: color || "#1E90FF" }}>
        {m.badge.length > 4 ? m.badge.slice(0, 4) : m.badge}
      </div>
      <span className="flex-1 text-left text-[#1A1A1A] font-medium truncate">{m.label}</span>
      {m.id === selected.id && <span className="w-2 h-2 rounded-full bg-[#1E90FF] shrink-0" />}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full bg-white rounded-t-3xl shadow-2xl flex flex-col" style={{ height: "90vh" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] shrink-0">
          <h2 className="text-base font-bold text-[#1A1A1A]">Markets</h2>
          <button onClick={onClose} className="p-1 text-[#6B7280] hover:text-[#1A1A1A]"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-4 py-3 border-b border-[#E5E7EB] shrink-0">
          <div className="flex items-center gap-2 bg-[#F4F6FA] border border-[#E5E7EB] rounded-full px-4 py-2.5">
            <Search className="w-4 h-4 text-[#9CA3AF] shrink-0" />
            <input autoFocus type="text" placeholder="Search markets…" value={query} onChange={e => setQuery(e.target.value)} className="flex-1 bg-transparent text-sm text-[#1A1A1A] placeholder:text-[#9CA3AF] outline-none" />
            {query && <button onClick={() => setQuery("")}><X className="w-4 h-4 text-[#9CA3AF]" /></button>}
          </div>
        </div>
        <div className="overflow-y-auto flex-1">
          {filtered ? (
            <>
              <div className="px-4 py-2 text-xs text-[#6B7280] font-semibold uppercase tracking-wide bg-[#F4F6FA] border-b border-[#E5E7EB]">Results ({filtered.length})</div>
              {filtered.length === 0 ? <p className="text-sm text-[#6B7280] text-center py-10">No markets found</p>
                : filtered.map(m => { const grp = MARKET_GROUPS.find(g => g.items.some(i => i.id === m.id)); return <MarketRow key={m.id} m={m} color={grp?.color} />; })}
            </>
          ) : (
            <>
              <div className="border-b border-[#E5E7EB]">
                <button onClick={() => setCollapsed(c => ({ ...c, __favs: !c.__favs }))} className="w-full flex items-center justify-between px-4 py-2.5 bg-[#F4F6FA] hover:bg-[#EAECF0]">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#1E90FF] uppercase tracking-wide"><Star className="w-3.5 h-3.5 fill-[#1E90FF]" /> Favorites</div>
                  {collapsed.__favs ? <ChevronRight className="w-4 h-4 text-[#9CA3AF]" /> : <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />}
                </button>
                {!collapsed.__favs && (favMarkets.length === 0 ? <p className="text-sm text-[#9CA3AF] text-center py-5 italic">No favorites yet.</p>
                  : favMarkets.map(m => { const grp = MARKET_GROUPS.find(g => g.items.some(i => i.id === m.id)); return <MarketRow key={m.id} m={m} color={grp?.color} />; }))}
              </div>
              {MARKET_GROUPS.map(g => (
                <div key={g.label} className="border-b border-[#E5E7EB]">
                  <button onClick={() => setCollapsed(c => ({ ...c, [g.label]: !c[g.label] }))} className="w-full flex items-center justify-between px-4 py-2.5 bg-[#F4F6FA] hover:bg-[#EAECF0]">
                    <span className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wide">{g.label}</span>
                    {collapsed[g.label] ? <ChevronRight className="w-4 h-4 text-[#9CA3AF]" /> : <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />}
                  </button>
                  {!collapsed[g.label] && g.items.map(m => <MarketRow key={m.id} m={m} color={g.color} />)}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

type RightTab = "summary" | "transactions" | "journal";

export default function Charts() {
  const [sym, setSym] = useState<Market>(DEFAULT_MKT);
  const [showModal, setModal] = useState(false);
  const [livePrice, setLive] = useState<number | null>(null);
  const prevRef = useRef<number | null>(null);
  const [priceDir, setPriceDir] = useState<"up" | "down" | null>(null);
  const [activeTab, setActiveTab] = useState<RightTab>("summary");
  const { isRunning, setIsRunning, totalStake, totalPayout, totalProfit, won, lost, runs, results, reset } = useBot();

  const dp = livePrice != null ? (livePrice > 100 ? 2 : livePrice > 10 ? 4 : 5) : 2;
  const handlePrice = (p: number) => {
    if (prevRef.current !== null) setPriceDir(p >= prevRef.current ? "up" : "down");
    prevRef.current = p;
    setLive(p);
  };
  const grpColor = MARKET_GROUPS.find(g => g.items.some(i => i.id === sym.id))?.color || "#1E90FF";

  return (
    <div className="flex flex-col lg:flex-row" style={{ height: "calc(100dvh - 132px)", background: "#f2f3f4", fontFamily: "'IBM Plex Sans','Inter',sans-serif" }}>
      {showModal && (
        <MarketsBottomSheet selected={sym} onSelect={m => { setSym(m); setModal(false); setLive(null); prevRef.current = null; }} onClose={() => setModal(false)} />
      )}

      {/* LEFT: Chart */}
      <div className="flex flex-col flex-1 min-w-0 min-h-[50vh] lg:min-h-0">
        <div className="bg-white border-b border-[#d6dadb] flex items-center px-3 py-2 gap-3 shrink-0">
          <button onClick={() => setModal(true)} className="flex items-center gap-2 bg-[#f2f3f4] rounded-lg px-3 py-1.5 hover:bg-[#e6e9e9] transition-colors shrink-0">
            <div className="w-7 h-7 rounded-md flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ background: grpColor }}>
              {sym.badge.slice(0, 4)}
            </div>
            <div className="flex flex-col items-start">
              <span className="text-xs font-bold text-[#1A1A1A] leading-tight">{sym.label}</span>
              {livePrice != null && (
                <span className={`text-[10px] font-mono font-semibold leading-tight ${priceDir === "down" ? "text-[#ec3f3f]" : "text-[#4bb4b3]"}`}>
                  {livePrice.toFixed(dp)} {priceDir === "down" ? "▼" : "▲"}
                </span>
              )}
            </div>
            <ChevronDown className="w-4 h-4 text-[#999] shrink-0 ml-1" />
          </button>
          {livePrice != null && (
            <div className="hidden sm:flex flex-col items-center bg-[#f2f3f4] rounded-lg px-3 py-1.5 shrink-0">
              <span className={`text-sm font-bold font-mono ${priceDir === "down" ? "text-[#ec3f3f]" : "text-[#4bb4b3]"}`}>{livePrice.toFixed(dp)}</span>
              <span className="text-[10px] text-[#9CA3AF]">{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</span>
            </div>
          )}
        </div>
        <div className="flex-1 min-h-0 bg-[#0f172a]">
          <LightweightChart symbol={sym.id} onPriceUpdate={handlePrice} />
        </div>
      </div>

      {/* RIGHT: Bot panel */}
      <div className="w-full lg:w-[340px] shrink-0 flex flex-col bg-white border-t lg:border-t-0 lg:border-l border-[#E5E7EB]">
        <div className="flex items-center border-b border-[#E5E7EB] shrink-0">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-bold transition-colors ${isRunning ? "bg-[#EF4444] text-white hover:bg-[#DC2626]" : "bg-[#22C55E] text-white hover:bg-[#16A34A]"}`}
          >
            {isRunning ? <span className="w-3 h-3 rounded-sm bg-white shrink-0" /> : <Play className="w-4 h-4" />}
            {isRunning ? "Stop" : "Run"}
          </button>
          <div className="flex-1 px-3 py-3 text-xs text-[#6B7280]">
            {isRunning
              ? <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse inline-block" />Bot is running</span>
              : "Bot is not running"}
          </div>
        </div>

        <div className="flex border-b border-[#E5E7EB] shrink-0">
          {(["summary","transactions","journal"] as RightTab[]).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-xs font-semibold capitalize transition-colors ${activeTab === tab ? "border-b-2 border-[#1E90FF] text-[#1E90FF]" : "text-[#6B7280] hover:text-[#1A1A1A]"}`}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === "summary" && (
            <div className="flex flex-col h-full">
              {runs === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center px-6 text-center bg-[#FFFBEB] py-10">
                  <div className="w-12 h-12 rounded-full bg-[#FEF3C7] flex items-center justify-center mb-3">
                    <Play className="w-6 h-6 text-[#F59E0B]" />
                  </div>
                  <p className="text-sm font-semibold text-[#1A1A1A] mb-1">When you're ready to trade, hit Run.</p>
                  <p className="text-xs text-[#6B7280]">You'll be able to track your bot's performance here.</p>
                </div>
              ) : (
                <div className="p-4 flex flex-col gap-3">
                  <div className="grid grid-cols-3 gap-3">
                    {[{label:"Total stake",value:`${totalStake.toFixed(2)} USD`},{label:"Total payout",value:`${totalPayout.toFixed(2)} USD`},{label:"No. of runs",value:runs}].map(s => (
                      <div key={s.label} className="bg-[#F9FAFB] rounded-lg p-3 text-center">
                        <div className="text-xs text-[#6B7280] mb-1">{s.label}</div>
                        <div className="text-sm font-bold text-[#1A1A1A]">{s.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      {label:"Contracts lost",value:lost,color:"#EF4444"},
                      {label:"Contracts won",value:won,color:"#22C55E"},
                      {label:"Total profit/loss",value:`${totalProfit>=0?"+":""}${totalProfit.toFixed(2)} USD`,color:totalProfit>=0?"#22C55E":"#EF4444"},
                    ].map(s => (
                      <div key={s.label} className="bg-[#F9FAFB] rounded-lg p-3 text-center">
                        <div className="text-xs text-[#6B7280] mb-1">{s.label}</div>
                        <div className="text-sm font-bold" style={{color:s.color}}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="p-4 border-t border-[#E5E7EB] mt-auto">
                <button onClick={reset} className="w-full flex items-center justify-center gap-2 py-2 border border-[#E5E7EB] rounded-lg text-sm text-[#6B7280] hover:bg-[#F9FAFB] transition-colors">
                  <RotateCcw className="w-4 h-4" /> Reset
                </button>
              </div>
            </div>
          )}

          {activeTab === "transactions" && (
            <div className="flex flex-col h-full">
              {results.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center px-6 text-center text-[#6B7280] py-10">
                  <p className="text-sm">No transactions yet.</p>
                  <p className="text-xs mt-1">Run the bot to start trading.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#E5E7EB]">
                  {results.slice().reverse().map(r => (
                    <div key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
                      <div className="flex flex-col">
                        <span className="font-medium text-[#1A1A1A]">Contract #{r.id.slice(-6)}</span>
                        <span className="text-xs text-[#6B7280]">{new Date(r.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className={`font-bold ${r.status==="won"?"text-[#22C55E]":r.status==="lost"?"text-[#EF4444]":"text-[#6B7280]"}`}>
                          {r.status==="open"?"Open":r.profit!=null?`${r.profit>=0?"+":""}${r.profit.toFixed(2)}`:"—"}
                        </span>
                        <span className="text-xs text-[#6B7280]">Stake: {r.buyPrice.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "journal" && (
            <div className="flex-1 flex flex-col items-center justify-center px-6 text-center text-[#6B7280] py-10">
              <p className="text-sm font-medium text-[#1A1A1A] mb-1">Journal</p>
              <p className="text-xs">Bot activity logs will appear here when the bot is running.</p>
              {isRunning && (
                <div className="mt-4 w-full text-left bg-[#F9FAFB] rounded-lg p-3 text-xs font-mono text-[#6B7280] space-y-1">
                  <p className="text-[#22C55E]">[{new Date().toLocaleTimeString()}] Bot started</p>
                  <p>[{new Date().toLocaleTimeString()}] Monitoring {sym.label}...</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
