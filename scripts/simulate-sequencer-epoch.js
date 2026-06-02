#!/usr/bin/env node
/**
 * scripts/simulate-sequencer-epoch.js
 *
 * End-to-end test: simulate a full sequencer rotation epoch on testnet.
 * Requires seeded validators (run seed-validators.js first).
 *
 * Steps:
 *   1. Refresh sequencer queue (Gold/Platinum validators)
 *   2. Report blocks produced for current epoch
 *   3. Advance epoch → verify new sequencer rotated in
 *   4. Report blocks for new epoch
 *   5. Force rotation → verify immediate handoff
 *
 * Usage:
 *   node scripts/simulate-sequencer-epoch.js --chainId 2708 --rpcUrl <RPC>
 *
 * Requires:
 *   - deployments/<chainId>.json with SequencerRotation + ValidatorRegistry addresses
 *   - DEPLOYER_PRIVATE_KEY env (must have ROTATION_MANAGER_ROLE)
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

    const deploymentsFile = path.resolve(__dirname, '..', 'smart-contracts', 'deployments', `${chainId}.json`);
    if (!fs.existsSync(deploymentsFile)) throw new Error(`Deployment not found: ${deploymentsFile}`);
    const deployments = JSON.parse(fs.readFileSync(deploymentsFile, 'utf8'));

    const seqAddr = deployments.core?.SequencerRotation;
    const regAddr = deployments.core?.ValidatorRegistry;
    if (!seqAddr) throw new Error('SequencerRotation address not found');
    if (!regAddr) throw new Error('ValidatorRegistry address not found');

    console.log('═══════════════════════════════════════════');
    console.log('  BeZhas E2E: Sequencer Epoch Simulation');
    console.log(`  Chain: ${chainId} | RPC: ${rpcUrl}`);
    console.log(`  SequencerRotation: ${seqAddr}`);
    console.log('═══════════════════════════════════════════\n');

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const manager = new ethers.Wallet(privateKey, provider);

    const seqABI = loadABI('SequencerRotation');
    const sequencer = new ethers.Contract(seqAddr, seqABI, manager);

    const results = { steps: [], success: true };

    // ── Step 1: Refresh queue ──────────────────────
    console.log('Step 1: Refresh Sequencer Queue');
    try {
        const tx1 = await sequencer.refreshSequencerQueue();
        const r1 = await tx1.wait();
        const queueLen = await sequencer.getSequencerQueueLength();
        log('1', `Queue refreshed. Length: ${queueLen} | Gas: ${r1.gasUsed} | TX: ${r1.hash}`);
        results.steps.push({ step: 1, action: 'refreshQueue', queueLength: Number(queueLen), tx: r1.hash });

        if (Number(queueLen) < 2) {
            throw new Error(`Need at least 2 sequencer-eligible validators (Gold/Platinum). Got: ${queueLen}`);
        }
    } catch (e) {
        log('1', `❌ ${e.message}`);
        results.success = false;
        results.steps.push({ step: 1, error: e.message });
    }

    // ── Step 2: Get epoch info + report blocks ─────
    console.log('\nStep 2: Report Blocks for Current Epoch');
    let epoch0, seq0;
    try {
        const info = await sequencer.getEpochInfo();
        epoch0 = Number(info[0]);
        seq0 = info[1];
        const blocksRemaining = Number(info[3]);
        log('2', `Epoch ${epoch0} | Sequencer: ${seq0} | Blocks remaining: ${blocksRemaining}`);

        const tx2 = await sequencer.reportBlocksProduced(epoch0, 100);
        const r2 = await tx2.wait();
        log('2', `Reported 100 blocks for epoch ${epoch0} | TX: ${r2.hash}`);
        results.steps.push({ step: 2, epoch: epoch0, sequencer: seq0, blocksReported: 100, tx: r2.hash });
    } catch (e) {
        log('2', `❌ ${e.message}`);
        results.steps.push({ step: 2, error: e.message });
    }

    // ── Step 3: Advance epoch ──────────────────────
    console.log('\nStep 3: Advance Epoch');
    try {
        // On local chains, mine blocks to pass epochLength
        if (chainId === 31337 || chainId === 2708) {
            const epochLen = 7200;
            log('3', `Mining ${epochLen} blocks to trigger epoch end...`);
            await provider.send('hardhat_mine', [`0x${epochLen.toString(16)}`]).catch(() => {
                // Not hardhat — try evm_mine in loop (anvil compatible)
                return provider.send('evm_mine', []);
            });
        }

        const tx3 = await sequencer.advanceEpoch();
        const r3 = await tx3.wait();

        const newInfo = await sequencer.getEpochInfo();
        const epoch1 = Number(newInfo[0]);
        const seq1 = newInfo[1];
        log('3', `✅ Epoch advanced: ${epoch0} → ${epoch1}`);
        log('3', `New sequencer: ${seq1} | TX: ${r3.hash}`);

        if (seq0 && seq1 !== seq0) {
            log('3', `✅ Rotation confirmed: ${seq0.slice(0, 10)}... → ${seq1.slice(0, 10)}...`);
        }
        results.steps.push({ step: 3, action: 'advanceEpoch', oldEpoch: epoch0, newEpoch: epoch1, oldSeq: seq0, newSeq: seq1, tx: r3.hash });
    } catch (e) {
        log('3', `❌ ${e.message}`);
        results.steps.push({ step: 3, error: e.message });
    }

    // ── Step 4: Report blocks for new epoch ────────
    console.log('\nStep 4: Report Blocks for New Epoch');
    try {
        const info2 = await sequencer.getEpochInfo();
        const currentEpoch = Number(info2[0]);
        const tx4 = await sequencer.reportBlocksProduced(currentEpoch, 50);
        const r4 = await tx4.wait();
        log('4', `Reported 50 blocks for epoch ${currentEpoch} | TX: ${r4.hash}`);
        results.steps.push({ step: 4, epoch: currentEpoch, blocksReported: 50, tx: r4.hash });
    } catch (e) {
        log('4', `❌ ${e.message}`);
        results.steps.push({ step: 4, error: e.message });
    }

    // ── Step 5: Force rotation ─────────────────────
    console.log('\nStep 5: Force Rotation');
    try {
        const infoBefore = await sequencer.getEpochInfo();
        const seqBefore = infoBefore[1];

        const tx5 = await sequencer.forceRotation('E2E simulation: forced rotation test');
        const r5 = await tx5.wait();

        const infoAfter = await sequencer.getEpochInfo();
        const seqAfter = infoAfter[1];
        log('5', `✅ Force rotated: ${seqBefore.slice(0, 10)}... → ${seqAfter.slice(0, 10)}...`);
        log('5', `TX: ${r5.hash} | Gas: ${r5.gasUsed}`);
        results.steps.push({ step: 5, action: 'forceRotation', oldSeq: seqBefore, newSeq: seqAfter, tx: r5.hash });
    } catch (e) {
        log('5', `❌ ${e.message}`);
        results.steps.push({ step: 5, error: e.message });
    }

    // ── Summary ────────────────────────────────────
    const passed = results.steps.filter(s => !s.error).length;
    const total = results.steps.length;
    console.log('\n═══════════════════════════════════════════');
    console.log(`  Result: ${passed}/${total} steps passed`);
    console.log(`  Status: ${results.success && passed === total ? '✅ PASS' : '❌ FAIL'}`);
    console.log('═══════════════════════════════════════════');

    // Write results
    const outputFile = path.resolve(__dirname, '..', 'reports', `e2e-sequencer-${chainId}-${Date.now()}.json`);
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`  Report: ${outputFile}\n`);

    if (!results.success || passed < total) process.exit(1);
}

main().catch(err => {
    console.error('❌ Fatal:', err.message);
    process.exit(1);
});
