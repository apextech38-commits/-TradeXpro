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
export const DERIV_APP_ID = "129077";
export const OAUTH_APP_ID = "129077";

const WS_URL = `wss://ws.binaryws.com/websockets/v3?app_id=${DERIV_APP_ID}`;
const SIGNUP_URL = `https://deriv.com/signup/?lang=EN`;

// FIX: Use root URL instead of /callback path.
// Replit SPAs cannot serve sub-paths like /callback — Deriv must redirect
// back to the root, where React is actually running. The acct1 param that
// Deriv appends is what App.tsx uses to detect the OAuth callback.
const REDIRECT_URI = "https://dev-utility-hub--apexricky20.replit.app/";
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

  const connect = useCallback((token: string) => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setWsConnected(true);
      ws.send(JSON.stringify({ authorize: token }));
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(event.data);
        if (msg.error) return;

        switch (msg.msg_type) {
          case "authorize": {
            setIsAuthorized(true);
            const info = msg.authorize;
            setActiveAccount((prev) =>
              prev
                ? {
                    ...prev,
                    account: info.loginid || prev.account,
                    currency: info.currency || prev.currency,
                  }
                : null,
            );
            setCurrency(info.currency || "USD");
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
            break;
          }
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
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (storedToken) {
        reconnectRef.current = setTimeout(() => connect(storedToken), 4000);
      }
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const token = localStorage.getItem(TOKEN_KEY);
    if (token && accounts.length > 0) {
      connect(token);
    }
    return () => {
      mountedRef.current = false;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, []);

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
    connect(acct.token);
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
