#!/usr/bin/env node
/**
 * scripts/deploy-testnet-validation.js
 *
 * Runner incremental para testnet (Fase 13B):
 * 1) Ejecuta forge DeployAll.s.sol con broadcast
 * 2) Regenera smart-contracts/deployments/<chainId>.json (incluye contratos de validación)
 * 3) (Opcional) Puede sembrar la DB: api/db/seed-contracts.js <chainId>
 *
 * Uso (ejemplo):
 *   node scripts/deploy-testnet-validation.js --chainId 2708 --rpcUrl <RPC> --privateKey <KEY> --seedDb
 *
 * Flags:
 *   --verify         (opcional) añade --verify al forge (requiere config de verificación)
 *   --seedDb         (opcional) ejecuta seed-contracts.js para poblar contract_addresses
 */
const { spawnSync } = require('child_process');

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

function run(cmd, args, opts = {}) {
    const res = spawnSync(cmd, args, { stdio: 'inherit', shell: false, ...opts });
    if (res.error) throw res.error;
    if (res.status !== 0) {
        throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
    }
}

function main() {
    const args = parseArgs(process.argv);

    const chainId = Number(args.chainId || process.env.BEZHAS_CHAIN_ID || 2708);
    const rpcUrl = args.rpcUrl || process.env.SEPOLIA_RPC_URL || process.env.RPC_URL;
    const privateKey = args.privateKey || process.env.DEPLOYER_PRIVATE_KEY;
    const verify = !!args.verify;
    const seedDb = !!args.seedDb;

    if (!rpcUrl) throw new Error('Missing --rpcUrl (or env RPC_URL/SEPOLIA_RPC_URL)');
    if (!privateKey) throw new Error('Missing --privateKey (or env DEPLOYER_PRIVATE_KEY)');

    const forgeArgs = [
        'script',
        'smart-contracts/script/DeployAll.s.sol',
        '--rpc-url',
        rpcUrl,
        '--private-key',
        privateKey,
        '--broadcast',
    ];
    if (verify) forgeArgs.push('--verify');

    console.log(`[deploy-testnet-validation] chainId=${chainId}`);
    console.log(`[deploy-testnet-validation] RPC=${rpcUrl}`);

    // Run from repo root.
    run('forge', forgeArgs);

    // Regenerate deployments JSON (addresses)
    run('node', ['smart-contracts/script/parse-deployment.js', String(chainId)]);

    if (seedDb) {
        run('node', ['api/db/seed-contracts.js', String(chainId)]);
    }

    console.log('[deploy-testnet-validation] Done');
}

main();

