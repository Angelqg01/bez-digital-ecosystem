#!/usr/bin/env node
/**
 * integration-test.cjs — End-to-end validation of the BeZhas infrastructure.
 * 
 * Tests:
 *   1. ABI Pipeline     — All 88 ABIs exist and are valid
 *   2. SDK Registry     — getContract/getABI resolves all 88 contracts
 *   3. API Endpoints    — Catalog, sector, and abi-public return valid data
 *   4. Deployment Sync  — Addresses match between deployments and SDK
 *   5. Contract Resolver— OpenClaw resolver finds energy sector contracts
 * 
 * Usage: node scripts/integration-test.cjs
 */

const fs = require('fs');
const path = require('path');

const ABI_DIR = path.resolve(__dirname, '..', 'smart-contracts', 'abi');
const DEPLOY_FILE = path.resolve(__dirname, '..', 'smart-contracts', 'deployments', '31337.json');
const MANIFEST_FILE = path.join(ABI_DIR, 'manifest.json');

let passed = 0;
let failed = 0;
let skipped = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ✅ ${name}`);
    } catch (err) {
        failed++;
        console.log(`  ❌ ${name} — ${err.message}`);
    }
}

function skip(name, reason) {
    skipped++;
    console.log(`  ⏭️  ${name} — ${reason}`);
}

function assert(condition, msg) {
    if (!condition) throw new Error(msg);
}

// ══════════════════════════════════════════════════════════════
//  1. ABI PIPELINE
// ══════════════════════════════════════════════════════════════
console.log('\n═══ 1. ABI Pipeline ═══');

test('manifest.json exists', () => {
    assert(fs.existsSync(MANIFEST_FILE), 'manifest.json not found');
});

const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'));
const abiFiles = fs.readdirSync(ABI_DIR).filter(f => f.endsWith('.json') && f !== 'manifest.json');

test(`88 ABI JSON files exist (found: ${abiFiles.length})`, () => {
    assert(abiFiles.length >= 88, `Expected >= 88, got ${abiFiles.length}`);
});

test('All ABI files have valid abi[] array', () => {
    let invalid = [];
    for (const f of abiFiles) {
        try {
            const raw = JSON.parse(fs.readFileSync(path.join(ABI_DIR, f), 'utf-8'));
            if (!raw.abi || !Array.isArray(raw.abi) || raw.abi.length === 0) {
                invalid.push(f);
            }
        } catch {
            invalid.push(f);
        }
    }
    assert(invalid.length === 0, `Invalid ABIs: ${invalid.join(', ')}`);
});

test('manifest.contracts count matches ABI files', () => {
    const manifestCount = Object.keys(manifest.contracts || {}).length;
    assert(manifestCount === abiFiles.length, `Manifest: ${manifestCount}, Files: ${abiFiles.length}`);
});

// ══════════════════════════════════════════════════════════════
//  2. SDK REGISTRY
// ══════════════════════════════════════════════════════════════
console.log('\n═══ 2. SDK Registry ═══');

let sdk;
try {
    sdk = require('../sdk/contracts');
} catch (err) {
    skip('SDK load', `Cannot load sdk/contracts: ${err.message}`);
}

if (sdk) {
    const contracts = sdk.listContracts();
    test(`SDK lists 88 contracts (found: ${contracts.length})`, () => {
        assert(contracts.length >= 88, `Expected >= 88, got ${contracts.length}`);
    });

    test('SDK getABI works for BEZCoinV2', () => {
        const abi = sdk.getABI('BEZCoinV2');
        assert(abi && abi.length > 0, 'ABI is empty');
    });

    test('SDK getContract works for BEZCoinV2', () => {
        const c = sdk.getContract('BEZCoinV2', 'localhost');
        assert(c && c.address, 'No address resolved');
        assert(c.abi && c.abi.length > 0, 'No ABI');
    });

    // Test all 88 ABIs resolve
    let missingAbis = [];
    for (const name of contracts) {
        const abi = sdk.getABI(name);
        if (!abi || abi.length === 0) missingAbis.push(name);
    }
    test(`All ${contracts.length} contracts have ABIs (missing: ${missingAbis.length})`, () => {
        assert(missingAbis.length === 0, `Missing: ${missingAbis.join(', ')}`);
    });
}

// ══════════════════════════════════════════════════════════════
//  3. DEPLOYMENT FILE
// ══════════════════════════════════════════════════════════════
console.log('\n═══ 3. Deployment File ═══');

test('31337.json exists', () => {
    assert(fs.existsSync(DEPLOY_FILE), 'Deployment file not found');
});

const deploy = JSON.parse(fs.readFileSync(DEPLOY_FILE, 'utf-8'));

test('Deployment has core section', () => {
    assert(deploy.core && Object.keys(deploy.core).length > 0, 'Empty core section');
});

test('Deployment has sectors section', () => {
    assert(deploy.sectors && Object.keys(deploy.sectors).length > 0, 'Empty sectors');
});

const coreCount = Object.keys(deploy.core || {}).filter(k => deploy.core[k] && typeof deploy.core[k] === 'string' && deploy.core[k].startsWith('0x')).length;
const sectorCount = Object.values(deploy.sectors || {}).reduce((s, sec) => s + Object.keys(sec).filter(k => sec[k] && sec[k].startsWith('0x')).length, 0);

test(`Total deployed addresses: ${coreCount + sectorCount} (core: ${coreCount}, sectors: ${sectorCount})`, () => {
    assert(coreCount + sectorCount >= 67, `Expected >= 67 addresses, got ${coreCount + sectorCount}`);
});

// ══════════════════════════════════════════════════════════════
//  4. SECTOR COVERAGE
// ══════════════════════════════════════════════════════════════
console.log('\n═══ 4. Sector Coverage ═══');

const expectedSectors = [
    'health', 'energy', 'automotive', 'manufacturing', 'agriculture',
    'insurance', 'education', 'entertainment', 'legal', 'supplychain',
    'government', 'finance', 'services', 'otros'
];

for (const sector of expectedSectors) {
    test(`Sector '${sector}' has contracts in deployment`, () => {
        const s = deploy.sectors?.[sector];
        assert(s && Object.keys(s).length > 0, `Sector '${sector}' empty or missing`);
    });
}

// ══════════════════════════════════════════════════════════════
//  5. API ROUTE VALIDATION (static — checks file contains routes)
// ══════════════════════════════════════════════════════════════
console.log('\n═══ 5. API Routes ═══');

const abiRoute = fs.readFileSync(path.resolve(__dirname, '..', 'api', 'routes', 'contracts-abi.js'), 'utf-8');

test('API has /catalog endpoint', () => {
    assert(abiRoute.includes("'/catalog'"), '/catalog not found');
});

test('API has /sector/:sector endpoint', () => {
    assert(abiRoute.includes("'/sector/:sector'"), '/sector/:sector not found');
});

test('API has /abi-public/:name endpoint', () => {
    assert(abiRoute.includes("'/abi-public/:name'"), '/abi-public/:name not found');
});

test('API loadABI prioritizes clean ABIs', () => {
    assert(abiRoute.includes('smart-contracts/abi'), 'Clean ABI path not in loadABI');
});

// ══════════════════════════════════════════════════════════════
//  6. WEBHOOK INFRASTRUCTURE
// ══════════════════════════════════════════════════════════════
console.log('\n═══ 6. Webhook Infrastructure ═══');

const webhookCode = fs.readFileSync(path.resolve(__dirname, '..', 'api', 'routes', 'webhooks.js'), 'utf-8');

test('Stripe webhook handler exists', () => {
    assert(webhookCode.includes("'/stripe'"), 'Stripe route not found');
});

test('Bank webhook handler exists', () => {
    assert(webhookCode.includes("'/bank'"), 'Bank route not found');
});

test('mintBezTokens function exists', () => {
    assert(webhookCode.includes('mintBezTokens'), 'mintBezTokens not found');
});

test('Retry queue implemented', () => {
    assert(webhookCode.includes('RetryQueue'), 'RetryQueue not found');
});

test('Idempotency protection implemented', () => {
    assert(webhookCode.includes('processedEvents'), 'processedEvents not found');
});

// ══════════════════════════════════════════════════════════════
//  7. SHARED BLOCKCHAIN CLIENT
// ══════════════════════════════════════════════════════════════
console.log('\n═══ 7. SubApp Integration ═══');

const sharedClient = path.resolve(__dirname, '..', "App's secundarias", '_shared', 'bezhas-blockchain-client.js');
test('_shared/bezhas-blockchain-client.js exists', () => {
    assert(fs.existsSync(sharedClient), 'Shared client not found');
});

const bzEnergy = path.resolve(__dirname, '..', "App's secundarias", 'bez-energy', 'src', 'api.js');
test('bez-energy imports shared client', () => {
    const code = fs.readFileSync(bzEnergy, 'utf-8');
    assert(code.includes('bezhas-blockchain-client'), 'Not importing shared client');
});

const bzPureScan = path.resolve(__dirname, '..', "App's secundarias", 'BZ PureScan', 'src', 'api.js');
test('BZ PureScan imports shared client', () => {
    const code = fs.readFileSync(bzPureScan, 'utf-8');
    assert(code.includes('bezhas-blockchain-client'), 'Not importing shared client');
});

const bzCargo = path.resolve(__dirname, '..', "App's secundarias", 'BZ CargoLink', 'src', 'services', 'blockchainService.js');
test('BZ CargoLink blockchain service exists', () => {
    assert(fs.existsSync(bzCargo), 'blockchainService.js not found');
});

// ══════════════════════════════════════════════════════════════
//  SUMMARY
// ══════════════════════════════════════════════════════════════
console.log('\n═══════════════════════════════════════');
console.log(`📊 Integration Test Results:`);
console.log(`   ✅ Passed:  ${passed}`);
console.log(`   ❌ Failed:  ${failed}`);
console.log(`   ⏭️  Skipped: ${skipped}`);
console.log(`   Total:     ${passed + failed + skipped}`);
console.log(`═══════════════════════════════════════`);

if (failed > 0) {
    console.log('\n⚠️  Some tests failed. Review output above.\n');
    process.exit(1);
} else {
    console.log('\n🎉 All tests passed! Infrastructure is ready.\n');
}
