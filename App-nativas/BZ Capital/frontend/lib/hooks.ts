import useSWR, { mutate } from 'swr';
import { apiFetch } from './api';
import { useState, useCallback, useRef, useEffect } from 'react';

// ── SWR fetcher (uses apiFetch for auth headers) ──
const fetcher = <T>(path: string) => apiFetch<T>(path);

// ── Wallet address helper ──
function storedAddress(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('bez_wallet') || null;
}

// ══════════════════════════════════
//  TRANSACTION RECEIPT TRACKING
// ══════════════════════════════════

export type TxStatus = 'idle' | 'submitting' | 'pending' | 'confirmed' | 'failed' | 'reverted';

export interface TxState {
    status: TxStatus;
    txHash: string | null;
    error: string | null;
    blockNumber: number | null;
}

const INITIAL_TX: TxState = { status: 'idle', txHash: null, error: null, blockNumber: null };

/**
 * Hook that wraps any write operation with receipt polling.
 * Usage: const { execute, state, reset } = useWriteWithReceipt();
 *        await execute(() => stake(addr, amt), '/staking/positions/');
 */
export function useWriteWithReceipt() {
    const [state, setState] = useState<TxState>(INITIAL_TX);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const abortRef = useRef(false);

    const cleanup = useCallback(() => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    }, []);

    // Cleanup on unmount
    useEffect(() => cleanup, [cleanup]);

    const reset = useCallback(() => {
        cleanup();
        abortRef.current = false;
        setState(INITIAL_TX);
    }, [cleanup]);

    const execute = useCallback(async (
        writeFn: () => Promise<{ txHash?: string; tx_hash?: string;[k: string]: unknown }>,
        invalidatePattern?: string,
    ) => {
        reset();
        setState({ status: 'submitting', txHash: null, error: null, blockNumber: null });
        try {
            const result = await writeFn();
            const hash = result.txHash || result.tx_hash || null;
            if (!hash) {
                // No tx hash returned — treat as instant confirmation (DB-only op)
                setState({ status: 'confirmed', txHash: null, error: null, blockNumber: null });
                if (invalidatePattern) {
                    mutate((key: string) => typeof key === 'string' && key.includes(invalidatePattern), undefined, { revalidate: true });
                }
                return result;
            }

            setState({ status: 'pending', txHash: hash, error: null, blockNumber: null });

            // Poll for receipt
            await new Promise<void>((resolve, reject) => {
                let attempts = 0;
                const MAX_ATTEMPTS = 60; // 5 min at 5s intervals
                pollRef.current = setInterval(async () => {
                    if (abortRef.current) { cleanup(); resolve(); return; }
                    attempts++;
                    try {
                        const txData = await apiFetch<{ status: string; block_number?: number }>(
                            `/api/transactions/${hash}`
                        );
                        if (txData.status === 'confirmed') {
                            setState({ status: 'confirmed', txHash: hash, error: null, blockNumber: txData.block_number || null });
                            cleanup();
                            if (invalidatePattern) {
                                mutate((key: string) => typeof key === 'string' && key.includes(invalidatePattern), undefined, { revalidate: true });
                            }
                            resolve();
                        } else if (txData.status === 'failed' || txData.status === 'reverted') {
                            setState({ status: txData.status as TxStatus, txHash: hash, error: 'Transaction reverted on-chain', blockNumber: txData.block_number || null });
                            cleanup();
                            reject(new Error('Transaction reverted'));
                        }
                    } catch {
                        // tx not indexed yet — keep polling
                    }
                    if (attempts >= MAX_ATTEMPTS) {
                        setState(prev => ({ ...prev, status: 'failed', error: 'Receipt polling timed out' }));
                        cleanup();
                        reject(new Error('Receipt polling timed out'));
                    }
                }, 5000);
            });

            return result;
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Write operation failed';
            if (state.status === 'submitting') {
                setState(prev => ({ ...prev, status: 'failed', error: msg }));
            }
            throw err;
        }
    }, [reset, cleanup, state.status]);

    return { state, execute, reset };
}

// ══════════════════════════════════
//  AUTH / SSO
// ══════════════════════════════════

export function useAuth() {
    const { data, error, isLoading } = useSWR<{ user: { walletAddress: string; appOrigin: string } }>(
        '/api/auth/me', fetcher, { revalidateOnFocus: false }
    );
    return { user: data?.user ?? null, error, isLoading };
}

export async function login(walletAddress: string, signature: string, message: string) {
    const data = await apiFetch<{ accessToken: string; refreshToken: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ walletAddress, signature, message, appOrigin: 'bezhas-defi' }),
    });
    if (typeof window !== 'undefined') {
        localStorage.setItem('bez_token', data.accessToken);
        localStorage.setItem('bez_refresh', data.refreshToken);
        localStorage.setItem('bez_wallet', walletAddress);
    }
    mutate('/api/auth/me');
    return data;
}

export async function logout() {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => { });
    if (typeof window !== 'undefined') {
        localStorage.removeItem('bez_token');
        localStorage.removeItem('bez_refresh');
        localStorage.removeItem('bez_wallet');
    }
    mutate('/api/auth/me');
}

// ══════════════════════════════════
//  WALLET
// ══════════════════════════════════

export interface WalletBalance {
    address: string;
    balanceBEZ: string;
    balanceETH: string;
}

export interface WalletTx {
    hash: string;
    from: string;
    to: string;
    value: string;
    timestamp: string;
    type: string;
}

export function useWalletBalance(address?: string | null) {
    const addr = address || storedAddress();
    return useSWR<WalletBalance>(addr ? `/api/wallet/balance/${addr}` : null, fetcher);
}

export function useWalletHistory(address?: string | null) {
    const addr = address || storedAddress();
    return useSWR<{ transactions: WalletTx[] }>(addr ? `/api/wallet/history/${addr}` : null, fetcher);
}

// ══════════════════════════════════
//  STAKING
// ══════════════════════════════════

export interface StakePosition {
    positionId: string;
    amount: string;
    rewards: string;
    startDate: string;
    status: string;
}

export function useStakingPositions(address?: string | null) {
    const addr = address || storedAddress();
    return useSWR<{ positions: StakePosition[] }>(addr ? `/api/staking/positions/${addr}` : null, fetcher);
}

export async function stake(walletAddress: string, amount: number) {
    const data = await apiFetch('/api/staking/stake', {
        method: 'POST',
        body: JSON.stringify({ walletAddress, amount }),
    });
    mutate((key: string) => typeof key === 'string' && key.includes('/staking/positions/'), undefined, { revalidate: true });
    return data;
}

export async function unstake(positionId: string) {
    const data = await apiFetch('/api/staking/unstake', {
        method: 'POST',
        body: JSON.stringify({ positionId }),
    });
    mutate((key: string) => typeof key === 'string' && key.includes('/staking/positions/'), undefined, { revalidate: true });
    return data;
}

// ══════════════════════════════════
//  FARMING
// ══════════════════════════════════

export interface FarmPosition {
    poolId: string;
    poolName: string;
    deposited: string;
    rewards: string;
    apy: string;
}

export function useFarmingPositions(address?: string | null) {
    const addr = address || storedAddress();
    return useSWR<{ positions: FarmPosition[] }>(addr ? `/api/farming/positions/${addr}` : null, fetcher);
}

export async function farmDeposit(walletAddress: string, poolId: string, amount: number) {
    const data = await apiFetch('/api/farming/deposit', {
        method: 'POST',
        body: JSON.stringify({ walletAddress, poolId, amount }),
    });
    mutate((key: string) => typeof key === 'string' && key.includes('/farming/positions/'), undefined, { revalidate: true });
    return data;
}

// ══════════════════════════════════
//  GOVERNANCE
// ══════════════════════════════════

export interface Proposal {
    id: string;
    title: string;
    description: string;
    status: string;
    votesFor: number;
    votesAgainst: number;
    endDate: string;
    proposer: string;
}

export function useGovernanceProposals(status?: string) {
    const qs = status ? `?status=${status}` : '';
    return useSWR<{ proposals: Proposal[] }>(`/api/governance/proposals${qs}`, fetcher);
}

export async function voteOnProposal(proposalId: string, walletAddress: string, vote: 'for' | 'against') {
    const data = await apiFetch('/api/governance/vote', {
        method: 'POST',
        body: JSON.stringify({ proposalId, walletAddress, vote }),
    });
    mutate('/api/governance/proposals');
    return data;
}

// ══════════════════════════════════
//  BRIDGE
// ══════════════════════════════════

export interface BridgeTransfer {
    transferId: string;
    sender: string;
    recipient: string;
    fromChainId: number;
    toChainId: number;
    amount: string;
    status: 'initiated' | 'deposited' | 'relayed' | 'finalized' | 'failed';
    l1TxHash?: string;
    l2TxHash?: string;
    relayTxHash?: string;
    finalizeTxHash?: string;
    currentStep?: number;
    timestamp: string;
}

export function useBridgeTransfers(address?: string | null) {
    const addr = address || storedAddress();
    return useSWR<{ transfers: BridgeTransfer[] }>(addr ? `/api/bridge/transfers/${addr}` : null, fetcher);
}

export async function initiateBridge(params: {
    sender: string; recipient: string; fromChainId: number; toChainId: number; tokenAddress: string; amount: number;
}) {
    const data = await apiFetch('/api/bridge/initiate', {
        method: 'POST',
        body: JSON.stringify(params),
    });
    mutate((key: string) => typeof key === 'string' && key.includes('/bridge/transfers/'), undefined, { revalidate: true });
    return data;
}

export function useBridgeStatus(transferId?: string) {
    return useSWR(transferId ? `/api/bridge/status/${transferId}` : null, fetcher);
}

// ══════════════════════════════════
//  TREASURY
// ══════════════════════════════════

export interface TreasuryOverview {
    totalFunds: string;
    allocations: { sector: string; amount: string; percentage: number }[];
    recentSpends: { description: string; amount: string; date: string }[];
}

export function useTreasuryOverview() {
    return useSWR<TreasuryOverview>('/api/treasury/overview', fetcher);
}

// ══════════════════════════════════
//  TOKEN
// ══════════════════════════════════

export interface TokenInfo {
    name: string;
    symbol: string;
    totalSupply: string;
    circulatingSupply: string;
    decimals: number;
}

export function useTokenInfo() {
    return useSWR<TokenInfo>('/api/token/info', async (path: string) => {
        const data = await apiFetch<TokenInfo | { token: TokenInfo }>(path);
        return 'token' in data ? data.token : data;
    });
}

// ══════════════════════════════════
//  TOKEN PRICE
// ══════════════════════════════════

export interface TokenPrice {
    priceUSD: number;
    change24h: number;
}

export function useTokenPrice() {
    return useSWR<TokenPrice>('/api/token/price', fetcher, { refreshInterval: 30000 });
}

// ══════════════════════════════════
//  PAYMENTS
// ══════════════════════════════════

export interface PaymentRecord {
    id: string;
    type: 'buy' | 'sell' | 'payment';
    amount: string;
    method: string;
    recipient?: string;
    status: 'completed' | 'pending' | 'failed';
    date: string;
    txHash?: string;
}

export interface BuyBEZResult {
    success: boolean;
    paymentId: string;
    status: 'pending' | 'completed' | 'failed';
    provider?: string;
    checkoutUrl?: string;
    bankTransfer?: {
        beneficiaryAlias: string;
        iban: string;
        bic: string;
        currency: string;
        paymentRail: string;
        reference: string;
        instructions: string;
    };
    stripeUseCase?: string;
    stripeLabel?: string;
    nextAction?: 'redirect_to_checkout' | 'display_bank_transfer_instructions' | 'await_payment_confirmation';
}

export function usePaymentHistory(address?: string | null) {
    const addr = address || storedAddress();
    return useSWR<{ payments: PaymentRecord[] }>(addr ? `/api/payments/history/${addr}` : null, fetcher);
}

export async function buyBEZ(params: { walletAddress: string; amountUSD: number; paymentMethod: string; stripeUseCase?: string; email?: string }) {
    const data = await apiFetch<BuyBEZResult>('/api/payments/buy', {
        method: 'POST',
        body: JSON.stringify(params),
    });
    mutate((key: string) => typeof key === 'string' && key.includes('/payments/history/'), undefined, { revalidate: true });
    return data;
}

export async function sellBEZ(params: { walletAddress: string; amountBEZ: number; receiveMethod: string }) {
    const data = await apiFetch('/api/payments/sell', {
        method: 'POST',
        body: JSON.stringify(params),
    });
    mutate((key: string) => typeof key === 'string' && key.includes('/payments/history/'), undefined, { revalidate: true });
    return data;
}

export async function sendPayment(params: { sender: string; recipient: string; amount: number; note?: string }) {
    const data = await apiFetch('/api/payments/send', {
        method: 'POST',
        body: JSON.stringify(params),
    });
    mutate((key: string) => typeof key === 'string' && key.includes('/payments/history/'), undefined, { revalidate: true });
    return data;
}

// ══════════════════════════════════
//  CONTRACTS
// ══════════════════════════════════

export function useContractsList() {
    return useSWR<{ contracts: { name: string; address: string; network: string }[] }>('/api/contracts/list', fetcher);
}

// ══════════════════════════════════
//  BRIDGE FLOW TRACKING
// ══════════════════════════════════

export type BridgeStep = 'initiated' | 'l1_confirmed' | 'l2_deposited' | 'relayed' | 'finalized' | 'failed';

export interface BridgeFlowState {
    step: BridgeStep;
    l1TxHash: string | null;
    l2TxHash: string | null;
    relayTxHash: string | null;
    error: string | null;
}

/**
 * Track bridge transfer lifecycle: initiated → deposited → relayed → finalized.
 * Polls /api/bridge/status/:id every 10s.
 */
export function useBridgeFlow(transferId: string | null) {
    const { data, error, isLoading } = useSWR<BridgeTransfer>(
        transferId ? `/api/bridge/status/${transferId}` : null,
        fetcher,
        { refreshInterval: transferId ? 10000 : 0 }
    );

    const step: BridgeStep = data?.status === 'finalized' ? 'finalized'
        : data?.status === 'relayed' ? 'relayed'
            : data?.status === 'deposited' ? 'l2_deposited'
                : data?.status === 'initiated' ? 'initiated'
                    : data?.status === 'failed' ? 'failed'
                        : 'initiated';

    return {
        step,
        transfer: data ?? null,
        l1TxHash: data?.l1TxHash ?? null,
        l2TxHash: data?.l2TxHash ?? null,
        relayTxHash: data?.relayTxHash ?? null,
        isComplete: step === 'finalized',
        isFailed: step === 'failed',
        isLoading,
        error,
    };
}

// ══════════════════════════════════
//  BLOCKCHAIN EVENTS SSE
// ══════════════════════════════════

export interface BlockchainSSEEvent {
    channel: string;
    data: Record<string, unknown>;
    timestamp: number;
}

/**
 * Subscribe to real-time blockchain events via SSE.
 * Usage: const { events, connected } = useBlockchainSSE('validator');
 */
export function useBlockchainSSE(eventType?: string) {
    const [events, setEvents] = useState<BlockchainSSEEvent[]>([]);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        const params = eventType ? `?type=${eventType}` : '';
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const es = new EventSource(`${API_BASE}/api/blockchain/stream${params}`);

        es.addEventListener('blockchain_event', (e) => {
            try {
                const evt: BlockchainSSEEvent = JSON.parse(e.data);
                setEvents(prev => [evt, ...prev].slice(0, 100));
            } catch { /* ignore malformed */ }
        });

        es.onopen = () => setConnected(true);
        es.onerror = () => setConnected(false);

        return () => es.close();
    }, [eventType]);

    return { events, connected };
}
