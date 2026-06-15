import { useState, useRef } from "react";
import { ChevronDown } from "lucide-react";
import LightweightChart from "@/components/LightweightChart";

interface Market { id: string; label: string; badge: string }
const mk = (id: string, label: string, badge: string): Market => ({ id, label, badge });

const CONTINUOUS = [mk("1HZ10V","Volatility 10 (1s) Index","10"),mk("R_10","Volatility 10 Index","10"),mk("1HZ25V","Volatility 25 (1s) Index","25"),mk("R_25","Volatility 25 Index","25"),mk("1HZ50V","Volatility 50 (1s) Index","50"),mk("R_50","Volatility 50 Index","50"),mk("1HZ75V","Volatility 75 (1s) Index","75"),mk("R_75","Volatility 75 Index","75"),mk("1HZ100V","Volatility 100 (1s) Index","100"),mk("R_100","Volatility 100 Index","100")];

const MARKET_GROUPS = [
  { label: "Continuous Indices", items: CONTINUOUS, color: "#1E90FF" },
];

const ALL_MARKETS = MARKET_GROUPS.flatMap(g => g.items);
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
    <div style={{ height: "calc(100dvh - 56px)", background: "#f2f3f4", fontFamily: "'IBM Plex Sans','Inter',sans-serif", display: "flex", flexDirection: "column" }}>

      {/* Market selector bar */}
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
      </div>

      {/* Chart fills remaining space */}
      <div className="flex-1 min-h-0 bg-[#0f172a]">
        <LightweightChart symbol={sym.id} onPriceUpdate={handlePrice} />
      </div>

      {/* Market picker modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModal(false)} />
          <div className="relative w-full bg-white rounded-t-3xl shadow-2xl flex flex-col" style={{ height: "90vh" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] shrink-0">
              <h2 className="text-base font-bold text-[#1A1A1A]">Markets</h2>
              <button onClick={() => setModal(false)} className="p-1 text-[#6B7280] hover:text-[#1A1A1A]">✕</button>
            </div>
            <div className="overflow-y-auto flex-1">
              {MARKET_GROUPS.map(g => (
                <div key={g.label} className="border-b border-[#E5E7EB]">
                  <div className="px-4 py-2 text-xs font-bold text-[#1A1A1A] uppercase tracking-wide bg-[#F4F6FA]">{g.label}</div>
                  {g.items.map(m => (
                    <button key={m.id} onClick={() => { setSym(m); setModal(false); setLive(null); prevRef.current = null; }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#F4F6FA] transition-colors">
                      <div className="w-10 h-7 rounded-md flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ backgroundColor: g.color }}>
                        {m.badge.length > 4 ? m.badge.slice(0, 4) : m.badge}
                      </div>
                      <span className="flex-1 text-left text-[#1A1A1A] font-medium truncate">{m.label}</span>
                      {m.id === sym.id && <span className="w-2 h-2 rounded-full bg-[#1E90FF] shrink-0" />}
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
