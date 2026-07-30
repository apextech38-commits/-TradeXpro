import { Cpu, X } from "lucide-react";
import { MarketScanResult, UseMarketScannerResult } from "./useMarketScanner";

interface AiMarketScannerModalProps {
  onClose: () => void;
  onApply: (result: MarketScanResult) => void;
  onScan: () => void;
  scanner: UseMarketScannerResult;
}

export default function AiMarketScannerModal({ onClose, onApply, onScan, scanner }: AiMarketScannerModalProps) {
  const { isScanning, progressLabel, results, error } = scanner;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-card border border-border rounded-xl shadow-xl flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Market Scanner</span>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Scans your configured Volatility markets and ranks them by how far their current Even/Odd split is
            from an even 50/50 &mdash; the bigger the skew, the stronger the current edge on that market.
          </p>

          {isScanning && (
            <div className="flex items-center gap-2 text-sm text-primary py-3">
              <span className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              {progressLabel || "Scanning..."}
            </div>
          )}

          {!isScanning && results.length === 0 && !error && (
            <p className="text-xs text-muted-foreground py-2">Press scan to check every market right now.</p>
          )}

          {error && <p className="text-xs text-red-600 bg-red-500/10 rounded-md px-3 py-2">{error}</p>}

          {results.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {results.map((r, i) => (
                <button
                  key={r.symbol}
                  type="button"
                  onClick={() => onApply(r)}
                  className={`flex items-center justify-between rounded-md border px-3 py-2.5 text-left transition-colors hover:bg-muted/60 ${
                    i === 0 ? "border-primary/40 bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">{r.name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {i === 0 ? "Strongest edge right now" : "Tap to use this market"}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span
                      className={`text-sm font-semibold ${
                        r.favored === "Even" ? "text-teal-600" : "text-red-600"
                      }`}
                    >
                      {r.favored} {Math.max(r.evenPct, r.oddPct).toFixed(1)}%
                    </span>
                    <span className="text-[11px] text-muted-foreground">skew {r.skew.toFixed(1)}pp</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border">
          <button
            type="button"
            onClick={onScan}
            disabled={isScanning}
            className="w-full h-10 rounded-md bg-foreground text-background text-sm font-semibold disabled:opacity-50"
          >
            {isScanning ? "Scanning..." : results.length > 0 ? "Scan Again" : "Scan For Best Market"}
          </button>
        </div>
      </div>
    </div>
  );
}
