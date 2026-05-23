export default function TradingView() {
  return (
    <div className="flex flex-col w-full h-[calc(100vh-56px-52px)] bg-background">
      <div className="px-4 py-2 border-b border-border bg-card shrink-0 flex items-center gap-2">
        <span className="text-xs font-semibold text-foreground">Deriv SmartCharts</span>
        <span className="text-xs text-muted-foreground">— All Volatility indices including V10, V25, V50, V75, V100</span>
      </div>
      <div className="flex-1 relative">
        <iframe
          src="https://charts.deriv.com"
          className="w-full h-full border-0"
          title="Deriv SmartCharts"
          allow="fullscreen"
        />
      </div>
    </div>
  );
}
