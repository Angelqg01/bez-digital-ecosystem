'use strict';

const { query } = require('./db');
const sdkBridge = require('./sdk-bridge');

// ── Bundled core ABIs (subset — most common enterprise contracts) ──
const BUNDLED_ABIS = {
    BEZCoinV2: {
        events: [
            'event Transfer(address indexed from, address indexed to, uint256 value)',
            'event Approval(address indexed owner, address indexed spender, uint256 value)',
        ],
    },
    BeZhasQualityEscrow: {
        events: [
            'event ShipmentCreated(uint256 indexed shipmentId, address indexed sender, address indexed receiver)',
            'event ShipmentValidated(uint256 indexed shipmentId, bool passed)',
            'event ShipmentCompleted(uint256 indexed shipmentId)',
        ],
    },
    StakingPool: {
        events: [
            'event Staked(address indexed user, uint256 amount)',
            'event Unstaked(address indexed user, uint256 amount)',
            'event RewardsClaimed(address indexed user, uint256 amount)',
        ],
    },
    ValidatorRegistry: {
        events: [
            'event ValidatorRegistered(address indexed operator, uint256 stake)',
            'event ValidatorDeactivated(address indexed operator)',
            'event HeartbeatReceived(address indexed operator, uint256 timestamp)',
        ],
    },
    EdgeNodeRewards: {
        events: [
            'event RewardDistributed(address indexed node, uint256 amount)',
            'event PointsRecorded(address indexed node, uint256 points)',
        ],
    },
};

/**
 * Sync ABIs from the BeZhas platform API (if configured),
 * otherwise persist bundled ABIs into the local registry.
 */
async function syncAbis() {
    const platformApi = process.env.BEZHAS_PLATFORM_API;
    const apiKey = process.env.BEZHAS_PLATFORM_API_KEY;

    if (platformApi && apiKey) {
        try {
            const url = new URL('/api/contracts/abis', platformApi);
            const resp = await fetch(url.toString(), {
                headers: { 'Authorization': `Bearer ${apiKey}` },
                signal: AbortSignal.timeout(10000),
            });
            if (resp.ok) {
                const { contracts } = await resp.json();
                for (const [name, info] of Object.entries(contracts || {})) {
                    await upsertAbi(name, info.abi, info.address);
                }
                console.log(`[ABI-Sync] Synced ${Object.keys(contracts || {}).length} ABIs from platform`);
                return;
            }
            console.warn(`[ABI-Sync] Platform responded ${resp.status}, falling back to bundled ABIs`);
        } catch (err) {
            console.warn(`[ABI-Sync] Platform unreachable (${err.message}), using bundled ABIs`);
        }
    }

    // Fallback: persist bundled ABIs
    const addresses = getSdkAddresses();
    for (const [name, info] of Object.entries(BUNDLED_ABIS)) {
        await upsertAbi(name, info.events || [], addresses[name] || null);
    }
    console.log(`[ABI-Sync] Loaded ${Object.keys(BUNDLED_ABIS).length} bundled ABIs`);
}

function getSdkAddresses() {
    try {
        const contracts = sdkBridge.getContractsForFrontend();
        const result = {};
        for (const [name, info] of Object.entries(contracts.contracts || {})) {
            if (info.address) result[name] = info.address;
        }
        return result;
    } catch {
        return {};
    }
}

async function upsertAbi(contractName, abi, address) {
    const chainId = parseInt(process.env.CHAIN_ID || '2708', 10);
    await query(
        `INSERT INTO abi_registry (contract_name, abi, address, chain_id, synced_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (contract_name) DO UPDATE SET
       abi = EXCLUDED.abi,
       address = EXCLUDED.address,
       synced_at = NOW()`,
        [contractName, JSON.stringify(abi), address, chainId]
    );
}

async function getRegisteredAbis() {
    const { rows } = await query('SELECT contract_name, abi, address, chain_id, synced_at FROM abi_registry');
    return rows;
}

module.exports = { syncAbis, getRegisteredAbis, BUNDLED_ABIS };
