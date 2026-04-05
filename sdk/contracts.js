/**
 * BeZhas Smart Contracts SDK - Versión Simplificada
 * Exporta ABIs y direcciones de contratos principales
 */

// Core Contracts
const BezhasTokenArtifact = require('./artifacts/contracts/BezhasToken.sol/BezhasToken.json');
const LiquidityFarmingArtifact = require('./artifacts/contracts/LiquidityFarming.sol/LiquidityFarming.json');
const StakingPoolArtifact = require('./artifacts/contracts/StakingPool.sol/StakingPool.json');
const GovernanceSystemArtifact = require('./artifacts/contracts/GovernanceSystem.sol/GovernanceSystem.json');
const BeZhasQualityEscrowArtifact = require('./artifacts/contracts/quality-oracle/BeZhasQualityEscrow.sol/BeZhasQualityEscrow.json');

// Direcciones de despliegue
const CONTRACT_ADDRESSES = {
    localhost: {
        BezhasToken: process.env.BEZHAS_TOKEN_ADDRESS_LOCAL || '',
        LiquidityFarming: process.env.LIQUIDITY_FARMING_ADDRESS_LOCAL || '',
        StakingPool: process.env.STAKING_POOL_ADDRESS_LOCAL || '',
        GovernanceSystem: process.env.GOVERNANCE_SYSTEM_ADDRESS_LOCAL || '',
        BeZhasQualityEscrow: process.env.BEZHAS_QUALITY_ESCROW_ADDRESS_LOCAL || ''
    },
    amoy: {
        BezhasToken: process.env.BEZHAS_TOKEN_ADDRESS_AMOY || '',
        LiquidityFarming: process.env.LIQUIDITY_FARMING_ADDRESS_AMOY || '',
        StakingPool: process.env.STAKING_POOL_ADDRESS_AMOY || '',
        GovernanceSystem: process.env.GOVERNANCE_SYSTEM_ADDRESS_AMOY || '',
        BeZhasQualityEscrow: process.env.BEZHAS_QUALITY_ESCROW_ADDRESS_AMOY || ''
    },
    polygon: {
        BezhasToken: process.env.BEZHAS_TOKEN_ADDRESS_POLYGON || '',
        LiquidityFarming: process.env.LIQUIDITY_FARMING_ADDRESS_POLYGON || '',
        StakingPool: process.env.STAKING_POOL_ADDRESS_POLYGON || '',
        GovernanceSystem: process.env.GOVERNANCE_SYSTEM_ADDRESS_POLYGON || '',
        BeZhasQualityEscrow: process.env.BEZHAS_QUALITY_ESCROW_ADDRESS_POLYGON || ''
    }
};

// ABIs
const ABIS = {
    BezhasToken: BezhasTokenArtifact.abi,
    LiquidityFarming: LiquidityFarmingArtifact.abi,
    StakingPool: StakingPoolArtifact.abi,
    GovernanceSystem: GovernanceSystemArtifact.abi,
    BeZhasQualityEscrow: BeZhasQualityEscrowArtifact.abi
};

// Funciones Helper
function getContract(contractName, network = 'localhost') {
    const addresses = CONTRACT_ADDRESSES[network];
    if (!addresses) {
        throw new Error(`Network "${network}" not supported`);
    }

    const address = addresses[contractName];
    if (!address) {
        console.warn(`⚠️  Contract "${contractName}" not deployed on "${network}"`);
        return null;
    }

    const abi = ABIS[contractName];
    if (!abi) {
        throw new Error(`ABI for "${contractName}" not found`);
    }

    return { address, abi };
}

function getAddresses(network = 'localhost') {
    return CONTRACT_ADDRESSES[network] || {};
}

function getABI(contractName) {
    const abi = ABIS[contractName];
    if (!abi) {
        throw new Error(`ABI for contract "${contractName}" not found`);
    }
    return abi;
}

function listContracts() {
    return Object.keys(ABIS);
}

function isDeployed(contractName, network = 'localhost') {
    const addresses = CONTRACT_ADDRESSES[network];
    return !!(addresses && addresses[contractName] && addresses[contractName] !== '');
}

// Exportaciones
module.exports = {
    contracts: ABIS,
    addresses: CONTRACT_ADDRESSES,
    getContract,
    getAddresses,
    getABI,
    listContracts,
    isDeployed,
    artifacts: {
        BezhasToken: BezhasTokenArtifact,
        LiquidityFarming: LiquidityFarmingArtifact,
        StakingPool: StakingPoolArtifact,
        GovernanceSystem: GovernanceSystemArtifact,
        BeZhasQualityEscrow: BeZhasQualityEscrowArtifact
    }
};
