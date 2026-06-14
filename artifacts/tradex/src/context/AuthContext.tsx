import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from "react";

// Registered Deriv App ID — used for both WebSocket streaming and OAuth login
export const DERIV_APP_ID = "33ughhvgtxloGwBQQZEeD";
export const OAUTH_APP_ID = "33ughhvgtxloGwBQQZEeD";

const API_BASE = "https://api.derivws.com/trading/v1/options";
const SIGNUP_URL = `https://deriv.com/signup/?lang=EN`;

// FIX: Use root URL instead of /callback path.
// TradeX PRO SPAs cannot serve sub-paths like /callback — Deriv must redirect
// back to the root, where React is actually running. The acct1 param that
// Deriv appends is what App.tsx uses to detect the OAuth callback.
// Change this line in AuthContext.tsx
const REDIRECT_URI = "https://tradexpro.co.ke";
const OAUTH_URL = `https://oauth.deriv.com/oauth2/authorize?app_id=${OAUTH_APP_ID}&l=EN&brand=deriv&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
const TOKEN_KEY = "deriv_token";
const ACCOUNTS_KEY = "tradex-deriv-accounts";
export interface DerivAccount {
  account: string;
  token: string;
  currency: string;
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
    () => accounts[0] ?? null,
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
        // Step 1: list Options-API accounts for this token.
        const accountsRes = await fetch(`${API_BASE}/accounts`, {
          headers: {
            Authorization: `Bearer ${account.token}`,
            "Deriv-App-ID": OAUTH_APP_ID,
          },
        });
        if (!accountsRes.ok) {
          throw new Error(`Accounts request failed (${accountsRes.status})`);
        }
        const accountsJson = await accountsRes.json();
        const optionsAccounts: Array<{ account_id: string; account_type?: string; currency?: string }> =
          accountsJson.data ?? [];

        // OAuth login IDs (CR.../VRTC.../VRW...) don't map 1:1 to Options
        // account_id (DOT...). Instead, use the login id's prefix to infer
        // demo vs real, then select the matching Options account by
        // account_type. "VR"-prefixed ids (VRTC, VRW) are virtual/demo
        // accounts; everything else (CR, CRW, ...) is real.
        const wantDemo = /^VR/i.test(account.account);
        const wantedType = wantDemo ? "demo" : "real";

        let matched =
          optionsAccounts.find((a) => a.account_type === wantedType) ??
          optionsAccounts.find((a) => a.currency === account.currency) ??
          optionsAccounts[0];

        if (!matched) {
          throw new Error("No Options trading account found for this user");
        }

        // Step 2: get a one-time authenticated WebSocket URL for that account.
        const otpRes = await fetch(
          `${API_BASE}/accounts/${matched.account_id}/otp`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${account.token}`,
              "Deriv-App-ID": OAUTH_APP_ID,
            },
          },
        );
        if (!otpRes.ok) {
          throw new Error(`OTP request failed (${otpRes.status})`);
        }
        const otpJson = await otpRes.json();
        otpUrl = otpJson.data.url;
      } catch (_) {
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
        // The OTP URL is already authenticated — do NOT send `authorize`.
        setIsAuthorized(true);
        setActiveAccount((prev) =>
          prev
            ? { ...prev, account: account.account, currency: prev.currency }
            : prev,
        );
        ws.send(
          JSON.stringify({ balance: 1, account: "current", subscribe: 1 }),
        );
        ws.send(JSON.stringify({ statement: 1, limit: 50 }));
        ws.send(
          JSON.stringify({
            active_symbols: "brief",
            product_type: "basic",
          }),
        );
        ws.send(JSON.stringify({ ticks: "R_10", subscribe: 1 }));
        ws.send(
          JSON.stringify({
            trading_durations: 1,
            underlying: "R_100",
            contract_type: "ALL",
          }),
        );
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.error) return;

          switch (msg.msg_type) {
            case "balance": {
              setBalance(msg.balance?.balance ?? null);
              setCurrency(msg.balance?.currency || "USD");
              break;
            }
            case "statement": {
              const txns: StatementTrade[] = (msg.statement?.transactions ?? [])
                .filter((t: Record<string, unknown>) => t.action_type === "buy" || t.action_type === "sell")
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
        } catch (_) {}
      };

      ws.onerror = () => {
        setWsConnected(false);
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setWsConnected(false);
        setIsAuthorized(false);
        // OTP URLs are short-lived/one-time — fetch a fresh OTP on reconnect
        // rather than reopening the stale URL.
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
  }, []);


  // Handle Deriv OAuth redirect — acct1/token1/cur1 params land at root URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('acct1')) return;
    const accts: DerivAccount[] = [];
    let i = 1;
    while (params.has(`acct${i}`)) {
      const account = params.get(`acct${i}`) || '';
      const token = params.get(`token${i}`) || '';
      const currency = params.get(`cur${i}`) || 'USD';
      if (account && token) accts.push({ account, token, currency });
      i++;
    }
    if (accts.length === 0) return;
    localStorage.setItem(TOKEN_KEY, accts[0].token);
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accts));
    setAccounts(accts);
    setActiveAccount(accts[0]);
    connect(accts[0]);
    // Clean URL
    window.history.replaceState(null, '', window.location.pathname);
  }, [connect]);

  const login = () => {
    window.location.href = OAUTH_URL;
  };
  const signup = () => {
    window.location.href = SIGNUP_URL;
  };

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
    localStorage.setItem(TOKEN_KEY, acct.token);
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