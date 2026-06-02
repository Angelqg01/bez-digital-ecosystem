'use client';
import useSWR from 'swr';
import { useState, useCallback } from 'react';
import { fetcher, api, ApiError } from './api';
import type { BridgeTransfer } from './types';

// ── SWR Options ──
const onErrorRetry = (
    error: ApiError,
    _key: string,
    _config: unknown,
    revalidate: (opts: { retryCount: number }) => void,
    { retryCount }: { retryCount: number },
) => {
    if (error?.status === 0) return;
    if (retryCount >= 3) return;
    setTimeout(() => revalidate({ retryCount }), 5000 * (retryCount + 1));
};

const opts = { revalidateOnFocus: false, dedupingInterval: 10_000, onErrorRetry };

// ── Supported Chains ──
export interface ChainConfig {
    chainId: number;
    name: string;
    shortName: string;
    color: string;
    explorer: string;
    nativeToken: string;
    supported: boolean;
}

export const SUPPORTED_CHAINS: ChainConfig[] = [
    { chainId: 2708, name: 'BeZhas Mainnet', shortName: 'BEZ', color: 'bg-bezhas-cyan', explorer: 'https://explorer.bez.digital', nativeToken: 'BEZ', supported: true },
    { chainId: 1, name: 'Ethereum Mainnet', shortName: 'ETH', color: 'bg-indigo-500', explorer: 'https://etherscan.io', nativeToken: 'ETH', supported: true },
    { chainId: 11155111, name: 'Ethereum Sepolia', shortName: 'SEP', color: 'bg-indigo-400', explorer: 'https://sepolia.etherscan.io', nativeToken: 'ETH', supported: true },
    { chainId: 137, name: 'Polygon PoS', shortName: 'MATIC', color: 'bg-purple-500', explorer: 'https://polygonscan.com', nativeToken: 'MATIC', supported: true },
    { chainId: 42161, name: 'Arbitrum One', shortName: 'ARB', color: 'bg-blue-400', explorer: 'https://arbiscan.io', nativeToken: 'ETH', supported: true },
    { chainId: 43114, name: 'Avalanche C-Chain', shortName: 'AVAX', color: 'bg-red-500', explorer: 'https://snowtrace.io', nativeToken: 'AVAX', supported: false },
];

export function getChain(chainId: number): ChainConfig | undefined {
    return SUPPORTED_CHAINS.find(c => c.chainId === chainId);
}

// ── Supported Tokens ──
export interface BridgeToken {
    symbol: string;
    name: string;
    address: string; // 0x0…0 = native
    decimals: number;
    icon: string;
    chains: number[]; // chainIds where available
}

export const BRIDGE_TOKENS: BridgeToken[] = [
    { symbol: 'BEZ', name: 'BeZhas Coin', address: '0x0000000000000000000000000000000000000000', decimals: 18, icon: '🟠', chains: [2708, 1, 11155111, 137, 42161] },
    { symbol: 'USDC', name: 'USD Coin', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, icon: '💵', chains: [1, 137, 42161, 2708] },
    { symbol: 'WETH', name: 'Wrapped Ether', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18, icon: '💎', chains: [1, 11155111, 42161, 2708] },
];

// ── Bridge Fee Estimate ──
export interface BridgeFeeEstimate {
    bridgeFee: string;
    gasFeeOrigin: string;
    gasFeeDestination: string;
    totalFeeUSD: string;
    estimatedTimeMinutes: number;
    route: string;
}

// ── Hook: Bridge Transfer History ──
export function useBridgeTransfers(address: string | null, limit = 20) {
    return useSWR<{ transfers: BridgeTransfer[] }>(
        address ? `/gateway/v1/bridge/transfers/${address}?limit=${limit}` : null,
        fetcher,
        { ...opts, refreshInterval: 15_000 },
    );
}

// ── Hook: Single Transfer Status (polling) ──
export function useBridgeStatus(transferId: string | null) {
    return useSWR<{ transfer: BridgeTransfer }>(
        transferId ? `/gateway/v1/bridge/status/${transferId}` : null,
        fetcher,
        { ...opts, refreshInterval: 5_000 },
    );
}

// ── Hook: Fee Estimation ──
export function useBridgeFees(fromChainId: number, toChainId: number, amount: string, tokenAddress: string) {
    const shouldFetch = fromChainId > 0 && toChainId > 0 && parseFloat(amount) > 0;
    return useSWR<{ fees: BridgeFeeEstimate }>(
        shouldFetch
            ? `/gateway/v1/bridge/fees?from=${fromChainId}&to=${toChainId}&amount=${amount}&token=${tokenAddress}`
            : null,
        fetcher,
        { ...opts, refreshInterval: 30_000, dedupingInterval: 5_000 },
    );
}

// ── Hook: Bridge Stats (aggregated) ──
export interface BridgeStatsData {
    totalBridged: string;
    totalTransfers: number;
    chainBreakdown: { chainId: number; volume: string; count: number }[];
    recentFinalized: number;
}

export function useBridgeStats() {
    return useSWR<{ stats: BridgeStatsData }>(
        '/gateway/v1/bridge/stats',
        fetcher,
        { ...opts, refreshInterval: 30_000 },
    );
}

// ── Mutation: Initiate Bridge Transfer ──
export function useBridgeInitiate() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const initiate = useCallback(async (params: {
        sender: string;
        recipient: string;
        fromChainId: number;
        toChainId: number;
        tokenAddress: string;
        amount: number;
    }): Promise<{ transferId: string; transfer: BridgeTransfer } | null> => {
        setLoading(true);
        setError(null);
        try {
            const token = typeof window !== 'undefined' ? localStorage.getItem('bezhas_token') : null;
            const result = await api.post<{ success: boolean; transfer: BridgeTransfer }>(
                '/gateway/v1/bridge/initiate',
                params,
                token ? { token } : {},
            );
            return { transferId: result.transfer.id, transfer: result.transfer };
        } catch (e: unknown) {
            const msg = e instanceof ApiError ? e.message : 'Bridge operation failed';
            setError(msg);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    return { initiate, loading, error, clearError: () => setError(null) };
}

// ── Step labels for UI ──
export const BRIDGE_STEPS = [
    { step: 0, label: 'Pendiente', description: 'Transferencia registrada' },
    { step: 1, label: 'Iniciada', description: 'Transacción enviada a la red origen' },
    { step: 2, label: 'Depositada', description: 'Fondos bloqueados en contrato bridge' },
    { step: 3, label: 'Retransmitida', description: 'Mensaje relay enviado a la red destino' },
    { step: 4, label: 'Finalizada', description: 'Fondos liberados en la red destino' },
];

export function getStepLabel(step: number): string {
    return BRIDGE_STEPS.find(s => s.step === step)?.label ?? 'Desconocido';
}

export function getStatusColor(status: string): string {
    const map: Record<string, string> = {
        initiated: 'text-amber-500',
        deposited: 'text-blue-500',
        relayed: 'text-cyan-500',
        finalized: 'text-emerald-500',
        failed: 'text-red-500',
    };
    return map[status] || 'text-slate-400';
}
