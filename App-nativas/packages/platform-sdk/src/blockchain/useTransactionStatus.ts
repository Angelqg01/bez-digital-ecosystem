import { useState, useEffect, useCallback } from 'react';
import { useBezhasAuth } from '../auth/useBezhasAuth';

export type TxStatus = 'pending' | 'submitted' | 'confirming' | 'confirmed' | 'failed';

interface TransactionState {
  hash: string | null;
  status: TxStatus;
  confirmations: number;
  blockNumber: number | null;
  gasUsed: string | null;
  error: string | null;
}

const GATEWAY_URL = typeof window !== 'undefined'
  ? (window as any).__BEZHAS_GATEWAY_URL__ || 'http://localhost:3001/api/gateway/v1'
  : process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001/api/gateway/v1';

/**
 * useTransactionStatus — Track a transaction through its lifecycle.
 * 
 * Polls the Gateway for status updates and resolves when confirmed or failed.
 * Connects to SSE for real-time updates when available.
 */
export function useTransactionStatus(txHash?: string) {
  const { jwt } = useBezhasAuth();
  const [state, setState] = useState<TransactionState>({
    hash: txHash || null,
    status: txHash ? 'submitted' : 'pending',
    confirmations: 0,
    blockNumber: null,
    gasUsed: null,
    error: null,
  });

  const track = useCallback(async (hash: string) => {
    setState(prev => ({ ...prev, hash, status: 'submitted' }));

    const poll = async () => {
      try {
        const res = await fetch(`${GATEWAY_URL}/tx/status/${hash}`, {
          headers: { ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
        });

        if (!res.ok) return;
        const data = await res.json();

        setState({
          hash,
          status: data.status || 'confirming',
          confirmations: data.confirmations ?? 0,
          blockNumber: data.block_number ?? null,
          gasUsed: data.gas_used ?? null,
          error: data.error ?? null,
        });

        return data.status;
      } catch {
        return 'pending';
      }
    };

    // Poll until confirmed or failed
    let attempts = 0;
    const maxAttempts = 60; // ~2 minutes at 2s interval
    const interval = setInterval(async () => {
      const status = await poll();
      attempts++;
      if (status === 'confirmed' || status === 'failed' || attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, 2000);

    // Initial check
    await poll();

    return () => clearInterval(interval);
  }, [jwt]);

  // Auto-track if txHash prop changes
  useEffect(() => {
    if (txHash) {
      const cleanup = track(txHash);
      return () => { cleanup.then(fn => fn?.()); };
    }
  }, [txHash, track]);

  return { ...state, track };
}

export default useTransactionStatus;
