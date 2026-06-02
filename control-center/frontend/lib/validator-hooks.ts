'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * BeZhas Validator Hooks — On-chain integration with ValidatorRegistry.sol
 * ─────────────────────────────────────────────────────────────────────────
 * Reads validator data directly from the blockchain rather than via API.
 * Used alongside the existing API hooks for enriched data.
 *
 * Contratos:
 *   - ValidatorRegistry.sol  → getValidatorInfo(), totalStaked, activeValidatorCount
 *   - StakingPool.sol        → getStake(), pendingRewards()
 *   - L2Sequencer.sol        → getStatus(), isPausedByAI
 */

// ─── Lazy ethers import (SSR safe) ─────────────────────────────────────
let _ethers: typeof import('ethers') | null = null;
async function getEthers() {
    if (_ethers) return _ethers;
    _ethers = await import('ethers');
    return _ethers;
}

const ADDRESSES = {
    VALIDATOR_REGISTRY: process.env.NEXT_PUBLIC_VALIDATOR_REGISTRY || '',
    STAKING_POOL:       process.env.NEXT_PUBLIC_STAKING_POOL || '',
    L2_SEQUENCER:       process.env.NEXT_PUBLIC_L2_SEQUENCER || '',
    BEZ_TOKEN:          process.env.NEXT_PUBLIC_BEZ_TOKEN || '',
};

// ─── Types ─────────────────────────────────────────────────────────────

export interface OnChainValidatorInfo {
    operator: string;
    companyName: string;
    stakedAmount: string;
    contributionPoints: number;
    tier: number;
    isActive: boolean;
    isSequencerEligible: boolean;
    uptimePercent: number;
}

export interface SequencerStatus {
    isPaused: boolean;
    pauseReason: string;
    pausedSince: number;
    pauseCount: number;
    cumulativePauseDuration: number;
    pauseTimeRemaining: number;
}

export interface ValidatorRegistryStats {
    totalStaked: string;
    activeValidatorCount: number;
    totalValidators: number;
    sequencerCandidates: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
//  HOOK: Read ValidatorRegistry on-chain stats
// ═══════════════════════════════════════════════════════════════════════════

export function useValidatorRegistryOnChain() {
    const [stats, setStats] = useState<ValidatorRegistryStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const mountRef = useRef(true);

    const fetch = useCallback(async () => {
        if (!ADDRESSES.VALIDATOR_REGISTRY || typeof window === 'undefined') return;
        setLoading(true);
        setError(null);

        try {
            const ethers = await getEthers();
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const abi = (await import('./abi/ValidatorRegistry.json')).default;
            const registry = new ethers.Contract(ADDRESSES.VALIDATOR_REGISTRY, abi, provider);

            const [totalStaked, activeCount, totalCount, candidates] = await Promise.all([
                registry.totalStaked(),
                registry.activeValidatorCount(),
                registry.getValidatorCount(),
                registry.getActiveSequencerCandidates(),
            ]);

            if (mountRef.current) {
                setStats({
                    totalStaked: ethers.formatEther(totalStaked),
                    activeValidatorCount: Number(activeCount),
                    totalValidators: Number(totalCount),
                    sequencerCandidates: candidates,
                });
            }
        } catch (err: any) {
            if (mountRef.current) setError(err?.reason || err?.message || 'Error leyendo ValidatorRegistry');
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

    return { stats, loading, error, refetch: fetch };
}

// ═══════════════════════════════════════════════════════════════════════════
//  HOOK: Read single validator info on-chain
// ═══════════════════════════════════════════════════════════════════════════

export function useValidatorOnChain(operatorAddress: string | null) {
    const [info, setInfo] = useState<OnChainValidatorInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        if (!operatorAddress || !ADDRESSES.VALIDATOR_REGISTRY || typeof window === 'undefined') return;
        setLoading(true);
        setError(null);

        try {
            const ethers = await getEthers();
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const abi = (await import('./abi/ValidatorRegistry.json')).default;
            const registry = new ethers.Contract(ADDRESSES.VALIDATOR_REGISTRY, abi, provider);

            const result = await registry.getValidatorInfo(operatorAddress);

            setInfo({
                operator: operatorAddress,
                companyName: result[0],
                stakedAmount: ethers.formatEther(result[1]),
                contributionPoints: Number(result[2]),
                tier: Number(result[3]),
                isActive: result[4],
                isSequencerEligible: result[5],
                uptimePercent: Number(result[6]) / 100, // bps → %
            });
        } catch (err: any) {
            setError(err?.reason || err?.message || 'Error leyendo validador');
        } finally {
            setLoading(false);
        }
    }, [operatorAddress]);

    useEffect(() => { fetch(); }, [fetch]);

    return { info, loading, error, refetch: fetch };
}

// ═══════════════════════════════════════════════════════════════════════════
//  HOOK: Register as Validator (write tx)
// ═══════════════════════════════════════════════════════════════════════════

export function useRegisterValidator(signer: unknown) {
    const [registering, setRegistering] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);

    const register = useCallback(async (
        companyName: string,
        stakeAmount: string,
    ): Promise<string | null> => {
        if (!signer || !ADDRESSES.VALIDATOR_REGISTRY || !ADDRESSES.BEZ_TOKEN) {
            setError('Wallet no conectada o contratos no configurados');
            return null;
        }

        setRegistering(true);
        setError(null);
        setTxHash(null);

        try {
            const ethers = await getEthers();
            const registryAbi = (await import('./abi/ValidatorRegistry.json')).default;

            const registry = new ethers.Contract(
                ADDRESSES.VALIDATOR_REGISTRY,
                registryAbi,
                signer as any,
            );

            const amountWei = ethers.parseEther(stakeAmount);

            // 1. Approve BEZ tokens
            const ERC20ABI = ['function approve(address spender, uint256 amount) returns (bool)'];
            const bezToken = new ethers.Contract(ADDRESSES.BEZ_TOKEN, ERC20ABI, signer as any);
            const approveTx = await bezToken.approve(ADDRESSES.VALIDATOR_REGISTRY, amountWei);
            await approveTx.wait();

            // 2. Register
            const tx = await registry.registerValidator(companyName, amountWei);
            setTxHash(tx.hash);
            await tx.wait();

            return tx.hash;
        } catch (err: any) {
            setError(err?.reason || err?.info?.error?.message || err?.message || 'Error registrando validador');
            return null;
        } finally {
            setRegistering(false);
        }
    }, [signer]);

    return { register, registering, error, txHash };
}

// ═══════════════════════════════════════════════════════════════════════════
//  HOOK: Add Stake to validator
// ═══════════════════════════════════════════════════════════════════════════

export function useAddStake(signer: unknown) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);

    const addStake = useCallback(async (amount: string): Promise<string | null> => {
        if (!signer || !ADDRESSES.VALIDATOR_REGISTRY || !ADDRESSES.BEZ_TOKEN) {
            setError('Wallet no conectada');
            return null;
        }

        setLoading(true);
        setError(null);

        try {
            const ethers = await getEthers();
            const registryAbi = (await import('./abi/ValidatorRegistry.json')).default;
            const registry = new ethers.Contract(ADDRESSES.VALIDATOR_REGISTRY, registryAbi, signer as any);
            const amountWei = ethers.parseEther(amount);

            // Approve
            const ERC20ABI = ['function approve(address spender, uint256 amount) returns (bool)'];
            const bezToken = new ethers.Contract(ADDRESSES.BEZ_TOKEN, ERC20ABI, signer as any);
            await (await bezToken.approve(ADDRESSES.VALIDATOR_REGISTRY, amountWei)).wait();

            // Add stake
            const tx = await registry.addStake(amountWei);
            setTxHash(tx.hash);
            await tx.wait();
            return tx.hash;
        } catch (err: any) {
            setError(err?.reason || err?.message || 'Error añadiendo stake');
            return null;
        } finally {
            setLoading(false);
        }
    }, [signer]);

    return { addStake, loading, error, txHash };
}

// ═══════════════════════════════════════════════════════════════════════════
//  HOOK: L2 Sequencer Status (on-chain)
// ═══════════════════════════════════════════════════════════════════════════

export function useSequencerOnChain() {
    const [status, setStatus] = useState<SequencerStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        if (!ADDRESSES.L2_SEQUENCER || typeof window === 'undefined') return;
        setLoading(true);

        try {
            const ethers = await getEthers();
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const abi = (await import('./abi/L2Sequencer.json')).default;
            const sequencer = new ethers.Contract(ADDRESSES.L2_SEQUENCER, abi, provider);

            const [statusResult, timeRemaining] = await Promise.all([
                sequencer.getStatus(),
                sequencer.pauseTimeRemaining(),
            ]);

            setStatus({
                isPaused: statusResult[0],
                pauseReason: statusResult[1],
                pausedSince: Number(statusResult[2]),
                pauseCount: Number(statusResult[3]),
                cumulativePauseDuration: Number(statusResult[4]),
                pauseTimeRemaining: Number(timeRemaining),
            });
        } catch (err: any) {
            setError(err?.reason || err?.message || 'Error leyendo L2Sequencer');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetch();
        const interval = setInterval(fetch, 10_000);
        return () => clearInterval(interval);
    }, [fetch]);

    return { status, loading, error, refetch: fetch };
}

// ═══════════════════════════════════════════════════════════════════════════
//  HOOK: Send Heartbeat (validator keeps alive)
// ═══════════════════════════════════════════════════════════════════════════

export function useHeartbeat(signer: unknown) {
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);

    const sendHeartbeat = useCallback(async (): Promise<string | null> => {
        if (!signer || !ADDRESSES.VALIDATOR_REGISTRY) {
            setError('Wallet no conectada');
            return null;
        }

        setSending(true);
        setError(null);

        try {
            const ethers = await getEthers();
            const abi = (await import('./abi/ValidatorRegistry.json')).default;
            const registry = new ethers.Contract(ADDRESSES.VALIDATOR_REGISTRY, abi, signer as any);

            const tx = await registry.heartbeat();
            setTxHash(tx.hash);
            await tx.wait();
            return tx.hash;
        } catch (err: any) {
            setError(err?.reason || err?.message || 'Error enviando heartbeat');
            return null;
        } finally {
            setSending(false);
        }
    }, [signer]);

    return { sendHeartbeat, sending, error, txHash };
}
