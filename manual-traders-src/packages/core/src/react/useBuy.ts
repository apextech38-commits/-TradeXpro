// manual-traders-src/packages/core/src/react/useBuy.ts
'use client';

import { useState, useCallback } from 'react';
import type { DerivWS } from '../ws';
import type { ProposalInfo, BuyResponse, BuyResult } from '../types';

interface UseBuyReturn {
  buyContract: (proposal: ProposalInfo) => Promise<void>;
  isBuying: boolean;
  buyResult: BuyResult | null;
  buyError: string | null;
  clearBuyResult: () => void;
}

export function useBuy(
  ws: DerivWS | null,
  isConnected: boolean,
  isAuthenticatedSocketOpen: boolean = false // New param
): UseBuyReturn {
  const [isBuying, setIsBuying] = useState(false);
  const [buyResult, setBuyResult] = useState<BuyResult | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);

  const clearBuyResult = useCallback(() => {
    setBuyResult(null);
    setBuyError(null);
  }, []);

  const buyContract = useCallback(async (proposal: ProposalInfo) => {
    // 🔐 CRITICAL: Check authentication before attempting buy
    if (!ws || !isConnected) {
      const error = 'WebSocket not connected';
      console.error('❌ Buy failed:', error);
      setBuyError(error);
      return;
    }

    if (!isAuthenticatedSocketOpen) {
      const error = 'Please log in to purchase contracts';
      console.error('❌ Buy failed: Not authenticated', {
        ws, // avoid accessing private properties like `url`
        isConnected,
        isAuthenticatedSocketOpen
      });
      setBuyError(error);
      throw new Error(error);
    }

    // Log the WS URL being used for debugging
    console.log('🛒 Buying with authenticated socket:', {
      ws, // avoid accessing private properties like `url`
      proposalId: proposal.id,
      price: proposal.askPrice
    });

    setIsBuying(true);
    setBuyError(null);
    setBuyResult(null);

    try {
      const response = await ws.send<BuyResponse>({
        buy: proposal.id,
        price: String(proposal.askPrice),
      });

      console.log('✅ Buy response:', response);

      if (response.buy) {
        setBuyResult({
          contractId: response.buy.contract_id,
          buyPrice: response.buy.buy_price,
          payout: response.buy.payout,
          longcode: response.buy.longcode,
          balanceAfter: response.buy.balance_after,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Purchase failed';
      console.error('❌ Buy error:', errorMessage, err);
      setBuyError(errorMessage);
      throw err;
    } finally {
      setIsBuying(false);
    }
  }, [ws, isConnected, isAuthenticatedSocketOpen]);

  return { buyContract, isBuying, buyResult, buyError, clearBuyResult };
}