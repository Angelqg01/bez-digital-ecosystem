'use client';
import useSWR from 'swr';
import { useState, useEffect } from 'react';
import { fetcher, ApiError } from './api';
import type {
    DashboardStats, ChartDataPoint, Transaction, GasBalance, GasStatus,
    NFT, DeployedContract, Sector, AILog, Notification,
    Achievement, LeaderboardEntry, PlatformConfig,
    AegisStatus, AegisSuggestion, RealtimeKpis, ForecastSeries, AnalyticsDelta,
    BlockchainOverview, BlockchainValidatorsResponse, BlockchainSequencerCurrent, BlockchainEventsResponse,
    ValidatorListResponse, ValidatorProfile, ValidatorNetworkStats, ValidatorTimelineEvent,
    SequencerStatus, SlashingHistory, GovernanceProposalsResponse, RewardsHistory,
    TreasuryStats,
    QRCode, QRStats, Document, DocumentStats,
    Channel, Message, NotificationPreference,
    AgentConfig, AgentStatus,
} from './types';

const onErrorRetry = (
    error: ApiError,
    _key: string,
    _config: unknown,
    revalidate: (opts: { retryCount: number }) => void,
    { retryCount }: { retryCount: number },
) => {
    // Network error (backend down) — stop immediately, don't spam console
    if (error?.status === 0) return;
    // Max 3 retries for server errors
    if (retryCount >= 3) return;
    setTimeout(() => revalidate({ retryCount }), 5000 * (retryCount + 1));
};

const opts = { revalidateOnFocus: false, dedupingInterval: 10000, onErrorRetry };

// ── Dashboard ──
export function useStats() {
    return useSWR<DashboardStats>('/analytics/stats', fetcher, opts);
}

export function useChartData(days = 30) {
    return useSWR<ChartDataPoint[]>(`/analytics/chart?days=${days}`, fetcher, opts);
}

export function useRealtimeKpis() {
    return useSWR<RealtimeKpis>('/analytics/kpis/realtime', fetcher, { ...opts, refreshInterval: 15000 });
}

export function useForecast(
    metric: 'transactions' | 'gas_used' | 'nfts_minted' = 'transactions',
    horizon = 7,
) {
    return useSWR<ForecastSeries>(
        `/analytics/forecast?metric=${metric}&horizon=${horizon}`,
        fetcher,
        { ...opts, refreshInterval: 60000 },
    );
}

export function useAnalyticsDelta(
    metric: 'transactions' | 'gas_used' | 'nfts_minted' = 'transactions',
    windowDays = 7,
) {
    return useSWR<AnalyticsDelta>(
        `/analytics/deltas?metric=${metric}&window=${windowDays}`,
        fetcher,
        { ...opts, refreshInterval: 60000 },
    );
}

// ── Treasury & Payments ──
export function useTreasuryStats() {
    return useSWR<TreasuryStats>('/treasury/stats', fetcher, { ...opts, refreshInterval: 15000 });
}

// ── Transactions (backend: { transactions, total }) ──
export function useTransactions(page = 1, limit = 20) {
    return useSWR<{ rows: Transaction[]; total: number }>(
        `/transactions?page=${page}&limit=${limit}`,
        async (url: string) => {
            const raw = await fetcher<{ transactions: Transaction[]; total: number }>(url);
            return { rows: raw.transactions, total: raw.total };
        },
        opts,
    );
}

// ── Gas (backend: { balances }) ──
export function useGasBalances() {
    return useSWR<GasBalance[]>(
        '/gas/balances',
        async (url: string) => {
            const raw = await fetcher<{ balances: GasBalance[] }>(url);
            return raw.balances;
        },
        opts,
    );
}

// ── Gas status (public chain info) ──
export function useGasStatus() {
    return useSWR<GasStatus>('/gas/status', fetcher, { ...opts, refreshInterval: 15000 });
}

export function useBlockchainOverview() {
    return useSWR<BlockchainOverview>('/blockchain/overview', fetcher, { ...opts, refreshInterval: 15000 });
}

export function useBlockchainValidators(status: 'all' | 'active' = 'active') {
    return useSWR<BlockchainValidatorsResponse>(
        `/blockchain/validators?status=${status}`,
        fetcher,
        { ...opts, refreshInterval: 30000 },
    );
}

export function useCurrentSequencer() {
    return useSWR<BlockchainSequencerCurrent>('/blockchain/sequencer/current', fetcher, { ...opts, refreshInterval: 10000 });
}

export function useBlockchainEvents(type = 'validator', limit = 10) {
    return useSWR<BlockchainEventsResponse>(
        `/blockchain/events?type=${type}&limit=${limit}`,
        fetcher,
        { ...opts, refreshInterval: 10000 },
    );
}

// ── Validator Management ──
export function useValidators(status = 'all', sort = 'stake') {
    return useSWR<ValidatorListResponse>(
        `/validators?status=${status}&sort=${sort}`,
        fetcher,
        { ...opts, refreshInterval: 30000 },
    );
}

export function useValidatorProfile(address: string | null) {
    return useSWR<ValidatorProfile>(
        address ? `/validators/${address}` : null,
        fetcher,
        { ...opts, refreshInterval: 15000 },
    );
}

export function useValidatorStats() {
    return useSWR<ValidatorNetworkStats>(
        '/validators/stats',
        fetcher,
        { ...opts, refreshInterval: 30000 },
    );
}

export function useValidatorTimeline(address: string | null, limit = 20) {
    return useSWR<ValidatorTimelineEvent[]>(
        address ? `/validators/${address}/timeline?limit=${limit}` : null,
        fetcher,
        { ...opts, refreshInterval: 30000 },
    );
}

export function useSequencerStatus() {
    return useSWR<SequencerStatus>(
        '/validators/sequencer/current',
        fetcher,
        { ...opts, refreshInterval: 15000 },
    );
}

export function useSlashingHistory(address: string | null) {
    return useSWR<SlashingHistory>(
        address ? `/validators/${address}/slashing` : null,
        fetcher,
        { ...opts, refreshInterval: 30000 },
    );
}

export function useGovernanceProposals(limit = 20) {
    return useSWR<GovernanceProposalsResponse>(
        `/validators/governance/proposals?limit=${limit}`,
        fetcher,
        { ...opts, refreshInterval: 30000 },
    );
}

export function useRewardsHistory(address: string | null) {
    return useSWR<RewardsHistory>(
        address ? `/validators/${address}/rewards` : null,
        fetcher,
        { ...opts, refreshInterval: 30000 },
    );
}

// ── NFTs (backend: { nfts, pagination }) ──
export function useNFTs(page = 1) {
    return useSWR<{ rows: NFT[]; total: number }>(
        `/nfts?page=${page}`,
        async (url: string) => {
            const raw = await fetcher<{ nfts: NFT[]; pagination: { total: number } }>(url);
            return { rows: raw.nfts, total: raw.pagination.total };
        },
        opts,
    );
}

// ── Contracts (flat list) ──
export function useContracts() {
    return useSWR<DeployedContract[]>('/contracts?flat=true', fetcher, opts);
}

// ── Sectors (backend: { sectors }) ──
export function useSectors() {
    return useSWR<Sector[]>(
        '/sectors',
        async (url: string) => {
            const raw = await fetcher<{ sectors: Sector[] }>(url);
            return raw.sectors;
        },
        opts,
    );
}

export function useSectorDetail(sector: string) {
    return useSWR<{ contracts: DeployedContract[]; transactions: Transaction[] }>(
        sector ? `/sectors/${sector}` : null, fetcher, opts
    );
}

// ── AI / Aegis ──
export function useAILogs(
    page = 1,
    filters: {
        severity?: string;
        module?: string;
        q?: string;
        from?: string;
        to?: string;
        wallet?: string;
    } = {}
) {
    const params = new URLSearchParams({ page: String(page) });
    if (filters.severity) params.set('severity', filters.severity);
    if (filters.module) params.set('module', filters.module);
    if (filters.q) params.set('q', filters.q);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    if (filters.wallet) params.set('wallet', filters.wallet);
    return useSWR<{ rows: AILog[]; total: number }>(`/aegis/logs?${params.toString()}`, fetcher, opts);
}

export function useAegisStatus() {
    return useSWR<{ status: string; data: AegisStatus }>('/aegis/status', fetcher, { ...opts, refreshInterval: 15000 });
}

export function useAegisSuggestions(limit = 20) {
    return useSWR<{ status: string; data: { suggestions: AegisSuggestion[]; total: number } }>(
        `/aegis/suggestions?limit=${limit}`, fetcher, { ...opts, refreshInterval: 10000 }
    );
}

// ── Notifications (backend: { notifications }) ──
export function useNotifications() {
    return useSWR<Notification[]>(
        '/notifications',
        async (url: string) => {
            const raw = await fetcher<{ notifications: Notification[] }>(url);
            return raw.notifications;
        },
        { ...opts, refreshInterval: 30000 },
    );
}

// ── Gamification ──
export function useAchievements() {
    return useSWR<Achievement[]>('/gamification/achievements', fetcher, opts);
}

export function useLeaderboard() {
    return useSWR<LeaderboardEntry[]>('/gamification/leaderboard', fetcher, opts);
}

export function useReferralCode() {
    return useSWR<{ code: string }>('/gamification/referral/code', fetcher, opts);
}

export function useReferralStats() {
    return useSWR<{ stats: { total: number; completed: number; pending: number; xp_earned: number }; referrals: any[] }>(
        '/gamification/referral/stats', 
        fetcher, 
        opts
    );
}

export function useMarketplace() {
    return useSWR<any[]>('/gamification/marketplace', fetcher, opts);
}

export function useGamificationFeed() {
    return useSWR<any[]>('/gamification/feed', fetcher, { ...opts, refreshInterval: 15000 });
}

// ── Platform Config (Settings) ──
export function usePlatformConfig() {
    return useSWR<PlatformConfig>('/config/platform', fetcher, { ...opts, refreshInterval: 60000 });
}

// ── QR Codes ──
export function useQRCodes(type?: string, status?: string) {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (status) params.set('status', status);
    const qs = params.toString();
    return useSWR<{ qrCodes: QRCode[] }>(
        `/qr${qs ? `?${qs}` : ''}`,
        fetcher,
        { ...opts, refreshInterval: 30000 },
    );
}

export function useQRStats() {
    return useSWR<{ stats: QRStats[] }>('/qr/stats', fetcher, { ...opts, refreshInterval: 30000 });
}

// ── Documents ──
export function useDocuments(docType?: string, status?: string) {
    const params = new URLSearchParams();
    if (docType) params.set('docType', docType);
    if (status) params.set('status', status);
    const qs = params.toString();
    return useSWR<{ documents: Document[] }>(
        `/documents${qs ? `?${qs}` : ''}`,
        fetcher,
        { ...opts, refreshInterval: 30000 },
    );
}

export function useMarketDocuments(filterType?: string) {
    const params = new URLSearchParams({ listable: 'true' });
    if (filterType) params.set('docType', filterType);
    return useSWR<{ documents: Document[] }>(
        `/market/documents?${params.toString()}`,
        fetcher,
        { ...opts, refreshInterval: 30000 }
    );
}

export function useDocumentStats() {
    return useSWR<{ stats: DocumentStats[] }>('/documents/stats', fetcher, { ...opts, refreshInterval: 30000 });
}

// ── Channels & Communication ──
export function useChannels() {
    return useSWR<{ channels: Channel[] }>('/channels', fetcher, opts);
}

export function useNotificationPreferences() {
    return useSWR<{ preferences: NotificationPreference[]; availableEvents: string[]; availableChannels: string[] }>(
        '/channels/preferences',
        fetcher,
        opts,
    );
}

export function useMessages(channelType?: string, limit = 50) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (channelType) params.set('channelType', channelType);
    return useSWR<{ messages: Message[] }>(
        `/channels/messages?${params.toString()}`,
        fetcher,
        { ...opts, refreshInterval: 30000 },
    );
}

// ── Unified AI Agent ──
export function useAgentConfig() {
    return useSWR<{ config: AgentConfig }>('/agent/config', fetcher, opts);
}

export function useAgentStatus() {
    return useSWR<AgentStatus>(
        '/agent/status',
        async (url: string) => {
            const raw = await fetcher<{ status: string; data: AgentStatus }>(url);
            return raw.data;
        },
        { ...opts, refreshInterval: 8000 },
    );
}

// ── Blockchain Events SSE (real-time from Redis consumer) ──

export interface BlockchainSSEEvent {
    channel: string;
    data: Record<string, unknown>;
    timestamp: number;
}

/**
 * Subscribe to real-time blockchain events via SSE.
 * Filters by event type (validator, sequencer, edge-node, etc).
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
            } catch { /* ignore */ }
        });

        es.onopen = () => setConnected(true);
        es.onerror = () => setConnected(false);

        return () => es.close();
    }, [eventType]);

    return { events, connected };
}
