#!/usr/bin/env node
/**
 * scripts/register-validator.js
 *
 * CLI mínimo para onboarding de validadores (Fase 12A).
 * Flujo:
 * 1) approve BEZCoinV2 al ValidatorRegistry (stakeAmount)
 * 2) registerValidator(companyName, stakeAmount)
 * 3) heartbeat() (opcional)
 * 4) registerNode() (opcional)
 *
 * Uso (ejemplo):
 *   node scripts/register-validator.js --chainId 31337 --rpcUrl http://localhost:8545 \
 *     --privateKey <PK> --companyName "Global Logistics S.A." --stakeAmountEth 50000 \
 *     --heartbeat --registerNode
 */
const { ethers } = require('ethers');
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
    const companyName = args.companyName || process.env.COMPANY_NAME;
    const stakeAmountEth = args.stakeAmountEth || process.env.STAKE_AMOUNT_ETH;

    const doHeartbeat = !!args.heartbeat;
    const doRegisterNode = !!args.registerNode;

    const bezAddress = args.bezAddress || process.env.BEZ_ADDRESS;
    const validatorRegistryAddress = args.validatorRegistryAddress || process.env.VALIDATOR_REGISTRY_ADDRESS;
    const edgeNodeRewardsAddress = args.edgeNodeRewardsAddress || process.env.EDGE_NODE_REWARDS_ADDRESS;

    if (!privateKey) throw new Error('Missing --privateKey (or env VALIDATOR_PRIVATE_KEY)');
    if (!companyName) throw new Error('Missing --companyName (or env COMPANY_NAME)');
    if (!stakeAmountEth) throw new Error('Missing --stakeAmountEth (or env STAKE_AMOUNT_ETH)');

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const signer = new ethers.Wallet(privateKey, provider);

    console.log('[register-validator] operator:', await signer.getAddress());
    console.log('[register-validator] chainId:', chainId);

    const client = new ValidatorClient({
        chainId,
        provider,
        signer,
        addressesOverride: bezAddress || validatorRegistryAddress || edgeNodeRewardsAddress ? {
            bez: bezAddress,
            validatorRegistry: validatorRegistryAddress,
            edgeNodeRewards: edgeNodeRewardsAddress,
        } : undefined,
    });

    console.log('[register-validator] Approving BEZ for stake...');
    await client.approveStake(stakeAmountEth);

    console.log('[register-validator] Registering validator...');
    const receipt = await client.registerValidator(companyName, stakeAmountEth);
    console.log('[register-validator] registerValidator tx:', receipt?.hash || receipt?.transactionHash);

    if (doHeartbeat) {
        console.log('[register-validator] Heartbeat...');
        await (await client.heartbeat());
    }

    if (doRegisterNode) {
        console.log('[register-validator] Register Edge node...');
        await (await client.registerNode());
    }

    const info = await client.getInfo(await signer.getAddress());
    console.log('[register-validator] Validator info:', info);

    if (doRegisterNode) {
        const nodeInfo = await client.getNodeInfo(await signer.getAddress());
        console.log('[register-validator] Node info:', nodeInfo);
    }
}

main().catch((err) => {
    console.error('[register-validator] ERROR:', err?.message || err);
    process.exit(1);
});

