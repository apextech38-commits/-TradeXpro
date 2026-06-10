import RiseFallView from '@/components/rise-fall-view';
import TradeControls from '@/components/trade-controls';

export default function ManualTraders() {
  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden">
      <div className="flex-1 min-h-0 overflow-hidden">
        <RiseFallView />
      </div>
      <div className="shrink-0 border-t border-border bg-background">
        <TradeControls />
      </div>
    </div>
  );
}
