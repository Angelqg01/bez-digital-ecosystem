/**
 * eventListener.js — On-chain event subscriber and indexer.
 *
 * Subscribes to core contract events on the L2 and indexes them into
 * PostgreSQL + publishes via Redis pub/sub for real-time websocket push.
 *
 * Resilience features:
 *   - In-memory event queue with async drain (prevents backpressure)
 *   - Auto-reconnect on provider disconnect
 *   - Prometheus-compatible stats counter
 */
const { getContract, getProvider } = require('./contractService');
const { recordTx } = require('./txService');
const { query } = require('../db/pool');
const { publish, cacheSet } = require('../cache/redis');

let active = false;
const listeners = [];
let warnedMissingEventsTable = false;
let reconnectTimer = null;

const MAX_NORMALIZE_DEPTH = 10;
const QUEUE_FLUSH_INTERVAL_MS = 200;
const MAX_QUEUE_SIZE = 5000;

// ── Stats for Prometheus ──
const stats = {
    eventsReceived: 0,
    eventsIndexed: 0,
    eventsPublished: 0,
    eventsFailed: 0,
    queueHighWatermark: 0,
    reconnects: 0,
    lastEventAt: null,
    startedAt: null,
};

function getListenerStats() { return { ...stats, active, listenerCount: listeners.length }; }

// ── Async event queue ──
const eventQueue = [];
let draining = false;

function enqueue(task) {
    if (eventQueue.length >= MAX_QUEUE_SIZE) {
        stats.eventsFailed++;
        console.warn('[EventListener] Queue full, dropping event.');
        return;
    }
    eventQueue.push(task);
    if (eventQueue.length > stats.queueHighWatermark) {
        stats.queueHighWatermark = eventQueue.length;
    }
}

async function drainQueue() {
    if (draining || eventQueue.length === 0) return;
    draining = true;
    while (eventQueue.length > 0) {
        const task = eventQueue.shift();
        try {
            await task();
            stats.eventsIndexed++;
        } catch (err) {
            stats.eventsFailed++;
            console.warn('[EventListener] Queue task failed:', err.message);
        }
    }
    draining = false;
}

let drainInterval = null;

function normalizeValue(value, depth = 0) {
    if (depth > MAX_NORMALIZE_DEPTH) return '[nested]';
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'string') return value.slice(0, 2000);
    if (Array.isArray(value)) return value.slice(0, 100).map((v) => normalizeValue(v, depth + 1));
    if (value && typeof value === 'object') {
        const out = {};
        const keys = Object.keys(value).slice(0, 50);
        for (const k of keys) out[k] = normalizeValue(value[k], depth + 1);
        return out;
    }
    return value;
}

async function indexBlockchainEvent({
    contractName,
    eventName,
    eventType,
    txHash,
    blockNumber,
    logIndex,
    actorAddress,
    eventData,
}) {
    try {
        await query(
            `INSERT INTO blockchain_events
             (chain_id, contract_name, event_name, event_type, tx_hash, block_number, log_index, actor_address, event_data)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (tx_hash, log_index) DO NOTHING`,
            [
                parseInt(process.env.BEZHAS_CHAIN_ID || '31337'),
                contractName,
                eventName,
                eventType || 'generic',
                txHash,
                blockNumber,
                logIndex,
                actorAddress || null,
                normalizeValue(eventData || {}),
            ]
        );
    } catch (err) {
        if (!warnedMissingEventsTable && String(err.message || '').includes('blockchain_events')) {
            warnedMissingEventsTable = true;
            console.warn('[EventListener] blockchain_events table missing. Run DB migrations/schema.');
            return;
        }
        console.warn('[EventListener] Failed to index blockchain event:', err.message);
    }
}

/**
 * Subscribe to a contract event and index it.
 */
function onEvent(contract, eventName, handler) {
    contract.on(eventName, handler);
    listeners.push({ contract, eventName, handler });
}

/**
 * Start listening to core contract events.
 * Call once during server startup (after DB + Redis are ready).
 */
async function startListening() {
    if (active) return;
    active = true;
    stats.startedAt = Date.now();
    console.log('[EventListener] Starting event subscriptions...');

    // Start the async drain loop
    drainInterval = setInterval(drainQueue, QUEUE_FLUSH_INTERVAL_MS);

    // Setup provider disconnect/reconnect
    try {
        const provider = await getProvider();
        if (provider && typeof provider.on === 'function') {
            provider.on('error', () => {
                console.warn('[EventListener] Provider error — will reconnect...');
            });
        }
    } catch { /* provider unavailable */ }

    try {
        // ── BEZCoinV2 Transfers ──
        const bez = await getContract('BEZCoinV2').catch(() => null);
        if (bez) {
            onEvent(bez, 'Transfer', (from, to, value, event) => {
                stats.eventsReceived++;
                stats.lastEventAt = Date.now();
                enqueue(async () => {
                    const txData = {
                        txHash: event.log.transactionHash,
                        fromAddress: from,
                        toAddress: to,
                        value: value.toString(),
                        contract: 'BEZCoinV2',
                        method: 'Transfer',
                        status: 'confirmed',
                        chainId: parseInt(process.env.BEZHAS_CHAIN_ID || '31337'),
                        blockNumber: event.log.blockNumber,
                    };
                    await recordTx(txData);
                    await publish('event:bez:transfer', txData);
                    stats.eventsPublished++;
                });
            });
            console.log('[EventListener] Subscribed: BEZCoinV2.Transfer');
        }

        // ── NFT Minted ──
        const nft = await getContract('BeZhasLogisticsNFT').catch(() => null);
        if (nft) {
            onEvent(nft, 'Transfer', (from, to, tokenId, event) => {
                stats.eventsReceived++;
                stats.lastEventAt = Date.now();
                enqueue(async () => {
                    // Mint = from is zero address
                    const isMint = from === '0x0000000000000000000000000000000000000000';
                    const method = isMint ? 'Mint' : 'Transfer';

                    const contractAddr = nft.target;
                    if (isMint) {
                        await query(
                            `INSERT INTO nfts (token_id, contract_address, owner_address, nft_type, minted_at)
                             VALUES ($1, $2, $3, $4, NOW())
                             ON CONFLICT (contract_address, token_id) DO NOTHING`,
                            [parseInt(tokenId.toString()), contractAddr, to, 'logistics']
                        );
                    } else {
                        await query(
                            'UPDATE nfts SET owner_address = $1 WHERE token_id = $2 AND contract_address = $3',
                            [to, parseInt(tokenId.toString()), contractAddr]
                        );
                    }

                    const txData = {
                        txHash: event.log.transactionHash,
                        fromAddress: from,
                        toAddress: to,
                        value: tokenId.toString(),
                        contract: 'BeZhasLogisticsNFT',
                        method,
                        status: 'confirmed',
                        chainId: parseInt(process.env.BEZHAS_CHAIN_ID || '31337'),
                        blockNumber: event.log.blockNumber,
                    };
                    await recordTx(txData);
                    await publish(`event:nft:${method.toLowerCase()}`, txData);
                    stats.eventsPublished++;
                });
            });
            console.log('[EventListener] Subscribed: BeZhasLogisticsNFT.Transfer');
        }

        // ── Quality Escrow ──
        const escrow = await getContract('QualityEscrow').catch(() => null);
        if (escrow) {
            onEvent(escrow, 'SensorDataRegistered', (containerId, temperature, status, node, event) => {
                stats.eventsReceived++;
                stats.lastEventAt = Date.now();
                enqueue(async () => {
                    const eventData = {
                        containerId,
                        temperature: temperature.toString(),
                        status,
                        node,
                    };
                    const txData = {
                        txHash: event.log.transactionHash,
                        fromAddress: node,
                        toAddress: escrow.target,
                        value: temperature.toString(),
                        contract: 'QualityEscrow',
                        method: 'SensorDataRegistered',
                        status: 'confirmed',
                        chainId: parseInt(process.env.BEZHAS_CHAIN_ID || '31337'),
                        blockNumber: event.log.blockNumber,
                    };
                    await indexBlockchainEvent({
                        contractName: 'QualityEscrow',
                        eventName: 'SensorDataRegistered',
                        eventType: 'escrow',
                        txHash: event.log.transactionHash,
                        blockNumber: event.log.blockNumber,
                        logIndex: event.log.index,
                        actorAddress: node,
                        eventData,
                    });
                    await recordTx(txData);
                    await publish('event:escrow:sensor_data', { ...txData, eventData });
                    stats.eventsPublished++;
                });
            });
            console.log('[EventListener] Subscribed: QualityEscrow.SensorDataRegistered');
        }

        // ── Staking Events ──
        const staking = await getContract('StakingPool').catch(() => null);
        if (staking) {
            onEvent(staking, 'Staked', (user, amount, event) => {
                stats.eventsReceived++;
                stats.lastEventAt = Date.now();
                enqueue(async () => {
                    await query(
                        `INSERT INTO staking_positions (wallet_address, amount_staked, is_active)
                         VALUES ($1, $2, true)
                         ON CONFLICT (wallet_address) DO UPDATE SET amount_staked = staking_positions.amount_staked::numeric + $2::numeric`,
                        [user, amount.toString()]
                    );
                    await recordTx({
                        txHash: event.log.transactionHash,
                        fromAddress: user,
                        toAddress: staking.target,
                        value: amount.toString(),
                        contract: 'StakingPool',
                        method: 'Staked',
                        status: 'confirmed',
                        chainId: parseInt(process.env.BEZHAS_CHAIN_ID || '31337'),
                        blockNumber: event.log.blockNumber,
                    });
                    await publish('event:staking:staked', { user, amount: amount.toString() });
                    stats.eventsPublished++;
                });
            });
            console.log('[EventListener] Subscribed: StakingPool.Staked');
        }

        // ── Bridge Deposit/Withdraw Events ──
        const bridge = await getContract('BeZhasBridgeL2').catch(() => null);
        if (bridge) {
            onEvent(bridge, 'Deposit', (user, amount, event) => {
                stats.eventsReceived++;
                stats.lastEventAt = Date.now();
                enqueue(async () => {
                    const txData = {
                        txHash: event.log.transactionHash,
                        fromAddress: user,
                        toAddress: bridge.target,
                        value: amount.toString(),
                        contract: 'BeZhasBridgeL2',
                        method: 'Deposit',
                        status: 'confirmed',
                        chainId: parseInt(process.env.BEZHAS_CHAIN_ID || '31337'),
                        blockNumber: event.log.blockNumber,
                    };
                    await recordTx(txData);
                    await publish('event:bridge:deposit', txData);
                    // Update bridge_transfers step if matching
                    await query(
                        `UPDATE bridge_transfers SET status = 'deposited', l2_tx_hash = $1, current_step = 2
                         WHERE sender = $2 AND status = 'initiated' AND created_at > NOW() - INTERVAL '1 hour'
                         ORDER BY created_at DESC LIMIT 1`,
                        [event.log.transactionHash, user]
                    ).catch(() => { });
                    stats.eventsPublished++;
                });
            });

            onEvent(bridge, 'Withdrawal', (user, amount, event) => {
                stats.eventsReceived++;
                stats.lastEventAt = Date.now();
                enqueue(async () => {
                    const txData = {
                        txHash: event.log.transactionHash,
                        fromAddress: bridge.target,
                        toAddress: user,
                        value: amount.toString(),
                        contract: 'BeZhasBridgeL2',
                        method: 'Withdrawal',
                        status: 'confirmed',
                        chainId: parseInt(process.env.BEZHAS_CHAIN_ID || '31337'),
                        blockNumber: event.log.blockNumber,
                    };
                    await recordTx(txData);
                    await publish('event:bridge:withdrawal', txData);
                    stats.eventsPublished++;
                });
            });
            console.log('[EventListener] Subscribed: BeZhasBridgeL2.Deposit/Withdrawal');
        }

        // ── LiquidityFarming Events ──
        const farming = await getContract('LiquidityFarming').catch(() => null);
        if (farming) {
            onEvent(farming, 'LiquidityAdded', (provider, amount, event) => {
                stats.eventsReceived++;
                stats.lastEventAt = Date.now();
                enqueue(async () => {
                    const txData = {
                        txHash: event.log.transactionHash,
                        fromAddress: provider,
                        toAddress: farming.target,
                        value: amount.toString(),
                        contract: 'LiquidityFarming',
                        method: 'LiquidityAdded',
                        status: 'confirmed',
                        chainId: parseInt(process.env.BEZHAS_CHAIN_ID || '31337'),
                        blockNumber: event.log.blockNumber,
                    };
                    await recordTx(txData);
                    await publish('event:farming:liquidity_added', txData);
                    stats.eventsPublished++;
                });
            });

            onEvent(farming, 'RewardsClaimed', (user, amount, event) => {
                stats.eventsReceived++;
                stats.lastEventAt = Date.now();
                enqueue(async () => {
                    const txData = {
                        txHash: event.log.transactionHash,
                        fromAddress: farming.target,
                        toAddress: user,
                        value: amount.toString(),
                        contract: 'LiquidityFarming',
                        method: 'RewardsClaimed',
                        status: 'confirmed',
                        chainId: parseInt(process.env.BEZHAS_CHAIN_ID || '31337'),
                        blockNumber: event.log.blockNumber,
                    };
                    await recordTx(txData);
                    await publish('event:farming:rewards_claimed', txData);
                    stats.eventsPublished++;
                });
            });
            console.log('[EventListener] Subscribed: LiquidityFarming.LiquidityAdded/RewardsClaimed');
        }

        // ── ValidatorRegistry Events (enqueued + Redis publish) ──
        const validatorRegistry = await getContract('ValidatorRegistry').catch(() => null);
        if (validatorRegistry) {
            const vrEvents = [
                ['ValidatorRegistered', (op, name, stake) => ({ operator: op, companyName: name, initialStake: stake }), 'event:validator:registered'],
                ['StakeAdded', (op, amt, tier) => ({ operator: op, amount: amt, newTier: tier }), 'event:validator:stake_added'],
                ['UnbondingInitiated', (op, amt, at) => ({ operator: op, amount: amt, availableAt: at }), 'event:validator:unbonding'],
                ['StakeWithdrawn', (op, amt) => ({ operator: op, amount: amt }), 'event:validator:stake_withdrawn'],
                ['TierUpdated', (op, old, nw) => ({ operator: op, oldTier: old, newTier: nw }), 'event:validator:tier_updated'],
                ['HeartbeatRecorded', (op, ts) => ({ operator: op, timestamp: ts }), 'event:validator:heartbeat'],
                ['ContributionRecorded', (op, pts, task) => ({ operator: op, points: pts, taskType: task }), 'event:validator:contribution'],
                ['ValidatorSlashed', (op, amt, reason) => ({ operator: op, amount: amt, reason }), 'event:validator:slashed'],
                ['ValidatorDeactivated', (op, reason) => ({ operator: op, reason }), 'event:validator:deactivated'],
                ['ValidatorReactivated', (op) => ({ operator: op }), 'event:validator:reactivated'],
                ['SequencerEligibilityUpdated', (op, eligible) => ({ operator: op, eligible }), 'event:validator:sequencer_eligibility'],
            ];
            for (const [eventName, extractData, channel] of vrEvents) {
                onEvent(validatorRegistry, eventName, (...args) => {
                    stats.eventsReceived++;
                    stats.lastEventAt = Date.now();
                    const event = args[args.length - 1];
                    const dataArgs = args.slice(0, -1);
                    const eventData = extractData(...dataArgs);
                    enqueue(async () => {
                        await indexBlockchainEvent({
                            contractName: 'ValidatorRegistry', eventName, eventType: 'validator',
                            txHash: event.log.transactionHash, blockNumber: event.log.blockNumber,
                            logIndex: event.log.index, actorAddress: eventData.operator || null, eventData,
                        });
                        await publish(channel, normalizeValue(eventData));
                        stats.eventsPublished++;
                    });
                });
            }
            console.log('[EventListener] Subscribed: ValidatorRegistry (11 events)');
        }

        // ── SequencerRotation Events (enqueued + Redis publish) ──
        const sequencerRotation = await getContract('SequencerRotation').catch(() => null);
        if (sequencerRotation) {
            const srEvents = [
                ['EpochAdvanced', (epoch, seq) => ({ epoch, newSequencer: seq }), 'event:sequencer:epoch_advanced'],
                ['SequencerQueueUpdated', (len) => ({ queueLength: len }), 'event:sequencer:queue_updated'],
                ['ForcedRotation', (epoch, old, reason) => ({ epoch, oldSequencer: old, reason }), 'event:sequencer:forced_rotation'],
                ['BlocksReported', (epoch, seq, blocks) => ({ epoch, sequencer: seq, blocksProduced: blocks }), 'event:sequencer:blocks_reported'],
                ['FeesAccumulated', (seq, amt) => ({ sequencer: seq, amount: amt }), 'event:sequencer:fees_accumulated'],
                ['EpochLengthUpdated', (old, nw) => ({ oldLength: old, newLength: nw }), null],
                ['FeeShareUpdated', (old, nw) => ({ oldShare: old, newShare: nw }), null],
            ];
            for (const [eventName, extractData, channel] of srEvents) {
                onEvent(sequencerRotation, eventName, (...args) => {
                    stats.eventsReceived++;
                    stats.lastEventAt = Date.now();
                    const event = args[args.length - 1];
                    const dataArgs = args.slice(0, -1);
                    const eventData = extractData(...dataArgs);
                    enqueue(async () => {
                        await indexBlockchainEvent({
                            contractName: 'SequencerRotation', eventName, eventType: 'sequencer',
                            txHash: event.log.transactionHash, blockNumber: event.log.blockNumber,
                            logIndex: event.log.index, actorAddress: eventData.newSequencer || eventData.oldSequencer || eventData.sequencer || null, eventData,
                        });
                        if (channel) await publish(channel, normalizeValue(eventData));
                        stats.eventsPublished++;
                    });
                });
            }
            console.log('[EventListener] Subscribed: SequencerRotation (7 events)');
        }

        // ── EdgeNodeRewards Events (enqueued + Redis publish) ──
        const edgeNodeRewards = await getContract('EdgeNodeRewards').catch(() => null);
        if (edgeNodeRewards) {
            const enEvents = [
                ['NodeRegistered', (addr) => ({ nodeAddress: addr }), 'event:edge:node_registered'],
                ['NodeDeactivated', (addr) => ({ nodeAddress: addr }), 'event:edge:node_deactivated'],
                ['ValidationRecorded', (addr, pts, task) => ({ nodeAddress: addr, points: pts, taskType: task }), 'event:edge:validation_recorded'],
                ['RewardsClaimed', (addr, amt, boost) => ({ nodeAddress: addr, bezAmount: amt, boostBps: boost }), 'event:edge:rewards_claimed'],
                ['RewardRateUpdated', (old, nw) => ({ oldRate: old, newRate: nw }), null],
                ['ValidatorRegistryUpdated', (reg) => ({ newRegistry: reg }), null],
            ];
            for (const [eventName, extractData, channel] of enEvents) {
                onEvent(edgeNodeRewards, eventName, (...args) => {
                    stats.eventsReceived++;
                    stats.lastEventAt = Date.now();
                    const event = args[args.length - 1];
                    const dataArgs = args.slice(0, -1);
                    const eventData = extractData(...dataArgs);
                    enqueue(async () => {
                        await indexBlockchainEvent({
                            contractName: 'EdgeNodeRewards', eventName, eventType: 'edge-node',
                            txHash: event.log.transactionHash, blockNumber: event.log.blockNumber,
                            logIndex: event.log.index, actorAddress: eventData.nodeAddress || eventData.newRegistry || null, eventData,
                        });
                        if (channel) await publish(channel, normalizeValue(eventData));
                        stats.eventsPublished++;
                    });
                });
            }
            console.log('[EventListener] Subscribed: EdgeNodeRewards (6 events)');
        }

        // ── SlashingManager Events (enqueued + Redis publish) ──
        const slashingManager = await getContract('SlashingManager').catch(() => null);
        if (slashingManager) {
            onEvent(slashingManager, 'ValidatorSlashed', (...args) => {
                stats.eventsReceived++;
                stats.lastEventAt = Date.now();
                const [slashId, validator, amount, reason] = args;
                const event = args[args.length - 1];
                enqueue(async () => {
                    await indexBlockchainEvent({ contractName: 'SlashingManager', eventName: 'ValidatorSlashed', eventType: 'slashing', txHash: event.log.transactionHash, blockNumber: event.log.blockNumber, logIndex: event.log.index, actorAddress: validator, eventData: { slashId, validator, amount, reason } });
                    await query(
                        `INSERT INTO validator_slashes (operator, amount_bez, reason, tx_hash, block_number)
                         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (tx_hash) DO NOTHING`,
                        [String(validator).toLowerCase(), Number(amount) / 1e18, String(reason), event.log.transactionHash, event.log.blockNumber]
                    ).catch(() => { });
                    await publish('event:slashing:slashed', { slashId: slashId.toString(), validator, amount: amount.toString(), reason });
                    stats.eventsPublished++;
                });
            });
            onEvent(slashingManager, 'SlashAppealed', (...args) => {
                stats.eventsReceived++;
                const [slashId, validator] = args;
                const event = args[args.length - 1];
                enqueue(async () => {
                    await indexBlockchainEvent({ contractName: 'SlashingManager', eventName: 'SlashAppealed', eventType: 'slashing', txHash: event.log.transactionHash, blockNumber: event.log.blockNumber, logIndex: event.log.index, actorAddress: validator, eventData: { slashId, validator } });
                    await publish('event:slashing:appealed', { slashId: slashId.toString(), validator });
                    stats.eventsPublished++;
                });
            });
            onEvent(slashingManager, 'SlashReversed', (...args) => {
                stats.eventsReceived++;
                const [slashId, validator] = args;
                const event = args[args.length - 1];
                enqueue(async () => {
                    await indexBlockchainEvent({ contractName: 'SlashingManager', eventName: 'SlashReversed', eventType: 'slashing', txHash: event.log.transactionHash, blockNumber: event.log.blockNumber, logIndex: event.log.index, actorAddress: validator, eventData: { slashId, validator } });
                    await publish('event:slashing:reversed', { slashId: slashId.toString(), validator });
                    stats.eventsPublished++;
                });
            });
            console.log('[EventListener] Subscribed: SlashingManager (3 events)');
        }

        // ── GovernanceSystem Events (enqueued + Redis publish) ──
        const governance = await getContract('GovernanceSystem').catch(() => null);
        if (governance) {
            onEvent(governance, 'ProposalCreated', (...args) => {
                stats.eventsReceived++;
                stats.lastEventAt = Date.now();
                const [proposalId, proposer, , , , description] = args;
                const event = args[args.length - 1];
                enqueue(async () => {
                    await indexBlockchainEvent({ contractName: 'GovernanceSystem', eventName: 'ProposalCreated', eventType: 'governance', txHash: event.log.transactionHash, blockNumber: event.log.blockNumber, logIndex: event.log.index, actorAddress: proposer, eventData: { proposalId, proposer, description } });
                    await publish('event:governance:proposal_created', { proposalId: proposalId.toString(), proposer, description });
                    stats.eventsPublished++;
                });
            });
            onEvent(governance, 'VoteCast', (...args) => {
                stats.eventsReceived++;
                const [voter, proposalId, support, weight, reason] = args;
                const event = args[args.length - 1];
                enqueue(async () => {
                    await indexBlockchainEvent({ contractName: 'GovernanceSystem', eventName: 'VoteCast', eventType: 'governance', txHash: event.log.transactionHash, blockNumber: event.log.blockNumber, logIndex: event.log.index, actorAddress: voter, eventData: { voter, proposalId, support, weight, reason } });
                    await publish('event:governance:vote_cast', { voter, proposalId: proposalId.toString(), support: support.toString() });
                    stats.eventsPublished++;
                });
            });
            onEvent(governance, 'ProposalExecuted', (...args) => {
                stats.eventsReceived++;
                const [proposalId] = args;
                const event = args[args.length - 1];
                enqueue(async () => {
                    await indexBlockchainEvent({ contractName: 'GovernanceSystem', eventName: 'ProposalExecuted', eventType: 'governance', txHash: event.log.transactionHash, blockNumber: event.log.blockNumber, logIndex: event.log.index, eventData: { proposalId } });
                    await publish('event:governance:proposal_executed', { proposalId: proposalId.toString() });
                    stats.eventsPublished++;
                });
            });
            console.log('[EventListener] Subscribed: GovernanceSystem (3 events)');
        }

        console.log(`[EventListener] ${listeners.length} event subscriptions active.`);
    } catch (err) {
        console.error('[EventListener] Error starting listeners:', err.message);
    }
}

/**
 * Stop all event listeners.
 */
async function stopListening() {
    if (drainInterval) { clearInterval(drainInterval); drainInterval = null; }
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    // Drain remaining queued events
    await drainQueue();
    for (const { contract, eventName, handler } of listeners) {
        contract.off(eventName, handler);
    }
    listeners.length = 0;
    active = false;
    console.log('[EventListener] All listeners stopped.');
}

module.exports = { startListening, stopListening, getListenerStats };
