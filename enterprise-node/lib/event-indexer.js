'use strict';

const { ethers } = require('ethers');
const { query } = require('./db');
const hooks = require('./hook-dispatcher');

let provider = null;
let active = false;
let reconnectTimer = null;
const listeners = [];

const stats = {
    eventsReceived: 0,
    eventsIndexed: 0,
    eventsFailed: 0,
    lastEventAt: null,
    lastBlock: 0,
    reconnects: 0,
};

function getStats() {
    return { ...stats, active, listenerCount: listeners.length };
}

/**
 * Subscribe to all events from registered ABIs.
 * @param {Array} abis — rows from abi_registry table
 */
async function start(abis) {
    if (active) return;

    const rpcUrl = process.env.BEZHAS_L2_RPC_URL || 'http://bezhas-geth:8545';
    provider = new ethers.JsonRpcProvider(rpcUrl);

    // Verify connection
    try {
        const network = await provider.getNetwork();
        const block = await provider.getBlockNumber();
        stats.lastBlock = block;
        console.log(`[Indexer] Connected to chain ${network.chainId}, block #${block}`);
    } catch (err) {
        console.error(`[Indexer] Cannot connect to ${rpcUrl}: ${err.message}`);
        scheduleReconnect(abis);
        return;
    }

    // Save last processed block
    const { rows } = await query(
        "SELECT value FROM sync_state WHERE key = 'last_indexed_block'"
    ).catch(() => ({ rows: [] }));
    const fromBlock = rows.length > 0 ? parseInt(rows[0].value, 10) + 1 : 'latest';

    for (const abi of abis) {
        if (!abi.address || !abi.abi) continue;

        try {
            const iface = new ethers.Interface(abi.abi);
            const contract = new ethers.Contract(abi.address, abi.abi, provider);

            // Subscribe to all events on this contract
            const filter = { address: abi.address };
            const handler = async (log) => {
                stats.eventsReceived++;
                stats.lastEventAt = new Date().toISOString();
                try {
                    const parsed = iface.parseLog({ topics: log.topics, data: log.data });
                    if (!parsed) return;

                    await query(
                        `INSERT INTO blockchain_events
             (contract_name, event_name, tx_hash, block_number, log_index, actor_address, event_data)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (tx_hash, log_index) DO NOTHING`,
                        [
                            abi.contract_name,
                            parsed.name,
                            log.transactionHash,
                            log.blockNumber,
                            log.index || 0,
                            parsed.args[0]?.toString() || null,
                            JSON.stringify(normalizeArgs(parsed.args)),
                        ]
                    );
                    stats.eventsIndexed++;

                    hooks.dispatch('blockchain.event', {
                        contract_name: abi.contract_name,
                        event_name: parsed.name,
                        tx_hash: log.transactionHash,
                        block_number: log.blockNumber,
                        log_index: log.index || 0,
                        actor_address: parsed.args[0]?.toString() || null,
                        event_data: normalizeArgs(parsed.args),
                    }).catch((err) => {
                        console.warn(`[Hooks] Dispatch failed: ${err.message}`);
                    });

                    // Update sync_state
                    if (log.blockNumber > stats.lastBlock) {
                        stats.lastBlock = log.blockNumber;
                        await query(
                            `INSERT INTO sync_state (key, value, updated_at)
               VALUES ('last_indexed_block', $1, NOW())
               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
                            [String(log.blockNumber)]
                        );
                    }
                } catch (err) {
                    stats.eventsFailed++;
                    console.warn(`[Indexer] Failed to index event: ${err.message}`);
                }
            };

            provider.on(filter, handler);
            listeners.push({ filter, handler, contract: abi.contract_name });
            console.log(`[Indexer] Listening to ${abi.contract_name} at ${abi.address}`);
        } catch (err) {
            console.warn(`[Indexer] Skip ${abi.contract_name}: ${err.message}`);
        }
    }

    active = true;
    console.log(`[Indexer] Active — ${listeners.length} contract listener(s)`);

    // Auto-reconnect on provider error
    provider.on('error', (err) => {
        console.error(`[Indexer] Provider error: ${err.message}`);
        stop();
        scheduleReconnect(abis);
    });
}

function stop() {
    if (provider) {
        for (const l of listeners) {
            provider.off(l.filter, l.handler);
        }
        listeners.length = 0;
    }
    active = false;
}

function scheduleReconnect(abis) {
    if (reconnectTimer) return;
    const delay = Math.min(30000, 5000 * (stats.reconnects + 1));
    console.log(`[Indexer] Reconnecting in ${delay / 1000}s...`);
    reconnectTimer = setTimeout(async () => {
        reconnectTimer = null;
        stats.reconnects++;
        await start(abis);
    }, delay);
}

function normalizeArgs(args) {
    const result = {};
    for (const key of Object.keys(args)) {
        if (/^\d+$/.test(key)) continue; // skip numeric indices
        const val = args[key];
        result[key] = typeof val === 'bigint' ? val.toString() : val;
    }
    return result;
}

module.exports = { start, stop, getStats };
