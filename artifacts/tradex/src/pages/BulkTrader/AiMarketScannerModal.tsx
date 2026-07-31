import { Cpu, X } from "lucide-react";
import { MarketScanResult, UseMarketScannerResult } from "./useMarketScanner";

interface AiMarketScannerModalProps {
  onClose: () => void;
  onApply: (result: MarketScanResult) => void;
  onScan: () => void;
  scanner: UseMarketScannerResult;
  sideALabel: string;
  sideBLabel: string;
}

export default function AiMarketScannerModal({
  onClose,
  onApply,
  onScan,
  scanner,
  sideALabel,
  sideBLabel,
}: AiMarketScannerModalProps) {
  const { isScanning, progressLabel, results, error } = scanner;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <style>{`
        @keyframes tx-radar-spin { to { transform: rotate(360deg); } }
        @keyframes tx-radar-ping { 0% { transform: scale(0.6); opacity: 0.7; } 100% { transform: scale(1.8); opacity: 0; } }
        @keyframes tx-blip { 0%, 100% { opacity: 0; transform: scale(0.4); } 50% { opacity: 1; transform: scale(1); } }
        @keyframes tx-scan-fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes tx-scanner-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(var(--primary-rgb, 99 102 241) / 0.35); } 50% { box-shadow: 0 0 0 6px rgba(var(--primary-rgb, 99 102 241) / 0); } }
      `}</style>
      <div
        className="w-full max-w-md bg-card border border-border rounded-xl shadow-xl flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Cpu className={`w-4 h-4 text-primary ${isScanning ? "animate-pulse" : ""}`} />
            <span className="text-sm font-semibold text-foreground">Market Scanner</span>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Scans your configured Volatility markets and ranks them by how far their current {sideALabel}/
            {sideBLabel} split is from an even 50/50 &mdash; the bigger the skew, the stronger the current edge on
            that market.
          </p>

          {isScanning && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="relative w-28 h-28">
                {/* Outer pinging rings -- "actively sensing" */}
                <span
                  className="absolute inset-0 rounded-full border border-primary/40"
                  style={{ animation: "tx-radar-ping 1.8s ease-out infinite" }}
                />
                <span
                  className="absolute inset-0 rounded-full border border-primary/40"
                  style={{ animation: "tx-radar-ping 1.8s ease-out infinite", animationDelay: "0.6s" }}
                />
                {/* Radar face */}
                <div className="absolute inset-2 rounded-full border border-primary/30 bg-primary/5 overflow-hidden">
                  {/* Sweep beam */}
                  <div
                    className="absolute inset-0 origin-center"
                    style={{ animation: "tx-radar-spin 2.2s linear infinite" }}
                  >
                    <div
                      className="absolute top-1/2 left-1/2 w-1/2 h-1/2 origin-top-left"
                      style={{
                        background:
                          "conic-gradient(from 0deg, rgba(var(--primary-rgb, 99 102 241) / 0.55), transparent 70deg)",
                      }}
                    />
                  </div>
                  {/* Concentric range rings */}
                  <div className="absolute inset-[15%] rounded-full border border-primary/20" />
                  <div className="absolute inset-[32%] rounded-full border border-primary/20" />
                  {/* Random "detected data" blips */}
                  {[
                    { top: "28%", left: "62%", delay: "0s" },
                    { top: "58%", left: "30%", delay: "0.5s" },
                    { top: "70%", left: "68%", delay: "1s" },
                    { top: "38%", left: "40%", delay: "1.4s" },
                  ].map((b, i) => (
                    <span
                      key={i}
                      className="absolute w-1.5 h-1.5 rounded-full bg-primary"
                      style={{ top: b.top, left: b.left, animation: `tx-blip 2s ease-in-out infinite`, animationDelay: b.delay }}
                    />
                  ))}
                </div>
                {/* Center core */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-card border border-primary/40 flex items-center justify-center">
                    <Cpu className="w-4 h-4 text-primary" />
                  </div>
                </div>
              </div>
              <span key={progressLabel} className="text-sm font-medium text-primary" style={{ animation: "tx-scan-fade-in 0.25s ease-out" }}>
                {progressLabel || "Scanning..."}
              </span>
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
                  style={{ animation: "tx-scan-fade-in 0.3s ease-out both", animationDelay: `${i * 60}ms` }}
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
                        r.favoredLabel === r.sideALabel ? "text-teal-600" : "text-red-600"
                      }`}
                    >
                      {r.favoredLabel} {Math.max(r.sideAPct, r.sideBPct).toFixed(1)}%
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
