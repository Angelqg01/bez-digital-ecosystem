#!/usr/bin/env node
/**
 * check-bytecode.cjs — Verify which contracts have compiled bytecode available.
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.resolve(__dirname, '..', 'smart-contracts', 'out');

const contracts = [
    'ValidatorRegistry', 'EdgeNodeRewards', 'SequencerRotation', 'SlashingManager',
    'DeliveryEscrow', 'SmartWallet', 'SmartWalletFactory', 'MultiSigWallet',
    'Paymaster', 'SecurityModule', 'WalletGuardian', 'IdentityRegistry',
    'GovernanceSystem', 'L2Sequencer', 'OpenClawAgent', 'AegisSecurityProvider',
    'BEZPolygonBridge', 'BEZSectorStandard', 'BeZhasPayment', 'BeZhasWorkflowRegistry',
    'WrappedBEZ',
];

console.log('Checking bytecode in smart-contracts/out/...\n');

const found = [];
const missing = [];

for (const c of contracts) {
    const p = path.join(OUT_DIR, `${c}.sol`, `${c}.json`);
    if (fs.existsSync(p)) {
        try {
            const raw = JSON.parse(fs.readFileSync(p, 'utf-8'));
            const bytecode = raw.bytecode?.object || '';
            const hasConstructor = (raw.abi || []).some(e => e.type === 'constructor');
            const constructorArgs = hasConstructor
                ? (raw.abi.find(e => e.type === 'constructor')?.inputs || []).map(i => `${i.type} ${i.name}`).join(', ')
                : '(none)';
            found.push({ name: c, bytecodeLen: bytecode.length, constructorArgs });
            console.log(`  ✅ ${c} — bytecode: ${bytecode.length} chars | constructor(${constructorArgs})`);
        } catch (err) {
            missing.push(c);
            console.log(`  ❌ ${c} — parse error: ${err.message}`);
        }
    } else {
        missing.push(c);
        console.log(`  ❌ ${c} — not found`);
    }
}

console.log(`\n📊 Found: ${found.length} / ${contracts.length}`);
if (missing.length) console.log(`Missing: ${missing.join(', ')}`);
console.log();

// Output deployable contracts
const deployable = found.filter(f => f.bytecodeLen > 2);
console.log(`Deployable via ethers.js: ${deployable.length}`);
