import { useState, useCallback } from 'react';
import { useBezhasAuth } from '../auth/useBezhasAuth';

/**
 * useSmartWallet — Account Abstraction for gasless user experience.
 * 
 * Wraps ERC-4337 Smart Wallet operations so end users never interact
 * with raw transactions. The Paymaster handles gas payment.
 */
export function useSmartWallet() {
  const { address, jwt } = useBezhasAuth();
  const [isPending, setIsPending] = useState(false);

  const GATEWAY_URL = typeof window !== 'undefined'
    ? (window as any).__BEZHAS_GATEWAY_URL__ || 'http://localhost:3001/api/gateway/v1'
    : process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001/api/gateway/v1';

  /**
   * Send BEZ to another address. Gas is abstracted via Paymaster.
   */
  const sendBEZ = useCallback(async (to: string, amount: string) => {
    if (!jwt || !address) throw new Error('Not authenticated');
    setIsPending(true);
    try {
      const res = await fetch(`${GATEWAY_URL}/wallet/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ from: address, to, amount, token: 'BEZ' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Send failed' }));
        throw new Error(err.message);
      }
      return await res.json();
    } finally {
      setIsPending(false);
    }
  }, [jwt, address, GATEWAY_URL]);

  /**
   * Execute a batch of operations in a single UserOp (ERC-4337).
   * Useful for: scan + mint + register in one transaction.
   */
  const batchExecute = useCallback(async (operations: Array<{
    contract: string;
    method: string;
    args: any[];
  }>) => {
    if (!jwt || !address) throw new Error('Not authenticated');
    setIsPending(true);
    try {
      const res = await fetch(`${GATEWAY_URL}/wallet/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ from: address, operations }),
      });
      if (!res.ok) throw new Error('Batch execution failed');
      return await res.json();
    } finally {
      setIsPending(false);
    }
  }, [jwt, address, GATEWAY_URL]);

  /**
   * Setup social recovery (WalletGuardian) — no seed phrase needed.
   */
  const setupGuardian = useCallback(async (guardianAddresses: string[]) => {
    if (!jwt || !address) throw new Error('Not authenticated');
    const res = await fetch(`${GATEWAY_URL}/wallet/guardian/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ wallet: address, guardians: guardianAddresses }),
    });
    if (!res.ok) throw new Error('Guardian setup failed');
    return await res.json();
  }, [jwt, address, GATEWAY_URL]);

  return { sendBEZ, batchExecute, setupGuardian, isPending };
}

export default useSmartWallet;
