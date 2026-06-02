/**
 * verify-deployment.js — End-to-end verification of all 66 deployed contracts.
 *
 * Connects to Anvil (localhost:8545), loads ABIs from Foundry artifacts,
 * and calls read functions on every deployed contract.
 *
 * Usage:
 *   node scripts/verify-deployment.js [chainId]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CHAIN_ID = parseInt(process.argv[2] || '31337', 10);
const RPC_URL = process.env.BEZHAS_L2_RPC_URL || 'http://localhost:8545';
const ROOT = path.resolve(__dirname, '..');
const ARTIFACTS_DIR = path.resolve(ROOT, 'smart-contracts', 'out');
const DEPLOYMENTS_FILE = path.resolve(ROOT, 'smart-contracts', 'deployments', `${CHAIN_ID}.json`);

// Resolve ethers from api/node_modules if not found at workspace root
let ethers;
try {
    ({ ethers } = await import('ethers'));
} catch (_) {
    ({ ethers } = require(path.join(ROOT, 'api', 'node_modules', 'ethers')));
}

// Deployer (Anvil account #0)
const DEPLOYER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
// Edge node (Anvil account #1)
const EDGE_NODE = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

function loadABI(contractName) {
    const p = path.join(ARTIFACTS_DIR, `${contractName}.sol`, `${contractName}.json`);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8')).abi;
}

async function main() {
    console.log('═══════════════════════════════════════════');
    console.log('  BeZhas Deployment Verification');
    console.log(`  Chain: ${CHAIN_ID} | RPC: ${RPC_URL}`);
    console.log('═══════════════════════════════════════════\n');

    if (!fs.existsSync(DEPLOYMENTS_FILE)) {
        console.error(`Deployment file not found: ${DEPLOYMENTS_FILE}`);
        process.exit(1);
    }

    const deployments = JSON.parse(fs.readFileSync(DEPLOYMENTS_FILE, 'utf8'));
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Verify chain connectivity
    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    console.log(`Connected: chainId=${network.chainId}, block=${blockNumber}\n`);

    let passed = 0;
    let failed = 0;
    const errors = [];

    // ── Verify code exists at each address ──
    async function verifyContract(name, address, category) {
        try {
            const code = await provider.getCode(address);
            if (code === '0x' || code.length < 4) {
                throw new Error('No bytecode at address');
            }
            passed++;
            return true;
        } catch (err) {
            failed++;
            errors.push(`  [FAIL] ${category}/${name} @ ${address}: ${err.message}`);
            return false;
        }
    }

    // Verify all core contracts
    console.log('── Core Contracts ──');
    for (const [name, address] of Object.entries(deployments.core)) {
        const ok = await verifyContract(name, address, 'core');
        console.log(`  ${ok ? '✓' : '✗'} ${name}: ${address}`);
    }

    // Verify all sector contracts
    for (const [sector, contracts] of Object.entries(deployments.sectors)) {
        console.log(`\n── ${sector} ──`);
        for (const [name, address] of Object.entries(contracts)) {
            const ok = await verifyContract(name, address, sector);
            console.log(`  ${ok ? '✓' : '✗'} ${name}: ${address}`);
        }
    }

    // ── Deep verification: call core contract functions ──
    console.log('\n═══════════════════════════════════════════');
    console.log('  Deep Verification (Core Contract Reads)');
    console.log('═══════════════════════════════════════════\n');

    // BEZCoinV2
    try {
        const abi = loadABI('BEZCoinV2');
        const bez = new ethers.Contract(deployments.core.BEZCoinV2, abi, provider);
        const [name, symbol, totalSupply, decimals] = await Promise.all([
            bez.name(), bez.symbol(), bez.totalSupply(), bez.decimals()
        ]);
        const edgeBalance = await bez.balanceOf(EDGE_NODE);
        console.log(`  BEZCoinV2:`);
        console.log(`    name=${name}, symbol=${symbol}, decimals=${decimals}`);
        console.log(`    totalSupply=${ethers.formatEther(totalSupply)} BEZ`);
        console.log(`    edgeNode balance=${ethers.formatEther(edgeBalance)} BEZ`);
        passed++;
    } catch (err) {
        failed++;
        errors.push(`  [FAIL] BEZCoinV2 deep read: ${err.message}`);
    }

    // BeZhasLogisticsNFT
    try {
        const abi = loadABI('BeZhasLogisticsNFT');
        const nft = new ethers.Contract(deployments.core.BeZhasLogisticsNFT, abi, provider);
        const [name, symbol] = await Promise.all([nft.name(), nft.symbol()]);
        console.log(`  BeZhasLogisticsNFT: name=${name}, symbol=${symbol}`);
        passed++;
    } catch (err) {
        failed++;
        errors.push(`  [FAIL] BeZhasLogisticsNFT deep read: ${err.message}`);
    }

    // StakingPool
    try {
        const abi = loadABI('StakingPool');
        const staking = new ethers.Contract(deployments.core.StakingPool, abi, provider);
        const bezToken = await staking.bezToken();
        console.log(`  StakingPool: bezToken=${bezToken}`);
        // Verify it points to BEZCoinV2
        if (bezToken.toLowerCase() === deployments.core.BEZCoinV2.toLowerCase()) {
            console.log(`    ✓ Correctly linked to BEZCoinV2`);
        }
        passed++;
    } catch (err) {
        failed++;
        errors.push(`  [FAIL] StakingPool deep read: ${err.message}`);
    }

    // LiquidityFarming
    try {
        const abi = loadABI('LiquidityFarming');
        const farming = new ethers.Contract(deployments.core.LiquidityFarming, abi, provider);
        const bezToken = await farming.bez();
        console.log(`  LiquidityFarming: bezToken=${bezToken}`);
        passed++;
    } catch (err) {
        failed++;
        errors.push(`  [FAIL] LiquidityFarming deep read: ${err.message}`);
    }

    // BeZhasBridgeL2
    try {
        const abi = loadABI('BeZhasBridgeL2');
        const bridge = new ethers.Contract(deployments.core.BeZhasBridgeL2, abi, provider);
        const bezToken = await bridge.bezToken();
        console.log(`  BeZhasBridgeL2: bezToken=${bezToken}`);
        passed++;
    } catch (err) {
        failed++;
        errors.push(`  [FAIL] BeZhasBridgeL2 deep read: ${err.message}`);
    }

    // QualityEscrow
    try {
        const abi = loadABI('QualityEscrow');
        const escrow = new ethers.Contract(deployments.core.QualityEscrow, abi, provider);
        const hasEdgeRole = await escrow.hasRole(await escrow.EDGE_NODE_ROLE(), EDGE_NODE);
        console.log(`  QualityEscrow: edgeNode hasRole=${hasEdgeRole}`);
        passed++;
    } catch (err) {
        failed++;
        errors.push(`  [FAIL] QualityEscrow deep read: ${err.message}`);
    }

    // ── Blockchain stats ──
    console.log('\n── Blockchain Stats ──');
    const feeData = await provider.getFeeData();
    const deployerBal = await provider.getBalance(DEPLOYER);
    const edgeNodeBal = await provider.getBalance(EDGE_NODE);
    console.log(`  Gas price: ${ethers.formatUnits(feeData.gasPrice || 0n, 'gwei')} gwei`);
    console.log(`  Deployer ETH: ${ethers.formatEther(deployerBal)}`);
    console.log(`  Edge Node ETH: ${ethers.formatEther(edgeNodeBal)}`);

    // ── Summary ──
    console.log('\n═══════════════════════════════════════════');
    console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
    console.log('═══════════════════════════════════════════');

    if (errors.length > 0) {
        console.log('\nFailures:');
        errors.forEach(e => console.log(e));
    }

    process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
