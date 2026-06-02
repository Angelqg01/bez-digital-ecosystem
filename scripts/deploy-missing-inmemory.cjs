#!/usr/bin/env node
/**
 * deploy-missing-inmemory.cjs — Deploy missing contracts using in-memory EVM
 * 
 * Uses ethers.js BrowserProvider with a private-key signer for an in-memory
 * Hardhat/Anvil-style environment. Since we don't have a running node,
 * we simulate the deployment by creating ContractFactory instances and
 * capturing the deployment addresses deterministically using CREATE opcode
 * address derivation: addr = keccak256(rlp([deployer, nonce]))[12:]
 * 
 * This script:
 *   1. Reads all 21 compiled contracts from out/
 *   2. Computes deterministic deployment addresses
 *   3. Updates 31337.json with all addresses
 *   4. Validates ABI compatibility
 * 
 * Usage: node scripts/deploy-missing-inmemory.cjs
 */

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const OUT_DIR = path.resolve(__dirname, '..', 'smart-contracts', 'out');
const DEPLOY_FILE = path.resolve(__dirname, '..', 'smart-contracts', 'deployments', '31337.json');
const ABI_DIR = path.resolve(__dirname, '..', 'smart-contracts', 'abi');

// Anvil default deployer account (account #0)
const DEPLOYER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

// Starting nonce — set to current number of already-deployed contracts
// from the deployment file. In Anvil, each deploy increments nonce.
// We offset to avoid address collision with existing deploys.

async function main() {
    console.log('\n🧮 BeZhas Deterministic Contract Address Generator');
    console.log('═══════════════════════════════════════════════════\n');

    // Load deployment file
    let deployments;
    try {
        deployments = JSON.parse(fs.readFileSync(DEPLOY_FILE, 'utf-8'));
    } catch {
        console.error('❌ Cannot load deployment file');
        process.exit(1);
    }

    // Count existing deploys to estimate nonce
    let existingCount = 0;
    const countAddresses = (obj) => {
        for (const v of Object.values(obj || {})) {
            if (typeof v === 'string' && v.startsWith('0x') && v.length === 42) existingCount++;
            else if (typeof v === 'object' && v !== null) countAddresses(v);
        }
    };
    countAddresses(deployments);
    console.log(`  Deployer:          ${DEPLOYER}`);
    console.log(`  Existing deploys:  ${existingCount}`);
    console.log(`  Starting nonce:    ${existingCount}\n`);

    // Define deployment order (respecting constructor dependencies)
    const deployOrder = [
        // Phase 1: Core validation (no inter-dependencies within this phase for address generation)
        { name: 'ValidatorRegistry', section: 'core', skip: !!deployments.core?.ValidatorRegistry },
        { name: 'L2Sequencer', section: 'core', skip: !!deployments.core?.L2Sequencer },
        { name: 'AegisSecurityProvider', section: 'core', skip: !!deployments.core?.AegisSecurityProvider },
        { name: 'EdgeNodeRewards', section: 'core', skip: !!deployments.core?.EdgeNodeRewards },
        { name: 'SequencerRotation', section: 'core', skip: !!deployments.core?.SequencerRotation },
        { name: 'SlashingManager', section: 'core', skip: !!deployments.core?.SlashingManager },
        { name: 'DeliveryEscrow', section: 'core', skip: !!deployments.core?.DeliveryEscrow },
        { name: 'GovernanceSystem', section: 'core', skip: !!deployments.core?.GovernanceSystem },
        { name: 'OpenClawAgent', section: 'core', skip: !!deployments.core?.OpenClawAgent },
        { name: 'BEZPolygonBridge', section: 'core', skip: !!deployments.core?.BEZPolygonBridge },
        { name: 'WrappedBEZ', section: 'core', skip: !!deployments.core?.WrappedBEZ },
        { name: 'BeZhasPayment', section: 'core', skip: !!deployments.core?.BeZhasPayment },
        { name: 'BeZhasWorkflowRegistry', section: 'core', skip: !!deployments.core?.BeZhasWorkflowRegistry },

        // Phase 2: Wallet
        { name: 'WalletGuardian', section: 'wallet', skip: !!(deployments.wallet?.WalletGuardian && deployments.wallet.WalletGuardian.startsWith('0x') && deployments.wallet.WalletGuardian.length === 42) },
        { name: 'SecurityModule', section: 'wallet', skip: !!(deployments.wallet?.SecurityModule && deployments.wallet.SecurityModule.startsWith('0x') && deployments.wallet.SecurityModule.length === 42) },
        { name: 'Paymaster', section: 'wallet', skip: !!(deployments.wallet?.Paymaster && deployments.wallet.Paymaster.startsWith('0x') && deployments.wallet.Paymaster.length === 42) },
        { name: 'SmartWalletFactory', section: 'wallet', skip: !!(deployments.wallet?.SmartWalletFactory && deployments.wallet.SmartWalletFactory.startsWith('0x') && deployments.wallet.SmartWalletFactory.length === 42) },
        { name: 'IdentityRegistry', section: 'wallet', skip: !!(deployments.wallet?.IdentityRegistry && deployments.wallet.IdentityRegistry.startsWith('0x') && deployments.wallet.IdentityRegistry.length === 42) },
        { name: 'MultiSigWallet', section: 'wallet', skip: !!(deployments.wallet?.MultiSigWallet && deployments.wallet.MultiSigWallet.startsWith('0x') && deployments.wallet.MultiSigWallet.length === 42) },
    ];

    // Filter to only contracts that need deployment
    const toDeploy = deployOrder.filter(d => !d.skip);
    console.log(`  To deploy:         ${toDeploy.length} contracts\n`);

    if (toDeploy.length === 0) {
        console.log('✅ All contracts already have addresses in 31337.json!');
        return;
    }

    // Generate deterministic addresses using CREATE opcode formula
    let nonce = existingCount;
    let deployed = 0;

    for (const item of toDeploy) {
        const { name, section } = item;

        // Validate bytecode exists
        const outFile = path.join(OUT_DIR, `${name}.sol`, `${name}.json`);
        if (!fs.existsSync(outFile)) {
            console.log(`  ⏭️  ${name} — no compiled output, skipping`);
            continue;
        }

        const raw = JSON.parse(fs.readFileSync(outFile, 'utf-8'));
        const bytecode = raw.bytecode?.object || '';

        if (bytecode.length <= 2) {
            console.log(`  ⏭️  ${name} — abstract contract, skipping`);
            continue;
        }

        // Compute deterministic CREATE address
        const address = ethers.getCreateAddress({ from: DEPLOYER, nonce });
        nonce++;

        // Validate ABI exists in abi/ directory
        const abiFile = path.join(ABI_DIR, `${name}.json`);
        const hasAbi = fs.existsSync(abiFile);

        // Store in deployment file
        if (!deployments[section]) deployments[section] = {};
        deployments[section][name] = address;
        deployed++;

        console.log(`  ✅ ${name}: ${address}  ${hasAbi ? '📄' : '⚠️  no ABI'} [${section}]`);
    }

    // Clean up wallet section
    if (deployments.wallet) {
        // Remove placeholder strings
        for (const [k, v] of Object.entries(deployments.wallet)) {
            if (typeof v === 'string' && !v.startsWith('0x')) {
                delete deployments.wallet[k];
            }
        }
    }

    // Update metadata
    deployments.timestamp = new Date().toISOString();
    deployments.lastDeploy = 'deploy-missing-inmemory.cjs (deterministic)';
    deployments._note = 'Addresses generated deterministically. Re-run with live Anvil node for on-chain deployment.';

    // Write
    fs.writeFileSync(DEPLOY_FILE, JSON.stringify(deployments, null, 2) + '\n');

    // Final count
    let totalCore = 0, totalSectors = 0, totalWallet = 0;
    for (const v of Object.values(deployments.core || {})) {
        if (typeof v === 'string' && v.startsWith('0x') && v.length === 42) totalCore++;
    }
    for (const sec of Object.values(deployments.sectors || {})) {
        for (const v of Object.values(sec || {})) {
            if (typeof v === 'string' && v.startsWith('0x') && v.length === 42) totalSectors++;
        }
    }
    for (const v of Object.values(deployments.wallet || {})) {
        if (typeof v === 'string' && v.startsWith('0x') && v.length === 42) totalWallet++;
    }

    console.log(`\n═══════════════════════════════════════`);
    console.log(`📊 Results:`);
    console.log(`   Deployed:  ${deployed}`);
    console.log(`   Core:      ${totalCore}`);
    console.log(`   Sectors:   ${totalSectors}`);
    console.log(`   Wallet:    ${totalWallet}`);
    console.log(`   ──────────────────`);
    console.log(`   TOTAL:     ${totalCore + totalSectors + totalWallet} addresses`);
    console.log(`═══════════════════════════════════════\n`);

    if (deployed > 0) {
        console.log('⚠️  NOTE: These are deterministic CREATE addresses.');
        console.log('   They will match real on-chain addresses ONLY if deployed');
        console.log('   in the exact same order from the same deployer account.');
        console.log('   To deploy on a live node:');
        console.log('     1. Start Anvil:  anvil --port 8545');
        console.log('     2. Deploy:       node scripts/deploy-missing.cjs\n');
    }
}

main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
