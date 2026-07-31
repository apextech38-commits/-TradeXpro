import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ListChecks } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTradeFeed, TradeFeedEntry } from "@/hooks/useTradeFeed";

type Row = {
  id: string;
  source: string;
  profit: number | null;
  stake: number | null;
  status: "open" | "won" | "lost";
  time: number;
};

export default function TradeResultsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const { recentTrades, currency } = useAuth();
  const liveEntries = useTradeFeed();

  // Merge the live, source-tagged feed (Bulk Trader, AI Scanner, anything
  // sharing buyContractForUi) with the account statement (which also covers
  // Manual Traders -- a separate iframe/origin the live feed can't see).
  // Anything already present in the live feed is skipped from the statement
  // so a single trade doesn't show up twice with two different labels.
  const rows: Row[] = useMemo(() => {
    const liveIds = new Set(liveEntries.map(e => e.id));

    const fromLive: Row[] = liveEntries.map((e: TradeFeedEntry) => ({
      id: e.id,
      source: e.source,
      profit: e.profit ?? null,
      stake: e.buyPrice ?? null,
      status: e.status,
      time: e.settledAt ?? e.openedAt,
    }));

    const fromStatement: Row[] = recentTrades
      .filter(t => !liveIds.has(String(t.contract_id ?? "")))
      .map(t => ({
        id: String(t.contract_id ?? t.transaction_id),
        source: "Manual Traders",
        profit: t.pnl,
        stake: null,
        status: (t.pnl ?? 0) >= 0 ? ("won" as const) : ("lost" as const),
        time: (t.transaction_time ?? 0) * 1000,
      }));

    return [...fromLive, ...fromStatement].sort((a, b) => b.time - a.time).slice(0, 100);
  }, [liveEntries, recentTrades]);

  const closedRows = rows.filter(r => r.status !== "open" && r.profit !== null);
  const wins = closedRows.filter(r => (r.profit ?? 0) > 0).length;
  const losses = closedRows.filter(r => (r.profit ?? 0) <= 0).length;
  const netProfit = closedRows.reduce((sum, r) => sum + (r.profit ?? 0), 0);

  return (
    <div className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex items-stretch">
      <button
        type="button"
        onClick={() => setIsOpen(v => !v)}
        aria-label={isOpen ? "Hide trade results" : "Show trade results"}
        className="flex flex-col items-center gap-1 bg-card border border-border border-r-0 rounded-l-lg px-1.5 py-3 shadow-md hover:bg-muted/40 transition-colors"
      >
        {isOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        <ListChecks className="w-4 h-4 text-primary" />
        {rows.length > 0 && (
          <span className="text-[10px] font-semibold text-muted-foreground [writing-mode:vertical-rl]">
            {rows.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="w-72 max-h-[70vh] bg-card border border-border rounded-l-lg shadow-lg flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Trade Results</h3>
            <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
              <div className="flex flex-col">
                <span className="text-muted-foreground">Win/Loss</span>
                <span className="font-semibold text-foreground tabular-nums">
                  {wins}/{losses}
                </span>
              </div>
              <div className="flex flex-col col-span-2">
                <span className="text-muted-foreground">Net P/L</span>
                <span
                  className={`font-semibold tabular-nums ${
                    netProfit > 0 ? "text-green-600" : netProfit < 0 ? "text-red-600" : "text-foreground"
                  }`}
                >
                  {netProfit >= 0 ? "+" : ""}
                  {netProfit.toFixed(2)} {currency || "USD"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {rows.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6 px-4">
                Trades from any page will show up here as they're placed.
              </p>
            ) : (
              rows.map(r => (
                <div
                  key={r.id}
                  className="flex items-center justify-between px-4 py-2 border-b border-border/50 text-xs"
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-primary/80 truncate">
                      {r.source}
                    </span>
                    <span className="text-muted-foreground">
                      {r.status === "open" ? "Open" : r.status === "won" ? "Won" : "Lost"}
                    </span>
                  </div>
                  <span
                    className={
                      r.profit === null
                        ? "text-muted-foreground"
                        : r.profit > 0
                          ? "text-green-600 font-medium"
                          : "text-red-600 font-medium"
                    }
                  >
                    {r.profit === null ? "—" : `${r.profit >= 0 ? "+" : ""}${r.profit.toFixed(2)}`}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
