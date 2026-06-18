import React, { useState, useEffect } from 'react';

export default function RiseFallView({ symbol = '1HZ100V' }) {
  const [stake, setStake] = useState('10');
  const [duration, setDuration] = useState(1);
  const [durationUnit, setDurationUnit] = useState('t');
  const [allowEquals, setAllowEquals] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Auto-deduplicate subscription states on component mount/reset
  useEffect(() => {
    const activeWS = window.derivWS || window.ws || window.socket;
    if (activeWS && activeWS.readyState === WebSocket.OPEN) {
      console.log("[TradeX Fix]: Clearing dangling channels for", symbol);
      // Send forget all or forget subscription if platform supports it
      try {
        activeWS.send(JSON.stringify({ forget_all: "ticks" }));
      } catch (e) {
        console.error(e);
      }
    }
  }, [symbol]);

  const handlePurchase = async (contractType) => {
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const activeWS = window.derivWS || window.ws || window.socket;
      
      if (!activeWS || activeWS.readyState !== WebSocket.OPEN) {
        setStatusMessage({ type: 'error', text: 'Channel offline. Please check your network connection.' });
        return;
      }

      const payload = {
        buy: 1,
        price: parseFloat(stake),
        parameters: {
          amount: parseFloat(stake),
          basis: 'stake',
          contract_type: contractType,
          currency: 'USD',
          duration: parseInt(duration) || 1,
          duration_unit: durationUnit,
          symbol: symbol,
          barrier: allowEquals ? '=' : undefined
        }
      };
      
      console.log("[TradeX Direct Execution]:", payload);
      activeWS.send(JSON.stringify(payload));
      setStatusMessage({ type: 'success', text: 'Order processed successfully!' });
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 bg-background rounded-xl border space-y-4">
      <div>
        <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Manual Engine: Rise/Fall</h3>
      </div>
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Stake (USD)</label>
        <input type="number" value={stake} onChange={(e) => setStake(e.target.value)} className="w-full p-2 rounded-lg border bg-input text-foreground"/>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Duration</label>
          <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full p-2 rounded-lg border bg-input text-foreground"/>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Unit</label>
          <select value={durationUnit} onChange={(e) => setDurationUnit(e.target.value)} className="w-full p-2 rounded-lg border bg-input text-foreground h-[42px]">
            <option value="t">Ticks</option>
            <option value="s">Seconds</option>
            <option value="m">Minutes</option>
          </select>
        </div>
      </div>
      <div className="flex items-center justify-between pt-2">
        <span className="text-xs font-medium text-muted-foreground">Allow equals</span>
        <input type="checkbox" checked={allowEquals} onChange={(e) => setAllowEquals(e.target.checked)} className="h-4 w-4 accent-primary"/>
      </div>
      <div className="grid grid-cols-2 gap-3 pt-2">
        <button onClick={() => handlePurchase('CALL')} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium p-3 rounded-xl transition disabled:opacity-50">Rise</button>
        <button onClick={() => handlePurchase('PUT')} disabled={isSubmitting} className="bg-rose-600 hover:bg-rose-500 text-white font-medium p-3 rounded-xl transition disabled:opacity-50">Fall</button>
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
