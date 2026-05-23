import { useState, useEffect, useRef } from "react";
import {
  Wifi, WifiOff, LogIn, Clock, TrendingUp, TrendingDown,
  Bot, BarChart2, Brain, Layers, Users, Zap, Eye, ArrowRight,
} from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { useAuth } from "@/context/AuthContext";
import { DERIV_APP_ID } from "@/context/AuthContext";

const WS_URL = `wss://ws.binaryws.com/websockets/v3?app_id=${DERIV_APP_ID}`;

const TICKER_SYMBOLS = [
  { id: "1HZ100V", label: "Vol 100 (1s)", pip: 2 },
  { id: "R_100",   label: "Vol 100",      pip: 2 },
  { id: "R_50",    label: "Vol 50",       pip: 2 },
];

const SPARKLINE_LENGTH = 20;

type Prices = Record<string, number | null>;
type TickHistory = Record<string, { v: number }[]>;

function navigate(tab: string) {
  window.dispatchEvent(new CustomEvent("tradex:navigate", { detail: tab }));
}

const FEATURES = [
  {
    id: "Bot Builder",
    icon: Bot,
    title: "Bot Builder",
    desc: "Design automated trading bots with a visual drag-and-drop interface. No coding required.",
    color: "#3B82F6",
    bg: "bg-primary/10",
    border: "border-primary/30",
    highlight: true,
  },
  {
    id: "Manual Traders",
    icon: TrendingUp,
    title: "Manual Traders",
    desc: "Trade Accumulators, Rise/Fall, Multipliers and 6 more contract types with live charts.",
    color: "#22C55E",
    bg: "bg-[#22C55E]/10",
    border: "border-[#22C55E]/30",
    highlight: false,
  },
  {
    id: "Charts",
    icon: BarChart2,
    title: "Charts",
    desc: "Live tick-by-tick price charts with high, low, open stats powered by Deriv WebSocket.",
    color: "#3B82F6",
    bg: "bg-primary/10",
    border: "border-primary/30",
    highlight: false,
  },
  {
    id: "Analysis Tool",
    icon: Brain,
    title: "Analysis Tool",
    desc: "Digit frequency analysis, even/odd ratios, and last-digit statistics for informed entries.",
    color: "#FACC15",
    bg: "bg-[#FACC15]/10",
    border: "border-[#FACC15]/30",
    highlight: false,
  },
  {
    id: "Strategies",
    icon: Layers,
    title: "Strategies",
    desc: "Pre-built and custom trading strategies. Back-test and deploy with one click.",
    color: "#3B82F6",
    bg: "bg-primary/10",
    border: "border-primary/30",
    highlight: false,
  },
  {
    id: "Copy Trading",
    icon: Users,
    title: "Copy Trading",
    desc: "Follow top traders and automatically mirror their positions in real time.",
    color: "#22C55E",
    bg: "bg-[#22C55E]/10",
    border: "border-[#22C55E]/30",
    highlight: false,
  },
  {
    id: "Trading Bots",
    icon: Zap,
    title: "Trading Bots",
    desc: "Run, monitor and manage your active bots. View live P&L and trade history.",
    color: "#FACC15",
    bg: "bg-[#FACC15]/10",
    border: "border-[#FACC15]/30",
    highlight: false,
  },
  {
    id: "TradingView",
    icon: Eye,
    title: "TradingView",
    desc: "Professional charting powered by TradingView with hundreds of indicators.",
    color: "#3B82F6",
    bg: "bg-primary/10",
    border: "border-primary/30",
    highlight: false,
  },
];

function formatTradeTime(ts: number) {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function parseSymbolFromShortcode(shortcode: string | null): string {
  if (!shortcode) return "—";
  const parts = shortcode.split("_");
  if (parts.length >= 3) {
    return parts.slice(1, parts.length - 3).join("_") || shortcode;
  }
  return shortcode;
}

function parseContractType(shortcode: string | null): string {
  if (!shortcode) return "Trade";
  const type = shortcode.split("_")[0];
  const labels: Record<string, string> = {
    CALL: "Rise", PUT: "Fall", DIGITOVER: "Digit Over", DIGITUNDER: "Digit Under",
    DIGITEVEN: "Digit Even", DIGITODD: "Digit Odd", DIGITDIFF: "Digit Differs",
    DIGITMATCH: "Digit Match", ACCU: "Accumulator", MULTUP: "Multi Up",
    MULTDOWN: "Multi Down", VANILLALONGCALL: "Vanilla Call", VANILLALONGPUT: "Vanilla Put",
  };
  return labels[type] ?? type;
}

export default function Dashboard() {
  const { isLoggedIn, isAuthorized, activeAccount, balance, currency, wsConnected, login, recentTrades } = useAuth();
  const [prices, setPrices] = useState<Prices>({ "1HZ100V": null, R_100: null, R_50: null });
  const [prevPrices, setPrevPrices] = useState<Prices>({});
  const [tickHistory, setTickHistory] = useState<TickHistory>({
    "1HZ100V": [], R_100: [], R_50: [],
  });
  const wsRef  = useRef<WebSocket | null>(null);
  const mountRef = useRef(true);

  useEffect(() => {
    mountRef.current = true;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountRef.current) return;
      TICKER_SYMBOLS.forEach(s => ws.send(JSON.stringify({ ticks: s.id, subscribe: 1 })));
    };

    ws.onmessage = (evt) => {
      if (!mountRef.current) return;
      try {
        const msg = JSON.parse(evt.data);
        if (msg.msg_type === "tick") {
          const { symbol, quote } = msg.tick;
          setPrices(prev => {
            setPrevPrices(pp => ({ ...pp, [symbol]: prev[symbol] ?? quote }));
            return { ...prev, [symbol]: quote };
          });
          setTickHistory(prev => {
            const hist = [...(prev[symbol] ?? []), { v: quote }];
            return { ...prev, [symbol]: hist.length > SPARKLINE_LENGTH ? hist.slice(-SPARKLINE_LENGTH) : hist };
          });
        }
      } catch (_) {}
    };

    return () => {
      mountRef.current = false;
      ws.onclose = null;
      ws.close();
    };
  }, []);

  const formattedBalance = balance !== null && currency
    ? `${currency} ${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : null;

  return (
    <div className="min-h-full bg-background overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-5 space-y-6">

        {/* ── Hero / Status banner ─────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl font-bold text-primary">TradeX</span>
              <span className="text-[10px] font-bold px-1.5 py-[2px] rounded bg-[#FACC15]/20 text-[#FACC15]">PRO</span>
            </div>
            {isLoggedIn ? (
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${wsConnected && isAuthorized ? "bg-[#22C55E]" : "bg-[#FACC15] animate-pulse"}`}/>
                <span className="text-sm text-foreground font-medium">
                  {wsConnected && isAuthorized
                    ? `Connected · ${activeAccount?.account ?? ""}`
                    : "Connecting to Deriv…"}
                </span>
                {formattedBalance && (
                  <span className="ml-2 text-sm font-bold text-[#22C55E]">{formattedBalance}</span>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Connect your Deriv account to start trading.
              </p>
            )}
          </div>

          {isLoggedIn ? (
            <div className="flex items-center gap-2 shrink-0 text-xs font-medium">
              {wsConnected && isAuthorized
                ? <><Wifi className="w-4 h-4 text-[#22C55E]"/><span className="text-[#22C55E]">Live — Deriv connected</span></>
                : <><WifiOff className="w-4 h-4 text-[#FACC15]"/><span className="text-[#FACC15]">Reconnecting…</span></>}
            </div>
          ) : (
            <button
              onClick={login}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors shrink-0"
            >
              <LogIn className="w-4 h-4"/>
              Log In to Deriv
            </button>
          )}
        </div>

        {/* ── Live ticker with sparklines ──────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {TICKER_SYMBOLS.map(sym => {
            const p    = prices[sym.id];
            const prev = prevPrices[sym.id];
            const up   = p !== null && prev !== null ? p > prev : null;
            const color = up === true ? "#22C55E" : up === false ? "#EF4444" : undefined;
            const history = tickHistory[sym.id] ?? [];
            return (
              <div key={sym.id}
                className="bg-card border border-border rounded-xl px-3 py-3 flex flex-col gap-0.5 cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => navigate("Charts")}
              >
                <span className="text-[10px] text-muted-foreground font-medium truncate">{sym.label}</span>
                <span className="text-sm sm:text-base font-bold font-mono truncate transition-colors"
                  style={{ color: color ?? "var(--color-foreground)" }}>
                  {p !== null ? p.toFixed(sym.pip) : "—"}
                </span>
                {up !== null && (
                  <span className="text-[10px] font-semibold" style={{ color: color }}>
                    {up ? "▲" : "▼"}
                  </span>
                )}
                {history.length >= 3 ? (
                  <div className="mt-1.5 h-8 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={history} margin={{ top: 1, right: 1, bottom: 1, left: 1 }}>
                        <Line
                          type="monotone"
                          dataKey="v"
                          dot={false}
                          strokeWidth={1.5}
                          stroke={color ?? "#6B7280"}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="mt-1.5 h-8 w-full flex items-center">
                    <div className="h-px w-full bg-border opacity-50" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Recent Trades ────────────────────────────────────────────── */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            Recent Trades
          </h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {!isLoggedIn ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">Log in to see your recent trade history.</p>
                <button
                  onClick={login}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary text-xs font-semibold rounded-lg hover:bg-primary/20 transition-colors"
                >
                  <LogIn className="w-3 h-3" />
                  Log In
                </button>
              </div>
            ) : !isAuthorized ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground animate-pulse">Loading trades…</p>
              </div>
            ) : recentTrades.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">No recent trades found for this account.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentTrades.map(trade => {
                  const isProfit = trade.amount > 0;
                  const contractType = parseContractType(trade.shortcode);
                  const symbol = parseSymbolFromShortcode(trade.shortcode);
                  return (
                    <div key={trade.transaction_id} className="flex items-center gap-3 px-4 py-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        isProfit ? "bg-[#22C55E]/10" : "bg-[#EF4444]/10"
                      }`}>
                        {isProfit
                          ? <TrendingUp className="w-3.5 h-3.5 text-[#22C55E]" />
                          : <TrendingDown className="w-3.5 h-3.5 text-[#EF4444]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-foreground truncate">{contractType}</span>
                          <span className="text-[10px] text-muted-foreground truncate">· {symbol}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">{formatTradeTime(trade.transaction_time)}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-xs font-bold ${isProfit ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
                          {isProfit ? "+" : ""}{trade.amount.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Bal: {trade.balance_after.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>


      </div>
    </div>
  );
}
