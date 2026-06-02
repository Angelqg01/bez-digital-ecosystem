
import { useEffect, useState, useCallback, useMemo } from 'react';
import { TokenomicsEngine } from '@/lib/sdk/tokenomics-engine';
import { ethers } from 'ethers';

// Helper para obtener provider/signer en el frontend (Next.js)
async function getWeb3() {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        return { provider, signer };
    }
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    return { provider, signer: null };
}

export function useTokenomics(address?: string) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [engine, setEngine] = useState<TokenomicsEngine | null>(null);

  // Inicializar Engine
  useEffect(() => {
    getWeb3().then(({ provider, signer }) => {
        const newEngine = new TokenomicsEngine(signer || provider);
        setEngine(newEngine);
    });
  }, []);

  const fetchAll = useCallback(async () => {
    if (!address || !engine) return;
    try {
      setLoading(true);
      const [pos, pools, portfolio] = await Promise.all([
        engine.getStakingPosition(address),
        engine.getAllFarmingPools(address),
        engine.getPortfolio(address)
      ]);
      
      setData({ 
        staking: { position: pos },
        farming: { pools },
        portfolio,
        rewards: {
            totalPending: Number(pos.rewards),
            stakingRewards: Number(pos.rewards),
            farmingRewards: 0,
            nodeRewards: 0
        }
      });
      setError(null);
    } catch (err: any) {
      console.error("Error in useTokenomics:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [address, engine]);

  useEffect(() => { 
    if (engine) {
        fetchAll(); 
        const i = setInterval(fetchAll, 30000); 
        return () => clearInterval(i); 
    }
  }, [fetchAll, engine]);

  // Métodos de escritura expuestos directamente
  const stake = async (amount: string) => engine?.stake(amount);
  const unstake = async (amount: string) => engine?.unstake(amount);
  const claimRewards = async () => engine?.claimStakingRewards();

  return { 
    ...data, 
    stake,
    unstake, 
    claimRewards, 
    isLoading: loading, 
    error 
  };
}
