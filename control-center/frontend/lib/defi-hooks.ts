'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * BeZhas DeFi Hooks — On-chain integration with LiquidityFarming.sol & StakingPool.sol
 * ─────────────────────────────────────────────────────────────────────────────────────
 * Replaces BeZhasSDK-based farming with direct ethers.js contract calls.
 *
 * Contracts:
 *   - LiquidityFarming.sol → deposit(), withdraw(), claim(), pendingBez(), userInfo()
 *   - StakingPool.sol      → stake(), withdraw(), getReward(), getStakerInfo()
 */

let _ethers: typeof import('ethers') | null = null;
async function getEthers() {
    if (_ethers) return _ethers;
    _ethers = await import('ethers');
    return _ethers;
}

const ADDRESSES = {
    LIQUIDITY_FARMING: process.env.NEXT_PUBLIC_LIQUIDITY_FARMING || '',
    STAKING_POOL:      process.env.NEXT_PUBLIC_STAKING_POOL || '',
    BEZ_TOKEN:         process.env.NEXT_PUBLIC_BEZ_TOKEN || '',
};

// ─── Types ─────────────────────────────────────────────────────────────

export interface FarmingPoolInfo {
    pid: number;
    lpToken: string;
    allocPoint: number;
    lastRewardBlock: number;
    isLP: boolean;
    accBezPerShare: string;
    tvl: string; // LP balance of the contract
}

export interface FarmingUserInfo {
    amount: string;
    rewardDebt: string;
    lockEndTimestamp: number;
    multiplier: number;
    pendingReward: string;
}

export interface StakerInfo {
    stakedAmount: string;
    baseEarned: string;
    boostedEarned: string;
    boostBps: number;
    validatorTier: number;
    isValidator: boolean;
}

export interface FarmingGlobalStats {
    poolCount: number;
    bezPerBlock: string;
    totalAllocPoint: number;
    startBlock: number;
}

export interface StakingGlobalStats {
    totalStaked: string;
    rewardRate: string;
    rewardPerToken: string;
}

// ═══════════════════════════════════════════════════════════════════════════
//  HOOK: Farming Global Stats
// ═══════════════════════════════════════════════════════════════════════════

export function useFarmingStats() {
    const [stats, setStats] = useState<FarmingGlobalStats | null>(null);
    const [pools, setPools] = useState<FarmingPoolInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const mountRef = useRef(true);

    const fetch = useCallback(async () => {
        if (!ADDRESSES.LIQUIDITY_FARMING || typeof window === 'undefined') return;
        setLoading(true);
        setError(null);

        try {
            const ethers = await getEthers();
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const abi = (await import('./abi/LiquidityFarming.json')).default;
            const farming = new ethers.Contract(ADDRESSES.LIQUIDITY_FARMING, abi, provider);

            const [poolLength, bezPerBlock, totalAlloc, startBlock] = await Promise.all([
                farming.poolLength(),
                farming.bezPerBlock(),
                farming.totalAllocPoint(),
                farming.startBlock(),
            ]);

            const count = Number(poolLength);
            const poolsData: FarmingPoolInfo[] = [];

            for (let i = 0; i < count; i++) {
                const pool = await farming.poolInfo(i);
                const lpAddr = pool[0] || pool.lpToken;
                // Read TVL (LP balance in the contract)
                const ERC20ABI = ['function balanceOf(address) view returns (uint256)'];
                const lpToken = new ethers.Contract(lpAddr, ERC20ABI, provider);
                const tvl = await lpToken.balanceOf(ADDRESSES.LIQUIDITY_FARMING);

                poolsData.push({
                    pid: i,
                    lpToken: lpAddr,
                    allocPoint: Number(pool[1] || pool.allocPoint),
                    lastRewardBlock: Number(pool[2] || pool.lastRewardBlock),
                    isLP: Number(pool[3] || pool.isLP) === 1,
                    accBezPerShare: (pool[4] || pool.accBezPerShare).toString(),
                    tvl: ethers.formatEther(tvl),
                });
            }

            if (mountRef.current) {
                setStats({
                    poolCount: count,
                    bezPerBlock: ethers.formatEther(bezPerBlock),
                    totalAllocPoint: Number(totalAlloc),
                    startBlock: Number(startBlock),
                });
                setPools(poolsData);
            }
        } catch (err: any) {
            if (mountRef.current) setError(err?.reason || err?.message || 'Error leyendo LiquidityFarming');
        } finally {
            if (mountRef.current) setLoading(false);
        }
    }, []);

    useEffect(() => {
        mountRef.current = true;
        fetch();
        const interval = setInterval(fetch, 30_000);
        return () => { mountRef.current = false; clearInterval(interval); };
    }, [fetch]);

    return { stats, pools, loading, error, refetch: fetch };
}

// ═══════════════════════════════════════════════════════════════════════════
//  HOOK: Farming User Info (per pool)
// ═══════════════════════════════════════════════════════════════════════════

export function useFarmingUser(pid: number, userAddress: string | null) {
    const [info, setInfo] = useState<FarmingUserInfo | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!userAddress || !ADDRESSES.LIQUIDITY_FARMING || typeof window === 'undefined') return;
        let cancelled = false;

        const fetch = async () => {
            setLoading(true);
            try {
                const ethers = await getEthers();
                const provider = new ethers.BrowserProvider((window as any).ethereum);
                const abi = (await import('./abi/LiquidityFarming.json')).default;
                const farming = new ethers.Contract(ADDRESSES.LIQUIDITY_FARMING, abi, provider);

                const [user, pending] = await Promise.all([
                    farming.userInfo(pid, userAddress),
                    farming.pendingBez(pid, userAddress),
                ]);

                if (!cancelled) {
                    setInfo({
                        amount: ethers.formatEther(user[0] || user.amount),
                        rewardDebt: ethers.formatEther(user[1] || user.rewardDebt),
                        lockEndTimestamp: Number(user[2] || user.lockEndTimestamp),
                        multiplier: Number(user[3] || user.multiplier),
                        pendingReward: ethers.formatEther(pending),
                    });
                }
            } catch { /* silent */ }
            finally { if (!cancelled) setLoading(false); }
        };

        fetch();
        const interval = setInterval(fetch, 15_000);
        return () => { cancelled = true; clearInterval(interval); };
    }, [pid, userAddress]);

    return { info, loading };
}

// ═══════════════════════════════════════════════════════════════════════════
//  HOOK: Farming Deposit (on-chain write)
// ═══════════════════════════════════════════════════════════════════════════

export function useFarmingDeposit(signer: unknown) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);

    const deposit = useCallback(async (
        pid: number,
        amount: string,
        lockDays: number,
        lpTokenAddress: string,
    ): Promise<string | null> => {
        if (!signer || !ADDRESSES.LIQUIDITY_FARMING) {
            setError('Wallet no conectada'); return null;
        }
        setLoading(true); setError(null); setTxHash(null);

        try {
            const ethers = await getEthers();
            const abi = (await import('./abi/LiquidityFarming.json')).default;
            const farming = new ethers.Contract(ADDRESSES.LIQUIDITY_FARMING, abi, signer as any);
            const amountWei = ethers.parseEther(amount);

            // Approve LP token
            const ERC20ABI = ['function approve(address spender, uint256 amount) returns (bool)'];
            const token = new ethers.Contract(lpTokenAddress, ERC20ABI, signer as any);
            await (await token.approve(ADDRESSES.LIQUIDITY_FARMING, amountWei)).wait();

            // Deposit
            const tx = await farming.deposit(pid, amountWei, lockDays);
            setTxHash(tx.hash);
            await tx.wait();
            return tx.hash;
        } catch (err: any) {
            setError(err?.reason || err?.info?.error?.message || err?.message || 'Error en depósito');
            return null;
        } finally { setLoading(false); }
    }, [signer]);

    return { deposit, loading, error, txHash };
}

// ═══════════════════════════════════════════════════════════════════════════
//  HOOK: Farming Claim
// ═══════════════════════════════════════════════════════════════════════════

export function useFarmingClaim(signer: unknown) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);

    const claim = useCallback(async (pid: number): Promise<string | null> => {
        if (!signer || !ADDRESSES.LIQUIDITY_FARMING) {
            setError('Wallet no conectada'); return null;
        }
        setLoading(true); setError(null);

        try {
            const ethers = await getEthers();
            const abi = (await import('./abi/LiquidityFarming.json')).default;
            const farming = new ethers.Contract(ADDRESSES.LIQUIDITY_FARMING, abi, signer as any);
            const tx = await farming.claim(pid);
            setTxHash(tx.hash);
            await tx.wait();
            return tx.hash;
        } catch (err: any) {
            setError(err?.reason || err?.message || 'Error en claim');
            return null;
        } finally { setLoading(false); }
    }, [signer]);

    return { claim, loading, error, txHash };
}

// ═══════════════════════════════════════════════════════════════════════════
//  HOOK: Farming Withdraw
// ═══════════════════════════════════════════════════════════════════════════

export function useFarmingWithdraw(signer: unknown) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);

    const withdraw = useCallback(async (pid: number, amount: string): Promise<string | null> => {
        if (!signer || !ADDRESSES.LIQUIDITY_FARMING) {
            setError('Wallet no conectada'); return null;
        }
        setLoading(true); setError(null);

        try {
            const ethers = await getEthers();
            const abi = (await import('./abi/LiquidityFarming.json')).default;
            const farming = new ethers.Contract(ADDRESSES.LIQUIDITY_FARMING, abi, signer as any);
            const tx = await farming.withdraw(pid, ethers.parseEther(amount));
            setTxHash(tx.hash);
            await tx.wait();
            return tx.hash;
        } catch (err: any) {
            setError(err?.reason || err?.message || 'Error en withdraw');
            return null;
        } finally { setLoading(false); }
    }, [signer]);

    const emergencyWithdraw = useCallback(async (pid: number): Promise<string | null> => {
        if (!signer || !ADDRESSES.LIQUIDITY_FARMING) return null;
        setLoading(true); setError(null);

        try {
            const ethers = await getEthers();
            const abi = (await import('./abi/LiquidityFarming.json')).default;
            const farming = new ethers.Contract(ADDRESSES.LIQUIDITY_FARMING, abi, signer as any);
            const tx = await farming.emergencyWithdraw(pid);
            setTxHash(tx.hash);
            await tx.wait();
            return tx.hash;
        } catch (err: any) {
            setError(err?.reason || err?.message || 'Error en emergency withdraw');
            return null;
        } finally { setLoading(false); }
    }, [signer]);

    return { withdraw, emergencyWithdraw, loading, error, txHash };
}

// ═══════════════════════════════════════════════════════════════════════════
//  HOOK: Staking Pool Global Stats
// ═══════════════════════════════════════════════════════════════════════════

export function useStakingPoolStats() {
    const [stats, setStats] = useState<StakingGlobalStats | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!ADDRESSES.STAKING_POOL || typeof window === 'undefined') return;
        let cancelled = false;

        const fetch = async () => {
            setLoading(true);
            try {
                const ethers = await getEthers();
                const provider = new ethers.BrowserProvider((window as any).ethereum);
                const abi = (await import('./abi/StakingPool.json')).default;
                const pool = new ethers.Contract(ADDRESSES.STAKING_POOL, abi, provider);

                const [totalSupply, rewardRate, rewardPerToken] = await Promise.all([
                    pool.totalSupply(),
                    pool.rewardRate(),
                    pool.rewardPerToken(),
                ]);

                if (!cancelled) {
                    setStats({
                        totalStaked: ethers.formatEther(totalSupply),
                        rewardRate: ethers.formatEther(rewardRate),
                        rewardPerToken: ethers.formatEther(rewardPerToken),
                    });
                }
            } catch { /* silent */ }
            finally { if (!cancelled) setLoading(false); }
        };

        fetch();
        const interval = setInterval(fetch, 20_000);
        return () => { cancelled = true; clearInterval(interval); };
    }, []);

    return { stats, loading };
}

// ═══════════════════════════════════════════════════════════════════════════
//  HOOK: Staking Pool User Info
// ═══════════════════════════════════════════════════════════════════════════

export function useStakerInfo(userAddress: string | null) {
    const [info, setInfo] = useState<StakerInfo | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!userAddress || !ADDRESSES.STAKING_POOL || typeof window === 'undefined') return;
        let cancelled = false;

        const fetch = async () => {
            setLoading(true);
            try {
                const ethers = await getEthers();
                const provider = new ethers.BrowserProvider((window as any).ethereum);
                const abi = (await import('./abi/StakingPool.json')).default;
                const pool = new ethers.Contract(ADDRESSES.STAKING_POOL, abi, provider);

                const result = await pool.getStakerInfo(userAddress);

                if (!cancelled) {
                    setInfo({
                        stakedAmount: ethers.formatEther(result[0]),
                        baseEarned: ethers.formatEther(result[1]),
                        boostedEarned: ethers.formatEther(result[2]),
                        boostBps: Number(result[3]),
                        validatorTier: Number(result[4]),
                        isValidator: result[5],
                    });
                }
            } catch { /* silent */ }
            finally { if (!cancelled) setLoading(false); }
        };

        fetch();
        const interval = setInterval(fetch, 10_000);
        return () => { cancelled = true; clearInterval(interval); };
    }, [userAddress]);

    return { info, loading };
}

// ═══════════════════════════════════════════════════════════════════════════
//  HOOK: Staking Pool Write Ops
// ═══════════════════════════════════════════════════════════════════════════

export function useStakingActions(signer: unknown) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);

    const stake = useCallback(async (amount: string): Promise<string | null> => {
        if (!signer || !ADDRESSES.STAKING_POOL || !ADDRESSES.BEZ_TOKEN) {
            setError('Wallet no conectada'); return null;
        }
        setLoading(true); setError(null); setTxHash(null);

        try {
            const ethers = await getEthers();
            const abi = (await import('./abi/StakingPool.json')).default;
            const pool = new ethers.Contract(ADDRESSES.STAKING_POOL, abi, signer as any);
            const amountWei = ethers.parseEther(amount);

            // Approve BEZ
            const ERC20ABI = ['function approve(address spender, uint256 amount) returns (bool)'];
            const token = new ethers.Contract(ADDRESSES.BEZ_TOKEN, ERC20ABI, signer as any);
            await (await token.approve(ADDRESSES.STAKING_POOL, amountWei)).wait();

            const tx = await pool.stake(amountWei);
            setTxHash(tx.hash);
            await tx.wait();
            return tx.hash;
        } catch (err: any) {
            setError(err?.reason || err?.message || 'Error en stake');
            return null;
        } finally { setLoading(false); }
    }, [signer]);

    const withdraw = useCallback(async (amount: string): Promise<string | null> => {
        if (!signer || !ADDRESSES.STAKING_POOL) {
            setError('Wallet no conectada'); return null;
        }
        setLoading(true); setError(null);

        try {
            const ethers = await getEthers();
            const abi = (await import('./abi/StakingPool.json')).default;
            const pool = new ethers.Contract(ADDRESSES.STAKING_POOL, abi, signer as any);
            const tx = await pool.withdraw(ethers.parseEther(amount));
            setTxHash(tx.hash);
            await tx.wait();
            return tx.hash;
        } catch (err: any) {
            setError(err?.reason || err?.message || 'Error en withdraw');
            return null;
        } finally { setLoading(false); }
    }, [signer]);

    const getReward = useCallback(async (): Promise<string | null> => {
        if (!signer || !ADDRESSES.STAKING_POOL) {
            setError('Wallet no conectada'); return null;
        }
        setLoading(true); setError(null);

        try {
            const ethers = await getEthers();
            const abi = (await import('./abi/StakingPool.json')).default;
            const pool = new ethers.Contract(ADDRESSES.STAKING_POOL, abi, signer as any);
            const tx = await pool.getReward();
            setTxHash(tx.hash);
            await tx.wait();
            return tx.hash;
        } catch (err: any) {
            setError(err?.reason || err?.message || 'Error en claim reward');
            return null;
        } finally { setLoading(false); }
    }, [signer]);

    const exit = useCallback(async (): Promise<string | null> => {
        if (!signer || !ADDRESSES.STAKING_POOL) {
            setError('Wallet no conectada'); return null;
        }
        setLoading(true); setError(null);

        try {
            const ethers = await getEthers();
            const abi = (await import('./abi/StakingPool.json')).default;
            const pool = new ethers.Contract(ADDRESSES.STAKING_POOL, abi, signer as any);
            const tx = await pool.exit();
            setTxHash(tx.hash);
            await tx.wait();
            return tx.hash;
        } catch (err: any) {
            setError(err?.reason || err?.message || 'Error en exit');
            return null;
        } finally { setLoading(false); }
    }, [signer]);

    return { stake, withdraw, getReward, exit, loading, error, txHash };
}
