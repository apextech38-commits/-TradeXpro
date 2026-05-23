import { useState } from "react";
import { Bot, CheckCircle } from "lucide-react";
import { useBot } from "@/context/BotContext";

interface BotConfig {
  name: string;
  symbol: string;
  contractType: string;
  stake: number;
  stopLoss: number;
  takeProfit: number;
  martingale: number;
  duration: number;
  durationUnit: string;
  market: string;
  tradeType: string;
  tagline: string;
  color: string;
}

const BOT_CONFIGS: BotConfig[] = [
  {
    name: "TradeX Pro Atlas",
    symbol: "R_100",      market: "Volatility 100 Index",
    contractType: "DIGITEVEN", tradeType: "Digits Even/Odd",
    stake: 1, stopLoss: 2000, takeProfit: 10, martingale: 2,
    duration: 1, durationUnit: "t",
    tagline: "High-frequency even/odd trading on V100 with smart Martingale scaling.",
    color: "from-blue-500 to-indigo-600",
  },
  {
    name: "TradeX Pro Nova",
    symbol: "R_25",       market: "Volatility 25 Index",
    contractType: "DIGITOVER", tradeType: "Over/Under 5",
    stake: 1, stopLoss: 1000, takeProfit: 5, martingale: 1.5,
    duration: 1, durationUnit: "t",
    tagline: "Conservative over/under strategy on V25 with moderate risk.",
    color: "from-purple-500 to-violet-600",
  },
  {
    name: "TradeX Pro Orion",
    symbol: "1HZ10V",     market: "Volatility 10 (1s) Index",
    contractType: "DIGITMATCH", tradeType: "Digits Match/Differ",
    stake: 0.5, stopLoss: 500, takeProfit: 3, martingale: 1,
    duration: 1, durationUnit: "t",
    tagline: "Precision digit matching on the fast-paced V10 1s market.",
    color: "from-cyan-500 to-teal-600",
  },
  {
    name: "TradeX Pro Vega",
    symbol: "R_75",       market: "Volatility 75 Index",
    contractType: "CALL",       tradeType: "Rise/Fall",
    stake: 2, stopLoss: 3000, takeProfit: 15, martingale: 1,
    duration: 5, durationUnit: "t",
    tagline: "Momentum-based rise/fall trading on the V75 trend market.",
    color: "from-orange-500 to-amber-600",
  },
  {
    name: "TradeX Pro Titan",
    symbol: "1HZ100V",    market: "Volatility 100 (1s) Index",
    contractType: "DIGITEVEN", tradeType: "Digits Even/Odd",
    stake: 5, stopLoss: 5000, takeProfit: 25, martingale: 3,
    duration: 1, durationUnit: "t",
    tagline: "Aggressive high-stake strategy for professional traders.",
    color: "from-red-500 to-rose-600",
  },
  {
    name: "TradeX Pro Zenith",
    symbol: "R_50",       market: "Volatility 50 Index",
    contractType: "DIGITUNDER", tradeType: "Over/Under 7",
    stake: 1, stopLoss: 800, takeProfit: 4, martingale: 1,
    duration: 1, durationUnit: "t",
    tagline: "Under-7 digit strategy optimized for the balanced V50 market.",
    color: "from-emerald-500 to-green-600",
  },
  {
    name: "TradeX Pro Apex",
    symbol: "1HZ200V",    market: "Volatility 200 (1s) Index",
    contractType: "DIGITEVEN", tradeType: "Digits Even/Odd",
    stake: 10, stopLoss: 10000, takeProfit: 50, martingale: 4,
    duration: 1, durationUnit: "t",
    tagline: "Elite ultra-high-frequency bot for maximum volatility scalping.",
    color: "from-pink-500 to-fuchsia-600",
  },
];

const SUBTABS = ["Free Bots", "SpeedBots", "Calculator", "Strategies"];

export default function TradingBots() {
  const [activeSubTab, setActiveSubTab] = useState("Free Bots");
  const [toast, setToast] = useState<string | null>(null);
  const { setParams, setBotLoaded } = useBot();

  const loadBot = (cfg: BotConfig) => {
    setParams({
      symbol: cfg.symbol,
      contractType: cfg.contractType,
      duration: cfg.duration,
      durationUnit: cfg.durationUnit,
      stake: cfg.stake,
    });
    setBotLoaded(true);

    // Show toast
    setToast(`${cfg.name} loaded successfully`);
    setTimeout(() => setToast(null), 3500);

    // Navigate to Trading Bots tab (dbot runner)
    window.dispatchEvent(new CustomEvent("tradex:navigate", { detail: "Trading Bots" }));
  };

  return (
    <div className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-[#22C55E] text-white px-5 py-3 rounded-xl shadow-2xl font-semibold text-sm animate-in fade-in slide-in-from-top-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {toast}
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex overflow-x-auto border-b border-border mb-8 no-scrollbar">
        {SUBTABS.map(tab => (
          <button
            key={tab}
            data-testid={`subtab-${tab.toLowerCase().replace(/\s+/g, "-")}`}
            onClick={() => setActiveSubTab(tab)}
            className={`px-6 py-3 font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeSubTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeSubTab === "Free Bots" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {BOT_CONFIGS.map((bot, i) => (
            <div
              key={bot.name}
              data-testid={`card-bot-${i}`}
              className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 transition-all group shadow-sm flex flex-col"
            >
              {/* Gradient header */}
              <div className={`h-2 bg-gradient-to-r ${bot.color}`} />

              <div className="p-6 flex flex-col flex-1">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${bot.color} shadow-md`}>
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <span className="bg-[#FACC15] text-black text-[10px] font-bold px-2 py-1 rounded tracking-wider">
                    PREMIUM
                  </span>
                </div>

                <h3 className="text-lg font-bold text-foreground mb-1">{bot.name}</h3>
                <div className="flex gap-0.5 mb-2">
                  {[1,2,3,4,5].map(s => <span key={s} className="text-[#FACC15] text-sm">★</span>)}
                </div>
                <p className="text-muted-foreground text-xs mb-3 flex-1">{bot.tagline}</p>

                {/* Config preview */}
                <div className="grid grid-cols-2 gap-1.5 mb-4 text-xs">
                  {[
                    ["Market",   bot.market.replace("Volatility ", "V")],
                    ["Type",     bot.tradeType],
                    ["Stake",    `$${bot.stake}`],
                    ["Stop Loss",`$${bot.stopLoss}`],
                    ["Take Profit",`$${bot.takeProfit}`],
                    ["Martingale", `×${bot.martingale}`],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-secondary rounded-md px-2 py-1.5">
                      <div className="text-muted-foreground text-[10px]">{k}</div>
                      <div className="text-foreground font-semibold truncate">{v}</div>
                    </div>
                  ))}
                </div>

                <button
                  data-testid={`button-load-bot-${i}`}
                  onClick={() => loadBot(bot)}
                  className={`w-full py-2.5 rounded-lg font-semibold transition-all text-sm bg-gradient-to-r ${bot.color} text-white hover:opacity-90 hover:shadow-md`}
                >
                  Load Premium Bot
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeSubTab !== "Free Bots" && (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
          <Bot className="w-12 h-12 opacity-30" />
          <p className="text-sm">{activeSubTab} coming soon</p>
        </div>
      )}
    </div>
  );
}
