#!/usr/bin/env node
/**
 * ecosystem-audit.cjs — BeZhas Ecosystem Readiness Audit
 * 
 * Comprehensive automated audit of all infrastructure layers.
 * Generates a detailed report showing what's operational, what's pending,
 * and what needs attention before testnet deployment.
 * 
 * Usage: node scripts/ecosystem-audit.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ABI_DIR = path.join(ROOT, 'smart-contracts', 'abi');
const OUT_DIR = path.join(ROOT, 'smart-contracts', 'out');
const DEPLOY_FILE = path.join(ROOT, 'smart-contracts', 'deployments', '31337.json');
const MANIFEST = path.join(ABI_DIR, 'manifest.json');

const report = [];
const scores = { total: 0, passed: 0 };

function section(name) {
    report.push(`\n${'═'.repeat(60)}`);
    report.push(`  ${name}`);
    report.push('═'.repeat(60));
}

function check(name, passed, detail = '') {
    scores.total++;
    if (passed) scores.passed++;
    const icon = passed ? '✅' : '❌';
    report.push(`  ${icon} ${name}${detail ? ` — ${detail}` : ''}`);
    return passed;
}

function info(msg) {
    report.push(`     ℹ️  ${msg}`);
}

// ── Data Loaders ──────────────────────────────
let deploy = {};
try { deploy = JSON.parse(fs.readFileSync(DEPLOY_FILE, 'utf-8')); } catch {}

let manifest = {};
try { manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf-8')); } catch {}

const countAddresses = (obj, depth = 0) => {
    let count = 0;
    if (depth > 5) return count;
    for (const v of Object.values(obj || {})) {
        if (typeof v === 'string' && /^0x[a-fA-F0-9]{40}$/.test(v)) count++;
        else if (typeof v === 'object' && v !== null) count += countAddresses(v, depth + 1);
    }
    return count;
};

// ════════════════════════════════════════════════════
//  LAYER 1: SMART CONTRACTS
// ════════════════════════════════════════════════════
section('LAYER 1: SMART CONTRACTS');

const solFiles = [];
function findSol(dir) {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir)) {
        const fp = path.join(dir, f);
        if (fs.statSync(fp).isDirectory()) findSol(fp);
        else if (f.endsWith('.sol') && !f.endsWith('.t.sol') && !f.endsWith('.s.sol')) solFiles.push(f);
    }
}
findSol(path.join(ROOT, 'smart-contracts', 'src'));
check('Solidity contracts exist', solFiles.length > 0, `${solFiles.length} .sol files`);

// Compiled output
const outDirs = fs.existsSync(OUT_DIR) ? fs.readdirSync(OUT_DIR).filter(f => fs.statSync(path.join(OUT_DIR, f)).isDirectory()) : [];
check('Foundry compiled output', outDirs.length > 0, `${outDirs.length} compiled contracts`);

// ABIs
const abiFiles = fs.existsSync(ABI_DIR) ? fs.readdirSync(ABI_DIR).filter(f => f.endsWith('.json') && f !== 'manifest.json') : [];
check('Clean ABI exports', abiFiles.length >= 88, `${abiFiles.length}/88 ABIs`);
check('ABI manifest', fs.existsSync(MANIFEST), `${Object.keys(manifest.contracts || {}).length} entries`);

// Deployment addresses
const coreCount = countAddresses(deploy.core);
const sectorCount = countAddresses(deploy.sectors);
const walletCount = countAddresses(deploy.wallet);
const totalAddresses = coreCount + sectorCount + walletCount;
check('Deployment addresses (core)', coreCount >= 7, `${coreCount} core addresses`);
check('Deployment addresses (sectors)', sectorCount >= 60, `${sectorCount} sector addresses`);
check('Deployment addresses (wallet)', walletCount >= 5, `${walletCount} wallet addresses`);
check('Total deployment coverage', totalAddresses >= 80, `${totalAddresses} total`);

// Sector coverage
const expectedSectors = ['health','energy','automotive','manufacturing','agriculture','insurance','education','entertainment','legal','supplychain','government','finance','services','otros'];
let sectorsMissing = [];
for (const s of expectedSectors) {
    if (!deploy.sectors?.[s] || Object.keys(deploy.sectors[s]).length === 0) sectorsMissing.push(s);
}
check('All 14 sectors have contracts', sectorsMissing.length === 0, sectorsMissing.length ? `Missing: ${sectorsMissing.join(',')}` : '14/14');

// ════════════════════════════════════════════════════
//  LAYER 2: SDK
// ════════════════════════════════════════════════════
section('LAYER 2: SDK');

let sdk = null;
try {
    sdk = require('../sdk/contracts');
    const contracts = sdk.listContracts();
    check('SDK loaded', true, `${contracts.length} contracts`);
    check('SDK getABI works', !!sdk.getABI('BEZCoinV2'), 'BEZCoinV2');
    check('SDK getContract works', !!sdk.getContract('BEZCoinV2', 'localhost'), 'BEZCoinV2');
    
    let missingAbis = 0;
    for (const name of contracts) {
        if (!sdk.getABI(name)) missingAbis++;
    }
    check('All SDK contracts have ABIs', missingAbis === 0, `${contracts.length - missingAbis}/${contracts.length}`);
} catch (err) {
    check('SDK loaded', false, err.message);
}

// ════════════════════════════════════════════════════
//  LAYER 3: API
// ════════════════════════════════════════════════════
section('LAYER 3: API GATEWAY');

const apiDir = path.join(ROOT, 'api');
check('API directory exists', fs.existsSync(apiDir));

// Routes
const routeFiles = fs.existsSync(path.join(apiDir, 'routes'))
    ? fs.readdirSync(path.join(apiDir, 'routes')).filter(f => f.endsWith('.js'))
    : [];
check('API route files', routeFiles.length >= 5, `${routeFiles.length} routes`);

// Key routes
const abiRouteContent = fs.existsSync(path.join(apiDir, 'routes', 'contracts-abi.js'))
    ? fs.readFileSync(path.join(apiDir, 'routes', 'contracts-abi.js'), 'utf-8')
    : '';
check('Public /catalog endpoint', abiRouteContent.includes("'/catalog'"));
check('Public /sector/:sector endpoint', abiRouteContent.includes("'/sector/:sector'"));
check('Public /abi-public/:name endpoint', abiRouteContent.includes("'/abi-public/:name'"));

// Gateway
const gatewayContent = fs.existsSync(path.join(apiDir, 'routes', 'gateway.js'))
    ? fs.readFileSync(path.join(apiDir, 'routes', 'gateway.js'), 'utf-8')
    : '';
check('Gateway SSO endpoints', gatewayContent.includes('/sso/login'));
check('Gateway wallet endpoints', gatewayContent.includes('/wallet/balance'));
check('Gateway staking endpoints', gatewayContent.includes('/staking/positions'));
check('Gateway DEX endpoints', gatewayContent.includes('/dex/swap'));
check('Gateway payments endpoints', gatewayContent.includes('/payments/buy'));
check('Gateway bridge endpoints', gatewayContent.includes('/bridge/initiate'));
check('Gateway governance endpoints', gatewayContent.includes('/governance/proposals'));

// Webhooks
const webhookContent = fs.existsSync(path.join(apiDir, 'routes', 'webhooks.js'))
    ? fs.readFileSync(path.join(apiDir, 'routes', 'webhooks.js'), 'utf-8')
    : '';
check('Stripe webhook handler', webhookContent.includes("'/stripe'"));
check('Bank webhook handler', webhookContent.includes("'/bank'"));
check('Mint function (Fiat→BEZ)', webhookContent.includes('mintBezTokens'));
check('Retry queue', webhookContent.includes('RetryQueue'));
check('Idempotency protection', webhookContent.includes('processedEvents'));

// Services
const serviceDir = path.join(apiDir, 'services');
const serviceFiles = fs.existsSync(serviceDir) ? fs.readdirSync(serviceDir).filter(f => f.endsWith('.js')) : [];
check('API services', serviceFiles.length >= 3, `${serviceFiles.length} services`);

// ════════════════════════════════════════════════════
//  LAYER 4: SUBAPPS
// ════════════════════════════════════════════════════
section('LAYER 4: SUBAPP INTEGRATION');

const appsDir = path.join(ROOT, "App's secundarias");
const sharedClient = path.join(appsDir, '_shared', 'bezhas-blockchain-client.js');
check('Shared blockchain client', fs.existsSync(sharedClient));

const subapps = [
    { name: 'bez-energy', api: 'src/api.js', checkStr: 'bezhas-blockchain-client' },
    { name: 'BZ PureScan', api: 'src/api.js', checkStr: 'bezhas-blockchain-client' },
    { name: 'BZ CargoLink', api: 'src/services/blockchainService.js', checkStr: 'bezhas-blockchain-client' },
    { name: 'bez-wallet', api: 'src/services/walletBlockchainService.js', checkStr: 'BeZhasClient' },
    { name: 'edge-node-manager', api: 'src/services/nodeBlockchainService.js', checkStr: 'BeZhasClient' },
    { name: 'gas-tank-manager', api: 'src/services/blockchainService.js', checkStr: 'BeZhasClient' },
    { name: 'BZ Genesis', api: 'src/services/blockchainService.js', checkStr: 'BeZhasClient' },
    { name: 'BZ Prestige', api: 'src/services/blockchainService.js', checkStr: 'BeZhasClient' },
    { name: 'BZ Sphere', api: 'src/services/blockchainService.js', checkStr: 'BeZhasClient' },
    { name: 'bezhas-pay-manager', api: 'src/services/blockchainService.js', checkStr: 'BeZhasClient' },
    { name: 'bez-vision-scan', api: 'src/services/blockchainService.js', checkStr: 'BeZhasClient' },
    { name: 'Bezhas-Hub', api: 'frontend/src/services/hubBlockchainService.js', checkStr: 'BeZhasClient' },
];

for (const app of subapps) {
    const filePath = path.join(appsDir, app.name, app.api);
    const exists = fs.existsSync(filePath);
    const hasImport = exists ? fs.readFileSync(filePath, 'utf-8').includes(app.checkStr) : false;
    check(`${app.name} blockchain integration`, exists && hasImport, exists ? (hasImport ? 'connected' : 'file exists, no import') : 'missing');
}

// Deprecated SubApps (excluded from pending)
const deprecatedApps = ['BEZ_Scaner'];

// Remaining SubApps (frontend-only)
const allApps = fs.existsSync(appsDir) 
    ? fs.readdirSync(appsDir).filter(f => fs.statSync(path.join(appsDir, f)).isDirectory() && !f.startsWith('.') && !f.startsWith('_') && f !== 'node_modules' && f !== 'packages')
    : [];
const integratedApps = subapps.map(s => s.name);
const pendingApps = allApps.filter(a => !integratedApps.includes(a) && !deprecatedApps.includes(a) && fs.existsSync(path.join(appsDir, a, 'src')));
if (deprecatedApps.length > 0) info(`Deprecated SubApps (excluded): ${deprecatedApps.join(', ')}`);
info(`Remaining SubApps without blockchain: ${pendingApps.length}${pendingApps.length > 0 ? ' — ' + pendingApps.join(', ') : ''}`);

// ════════════════════════════════════════════════════
//  LAYER 5: OPENCLAW (MCP SKILLS)
// ════════════════════════════════════════════════════
section('LAYER 5: OPENCLAW MCP SKILLS');

const skillsDir = path.join(ROOT, 'openclaw-skills');
check('Contract resolver module', fs.existsSync(path.join(skillsDir, 'contract-resolver.js')));

const energySkill = path.join(skillsDir, 'energy-vpp-skill.js');
const energySkillOk = fs.existsSync(energySkill) && fs.readFileSync(energySkill, 'utf-8').includes('resolveAddress');
check('Energy VPP skill (dynamic)', energySkillOk, energySkillOk ? '15 tools, dynamic resolution' : 'needs update');

// Skill definitions
const skillDirs = fs.existsSync(skillsDir) 
    ? fs.readdirSync(skillsDir).filter(f => fs.statSync(path.join(skillsDir, f)).isDirectory())
    : [];
check('Skill definitions', skillDirs.length >= 5, `${skillDirs.length} skills defined`);

// ════════════════════════════════════════════════════
//  LAYER 6: INFRASTRUCTURE SERVICES
// ════════════════════════════════════════════════════
section('LAYER 6: INFRASTRUCTURE');

check('Bridge relay service', fs.existsSync(path.join(ROOT, 'services', 'bridge-relay.cjs')));
check('ABI extraction script', fs.existsSync(path.join(ROOT, 'scripts', 'extract-abis.cjs')));
check('Deployment sync script', fs.existsSync(path.join(ROOT, 'scripts', 'sync-deployment.cjs')));
check('Integration test suite', fs.existsSync(path.join(ROOT, 'scripts', 'integration-test.cjs')));
check('Deploy script (live)', fs.existsSync(path.join(ROOT, 'scripts', 'deploy-missing.cjs')));
check('Deploy script (deterministic)', fs.existsSync(path.join(ROOT, 'scripts', 'deploy-missing-inmemory.cjs')));

// Package management
check('package.json', fs.existsSync(path.join(ROOT, 'package.json')));
check('ethers.js installed', (() => { try { require('ethers'); return true; } catch { return false; } })());

// ════════════════════════════════════════════════════
//  LAYER 7: PRODUCTION TOKEN (BEZ-Coin v1)
// ════════════════════════════════════════════════════
section('LAYER 7: PRODUCTION TOKEN');

const BEZ_V1 = 'EcBa873B534C54DE2B62acDE232ADCa4369f11A8';
const tokenFiles = [
    { path: 'api/routes/webhooks.js', desc: 'Webhooks (Fiat→BEZ)' },
    { path: 'api/routes/gateway.js', desc: 'API Gateway' },
    { path: 'openclaw-skills/contract-resolver.js', desc: 'OpenClaw Resolver' },
    { path: 'services/bridge-relay.cjs', desc: 'Bridge Relay' },
    { path: "App's secundarias/_shared/bezhas-blockchain-client.js", desc: 'Shared Client' },
];
for (const tf of tokenFiles) {
    const fp = path.join(ROOT, tf.path);
    const has = fs.existsSync(fp) && fs.readFileSync(fp, 'utf-8').includes(BEZ_V1);
    check(`BEZ-Coin v1 in ${tf.desc}`, has);
}

// Production deployment file
const prodDeploy = path.join(ROOT, 'smart-contracts', 'deployments', '56.json');
const hasProdDeploy = fs.existsSync(prodDeploy);
check('BSC deployment file (56.json)', hasProdDeploy);
if (hasProdDeploy) {
    const prod = JSON.parse(fs.readFileSync(prodDeploy, 'utf-8'));
    check('BSC deployment has BEZCoin address', prod.core?.BEZCoin?.includes(BEZ_V1) || false);
}

// .env.example
const envExample = path.join(ROOT, '.env.example');
const hasEnvExample = fs.existsSync(envExample) && fs.readFileSync(envExample, 'utf-8').includes(BEZ_V1);
check('.env.example has BEZ-Coin v1', hasEnvExample);

// ════════════════════════════════════════════════════
//  SUMMARY
// ════════════════════════════════════════════════════
const pct = Math.round((scores.passed / scores.total) * 100);

report.push(`\n${'═'.repeat(60)}`);
report.push('  ECOSYSTEM READINESS SCORE');
report.push('═'.repeat(60));
report.push(`  ✅ Passed:  ${scores.passed}`);
report.push(`  ❌ Failed:  ${scores.total - scores.passed}`);
report.push(`  Total:     ${scores.total}`);
report.push(`  Score:     ${pct}%`);
report.push('');

if (pct >= 90) {
    report.push('  🎉 PRODUCTION READY — Ready for testnet deployment!');
} else if (pct >= 75) {
    report.push('  ✨ NEAR READY — Minor items remaining before testnet.');
} else if (pct >= 50) {
    report.push('  🔧 IN PROGRESS — Core infrastructure operational.');
} else {
    report.push('  ⚠️  EARLY STAGE — Significant work remaining.');
}

report.push('═'.repeat(60));

// Output
const output = report.join('\n');
console.log(output);

// Save report
const reportFile = path.join(ROOT, 'ECOSYSTEM-STATUS.txt');
fs.writeFileSync(reportFile, output + '\n');
console.log(`\n📄 Report saved to ECOSYSTEM-STATUS.txt`);
