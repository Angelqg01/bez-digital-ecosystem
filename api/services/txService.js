/**
 * txService.js — Transaction submit, watch, and record service.
 */
const { ethers } = require('ethers');
const { getProvider, getSigner } = require('./contractService');
const { query } = require('../db/pool');
const { publish, cacheSet } = require('../cache/redis');

/**
 * Record a transaction (from event listener or API action) into PostgreSQL.
 */
async function recordTx({ txHash, fromAddress, toAddress, value, contract, method, status, chainId, blockNumber, gasUsed }) {
    const { rows } = await query(
        `INSERT INTO transactions (tx_hash, from_address, to_address, value_wei, contract_name, method_name, status, chain_id, block_number, gas_used)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (tx_hash) DO UPDATE SET status = $7, block_number = $9, gas_used = $10
         RETURNING *`,
        [txHash, fromAddress, toAddress, value || '0', contract || null, method || null, status || 'confirmed', chainId, blockNumber, gasUsed || null]
    );
    return rows[0];
}

/**
 * Wait for a tx receipt, record it, and push via Redis pub/sub.
 */
async function watchTx(txHash, meta = {}) {
    const p = getProvider();
    const receipt = await p.waitForTransaction(txHash, 1, 120000); // 1 confirmation, 120s timeout

    const record = await recordTx({
        txHash: receipt.hash,
        fromAddress: receipt.from,
        toAddress: receipt.to,
        value: meta.value || '0',
        contract: meta.contract || null,
        method: meta.method || null,
        status: receipt.status === 1 ? 'confirmed' : 'failed',
        chainId: Number(receipt.chainId || process.env.BEZHAS_CHAIN_ID || 31337),
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
    });

    await publish('tx:confirmed', record);
    return record;
}

/**
 * Send native BEZ from the treasury signer.
 */
async function sendBEZ(toAddress, amountEther, meta = {}) {
    const s = getSigner();
    const tx = await s.sendTransaction({
        to: toAddress,
        value: ethers.parseEther(amountEther.toString()),
    });

    const record = await watchTx(tx.hash, {
        value: amountEther.toString(),
        contract: 'NativeTransfer',
        method: 'sendBEZ',
        ...meta,
    });

    return record;
}

/**
 * Get recent transactions from DB with pagination.
 */
async function getRecentTxs({ page = 1, limit = 20, address, contract }) {
    const conditions = [];
    const params = [];
    let idx = 1;

    if (address) {
        conditions.push(`(from_address = $${idx} OR to_address = $${idx})`);
        params.push(address);
        idx++;
    }
    if (contract) {
        conditions.push(`contract_name = $${idx}`);
        params.push(contract);
        idx++;
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const offset = (page - 1) * limit;

    const countRes = await query(`SELECT COUNT(*) FROM transactions ${where}`, params);
    const total = parseInt(countRes.rows[0].count);

    params.push(limit, offset);
    const { rows } = await query(
        `SELECT * FROM transactions ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        params
    );

    return { transactions: rows, total, page, pages: Math.ceil(total / limit) };
}

/**
 * Get a single transaction by hash.
 */
async function getTxByHash(txHash) {
    const { rows } = await query('SELECT * FROM transactions WHERE tx_hash = $1', [txHash]);
    if (rows.length === 0) {
        // Try fetching from chain
        const p = getProvider();
        const receipt = await p.getTransactionReceipt(txHash);
        if (!receipt) return null;

        return recordTx({
            txHash: receipt.hash,
            fromAddress: receipt.from,
            toAddress: receipt.to,
            value: '0',
            status: receipt.status === 1 ? 'confirmed' : 'failed',
            chainId: Number(receipt.chainId || process.env.BEZHAS_CHAIN_ID || 31337),
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString(),
        });
    }
    return rows[0];
}

module.exports = { recordTx, watchTx, sendBEZ, getRecentTxs, getTxByHash };
