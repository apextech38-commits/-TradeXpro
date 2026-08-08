// Real client for the Smart Copy backend (functions/api/copy-trading/*).
// traderId is a client-generated anonymous UUID -- never a real Deriv
// loginid or session token. Every network call is best-effort and
// fire-and-forget where it touches the trading path: a Smart Copy backend
// hiccup must never block or fail a real trade.
const TRADER_ID_KEY = "smart-copy-trader-id";
const OPTED_IN_KEY = "smart-copy-opted-in";
const COPY_FILTERS_KEY = "smart-copy-filters";

export function getOrCreateTraderId(): string {
  let id = localStorage.getItem(TRADER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(TRADER_ID_KEY, id);
  }
  return id;
}

export function isOptedIn(): boolean {
  return localStorage.getItem(OPTED_IN_KEY) === "1";
}

export async function optIn(displayName: string): Promise<void> {
  const traderId = getOrCreateTraderId();
  const res = await fetch("/api/copy-trading/opt-in", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ traderId, displayName }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Opt-in failed.");
  localStorage.setItem(OPTED_IN_KEY, "1");
}

export function optOut(): void {
  localStorage.removeItem(OPTED_IN_KEY);
}

export interface BroadcastTradeArgs {
  contractId: string; symbol: string; symbolLabel: string;
  contractType: string; confidence: number; stake: number; currency: string; durationTicks: number;
}

export async function broadcastTrade(args: BroadcastTradeArgs): Promise<void> {
  if (!isOptedIn()) return;
  try {
    await fetch("/api/copy-trading/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ traderId: getOrCreateTraderId(), ...args }),
    });
  } catch {
    // Best-effort: a broadcast failure must never affect real trading.
  }
}

export async function settleTrade(contractId: string, pnl: number, won: boolean): Promise<void> {
  if (!isOptedIn()) return;
  try {
    await fetch("/api/copy-trading/broadcast", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractId, pnl, won }),
    });
  } catch {
    // Best-effort.
  }
}

export interface CopyTrader {
  traderId: string; displayName: string; totalTrades: number; settledTrades: number; winRatePct: number | null; totalPnl: number;
}
export async function fetchTraders(): Promise<CopyTrader[]> {
  const res = await fetch("/api/copy-trading/traders");
  if (!res.ok) throw new Error("Failed to load traders.");
  const data = (await res.json()) as { traders: CopyTrader[] };
  return data.traders;
}

export interface CopySignal {
  contractId: string; symbol: string; symbolLabel: string; contractType: string;
  confidence: number; openedAt: number; traderId: string; traderName: string; winRatePct: number | null;
}
export async function fetchSignals(minConfidence: number, minWinRate: number): Promise<CopySignal[]> {
  const res = await fetch(`/api/copy-trading/signals?minConfidence=${minConfidence}&minWinRate=${minWinRate}`);
  if (!res.ok) throw new Error("Failed to load signals.");
  const data = (await res.json()) as { signals: CopySignal[] };
  return data.signals;
}

export interface CopyFilters { minConfidence: number; minWinRate: number; maxRiskPct: number; maxTrades: number; }
export const DEFAULT_COPY_FILTERS: CopyFilters = { minConfidence: 90, minWinRate: 70, maxRiskPct: 2, maxTrades: 3 };

export function loadCopyFilters(): CopyFilters {
  try {
    const raw = localStorage.getItem(COPY_FILTERS_KEY);
    return raw ? { ...DEFAULT_COPY_FILTERS, ...JSON.parse(raw) } : DEFAULT_COPY_FILTERS;
  } catch { return DEFAULT_COPY_FILTERS; }
}
export function saveCopyFilters(f: CopyFilters): void {
  localStorage.setItem(COPY_FILTERS_KEY, JSON.stringify(f));
}
