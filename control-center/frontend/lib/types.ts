// ── Shared TypeScript types matching the API responses ──

// ── Auth ──
export interface LoginResponse {
    token: string;
    user: User;
}

// ── Users ──
export type UserRole = 'user' | 'admin' | 'enterprise' | 'edge_node';

export interface User {
    id: number;
    enterprise_id: number;
    wallet_address: string;
    role: UserRole;
    email: string;
    display_name: string;
    created_at: string;
}

// ── Enterprises ──
export interface Enterprise {
    id: number;
    name: string;
    wallet_address: string;
    plan: string;
    gas_tank_address: string;
    is_active: boolean;
    created_at: string;
}

// ── Transactions ──
export type TransactionStatus = 'pending' | 'confirmed' | 'failed' | 'reverted';

export interface Transaction {
    id: number;
    enterprise_id: number;
    tx_hash: string;
    contract_name: string;
    method: string;
    status: TransactionStatus;
    gas_used: string;
    block_number: number;
    from_address: string;
    to_address: string;
    value_bez: string;
    created_at: string;
}

// ── Gas ──
export interface GasBalance {
    enterprise_id: number;
    enterprise_name: string;
    wallet_address: string;
    balance_bez: number;
    updated_at: string;
}

// ── NFTs ──
export interface NFT {
    id: number;
    token_id: number;
    contract_address: string;
    owner_address: string;
    metadata_uri: string;
    enterprise_id: number;
    sector: string;
    created_at: string;
}

// ── Analytics ──
export interface DashboardStats {
    total_transactions: number;
    total_gas_used: string;
    total_nfts: number;
    active_enterprises: number;
    active_contracts: number;
    block_height: number;
    tps: number;
}

export interface ChartDataPoint {
    date: string;
    transactions: number;
    gas_used: number;
    nfts_minted: number;
}

export interface RealtimeKpis {
    tx_1m: number;
    tx_5m: number;
    tx_1h: number;
    tps_1m: number;
    tps_5m: number;
    tps_1h: number;
    failed_24h: number;
    avg_gas_24h: string;
    computed_at: string;
}

export interface ForecastPoint {
    date: string;
    predicted: number;
    lower: number;
    upper: number;
}

export interface ForecastSeries {
    metric: 'transactions' | 'gas_used' | 'nfts_minted';
    horizon: number;
    model: string;
    generated_at: string;
    points: ForecastPoint[];
}

export interface AnalyticsDelta {
    metric: 'transactions' | 'gas_used' | 'nfts_minted';
    window_days: number;
    current_total: number;
    previous_total: number;
    delta_abs: number;
    delta_pct: number | null;
    trend: 'up' | 'down' | 'flat';
    computed_at: string;
}

// ── Contracts ──
export interface DeployedContract {
    id: number;
    enterprise_id: number;
    sector: string;
    contract_name: string;
    address: string;
    chain_id: number;
    deployed_at: string;
}

// ── Sectors ──
export interface Sector {
    key: string;
    name: string;
    icon: string;
    contracts: number;
    transactions: number;
    active: boolean;
}

// ── Gamification ──
export interface Achievement {
    id: string;
    name: string;
    description: string;
    xp: number;
    unlocked: boolean;
    current: number;
    threshold: number;
    unlocked_at?: string;
}

export interface LeaderboardEntry {
    rank: number;
    enterprise_name: string;
    xp: number;
    level: number;
    badge: string;
}

// ── AI / Aegis ──
export interface AILog {
    id: string | number;
    module: string;
    action: string;
    severity: 'info' | 'warning' | 'critical';
    input_data: string | Record<string, unknown>;
    output_data: string | Record<string, unknown>;
    confidence: number | null;
    created_at: string;
    tx_hash?: string | null;
    block_number?: number | null;
    contract_name?: string | null;
    wallet_address?: string | null;
    gas_used?: string | number | null;
    estimated_cost_bez?: string | number | null;
    confirmation_status?: string | null;
}

// ── Notifications ──
export interface Notification {
    id: number;
    enterprise_id: number;
    type: string;
    title: string;
    body: string;
    read: boolean;
    created_at: string;
}

// ── Platform Config (Settings page) ──
export interface PlatformConfig {
    network: {
        chain_id: number;
        name: string;
        rpc_url: string;
        token: string;
        block_height: number | null;
        gas_price: string | null;
    };
    api: {
        version: string;
        url: string;
        docs_url: string;
        rate_limit_per_15min: number;
        auth_method: string;
        cors_origins: string[];
    };
    services: {
        database: { status: string; version: string | null; tables: number };
        aegis: { status: string; models: number };
        mcp: { tools: number };
    };
    ipfs: {
        configured: boolean;
        gateway: string;
    };
}

// ── Sectors Meta ──

// ── Aegis Control ──
export interface GasStatus {
    blockNumber: number;
    chainId: number;
    gasPrice: string;
    timestamp: number;
}

export interface BlockchainOverview {
    block_height: number;
    chain_id: number;
    gas_price_gwei: string;
    total_supply_bez: number;
    total_staked_bez: number;
    circulating_supply_bez: number;
    active_validators: number;
    current_epoch: number;
    current_sequencer: string;
    epoch_start_block: number;
    epoch_blocks_remaining: number;
    total_contracts_deployed: number;
    computed_at: string;
}

export interface BlockchainValidator {
    operator: string;
    company_name: string;
    total_stake_bez: number;
    contribution_points: number;
    tier: number;
    is_active: boolean;
    is_sequencer_eligible: boolean;
    uptime_bps: number;
    uptime_pct: number;
}

export interface BlockchainValidatorsResponse {
    validators: BlockchainValidator[];
    total: number;
    total_staked_all_bez: number;
}

export interface BlockchainSequencerCurrent {
    epoch: number;
    sequencer: string;
    start_block: number;
    blocks_remaining: number;
    queue_position: number;
    queue_length: number;
    epochs_served: number;
    blocks_produced_total: number;
    fees_accumulated_wei: string;
    is_current_sequencer: boolean;
}

export interface BlockchainEvent {
    id: string;
    contract_name: string;
    event_name: string;
    event_type: string;
    tx_hash: string;
    block_number: number;
    log_index: number;
    actor_address?: string;
    event_data: Record<string, unknown>;
    created_at: string;
}

export interface BlockchainEventsResponse {
    events: BlockchainEvent[];
    total: number;
    limit: number;
    offset: number;
}

export interface AegisStatus {
    system_status: string;
    mode: string;
    uptime_seconds: number;
    models: Record<string, boolean>;
    components: {
        database: string;
        redis: string;
        monitor: string;
    };
    decision_stats: Record<string, unknown>;
    monitor_metrics: Record<string, unknown>;
}

export interface AegisSuggestion {
    id: string;
    type: string;
    target: string;
    reason: string;
    confidence: number;
    created_at: string;
}

// ── Validator Management ──

export interface ValidatorProfile {
    operator: string;
    company_name: string;
    staked_bez: number;
    contribution_points: number;
    tier: number;
    tier_name: string;
    tier_color: string;
    boost_pct: number;
    is_active: boolean;
    is_sequencer_eligible: boolean;
    uptime_pct: number;
    total_events: number;
    last_heartbeat: string | null;
    total_rewards_bez: number;
}

export interface ValidatorListResponse {
    validators: ValidatorProfile[];
    total: number;
    total_staked: number;
    tier_distribution: {
        platinum: number;
        gold: number;
        silver: number;
        bronze: number;
    };
}

export interface ValidatorNetworkStats {
    total_validators: number;
    sequencer_candidates: number;
    events_24h: {
        registrations: number;
        heartbeats: number;
        contributions: number;
        slashes: number;
        tier_updates: number;
    };
    computed_at: string;
}

export interface ValidatorTimelineEvent {
    event_name: string;
    event_data: Record<string, unknown>;
    tx_hash: string;
    block_number: number;
    created_at: string;
}

export interface TierInfo {
    name: string;
    minStake: number;
    boostPct: number;
    color: string;
}

export interface SequencerStatus {
    current_sequencer: string;
    epoch_number: number;
    epoch_start_block: number;
    epoch_length: number;
    blocks_produced: number;
    queue_length: number;
    sequencer_stats: {
        epochs_served: number;
        total_blocks: number;
        total_fees_wei: string;
        last_epoch: number;
    } | null;
    computed_at: string;
}

// ── Bridge Transfer (typed status + step tracking) ──

export type BridgeTransferStatus = 'initiated' | 'deposited' | 'relayed' | 'finalized' | 'failed';

export interface BridgeTransfer {
    id: string;
    from_chain_id: number;
    to_chain_id: number;
    sender: string;
    recipient: string;
    amount: string;
    status: BridgeTransferStatus;
    l1_tx_hash: string | null;
    l2_tx_hash: string | null;
    relay_tx_hash: string | null;
    finalize_tx_hash: string | null;
    current_step: number;
    created_at: string;
    finalized_at: string | null;
}

// ── Write Operation State (shared across mutations) ──

export type WriteOperationStatus = 'idle' | 'submitting' | 'pending' | 'confirmed' | 'failed' | 'reverted';

export interface WriteOperationState {
    status: WriteOperationStatus;
    txHash: string | null;
    error: string | null;
    blockNumber: number | null;
}

export interface SlashRecord {
    slash_id: number;
    validator: string;
    amount_bez: number;
    reason: string;
    timestamp: number;
    appealed: boolean;
    reversed: boolean;
}

export interface SlashingHistory {
    slashes: SlashRecord[];
    total: number;
    slashed_current_period_bez: number;
}

export interface GovernanceProposal {
    proposal_id: string;
    description: string;
    proposer: string;
    state: string | null;
    tx_hash: string;
    block_number: number;
    created_at: string;
}

export interface GovernanceProposalsResponse {
    proposals: GovernanceProposal[];
    total: number;
}

export interface RewardsHistory {
    rewards: Array<{
        amount_bez: number;
        boost_pct: number;
        tier_at_claim: number;
        tx_hash: string;
        block_number: number;
        claimed_at: string;
    }>;
    total_claimed_bez: number;
    pending_rewards_bez: number;
}

export interface TreasuryStats {
    total_volume_bez: number;
    total_payments: number;
    treasury_fees_bez: number;
    refund_rate: number;
    active_chains: number;
    last_updated: string;
}

export const SECTOR_META: Record<string, { name: string; icon: string; color: string }> = {
    health: { name: 'Salud', icon: '🏥', color: 'emerald' },
    realestate: { name: 'Real Estate', icon: '🏢', color: 'blue' },
    energy: { name: 'Energía', icon: '⚡', color: 'yellow' },
    automotive: { name: 'Automotriz', icon: '🚗', color: 'red' },
    manufacturing: { name: 'Manufactura', icon: '🏭', color: 'gray' },
    agriculture: { name: 'Agricultura', icon: '🌾', color: 'green' },
    insurance: { name: 'Seguros', icon: '🛡️', color: 'indigo' },
    education: { name: 'Educación', icon: '🎓', color: 'purple' },
    entertainment: { name: 'Entretenimiento', icon: '🎬', color: 'pink' },
    legal: { name: 'Legal', icon: '⚖️', color: 'slate' },
    supplychain: { name: 'Supply Chain', icon: '📦', color: 'orange' },
    gobierno: { name: 'Gobierno', icon: '🏛️', color: 'sky' },
    finanzas: { name: 'Finanzas', icon: '💰', color: 'amber' },
    servicios: { name: 'Servicios', icon: '🔧', color: 'teal' },
    otros: { name: 'Otros', icon: '🔗', color: 'violet' },
    logistics: { name: 'Logística', icon: '🚚', color: 'cyan' },
};

// ── QR Codes ──

export interface QRCode {
    id: string;
    code: string;
    type: 'payment' | 'tracking' | 'validation' | 'identity' | 'custom' | 'contract' | 'nft' | 'governance';
    status: 'active' | 'used' | 'expired' | 'revoked';
    owner_address: string;
    enterprise_name?: string;
    payload: Record<string, unknown>;
    amount_bez?: number;
    recipient?: string;
    shipment_id?: string;
    max_scans: number;
    scan_count: number;
    expires_at?: string;
    created_at: string;
}

export interface QRScan {
    id: string;
    qr_id: string;
    scanned_by?: string;
    ip_address?: string;
    gps_lat?: number;
    gps_lng?: number;
    result: string;
    scanned_at: string;
}

export interface QRStats {
    type: string;
    total: number;
    active: number;
    used: number;
    total_scans: number;
}

// ── Document Validation ──

export interface Document {
    id: string;
    doc_type: string;
    title: string;
    description?: string;
    status: 'pending' | 'validating' | 'approved' | 'rejected' | 'expired' | 'revoked';
    owner_address: string;
    enterprise_name?: string;
    file_hash: string;
    file_name: string;
    file_size?: number;
    mime_type?: string;
    ipfs_cid?: string;
    tx_hash?: string;
    block_number?: number;
    validator_address?: string;
    validated_at?: string;
    rejection_reason?: string;
    ai_confidence?: number;
    ai_verdict?: string;
    qr_code_id?: string;
    signature_count: number;
    expires_at?: string;
    created_at: string;
    // --- Creator Control & Market Permissions ---
    permissions: {
        visibility: 'private' | 'shared' | 'public';
        listable: boolean;
        sale_enabled: boolean;
        rent_enabled: boolean;
        price?: string; // in BEZ
        rental_terms?: {
            duration_days: number;
            price_per_day: string;
        };
        allowed_addresses: string[]; // for private sharing
    };
}

export interface DocumentSignature {
    id: string;
    signer_address: string;
    message_hash: string;
    tx_hash?: string;
    signed_at: string;
}

export interface DocumentStats {
    doc_type: string;
    total: number;
    approved: number;
    rejected: number;
    pending: number;
}

// ── Multichannel Communication ──

export interface Channel {
    id: string;
    channel_type: string;
    channel_id: string;
    display_name?: string;
    is_verified: boolean;
    is_active: boolean;
    verified_at?: string;
    created_at: string;
    _verificationCode?: string;
}

export interface Message {
    id: string;
    channel_type: string;
    recipient: string;
    template?: string;
    subject?: string;
    body: string;
    status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'bounced';
    error_message?: string;
    sent_at?: string;
    created_at: string;
}

export interface NotificationPreference {
    id: string;
    event_type: string;
    channel_types: string[];
    is_enabled: boolean;
}

export interface MessageTemplate {
    name: string;
    subject: string;
    bodyTemplate: string;
}

// ── Unified AI Agent ──

export interface AgentChannelConfig {
    enabled: boolean;
    token?: string;
    allowedChatIds?: string[];
    allowedGuildIds?: string[];
    phoneNumberId?: string;
    accessToken?: string;
    verifyToken?: string;
}

export interface AgentConfig {
    enabled: boolean;
    personality: string;
    language: string;
    maxMessagesPerMinute: number;
    allowedRoles: string[];
    channels: {
        telegram: AgentChannelConfig;
        discord: AgentChannelConfig;
        whatsapp: AgentChannelConfig;
    };
}

export interface AgentChannelStatus {
    running: boolean;
    error?: string;
}

export interface PendingConfirmation {
    toolName: string;
    expiresAt: number;
    ttlSeconds: number;
}

export interface AgentStatus {
    name: string;
    enabled: boolean;
    language: string;
    channels: Record<string, AgentChannelStatus>;
    rateLimitPerMin: number;
    auditLog: boolean;
    pendingConfirmation: PendingConfirmation | null;
    agent?: {
        stats?: {
            messagesProcessed: number;
            commandsExecuted: number;
            toolsInvoked: number;
            errors: number;
        };
    };
    services?: {
        aegis?: { status: string };
        aiEngine?: { status: string };
    };
}
