import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// TradeX Pro — Cashier Modal
// ---------------------------------------------------------------------------
// Redirects the user to AbePay (app.abepayy.com) -- a third-party service
// for instant M-Pesa <-> Deriv deposits/withdrawals. AbePay handles its own
// Deriv login ("Login with Deriv" button on its landing page) via Deriv's
// OAuth, so this app doesn't need to pass any credentials or tokens to it --
// it's a plain redirect, same as the previous app.deriv.com/cashier
// integration this replaces.
//
// AbePay is a single-page app with one entry point; deposit and withdraw are
// both chosen from within its own UI after login, not via separate
// pre-login URLs. So both buttons below point at the same root URL.
//
// Previous approach (kept for reference/rollback): sent users to Deriv's own
// hosted cashier (app.deriv.com/cashier/deposit or /withdraw). That required
// a "Payments" OAuth scope this app doesn't currently request.
//
// Balance refresh: no extra logic needed here. AuthContext already listens
// for the tab regaining focus/visibility and calls refreshBalance() at that
// point, which covers the "user comes back after depositing" case.
// ---------------------------------------------------------------------------

const ABEPAY_URL = "https://app.abepayy.com/";


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

    window.open(ABEPAY_URL, "_blank", "noopener,noreferrer");

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