#!/usr/bin/env node
/**
 * bridge-relay.cjs — BeZhas Cross-Chain Bridge Relay Service
 * 
 * Listens for BridgeLocked events on L2 (BEZPolygonBridge) and relays them
 * to the target chain by calling bridgeMint() on WrappedBEZ.
 * Also listens for BridgeBurn events on Polygon and calls unlock() on L2.
 * 
 * Architecture:
 *   L2 (BeZhas)  ──BridgeLocked──►  Relay  ──bridgeMint──►  Polygon (wBEZ)
 *   Polygon      ──BridgeBurn───►   Relay  ──unlock──────►  L2 (BEZ)
 * 
 * Security:
 *   - Relay wallet must have RELAYER_ROLE on both contracts
 *   - Idempotent: checks processedTxs before relaying
 *   - Retry queue for failed relays
 *   - Structured logging for audit
 * 
 * Usage:
 *   node services/bridge-relay.cjs
 * 
 * Env Vars:
 *   L2_RPC_URL             — BeZhas L2 RPC (default: http://localhost:8545)
 *   POLYGON_RPC_URL        — Polygon/Amoy RPC
 *   RELAY_PRIVATE_KEY      — Relay operator private key
 *   BRIDGE_L2_ADDRESS      — BEZPolygonBridge on L2
 *   WRAPPED_BEZ_ADDRESS    — WrappedBEZ on Polygon
 *   POLL_INTERVAL_MS       — Block polling interval (default: 5000)
 */

'use strict';

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// ── Config ──────────────────────────────────────────────────
const CONFIG = {
    l2RpcUrl: process.env.L2_RPC_URL || 'http://localhost:8545',
    polygonRpcUrl: process.env.POLYGON_RPC_URL || 'https://rpc-amoy.polygon.technology',
    relayPk: process.env.RELAY_PRIVATE_KEY || process.env.ADMIN_PK || '',
    bridgeL2Address: process.env.BRIDGE_L2_ADDRESS || '',
    wrappedBezAddress: process.env.WRAPPED_BEZ_ADDRESS || '',
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '5000'),
    maxRetries: parseInt(process.env.RELAY_MAX_RETRIES || '5'),
    retryDelayMs: parseInt(process.env.RELAY_RETRY_DELAY_MS || '3000'),
    // BEZ-Coin v1 (LIVE on BSC) — used as reference
    bezCoinV1Address: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
};

// ── Logger ──────────────────────────────────────────────────
const log = {
    _emit(level, module, msg, meta = {}) {
        const entry = { ts: new Date().toISOString(), level, module, msg, ...meta };
        const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
        fn(JSON.stringify(entry));
    },
    info: (mod, msg, meta) => log._emit('info', mod, msg, meta),
    warn: (mod, msg, meta) => log._emit('warn', mod, msg, meta),
    error: (mod, msg, meta) => log._emit('error', mod, msg, meta),
};

// ── Minimal ABIs ────────────────────────────────────────────
const BRIDGE_ABI = [
    'event BridgeLocked(address indexed sender, uint256 amount, uint256 fee, uint256 netAmount, uint256 indexed targetChainId, uint256 nonce)',
    'event BridgeUnlocked(address indexed recipient, uint256 amount, bytes32 indexed srcTxHash)',
    'function unlock(address recipient, uint256 amount, bytes32 srcTxHash) external',
    'function isProcessed(bytes32 txHash) view returns (bool)',
    'function totalLocked() view returns (uint256)',
];

const WRAPPED_BEZ_ABI = [
    'event BridgeMint(address indexed to, uint256 amount, bytes32 indexed srcTxHash)',
    'event BridgeBurn(address indexed from, uint256 amount, uint256 indexed targetChainId)',
    'function bridgeMint(address to, uint256 amount, bytes32 srcTxHash) external',
];

// ── Load addresses from deployment file if not in env ────────
function loadAddresses() {
    if (CONFIG.bridgeL2Address && CONFIG.wrappedBezAddress) return;

    try {
        const deployFile = path.resolve(__dirname, '..', 'smart-contracts', 'deployments', '31337.json');
        const deploy = JSON.parse(fs.readFileSync(deployFile, 'utf-8'));
        
        if (!CONFIG.bridgeL2Address) {
            CONFIG.bridgeL2Address = deploy.core?.BEZPolygonBridge || '';
        }
        if (!CONFIG.wrappedBezAddress) {
            CONFIG.wrappedBezAddress = deploy.core?.WrappedBEZ || '';
        }
        
        log.info('Config', 'Loaded addresses from deployment file', {
            bridge: CONFIG.bridgeL2Address,
            wrappedBez: CONFIG.wrappedBezAddress,
        });
    } catch (err) {
        log.warn('Config', 'Could not load deployment file', { error: err.message });
    }
}

// ── Retry Queue ─────────────────────────────────────────────
class RetryQueue {
    constructor(maxRetries, baseDelayMs) {
        this.maxRetries = maxRetries;
        this.baseDelayMs = baseDelayMs;
        this.pending = [];
        this.running = false;
    }

    enqueue(job) {
        this.pending.push({ ...job, attempt: 0 });
        log.info('RetryQueue', 'Job enqueued', { txHash: job.txHash, queueLen: this.pending.length });
        this._processNext();
    }

    async _processNext() {
        if (this.running || this.pending.length === 0) return;
        this.running = true;

        const job = this.pending[0];
        const delay = this.baseDelayMs * (2 ** job.attempt);

        await new Promise(r => setTimeout(r, delay));

        try {
            await job.execute();
            this.pending.shift();
            log.info('RetryQueue', 'Job succeeded', { txHash: job.txHash });
        } catch (err) {
            job.attempt++;
            if (job.attempt >= this.maxRetries) {
                this.pending.shift();
                log.error('RetryQueue', 'Job permanently failed', {
                    txHash: job.txHash,
                    error: err.message,
                });
            } else {
                log.warn('RetryQueue', `Retry ${job.attempt}/${this.maxRetries}`, {
                    txHash: job.txHash,
                    nextDelay: delay * 2,
                });
            }
        } finally {
            this.running = false;
            if (this.pending.length > 0) this._processNext();
        }
    }
}

// ── Bridge Relay Service ────────────────────────────────────
class BridgeRelay {
    constructor() {
        this.retryQueue = new RetryQueue(CONFIG.maxRetries, CONFIG.retryDelayMs);
        this.processedEvents = new Set();
        this.lastL2Block = 0;
        this.lastPolygonBlock = 0;
        this.stats = { l2ToPolygon: 0, polygonToL2: 0, errors: 0 };
    }

    async start() {
        loadAddresses();

        if (!CONFIG.relayPk) {
            log.error('Relay', 'RELAY_PRIVATE_KEY not set. Cannot start relay.');
            process.exit(1);
        }

        // Initialize providers
        this.l2Provider = new ethers.JsonRpcProvider(CONFIG.l2RpcUrl);
        this.polygonProvider = new ethers.JsonRpcProvider(CONFIG.polygonRpcUrl);

        // Initialize wallets
        this.l2Wallet = new ethers.Wallet(CONFIG.relayPk, this.l2Provider);
        this.polygonWallet = new ethers.Wallet(CONFIG.relayPk, this.polygonProvider);

        log.info('Relay', 'Bridge relay starting', {
            l2Rpc: CONFIG.l2RpcUrl,
            polygonRpc: CONFIG.polygonRpcUrl,
            relayAddress: this.l2Wallet.address,
            bridgeL2: CONFIG.bridgeL2Address,
            wrappedBez: CONFIG.wrappedBezAddress,
        });

        // Initialize contracts
        if (CONFIG.bridgeL2Address) {
            this.bridgeL2 = new ethers.Contract(CONFIG.bridgeL2Address, BRIDGE_ABI, this.l2Wallet);
        }
        if (CONFIG.wrappedBezAddress) {
            this.wrappedBez = new ethers.Contract(CONFIG.wrappedBezAddress, WRAPPED_BEZ_ABI, this.polygonWallet);
        }

        // Get starting blocks
        try {
            this.lastL2Block = await this.l2Provider.getBlockNumber();
            log.info('Relay', `L2 starting block: ${this.lastL2Block}`);
        } catch (err) {
            log.warn('Relay', 'L2 provider not available — will retry', { error: err.message });
        }

        try {
            this.lastPolygonBlock = await this.polygonProvider.getBlockNumber();
            log.info('Relay', `Polygon starting block: ${this.lastPolygonBlock}`);
        } catch (err) {
            log.warn('Relay', 'Polygon provider not available — will retry', { error: err.message });
        }

        // Start polling loops
        log.info('Relay', 'Polling started', { intervalMs: CONFIG.pollIntervalMs });
        this._pollL2();
        this._pollPolygon();

        // Status report every 60s
        setInterval(() => this._reportStatus(), 60_000);
    }

    // ── L2 → Polygon: Listen for BridgeLocked, call bridgeMint ──
    async _pollL2() {
        try {
            if (!this.bridgeL2) {
                log.warn('Relay', 'Bridge L2 contract not initialized');
                return;
            }

            const currentBlock = await this.l2Provider.getBlockNumber();
            if (currentBlock <= this.lastL2Block) return;

            const events = await this.bridgeL2.queryFilter(
                'BridgeLocked',
                this.lastL2Block + 1,
                currentBlock
            );

            for (const event of events) {
                const eventId = `l2-${event.transactionHash}-${event.index}`;
                if (this.processedEvents.has(eventId)) continue;

                const { sender, netAmount, targetChainId, nonce } = event.args;
                const txHash = event.transactionHash;

                log.info('Relay', 'BridgeLocked detected', {
                    sender,
                    amount: ethers.formatEther(netAmount),
                    targetChainId: targetChainId.toString(),
                    nonce: nonce.toString(),
                    txHash,
                });

                // Relay to Polygon: mint wBEZ
                this.processedEvents.add(eventId);
                const srcTxHashBytes32 = ethers.zeroPadValue(txHash, 32);

                try {
                    if (this.wrappedBez) {
                        const tx = await this.wrappedBez.bridgeMint(sender, netAmount, srcTxHashBytes32);
                        await tx.wait();
                        log.info('Relay', 'wBEZ minted on Polygon', {
                            recipient: sender,
                            amount: ethers.formatEther(netAmount),
                            polygonTxHash: tx.hash,
                        });
                        this.stats.l2ToPolygon++;
                    } else {
                        log.warn('Relay', 'WrappedBEZ contract not available — queuing');
                        this.retryQueue.enqueue({
                            txHash,
                            execute: async () => {
                                const tx = await this.wrappedBez.bridgeMint(sender, netAmount, srcTxHashBytes32);
                                await tx.wait();
                                this.stats.l2ToPolygon++;
                            },
                        });
                    }
                } catch (err) {
                    log.error('Relay', 'Failed to mint wBEZ', { error: err.message, txHash });
                    this.stats.errors++;
                    this.retryQueue.enqueue({
                        txHash,
                        execute: async () => {
                            const tx = await this.wrappedBez.bridgeMint(sender, netAmount, srcTxHashBytes32);
                            await tx.wait();
                            this.stats.l2ToPolygon++;
                        },
                    });
                }
            }

            this.lastL2Block = currentBlock;
        } catch (err) {
            if (!err.message.includes('could not detect network')) {
                log.error('Relay', 'L2 poll error', { error: err.message });
                this.stats.errors++;
            }
        } finally {
            setTimeout(() => this._pollL2(), CONFIG.pollIntervalMs);
        }
    }

    // ── Polygon → L2: Listen for BridgeBurn, call unlock ────────
    async _pollPolygon() {
        try {
            if (!this.wrappedBez || !this.bridgeL2) {
                return;
            }

            const currentBlock = await this.polygonProvider.getBlockNumber();
            if (currentBlock <= this.lastPolygonBlock) return;

            const events = await this.wrappedBez.queryFilter(
                'BridgeBurn',
                this.lastPolygonBlock + 1,
                currentBlock
            );

            for (const event of events) {
                const eventId = `polygon-${event.transactionHash}-${event.index}`;
                if (this.processedEvents.has(eventId)) continue;

                const { from: sender, amount, targetChainId } = event.args;
                const txHash = event.transactionHash;
                const srcTxHashBytes32 = ethers.zeroPadValue(txHash, 32);

                log.info('Relay', 'BridgeBurn detected on Polygon', {
                    sender,
                    amount: ethers.formatEther(amount),
                    targetChainId: targetChainId.toString(),
                    txHash,
                });

                // Check if already processed on L2
                const alreadyProcessed = await this.bridgeL2.isProcessed(srcTxHashBytes32);
                if (alreadyProcessed) {
                    log.info('Relay', 'Already processed on L2 — skipping', { txHash });
                    this.processedEvents.add(eventId);
                    continue;
                }

                this.processedEvents.add(eventId);

                try {
                    const tx = await this.bridgeL2.unlock(sender, amount, srcTxHashBytes32);
                    await tx.wait();
                    log.info('Relay', 'BEZ unlocked on L2', {
                        recipient: sender,
                        amount: ethers.formatEther(amount),
                        l2TxHash: tx.hash,
                    });
                    this.stats.polygonToL2++;
                } catch (err) {
                    log.error('Relay', 'Failed to unlock BEZ on L2', { error: err.message, txHash });
                    this.stats.errors++;
                    this.retryQueue.enqueue({
                        txHash,
                        execute: async () => {
                            const tx = await this.bridgeL2.unlock(sender, amount, srcTxHashBytes32);
                            await tx.wait();
                            this.stats.polygonToL2++;
                        },
                    });
                }
            }

            this.lastPolygonBlock = currentBlock;
        } catch (err) {
            if (!err.message.includes('could not detect network')) {
                log.error('Relay', 'Polygon poll error', { error: err.message });
            }
        } finally {
            setTimeout(() => this._pollPolygon(), CONFIG.pollIntervalMs);
        }
    }

    _reportStatus() {
        log.info('Relay', 'Status report', {
            ...this.stats,
            l2Block: this.lastL2Block,
            polygonBlock: this.lastPolygonBlock,
            processedEvents: this.processedEvents.size,
            retryQueueLen: this.retryQueue.pending.length,
        });
    }
}

// ── Graceful shutdown ───────────────────────────────────────
const relay = new BridgeRelay();

process.on('SIGTERM', () => {
    log.info('Relay', 'SIGTERM received — shutting down');
    process.exit(0);
});
process.on('SIGINT', () => {
    log.info('Relay', 'SIGINT received — shutting down');
    process.exit(0);
});

// ── Start ───────────────────────────────────────────────────
relay.start().catch(err => {
    log.error('Relay', 'Fatal error', { error: err.message, stack: err.stack });
    process.exit(1);
});
