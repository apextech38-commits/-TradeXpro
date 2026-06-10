import * as React from 'react';
import { useAuth } from '@/context/AuthContext';

// ── Types ─────────────────────────────────────────────────────────

export interface ActiveSymbol {
  symbol: string;
  display_name: string;
  market: string;
  market_display_name: string;
  underlying_symbol: string;
  underlying_symbol_name: string;
  pip: number;
  is_trading_suspended: boolean;
  trading_times?: {
    open: string[];
    close: string[];
  };
}

export interface Tick {
  symbol: string;
  quote: number;
  epoch: number;
  id?: string;
}

export interface ProposalInfo {
  id: string;
  ask_price: number;
  payout: number;
  longcode: string;
  spot: number;
  spot_time: number;
}

export interface BuyResult {
  contract_id: number;
  buy_price: number;
  payout: number;
  longcode: string;
  start_time: number;
  balance_after: number;
}

export interface ContractInfo {
  contract_id: number;
  contract_type: string;
  buy_price: number;
  payout: number;
  profit: number;
  status: 'open' | 'won' | 'lost' | 'sold';
  date_start: number;
  date_expiry: number;
  underlying: string;
  entry_spot: number;
  exit_spot?: number;
}

export interface DerivAccount {
  accountId: string;
  loginId: string;
  currency: string;
  isDemo: boolean;
  balance?: number;
  accountType?: string;
}

export interface DurationLimits {
  min: number;
  max: number;
  unit: string;
}

// AuthState matches what components actually check
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  account: DerivAccount | null;
  error: string | null;
  activeLoginId: string | null;
  accountType: string | null;
  accounts: DerivAccount[];
}

export interface AuthInfo {
  token: string;
  accountId: string;
  loginId: string;
}

export interface AuthConfig {
  clientId: string;
  appId: string;
  redirectUri: string;
}

// ── DerivWS ───────────────────────────────────────────────────────

export class DerivWS {
  private ws: WebSocket | null = null;
  private url: string;

  constructor(url: string) { this.url = url; }

  connect() {
    this.ws = new WebSocket(this.url);
    return this;
  }

  send(msg: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  onMessage(cb: (data: unknown) => void) {
    if (this.ws) this.ws.onmessage = (e) => cb(JSON.parse(e.data as string));
  }

  close() { this.ws?.close(1000); }
}

// ── Hooks ─────────────────────────────────────────────────────────

export function useActiveSymbols() {
  const { accessToken } = useAuth();
  const [activeSymbols, setActiveSymbols] = React.useState<ActiveSymbol[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (!accessToken) return;
    setIsLoading(true);
    fetch('https://api.derivws.com/trading/v1/options/active-symbols', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(r => r.json())
      .then(d => setActiveSymbols((d.data ?? []).map((s: ActiveSymbol) => ({
        ...s,
        underlying_symbol: s.symbol,
        underlying_symbol_name: s.display_name,
      }))))
      .finally(() => setIsLoading(false));
  }, [accessToken]);

  return { activeSymbols, isLoading };
}

export function useTicks(symbol: string | null) {
  const [tick, setTick] = React.useState<Tick | null>(null);
  React.useEffect(() => {
    if (!symbol) { setTick(null); }
  }, [symbol]);
  return { tick, setTick };
}

export function useProposal(_params: Record<string, unknown>) {
  const [proposal, setProposal] = React.useState<ProposalInfo | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  return { proposal, isLoading, setProposal };
}

export function useBuy() {
  const { accessToken } = useAuth();
  const [result, setResult] = React.useState<BuyResult | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const buy = async (proposalId: string, price: number) => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const res = await fetch('https://api.derivws.com/trading/v1/options/buy', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ proposal_id: proposalId, price }),
      });
      const data = await res.json();
      setResult(data.data ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Buy failed');
    } finally {
      setIsLoading(false);
    }
  };

  return { buy, result, isLoading, error };
}

// Re-export auth accumulator so components can import from one place
export { useAuthAccumulator } from '@/hooks/accumulators/use-auth';
