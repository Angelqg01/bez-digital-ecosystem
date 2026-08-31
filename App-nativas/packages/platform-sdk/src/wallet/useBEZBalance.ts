import { useState, useEffect, useCallback } from 'react';
import { useBezhasAuth } from '../auth/useBezhasAuth';

interface BEZBalanceState {
  balance: string;          // Raw BEZ balance (wei-like string)
  formatted: number;        // Human-readable BEZ amount
  usd_value: number;        // USD equivalent
  last_updated: number;     // Timestamp
}

const GATEWAY_URL = typeof window !== 'undefined'
  ? (window as any).__BEZHAS_GATEWAY_URL__ || 'http://localhost:3001/api/gateway/v1'
  : process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001/api/gateway/v1';

/**
 * useBEZBalance — Real-time BEZ-Coin balance with USD conversion.
 * 
 * Polls the balance every 15 seconds and provides USD value
 * via the integrated price oracle.
 */
export function useBEZBalance() {
  const { address, jwt, isAuthenticated } = useBezhasAuth();
  const [state, setState] = useState<BEZBalanceState>({
    balance: '0',
    formatted: 0,
    usd_value: 0,
    last_updated: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!address || !jwt) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${GATEWAY_URL}/wallet/balance/${address}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!res.ok) throw new Error('Balance fetch failed');
      const data = await res.json();
      setState({
        balance: data.balance ?? '0',
        formatted: data.formatted ?? 0,
        usd_value: data.usd_value ?? 0,
        last_updated: Date.now(),
      });
    } catch {
      // Keep last known balance
    } finally {
      setIsLoading(false);
    }
  }, [address, jwt]);

  // Poll every 15 seconds when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchBalance();
    const interval = setInterval(fetchBalance, 15_000);
    return () => clearInterval(interval);
  }, [isAuthenticated, fetchBalance]);

  return { ...state, isLoading, refresh: fetchBalance };
}

export default useBEZBalance;
