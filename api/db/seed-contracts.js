/**
 * seed-contracts.js — Populate contract_addresses table from deployment JSON.
 *
 * Usage:
 *   node db/seed-contracts.js [chainId]
 *
 * Reads: smart-contracts/deployments/<chainId>.json
 * Writes: contract_addresses table (UPSERT on chain_id + name)
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env') });
const fs = require('fs');
const path = require('path');
const { pool, query } = require('./pool');

const DEPLOYER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

async function seedContracts(chainId = 31337) {
    const deploymentsPath = path.resolve(
        __dirname, '..', '..', 'smart-contracts', 'deployments', `${chainId}.json`
    );

    if (!fs.existsSync(deploymentsPath)) {
        console.error(`[SEED-CONTRACTS] Deployment file not found: ${deploymentsPath}`);
        process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
    let count = 0;

    // ── Core contracts ──
    for (const [name, address] of Object.entries(data.core || {})) {
        await query(`
            INSERT INTO contract_addresses (chain_id, name, category, address, deployer)
            VALUES ($1, $2, 'core', $3, $4)
            ON CONFLICT (chain_id, name) DO UPDATE SET address = EXCLUDED.address, deployed_at = NOW()
        `, [chainId, name, address, DEPLOYER]);
        count++;
    }

    // ── Sector contracts ──
    for (const [sector, contracts] of Object.entries(data.sectors || {})) {
        for (const [name, address] of Object.entries(contracts)) {
            await query(`
                INSERT INTO contract_addresses (chain_id, name, category, address, deployer)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (chain_id, name) DO UPDATE SET address = EXCLUDED.address, deployed_at = NOW()
            `, [chainId, name, sector, address, DEPLOYER]);
            count++;
        }
    }

    console.log(`[SEED-CONTRACTS] Inserted/updated ${count} contract addresses for chain ${chainId}.`);
}

const chainId = parseInt(process.argv[2] || '31337', 10);
seedContracts(chainId)
    .catch(err => { console.error('[SEED-CONTRACTS] Error:', err.message); process.exit(1); })
    .finally(() => pool.end());
