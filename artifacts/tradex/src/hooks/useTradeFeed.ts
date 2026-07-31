import { useSyncExternalStore } from "react";
import { observer as globalObserver } from "@/external/bot-skeleton";

export interface TradeFeedEntry {
  id: string;
  source: string;
  contractType?: string;
  symbol?: string;
  stake?: number;
  buyPrice?: number;
  payout?: number;
  profit?: number;
  currency?: string;
  status: "open" | "won" | "lost";
  openedAt: number;
  settledAt?: number;
}

const MAX_ENTRIES = 200;

// Module-level store (not React state) so every mount of the panel, on any
// page, reads and writes the exact same list -- a single trade placed on
// Bulk Trader shows up immediately even if the panel was first opened on
// Manual Traders.
let entries: TradeFeedEntry[] = [];
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach(listener => listener());
}

function upsert(entry: TradeFeedEntry) {
  const index = entries.findIndex(e => e.id === entry.id);
  if (index === -1) {
    entries = [entry, ...entries].slice(0, MAX_ENTRIES);
  } else {
    const next = entries.slice();
    next[index] = { ...next[index], ...entry };
    entries = next;
  }
  notify();
}

function handleContractStatus(payload: {
  id?: string;
  source?: string;
  buy?: Record<string, unknown>;
  contract?: Record<string, unknown>;
}) {
  const source = payload?.source || "Unknown";

  if (payload?.id === "contract.purchase_received" && payload.buy) {
    const buy = payload.buy as Record<string, unknown>;
    const contractId = String(buy.contract_id ?? buy.transaction_id ?? Date.now());
    upsert({
      id: contractId,
      source,
      buyPrice: Number(buy.buy_price ?? 0) || undefined,
      payout: Number(buy.payout ?? 0) || undefined,
      status: "open",
      openedAt: Date.now(),
    });
    return;
  }

  if (payload?.id === "contract.sold" && payload.contract) {
    const contract = payload.contract as Record<string, unknown>;
    const contractId = String(contract.contract_id ?? "");
    if (!contractId) return;
    const profit = Number(contract.profit ?? 0);
    upsert({
      id: contractId,
      source,
      contractType: (contract.contract_type as string) || undefined,
      symbol: (contract.underlying_symbol as string) || (contract.display_name as string) || undefined,
      buyPrice: Number(contract.buy_price ?? 0) || undefined,
      payout: Number(contract.payout ?? 0) || undefined,
      profit,
      currency: (contract.currency as string) || undefined,
      status: profit >= 0 ? "won" : "lost",
      openedAt: Date.now(),
      settledAt: Date.now(),
    });
  }
}

let subscribed = false;
function ensureSubscribed() {
  if (subscribed) return;
  subscribed = true;
  globalObserver.register("contract.status", handleContractStatus);
}

function subscribe(listener: () => void) {
  ensureSubscribed();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return entries;
}

/** Live, cross-page feed of every trade placed through buyContractForUi (Bulk Trader,
 * AI Scanner, and anything else that shares that helper). Does NOT include trades
 * placed inside the Manual Traders iframe -- that's a separate app/origin with its
 * own WebSocket, so those are only visible via the account statement instead. */
export function useTradeFeed(): TradeFeedEntry[] {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function clearTradeFeed() {
  entries = [];
  notify();
}
