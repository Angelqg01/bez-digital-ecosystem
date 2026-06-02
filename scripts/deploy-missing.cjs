#!/usr/bin/env node
/**
 * deploy-missing.cjs — Deploy missing contracts to Anvil using ethers.js
 * 
 * Reads compiled bytecode from Foundry out/ and deploys via JSON-RPC.
 * Updates smart-contracts/deployments/31337.json with new addresses.
 * 
 * Requires: Anvil running on localhost:8545
 * Usage:    node scripts/deploy-missing.cjs
 */

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const OUT_DIR = path.resolve(__dirname, '..', 'smart-contracts', 'out');
const DEPLOY_FILE = path.resolve(__dirname, '..', 'smart-contracts', 'deployments', '31337.json');
const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';

// Anvil default deployer
const DEPLOYER_PK = process.env.DEPLOYER_PK || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const MULTISIG = process.env.MULTISIG || null; // Will be set to deployer if null

async function main() {
    console.log('\n🚀 BeZhas Missing Contracts Deployment');
    console.log('═══════════════════════════════════════\n');

    // Connect
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(DEPLOYER_PK, provider);
    const deployer = wallet.address;
    const multisig = MULTISIG || deployer;

    console.log(`  RPC:       ${RPC_URL}`);
    console.log(`  Deployer:  ${deployer}`);
    console.log(`  Multisig:  ${multisig}`);

    // Check connectivity
    try {
        const block = await provider.getBlockNumber();
        const network = await provider.getNetwork();
        console.log(`  Chain ID:  ${network.chainId}`);
        console.log(`  Block:     ${block}\n`);
    } catch (err) {
        console.error('❌ Cannot connect to RPC:', err.message);
        console.error('   Make sure Anvil is running: anvil --port 8545');
        process.exit(1);
    }

    // Load deployment file
    let deployments;
    try {
        deployments = JSON.parse(fs.readFileSync(DEPLOY_FILE, 'utf-8'));
    } catch {
        deployments = { chainId: 31337, core: {}, sectors: {}, wallet: {} };
    }

    // Get existing addresses
    const existingAddresses = new Set();
    const addExisting = (obj) => {
        for (const v of Object.values(obj || {})) {
            if (typeof v === 'string' && v.startsWith('0x')) existingAddresses.add(v);
            else if (typeof v === 'object' && v !== null) addExisting(v);
        }
    };
    addExisting(deployments);

    // Helper: load contract from Foundry output
    function loadContract(name) {
        const p = path.join(OUT_DIR, `${name}.sol`, `${name}.json`);
        if (!fs.existsSync(p)) return null;
        const raw = JSON.parse(fs.readFileSync(p, 'utf-8'));
        return { abi: raw.abi || [], bytecode: raw.bytecode?.object || '' };
    }

    // Helper: deploy a contract
    async function deploy(name, args = []) {
        const contract = loadContract(name);
        if (!contract || contract.bytecode.length <= 2) {
            console.log(`  ⏭️  ${name} — no bytecode (abstract/interface)`);
            return null;
        }

        try {
            const factory = new ethers.ContractFactory(contract.abi, contract.bytecode, wallet);
            console.log(`  📦 Deploying ${name}...`);
            const deployed = await factory.deploy(...args);
            await deployed.waitForDeployment();
            const address = await deployed.getAddress();
            console.log(`  ✅ ${name}: ${address}`);
            return address;
        } catch (err) {
            console.log(`  ❌ ${name} failed: ${err.message.slice(0, 120)}`);
            return null;
        }
    }

    // Track results
    const results = {};
    let deployed = 0;
    let failed = 0;

    // ═══════════════════════════════════════════════════════════
    //  CORE: Get BEZCoinV2 address for constructor dependencies
    // ═══════════════════════════════════════════════════════════
    const bezToken = deployments.core?.BEZCoinV2;
    if (!bezToken) {
        console.error('❌ BEZCoinV2 not found in deployments. Core contracts need it.');
        process.exit(1);
    }
    console.log(`  BEZCoinV2: ${bezToken} (dependency)\n`);

    // ═══════════════════════════════════════════════════════════
    //  PHASE 1: Validation/Consensus Contracts
    // ═══════════════════════════════════════════════════════════
    console.log('── Phase 1: Validation & Consensus ──');

    // ValidatorRegistry(address _bezToken, address defaultAdmin)
    if (!deployments.core?.ValidatorRegistry) {
        const addr = await deploy('ValidatorRegistry', [bezToken, multisig]);
        if (addr) { results.ValidatorRegistry = addr; deployments.core.ValidatorRegistry = addr; deployed++; }
        else failed++;
    } else console.log(`  ✓ ValidatorRegistry already deployed: ${deployments.core.ValidatorRegistry}`);

    const validatorReg = deployments.core?.ValidatorRegistry;

    // EdgeNodeRewards(address _bezToken, address _validatorRegistry, address defaultAdmin)
    if (!deployments.core?.EdgeNodeRewards && validatorReg) {
        const addr = await deploy('EdgeNodeRewards', [bezToken, validatorReg, multisig]);
        if (addr) { results.EdgeNodeRewards = addr; deployments.core.EdgeNodeRewards = addr; deployed++; }
        else failed++;
    } else console.log(`  ✓ EdgeNodeRewards already deployed`);

    // SequencerRotation(address _validatorRegistry, address defaultAdmin)
    if (!deployments.core?.SequencerRotation && validatorReg) {
        const addr = await deploy('SequencerRotation', [validatorReg, multisig]);
        if (addr) { results.SequencerRotation = addr; deployments.core.SequencerRotation = addr; deployed++; }
        else failed++;
    } else console.log(`  ✓ SequencerRotation already deployed`);

    // SlashingManager(address _validatorRegistry, address defaultAdmin)
    if (!deployments.core?.SlashingManager && validatorReg) {
        const addr = await deploy('SlashingManager', [validatorReg, multisig]);
        if (addr) { results.SlashingManager = addr; deployments.core.SlashingManager = addr; deployed++; }
        else failed++;
    } else console.log(`  ✓ SlashingManager already deployed`);

    // DeliveryEscrow(address _bezToken, address _treasury, uint16 _feeBps, address _admin)
    if (!deployments.core?.DeliveryEscrow) {
        const addr = await deploy('DeliveryEscrow', [bezToken, multisig, 250, multisig]);
        if (addr) { results.DeliveryEscrow = addr; deployments.core.DeliveryEscrow = addr; deployed++; }
        else failed++;
    } else console.log(`  ✓ DeliveryEscrow already deployed`);

    // L2Sequencer(address defaultAdmin)
    if (!deployments.core?.L2Sequencer) {
        const addr = await deploy('L2Sequencer', [multisig]);
        if (addr) { results.L2Sequencer = addr; deployments.core.L2Sequencer = addr; deployed++; }
        else failed++;
    } else console.log(`  ✓ L2Sequencer already deployed`);

    // AegisSecurityProvider(address defaultAdmin)
    if (!deployments.core?.AegisSecurityProvider) {
        const addr = await deploy('AegisSecurityProvider', [multisig]);
        if (addr) { results.AegisSecurityProvider = addr; deployments.core.AegisSecurityProvider = addr; deployed++; }
        else failed++;
    } else console.log(`  ✓ AegisSecurityProvider already deployed`);

    // GovernanceSystem(address _token, address _timelock, address _validatorRegistry)
    if (!deployments.core?.GovernanceSystem && validatorReg) {
        // Use deployer as timelock placeholder (in prod: deploy TimelockController first)
        const addr = await deploy('GovernanceSystem', [bezToken, multisig, validatorReg]);
        if (addr) { results.GovernanceSystem = addr; deployments.core.GovernanceSystem = addr; deployed++; }
        else failed++;
    } else console.log(`  ✓ GovernanceSystem already deployed`);

    // OpenClawAgent(address aegis_, address sequencer_, address slashingManager_, address admin)
    const aegis = deployments.core?.AegisSecurityProvider;
    const sequencer = deployments.core?.L2Sequencer;
    const slasher = deployments.core?.SlashingManager;
    if (!deployments.core?.OpenClawAgent && aegis && sequencer && slasher) {
        const addr = await deploy('OpenClawAgent', [aegis, sequencer, slasher, multisig]);
        if (addr) { results.OpenClawAgent = addr; deployments.core.OpenClawAgent = addr; deployed++; }
        else failed++;
    } else if (!deployments.core?.OpenClawAgent) {
        console.log('  ⏭️  OpenClawAgent — waiting for Aegis/Sequencer/Slasher');
    } else console.log(`  ✓ OpenClawAgent already deployed`);

    console.log();

    // ═══════════════════════════════════════════════════════════
    //  PHASE 2: Wallet Contracts
    // ═══════════════════════════════════════════════════════════
    console.log('── Phase 2: Wallet System ──');

    if (!deployments.wallet) deployments.wallet = {};

    // WalletGuardian(address admin)
    if (!deployments.wallet?.WalletGuardian) {
        const addr = await deploy('WalletGuardian', [multisig]);
        if (addr) { results.WalletGuardian = addr; deployments.wallet.WalletGuardian = addr; deployed++; }
        else failed++;
    } else console.log(`  ✓ WalletGuardian already deployed`);

    // SecurityModule(address admin, uint256 _timelockDelay, address[] _guardians, uint256 _guardianThreshold)
    const guardian = deployments.wallet?.WalletGuardian;
    if (!deployments.wallet?.SecurityModule && guardian) {
        const addr = await deploy('SecurityModule', [multisig, 86400, [guardian], 1]);
        if (addr) { results.SecurityModule = addr; deployments.wallet.SecurityModule = addr; deployed++; }
        else failed++;
    } else console.log(`  ✓ SecurityModule already deployed`);

    // Paymaster(address _bezToken, address admin)
    if (!deployments.wallet?.Paymaster) {
        const addr = await deploy('Paymaster', [bezToken, multisig]);
        if (addr) { results.Paymaster = addr; deployments.wallet.Paymaster = addr; deployed++; }
        else failed++;
    } else console.log(`  ✓ Paymaster already deployed`);

    // SmartWalletFactory(address admin, uint256 _defaultDailyLimit)
    if (!deployments.wallet?.SmartWalletFactory) {
        const dailyLimit = ethers.parseEther('10000'); // 10k BEZ daily
        const addr = await deploy('SmartWalletFactory', [multisig, dailyLimit]);
        if (addr) { results.SmartWalletFactory = addr; deployments.wallet.SmartWalletFactory = addr; deployed++; }
        else failed++;
    } else console.log(`  ✓ SmartWalletFactory already deployed`);

    // IdentityRegistry(address admin)
    if (!deployments.wallet?.IdentityRegistry) {
        const addr = await deploy('IdentityRegistry', [multisig]);
        if (addr) { results.IdentityRegistry = addr; deployments.wallet.IdentityRegistry = addr; deployed++; }
        else failed++;
    } else console.log(`  ✓ IdentityRegistry already deployed`);

    console.log();

    // ═══════════════════════════════════════════════════════════
    //  PHASE 3: Cross-chain & Payment Contracts
    // ═══════════════════════════════════════════════════════════
    console.log('── Phase 3: Cross-chain & Payment ──');

    // BEZPolygonBridge(address _bezToken, address admin)
    if (!deployments.core?.BEZPolygonBridge) {
        const addr = await deploy('BEZPolygonBridge', [bezToken, multisig]);
        if (addr) { results.BEZPolygonBridge = addr; deployments.core.BEZPolygonBridge = addr; deployed++; }
        else failed++;
    } else console.log(`  ✓ BEZPolygonBridge already deployed`);

    // WrappedBEZ(address admin)
    if (!deployments.core?.WrappedBEZ) {
        const addr = await deploy('WrappedBEZ', [multisig]);
        if (addr) { results.WrappedBEZ = addr; deployments.core.WrappedBEZ = addr; deployed++; }
        else failed++;
    } else console.log(`  ✓ WrappedBEZ already deployed`);

    // BeZhasPayment(address _bezToken, address _treasury, uint16 _platformFeeBps, address _admin)
    if (!deployments.core?.BeZhasPayment) {
        const addr = await deploy('BeZhasPayment', [bezToken, multisig, 250, multisig]);
        if (addr) { results.BeZhasPayment = addr; deployments.core.BeZhasPayment = addr; deployed++; }
        else failed++;
    } else console.log(`  ✓ BeZhasPayment already deployed`);

    // BeZhasWorkflowRegistry()
    if (!deployments.core?.BeZhasWorkflowRegistry) {
        const addr = await deploy('BeZhasWorkflowRegistry', []);
        if (addr) { results.BeZhasWorkflowRegistry = addr; deployments.core.BeZhasWorkflowRegistry = addr; deployed++; }
        else failed++;
    } else console.log(`  ✓ BeZhasWorkflowRegistry already deployed`);

    console.log();

    // ═══════════════════════════════════════════════════════════
    //  SAVE
    // ═══════════════════════════════════════════════════════════

    // Clean null values from wallet
    if (deployments.wallet) {
        for (const [k, v] of Object.entries(deployments.wallet)) {
            if (v === null) delete deployments.wallet[k];
        }
        delete deployments.wallet._note;
    }

    deployments.timestamp = new Date().toISOString();
    deployments.lastDeploy = 'deploy-missing.cjs';

    fs.writeFileSync(DEPLOY_FILE, JSON.stringify(deployments, null, 2) + '\n');

    // Count totals
    const coreTotal = Object.keys(deployments.core || {}).filter(k => (deployments.core[k] || '').startsWith('0x')).length;
    const sectorTotal = Object.values(deployments.sectors || {}).reduce((s, sec) => s + Object.keys(sec).filter(k => (sec[k] || '').startsWith('0x')).length, 0);
    const walletTotal = Object.keys(deployments.wallet || {}).filter(k => (deployments.wallet[k] || '').startsWith('0x')).length;

    console.log('═══════════════════════════════════════');
    console.log(`📊 Deployment Results:`);
    console.log(`   Deployed this run:  ${deployed}`);
    console.log(`   Failed:            ${failed}`);
    console.log();
    console.log(`📦 Total addresses in 31337.json:`);
    console.log(`   Core:     ${coreTotal}`);
    console.log(`   Sectors:  ${sectorTotal}`);
    console.log(`   Wallet:   ${walletTotal}`);
    console.log(`   Total:    ${coreTotal + sectorTotal + walletTotal}`);
    console.log('═══════════════════════════════════════\n');

    if (deployed > 0) {
        console.log('New addresses deployed:');
        for (const [name, addr] of Object.entries(results)) {
            console.log(`  ${name}: ${addr}`);
        }
        console.log();
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
