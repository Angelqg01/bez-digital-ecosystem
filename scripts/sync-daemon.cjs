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
const crypto = require('crypto');

// ── Config ──────────────────────────────────────────────────────────────────

// This file lives in scripts/, one level below the repo root — every
// destination below is relative to the repo root, not to scripts/.
const ROOT = path.resolve(__dirname, '..');
const ARTIFACTS_DIR = path.join(ROOT, 'smart-contracts', 'out');
const DEPLOYMENTS_DIR = path.join(ROOT, 'smart-contracts', 'deployments');
const SYNC_LOG_PATH = path.join(__dirname, 'status', 'sync.log');

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
        // control-center/frontend/lib/{validator-hooks,wallet-hooks}.ts pass this
        // file straight into `new ethers.Contract(addr, abi, provider)` — it must
        // stay a bare ABI array, not the {contractName, abi, ...} wrapper.
        bareAbi: true,
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
    const line = `[sync-daemon] ${icon}  ${msg}`;
    console.log(line);
    // Sync rule #3 (CLAUDE.md): loggear todo en sync.log.
    try {
        fs.mkdirSync(path.dirname(SYNC_LOG_PATH), { recursive: true });
        fs.appendFileSync(SYNC_LOG_PATH, `${new Date().toISOString()} ${line}\n`, 'utf-8');
    } catch {
        // best-effort logging only — never crash the sync over a log write
    }
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        log('📁', `Created: ${path.relative(ROOT, dir)}`);
    }
}

function hashOf(obj) {
    return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

/**
 * Writes `data` to `targetFile` unless it's unchanged from what's already on
 * disk (sync rule #1: never overwrite an ABI whose hash hasn't changed).
 * When content *has* changed, the previous file is preserved as `.bak`
 * before being overwritten (sync rule #2).
 *
 * `data` is normally the {contractName, abi, ..., _sig} wrapper, compared via
 * its embedded `_sig`. With `{ bareArray: true }` (consumers that need a
 * plain ABI array with no wrapper — a JS array can't carry a `_sig` prop and
 * round-trip through JSON), `data` is written as-is and compared by hashing
 * both the incoming and on-disk array directly.
 */
function writeIfChanged(targetFile, data, { bareArray = false } = {}) {
    if (fs.existsSync(targetFile)) {
        try {
            const existing = JSON.parse(fs.readFileSync(targetFile, 'utf-8'));
            const unchanged = bareArray
                ? hashOf(existing) === hashOf(data)
                : existing._sig && existing._sig === data._sig;
            if (unchanged) return { written: false };
        } catch {
            // unreadable/corrupt existing file — fall through and overwrite
        }
        try {
            fs.copyFileSync(targetFile, `${targetFile}.bak`);
        } catch (err) {
            log('⚠️', `Could not write .bak for ${path.relative(ROOT, targetFile)}: ${err.message}`);
        }
    }
    fs.writeFileSync(targetFile, JSON.stringify(data, null, 2), 'utf-8');
    return { written: true };
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

    const bytecodeHash = artifact.bytecode?.object
        ? crypto.createHash('sha256').update(artifact.bytecode.object).digest('hex').slice(0, 16)
        : null;
    const compiler = artifact.metadata?.compiler?.version || 'unknown';

    const output = {
        contractName,
        abi,
        bytecodeHash,
        address: deployment,
        syncedAt: new Date().toISOString(),
        compiler,
        // Content signature over the fields that actually matter (excludes
        // syncedAt) — this is what writeIfChanged() compares run-to-run.
        _sig: hashOf({ contractName, abi, bytecodeHash, address: deployment, compiler }),
    };

    let synced = 0;
    let unchanged = 0;

    for (const dest of DESTINATIONS) {
        if (!dest.enabled) continue;

        ensureDir(dest.dir);
        const targetFile = path.join(dest.dir, `${contractName}.json`);

        try {
            const result = dest.bareAbi
                ? writeIfChanged(targetFile, abi, { bareArray: true })
                : writeIfChanged(targetFile, output);
            if (result.written) synced++;
            else unchanged++;
        } catch (err) {
            log('❌', `Failed to write to ${dest.name}: ${err.message}`);
        }
    }

    // Write to agent-runtime contract registry
    updateAgentRuntimeRegistry(contractName, output);

    const suffix = deployment ? `@ ${deployment.slice(0, 8)}...` : '(no deploy)';
    if (synced === 0 && unchanged > 0) {
        log('⏭️', `${contractName} unchanged — skipped ${unchanged} destination(s) ${suffix}`);
    } else {
        log('✅', `${contractName} → ${synced} written, ${unchanged} unchanged ${suffix}`);
    }
    return { name: contractName, synced, unchanged, skipped: 0, error: null };
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

    // The aggregate index always rewrites (it carries _lastSync on purpose).
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf-8');

    // Also write ABI to agent-runtime/config/abis/ — hash-skipped like the
    // other destinations so an unrelated contract's sync doesn't touch this.
    const abiDir = path.join(registryDir, 'abis');
    ensureDir(abiDir);
    const abiEntry = { abi: output.abi, address: output.address };
    abiEntry._sig = hashOf(abiEntry);
    writeIfChanged(path.join(abiDir, `${contractName}.json`), abiEntry);
}

/**
 * Generate a sync report and save it.
 */
function writeSyncReport(results) {
    const report = {
        timestamp: new Date().toISOString(),
        totalContracts: results.length,
        synced: results.filter(r => r.synced > 0).length,
        unchanged: results.filter(r => r.synced === 0 && !r.error).length,
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
    console.log(`  ✅ Synced:    ${report.synced}/${report.totalContracts} contracts (files written)`);
    console.log(`  ⏭️  Unchanged: ${report.unchanged} (hash identical — write skipped)`);
    console.log(`  ⚠️  Skipped:   ${report.skipped} (artifacts missing — run forge build)`);
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
