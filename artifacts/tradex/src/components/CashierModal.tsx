import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// TradeX Pro — Cashier Modal
// ---------------------------------------------------------------------------
// Calls Deriv's `cashier` API directly (using your registered app_id) to get
// a live, session-scoped deposit/withdraw URL, then opens it in a new tab.
//
// Platform constraints (not stylistic choices — hard requirements):
//   1. Deriv's cashier pages send X-Frame-Options: DENY, so they cannot be
//      embedded in an iframe. This opens a new tab, same as the previous
//      static-link version did.
//   2. Cashier only works on REAL money accounts. Demo accounts get a clear
//      inline message instead of a failed API call.
//   3. Requires an authorized WS connection — token read from the same
//      localStorage key AuthContext already writes to.
// ---------------------------------------------------------------------------

const APP_ID = "33ughhvgtxloGWBQQZEeD";
const WS_URL = `wss://api.derivws.com/trading/v1/options/ws/public?app_id=${APP_ID}`;
const TOKEN_KEY = "tradex_access_token";

type CashierAction = "deposit" | "withdraw";
type Status = "idle" | "connecting" | "requesting" | "success" | "error";

interface CashierModalProps {
  open: boolean;
  onClose: () => void;
  isDemo?: boolean;
}

export default function CashierModal({ open, onClose, isDemo = false }: CashierModalProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [action, setAction] = useState<CashierAction | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!open) {
      setStatus("idle");
      setAction(null);
      setErrorMsg("");
      wsRef.current?.close();
      wsRef.current = null;
    }
  }, [open]);

  const requestCashierUrl = (type: CashierAction) => {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      setStatus("error");
      setErrorMsg("No active session found. Please log in again.");
      return;
    }

    if (isDemo) {
      setStatus("error");
      setErrorMsg("Cashier is only available on a real-money account. Switch out of Demo to continue.");
      return;
    }

    setAction(type);
    setStatus("connecting");
    setErrorMsg("");

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ authorize: token }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.msg_type === "authorize") {
        if (data.error) {
          setStatus("error");
          setErrorMsg(data.error.message || "Authorization failed.");
          ws.close();
          return;
        }
        setStatus("requesting");
        ws.send(
          JSON.stringify({
            cashier: type,
            provider: "doughflow",
            type: "url",
          })
        );
      }

      if (data.msg_type === "cashier") {
        if (data.error) {
          setStatus("error");
          setErrorMsg(data.error.message || `Unable to open ${type} page.`);
          ws.close();
          return;
        }
        setStatus("success");
        window.open(data.cashier as string, "_blank", "noopener,noreferrer");
        ws.close();
      }
    };

    ws.onerror = () => {
      setStatus("error");
      setErrorMsg("Connection to Deriv failed. Check your network and try again.");
    };

    ws.onclose = () => {
      wsRef.current = null;
    };
  };

  if (!open) return null;

  const busy = status === "connecting" || status === "requesting";

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full bg-background rounded-t-3xl shadow-2xl flex flex-col" style={{ height: "auto" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-bold text-foreground">Cashier</h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">✕</button>
        </div>

        <div className="flex flex-col gap-3 p-5">
          {status === "error" && (
            <div className="px-4 py-3 text-xs rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444]">
              {errorMsg}
            </div>
          )}

          {busy && (
            <div className="px-4 py-3 text-xs rounded-lg bg-[#1E90FF]/10 border border-[#1E90FF]/30 text-[#1E90FF]">
              {status === "connecting" ? "Connecting to Deriv…" : `Preparing your ${action} link…`}
            </div>
          )}

          {status === "success" && (
            <div className="px-4 py-3 text-xs rounded-lg bg-[#22C55E]/10 border border-[#22C55E]/30 text-[#22C55E]">
              Opened your {action} page in a new tab. Didn't see it? Check your popup blocker.
            </div>
          )}

          <button
            onClick={() => requestCashierUrl("deposit")}
            disabled={busy}
            className="w-full flex items-center gap-3 px-4 py-4 bg-[#22C55E]/10 border border-[#22C55E]/30 rounded-xl hover:bg-[#22C55E]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-2xl">💰</span>
            <div className="text-left">
              <div className="font-semibold text-foreground">Deposit</div>
              <div className="text-xs text-muted-foreground">Add funds to your account</div>
            </div>
          </button>

          <button
            onClick={() => requestCashierUrl("withdraw")}
            disabled={busy}
            className="w-full flex items-center gap-3 px-4 py-4 bg-[#1E90FF]/10 border border-[#1E90FF]/30 rounded-xl hover:bg-[#1E90FF]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-2xl">🏦</span>
            <div className="text-left">
              <div className="font-semibold text-foreground">Withdraw</div>
              <div className="text-xs text-muted-foreground">Transfer funds to your bank</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
