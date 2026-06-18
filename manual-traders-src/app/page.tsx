// manual-traders-src/app/page.tsx or wherever you use these hooks
'use client';

import { useBuy } from '@/packages/core/src/react/useBuy';
import { useProposal } from '@/packages/core/src/react/useProposal';
import { useTicks } from '@/packages/core/src/react/useTicks';
import { useDerivWSContext } from '@/components/custom/deriv-ws-provider';
import { useAuth } from '@/hooks/use-auth';

export default function TradingPage() {
  const { ws, isConnected, isAuthenticatedSocketOpen } = useDerivWSContext();
  const auth = useAuth();
  const { wsUrl } = auth;
  // normalize possible account fields from useAuth
  const accountId = (auth as any)?.accountId ?? (auth as any)?.account?.id ?? (auth as any)?.account?.loginid ?? '';
  const accountType = (auth as any)?.accountType ?? (auth as any)?.account?.type ?? (auth as any)?.account_type ?? '';
  
  // Pass the authentication flag to all hooks
  const { buyContract, isBuying, buyError } = useBuy(
    ws, 
    isConnected, 
    isAuthenticatedSocketOpen // ← This is the key change
  );
  
  const { proposal } = useProposal(
    ws,
    isConnected,
    { 
      amount: 100,
      basis: 'stake',
      contractType: 'CALL',
      currency: 'USD',
      symbol: '1HZ100V',
      duration: 10,
      durationUnit: 't'
    },
    isAuthenticatedSocketOpen // ← This is the key change
  );
  
  const activeSymbol = {
    underlying_symbol: '1HZ100V',
    pip_size: 0.01,
  } as any;

  const { currentTick, prices, pipSize } = useTicks(
    ws,
    isConnected,
    activeSymbol,
    1000,
    isAuthenticatedSocketOpen // ← This is the key change
  );

  const handleBuy = async () => {
    if (!proposal || !isAuthenticatedSocketOpen) {
      console.error('Cannot buy: not authenticated or no proposal');
      return;
    }
    
    try {
      await buyContract(proposal);
    } catch (error) {
      console.error('Buy failed:', error);
    }
  };

  // Debug display
  console.log('🔐 Connection status:', {
    isConnected,
    isAuthenticatedSocketOpen,
    wsUrl,
    accountId,
    accountType
  });

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <div>Status: {isAuthenticatedSocketOpen ? '✅ Authenticated' : '⏳ Connecting...'}</div>
        <div>WS: {wsUrl?.split('?')[0]}</div>
        <div>Account: {accountId} ({accountType})</div>
        {!isAuthenticatedSocketOpen && (
          <div style={{ color: 'orange' }}>
            ⚠️ Please wait for authenticated connection...
          </div>
        )}
      </div>
      
      <div>
        Current Price: {currentTick?.quote || 'Loading...'}
      </div>
      
      <button 
        onClick={handleBuy}
        disabled={!isAuthenticatedSocketOpen || isBuying || !proposal}
        style={{
          padding: '10px 20px',
          background: isAuthenticatedSocketOpen ? '#4CAF50' : '#ccc',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: isAuthenticatedSocketOpen ? 'pointer' : 'not-allowed'
        }}
      >
        {isBuying ? 'Processing...' : 'Buy'}
      </button>
      
      {buyError && (
        <div style={{ color: 'red', marginTop: '10px' }}>
          Error: {buyError}
        </div>
      )}
    </div>
  );
}