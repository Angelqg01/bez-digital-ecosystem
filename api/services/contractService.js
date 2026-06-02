/**
 * contractService.js — On-chain contract interaction layer.
 * 
 * Reads ABIs from Foundry artifacts (smart-contracts/out/) and provides
 * typed contract instances for any deployed contract.
 */
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const { query } = require('../db/pool');
const { cacheGet, cacheSet } = require('../cache/redis');

const SMART_CONTRACTS_DIR = path.resolve(__dirname, '..', '..', 'smart-contracts');
const ARTIFACTS_DIR = path.join(SMART_CONTRACTS_DIR, 'out');
const ABI_DIR = path.join(SMART_CONTRACTS_DIR, 'abi');
const DEPLOYMENTS_DIR = path.join(SMART_CONTRACTS_DIR, 'deployments');

// ── Provider ──
let provider;
function getProvider() {
    if (!provider) {
        const rpcUrl = process.env.BEZHAS_L2_RPC_URL || 'http://localhost:8545';
        provider = new ethers.JsonRpcProvider(rpcUrl);
    }
    return provider;
}

// ── Signer (for write operations) ──
let signer;
function getSigner() {
    if (!signer) {
        const key = process.env.DEPLOYER_PRIVATE_KEY;
        if (!key) {
            throw new Error('DEPLOYER_PRIVATE_KEY env var is required. Never use hardcoded keys.');
        }
        signer = new ethers.Wallet(key, getProvider());
    }
    return signer;
}

// ── ABI Cache (in-memory, loaded once from disk) ──
const abiCache = {};

function loadABI(contractName) {
    if (abiCache[contractName]) return abiCache[contractName];

    const artifactPath = path.join(ARTIFACTS_DIR, `${contractName}.sol`, `${contractName}.json`);
    if (fs.existsSync(artifactPath)) {
        const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
        abiCache[contractName] = artifact.abi;
        return artifact.abi;
    }

    const abiPath = path.join(ABI_DIR, `${contractName}.json`);
    if (!fs.existsSync(abiPath)) {
        throw new Error(`ABI not found for ${contractName}. Build contracts first or add smart-contracts/abi/${contractName}.json.`);
    }

    const abiFile = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
    abiCache[contractName] = Array.isArray(abiFile) ? abiFile : abiFile.abi;
    return abiCache[contractName];
}

function findInDeploymentTree(node, contractName) {
    if (!node || typeof node !== 'object') return null;
    if (typeof node[contractName] === 'string') return node[contractName];
    for (const value of Object.values(node)) {
        const found = findInDeploymentTree(value, contractName);
        if (found) return found;
    }
    return null;
}

function getDeploymentAddress(contractName, chainId) {
    const cid = chainId || parseInt(process.env.BEZHAS_CHAIN_ID || '31337');
    const deploymentPath = path.join(DEPLOYMENTS_DIR, `${cid}.json`);
    if (!fs.existsSync(deploymentPath)) return null;

    const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    return findInDeploymentTree(deployment, contractName);
}

// ── Get deployed address from DB ──
async function getContractAddress(contractName, chainId) {
    const cid = chainId || parseInt(process.env.BEZHAS_CHAIN_ID || '31337');
    const cacheKey = `addr:${cid}:${contractName}`;

    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    let rows = [];
    try {
        const result = await query(
            'SELECT address FROM contract_addresses WHERE chain_id = $1 AND name = $2',
            [cid, contractName]
        );
        rows = result.rows;
    } catch (_) {
        rows = [];
    }

    if (rows.length === 0) {
        const deploymentAddress = getDeploymentAddress(contractName, cid);
        if (deploymentAddress) {
            await cacheSet(cacheKey, deploymentAddress, 3600);
            return deploymentAddress;
        }
        return null;
    }

    await cacheSet(cacheKey, rows[0].address, 3600); // cache 1h
    return rows[0].address;
}

// ── Get contract instance (read-only) ──
async function getContract(contractName, chainId) {
    const address = await getContractAddress(contractName, chainId);
    if (!address) throw new Error(`Contract ${contractName} not deployed on chain ${chainId || 'default'}`);
    const abi = loadABI(contractName);
    return new ethers.Contract(address, abi, getProvider());
}

// ── Get contract instance (with signer for writes) ──
async function getSignedContract(contractName, chainId) {
    const address = await getContractAddress(contractName, chainId);
    if (!address) throw new Error(`Contract ${contractName} not deployed on chain ${chainId || 'default'}`);
    const abi = loadABI(contractName);
    return new ethers.Contract(address, abi, getSigner());
}

// ═══════════════════════════════════════════════
//  HIGH-LEVEL READ FUNCTIONS
// ═══════════════════════════════════════════════

async function getBEZBalance(walletAddress) {
    const bez = await getContract('BEZCoinV2');
    const balance = await bez.balanceOf(walletAddress);
    return ethers.formatEther(balance);
}

async function getBEZTotalSupply() {
    const cacheKey = 'bez:totalSupply';
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const bez = await getContract('BEZCoinV2');
    const supply = ethers.formatEther(await bez.totalSupply());
    await cacheSet(cacheKey, supply, 60);
    return supply;
}

async function getTokenInfo(contractName = 'BEZCoinV2', chainId) {
    const token = await getContract(contractName, chainId);
    const [name, symbol, decimals, totalSupply] = await Promise.all([
        token.name(),
        token.symbol(),
        token.decimals(),
        token.totalSupply(),
    ]);

    return {
        address: await getContractAddress(contractName, chainId),
        name,
        symbol,
        decimals: Number(decimals),
        totalSupply: ethers.formatUnits(totalSupply, decimals),
        totalSupplyWei: totalSupply.toString(),
        chainId: chainId || parseInt(process.env.BEZHAS_CHAIN_ID || '31337'),
    };
}

async function getNFTOwner(tokenId) {
    const nft = await getContract('BeZhasLogisticsNFT');
    return nft.ownerOf(tokenId);
}

async function getStakingInfo(walletAddress) {
    const staking = await getContract('StakingPool');
    const [amount, baseEarned, boostedEarned, boostBps, validatorTier, isValidator] =
        await staking.getStakerInfo(walletAddress);
    return {
        stakedAmount: ethers.formatEther(amount),
        baseEarned: ethers.formatEther(baseEarned),
        boostedEarned: ethers.formatEther(boostedEarned),
        rewards: ethers.formatEther(boostedEarned),
        boostBps: Number(boostBps),
        validatorTier: Number(validatorTier),
        isValidator,
    };
}

async function getFarmingInfo(walletAddress, poolId) {
    const farming = await getContract('LiquidityFarming');
    const [amount, rewardDebt, lockEndTimestamp, multiplier] = await farming.userInfo(poolId, walletAddress);
    const pending = await farming.pendingBez(poolId, walletAddress);
    return {
        lpAmount: ethers.formatEther(amount),
        rewardDebt: ethers.formatEther(rewardDebt),
        pendingRewards: ethers.formatEther(pending),
        lockEndTimestamp: Number(lockEndTimestamp),
        multiplier: Number(multiplier),
    };
}

async function getFarmingPool(poolId) {
    const farming = await getContract('LiquidityFarming');
    const [lpToken, allocPoint, lastRewardBlock, isLP, accBezPerShare] = await farming.poolInfo(poolId);
    return {
        poolId,
        lpToken,
        allocPoint: allocPoint.toString(),
        lastRewardBlock: Number(lastRewardBlock),
        isLP: Number(isLP) === 1,
        accBezPerShare: accBezPerShare.toString(),
    };
}

async function getDEXPool(tokenA, tokenB, chainId) {
    const dex = await getContract('BeZhasDEX', chainId);
    const pool = await dex.getPool(tokenA, tokenB);
    return {
        address: await getContractAddress('BeZhasDEX', chainId),
        token0: pool.token0,
        token1: pool.token1,
        reserve0: pool.reserve0.toString(),
        reserve1: pool.reserve1.toString(),
        totalLiquidity: pool.totalLiquidity.toString(),
        lastBlockTimestamp: Number(pool.lastBlockTimestamp),
        exists: pool.exists,
    };
}

async function quoteDEXSwap(tokenIn, tokenOut, amountIn, chainId) {
    const dex = await getContract('BeZhasDEX', chainId);
    const out = await dex.quoteSwap(tokenIn, tokenOut, ethers.parseEther(String(amountIn)));
    return {
        amountIn: String(amountIn),
        amountOut: ethers.formatEther(out),
        amountOutWei: out.toString(),
    };
}

async function getBlockchainStats() {
    const cacheKey = 'chain:stats';
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const p = getProvider();
    const [blockNumber, network, feeData] = await Promise.all([
        p.getBlockNumber(),
        p.getNetwork(),
        p.getFeeData(),
    ]);

    const stats = {
        blockNumber,
        chainId: Number(network.chainId),
        gasPrice: feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, 'gwei') : '0',
        timestamp: Date.now(),
    };

    await cacheSet(cacheKey, stats, 15); // 15s cache
    return stats;
}

// ── Load all deployed addresses for a chain ──
async function getAllAddresses(chainId) {
    const cid = chainId || parseInt(process.env.BEZHAS_CHAIN_ID || '31337');
    const cacheKey = `addresses:${cid}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    let rows = [];
    try {
        const result = await query(
            'SELECT name, category, address, deployed_at FROM contract_addresses WHERE chain_id = $1 ORDER BY category, name',
            [cid]
        );
        rows = result.rows;
    } catch (_) {
        rows = [];
    }

    if (rows.length === 0) {
        const deploymentPath = path.join(DEPLOYMENTS_DIR, `${cid}.json`);
        if (fs.existsSync(deploymentPath)) {
            const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
            const groupedFromFile = {};
            for (const [category, contracts] of Object.entries(deployment)) {
                if (!contracts || typeof contracts !== 'object' || Array.isArray(contracts)) continue;
                groupedFromFile[category] = {};
                for (const [name, address] of Object.entries(contracts)) {
                    if (typeof address === 'string' && ethers.isAddress(address)) {
                        groupedFromFile[category][name] = address;
                    }
                }
                if (Object.keys(groupedFromFile[category]).length === 0) {
                    delete groupedFromFile[category];
                }
            }
            await cacheSet(cacheKey, groupedFromFile, 300);
            return groupedFromFile;
        }
    }

    const grouped = {};
    for (const row of rows) {
        if (!grouped[row.category]) grouped[row.category] = {};
        grouped[row.category][row.name] = row.address;
    }

    await cacheSet(cacheKey, grouped, 300);
    return grouped;
}

// Reset provider/signer (for integration tests)
async function _resetForTests() {
    const rpcUrl = process.env.BEZHAS_L2_RPC_URL || 'http://localhost:8545';
    provider = new ethers.JsonRpcProvider(rpcUrl);
    // Wait for provider to fully connect before returning
    await provider.getBlockNumber();
    const key = process.env.DEPLOYER_PRIVATE_KEY;
    if (!key) {
        throw new Error('DEPLOYER_PRIVATE_KEY env var is required for tests');
    }
    signer = new ethers.Wallet(key, provider);
}

// Inject external provider/signer (for integration tests with Anvil)
function _setForTests(p, s) {
    provider = p;
    signer = s;
}

module.exports = {
    getProvider,
    getSigner,
    loadABI,
    getContractAddress,
    getContract,
    getSignedContract,
    getBEZBalance,
    getBEZTotalSupply,
    getTokenInfo,
    getNFTOwner,
    getStakingInfo,
    getFarmingInfo,
    getFarmingPool,
    getDEXPool,
    quoteDEXSwap,
    getBlockchainStats,
    getAllAddresses,
    _resetForTests,
    _setForTests,
};
