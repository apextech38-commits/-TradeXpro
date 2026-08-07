import { useCallback, useRef, useState } from "react";
import { streamContractUntilSettled, sellContractForUi } from "@/utils/trade-purchase";

// Real monitoring: streamContractUntilSettled's onUpdate callback receives
// the raw proposal_open_contract payload, which Deriv updates with live
// unrealized profit on every tick -- unlike the processed "snapshot" object
// (whose .profit is deliberately zeroed until the contract actually
// settles). We read the raw contract's .profit directly for a genuine
// live P&L read, and call the real sellContractForUi() to close early when
// a rule fires. No simulated numbers.
export interface AutoExitRules {
  takeProfitAmount?: number; // close when live profit >= this
  stopLossAmount?: number;   // close when live profit <= -this
}

export interface AutoExitStatus {
  contractId: number;
  livePnl: number;
  closing: boolean;
  closedReason: "take_profit" | "stop_loss" | "settled" | null;
  error: string | null;
}

export function useAutoExitMonitor() {
  const [status, setStatus] = useState<AutoExitStatus | null>(null);
  const closingRef = useRef(false);

  const monitor = useCallback((contractId: number, rules: AutoExitRules, source: string) => {
    closingRef.current = false;
    setStatus({ contractId, livePnl: 0, closing: false, closedReason: null, error: null });

    const controller = new AbortController();

    streamContractUntilSettled({
      contractId,
      source,
      signal: controller.signal,
      onUpdate: async (_snapshot, rawContract) => {
        const livePnl = Number(rawContract?.profit ?? 0);
        setStatus(prev => (prev && prev.contractId === contractId ? { ...prev, livePnl } : prev));

        if (closingRef.current || rawContract?.is_sold) return;

        const hitTakeProfit = rules.takeProfitAmount != null && livePnl >= rules.takeProfitAmount;
        const hitStopLoss = rules.stopLossAmount != null && livePnl <= -rules.stopLossAmount;
        if (!hitTakeProfit && !hitStopLoss) return;

        closingRef.current = true;
        setStatus(prev => (prev && prev.contractId === contractId ? { ...prev, closing: true } : prev));
        try {
          await sellContractForUi(contractId, source);
          setStatus(prev =>
            prev && prev.contractId === contractId
              ? { ...prev, closing: false, closedReason: hitTakeProfit ? "take_profit" : "stop_loss" }
              : prev
          );
        } catch (err) {
          closingRef.current = false; // allow a retry on the next tick rather than getting stuck
          setStatus(prev =>
            prev && prev.contractId === contractId
              ? { ...prev, closing: false, error: err instanceof Error ? err.message : "Failed to close position." }
              : prev
          );
        }
      },
    }).then(finalSnapshot => {
      setStatus(prev =>
        prev && prev.contractId === contractId && !prev.closedReason
          ? { ...prev, closing: false, closedReason: "settled", livePnl: Number(finalSnapshot?.profit ?? prev.livePnl) }
          : prev
      );
    });

    return () => controller.abort();
  }, []);

  return { status, monitor };
}
