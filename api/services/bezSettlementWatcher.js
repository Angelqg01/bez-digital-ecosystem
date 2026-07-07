/**
 * bezSettlementWatcher.js — on-chain reconciliation for crypto/qr buy orders.
 *
 * Replaces the manual settle step for the BEZ rail: scans Transfer(BEZ →
 * Treasury) logs and auto-settles the matching pending order through the same
 * paymentSettlement.settlePayment path the internal route uses.
 *
 * Matching rule (strong, no on-chain memo needed):
 *   sender address == order wallet_address (oldest pending first)
 *   AND transferred BEZ >= expected BEZ × (1 − SETTLEMENT_TOLERANCE)
 * where expected BEZ = (amount_usd − platform_fee) / BEZ price snapshot.
 *
 * Idempotency / crash safety:
 *   - block cursor persisted per chain (settlement_watcher_cursor)
 *   - a tx hash already recorded on any buy order is skipped
 *   - only blocks with >= CONFIRMATIONS confirmations are scanned
 */
const { ethers } = require('ethers');
const { query } = require('../db/pool');
const { settlePayment, expireStaleOrders } = require('./paymentSettlement');
const logger = require('pino')({ level: 'info', name: 'bez-settlement-watcher' });

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const CONFIRMATIONS = parseInt(process.env.SETTLEMENT_CONFIRMATIONS || '3', 10);
const TOLERANCE = Math.min(0.5, Math.max(0, parseFloat(process.env.SETTLEMENT_TOLERANCE || '0.10')));
const LOOKBACK_BLOCKS = parseInt(process.env.SETTLEMENT_LOOKBACK_BLOCKS || '1000', 10);
const MAX_RANGE = 2000; // getLogs range cap for public RPCs

const CHAINS = {
    137: {
        rpc: process.env.POLYGON_MAINNET_RPC || 'https://polygon-bor.publicnode.com',
        bez: process.env.BEZCOIN_ADDRESS || '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
    },
    56: {
        rpc: process.env.BSC_MAINNET_RPC || 'https://bsc-dataseed.binance.org',
        bez: process.env.BEZCOIN_BSC_ADDRESS || '0x8a1e3930fde1f151471c368fdbb39f3f63a65b55',
    },
};

// Treasury that receives BEZ payments (DAO treasury by default; see CLAUDE.md).
const TREASURY = (process.env.TREASURY_WALLET || '0x89c23890c742d710265dD61be789C71dC8999b12').toLowerCase();

const pad32 = (addr) => '0x' + addr.toLowerCase().replace('0x', '').padStart(64, '0');
const addrFromTopic = (topic) => ('0x' + topic.slice(26)).toLowerCase();

async function getBezPriceUSD() {
    const price = await query(
        "SELECT price_usd FROM token_price_cache WHERE symbol = 'BEZ' LIMIT 1"
    ).catch(() => ({ rows: [] }));
    return parseFloat(price.rows[0]?.price_usd || '0.10');
}

/** Oldest pending crypto/qr buy order of this sender that the amount covers. */
async function matchOrder(sender, amountBez, priceUSD) {
    const { rows } = await query(
        `SELECT id, amount_usd, platform_fee_usd
         FROM payment_transactions
         WHERE type = 'buy' AND status = 'pending'
           AND payment_method IN ('crypto', 'qr')
           AND LOWER(wallet_address) = $1
         ORDER BY created_at ASC
         LIMIT 20`,
        [sender]
    );
    for (const order of rows) {
        const netUSD = Math.max(parseFloat(order.amount_usd || '0') - parseFloat(order.platform_fee_usd || '0'), 0);
        if (priceUSD <= 0 || netUSD <= 0) continue;
        const expectedBez = netUSD / priceUSD;
        if (amountBez >= expectedBez * (1 - TOLERANCE)) return order;
    }
    return null;
}

async function txAlreadyUsed(txHash) {
    const { rows } = await query(
        "SELECT 1 FROM payment_transactions WHERE tx_hash = $1 AND type = 'buy' LIMIT 1",
        [txHash]
    );
    return rows.length > 0;
}

async function getCursor(chainId) {
    const { rows } = await query(
        'SELECT last_block FROM settlement_watcher_cursor WHERE chain_id = $1',
        [chainId]
    );
    return rows.length > 0 ? Number(rows[0].last_block) : null;
}

async function setCursor(chainId, block) {
    await query(
        `INSERT INTO settlement_watcher_cursor (chain_id, last_block)
         VALUES ($1, $2)
         ON CONFLICT (chain_id) DO UPDATE SET last_block = $2, updated_at = NOW()`,
        [chainId, block]
    );
}

/**
 * One scan pass for a chain. Injectable provider for tests.
 * @returns {{ scanned: [number, number]|null, settled: number, skipped: number }}
 */
async function scanOnce(chainId = 137, provider = null) {
    const chain = CHAINS[chainId];
    if (!chain) throw new Error(`Unsupported chain for settlement watcher: ${chainId}`);
    provider = provider || new ethers.JsonRpcProvider(chain.rpc);

    const head = await provider.getBlockNumber();
    const safeHead = head - CONFIRMATIONS;
    let from = await getCursor(chainId);
    from = from === null ? Math.max(safeHead - LOOKBACK_BLOCKS, 0) : from + 1;
    const to = Math.min(safeHead, from + MAX_RANGE);
    if (to < from) return { scanned: null, settled: 0, skipped: 0 };

    const logs = await provider.getLogs({
        address: chain.bez,
        topics: [TRANSFER_TOPIC, null, pad32(TREASURY)],
        fromBlock: from,
        toBlock: to,
    });

    let settled = 0;
    let skipped = 0;
    const priceUSD = await getBezPriceUSD();

    for (const log of logs) {
        const txHash = log.transactionHash;
        const sender = addrFromTopic(log.topics[1]);
        const amountBez = parseFloat(ethers.formatUnits(BigInt(log.data), 18));

        if (await txAlreadyUsed(txHash)) { skipped += 1; continue; }
        const order = await matchOrder(sender, amountBez, priceUSD);
        if (!order) { skipped += 1; continue; }

        try {
            await settlePayment({
                paymentId: order.id,
                status: 'completed',
                providerReference: `onchain-watcher:${chainId}`,
                txHash,
            });
            settled += 1;
            logger.info({ chainId, txHash, sender, amountBez, paymentId: order.id }, 'Order auto-settled from chain');
        } catch (err) {
            // ALREADY_COMPLETED = raced with a manual settle → fine, skip.
            if (err.code !== 'ALREADY_COMPLETED') {
                logger.error({ err: err.message, txHash, paymentId: order.id }, 'Auto-settle failed');
            }
            skipped += 1;
        }
    }

    await setCursor(chainId, to);
    return { scanned: [from, to], settled, skipped };
}

let _timer = null;

/** Start the polling loop (idempotent). Gate with PAYMENTS_WATCHER_ENABLED. */
function startWatcher({ chainId = 137, intervalMs = 30_000 } = {}) {
    if (_timer) return _timer;
    _timer = setInterval(() => {
        scanOnce(chainId).catch((err) => logger.error({ err: err.message, chainId }, 'Watcher tick failed'));
        // Same cadence: park pending orders past their TTL so stale intents
        // stop matching fresh transfers.
        expireStaleOrders().catch((err) => logger.error({ err: err.message }, 'Expiry sweep failed'));
    }, intervalMs);
    _timer.unref?.();
    logger.info({ chainId, intervalMs, treasury: TREASURY }, 'BEZ settlement watcher started');
    return _timer;
}

function stopWatcher() {
    if (_timer) { clearInterval(_timer); _timer = null; }
}

module.exports = { scanOnce, matchOrder, startWatcher, stopWatcher, TREASURY, CHAINS };
