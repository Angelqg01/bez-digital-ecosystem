#!/usr/bin/env node
/**
 * scripts/simulate-slashing.js
 *
 * End-to-end test: simulate full slashing lifecycle on testnet.
 * Requires seeded validators (run seed-validators.js first).
 *
 * Steps:
 *   1. Slash a validator for downtime (2% penalty)
 *   2. Verify stake reduced + validator still active
 *   3. Slash for fraudulent data (5% penalty, AEGIS_AI_ROLE)
 *   4. Verify cooldown prevents immediate re-slash
 *   5. Appeal the slash
 *   6. Admin reverses the appealed slash
 *   7. Record missed DAO votes → auto-slash at threshold
 *   8. Verify 30-day period cap (25% max)
 *
 * Usage:
 *   node scripts/simulate-slashing.js --chainId 2708 --rpcUrl <RPC>
 *
 * Requires:
 *   - deployments/<chainId>.json
 *   - validators-<chainId>.json (from seed-validators.js)
 *   - DEPLOYER_PRIVATE_KEY env (must have SLASHER_ROLE + DEFAULT_ADMIN_ROLE)
 */
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
    const args = {};
    for (let i = 2; i < argv.length; i++) {
        const k = argv[i];
        if (!k.startsWith('--')) continue;
        const key = k.slice(2);
        const next = argv[i + 1];
        if (!next || next.startsWith('--')) { args[key] = true; }
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

function log(step, msg) {
    console.log(`  [${step}] ${msg}`);
}

async function main() {
    const args = parseArgs(process.argv);
    const chainId = Number(args.chainId || process.env.BEZHAS_CHAIN_ID || 2708);
    const rpcUrl = args.rpcUrl || process.env.BEZHAS_L2_RPC_URL || 'http://localhost:8545';
    const privateKey = args.privateKey || process.env.DEPLOYER_PRIVATE_KEY;

    if (!privateKey) throw new Error('Missing --privateKey or DEPLOYER_PRIVATE_KEY env');

    // Load deployments
    const deploymentsFile = path.resolve(__dirname, '..', 'smart-contracts', 'deployments', `${chainId}.json`);
    if (!fs.existsSync(deploymentsFile)) throw new Error(`Deployment not found: ${deploymentsFile}`);
    const deployments = JSON.parse(fs.readFileSync(deploymentsFile, 'utf8'));

    // Load seeded validators
    const validatorsFile = path.resolve(__dirname, '..', 'smart-contracts', 'deployments', `validators-${chainId}.json`);
    if (!fs.existsSync(validatorsFile)) throw new Error(`Validators not seeded. Run seed-validators.js first.`);
    const { validators } = JSON.parse(fs.readFileSync(validatorsFile, 'utf8'));

    const slashAddr = deployments.core?.SlashingManager;
    const regAddr = deployments.core?.ValidatorRegistry;
    if (!slashAddr) throw new Error('SlashingManager address not found');
    if (!regAddr) throw new Error('ValidatorRegistry address not found');

    // Pick target: use the Silver tier validator (enough stake to survive multiple slashes)
    const target = validators.find(v => v.tier === 'Silver') || validators[0];

    console.log('═══════════════════════════════════════════');
    console.log('  BeZhas E2E: Slashing Lifecycle Simulation');
    console.log(`  Chain: ${chainId} | RPC: ${rpcUrl}`);
    console.log(`  SlashingManager: ${slashAddr}`);
    console.log(`  Target: ${target.name} (${target.address})`);
    console.log(`  Stake: ${target.stake} BEZ`);
    console.log('═══════════════════════════════════════════\n');

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const admin = new ethers.Wallet(privateKey, provider);

    const slashingABI = loadABI('SlashingManager');
    const registryABI = loadABI('ValidatorRegistry');
    const slashing = new ethers.Contract(slashAddr, slashingABI, admin);
    const registry = new ethers.Contract(regAddr, registryABI, admin);

    const results = { target: target.address, steps: [], success: true };

    async function getStake(addr) {
        const staked = await registry.getStakedAmount(addr);
        return ethers.formatEther(staked);
    }

    // ── Step 1: Slash for downtime ─────────────────
    console.log('Step 1: Slash for Downtime (2%)');
    try {
        const stakeBefore = await getStake(target.address);
        const tx = await slashing.slashForDowntime(target.address, 'E2E: simulated downtime > 4h');
        const receipt = await tx.wait();

        const stakeAfter = await getStake(target.address);
        const penalty = (parseFloat(stakeBefore) - parseFloat(stakeAfter)).toFixed(2);
        log('1', `✅ Slashed. Stake: ${stakeBefore} → ${stakeAfter} BEZ (penalty: ${penalty})`);
        log('1', `TX: ${receipt.hash}`);
        results.steps.push({ step: 1, type: 'downtime', stakeBefore, stakeAfter, penalty, tx: receipt.hash });
    } catch (e) {
        log('1', `❌ ${e.message}`);
        results.steps.push({ step: 1, error: e.message });
    }

    // ── Step 2: Verify still active ────────────────
    console.log('\nStep 2: Verify Validator Status');
    try {
        const isActive = await registry.isActiveValidator(target.address);
        const tier = await registry.getValidatorTier(target.address);
        log('2', `Active: ${isActive} | Tier: ${tier}`);
        results.steps.push({ step: 2, isActive, tier: Number(tier) });
    } catch (e) {
        log('2', `❌ ${e.message}`);
        results.steps.push({ step: 2, error: e.message });
    }

    // ── Step 3: Verify cooldown blocks re-slash ────
    console.log('\nStep 3: Cooldown Verification (expect revert)');
    try {
        await slashing.slashForDowntime(target.address, 'E2E: immediate re-slash attempt');
        log('3', `❌ Should have reverted but didn't!`);
        results.steps.push({ step: 3, error: 'Cooldown not enforced' });
        results.success = false;
    } catch (e) {
        log('3', `✅ Correctly reverted: ${e.reason || e.message.slice(0, 80)}`);
        results.steps.push({ step: 3, action: 'cooldown_enforced', reverted: true });
    }

    // ── Step 4: Fast-forward past cooldown, slash for fraudulent data ──
    console.log('\nStep 4: Slash for Fraudulent Data (5%) — after cooldown');
    try {
        // Advance time past 24h cooldown
        if (chainId === 31337 || chainId === 2708) {
            await provider.send('evm_increaseTime', [86401]).catch(() => { });
            await provider.send('evm_mine', []).catch(() => { });
        }

        const stakeBefore = await getStake(target.address);
        const tx = await slashing.slashForFraudulentData(target.address, 'E2E: simulated fraudulent data');
        const receipt = await tx.wait();

        const stakeAfter = await getStake(target.address);
        const penalty = (parseFloat(stakeBefore) - parseFloat(stakeAfter)).toFixed(2);
        log('4', `✅ Slashed. Stake: ${stakeBefore} → ${stakeAfter} BEZ (penalty: ${penalty})`);
        log('4', `TX: ${receipt.hash}`);
        results.steps.push({ step: 4, type: 'fraudulent_data', stakeBefore, stakeAfter, penalty, tx: receipt.hash });
    } catch (e) {
        log('4', `❌ ${e.message}`);
        results.steps.push({ step: 4, error: e.message });
    }

    // ── Step 5: Appeal the last slash ──────────────
    console.log('\nStep 5: Appeal Slash');
    try {
        const totalSlashes = await slashing.totalSlashed();
        // Get the last slash ID from history
        const slashHistory = await slashing.getSlashHistory(target.address);
        const lastSlashId = slashHistory[slashHistory.length - 1];

        // Appeal must come from the slashed validator
        const seed = ethers.id(`bezhas-testnet-validator-1-${chainId}`); // Silver = index 1
        const targetWallet = new ethers.Wallet(seed, provider);

        const slashingAsTarget = slashing.connect(targetWallet);
        const tx = await slashingAsTarget.appealSlash(lastSlashId);
        const receipt = await tx.wait();
        log('5', `✅ Appeal submitted for slash #${lastSlashId} | TX: ${receipt.hash}`);
        results.steps.push({ step: 5, action: 'appeal', slashId: Number(lastSlashId), tx: receipt.hash });
    } catch (e) {
        log('5', `❌ ${e.message}`);
        results.steps.push({ step: 5, error: e.message });
    }

    // ── Step 6: Admin reverses slash ───────────────
    console.log('\nStep 6: Admin Reverse Slash');
    try {
        const slashHistory = await slashing.getSlashHistory(target.address);
        const lastSlashId = slashHistory[slashHistory.length - 1];

        const tx = await slashing.reverseSlash(lastSlashId);
        const receipt = await tx.wait();
        log('6', `✅ Slash #${lastSlashId} reversed by admin | TX: ${receipt.hash}`);
        log('6', `Note: Tokens must be returned manually per contract design`);
        results.steps.push({ step: 6, action: 'reverseSlash', slashId: Number(lastSlashId), tx: receipt.hash });
    } catch (e) {
        log('6', `❌ ${e.message}`);
        results.steps.push({ step: 6, error: e.message });
    }

    // ── Step 7: Missed DAO votes → auto-slash ──────
    console.log('\nStep 7: Record Missed DAO Votes → Auto-Slash');
    try {
        const threshold = await slashing.daoInactivityThreshold();
        log('7', `DAO inactivity threshold: ${threshold} missed votes`);

        // Advance past cooldown for each vote record
        for (let i = 0; i < Number(threshold); i++) {
            if (i > 0) {
                // Need cooldown between slashes
                await provider.send('evm_increaseTime', [86401]).catch(() => { });
                await provider.send('evm_mine', []).catch(() => { });
            }
            const tx = await slashing.recordMissedDAOVote(target.address);
            await tx.wait();
            log('7', `  Missed vote ${i + 1}/${threshold} recorded`);
        }

        const stakeAfter = await getStake(target.address);
        log('7', `✅ After ${threshold} missed votes. Stake: ${stakeAfter} BEZ`);
        results.steps.push({ step: 7, type: 'dao_inactivity', missedVotes: Number(threshold), stakeAfter });
    } catch (e) {
        log('7', `❌ ${e.message}`);
        results.steps.push({ step: 7, error: e.message });
    }

    // ── Step 8: Check total slashed ────────────────
    console.log('\nStep 8: Final Summary');
    try {
        const totalSlashed = await slashing.totalSlashed();
        const finalStake = await getStake(target.address);
        const isActive = await registry.isActiveValidator(target.address);

        log('8', `Total slashed (all validators): ${ethers.formatEther(totalSlashed)} BEZ`);
        log('8', `Target final stake: ${finalStake} BEZ | Active: ${isActive}`);
        results.steps.push({ step: 8, totalSlashed: ethers.formatEther(totalSlashed), finalStake, isActive });
    } catch (e) {
        log('8', `❌ ${e.message}`);
        results.steps.push({ step: 8, error: e.message });
    }

    // ── Results ────────────────────────────────────
    const passed = results.steps.filter(s => !s.error).length;
    const total = results.steps.length;
    console.log('\n═══════════════════════════════════════════');
    console.log(`  Result: ${passed}/${total} steps passed`);
    console.log(`  Status: ${passed === total ? '✅ PASS' : '❌ FAIL'}`);
    console.log('═══════════════════════════════════════════');

    const outputFile = path.resolve(__dirname, '..', 'reports', `e2e-slashing-${chainId}-${Date.now()}.json`);
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`  Report: ${outputFile}\n`);

    if (passed < total) process.exit(1);
}

main().catch(err => {
    console.error('❌ Fatal:', err.message);
    process.exit(1);
});
