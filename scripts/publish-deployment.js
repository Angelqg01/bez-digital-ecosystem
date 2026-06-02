#!/usr/bin/env node
/**
 * scripts/publish-deployment.js
 *
 * Parse forge broadcast artifacts and write deployments/<chainId>.json
 * Run after `forge script DeployAll --broadcast` completes.
 *
 * Usage:
 *   node scripts/publish-deployment.js --chainId 2708
 *   node scripts/publish-deployment.js --chainId 11155111 --scriptName DeployAll
 *
 * Reads from: smart-contracts/broadcast/<Script>.s.sol/<chainId>/run-latest.json
 * Writes to:  smart-contracts/deployments/<chainId>.json
 */
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

// Known contract → category mapping
const CATEGORY_MAP = {
    // Core
    BEZCoinV2: 'core', StakingPool: 'core', LiquidityFarming: 'core',
    GovernanceSystem: 'core', BeZhasBridgeL2: 'core', BEZPolygonBridge: 'core',
    QualityEscrow: 'core', BeZhasPayment: 'core', BeZhasWorkflowRegistry: 'core',
    WrappedBEZ: 'core',
    // Validation
    ValidatorRegistry: 'core', EdgeNodeRewards: 'core',
    SequencerRotation: 'core', SlashingManager: 'core',
    // Wallet
    SmartWalletFactory: 'wallet', SmartWallet: 'wallet',
    SecurityModule: 'wallet', Paymaster: 'wallet',
    // Governance
    TimelockController: 'governance',
};

// Sector detection from contract name
const SECTOR_PATTERNS = [
    { pattern: /Health|Pharma|Clinical/i, sector: 'health' },
    { pattern: /Energy|Carbon|Solar|ESG|EV/i, sector: 'energy' },
    { pattern: /Vehicle|Auto|Fleet/i, sector: 'automotive' },
    { pattern: /Quality.*Certificate|DigitalTwin|Material.*MRP|Predictive/i, sector: 'manufacturing' },
    { pattern: /Crop|Agri|Aqua/i, sector: 'agriculture' },
    { pattern: /Supply|Warehouse|Tracking|Customs|Clearance|Procurement|Supplier/i, sector: 'supplychain' },
    { pattern: /RealEstate|Property|Mortgage|Land/i, sector: 'realestate' },
    { pattern: /Insurance|Claim|Actuary|Reinsurance/i, sector: 'insurance' },
    { pattern: /Student|Course|Academic|Research/i, sector: 'education' },
    { pattern: /Tourism|Hotel|Booking|Loyalty/i, sector: 'tourism' },
    { pattern: /Legal|Contract|Arbitration|IP/i, sector: 'legal' },
    { pattern: /Telecom|Roaming|Bandwidth|eSIM/i, sector: 'telecomunicaciones' },
    { pattern: /Freelance|Subscription|SLA|Service.*Reputation/i, sector: 'services' },
    { pattern: /Government|Voting|Budget|PublicProcurement/i, sector: 'government' },
    { pattern: /Mining|Mineral|Royalty|SafetyAudit/i, sector: 'mining' },
    { pattern: /P2P|Crowdfunding|Loyalty|Marketplace/i, sector: 'otros' },
];

function categorize(contractName) {
    if (CATEGORY_MAP[contractName]) return { category: CATEGORY_MAP[contractName] };
    for (const { pattern, sector } of SECTOR_PATTERNS) {
        if (pattern.test(contractName)) return { category: 'sectors', sector };
    }
    return { category: 'other' };
}

function main() {
    const args = parseArgs(process.argv);
    const chainId = Number(args.chainId || process.env.BEZHAS_CHAIN_ID || 2708);
    const scriptName = args.scriptName || 'DeployAll';

    const broadcastDir = path.resolve(__dirname, '..', 'smart-contracts', 'broadcast');
    const runLatest = path.join(broadcastDir, `${scriptName}.s.sol`, String(chainId), 'run-latest.json');

    console.log('═══════════════════════════════════════════');
    console.log('  BeZhas Deployment Publisher');
    console.log(`  Chain: ${chainId}`);
    console.log(`  Script: ${scriptName}`);
    console.log('═══════════════════════════════════════════\n');

    // Try forge broadcast first, fallback to existing deployment
    let contracts = {};

    if (fs.existsSync(runLatest)) {
        console.log(`Reading broadcast: ${runLatest}\n`);
        const broadcast = JSON.parse(fs.readFileSync(runLatest, 'utf8'));

        for (const tx of broadcast.transactions || []) {
            if (tx.transactionType === 'CREATE' || tx.transactionType === 'CREATE2') {
                const name = tx.contractName;
                const addr = tx.contractAddress;
                if (!name || !addr) continue;

                const { category, sector } = categorize(name);
                if (category === 'sectors' && sector) {
                    contracts[category] = contracts[category] || {};
                    contracts[category][sector] = contracts[category][sector] || {};
                    contracts[category][sector][name] = addr;
                } else {
                    contracts[category] = contracts[category] || {};
                    contracts[category][name] = addr;
                }

                console.log(`  ${name.padEnd(35)} → ${addr} [${sector || category}]`);
            }
        }
    } else {
        // Try to merge individual script broadcasts
        const scripts = ['DeployCore', 'DeployValidation', 'DeployPayment', 'DeployFarming', 'DeploySectors'];
        console.log('No DeployAll broadcast found. Merging individual scripts...\n');

        for (const script of scripts) {
            const scriptRun = path.join(broadcastDir, `${script}.s.sol`, String(chainId), 'run-latest.json');
            if (!fs.existsSync(scriptRun)) {
                console.log(`  ⚠️  ${script}: not found, skipping`);
                continue;
            }
            const broadcast = JSON.parse(fs.readFileSync(scriptRun, 'utf8'));

            for (const tx of broadcast.transactions || []) {
                if (tx.transactionType === 'CREATE' || tx.transactionType === 'CREATE2') {
                    const name = tx.contractName;
                    const addr = tx.contractAddress;
                    if (!name || !addr) continue;

                    const { category, sector } = categorize(name);
                    if (category === 'sectors' && sector) {
                        contracts[category] = contracts[category] || {};
                        contracts[category][sector] = contracts[category][sector] || {};
                        contracts[category][sector][name] = addr;
                    } else {
                        contracts[category] = contracts[category] || {};
                        contracts[category][name] = addr;
                    }

                    console.log(`  [${script}] ${name.padEnd(30)} → ${addr}`);
                }
            }
        }
    }

    const totalContracts = JSON.stringify(contracts).match(/"0x[a-fA-F0-9]{40}"/g)?.length || 0;

    if (totalContracts === 0) {
        console.error('\n❌ No contracts found in broadcast artifacts.');
        console.error('   Run: cd smart-contracts && forge script DeployAll --broadcast');
        process.exit(1);
    }

    // Merge with existing deployment (preserve manually added entries)
    const outputFile = path.resolve(__dirname, '..', 'smart-contracts', 'deployments', `${chainId}.json`);
    let existing = {};
    if (fs.existsSync(outputFile)) {
        existing = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
        console.log(`\nMerging with existing deployment (${Object.keys(existing).length} categories)`);
    }

    const deployment = {
        chainId,
        timestamp: new Date().toISOString(),
        deployer: 'forge-script',
        ...existing,
        ...contracts,
    };

    // Ensure directory exists
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, JSON.stringify(deployment, null, 2));

    console.log('\n═══════════════════════════════════════════');
    console.log(`  ✅ Published ${totalContracts} contracts`);
    console.log(`  File: ${outputFile}`);
    console.log('═══════════════════════════════════════════\n');
}

main();
