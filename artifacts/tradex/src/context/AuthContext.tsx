import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from "react";

export const DERIV_APP_ID = "33ughhvgtxloGWBQQZEeD";
export const OAUTH_APP_ID = "33ughhvgtxloGWBQQZEeD";

const API_BASE = "https://api.derivws.com/trading/v1/options";
const AUTH_ENDPOINT = "https://auth.deriv.com/oauth2/auth";
const REDIRECT_URI = "https://tradexpro.co.ke";

const TOKEN_KEY = "tradex_access_token";
const ACCOUNTS_KEY = "tradex-deriv-accounts";
const PKCE_VERIFIER_KEY = "tradex_pkce_verifier";
const PKCE_STATE_KEY = "tradex_pkce_state";

function generateRandom(length = 64): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join("");
}

async function sha256Base64Url(plain: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export interface DerivAccount {
  account: string;
  token: string;
  currency: string;
  account_type?: "demo" | "real" | string;
}

export interface StatementTrade {
  transaction_id: number;
  action_type: string;
  amount: number;
  balance_after: number;
  transaction_time: number;
  shortcode: string | null;
  contract_id: number | null;
  pnl: number | null;
}

interface AuthState {
  isLoggedIn: boolean;
  isAuthorized: boolean;
  activeAccount: DerivAccount | null;
  accounts: DerivAccount[];
  balance: number | null;
  currency: string;
  wsConnected: boolean;
  recentTrades: StatementTrade[];
  login: () => void;
  signup: () => void;
  logout: () => void;
  switchAccount: (acct: DerivAccount) => void;
  sendWS: (msg: object) => void;
}

const AuthContext = createContext<AuthState>({
  isLoggedIn: false,
  isAuthorized: false,
  activeAccount: null,
  accounts: [],
  balance: null,
  currency: "USD",
  wsConnected: false,
  recentTrades: [],
  login: () => {},
  signup: () => {},
  logout: () => {},
  switchAccount: () => {},
  sendWS: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<DerivAccount[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const [activeAccount, setActiveAccount] = useState<DerivAccount | null>(
    () => accounts[0] ?? null
  );
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [wsConnected, setWsConnected] = useState(false);
  const [recentTrades, setRecentTrades] = useState<StatementTrade[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const sendWS = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const connect = useCallback((account: DerivAccount) => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }

    (async () => {
      let otpUrl: string;
      try {
        const otpRes = await fetch(
          `${API_BASE}/accounts/${account.account}/otp`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${account.token}`,
              "Deriv-App-ID": OAUTH_APP_ID,
            },
          }
        );
        if (!otpRes.ok) throw new Error(`OTP failed (${otpRes.status})`);
        const otpJson = await otpRes.json();
        otpUrl = otpJson.data.url;
      } catch {
        if (!mountedRef.current) return;
        setWsConnected(false);
        setIsAuthorized(false);
        const storedToken = localStorage.getItem(TOKEN_KEY);
        if (storedToken) {
          reconnectRef.current = setTimeout(() => connect(account), 4000);
        }
        return;
      }

      if (!mountedRef.current) return;

      const ws = new WebSocket(otpUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setWsConnected(true);
        setIsAuthorized(true);
        setActiveAccount(account);
        ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));
        ws.send(JSON.stringify({ statement: 1, limit: 50 }));
        ws.send(JSON.stringify({ active_symbols: "brief", product_type: "basic" }));
        ws.send(JSON.stringify({ ticks: "R_10", subscribe: 1 }));
        ws.send(JSON.stringify({ trading_durations: 1, underlying: "R_100", contract_type: "ALL" }));
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.error) return;
          switch (msg.msg_type) {
            case "balance":
              setBalance(msg.balance?.balance ?? null);
              setCurrency(msg.balance?.currency || "USD");
              break;
            case "statement": {
              const txns: StatementTrade[] = (msg.statement?.transactions ?? [])
                .filter(
                  (t: Record<string, unknown>) =>
                    t.action_type === "buy" || t.action_type === "sell"
                )
                .slice(0, 5)
                .map((t: Record<string, unknown>) => ({
                  transaction_id: t.transaction_id as number,
                  action_type: t.action_type as string,
                  amount: t.amount as number,
                  balance_after: t.balance_after as number,
                  transaction_time: t.transaction_time as number,
                  shortcode: (t.shortcode as string | undefined) ?? null,
                  contract_id: (t.contract_id as number | undefined) ?? null,
                  pnl: (t.pnl as number | undefined) ?? null,
                }));
              setRecentTrades(txns);
              break;
            }
          }
        } catch {
          // ignore malformed frames
        }
      };

      ws.onerror = () => setWsConnected(false);

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setWsConnected(false);
        setIsAuthorized(false);
        const storedToken = localStorage.getItem(TOKEN_KEY);
        if (storedToken) {
          reconnectRef.current = setTimeout(() => connect(account), 4000);
        }
      };
    })();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (accounts.length > 0) {
      connect(accounts[0]);
    }
    return () => {
      mountedRef.current = false;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // PKCE OAuth callback — reads ?code=...&state=... after auth.deriv.com redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const returnedState = params.get("state");
    if (!code || !returnedState) return;

    const storedState = sessionStorage.getItem(PKCE_STATE_KEY);
    const codeVerifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
    sessionStorage.removeItem(PKCE_STATE_KEY);
    sessionStorage.removeItem(PKCE_VERIFIER_KEY);

    window.history.replaceState(null, "", window.location.pathname);

    if (!storedState || returnedState !== storedState) {
      console.error("OAuth state mismatch — possible CSRF. Aborting.");
      return;
    }
    if (!codeVerifier) {
      console.error("PKCE verifier missing from sessionStorage.");
      return;
    }

    (async () => {
      try {
        const tokenRes = await fetch("/api/oauth-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, code_verifier: codeVerifier, redirect_uri: REDIRECT_URI }),
        });
        if (!tokenRes.ok) throw new Error(`Token exchange failed (${tokenRes.status})`);
        const { access_token } = await tokenRes.json();
        if (!access_token) throw new Error("No access_token in response");

        localStorage.setItem(TOKEN_KEY, access_token);

        const acctRes = await fetch(`${API_BASE}/accounts`, {
          headers: {
            Authorization: `Bearer ${access_token}`,
            "Deriv-App-ID": OAUTH_APP_ID,
          },
        });
        if (!acctRes.ok) throw new Error(`Accounts fetch failed (${acctRes.status})`);
        const { data: optionsAccounts } = await acctRes.json() as {
          data: Array<{ account_id: string; account_type: string; currency: string }>;
        };

        if (!optionsAccounts?.length) throw new Error("No Options accounts found");

        const mapped: DerivAccount[] = optionsAccounts.map((a) => ({
          account: a.account_id,
          token: access_token,
          currency: a.currency || "USD",
          account_type: a.account_type,
        }));

        const demo = mapped.find((a) => a.account_type === "demo");
        const real = mapped.find((a) => a.account_type === "real");
        const ordered = [demo, real, ...mapped]
          .filter((a): a is DerivAccount => !!a)
          .filter((a, i, arr) => arr.findIndex((x) => x.account === a.account) === i);

        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(ordered));
        setAccounts(ordered);
        setActiveAccount(ordered[0]);
        connect(ordered[0]);
      } catch (err) {
        console.error("PKCE OAuth callback error:", err);
      }
    })();
  }, [connect]);

  const login = useCallback(async () => {
    const codeVerifier = generateRandom(64);
    const codeChallenge = await sha256Base64Url(codeVerifier);
    const state = generateRandom(32);

    sessionStorage.setItem(PKCE_VERIFIER_KEY, codeVerifier);
    sessionStorage.setItem(PKCE_STATE_KEY, state);

    const url = new URL(AUTH_ENDPOINT);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", OAUTH_APP_ID);
    url.searchParams.set("redirect_uri", REDIRECT_URI);
    url.searchParams.set("scope", "trade");
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");

    window.location.href = url.toString();
  }, []);

const signup = useCallback(async () => {
  const codeVerifier = generateRandom(64);
  const codeChallenge = await sha256Base64Url(codeVerifier);
  const state = generateRandom(32);

  sessionStorage.setItem(PKCE_VERIFIER_KEY, codeVerifier);
  sessionStorage.setItem(PKCE_STATE_KEY, state);

  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", OAUTH_APP_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("scope", "trade");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  window.location.href = url.toString();
}, []);
  const logout = () => {
    sendWS({ logout: 1 });
    wsRef.current?.close();
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ACCOUNTS_KEY);
    setAccounts([]);
    setActiveAccount(null);
    setIsAuthorized(false);
    setBalance(null);
    setWsConnected(false);
    setRecentTrades([]);
  };

  const switchAccount = (acct: DerivAccount) => {
    setActiveAccount(acct);
    setIsAuthorized(false);
    setBalance(null);
    setRecentTrades([]);
    localStorage.setItem("tradex_active_acct_token", acct.token); // per-account token, not OAuth token
    connect(acct);
  };

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn: accounts.length > 0,
        isAuthorized,
        activeAccount,
        accounts,
        balance,
        currency,
        wsConnected,
        recentTrades,
        login,
        signup,
        logout,
        switchAccount,
        sendWS,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
