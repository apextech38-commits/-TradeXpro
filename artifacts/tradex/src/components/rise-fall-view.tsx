import React, { useState } from 'react';

interface RiseFallViewProps {
  symbol?: string;
}

export default function RiseFallView({ symbol = '1HZ100V' }: RiseFallViewProps) {
  const [stake, setStake] = useState<string>('10');
  const [duration, setDuration] = useState<number>(1);
  const [durationUnit, setDurationUnit] = useState<string>('t');
  const [allowEquals, setAllowEquals] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handlePurchase = async (contractType: 'CALL' | 'PUT') => {
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      // Pull down the active underlying websocket socket from the window layout context safely
      const globalWS = (window as any).derivWS || (window as any).ws;
      
      if (!globalWS) {
        setStatusMessage({ type: 'error', text: 'Trading connection initialization pending. Please try again in a moment.' });
        setIsSubmitting(false);
        return;
      }

      console.log(`[TradeX Link] Routing ${contractType} transaction down active authenticated channel...`);
      
      // Dispatch the payload down the primary app channel directly
      const payload = {
        buy: 1,
        price: parseFloat(stake),
        parameters: {
          amount: parseFloat(stake),
          basis: 'stake',
          contract_type: contractType,
          currency: 'USD',
          duration: duration,
          duration_unit: durationUnit,
          symbol: symbol,
          barrier: allowEquals ? '=' : undefined
        }
      };

      // Safely call the globally exposed send method handled by the main application session
      const response = typeof globalWS.send === 'function' 
        ? await globalWS.send(payload)
        : await globalWS.sendRaw(JSON.stringify(payload));

      console.log("[TradeX Link] Transaction result:", response);
      setStatusMessage({ type: 'success', text: `Contract purchased successfully!` });
    } catch (error: any) {
      console.error("[TradeX Link] Execution failure:", error);
      setStatusMessage({ type: 'error', text: error?.message || 'Transaction failed. Verify authorization tokens.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 bg-background rounded-xl border space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Strategy: Rise/Fall</h3>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Stake (USD)</label>
        <input 
          type="number" 
          value={stake} 
          onChange={(e) => setStake(e.target.value)}
          className="w-full p-2 rounded-lg border bg-input text-foreground"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Duration</label>
          <input 
            type="number" 
            value={duration} 
            onChange={(e) => setDuration(parseInt(e.target.value) || 1)}
            className="w-full p-2 rounded-lg border bg-input text-foreground"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Unit</label>
          <select 
            value={durationUnit} 
            onChange={(e) => setDurationUnit(e.target.value)}
            className="w-full p-2 rounded-lg border bg-input text-foreground h-[42px]"
          >
            <option value="t">Ticks</option>
            <option value="s">Seconds</option>
            <option value="m">Minutes</option>
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <span className="text-xs font-medium text-muted-foreground">Allow equals</span>
        <input 
          type="checkbox" 
          checked={allowEquals} 
          onChange={(e) => setAllowEquals(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2">
        <button
          onClick={() => handlePurchase('CALL')}
          disabled={isSubmitting}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium p-3 rounded-xl transition disabled:opacity-50"
        >
          {isSubmitting ? 'Processing...' : 'Rise'}
        </button>
        <button
          onClick={() => handlePurchase('PUT')}
          disabled={isSubmitting}
          className="bg-rose-600 hover:bg-rose-500 text-white font-medium p-3 rounded-xl transition disabled:opacity-50"
        >
          {isSubmitting ? 'Processing...' : 'Fall'}
        </button>
      </div>

      {statusMessage && (
        <div className={`p-3 rounded-lg text-xs font-medium ${
          statusMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
        }`}>
          {statusMessage.text}
        </div>
      )}
    </div>
  );
}
