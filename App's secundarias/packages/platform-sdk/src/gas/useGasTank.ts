import { useState, useEffect, useCallback } from 'react';
import { useBezhasAuth } from '../auth/useBezhasAuth';

export interface GasTankState {
  balance_usd: number;
  balance_bez: number;
  estimated_txs_remaining: number;
  auto_recharge_enabled: boolean;
  auto_recharge_threshold: number;
  auto_recharge_amount: number;
  last_recharge: string | null;
  is_low: boolean;
}

const GATEWAY_URL = typeof window !== 'undefined'
  ? (window as any).__BEZHAS_GATEWAY_URL__ || 'http://localhost:3001/api/gateway/v1'
  : process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001/api/gateway/v1';

const COST_PER_TX_USD = 0.005;

/**
 * useGasTank — Corporate Gas Tank management hook.
 * 
 * Provides balance tracking, cost estimation, and Stripe recharge triggers.
 * The CFO recharges with a credit card; users never see raw gas.
 */
export function useGasTank() {
  const { jwt, did, isAuthenticated } = useBezhasAuth();
  const [state, setState] = useState<GasTankState>({
    balance_usd: 0,
    balance_bez: 0,
    estimated_txs_remaining: 0,
    auto_recharge_enabled: false,
    auto_recharge_threshold: 10,
    auto_recharge_amount: 50,
    last_recharge: null,
    is_low: false,
  });
  const [isLoading, setIsLoading] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!jwt || !did) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${GATEWAY_URL}/gas-tank/${did}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!res.ok) throw new Error('Gas tank fetch failed');
      const data = await res.json();
      setState({
        balance_usd: data.balance_usd ?? 0,
        balance_bez: data.balance_bez ?? 0,
        estimated_txs_remaining: Math.floor((data.balance_usd ?? 0) / COST_PER_TX_USD),
        auto_recharge_enabled: data.auto_recharge_enabled ?? false,
        auto_recharge_threshold: data.auto_recharge_threshold ?? 10,
        auto_recharge_amount: data.auto_recharge_amount ?? 50,
        last_recharge: data.last_recharge ?? null,
        is_low: (data.balance_usd ?? 0) < (data.auto_recharge_threshold ?? 10),
      });
    } catch {
      // Keep last known state on error
    } finally {
      setIsLoading(false);
    }
  }, [jwt, did]);

  useEffect(() => {
    if (isAuthenticated) fetchBalance();
  }, [isAuthenticated, fetchBalance]);

  /**
   * Estimate the cost (in USD and BEZ) of a specific operation.
   */
  const estimateCost = useCallback(async (operation: string) => {
    try {
      const res = await fetch(`${GATEWAY_URL}/gas-tank/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ operation, did }),
      });
      if (!res.ok) return { usd: COST_PER_TX_USD, bez: COST_PER_TX_USD * 10 };
      return await res.json();
    } catch {
      return { usd: COST_PER_TX_USD, bez: COST_PER_TX_USD * 10 };
    }
  }, [jwt, did]);

  /**
   * Initiate a Stripe Checkout session for gas recharge.
   * Returns a URL to redirect to Stripe.
   */
  const recharge = useCallback(async (amount_usd: number) => {
    const res = await fetch(`${GATEWAY_URL}/gas-tank/recharge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ did, amount_usd }),
    });
    if (!res.ok) throw new Error('Recharge initiation failed');
    const { checkout_url } = await res.json();
    return checkout_url as string;
  }, [jwt, did]);

  /**
   * Configure auto-recharge parameters.
   */
  const configureAutoRecharge = useCallback(async (config: {
    enabled: boolean;
    threshold_usd: number;
    amount_usd: number;
  }) => {
    const res = await fetch(`${GATEWAY_URL}/gas-tank/auto-recharge`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ did, ...config }),
    });
    if (!res.ok) throw new Error('Auto-recharge config failed');
    await fetchBalance();
  }, [jwt, did, fetchBalance]);

  return {
    ...state,
    isLoading,
    estimateCost,
    recharge,
    configureAutoRecharge,
    refresh: fetchBalance,
  };
}

export default useGasTank;
