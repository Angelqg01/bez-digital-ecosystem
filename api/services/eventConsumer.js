/**
 * eventConsumer.js — Redis Pub/Sub consumer that bridges blockchain events to SSE streams.
 *
 * Subscribes to all event:* channels published by eventListener.js and distributes
 * them to connected SSE clients via an in-process EventEmitter bus.
 *
 * Architecture:
 *   eventListener.js → Redis PUBLISH → eventConsumer.js → EventEmitter → SSE routes
 */
'use strict';

const { createClient } = require('redis');
const { EventEmitter } = require('events');

const bus = new EventEmitter();
bus.setMaxListeners(200); // SSE connections can pile up

let subscriber = null;
let connected = false;
let reconnectTimer = null;

/** All channels the consumer subscribes to */
const CHANNELS = [
    // Core
    'event:bez:transfer',
    'event:nft:mint',
    'event:nft:transfer',
    'event:escrow:sensor_data',
    'event:staking:staked',
    'event:bridge:deposit',
    'event:bridge:withdrawal',
    'event:farming:liquidity_added',
    'event:farming:rewards_claimed',
    // Validators
    'event:validator:registered',
    'event:validator:stake_added',
    'event:validator:unbonding',
    'event:validator:stake_withdrawn',
    'event:validator:tier_updated',
    'event:validator:heartbeat',
    'event:validator:contribution',
    'event:validator:slashed',
    'event:validator:deactivated',
    'event:validator:reactivated',
    'event:validator:sequencer_eligibility',
    // Sequencer
    'event:sequencer:epoch_advanced',
    'event:sequencer:queue_updated',
    'event:sequencer:forced_rotation',
    'event:sequencer:blocks_reported',
    'event:sequencer:fees_accumulated',
    // Edge node
    'event:edge:node_registered',
    'event:edge:node_deactivated',
    'event:edge:validation_recorded',
    'event:edge:rewards_claimed',
    // Slashing
    'event:slashing:slashed',
    'event:slashing:appealed',
    'event:slashing:reversed',
    // Governance
    'event:governance:proposal_created',
    'event:governance:vote_cast',
    'event:governance:proposal_executed',
];

// ── Stats for Prometheus ──
const stats = {
    eventsReceived: 0,
    eventsDispatched: 0,
    lastEventAt: null,
    reconnects: 0,
};

/**
 * Start the Redis subscriber and wire it to the event bus.
 */
async function startConsumer() {
    if (subscriber) return;

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    subscriber = createClient({ url: redisUrl });

    subscriber.on('error', (err) => {
        console.error('[EventConsumer] Redis subscriber error:', err.message);
        connected = false;
    });

    subscriber.on('reconnecting', () => {
        stats.reconnects++;
        console.warn('[EventConsumer] Redis reconnecting...');
    });

    try {
        await subscriber.connect();
        connected = true;
        console.log(`[EventConsumer] Redis subscriber connected. Subscribing to ${CHANNELS.length} channels...`);

        // Subscribe to all channels
        for (const channel of CHANNELS) {
            await subscriber.subscribe(channel, (message) => {
                stats.eventsReceived++;
                stats.lastEventAt = Date.now();
                try {
                    const parsed = JSON.parse(message);
                    // Emit typed event (e.g. 'event:bez:transfer') + generic 'blockchain_event'
                    bus.emit(channel, parsed);
                    bus.emit('blockchain_event', { channel, data: parsed, timestamp: Date.now() });
                    stats.eventsDispatched++;
                } catch {
                    console.warn('[EventConsumer] Failed to parse message on', channel);
                }
            });
        }

        console.log(`[EventConsumer] Subscribed to ${CHANNELS.length} channels.`);
    } catch (err) {
        console.error('[EventConsumer] Failed to start:', err.message);
        connected = false;
        // Auto-retry after 5s
        reconnectTimer = setTimeout(() => {
            subscriber = null;
            startConsumer().catch(() => { });
        }, 5000);
    }
}

/**
 * Stop the consumer cleanly.
 */
async function stopConsumer() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (subscriber) {
        try {
            await subscriber.unsubscribe();
            await subscriber.quit();
        } catch { /* ignore */ }
        subscriber = null;
        connected = false;
    }
    bus.removeAllListeners();
    console.log('[EventConsumer] Stopped.');
}

/**
 * Register an SSE response to receive all blockchain events.
 * Returns a cleanup function to call on req.on('close').
 */
function registerSSEClient(res, { filter = null } = {}) {
    const handler = (evt) => {
        // Optional filter: { channel: 'event:bez:*' } or { eventType: 'validator' }
        if (filter) {
            if (filter.channel && !evt.channel.startsWith(filter.channel.replace('*', ''))) return;
            if (filter.eventType && !evt.channel.includes(filter.eventType)) return;
        }
        try {
            res.write(`event: blockchain_event\ndata: ${JSON.stringify(evt)}\n\n`);
        } catch {
            // Client disconnected
        }
    };

    bus.on('blockchain_event', handler);

    return () => {
        bus.off('blockchain_event', handler);
    };
}

/**
 * Get consumer stats for Prometheus/health checks.
 */
function getConsumerStats() {
    return {
        connected,
        channels: CHANNELS.length,
        sseListeners: bus.listenerCount('blockchain_event'),
        ...stats,
    };
}

module.exports = {
    startConsumer,
    stopConsumer,
    registerSSEClient,
    getConsumerStats,
    bus,
    CHANNELS,
};
