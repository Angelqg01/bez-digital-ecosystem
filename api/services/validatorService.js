/**
 * validatorService.js — Validator management: on-chain reads + off-chain persistence.
 *
 * Security:
 *  - All user inputs validated before on-chain calls.
 *  - Addresses normalised to checksum format via ethers.
 *  - DB writes use parameterized queries only.
 */
const { ethers } = require('ethers');
const { getContract, getSignedContract } = require('./contractService');
const { query } = require('../db/pool');
const { cacheGet, cacheSet, cacheDel } = require('../cache/redis');

// ── Tier metadata ──
const TIERS = {
    1: { name: 'Bronze', minStake: 10_000, boostPct: 100, color: '#CD7F32' },
    2: { name: 'Silver', minStake: 50_000, boostPct: 125, color: '#C0C0C0' },
    3: { name: 'Gold', minStake: 250_000, boostPct: 150, color: '#FFD700' },
    4: { name: 'Platinum', minStake: 1_000_000, boostPct: 200, color: '#E5E4E2' },
};

function tierMeta(tier) {
    return TIERS[tier] || TIERS[1];
}

function toChecksumAddress(addr) {
    try { return ethers.getAddress(String(addr)); }
    catch { return null; }
}

// ═════════════════════════════════════════════
//  ON-CHAIN READS
// ═════════════════════════════════════════════

/**
 * Fetch full validator profile from ValidatorRegistry contract + off-chain data.
 */
async function getValidatorProfile(operatorAddress) {
    const address = toChecksumAddress(operatorAddress);
    if (!address) return null;

    const cacheKey = `validator:profile:${address.toLowerCase()}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const registry = await getContract('ValidatorRegistry').catch(() => null);
    if (!registry) return null;

    const info = await registry.getValidatorInfo(address).catch(() => null);
    if (!info) return null;

    const boostBps = await registry.getRewardBoost(address).catch(() => 10000n);

    // Off-chain: total indexed events for this operator
    const eventCountRes = await query(
        `SELECT COUNT(*)::int AS cnt FROM blockchain_events
         WHERE actor_address = $1 AND contract_name = 'ValidatorRegistry'`,
        [address.toLowerCase()]
    ).catch(() => ({ rows: [{ cnt: 0 }] }));

    // Off-chain: last heartbeat event
    const lastHbRes = await query(
        `SELECT created_at FROM blockchain_events
         WHERE actor_address = $1 AND event_name = 'HeartbeatRecorded'
         ORDER BY created_at DESC LIMIT 1`,
        [address.toLowerCase()]
    ).catch(() => ({ rows: [] }));

    // Off-chain: reward history
    const rewardRes = await query(
        `SELECT COALESCE(SUM((event_data->>'amount')::numeric), 0) AS total_rewards
         FROM blockchain_events
         WHERE actor_address = $1
           AND contract_name = 'ValidatorRegistry'
           AND event_name = 'StakeAdded'`,
        [address.toLowerCase()]
    ).catch(() => ({ rows: [{ total_rewards: 0 }] }));

    const tier = Number(info[3]) || 1;
    const profile = {
        operator: address,
        company_name: String(info[0] || ''),
        staked_bez: Number(info[1] || 0n) / 1e18,
        contribution_points: Number(info[2] || 0),
        tier,
        tier_name: tierMeta(tier).name,
        tier_color: tierMeta(tier).color,
        boost_pct: Number(boostBps) / 100,
        is_active: Boolean(info[4]),
        is_sequencer_eligible: Boolean(info[5]),
        uptime_pct: Number(info[6] || 0) / 100,
        total_events: eventCountRes.rows[0]?.cnt || 0,
        last_heartbeat: lastHbRes.rows[0]?.created_at || null,
        total_rewards_bez: Number(rewardRes.rows[0]?.total_rewards || 0) / 1e18,
    };

    await cacheSet(cacheKey, profile, 15);
    return profile;
}

/**
 * List all validators with on-chain + off-chain data.
 */
async function listValidators({ status = 'all', sortBy = 'stake', limit = 50 } = {}) {
    const cacheKey = `validators:list:${status}:${sortBy}:${limit}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const registry = await getContract('ValidatorRegistry').catch(() => null);
    if (!registry) return { validators: [], total: 0, total_staked: 0 };

    // Get operator addresses from contract + indexed events
    const candidates = await registry.getActiveSequencerCandidates().catch(() => []);
    const { rows: eventRows } = await query(
        `SELECT DISTINCT actor_address FROM blockchain_events
         WHERE contract_name = 'ValidatorRegistry'
           AND event_name = 'ValidatorRegistered'
           AND actor_address IS NOT NULL`
    ).catch(() => ({ rows: [] }));

    const operatorSet = new Set([
        ...candidates.map((v) => String(v).toLowerCase()),
        ...eventRows.map((r) => String(r.actor_address).toLowerCase()),
    ]);

    const validators = [];
    for (const op of operatorSet) {
        const profile = await getValidatorProfile(op);
        if (!profile) continue;
        if (status === 'active' && !profile.is_active) continue;
        validators.push(profile);
    }

    const sortFns = {
        stake: (a, b) => b.staked_bez - a.staked_bez,
        uptime: (a, b) => b.uptime_pct - a.uptime_pct,
        points: (a, b) => b.contribution_points - a.contribution_points,
        tier: (a, b) => b.tier - a.tier,
    };
    validators.sort(sortFns[sortBy] || sortFns.stake);

    const result = {
        validators: validators.slice(0, Math.min(limit, 200)),
        total: validators.length,
        total_staked: validators.reduce((s, v) => s + v.staked_bez, 0),
        tier_distribution: {
            platinum: validators.filter((v) => v.tier === 4).length,
            gold: validators.filter((v) => v.tier === 3).length,
            silver: validators.filter((v) => v.tier === 2).length,
            bronze: validators.filter((v) => v.tier === 1).length,
        },
    };

    await cacheSet(cacheKey, result, 20);
    return result;
}

// ═════════════════════════════════════════════
//  ON-CHAIN WRITES (require signer)
// ═════════════════════════════════════════════

/**
 * Record heartbeat for a validator (called by edge nodes).
 * Returns tx hash on success.
 */
async function recordHeartbeat(operatorAddress) {
    const address = toChecksumAddress(operatorAddress);
    if (!address) throw new Error('Invalid operator address');

    const registry = await getSignedContract('ValidatorRegistry');
    const tx = await registry.heartbeat({ from: address });
    const receipt = await tx.wait();

    // Invalidate caches
    await cacheDel(`validator:profile:${address.toLowerCase()}`);
    await cacheDel('validators:list:all:stake:50');
    await cacheDel('validators:list:active:stake:50');

    return { tx_hash: receipt.hash, block_number: receipt.blockNumber };
}

/**
 * Record a contribution for a validator (oracle role).
 */
async function recordContribution(operatorAddress, points, taskType) {
    const address = toChecksumAddress(operatorAddress);
    if (!address) throw new Error('Invalid operator address');
    if (!Number.isFinite(points) || points <= 0 || points > 1000) {
        throw new Error('Points must be between 1 and 1000');
    }
    const safeTaskType = String(taskType).slice(0, 60).replace(/[^a-zA-Z0-9_ -]/g, '');

    const registry = await getSignedContract('ValidatorRegistry');
    const tx = await registry.recordContribution(address, points, safeTaskType);
    const receipt = await tx.wait();

    await cacheDel(`validator:profile:${address.toLowerCase()}`);

    return { tx_hash: receipt.hash, block_number: receipt.blockNumber };
}

/**
 * Slash a validator's stake (admin/oracle only).
 */
async function slashValidator(operatorAddress, amountBez, reason) {
    const address = toChecksumAddress(operatorAddress);
    if (!address) throw new Error('Invalid operator address');
    if (!Number.isFinite(amountBez) || amountBez <= 0) {
        throw new Error('Slash amount must be positive');
    }
    const safeReason = String(reason).slice(0, 200).replace(/[^a-zA-Z0-9_ .,!-]/g, '');
    const amountWei = ethers.parseEther(String(amountBez));

    const registry = await getSignedContract('ValidatorRegistry');
    const tx = await registry.slash(address, amountWei, safeReason);
    const receipt = await tx.wait();

    await cacheDel(`validator:profile:${address.toLowerCase()}`);
    await cacheDel('validators:list:all:stake:50');

    return { tx_hash: receipt.hash, block_number: receipt.blockNumber };
}

// ═════════════════════════════════════════════
//  ANALYTICS
// ═════════════════════════════════════════════

/**
 * Validator event timeline for a specific operator.
 */
async function getValidatorTimeline(operatorAddress, limit = 20) {
    const address = toChecksumAddress(operatorAddress);
    if (!address) return [];

    const { rows } = await query(
        `SELECT event_name, event_data, tx_hash, block_number, created_at
         FROM blockchain_events
         WHERE actor_address = $1 AND contract_name = 'ValidatorRegistry'
         ORDER BY created_at DESC
         LIMIT $2`,
        [address.toLowerCase(), Math.min(limit, 100)]
    );

    return rows;
}

/**
 * Network-wide validator stats.
 */
async function getValidatorNetworkStats() {
    const cacheKey = 'validators:network-stats';
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const registry = await getContract('ValidatorRegistry').catch(() => null);
    const totalCount = registry ? Number(await registry.getValidatorCount().catch(() => 0n)) : 0;
    const candidates = registry ? await registry.getActiveSequencerCandidates().catch(() => []) : [];

    // Recent events counts (24h)
    const { rows: recentCounts } = await query(
        `SELECT event_name, COUNT(*)::int AS cnt
         FROM blockchain_events
         WHERE contract_name = 'ValidatorRegistry'
           AND created_at > NOW() - INTERVAL '24 hours'
         GROUP BY event_name`
    ).catch(() => ({ rows: [] }));

    const eventMap = {};
    for (const r of recentCounts) eventMap[r.event_name] = r.cnt;

    const stats = {
        total_validators: totalCount,
        sequencer_candidates: candidates.length,
        events_24h: {
            registrations: eventMap.ValidatorRegistered || 0,
            heartbeats: eventMap.HeartbeatRecorded || 0,
            contributions: eventMap.ContributionRecorded || 0,
            slashes: eventMap.ValidatorSlashed || 0,
            tier_updates: eventMap.TierUpdated || 0,
        },
        computed_at: new Date().toISOString(),
    };

    await cacheSet(cacheKey, stats, 30);
    return stats;
}

// ═════════════════════════════════════════════
//  SEQUENCER
// ═════════════════════════════════════════════

/**
 * Current sequencer info from SequencerRotation contract.
 */
async function getSequencerStatus() {
    const cacheKey = 'sequencer:status';
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const seq = await getContract('SequencerRotation').catch(() => null);
    if (!seq) return null;

    const epochInfo = await seq.getEpochInfo().catch(() => null);
    const queueLen = await seq.getSequencerQueueLength().catch(() => 0n);

    if (!epochInfo) return null;

    const currentSequencer = String(epochInfo[0] || '');
    const stats = currentSequencer
        ? await seq.getSequencerStats(currentSequencer).catch(() => null)
        : null;

    const result = {
        current_sequencer: currentSequencer,
        epoch_number: Number(epochInfo[1] || 0),
        epoch_start_block: Number(epochInfo[2] || 0),
        epoch_length: Number(epochInfo[3] || 7200),
        blocks_produced: Number(epochInfo[4] || 0),
        queue_length: Number(queueLen),
        sequencer_stats: stats ? {
            epochs_served: Number(stats[0] || 0),
            total_blocks: Number(stats[1] || 0),
            total_fees_wei: String(stats[2] || 0n),
            last_epoch: Number(stats[3] || 0),
        } : null,
        computed_at: new Date().toISOString(),
    };

    await cacheSet(cacheKey, result, 10);
    return result;
}

// ═════════════════════════════════════════════
//  SLASHING HISTORY
// ═════════════════════════════════════════════

/**
 * Get slashing history for a specific validator from SlashingManager contract + DB.
 */
async function getSlashingHistory(operatorAddress) {
    const address = toChecksumAddress(operatorAddress);
    if (!address) return { slashes: [], total: 0 };

    const cacheKey = `slashing:history:${address.toLowerCase()}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const slasher = await getContract('SlashingManager').catch(() => null);
    const onChainIds = slasher
        ? await slasher.getValidatorSlashHistory(address).catch(() => [])
        : [];

    const slashes = [];
    for (const id of onChainIds) {
        const record = await slasher.getSlashRecord(Number(id)).catch(() => null);
        if (!record) continue;
        slashes.push({
            slash_id: Number(id),
            validator: String(record[0] || ''),
            amount_bez: Number(record[1] || 0n) / 1e18,
            reason: String(record[2] || ''),
            timestamp: Number(record[3] || 0),
            appealed: Boolean(record[4]),
            reversed: Boolean(record[5]),
        });
    }

    // Also pull from DB for supplementary data
    const { rows: dbSlashes } = await query(
        `SELECT * FROM validator_slashes
         WHERE operator = $1
         ORDER BY slashed_at DESC LIMIT 50`,
        [address.toLowerCase()]
    ).catch(() => ({ rows: [] }));

    const currentPeriod = slasher
        ? Number(await slasher.getSlashedInCurrentPeriod(address).catch(() => 0n)) / 1e18
        : 0;

    const result = {
        slashes,
        db_slashes: dbSlashes,
        total: slashes.length,
        slashed_current_period_bez: currentPeriod,
    };

    await cacheSet(cacheKey, result, 30);
    return result;
}

// ═════════════════════════════════════════════
//  GOVERNANCE
// ═════════════════════════════════════════════

/**
 * Get active governance proposals from GovernanceSystem contract.
 * Note: OZ Governor doesn't enumerate proposals; we rely on indexed ProposalCreated events.
 */
async function getGovernanceProposals(limit = 20) {
    const cacheKey = `governance:proposals:${limit}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const gov = await getContract('GovernanceSystem').catch(() => null);

    // Read proposal events from DB
    const { rows } = await query(
        `SELECT event_data, tx_hash, block_number, created_at
         FROM blockchain_events
         WHERE contract_name = 'GovernanceSystem'
           AND event_name = 'ProposalCreated'
         ORDER BY created_at DESC
         LIMIT $1`,
        [Math.min(limit, 100)]
    ).catch(() => ({ rows: [] }));

    const proposals = [];
    for (const row of rows) {
        const data = row.event_data || {};
        const proposalId = data.proposalId || data.proposal_id;
        let state = null;
        if (gov && proposalId) {
            try {
                const stateNum = Number(await gov.state(proposalId));
                const states = ['Pending', 'Active', 'Canceled', 'Defeated', 'Succeeded', 'Queued', 'Expired', 'Executed'];
                state = states[stateNum] || `Unknown(${stateNum})`;
            } catch { /* proposal might not exist */ }
        }
        proposals.push({
            proposal_id: proposalId,
            description: data.description || '',
            proposer: data.proposer || '',
            state,
            tx_hash: row.tx_hash,
            block_number: row.block_number,
            created_at: row.created_at,
        });
    }

    const result = { proposals, total: proposals.length };
    await cacheSet(cacheKey, result, 30);
    return result;
}

// ═════════════════════════════════════════════
//  REWARDS HISTORY
// ═════════════════════════════════════════════

/**
 * Get reward history for a specific validator: on-chain + DB.
 */
async function getRewardsHistory(operatorAddress) {
    const address = toChecksumAddress(operatorAddress);
    if (!address) return { rewards: [], total_claimed_bez: 0 };

    const cacheKey = `validator:rewards:${address.toLowerCase()}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const edgeRewards = await getContract('EdgeNodeRewards').catch(() => null);
    let pendingRewards = 0;
    if (edgeRewards) {
        pendingRewards = Number(await edgeRewards.pendingRewards(address).catch(() => 0n)) / 1e18;
    }

    const { rows } = await query(
        `SELECT amount_bez, boost_pct, tier_at_claim, tx_hash, block_number, claimed_at
         FROM validator_rewards
         WHERE operator = $1
         ORDER BY claimed_at DESC LIMIT 50`,
        [address.toLowerCase()]
    ).catch(() => ({ rows: [] }));

    const totalClaimed = rows.reduce((s, r) => s + Number(r.amount_bez || 0), 0);

    const result = {
        rewards: rows,
        total_claimed_bez: totalClaimed,
        pending_rewards_bez: pendingRewards,
    };

    await cacheSet(cacheKey, result, 20);
    return result;
}

module.exports = {
    TIERS,
    tierMeta,
    getValidatorProfile,
    listValidators,
    recordHeartbeat,
    recordContribution,
    slashValidator,
    getValidatorTimeline,
    getValidatorNetworkStats,
    getSequencerStatus,
    getSlashingHistory,
    getGovernanceProposals,
    getRewardsHistory,
};
