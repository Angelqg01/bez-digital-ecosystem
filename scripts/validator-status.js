#!/usr/bin/env node
/**
 * scripts/validator-status.js
 *
 * CLI para leer estado de un validador (Fase 12A).
 *
 * Ejemplo:
 *   node scripts/validator-status.js --chainId 31337 --rpcUrl http://localhost:8545 \
 *     --operator 0xabc... --privateKey <PK>
 */
import { ethers } from 'ethers';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ValidatorClient } = require('../sdk');

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

async function main() {
    const args = parseArgs(process.argv);

    const chainId = Number(args.chainId || process.env.BEZHAS_CHAIN_ID || 31337);
    const rpcUrl = args.rpcUrl || process.env.BEZHAS_L2_RPC_URL || 'http://localhost:8545';
    const privateKey = args.privateKey || process.env.VALIDATOR_PRIVATE_KEY;
    const operator = args.operator || process.env.OPERATOR_ADDRESS;
    const bezAddress = args.bezAddress || process.env.BEZ_ADDRESS;
    const validatorRegistryAddress = args.validatorRegistryAddress || process.env.VALIDATOR_REGISTRY_ADDRESS;
    const edgeNodeRewardsAddress = args.edgeNodeRewardsAddress || process.env.EDGE_NODE_REWARDS_ADDRESS;

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const signer = privateKey ? new ethers.Wallet(privateKey, provider) : null;

    const client = new ValidatorClient({
        chainId,
        provider,
        signer: signer || undefined,
        addressesOverride: bezAddress || validatorRegistryAddress || edgeNodeRewardsAddress ? {
            bez: bezAddress,
            validatorRegistry: validatorRegistryAddress,
            edgeNodeRewards: edgeNodeRewardsAddress,
        } : undefined,
    });

    const addr = operator || (signer ? await signer.getAddress() : null);
    if (!addr) throw new Error('Missing --operator (or env OPERATOR_ADDRESS) or provide --privateKey');

    const info = await client.getInfo(addr);
    console.log('[validator-status] Validator info:', info);

    const nodeInfo = await client.getNodeInfo(addr);
    console.log('[validator-status] Node info:', nodeInfo);
}

main().catch((err) => {
    console.error('[validator-status] ERROR:', err?.message || err);
    process.exit(1);
});

