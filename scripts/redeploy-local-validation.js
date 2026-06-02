#!/usr/bin/env node
/**
 * scripts/redeploy-local-validation.js
 *
 * Runner para redeploy local (Anvil) con DeployAll actualizado (incluye validación).
 * Objetivo: regenerar smart-contracts/deployments/<chainId>.json con direcciones
 * de ValidatorRegistry/EdgeNodeRewards/SequencerRotation/SlashingManager.
 *
 * Uso:
 *   node scripts/redeploy-local-validation.js --chainId 31337 --rpcUrl http://localhost:8545 \
 *     --privateKey <DEPLOYER_PRIVATE_KEY> --seedDb
 *
 * Flags:
 *   --seedDb  : corre api/db/seed-contracts.js para poblar contract_addresses
 *   --resetDb : opcional, para borrar contract_addresses previas si tienes scripts (no incluido)
 */
const { spawnSync } = require('child_process');
const http = require('http');

function parseArgs(argv) {
    const args = {};
    for (let i = 2; i < argv.length; i++) {
        const k = argv[i];
        if (!k.startsWith('--')) continue;
        const key = k.slice(2);
        const next = argv[i + 1];
        const isFlag = !next || next.startsWith('--');
        if (isFlag) args[key] = true;
        else {
            args[key] = next;
            i++;
        }
    }
    return args;
}

function run(cmd, args) {
    const res = spawnSync(cmd, args, { stdio: 'inherit' });
    if (res.error) throw res.error;
    if (res.status !== 0) throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
}

async function assertRpcUp(rpcUrl, timeoutMs = 2000) {
    const url = new URL(rpcUrl);
    if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error(`Unsupported protocol in rpcUrl: ${url.protocol}`);
    }
    return new Promise((resolve, reject) => {
        const client = http;
        const req = client.request(
            {
                method: 'POST',
                hostname: url.hostname,
                port: url.port || 80,
                path: url.pathname,
                timeout: timeoutMs,
                headers: { 'Content-Type': 'application/json' },
            },
            (res) => {
                res.resume();
                resolve(true);
            }
        );
        req.on('timeout', () => {
            req.destroy(new Error('RPC timeout'));
        });
        req.on('error', (err) => reject(err));
        req.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }));
        req.end();
    });
}

function main() {
    const args = parseArgs(process.argv);

    const chainId = Number(args.chainId || 31337);
    const rpcUrl = args.rpcUrl || process.env.BEZHAS_L2_RPC_URL || 'http://localhost:8545';
    const privateKey = args.privateKey || process.env.DEPLOYER_PRIVATE_KEY;
    const seedDb = !!args.seedDb;

    if (!privateKey) throw new Error('Missing --privateKey (or env DEPLOYER_PRIVATE_KEY)');
    if (!rpcUrl) throw new Error('Missing --rpcUrl');

    // Preflight: ensure local chain RPC is reachable.
    console.log(`[redeploy-local-validation] Preflight RPC: ${rpcUrl}`);
    assertRpcUp(rpcUrl).catch((err) => {
        throw new Error(
            `RPC is not reachable at ${rpcUrl}.\n` +
                `Run the local bootstrap first (Anvil/stack), e.g.:\n` +
                `  ./scripts/bootstrap-local.ps1\n` +
                `Original error: ${err.message}`
        );
    });

    const forgeArgs = [
        'script',
        'smart-contracts/script/DeployAll.s.sol',
        '--rpc-url',
        rpcUrl,
        '--private-key',
        privateKey,
        '--broadcast',
    ];

    console.log(`[redeploy-local-validation] chainId=${chainId} rpcUrl=${rpcUrl}`);
    run('forge', forgeArgs);

    // Regenerate deployments JSON (addresses)
    run('node', ['smart-contracts/script/parse-deployment.js', String(chainId)]);

    if (seedDb) {
        run('node', ['api/db/seed-contracts.js', String(chainId)]);
    }

    console.log('[redeploy-local-validation] Done');
}

main();

