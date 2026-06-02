import { useState, useCallback } from 'react';
import { useBezhasAuth } from '../auth/useBezhasAuth';
import { CONTRACTS } from './contracts';

const GATEWAY_URL = typeof window !== 'undefined'
  ? (window as any).__BEZHAS_GATEWAY_URL__ || 'http://localhost:3001/api/gateway/v1'
  : process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001/api/gateway/v1';

/**
 * useContractCall — Generic hook for read/write calls to any BeZhas contract.
 * 
 * Read calls are free (view/pure). Write calls go through the Paymaster
 * so the user never pays gas directly.
 * 
 * Usage:
 * ```tsx
 * const { read, write, isLoading } = useContractCall('BeZhasLogisticsNFT');
 * const totalSupply = await read('totalSupply');
 * const tx = await write('mintLogisticsNFT', { recipient: '0x...', metadataHash: '0x...' });
 * ```
 */
export function useContractCall(contractName: keyof typeof CONTRACTS) {
  const { jwt, address } = useBezhasAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contract = CONTRACTS[contractName];
  if (!contract) {
    console.warn(`[platform-sdk] Contract "${contractName}" not found in registry.`);
  }

  /**
   * Read from contract (free, no gas).
   */
  const read = useCallback(async <T = any>(
    method: string,
    args: Record<string, any> = {}
  ): Promise<T> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${GATEWAY_URL}/contracts/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
        },
        body: JSON.stringify({
          contract: contractName,
          contract_address: contract?.address,
          method,
          args,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Read failed' }));
        throw new Error(err.message || `Read ${contractName}.${method} failed`);
      }

      const data = await res.json();
      return data.result as T;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [jwt, contractName, contract?.address]);

  /**
   * Write to contract (gas paid via Paymaster / Gas Tank).
   */
  const write = useCallback(async <T = any>(
    method: string,
    args: Record<string, any> = {}
  ): Promise<T & { hash: string }> => {
    if (!jwt || !address) throw new Error('Not authenticated');
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${GATEWAY_URL}/contracts/write`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          contract: contractName,
          contract_address: contract?.address,
          method,
          args,
          from: address,
          use_paymaster: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Write failed' }));
        throw new Error(err.message || `Write ${contractName}.${method} failed`);
      }

      return await res.json();
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [jwt, address, contractName, contract?.address]);

  return { read, write, isLoading, error, contractAddress: contract?.address || '' };
}

export default useContractCall;
