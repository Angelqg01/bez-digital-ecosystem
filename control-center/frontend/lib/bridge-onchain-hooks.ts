'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * BeZhas Bridge On-Chain Hooks — Direct integration with BEZPolygonBridge.sol
 * ─────────────────────────────────────────────────────────────────────────
 * These hooks connect directly to the bridge smart contracts for real
 * on-chain operations, complementing the API-based bridge-hooks.ts.
 *
 * Contracts:
 *   - BEZPolygonBridge.sol   → depositL1(), getDepositInfo()
 *   - BeZhasBridgeL2.sol     → withdrawL2(), getWithdrawalInfo()
 *   - WrappedBEZ.sol         → approve(), balanceOf()
 */

let _ethers: typeof import('ethers') | null = null;
async function getEthers() {
    if (_ethers) return _ethers;
    _ethers = await import('ethers');
    return _ethers;
}

const ADDRESSES = {
    BEZ_POLYGON_BRIDGE: process.env.NEXT_PUBLIC_BEZ_POLYGON_BRIDGE || '',
    WRAPPED_BEZ:        process.env.NEXT_PUBLIC_WRAPPED_BEZ || '',
    BEZ_TOKEN:          process.env.NEXT_PUBLIC_BEZ_TOKEN || '',
    L2_SEQUENCER:       process.env.NEXT_PUBLIC_L2_SEQUENCER || '',
};

// ─── Types ─────────────────────────────────────────────────────────────

export interface BridgeContractStats {
    totalDeposited: string;
    totalWithdrawn: string;
    isPaused: boolean;
    wrappedBEZSupply: string;
}

export interface DepositResult {
    txHash: string;
    depositId: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
//  HOOK: Read Bridge Contract Stats
// ═══════════════════════════════════════════════════════════════════════════

export function useBridgeContractStats() {
    const [stats, setStats] = useState<BridgeContractStats | null>(null);
    const [loading, setLoading] = useState(false);
    const mountRef = useRef(true);

    const fetch = useCallback(async () => {
        if (!ADDRESSES.BEZ_POLYGON_BRIDGE || typeof window === 'undefined') return;
        setLoading(true);

        try {
            const ethers = await getEthers();
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const bridgeAbi = (await import('./abi/BEZPolygonBridge.json')).default;
            const bridge = new ethers.Contract(ADDRESSES.BEZ_POLYGON_BRIDGE, bridgeAbi, provider);

            const [totalDeposited, isPaused] = await Promise.all([
                bridge.totalDeposited().catch(() => 0n),
                bridge.paused().catch(() => false),
            ]);

            let wrappedSupply = '0';
            if (ADDRESSES.WRAPPED_BEZ) {
                const wrapAbi = (await import('./abi/WrappedBEZ.json')).default;
                const wrapped = new ethers.Contract(ADDRESSES.WRAPPED_BEZ, wrapAbi, provider);
                const supply = await wrapped.totalSupply().catch(() => 0n);
                wrappedSupply = ethers.formatEther(supply);
            }

            if (mountRef.current) {
                setStats({
                    totalDeposited: ethers.formatEther(totalDeposited),
                    totalWithdrawn: '0', // Calculated off-chain
                    isPaused,
                    wrappedBEZSupply: wrappedSupply,
                });
            }
        } catch { /* silent */ }
        finally { if (mountRef.current) setLoading(false); }
    }, []);

    useEffect(() => {
        mountRef.current = true;
        fetch();
        const interval = setInterval(fetch, 30_000);
        return () => { mountRef.current = false; clearInterval(interval); };
    }, [fetch]);

    return { stats, loading, refetch: fetch };
}

// ═══════════════════════════════════════════════════════════════════════════
//  HOOK: Deposit to L2 Bridge (on-chain write)
// ═══════════════════════════════════════════════════════════════════════════

export function useBridgeDeposit(signer: unknown) {
    const [depositing, setDepositing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<DepositResult | null>(null);

    const deposit = useCallback(async (
        amount: string,
        recipient?: string,
    ): Promise<DepositResult | null> => {
        if (!signer || !ADDRESSES.BEZ_POLYGON_BRIDGE || !ADDRESSES.BEZ_TOKEN) {
            setError('Wallet no conectada o contratos no configurados');
            return null;
        }

        setDepositing(true);
        setError(null);
        setResult(null);

        try {
            const ethers = await getEthers();
            const bridgeAbi = (await import('./abi/BEZPolygonBridge.json')).default;
            const bridge = new ethers.Contract(ADDRESSES.BEZ_POLYGON_BRIDGE, bridgeAbi, signer as any);
            const amountWei = ethers.parseEther(amount);

            // Check sequencer status before bridging
            if (ADDRESSES.L2_SEQUENCER) {
                const seqAbi = (await import('./abi/L2Sequencer.json')).default;
                const provider = new ethers.BrowserProvider((window as any).ethereum);
                const sequencer = new ethers.Contract(ADDRESSES.L2_SEQUENCER, seqAbi, provider);
                const isPaused = await sequencer.isPausedByAI();
                if (isPaused) {
                    setError('⚠️ El Sequencer L2 está pausado por IA. Bridge temporalmente no disponible.');
                    setDepositing(false);
                    return null;
                }
            }

            // 1. Approve BEZ tokens
            const ERC20ABI = ['function approve(address spender, uint256 amount) returns (bool)'];
            const bezToken = new ethers.Contract(ADDRESSES.BEZ_TOKEN, ERC20ABI, signer as any);
            const approveTx = await bezToken.approve(ADDRESSES.BEZ_POLYGON_BRIDGE, amountWei);
            await approveTx.wait();

            // 2. Deposit via bridge
            const signerAddr = await (signer as any).getAddress();
            const depositRecipient = recipient || signerAddr;
            const tx = await bridge.deposit(amountWei, depositRecipient);
            const receipt = await tx.wait();

            // 3. Parse deposit event for depositId
            const iface = new ethers.Interface(bridgeAbi);
            let depositId: string | null = null;
            for (const log of receipt.logs) {
                try {
                    const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
                    if (parsed?.name === 'Deposited' || parsed?.name === 'DepositInitiated') {
                        depositId = parsed.args[0]?.toString() || null;
                        break;
                    }
                } catch { /* skip */ }
            }

            const r = { txHash: tx.hash, depositId };
            setResult(r);
            return r;
        } catch (err: any) {
            setError(err?.reason || err?.info?.error?.message || err?.message || 'Error en depósito bridge');
            return null;
        } finally {
            setDepositing(false);
        }
    }, [signer]);

    return { deposit, depositing, error, result };
}

// ═══════════════════════════════════════════════════════════════════════════
//  HOOK: WrappedBEZ Balance (L2 side)
// ═══════════════════════════════════════════════════════════════════════════

export function useWrappedBEZBalance(address: string | null) {
    const [balance, setBalance] = useState<string>('0');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!address || !ADDRESSES.WRAPPED_BEZ || typeof window === 'undefined') return;
        let cancelled = false;

        const fetch = async () => {
            setLoading(true);
            try {
                const ethers = await getEthers();
                const provider = new ethers.BrowserProvider((window as any).ethereum);
                const ERC20ABI = ['function balanceOf(address) view returns (uint256)'];
                const token = new ethers.Contract(ADDRESSES.WRAPPED_BEZ, ERC20ABI, provider);
                const bal = await token.balanceOf(address);
                if (!cancelled) setBalance(ethers.formatEther(bal));
            } catch { /* silent */ }
            finally { if (!cancelled) setLoading(false); }
        };

        fetch();
        const interval = setInterval(fetch, 15_000);
        return () => { cancelled = true; clearInterval(interval); };
    }, [address]);

    return { balance, loading };
}
