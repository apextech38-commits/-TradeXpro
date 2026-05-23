import { useEffect, useRef, useState } from "react";
import { OAUTH_APP_ID } from "@/context/AuthContext";

const TOKEN_KEY = "deriv_token";
const ACCOUNTS_KEY = "tradex-deriv-accounts";

// Must match exactly what is registered in the Deriv API dashboard for app_id 129077.
const REDIRECT_URI = "https://dev-utility-hub--apexricky20.replit.app/";
function buildOAuthUrl(): string {
  return `https://oauth.deriv.com/oauth2/authorize?app_id=${OAUTH_APP_ID}&l=EN&brand=deriv&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
}

interface ParseResult {
  accounts: { account: string; token: string; currency: string }[];
  errorReason: string | null;
}

function parseCallback(): ParseResult {
  const params = new URLSearchParams(window.location.search);
  const accounts = [];
  let errorReason: string | null = null;

  if (!params.has("acct1")) {
    const allKeys = Array.from(params.keys()).join(", ") || "(none)";
    errorReason =
      `No account parameters found in the redirect URL. Received params: ${allKeys}. ` +
      `Expected: acct1, token1, cur1. ` +
      `Check that App ID ${OAUTH_APP_ID} has redirect URI correctly registered in the Deriv developer console.`;
    console.error("[TradeX Callback]", errorReason);
    return { accounts: [], errorReason };
  }

  let i = 1;
  while (params.has(`acct${i}`)) {
    const account = params.get(`acct${i}`) || "";
    const token = params.get(`token${i}`) || "";
    const currency = params.get(`cur${i}`) || "USD";

    if (!account) {
      console.warn(`[TradeX Callback] acct${i} is empty — skipping`);
    } else if (!token) {
      console.warn(
        `[TradeX Callback] token${i} is empty for account ${account} — skipping`,
      );
    } else {
      accounts.push({ account, token, currency });
    }
    i++;
  }

  if (accounts.length === 0) {
    errorReason =
      `Account parameters were present but all tokens were empty (received ${i - 1} account entries). ` +
      `This can happen if Deriv revoked access for App ID ${OAUTH_APP_ID}.`;
    console.error("[TradeX Callback]", errorReason);
  }

  return { accounts, errorReason };
}

const BASE = import.meta.env.BASE_URL || "/";

function goHome() {
  window.location.replace(BASE);
}

export default function Callback() {
  const [status, setStatus] = useState<"processing" | "success" | "error">(
    "processing",
  );
  const [message, setMessage] = useState("Processing your login...");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const { accounts, errorReason } = parseCallback();

    if (accounts.length === 0) {
      setStatus("error");
      setMessage("No account data was received from Deriv.");
      setErrorDetail(errorReason);
      return;
    }

    try {
      localStorage.setItem(TOKEN_KEY, accounts[0].token);
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    } catch (e) {
      console.error(
        "[TradeX Callback] Failed to save tokens to localStorage:",
        e,
      );
      setStatus("error");
      setMessage(
        "Could not save your session. Your browser may be blocking storage.",
      );
      setErrorDetail(String(e));
      return;
    }

    // Scrub OAuth tokens from the URL immediately so they are never
    // visible in the address bar or browser history after this point.
    try {
      window.history.replaceState(null, "", BASE);
    } catch (_) {}

    const label =
      accounts.length > 1
        ? `${accounts.length} accounts connected`
        : `${accounts[0].account} (${accounts[0].currency})`;

    console.info("[TradeX Callback] Login successful:", label);
    setStatus("success");
    setMessage(`Welcome back! ${label}`);

    // Use replace() so the callback page is removed from history — the
    // user's Back button will not loop them through the OAuth flow again.
    timerRef.current = setTimeout(goHome, 1500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleRetryLogin = () => {
    window.location.href = buildOAuthUrl();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="bg-card border border-border rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center space-y-5">
        {/* Logo */}
        <div className="flex items-start justify-center gap-1 mb-2">
          <span className="text-2xl font-bold text-primary">TradeX</span>
          <span className="text-[10px] font-bold mt-1 px-1 py-[1px] rounded bg-[#FACC15]/20 text-[#FACC15]">
            PRO
          </span>
        </div>

        {/* Status icon */}
        <div className="flex justify-center">
          {status === "processing" && (
            <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          )}
          {status === "success" && (
            <div className="w-16 h-16 rounded-full bg-[#22C55E]/10 border-2 border-[#22C55E] flex items-center justify-center">
              <svg
                className="w-8 h-8 text-[#22C55E]"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          )}
          {status === "error" && (
            <div className="w-16 h-16 rounded-full bg-[#EF4444]/10 border-2 border-[#EF4444] flex items-center justify-center">
              <svg
                className="w-8 h-8 text-[#EF4444]"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Title + message */}
        <div>
          <h1 className="text-xl font-bold text-foreground mb-1">
            {status === "processing"
              ? "Connecting to Deriv"
              : status === "success"
                ? "Login Successful"
                : "Login Failed"}
          </h1>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>

        {/* Error detail (collapsible) */}
        {status === "error" && errorDetail && (
          <details className="text-left">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none">
              Show details
            </summary>
            <p className="mt-2 text-[11px] text-muted-foreground bg-secondary border border-border rounded-lg px-3 py-2 leading-relaxed break-words">
              {errorDetail}
            </p>
          </details>
        )}

        {/* Redirecting indicator */}
        {status === "success" && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
            Redirecting to TradeX...
          </div>
        )}

        {/* Error actions */}
        {status === "error" && (
          <div className="space-y-2">
            <button
              onClick={handleRetryLogin}
              className="w-full py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg font-semibold text-sm transition-colors"
            >
              Try Logging In Again
            </button>
            <button
              onClick={goHome}
              className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Back to TradeX
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
