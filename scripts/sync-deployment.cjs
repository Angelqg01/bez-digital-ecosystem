#!/usr/bin/env node
/**
 * sync-deployment.cjs — Synchronize deployment addresses from DeployAll output.
 * 
 * Updates smart-contracts/deployments/31337.json to include:
 *   - validation contracts (ValidatorRegistry, EdgeNodeRewards, etc.)
 *   - delivery escrow
 *   - wallet contracts (placeholder addresses for factory-deployed wallets)
 *   - BeZhasDEX (already deployed but missing from some categories)
 * 
 * Also adds a "contracts_with_abi" field listing all contracts that have ABIs
 * available, enabling SubApps to discover which contracts they can interact with.
 * 
 * Usage: node scripts/sync-deployment.cjs
 */

const fs = require('fs');
const path = require('path');

const DEPLOYMENTS_FILE = path.resolve(__dirname, '..', 'smart-contracts', 'deployments', '31337.json');
const ABI_DIR = path.resolve(__dirname, '..', 'smart-contracts', 'abi');
const MANIFEST_FILE = path.join(ABI_DIR, 'manifest.json');

console.log('\n🔄 Syncing deployment addresses...\n');

// Load current deployments
let deployments;
try {
    deployments = JSON.parse(fs.readFileSync(DEPLOYMENTS_FILE, 'utf-8'));
} catch (err) {
    console.error('❌ Cannot read deployment file:', err.message);
    process.exit(1);
}

// Track changes
const changes = [];

// ── 1. Add validation contracts to core (from DeployAll output) ──
// These were deployed by DeployAll but parse-deployment.js didn't capture them
const validationContracts = {
    ValidatorRegistry: null,
    EdgeNodeRewards: null,
    SequencerRotation: null,
    SlashingManager: null,
    DeliveryEscrow: null,
};

// Check what's already in core
for (const name of Object.keys(validationContracts)) {
    if (deployments.core?.[name]) {
        console.log(`  ✓ ${name} already in core: ${deployments.core[name]}`);
    } else {
        // Check if it's somewhere else in the tree (sectors, etc.)
        let found = false;
        for (const [sector, contracts] of Object.entries(deployments.sectors || {})) {
            if (contracts[name]) {
                console.log(`  ↗ ${name} found in sector '${sector}', moving to core`);
                deployments.core[name] = contracts[name];
                delete contracts[name];
                found = true;
                changes.push(`Moved ${name} from ${sector} to core`);
                break;
            }
        }
        if (!found) {
            console.log(`  ⚠️  ${name} NOT FOUND in deployments (needs re-deploy to capture address)`);
            changes.push(`${name} needs re-deploy`);
        }
    }
}

// ── 2. Add wallet section (factory-based, addresses set at runtime) ──
if (!deployments.wallet) {
    deployments.wallet = {
        _note: 'Wallet contracts are deployed via SmartWalletFactory. Addresses below are from the factory deploy.',
        SmartWalletFactory: null,
        Paymaster: null,
        SecurityModule: null,
        WalletGuardian: null,
        MultiSigWallet: null,
    };
    changes.push('Added wallet section (addresses TBD on next deploy)');
    console.log('  + Added wallet section placeholder');
}

// ── 3. Ensure BeZhasDEX is in core ──
if (!deployments.core.BeZhasDEX && deployments.core.BeZhasDEX !== undefined) {
    // Check the existing value
} else if (!deployments.core.BeZhasDEX) {
    deployments.core.BeZhasDEX = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
    changes.push('Added BeZhasDEX to core');
    console.log('  + BeZhasDEX added to core');
} else {
    console.log(`  ✓ BeZhasDEX in core: ${deployments.core.BeZhasDEX}`);
}

// ── 4. Add contracts_with_abi metadata ──
let manifest;
try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'));
} catch {
    manifest = { contracts: {} };
}

deployments.abi_manifest = {
    total_abis: Object.keys(manifest.contracts || {}).length,
    sectors: {},
};

for (const [name, info] of Object.entries(manifest.contracts || {})) {
    const sector = info.sector;
    if (!deployments.abi_manifest.sectors[sector]) {
        deployments.abi_manifest.sectors[sector] = [];
    }
    deployments.abi_manifest.sectors[sector].push(name);
}

changes.push(`Added abi_manifest with ${Object.keys(manifest.contracts || {}).length} contracts`);

// ── 5. Update timestamp ──
deployments.timestamp = new Date().toISOString();
deployments.lastSync = 'sync-deployment.cjs';

// ── Write ──
fs.writeFileSync(DEPLOYMENTS_FILE, JSON.stringify(deployments, null, 2) + '\n');

console.log(`\n═══════════════════════════════════════`);
console.log(`📊 Changes applied: ${changes.length}`);
changes.forEach(c => console.log(`   • ${c}`));

// Count totals
const coreCount = Object.keys(deployments.core || {}).filter(k => deployments.core[k] && typeof deployments.core[k] === 'string').length;
const sectorCount = Object.values(deployments.sectors || {}).reduce((s, sec) => s + Object.keys(sec).length, 0);
const walletCount = Object.keys(deployments.wallet || {}).filter(k => k !== '_note' && deployments.wallet[k]).length;

console.log(`\n📦 Deployment summary:`);
console.log(`   Core contracts:     ${coreCount}`);
console.log(`   Sector contracts:   ${sectorCount}`);
console.log(`   Wallet contracts:   ${walletCount}`);
console.log(`   Total addresses:    ${coreCount + sectorCount + walletCount}`);
console.log(`   ABIs available:     ${deployments.abi_manifest.total_abis}`);
console.log(`\n✨ Done!\n`);
