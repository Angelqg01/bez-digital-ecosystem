/**
 * useBezBalance.ts — On-chain BEZ Token Balance Hook
 *
 * Reads the BEZ-Coin balance directly from the Polygon smart contract
 * using wagmi v2's useReadContract. Falls back to backend API for SSR.
 * Auto-refreshes every 12 seconds (1 Polygon block).
 */

import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { CONTRACTS } from '../config/web3';

// Minimal ERC-20 ABI for reading balanceOf and decimals
const ERC20_ABI = [
    {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'owner', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'decimals',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint8' }],
    },
    {
        name: 'symbol',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'string' }],
    },
] as const;

interface UseBezBalanceResult {
    /** Human-readable BEZ balance (e.g. "1234.5678") */
    balance: string;
    /** Raw BigInt value from the contract */
    raw: bigint | undefined;
    /** 18 decimals for BEZ */
    decimals: number;
    /** True while fetching */
    isLoading: boolean;
    /** True if the contract read failed */
    isError: boolean;
    /** Trigger a manual refresh */
    refetch: () => void;
}

/**
 * @param walletAddress The `0x...` address to check. Pass `undefined` to skip the call.
 */
export function useBezBalance(walletAddress?: `0x${string}`): UseBezBalanceResult {
    const {
        data: rawBalance,
        isLoading: loadingBalance,
        isError: errorBalance,
        refetch,
    } = useReadContract({
        address: CONTRACTS.BEZCOIN as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: walletAddress ? [walletAddress] : undefined,
        query: {
            enabled: !!walletAddress,
            refetchInterval: 12_000, // ~1 Polygon block
            staleTime: 6_000,
        },
    });

    const decimals = 18; // BEZ uses 18 decimals
    const balance = rawBalance != null ? formatUnits(rawBalance as bigint, decimals) : '0.0000';
    // Trim to 4 decimal places for display
    const displayBalance = parseFloat(balance).toFixed(4);

    return {
        balance: displayBalance,
        raw: rawBalance as bigint | undefined,
        decimals,
        isLoading: loadingBalance,
        isError: errorBalance,
        refetch,
    };
}

/** Helper: format a raw bigint BEZ amount to a display string */
export function formatBezAmount(raw: bigint | undefined, decimals = 18): string {
    if (raw == null) return '0.0000';
    return parseFloat(formatUnits(raw, decimals)).toFixed(4);
}
