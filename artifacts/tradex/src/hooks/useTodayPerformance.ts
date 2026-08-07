import { useMemo } from "react";
import { useAuth, StatementTrade } from "@/context/AuthContext";

// Real aggregation over today's settled trades. "Settled" = sell-type
// statement entries with a non-null pnl (Deriv reports the outcome on the
// closing/settlement leg, not the buy leg). No estimation, no placeholders.
export interface TodayPerformance {
  trades: number;
  wins: number;
  losses: number;
  winRatePct: number | null; // null when there's nothing settled yet today
  profit: number;
  settledTrades: StatementTrade[]; // newest first, for a timeline feed
}

function isToday(unixSeconds: number) {
  const d = new Date(unixSeconds * 1000);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function useTodayPerformance(): TodayPerformance {
  const { recentTrades } = useAuth();

  return useMemo(() => {
    const settledToday = recentTrades
      .filter(t => t.action_type === "sell" && t.pnl != null && isToday(t.transaction_time))
      .sort((a, b) => b.transaction_time - a.transaction_time);

    const wins = settledToday.filter(t => (t.pnl ?? 0) > 0).length;
    const losses = settledToday.filter(t => (t.pnl ?? 0) < 0).length;
    const profit = settledToday.reduce((sum, t) => sum + (t.pnl ?? 0), 0);

    return {
      trades: settledToday.length,
      wins,
      losses,
      winRatePct: settledToday.length ? Math.round((wins / settledToday.length) * 100) : null,
      profit,
      settledTrades: settledToday,
    };
  }, [recentTrades]);
}
