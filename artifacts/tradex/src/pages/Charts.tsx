import { useState, useRef } from "react";
import { ChevronDown } from "lucide-react";
import LightweightChart from "@/components/LightweightChart";

interface Market { id: string; label: string; badge: string }
const mk = (id: string, label: string, badge: string): Market => ({ id, label, badge });

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
  { label: "Commodities Basket", items: COMMODITIES_BASKET, color: "#F59E0B" },
  { label: "Forex Basket", items: FOREX_BASKET, color: "#22C55E" },
  { label: "Continuous Indices", items: CONTINUOUS, color: "#1E90FF" },
  { label: "Crash/Boom Indices", items: CRASH_BOOM, color: "#EF4444" },
  { label: "Daily Reset Indices", items: DAILY_RESET, color: "#6B7280" },
  { label: "Jump Indices", items: JUMP, color: "#F59E0B" },
  { label: "Range Break Indices", items: RANGE_BREAK, color: "#7C3AED" },
  { label: "Step Indices", items: STEP, color: "#1A1A1A" },
  { label: "Major Pairs", items: MAJOR_PAIRS, color: "#22C55E" },
  { label: "Minor Pairs", items: MINOR_PAIRS, color: "#22C55E" },
  { label: "American Indices", items: AMERICAN_INDICES, color: "#EF4444" },
  { label: "Asian Indices", items: ASIAN_INDICES, color: "#F59E0B" },
  { label: "European Indices", items: EUROPEAN_INDICES, color: "#1E90FF" },
  { label: "Cryptocurrencies", items: CRYPTOS, color: "#F59E0B" },
  { label: "Metals", items: METALS, color: "#FACC15" },
];

const DEFAULT_MKT = CONTINUOUS.find(m => m.id === "R_100")!;

export default function Charts() {
  const [sym, setSym] = useState<Market>(DEFAULT_MKT);
  const [showModal, setModal] = useState(false);
  const [livePrice, setLive] = useState<number | null>(null);
  const [priceDir, setPriceDir] = useState<"up" | "down" | null>(null);
  const prevRef = useRef<number | null>(null);

  const dp = livePrice != null ? (livePrice > 100 ? 2 : livePrice > 10 ? 4 : 5) : 2;

  const handlePrice = (p: number) => {
    if (prevRef.current !== null) setPriceDir(p >= prevRef.current ? "up" : "down");
    prevRef.current = p;
    setLive(p);
  };

  const grpColor = MARKET_GROUPS.find(g => g.items.some(i => i.id === sym.id))?.color || "#1E90FF";

  return (
    <div className="flex flex-col bg-background" style={{ height: "calc(100dvh - 56px)" }}>
      <div className="bg-background border-b border-border flex items-center px-3 py-2 gap-3 shrink-0">
        <button onClick={() => setModal(true)} className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5 hover:bg-muted/70 transition-colors shrink-0">
          <div className="w-7 h-7 rounded-md flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ background: grpColor }}>
            {sym.badge.slice(0, 4)}
          </div>
          <div className="flex flex-col items-start">
            <span className="text-xs font-bold text-foreground leading-tight">{sym.label}</span>
            {livePrice != null && (
              <span className={`text-[10px] font-mono font-semibold leading-tight ${priceDir === "down" ? "text-red-500" : "text-teal-500"}`}>
                {livePrice.toFixed(dp)} {priceDir === "down" ? "▼" : "▲"}
              </span>
            )}
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 ml-1" />
        </button>
      </div>
      <div className="flex-1 min-h-0 bg-[#0f172a]">
        <LightweightChart symbol={sym.id} onPriceUpdate={handlePrice} />
      </div>
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModal(false)} />
          <div className="relative w-full bg-background rounded-t-3xl shadow-2xl flex flex-col" style={{ height: "90vh" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <h2 className="text-base font-bold text-foreground">Markets</h2>
              <button onClick={() => setModal(false)} className="p-1 text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="overflow-y-auto flex-1">
              {MARKET_GROUPS.map(g => (
                <div key={g.label} className="border-b border-border">
                  <div className="px-4 py-2 text-xs font-bold text-foreground uppercase tracking-wide bg-muted">{g.label}</div>
                  {g.items.map(m => (
                    <button key={m.id} onClick={() => { setSym(m); setModal(false); setLive(null); prevRef.current = null; }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors">
                      <div className="w-10 h-7 rounded-md flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ backgroundColor: g.color }}>
                        {m.badge.length > 4 ? m.badge.slice(0, 4) : m.badge}
                      </div>
                      <span className="flex-1 text-left text-foreground font-medium truncate">{m.label}</span>
                      {m.id === sym.id && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
