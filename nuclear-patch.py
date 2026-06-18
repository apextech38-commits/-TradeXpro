import os
import time
import re

CACHE_BUST_SEED = str(int(time.time()))

# --- PHASE 1: OVERWRITE COMPONENT SOURCE ---
CODE_PAYLOAD = """import React, { useState } from 'react';

export default function RiseFallView({ symbol = '1HZ100V' }) {
  const [stake, setStake] = useState('10');
  const [duration, setDuration] = useState(1);
  const [durationUnit, setDurationUnit] = useState('t');
  const [allowEquals, setAllowEquals] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const handlePurchase = async (contractType) => {
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const activeWS = window.derivWS || window.ws || window.socket;
      
      if (!activeWS) {
        setStatusMessage({ type: 'error', text: 'Connecting channel... Click again.' });
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
      
      console.log("[Nuclear Direct Dispatch]:", payload);
      
      if (typeof activeWS.send === 'function') {
        activeWS.send(JSON.stringify(payload));
      } else if (typeof activeWS.sendRaw === 'function') {
        activeWS.sendRaw(JSON.stringify(payload));
      }
      
      setStatusMessage({ type: 'success', text: 'Order request submitted!' });
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 bg-background rounded-xl border space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Strategy: Rise/Fall (Nuclear Live)</h3>
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
"""

for root, dirs, files in os.walk("/workspaces/-TradeXpro"):
    if any(p in root for p in ["node_modules", ".git", ".next", "dist"]):
        continue
    for file in files:
        if file == "rise-fall-view.tsx":
            with open(os.path.join(root, file), "w") as f:
                f.write(CODE_PAYLOAD)

# --- PHASE 2: MUTATE GENERATED PRODUCTION ASSETS POST-BUILD ---
dist_html = "/workspaces/-TradeXpro/artifacts/tradex/dist/public/index.html"
if os.path.exists(dist_html):
    print(f"🧬 Post-processing production entry point: {dist_html}")
    with open(dist_html, "r") as f:
        html_content = f.read()

    # Force mutate asset script references to clear Edge Server indexing caches
    mutated_content = re.sub(
        r'src="([^"]+)\.js"', 
        f'src="\\1.js?v={CACHE_BUST_SEED}"', 
        html_content
    )
    
    # Inject a unique tracking meta property tag to guarantee the file signature shifts
    tracking_meta = f'<meta name="build-instant" content="{CACHE_BUST_SEED}">'
    mutated_content = mutated_content.replace("<head>", f"<head>{tracking_meta}")

    with open(dist_html, "w") as f:
        f.write(mutated_content)
    print("🚀 Asset reference mutated successfully.")
