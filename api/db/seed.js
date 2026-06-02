/**
 * seed.js — Populate the database with initial data for development.
 *
 * Usage:
 *   node db/seed.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env') });
const { pool, query } = require('./pool');

async function seed() {
    console.log('[SEED] Starting database seed...');

    // ── Admin user (deployer) ──
    await query(`
        INSERT INTO users (wallet_address, username, email, role)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (wallet_address) DO NOTHING
    `, ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 'admin', 'admin@bezhas.io', 'admin']);

    // ── Edge node user ──
    await query(`
        INSERT INTO users (wallet_address, username, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (wallet_address) DO NOTHING
    `, ['0x70997970C51812dc3A010C7d01b50e0d17dc79C8', 'edge-node-1', 'edge_node']);

    // ── Demo enterprises ──
    const enterprises = [
        { name: 'BeZhas Logistics Corp', sector: 'supplychain', tier: 'enterprise' },
        { name: 'GreenFarm Costa Rica', sector: 'agriculture', tier: 'professional' },
        { name: 'MediTrack SA', sector: 'health', tier: 'professional' },
        { name: 'EcoEnergy Panamá', sector: 'energy', tier: 'enterprise' },
        { name: 'AutoParts Centroamérica', sector: 'automotive', tier: 'basic' },
    ];

    const { rows: adminRows } = await query(
        `SELECT id FROM users WHERE wallet_address = $1`,
        ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266']
    );
    const adminId = adminRows[0]?.id;

    for (const ent of enterprises) {
        await query(`
            INSERT INTO enterprises (user_id, name, sector, tier, is_active)
            VALUES ($1, $2, $3, $4, true)
            ON CONFLICT DO NOTHING
        `, [adminId, ent.name, ent.sector, ent.tier]);
    }

    // ── Core contract addresses (Anvil defaults — will be overwritten by real deploy) ──
    const coreContracts = [
        { name: 'BEZCoinV2', category: 'core', address: '0x5FbDB2315678afecb367f032d93F642f64180aa3' },
        { name: 'BeZhasLogisticsNFT', category: 'core', address: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512' },
        { name: 'QualityEscrow', category: 'core', address: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0' },
        { name: 'BeZhasBridgeL2', category: 'core', address: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9' },
        { name: 'StakingPool', category: 'core', address: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9' },
        { name: 'LiquidityFarming', category: 'core', address: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707' },
    ];

    for (const c of coreContracts) {
        await query(`
            INSERT INTO contract_addresses (chain_id, name, category, address, deployer)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (chain_id, name) DO UPDATE SET address = EXCLUDED.address
        `, [31337, c.name, c.category, c.address, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266']);
    }

    // ── Sample daily analytics ──
    const today = new Date().toISOString().split('T')[0];
    await query(`
        INSERT INTO daily_analytics (date, total_transactions, total_volume_bez, active_users, active_enterprises, new_nfts_minted, telemetry_events, ai_actions)
        VALUES ($1, 1250, 45000.5, 89, 5, 23, 340, 156)
        ON CONFLICT (date) DO NOTHING
    `, [today]);

    console.log('[SEED] Database seeded successfully.');
    console.log('[SEED] - 2 users (admin + edge_node)');
    console.log('[SEED] - 5 enterprises');
    console.log('[SEED] - 6 core contract addresses');
    console.log('[SEED] - 1 daily analytics entry');
}

seed()
    .catch(err => { console.error('[SEED] Error:', err.message); process.exit(1); })
    .finally(() => pool.end());
