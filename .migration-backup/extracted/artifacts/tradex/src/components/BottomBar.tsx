import { useState, useRef, useEffect } from "react";
import { Play, Square, ChevronUp, ChevronDown, X } from "lucide-react";
import { useBot } from "@/context/BotContext";
import { useAuth } from "@/context/AuthContext";
import { DERIV_APP_ID } from "@/context/AuthContext";

const WS_URL = `wss://ws.binaryws.com/websockets/v3?app_id=${DERIV_APP_ID}`;
const TOKEN_KEY = "deriv_token";

function useClock() {
  const [ts, setTs] = useState(() => new Date().toLocaleString("en-GB", {
    year:"numeric", month:"2-digit", day:"2-digit",
    hour:"2-digit", minute:"2-digit", second:"2-digit",
  }));
  useEffect(() => {
    const id = setInterval(() => setTs(new Date().toLocaleString("en-GB", {
      year:"numeric", month:"2-digit", day:"2-digit",
      hour:"2-digit", minute:"2-digit", second:"2-digit",
    })), 1000);
    return () => clearInterval(id);
  }, []);
  return ts;
}

export default function BottomBar() {
  const [expanded, setExpanded]             = useState(false);
  const [activeTab, setActiveTab]           = useState("Summary");
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [statusMsg, setStatusMsg]           = useState("Bot is not running");
  const [noBot, setNoBot]                   = useState(false);

  const tradeWsRef = useRef<WebSocket | null>(null);
  const { isLoggedIn } = useAuth();
  const {
    botLoaded, isRunning, params,
    results, totalStake, totalPayout, totalProfit, won, lost, runs,
    setIsRunning, addResult, reset,
  } = useBot();

  const clock = useClock();

  const stopBot = () => {
    tradeWsRef.current?.close();
    tradeWsRef.current = null;
    setIsRunning(false);
    setStatusMsg("Bot stopped");
  };

  const runBot = () => {
    if (!botLoaded) {
      setNoBot(true);
      setTimeout(() => setNoBot(false), 3000);
      return;
    }
    if (!isLoggedIn) {
      setStatusMsg("Please log in to trade");
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setStatusMsg("No Deriv token found — please log in");
      return;
    }

    setIsRunning(true);
    setStatusMsg("Connecting to Deriv...");
    setExpanded(true);
    setActiveTab("Summary");

    const ws = new WebSocket(WS_URL);
    tradeWsRef.current = ws;

    ws.onopen = () => {
      setStatusMsg("Authorizing...");
      ws.send(JSON.stringify({ authorize: token }));
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.error) {
          setStatusMsg(`Error: ${msg.error.message}`);
          setIsRunning(false);
          return;
        }

        if (msg.msg_type === "authorize") {
          setStatusMsg("Placing trade...");
          ws.send(JSON.stringify({
            buy: 1,
            subscribe: 1,
            price: params.stake,
            parameters: {
              amount: params.stake,
              basis: "stake",
              contract_type: params.contractType,
              currency: "USD",
              duration: params.duration,
              duration_unit: params.durationUnit,
              symbol: params.symbol,
            },
          }));
          return;
        }

        if (msg.msg_type === "buy") {
          const b = msg.buy;
          setStatusMsg(`Contract ${b.contract_id} open — waiting for result...`);
          addResult({
            id: String(b.contract_id),
            buyPrice: b.buy_price,
            payout: b.payout,
            profit: null,
            status: "open",
            timestamp: Date.now(),
          });
          return;
        }

        if (msg.msg_type === "proposal_open_contract") {
          const c = msg.proposal_open_contract;
          if (c.is_sold) {
            const profit = c.profit ?? 0;
            const status = profit >= 0 ? "won" : "lost";
            addResult({
              id: String(c.contract_id),
              buyPrice: c.buy_price,
              payout: c.payout,
              profit,
              status,
              timestamp: Date.now(),
            });
            setStatusMsg(`Contract ${status === "won" ? "WON" : "LOST"} — profit: ${profit >= 0 ? "+" : ""}${profit.toFixed(2)}`);
            setIsRunning(false);
          }
        }
      } catch (_) {}
    };

    ws.onerror = () => {
      setStatusMsg("WebSocket error — check connection");
      setIsRunning(false);
    };
    ws.onclose = () => {
      if (isRunning) setStatusMsg("Connection closed");
    };
  };

  return (
    <>
      {/* Risk Disclaimer Modal */}
      {showDisclaimer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          onClick={e => { if (e.target === e.currentTarget) setShowDisclaimer(false); }}
        >
          <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-2xl w-full max-w-sm p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#1A1A1A]">Risk Disclaimer</h2>
              <button onClick={() => setShowDisclaimer(false)} className="p-1 text-[#6B7280] hover:text-[#1A1A1A] rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-[#1A1A1A] leading-relaxed mb-6">
              <span className="font-bold">Important Risk Warning</span>{" "}
              Deriv offers complex derivatives, such as options and contracts for difference ("CFDs"). These products may not be suitable for all clients, and trading them puts you at risk. You may lose some or all of the money you invest. Never trade with borrowed money or money you cannot afford to lose.
            </p>
            <button
              onClick={() => setShowDisclaimer(false)}
              className="w-full py-2.5 bg-[#1E90FF] hover:bg-[#1a7fe0] text-white font-bold rounded-lg text-sm"
            >
              I Understand
            </button>
          </div>
        </div>
      )}

      {/* No-bot toast */}
      {noBot && (
        <div className="fixed bottom-[64px] left-1/2 -translate-x-1/2 z-50 bg-[#EF4444] text-white text-sm font-medium px-5 py-2.5 rounded-xl shadow-xl">
          Please load or build a bot first
        </div>
      )}

      {/* Expanded Panel */}
      {expanded && (
        <div className="fixed bottom-[52px] left-0 right-0 z-40 bg-[#F4F6FA] border-t border-[#E5E7EB] shadow-[0_-10px_40px_rgba(0,0,0,0.10)]">
          <div className="flex items-center gap-6 px-6 border-b border-[#E5E7EB] bg-white">
            {["Summary", "Transactions", "Journal"].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-[#1E90FF] text-[#1E90FF]"
                    : "border-transparent text-[#6B7280] hover:text-[#1A1A1A]"
                }`}
              >
                {tab}
              </button>
            ))}
            <div className="flex-1" />
            <button
              onClick={reset}
              className="text-xs text-[#6B7280] hover:text-[#1A1A1A] border border-[#E5E7EB] px-3 py-1 rounded hover:bg-[#F4F6FA]"
            >
              Reset
            </button>
          </div>

          <div className="p-4">
            {activeTab === "Summary" && (
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                {[
                  { label: "Total Stake",     val: totalStake.toFixed(2)  },
                  { label: "Total Payout",    val: totalPayout.toFixed(2) },
                  { label: "No. of Runs",     val: String(runs)           },
                  { label: "Contracts Lost",  val: String(lost)           },
                  { label: "Contracts Won",   val: String(won)            },
                  {
                    label: "Total Profit/Loss",
                    val: (totalProfit >= 0 ? "+" : "") + totalProfit.toFixed(2),
                    highlight: true,
                    positive: totalProfit >= 0,
                  },
                ].map(stat => (
                  <div key={stat.label} className="bg-white border border-[#E5E7EB] rounded-lg p-4 shadow-sm">
                    <div className="text-xs text-[#6B7280] mb-1">{stat.label}</div>
                    <div className={`text-lg font-bold ${
                      stat.highlight
                        ? stat.positive ? "text-[#22C55E]" : "text-[#EF4444]"
                        : "text-[#1A1A1A]"
                    }`}>
                      {stat.val}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "Transactions" && (
              results.length === 0 ? (
                <div className="h-24 flex items-center justify-center text-[#6B7280] text-sm">
                  No transactions yet.
                </div>
              ) : (
                <div className="overflow-auto max-h-48 space-y-2">
                  {results.map(r => (
                    <div key={r.id} className="flex items-center justify-between bg-white border border-[#E5E7EB] rounded-lg px-4 py-2 text-sm">
                      <span className="text-[#6B7280] font-mono text-xs">#{r.id}</span>
                      <span className="text-[#1A1A1A]">Stake: {r.buyPrice.toFixed(2)}</span>
                      <span className={`font-semibold px-2 py-0.5 rounded text-xs ${
                        r.status === "won" ? "bg-[#22C55E]/10 text-[#22C55E]" :
                        r.status === "lost" ? "bg-[#EF4444]/10 text-[#EF4444]" :
                        "bg-[#1E90FF]/10 text-[#1E90FF]"
                      }`}>
                        {r.status === "open" ? "Open" : r.status === "won" ? `+${r.profit?.toFixed(2)}` : r.profit?.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )
            )}

            {activeTab === "Journal" && (
              <div className="h-24 flex items-center justify-center text-[#6B7280] text-sm">
                No journal entries yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Bar */}
      <div className="h-[52px] bg-white border-t border-[#E5E7EB] fixed bottom-0 left-0 right-0 z-40 flex items-center px-4 gap-3 shadow-sm">
        <button
          onClick={() => setShowDisclaimer(true)}
          className="text-[#1E90FF] border border-[#1E90FF] px-3 py-1.5 rounded text-xs font-semibold hover:bg-[#1E90FF]/10 transition-colors whitespace-nowrap shrink-0"
        >
          Risk Disclaimer
        </button>

        <div className="w-[1px] h-6 bg-[#E5E7EB] shrink-0" />

        {isRunning ? (
          <button
            onClick={stopBot}
            className="bg-[#EF4444] hover:bg-red-600 text-white w-8 h-8 rounded flex items-center justify-center shrink-0 transition-colors"
            aria-label="Stop bot"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>
        ) : (
          <button
            onClick={runBot}
            className="bg-[#1E90FF] hover:bg-[#1a7fe0] text-white w-8 h-8 rounded flex items-center justify-center shrink-0 transition-colors"
            aria-label="Run bot"
          >
            <Play className="w-4 h-4 fill-current ml-0.5" />
          </button>
        )}

        <span className={`text-xs whitespace-nowrap shrink-0 ${isRunning ? "text-[#1E90FF] animate-pulse" : "text-[#6B7280]"}`}>
          {statusMsg}
        </span>

        {isRunning && (
          <div className="hidden md:flex items-center flex-1 px-2 h-full min-w-0">
            <div className="w-full h-1 bg-[#E5E7EB] rounded-full overflow-hidden">
              <div className="h-full bg-[#1E90FF] rounded-full animate-pulse w-1/3" />
            </div>
          </div>
        )}

        <span className="hidden md:block text-[11px] text-[#6B7280] font-mono ml-auto shrink-0 select-none">
          {clock}
        </span>

        <button
          onClick={() => setExpanded(!expanded)}
          className="p-2 text-[#6B7280] hover:text-[#1A1A1A] hover:bg-[#F4F6FA] rounded transition-colors shrink-0"
        >
          {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
        </button>
      </div>
    </>
  );
}
