import RiseFallView from '@/components/rise-fall-view';
import TradeControls from '@/components/trade-controls';

export default function ManualTraders() {
  return (
    <div className="flex flex-col h-full w-full bg-background">
      <div className="flex-1 min-h-0 overflow-auto">
        <RiseFallView />
      </div>
      <div className="shrink-0 border-t border-border">
        <TradeControls />
      </div>
    </div>
  );
}
