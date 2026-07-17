import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// TradeX Pro — Cashier Modal
// ---------------------------------------------------------------------------
// Redirects the user straight to Deriv's own hosted, logged-in cashier
// (app.deriv.com/cashier/...) instead of requesting a session-scoped URL via
// the WS `cashier` API.
//
// Why: the WS `cashier` call requires a "Payments" OAuth scope that's
// separate from the read/trade scopes this app currently requests. Rather
// than depend on that scope being granted, this sends the user to Deriv's
// own site, where they authenticate with their own Deriv session if needed.
//
// Trade-off: the new tab is NOT pre-authorized with this app's OAuth token.
// If the user isn't already logged into app.deriv.com in that browser,
// Deriv will ask them to log in there. That's expected, not a bug.
//
// Balance refresh: no extra logic needed here. AuthContext already listens
// for the tab regaining focus/visibility and calls refreshBalance() at that
// point, which covers the "user comes back after depositing" case.
// ---------------------------------------------------------------------------

type CashierAction = "deposit" | "withdraw";

interface CashierAccount {
  account: string;
  token: string;
}

interface CashierModalProps {
  open: boolean;
  onClose: () => void;
  account: CashierAccount | null;
  isDemo?: boolean;
  /** Optional: called right after opening the cashier tab, in addition to
   *  AuthContext's own focus/visibility-based refresh. Pass your
   *  `refreshBalance` from useAuth() if you want an extra nudge. */
  onCashierOpened?: () => void;
}

export default function CashierModal({
  open,
  onClose,
  account,
  isDemo = false,
  onCashierOpened,
}: CashierModalProps) {
  const [action, setAction] = useState<CashierAction | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!open) {
      setAction(null);
      setErrorMsg("");
    }
  }, [open]);

  const openCashier = (type: CashierAction) => {
    if (!account?.account) {
      setErrorMsg("No active session found. Please log in again.");
      return;
    }

    if (isDemo) {
      setErrorMsg("Cashier is only available on a real-money account. Switch out of Demo to continue.");
      return;
    }

    setErrorMsg("");
    setAction(type);

    const url = `https://app.deriv.com/cashier/${type}`;
    window.open(url, "_blank", "noopener,noreferrer");

    onCashierOpened?.();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full bg-background rounded-t-3xl shadow-2xl flex flex-col" style={{ height: "auto" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-bold text-foreground">Cashier</h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">✕</button>
        </div>

        <div className="flex flex-col gap-3 p-5">
          {errorMsg && (
            <div className="px-4 py-3 text-xs rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444]">
              {errorMsg}
            </div>
          )}

          {action && !errorMsg && (
            <div className="px-4 py-3 text-xs rounded-lg bg-[#22C55E]/10 border border-[#22C55E]/30 text-[#22C55E]">
              Opened your {action} page in a new tab. Didn't see it? Check your popup blocker.
              Come back to this tab once you're done — your balance will update automatically.
            </div>
          )}

          <button
            onClick={() => openCashier("deposit")}
            className="w-full flex items-center gap-3 px-4 py-4 bg-[#22C55E]/10 border border-[#22C55E]/30 rounded-xl hover:bg-[#22C55E]/20 transition-colors"
          >
            <span className="text-2xl">💰</span>
            <div className="text-left">
              <div className="font-semibold text-foreground">Deposit</div>
              <div className="text-xs text-muted-foreground">Add funds to your account</div>
            </div>
          </button>

          <button
            onClick={() => openCashier("withdraw")}
            className="w-full flex items-center gap-3 px-4 py-4 bg-[#1E90FF]/10 border border-[#1E90FF]/30 rounded-xl hover:bg-[#1E90FF]/20 transition-colors"
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