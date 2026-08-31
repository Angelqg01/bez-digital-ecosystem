/**
 * parse-deployment-validation.js
 *
 * Parses the Foundry broadcast for DeployValidation.s.sol and MERGES
 * the new validation contract addresses into the existing deployments/<chainId>.json.
 *
 * Usage:
 *   node script/parse-deployment-validation.js [chainId]
 *   node script/parse-deployment-validation.js 31337
 */
// ESM, no CommonJS: el package.json de la raíz declara "type": "module", así
// que con `require` este script no arrancaba en absoluto — fallaba antes de la
// primera línea útil. Ése es el motivo de que el fichero de despliegue llevara
// tiempo sin regenerarse y le faltaran contratos.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const chainId = process.argv[2] || '31337';
const broadcastDir = path.join(__dirname, '..', 'broadcast', 'DeployValidation.s.sol', chainId);
const runLatest = path.join(broadcastDir, 'run-latest.json');

if (!fs.existsSync(runLatest)) {
    console.error(`No broadcast found at: ${runLatest}`);
    console.error('Run the deployment first:');
    console.error('  forge script script/DeployValidation.s.sol --rpc-url http://localhost:8545 --broadcast');
    process.exit(1);
}

const broadcast = JSON.parse(fs.readFileSync(runLatest, 'utf8'));

// Validation system contracts (all go into "core")
const VALIDATION_CONTRACTS = [
    'ValidatorRegistry',
    'EdgeNodeRewards',
    'SequencerRotation',
    'SlashingManager',
    'TimelockController',
    'GovernanceSystem',
];

// Parse broadcast transactions
const txs = broadcast.transactions || [];
const newAddresses = {};

for (const tx of txs) {
    if (tx.transactionType !== 'CREATE') continue;
    if (VALIDATION_CONTRACTS.includes(tx.contractName)) {
        newAddresses[tx.contractName] = tx.contractAddress;
        console.log(`  ${tx.contractName}: ${tx.contractAddress}`);
    }
}

if (Object.keys(newAddresses).length === 0) {
    console.error('No validation contracts found in broadcast.');
    process.exit(1);
}

// Load existing deployment file
const deploymentsDir = path.join(__dirname, '..', 'deployments');
const outPath = path.join(deploymentsDir, `${chainId}.json`);

let existing = { chainId: parseInt(chainId), timestamp: new Date().toISOString(), core: {}, sectors: {} };
if (fs.existsSync(outPath)) {
    existing = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    console.log(`\nMerging into existing ${chainId}.json (${Object.keys(existing.core).length} core contracts)`);
}

// Merge new addresses into core
for (const [name, address] of Object.entries(newAddresses)) {
    existing.core[name] = address;
}

// Update timestamp
existing.timestamp = new Date().toISOString();

// Write back
if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
}
fs.writeFileSync(outPath, JSON.stringify(existing, null, 2));

console.log(`\nUpdated: ${outPath}`);
console.log(`Core contracts: ${Object.keys(existing.core).length}`);
let sectorCount = 0;
for (const s of Object.values(existing.sectors)) {
    sectorCount += Object.keys(s).length;
}
console.log(`Sector contracts: ${sectorCount}`);
console.log(`Total: ${Object.keys(existing.core).length + sectorCount}`);
