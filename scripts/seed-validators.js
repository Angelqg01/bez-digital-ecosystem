#!/usr/bin/env node
/**
 * scripts/seed-validators.js
 *
 * Register 5 test validators (1 per tier except Platinum which is 2) on a live chain.
 * Used after testnet deployment (Phase 13B.3).
 *
 * Usage:
 *   node scripts/seed-validators.js --chainId 2708 --rpcUrl <RPC>
 *
 * Requires:
 *   - deployments/<chainId>.json with ValidatorRegistry + BEZCoinV2 addresses
 *   - DEPLOYER_PRIVATE_KEY env or --privateKey flag (deployer must hold BEZ)
 *
 * The deployer creates 5 separate wallets, funds them with BEZ, and registers each as a validator.
 */
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// ── Config ──────────────────────────────────────────
const VALIDATORS = [
    { name: 'BeZhas Bronze Test', stake: '10000', tier: 'Bronze' },
    { name: 'BeZhas Silver Test', stake: '50000', tier: 'Silver' },
    { name: 'BeZhas Gold Test', stake: '250000', tier: 'Gold' },
    { name: 'BeZhas Platinum Test', stake: '1000000', tier: 'Platinum' },
    { name: 'BeZhas Gold-2 Test', stake: '300000', tier: 'Gold' },
];

function parseArgs(argv) {
    const args = {};
    for (let i = 2; i < argv.length; i++) {
        const k = argv[i];
        if (!k.startsWith('--')) continue;
        const key = k.slice(2);
        const next = argv[i + 1];
        if (!next || next.startsWith('--')) { args[key] = true; i; }
        else { args[key] = next; i++; }
    }
    return args;
}

function loadABI(contractName) {
    const root = path.resolve(__dirname, '..', 'smart-contracts', 'out');
    const p = path.join(root, `${contractName}.sol`, `${contractName}.json`);
    if (!fs.existsSync(p)) throw new Error(`ABI not found: ${p}`);
    return JSON.parse(fs.readFileSync(p, 'utf8')).abi;
}

async function main() {
    const args = parseArgs(process.argv);
    const chainId = Number(args.chainId || process.env.BEZHAS_CHAIN_ID || 2708);
    const rpcUrl = args.rpcUrl || process.env.BEZHAS_L2_RPC_URL || 'http://localhost:8545';
    const privateKey = args.privateKey || process.env.DEPLOYER_PRIVATE_KEY;

    if (!privateKey) throw new Error('Missing --privateKey or DEPLOYER_PRIVATE_KEY env');

    const deploymentsFile = path.resolve(__dirname, '..', 'smart-contracts', 'deployments', `${chainId}.json`);
    if (!fs.existsSync(deploymentsFile)) throw new Error(`Deployment not found: ${deploymentsFile}`);

    const deployments = JSON.parse(fs.readFileSync(deploymentsFile, 'utf8'));

    // Find addresses
    const registryAddr = deployments.core?.ValidatorRegistry;
    const bezAddr = deployments.core?.BEZCoinV2 || deployments.core?.BezhasToken;
    if (!registryAddr) throw new Error('ValidatorRegistry address not found in deployments');
    if (!bezAddr) throw new Error('BEZ token address not found in deployments');

    console.log('═══════════════════════════════════════════');
    console.log('  BeZhas Testnet Validator Seeder');
    console.log(`  Chain: ${chainId} | RPC: ${rpcUrl}`);
    console.log(`  Registry: ${registryAddr}`);
    console.log(`  BEZ: ${bezAddr}`);
    console.log('═══════════════════════════════════════════\n');

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const deployer = new ethers.Wallet(privateKey, provider);

    const registryABI = loadABI('ValidatorRegistry');
    const erc20ABI = loadABI('BEZCoinV2');
    const registry = new ethers.Contract(registryAddr, registryABI, deployer);
    const bez = new ethers.Contract(bezAddr, erc20ABI, deployer);

    // Check deployer balance
    const deployerBalance = await bez.balanceOf(deployer.address);
    console.log(`Deployer BEZ balance: ${ethers.formatEther(deployerBalance)} BEZ\n`);

    const totalNeeded = VALIDATORS.reduce((s, v) => s + BigInt(ethers.parseEther(v.stake)), 0n);
    if (deployerBalance < totalNeeded) {
        throw new Error(`Insufficient BEZ. Need ${ethers.formatEther(totalNeeded)}, have ${ethers.formatEther(deployerBalance)}`);
    }

    const results = [];

    for (let i = 0; i < VALIDATORS.length; i++) {
        const v = VALIDATORS[i];
        console.log(`[${i + 1}/${VALIDATORS.length}] Registering ${v.name} (${v.tier} — ${v.stake} BEZ)...`);

        // Create deterministic wallet for each validator
        const seed = ethers.id(`bezhas-testnet-validator-${i}-${chainId}`);
        const validatorWallet = new ethers.Wallet(seed, provider);

        // Fund validator with BEZ
        const stakeWei = ethers.parseEther(v.stake);
        const fundTx = await bez.transfer(validatorWallet.address, stakeWei);
        await fundTx.wait();

        // Fund validator with native gas token
        const gasTx = await deployer.sendTransaction({
            to: validatorWallet.address,
            value: ethers.parseEther('1'), // 1 native token for gas
        });
        await gasTx.wait();

        // Approve registry
        const bezValidator = bez.connect(validatorWallet);
        const approveTx = await bezValidator.approve(registryAddr, stakeWei);
        await approveTx.wait();

        // Register
        const registryValidator = registry.connect(validatorWallet);
        const regTx = await registryValidator.registerValidator(v.name, stakeWei);
        const receipt = await regTx.wait();

        console.log(`  ✅ ${v.name} registered at ${validatorWallet.address}`);
        console.log(`     Tier: ${v.tier} | Stake: ${v.stake} BEZ | TX: ${receipt.hash}\n`);

        results.push({
            name: v.name,
            tier: v.tier,
            address: validatorWallet.address,
            stake: v.stake,
            txHash: receipt.hash,
        });
    }

    // Write results
    const outputFile = path.resolve(__dirname, '..', 'smart-contracts', 'deployments', `validators-${chainId}.json`);
    fs.writeFileSync(outputFile, JSON.stringify({ chainId, validators: results, timestamp: new Date().toISOString() }, null, 2));

    console.log('═══════════════════════════════════════════');
    console.log(`  ${results.length} validators registered`);
    console.log(`  Results: ${outputFile}`);
    console.log('═══════════════════════════════════════════');
}

main().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
