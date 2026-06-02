'use client';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import useSWR from 'swr';
import { fetcher } from './api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545';

// ── Types ──
interface ContractABIResponse {
    status: string;
    data: {
        name: string;
        address: string | null;
        deployed: boolean;
        abi: ABIEntry[];
        functions: number;
        events: number;
    };
}

interface ABIEntry {
    type: string;
    name?: string;
    inputs?: { name: string; type: string; indexed?: boolean }[];
    outputs?: { name: string; type: string }[];
    stateMutability?: string;
}

interface DeploymentData {
    core: Record<string, string>;
    sectors: Record<string, Record<string, string>>;
}

interface ContractReadResult<T = unknown> {
    data: T | null;
    loading: boolean;
    error: string | null;
    refetch: () => void;
}

// ── Lazy ethers import (avoids SSR crash) ──
let _ethers: typeof import('ethers') | null = null;
async function getEthers() {
    if (_ethers) return _ethers;
    _ethers = await import('ethers');
    return _ethers;
}

// ── Provider singleton ──
let _provider: unknown = null;
async function getProvider() {
    if (_provider) return _provider;
    const ethers = await getEthers();
    if (typeof window !== 'undefined' && (window as any).ethereum) {
        _provider = new ethers.BrowserProvider((window as any).ethereum);
    } else {
        _provider = new ethers.JsonRpcProvider(RPC_URL);
    }
    return _provider;
}

// ── Hook: Fetch contract ABI from API ──
export function useContractABI(contractName: string | null) {
    const key = contractName ? `/contracts/abi/${contractName}` : null;
    const { data, error, isLoading } = useSWR<ContractABIResponse>(
        key,
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 300_000 },
    );
    return {
        abi: data?.data?.abi ?? null,
        address: data?.data?.address ?? null,
        deployed: data?.data?.deployed ?? false,
        abiMeta: data?.data ?? null,
        loading: isLoading,
        error: error?.message ?? null,
    };
}

// ── Hook: All deployments ──
export function useDeployments() {
    const { data, error, isLoading } = useSWR<{ status: string; data: DeploymentData }>(
        '/contracts/deployments',
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 300_000 },
    );
    return {
        deployments: data?.data ?? null,
        loading: isLoading,
        error: error?.message ?? null,
    };
}

// ── Hook: Generic contract read ──
export function useContractRead<T = unknown>(
    contractName: string | null,
    method: string,
    args: unknown[] = [],
    { enabled = true, refreshInterval = 0 } = {},
): ContractReadResult<T> {
    const { abi, address } = useContractABI(contractName);
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const argsKey = JSON.stringify(args);
    const mountRef = useRef(true);

    const execute = useCallback(async () => {
        if (!abi || !address || !method || !enabled) return;
        setLoading(true);
        setError(null);
        try {
            const ethers = await getEthers();
            const provider = await getProvider();
            const contract = new ethers.Contract(address, abi, provider as any);
            const result = await contract[method](...args);
            if (mountRef.current) setData(result as T);
        } catch (err: any) {
            if (mountRef.current) setError(err?.reason || err?.message || 'Contract call failed');
        } finally {
            if (mountRef.current) setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [abi, address, method, argsKey, enabled]);

    useEffect(() => {
        mountRef.current = true;
        execute();
        let interval: ReturnType<typeof setInterval> | null = null;
        if (refreshInterval > 0) {
            interval = setInterval(execute, refreshInterval);
        }
        return () => {
            mountRef.current = false;
            if (interval) clearInterval(interval);
        };
    }, [execute, refreshInterval]);

    return { data, loading, error, refetch: execute };
}

// ── Hook: BEZ token balance ──
export function useBEZBalance(address: string | null) {
    return useContractRead<bigint>(
        address ? 'BEZCoinV2' : null,
        'balanceOf',
        address ? [address] : [],
        { enabled: !!address, refreshInterval: 15_000 },
    );
}

// ── Hook: Staking info ──
export function useStakingInfo(userAddress: string | null) {
    const staked = useContractRead<bigint>(
        userAddress ? 'StakingPool' : null,
        'getStake',
        userAddress ? [userAddress] : [],
        { enabled: !!userAddress, refreshInterval: 30_000 },
    );
    const rewards = useContractRead<bigint>(
        userAddress ? 'StakingPool' : null,
        'pendingRewards',
        userAddress ? [userAddress] : [],
        { enabled: !!userAddress, refreshInterval: 30_000 },
    );
    return {
        staked: staked.data,
        rewards: rewards.data,
        loading: staked.loading || rewards.loading,
        error: staked.error || rewards.error,
        refetch: () => { staked.refetch(); rewards.refetch(); },
    };
}

// ── Hook: Governance proposal count ──
export function useGovernance() {
    const count = useContractRead<bigint>(
        'GovernanceSystem',
        'proposalCount',
        [],
        { refreshInterval: 60_000 },
    );
    return {
        proposalCount: count.data ? Number(count.data) : null,
        loading: count.loading,
        error: count.error,
    };
}

// ── Hook: Liquidity farming pool info ──
export function useLiquidityFarming(userAddress: string | null) {
    const info = useContractRead<any>(
        userAddress ? 'LiquidityFarming' : null,
        'userInfo',
        userAddress ? [userAddress] : [],
        { enabled: !!userAddress, refreshInterval: 30_000 },
    );
    return {
        farmInfo: info.data,
        loading: info.loading,
        error: info.error,
        refetch: info.refetch,
    };
}

// ── Utility: format wei to BEZ (18 decimals) ──
export function formatBEZ(wei: bigint | null | undefined): string {
    if (wei == null) return '0.00';
    const str = wei.toString().padStart(19, '0');
    const whole = str.slice(0, -18) || '0';
    const fraction = str.slice(-18, -16);
    return `${whole}.${fraction}`;
}
