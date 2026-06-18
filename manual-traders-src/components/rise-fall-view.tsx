import { useDerivWSContext } from '@/components/custom/deriv-ws-provider';
import { useRiseFallTrading } from '@/hooks/use-rise-fall-trading';
import { TradeControls } from './trade-controls';

export default function RiseFallView({ symbol = '1HZ100V' }: { symbol?: string }) {
  const { ws, isConnected, isExhausted, isAuthenticatedSocketOpen, auth } = useDerivWSContext();
  const trading = useRiseFallTrading({
    ws,
    isConnected,
    isExhausted,
    isAuthenticated: !!auth.wsUrl,
    isAuthenticatedSocketOpen,
    onAuthWSFailed: auth.logout,
  });

  return (
    <div className="p-4 bg-background rounded-xl border space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Strategy: Rise/Fall</h3>
      </div>
      <TradeControls
        direction={trading.direction}
        onDirectionChange={trading.setDirection}
        allowEquals={trading.allowEquals}
        onAllowEqualsChange={trading.setAllowEquals}
        isConnected={trading.isConnected}
        stake={trading.stake}
        onStakeChange={trading.setStake}
        duration={trading.duration}
        onDurationChange={trading.setDuration}
        durationOptions={trading.durationOptions}
        durationUnit={trading.durationUnit}
        onDurationUnitChange={trading.setDurationUnit}
        endDate={trading.endDate}
        onEndDateChange={trading.setEndDate}
        endTime={trading.endTime}
        onEndTimeChange={trading.setEndTime}
        ws={trading.ws}
        activeSymbol={trading.activeSymbol}
        proposal={trading.proposal}
        onBuy={trading.buyContract}
        isBuying={trading.isBuying}
        buyResult={trading.buyResult}
        buyError={trading.buyError}
        onClearBuyResult={trading.clearBuyResult}
        isAuthenticated={!!auth.wsUrl}
        isAuthenticatedSocketOpen={isAuthenticatedSocketOpen}
      />
      <p className="text-xs text-muted-foreground">Selected symbol: {symbol}</p>
    </div>
  );
}
