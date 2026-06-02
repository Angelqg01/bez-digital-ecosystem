#!/usr/bin/env node
/**
 * sync-daemon.js — Universal Ecosystem Sync (Write Once, Propagate Everywhere)
 *
 * Reads compiled Foundry artifacts from `smart-contracts/out/` and propagates
 * ABIs + addresses to all dependent modules:
 *
 *   1. api/services/contractService.js   → ABI registry + deployment addresses
 *   2. sdk/src/abi/                       → TypeScript-ready ABI JSON files
 *   3. bezhas-web3/src/abi/ (if exists)  → Frontend ABI copy
 *   4. control-center/frontend/lib/abi/  → Next.js frontend ABI copy
 *   5. agent-runtime/config/contracts.json → Runtime contract registry
 *
 * Usage:
 *   node sync-daemon.js              — Watch mode (auto-detect changes)
 *   node sync-daemon.js --once       — Single run then exit
 *   node sync-daemon.js --contracts BeZhasPayment,BEZCoinV2
 *
 * Protocol: SKILL/UNIVERSAL_SYNC.md — "Write Once, Propagate Everywhere"
 */
'use strict';

const fs = require('fs');
const path = require('path');

// ── Config ──────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname);
const ARTIFACTS_DIR = path.join(ROOT, 'smart-contracts', 'out');
const DEPLOYMENTS_DIR = path.join(ROOT, 'smart-contracts', 'deployments');

/** Contracts to sync (name → Foundry artifact path within out/) */
const CORE_CONTRACTS = [
    'BeZhasPayment',
    'BEZCoinV2',
    'ValidatorRegistry',
    'EdgeNodeRewards',
    'BeZhastreasury',
    'BeZhasBridge',
    'BeZhasGovernance',
    'BeZhasMarketplace',
    'QualityEscrow',
    'BeZhasStaking',
    'BeZhasVesting',
];

/** Destination module configurations */
const DESTINATIONS = [
    {
        name: 'API ABI Registry',
        dir: path.join(ROOT, 'api', 'config', 'abis'),
        type: 'json',
        enabled: true,
    },
    {
        name: 'SDK ABI Pack',
        dir: path.join(ROOT, 'sdk', 'src', 'abi'),
        type: 'json',
        enabled: true,
    },
    {
        name: 'Frontend ABI (Next.js)',
        dir: path.join(ROOT, 'control-center', 'frontend', 'lib', 'abi'),
        type: 'json',
        enabled: true,
    },
    {
        name: 'bezhas-web3 ABI',
        dir: path.join(ROOT, '..', 'bezhas-web3', 'src', 'abi'),
        type: 'json',
        enabled: fs.existsSync(path.join(ROOT, '..', 'bezhas-web3')),
    },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function log(icon, msg) {
    console.log(`[sync-daemon] ${icon}  ${msg}`);
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        log('📁', `Created: ${path.relative(ROOT, dir)}`);
    }
}

/**
 * Find the compiled artifact for a contract name.
 * Foundry places artifacts at: out/<ContractName>.sol/<ContractName>.json
 * Falls back to a recursive search if the standard path doesn't exist.
 */
function findArtifact(contractName) {
    // Standard Foundry path
    const standard = path.join(ARTIFACTS_DIR, `${contractName}.sol`, `${contractName}.json`);
    if (fs.existsSync(standard)) return standard;

    // Search recursively
    function walk(dir) {
        if (!fs.existsSync(dir)) return null;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                const found = walk(full);
                if (found) return found;
            } else if (entry.name === `${contractName}.json`) {
                return full;
            }
        }
        return null;
    }

    return walk(ARTIFACTS_DIR);
}

/**
 * Read deployment address for a contract (if deployed locally).
 * Reads from `smart-contracts/deployments/<network>/<ContractName>.json`
 */
function readDeployment(contractName, network = 'localhost') {
    const deployFile = path.join(DEPLOYMENTS_DIR, network, `${contractName}.json`);
    if (!fs.existsSync(deployFile)) return null;
    try {
        const data = JSON.parse(fs.readFileSync(deployFile, 'utf-8'));
        return data.address || data.deployedTo || null;
    } catch {
        return null;
    }
}

// ── Core Sync Logic ──────────────────────────────────────────────────────────

/**
 * Sync a single contract to all destinations.
 * Returns { name, synced, skipped, error }
 */
function syncContract(contractName, opts = {}) {
    const artifactPath = findArtifact(contractName);

    if (!artifactPath) {
        log('⚠️', `Artifact not found for ${contractName} — compile first with: forge build`);
        return { name: contractName, synced: 0, skipped: 1, error: 'not_found' };
    }

    let artifact;
    try {
        artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));
    } catch (err) {
        log('❌', `Failed to parse artifact for ${contractName}: ${err.message}`);
        return { name: contractName, synced: 0, skipped: 1, error: err.message };
    }

    const abi = artifact.abi;
    if (!abi || !Array.isArray(abi)) {
        log('⚠️', `No ABI found in artifact for ${contractName}`);
        return { name: contractName, synced: 0, skipped: 1, error: 'no_abi' };
    }

    const deployment = readDeployment(contractName, opts.network || 'localhost');

    const output = {
        contractName,
        abi,
        bytecodeHash: artifact.bytecode?.object
            ? require('crypto').createHash('sha256').update(artifact.bytecode.object).digest('hex').slice(0, 16)
            : null,
        address: deployment,
        syncedAt: new Date().toISOString(),
        compiler: artifact.metadata?.compiler?.version || 'unknown',
    };

    let synced = 0;

    for (const dest of DESTINATIONS) {
        if (!dest.enabled) continue;

        ensureDir(dest.dir);
        const targetFile = path.join(dest.dir, `${contractName}.json`);

        try {
            fs.writeFileSync(targetFile, JSON.stringify(output, null, 2), 'utf-8');
            synced++;
        } catch (err) {
            log('❌', `Failed to write to ${dest.name}: ${err.message}`);
        }
    }

    // Write to agent-runtime contract registry
    updateAgentRuntimeRegistry(contractName, output);

    log('✅', `${contractName} → ${synced} destinations ${deployment ? `@ ${deployment.slice(0, 8)}...` : '(no deploy)'}`);
    return { name: contractName, synced, skipped: 0, error: null };
}

/**
 * Update the agent-runtime contract registry JSON.
 * This is a single JSON file that the AI agent uses to look up contracts.
 */
function updateAgentRuntimeRegistry(contractName, output) {
    const registryDir = path.join(ROOT, 'agent-runtime', 'config');
    const registryPath = path.join(registryDir, 'contracts.json');

    ensureDir(registryDir);

    let registry = {};
    if (fs.existsSync(registryPath)) {
        try {
            registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
        } catch { registry = {}; }
    }

    registry[contractName] = {
        address: output.address,
        bytecodeHash: output.bytecodeHash,
        abiPath: `./config/abis/${contractName}.json`,
        syncedAt: output.syncedAt,
        compiler: output.compiler,
    };

    registry._lastSync = new Date().toISOString();
    registry._contracts = Object.keys(registry).filter(k => !k.startsWith('_')).length;

    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf-8');

    // Also write ABI to agent-runtime/config/abis/
    const abiDir = path.join(registryDir, 'abis');
    ensureDir(abiDir);
    fs.writeFileSync(path.join(abiDir, `${contractName}.json`), JSON.stringify({ abi: output.abi, address: output.address }, null, 2));
}

/**
 * Generate a sync report and save it.
 */
function writeSyncReport(results) {
    const report = {
        timestamp: new Date().toISOString(),
        totalContracts: results.length,
        synced: results.filter(r => r.synced > 0).length,
        skipped: results.filter(r => r.error).length,
        destinations: DESTINATIONS.filter(d => d.enabled).map(d => ({
            name: d.name,
            dir: path.relative(ROOT, d.dir),
        })),
        contracts: results,
    };

    const reportPath = path.join(ROOT, 'SKILL', 'sync-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    log('📄', `Sync report saved to SKILL/sync-report.json`);

    return report;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function runSync(contractFilter = null) {
    const contracts = contractFilter
        ? CORE_CONTRACTS.filter(c => contractFilter.includes(c))
        : CORE_CONTRACTS;

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  BeZhas Sync Daemon — Universal ABI Propagation');
    console.log(`  Contracts: ${contracts.length} | Mode: ${contractFilter ? 'filtered' : 'full'}`);
    console.log('═══════════════════════════════════════════════════════\n');

    if (!fs.existsSync(ARTIFACTS_DIR)) {
        log('❌', `Artifacts directory not found: ${ARTIFACTS_DIR}`);
        log('💡', 'Run: cd smart-contracts && forge build');
        process.exit(1);
    }

    const results = [];
    for (const contractName of contracts) {
        const result = syncContract(contractName);
        results.push(result);
    }

    const report = writeSyncReport(results);

    console.log('\n─────────────────────────────────────────────────────');
    console.log(`  ✅ Synced:  ${report.synced}/${report.totalContracts} contracts`);
    console.log(`  ⚠️  Skipped: ${report.skipped} (artifacts missing — run forge build)`);
    console.log('─────────────────────────────────────────────────────\n');

    return report;
}

// ── Watch Mode ────────────────────────────────────────────────────────────────

function startWatcher() {
    log('👁️', `Watching ${path.relative(ROOT, ARTIFACTS_DIR)} for changes...`);
    log('💡', 'Press Ctrl+C to stop.\n');

    let debounceTimer = null;

    fs.watch(ARTIFACTS_DIR, { recursive: true }, (evt, filename) => {
        if (!filename || !filename.endsWith('.json')) return;

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            // Extract contract name from path (e.g., "BeZhasPayment.sol/BeZhasPayment.json")
            const match = filename.match(/^([^/\\]+)\.sol[/\\]\1\.json$/);
            if (match) {
                log('🔄', `Change detected: ${match[1]}`);
                syncContract(match[1]);
            } else {
                log('🔄', `Change detected: ${filename} — running full sync`);
                runSync();
            }
        }, 500);
    });
}

// ── CLI Entry Point ───────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isOnce = args.includes('--once');
const contractsArg = args.find(a => a.startsWith('--contracts='));
const contractFilter = contractsArg
    ? contractsArg.split('=')[1].split(',').map(c => c.trim())
    : null;

runSync(contractFilter).then(report => {
    if (isOnce || !fs.existsSync(ARTIFACTS_DIR)) {
        process.exit(report.skipped === report.totalContracts ? 1 : 0);
    } else {
        startWatcher();
    }
}).catch(err => {
    console.error('[sync-daemon] Fatal error:', err);
    process.exit(1);
});
