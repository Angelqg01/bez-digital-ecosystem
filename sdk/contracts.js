/**
 * BeZhas Smart Contracts SDK v3.0.0 — Multi-Chain Contract Registry
 *
 * Resolves contract addresses and ABIs across all supported chains:
 *   - Anvil (31337)        — Local development
 *   - BeZhas L2 (2708)     — OP Stack sovereign chain
 *   - Polygon Mainnet (137)— Live production contracts
 *   - Polygon Amoy (80002) — Testnet
 *   - Sepolia (11155111)   — L1 reference
 *
 * Resolution order:
 *   1. Environment variable override (BEZHAS_<CONTRACT>_<CHAIN>)
 *   2. Deployment JSON (smart-contracts/deployments/<chainId>.json)
 *   3. Hardcoded addresses (Polygon mainnet)
 *
 * Backwards-compatible: network names ('polygon', 'localhost', etc.) still work.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── ABI Artifacts ────────────────────────────────────────────────────────────
// Auto-synced from smart-contracts/out/ via scripts/extract-abis.cjs
// Total: 88 contracts across 16 sectors + core + wallet
// Last sync: 2026-05-11
const ABI_ARTIFACTS = {
    // ═══ CORE (20) ═══
    AegisSecurityProvider: require('./artifacts/contracts/AegisSecurityProvider.sol/AegisSecurityProvider.json'),
    BEZCoinV2: require('./artifacts/contracts/BEZCoinV2.sol/BEZCoinV2.json'),
    BEZPolygonBridge: require('./artifacts/contracts/BEZPolygonBridge.sol/BEZPolygonBridge.json'),
    BEZSectorStandard: require('./artifacts/contracts/BEZSectorStandard.sol/BEZSectorStandard.json'),
    BeZhasBridgeL2: require('./artifacts/contracts/BeZhasBridgeL2.sol/BeZhasBridgeL2.json'),
    BeZhasDEX: require('./artifacts/contracts/BeZhasDEX.sol/BeZhasDEX.json'),
    BeZhasPayment: require('./artifacts/contracts/BeZhasPayment.sol/BeZhasPayment.json'),
    BeZhasWorkflowRegistry: require('./artifacts/contracts/BeZhasWorkflowRegistry.sol/BeZhasWorkflowRegistry.json'),
    DeliveryEscrow: require('./artifacts/contracts/DeliveryEscrow.sol/DeliveryEscrow.json'),
    EdgeNodeRewards: require('./artifacts/contracts/EdgeNodeRewards.sol/EdgeNodeRewards.json'),
    GovernanceSystem: require('./artifacts/contracts/GovernanceSystem.sol/GovernanceSystem.json'),
    L2Sequencer: require('./artifacts/contracts/L2Sequencer.sol/L2Sequencer.json'),
    LiquidityFarming: require('./artifacts/contracts/LiquidityFarming.sol/LiquidityFarming.json'),
    OpenClawAgent: require('./artifacts/contracts/OpenClawAgent.sol/OpenClawAgent.json'),
    QualityEscrow: require('./artifacts/contracts/QualityEscrow.sol/QualityEscrow.json'),
    SequencerRotation: require('./artifacts/contracts/SequencerRotation.sol/SequencerRotation.json'),
    SlashingManager: require('./artifacts/contracts/SlashingManager.sol/SlashingManager.json'),
    StakingPool: require('./artifacts/contracts/StakingPool.sol/StakingPool.json'),
    ValidatorRegistry: require('./artifacts/contracts/ValidatorRegistry.sol/ValidatorRegistry.json'),
    WrappedBEZ: require('./artifacts/contracts/WrappedBEZ.sol/WrappedBEZ.json'),

    // ═══ WALLET (6) ═══
    SmartWallet: require('./artifacts/contracts/SmartWallet.sol/SmartWallet.json'),
    SmartWalletFactory: require('./artifacts/contracts/SmartWalletFactory.sol/SmartWalletFactory.json'),
    MultiSigWallet: require('./artifacts/contracts/MultiSigWallet.sol/MultiSigWallet.json'),
    Paymaster: require('./artifacts/contracts/Paymaster.sol/Paymaster.json'),
    SecurityModule: require('./artifacts/contracts/SecurityModule.sol/SecurityModule.json'),
    WalletGuardian: require('./artifacts/contracts/WalletGuardian.sol/WalletGuardian.json'),

    // ═══ TOKENS & IDENTITY (2) ═══
    BeZhasLogisticsNFT: require('./artifacts/contracts/BeZhasLogisticsNFT.sol/BeZhasLogisticsNFT.json'),
    IdentityRegistry: require('./artifacts/contracts/IdentityRegistry.sol/IdentityRegistry.json'),

    // ═══ HEALTH (4) ═══
    HealthRecordSBT: require('./artifacts/contracts/HealthRecordSBT.sol/HealthRecordSBT.json'),
    PharmaTracker: require('./artifacts/contracts/PharmaTracker.sol/PharmaTracker.json'),
    HealthInsuranceEscrow: require('./artifacts/contracts/HealthInsuranceEscrow.sol/HealthInsuranceEscrow.json'),
    ClinicalDataMarketplace: require('./artifacts/contracts/ClinicalDataMarketplace.sol/ClinicalDataMarketplace.json'),

    // ═══ ENERGY (4) ═══
    CarbonCreditToken: require('./artifacts/contracts/CarbonCreditToken.sol/CarbonCreditToken.json'),
    P2PEnergyMarket: require('./artifacts/contracts/P2PEnergyMarket.sol/P2PEnergyMarket.json'),
    SolarFarmToken: require('./artifacts/contracts/SolarFarmToken.sol/SolarFarmToken.json'),
    ESGScoreOracle: require('./artifacts/contracts/ESGScoreOracle.sol/ESGScoreOracle.json'),

    // ═══ AUTOMOTIVE (4) ═══
    VehicleIdentityNFT: require('./artifacts/contracts/VehicleIdentityNFT.sol/VehicleIdentityNFT.json'),
    AutoPartsRegistry: require('./artifacts/contracts/AutoPartsRegistry.sol/AutoPartsRegistry.json'),
    FleetLeaseEscrow: require('./artifacts/contracts/FleetLeaseEscrow.sol/FleetLeaseEscrow.json'),
    EVChargeToken: require('./artifacts/contracts/EVChargeToken.sol/EVChargeToken.json'),

    // ═══ MANUFACTURING (4) ═══
    QualityCertificateNFT: require('./artifacts/contracts/QualityCertificateNFT.sol/QualityCertificateNFT.json'),
    DigitalTwinRegistry: require('./artifacts/contracts/DigitalTwinRegistry.sol/DigitalTwinRegistry.json'),
    MaterialTokenMRP: require('./artifacts/contracts/MaterialTokenMRP.sol/MaterialTokenMRP.json'),
    PredictiveMaintenanceLog: require('./artifacts/contracts/PredictiveMaintenanceLog.sol/PredictiveMaintenanceLog.json'),

    // ═══ AGRICULTURE (4) ═══
    CropTokenFutures: require('./artifacts/contracts/CropTokenFutures.sol/CropTokenFutures.json'),
    AgriSupplyChain: require('./artifacts/contracts/AgriSupplyChain.sol/AgriSupplyChain.json'),
    AquaFarmMonitor: require('./artifacts/contracts/AquaFarmMonitor.sol/AquaFarmMonitor.json'),
    LandTitleNFT: require('./artifacts/contracts/LandTitleNFT.sol/LandTitleNFT.json'),

    // ═══ INSURANCE (4) ═══
    PolicyNFT: require('./artifacts/contracts/PolicyNFT.sol/PolicyNFT.json'),
    ParametricInsurance: require('./artifacts/contracts/ParametricInsurance.sol/ParametricInsurance.json'),
    ClaimAdjuster: require('./artifacts/contracts/ClaimAdjuster.sol/ClaimAdjuster.json'),
    ReinsurancePool: require('./artifacts/contracts/ReinsurancePool.sol/ReinsurancePool.json'),

    // ═══ EDUCATION (4) ═══
    CourseTokenNFT: require('./artifacts/contracts/CourseTokenNFT.sol/CourseTokenNFT.json'),
    SkillBadgeSBT: require('./artifacts/contracts/SkillBadgeSBT.sol/SkillBadgeSBT.json'),
    EduDAO: require('./artifacts/contracts/EduDAO.sol/EduDAO.json'),
    ScholarshipPool: require('./artifacts/contracts/ScholarshipPool.sol/ScholarshipPool.json'),

    // ═══ ENTERTAINMENT (4) ═══
    EventTicketNFT: require('./artifacts/contracts/EventTicketNFT.sol/EventTicketNFT.json'),
    FanTokenDAO: require('./artifacts/contracts/FanTokenDAO.sol/FanTokenDAO.json'),
    RoyaltyDistributor: require('./artifacts/contracts/RoyaltyDistributor.sol/RoyaltyDistributor.json'),
    StreamingRightsMarket: require('./artifacts/contracts/StreamingRightsMarket.sol/StreamingRightsMarket.json'),

    // ═══ LEGAL (4) ═══
    SmartLegalContract: require('./artifacts/contracts/SmartLegalContract.sol/SmartLegalContract.json'),
    EvidenceVault: require('./artifacts/contracts/EvidenceVault.sol/EvidenceVault.json'),
    ArbitrationDAO: require('./artifacts/contracts/ArbitrationDAO.sol/ArbitrationDAO.json'),
    IPRegistryNFT: require('./artifacts/contracts/IPRegistryNFT.sol/IPRegistryNFT.json'),

    // ═══ SUPPLY CHAIN (8) ═══
    SupplyTracker: require('./artifacts/contracts/SupplyTracker.sol/SupplyTracker.json'),
    ProcurementNFT: require('./artifacts/contracts/ProcurementNFT.sol/ProcurementNFT.json'),
    WarehouseManager: require('./artifacts/contracts/WarehouseManager.sol/WarehouseManager.json'),
    SupplierScoreOracle: require('./artifacts/contracts/SupplierScoreOracle.sol/SupplierScoreOracle.json'),
    ClearanceCertificateNFT: require('./artifacts/contracts/ClearanceCertificateNFT.sol/ClearanceCertificateNFT.json'),
    CustomsClearanceOracle: require('./artifacts/contracts/CustomsClearanceOracle.sol/CustomsClearanceOracle.json'),
    TrackingIntegrationGateway: require('./artifacts/contracts/TrackingIntegrationGateway.sol/TrackingIntegrationGateway.json'),
    TrackingToCustomsGateway: require('./artifacts/contracts/TrackingToCustomsGateway.sol/TrackingToCustomsGateway.json'),

    // ═══ GOVERNMENT (4) ═══
    CitizenIdentityNFT: require('./artifacts/contracts/CitizenIdentityNFT.sol/CitizenIdentityNFT.json'),
    PublicBudgetDAO: require('./artifacts/contracts/PublicBudgetDAO.sol/PublicBudgetDAO.json'),
    LandCadastralRegistry: require('./artifacts/contracts/LandCadastralRegistry.sol/LandCadastralRegistry.json'),
    VotingSystem: require('./artifacts/contracts/VotingSystem.sol/VotingSystem.json'),

    // ═══ FINANCE (4) ═══
    MicroLendingPool: require('./artifacts/contracts/MicroLendingPool.sol/MicroLendingPool.json'),
    InvoiceFactoring: require('./artifacts/contracts/InvoiceFactoring.sol/InvoiceFactoring.json'),
    CreditScoreOracle: require('./artifacts/contracts/CreditScoreOracle.sol/CreditScoreOracle.json'),
    TreasuryVault: require('./artifacts/contracts/TreasuryVault.sol/TreasuryVault.json'),

    // ═══ SERVICES (4) ═══
    FreelanceMarketplace: require('./artifacts/contracts/FreelanceMarketplace.sol/FreelanceMarketplace.json'),
    SubscriptionManager: require('./artifacts/contracts/SubscriptionManager.sol/SubscriptionManager.json'),
    SLAMonitor: require('./artifacts/contracts/SLAMonitor.sol/SLAMonitor.json'),
    ServiceReputationNFT: require('./artifacts/contracts/ServiceReputationNFT.sol/ServiceReputationNFT.json'),

    // ═══ OTROS (4) ═══
    LoyaltyRewards: require('./artifacts/contracts/LoyaltyRewards.sol/LoyaltyRewards.json'),
    CrowdfundingPool: require('./artifacts/contracts/CrowdfundingPool.sol/CrowdfundingPool.json'),
    P2PMarketplace: require('./artifacts/contracts/P2PMarketplace.sol/P2PMarketplace.json'),
    CharityVault: require('./artifacts/contracts/CharityVault.sol/CharityVault.json'),
};

const ABIS = {};
for (const [name, artifact] of Object.entries(ABI_ARTIFACTS)) {
    ABIS[name] = artifact.abi;
}

// ── Chain Configuration ─────────────────────────────────────────────────────
const CHAIN_CONFIGS = {
    // BeZhas L2 — OP Stack Sovereign
    2708: {
        name: 'BeZhas L2',
        aliases: ['bezhas_l2', 'bezhas-l2', 'l2'],
        rpc: process.env.BEZHAS_L2_RPC || 'http://localhost:8545',
        explorer: process.env.BEZHAS_L2_EXPLORER || 'http://localhost:4000',
        blockTime: 2,
        gasToken: 'BEZ',
    },
    // Anvil Local Development
    31337: {
        name: 'Anvil Local',
        aliases: ['localhost', 'anvil', 'local', 'hardhat'],
        rpc: 'http://localhost:8545',
        explorer: '',
        blockTime: 1,
        gasToken: 'ETH',
    },
    // Polygon Mainnet
    137: {
        name: 'Polygon',
        aliases: ['polygon', 'matic'],
        rpc: process.env.POLYGON_RPC_URL || 'https://polygon-bor.publicnode.com',
        explorer: 'https://polygonscan.com',
        blockTime: 2,
        gasToken: 'MATIC',
    },
    // BSC Mainnet
    56: {
        name: 'BSC Mainnet',
        aliases: ['bsc', 'binance', 'bsc-mainnet'],
        rpc: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
        explorer: 'https://bscscan.com',
        blockTime: 3,
        gasToken: 'BNB',
    },
    // Polygon Amoy Testnet
    80002: {
        name: 'Polygon Amoy',
        aliases: ['amoy', 'polygon-amoy'],
        rpc: process.env.POLYGON_AMOY_RPC || 'https://rpc-amoy.polygon.technology',
        explorer: 'https://amoy.polygonscan.com',
        blockTime: 2,
        gasToken: 'MATIC',
    },
    // Sepolia (L1 Reference)
    11155111: {
        name: 'Sepolia',
        aliases: ['sepolia'],
        rpc: process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
        explorer: 'https://sepolia.etherscan.io',
        blockTime: 12,
        gasToken: 'ETH',
    },
};

// ── Hardcoded Polygon Mainnet Addresses (already deployed) ──────────────────
const POLYGON_MAINNET = {
    BEZCoin: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
    BezhasToken: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
    QualityEscrow: '0x3088573c025F197A886b97440761990c9A9e83C9',
    RWAFactory: '0x5F999157aF1DEfBf4E7e1b8021850b49e458CCc0',
    GovernanceSystem: '0x304Fd77f64C03482edcec0923f0Cd4A066a305F3',
    LiquidityFarming: '0x4C5330B45FEa670d5ffEAD418E74dB7EA5ECdD26',
    NFTOffers: '0x0C9Bf667b838f6d466619ddb90a08d6c9A64d0A4',
    Marketplace: '0x1c061A896E0ac9C046A93eaf475c45ED5Bd8A1fE',
    AdminRegistry: '0xfCe2F7dcf1786d1606b9b858E9ba04dA499F1e3C',
};

// ── Hardcoded BSC Mainnet Addresses (already deployed) ──────────────────────
const BSC_MAINNET = {
    BEZCoin: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
    BezhasToken: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
};

// ── Alias → chainId mapping ─────────────────────────────────────────────────
const ALIAS_MAP = {};
for (const [chainId, config] of Object.entries(CHAIN_CONFIGS)) {
    for (const alias of config.aliases) {
        ALIAS_MAP[alias] = parseInt(chainId);
    }
    ALIAS_MAP[chainId] = parseInt(chainId);
}

// ── Dynamic deployment loader ───────────────────────────────────────────────
const _deploymentCache = new Map();

function _loadDeploymentFile(chainId) {
    if (_deploymentCache.has(chainId)) return _deploymentCache.get(chainId);

    // Search for deployment JSON in multiple possible locations
    const searchPaths = [
        path.resolve(__dirname, '../smart-contracts/deployments', `${chainId}.json`),
        path.resolve(__dirname, 'deployments', `${chainId}.json`),
    ];

    for (const filePath of searchPaths) {
        try {
            if (fs.existsSync(filePath)) {
                const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                // Flatten nested structure: { core: {...}, sectors: { health: {...} } } → flat map
                const flat = {};
                for (const [key, value] of Object.entries(raw)) {
                    if (key === 'chainId' || key === 'timestamp') continue;
                    if (typeof value === 'string') {
                        flat[key] = value;
                    } else if (typeof value === 'object' && value !== null) {
                        // Nested group (core, wallet, sectors.health, etc.)
                        for (const [innerKey, innerVal] of Object.entries(value)) {
                            if (typeof innerVal === 'string') {
                                flat[innerKey] = innerVal;
                            } else if (typeof innerVal === 'object' && innerVal !== null) {
                                // Sector sub-group
                                for (const [contractName, addr] of Object.entries(innerVal)) {
                                    flat[contractName] = addr;
                                }
                            }
                        }
                    }
                }
                _deploymentCache.set(chainId, flat);
                return flat;
            }
        } catch { /* skip unreadable files */ }
    }

    _deploymentCache.set(chainId, {});
    return {};
}

// ── Resolve Network ─────────────────────────────────────────────────────────
function resolveChainId(networkOrChainId) {
    if (typeof networkOrChainId === 'number') return networkOrChainId;
    const str = String(networkOrChainId).toLowerCase();
    if (ALIAS_MAP[str] !== undefined) return ALIAS_MAP[str];
    const parsed = parseInt(str);
    if (!isNaN(parsed) && CHAIN_CONFIGS[parsed]) return parsed;
    throw new Error(`Unknown network: "${networkOrChainId}". Supported: ${Object.keys(ALIAS_MAP).join(', ')}`);
}

// ── Get addresses for a chain ───────────────────────────────────────────────
function _getAddressesForChain(chainId) {
    // Layer 1: Deployment files
    const deployed = _loadDeploymentFile(chainId);

    // Layer 2: Hardcoded (Polygon mainnet / BSC mainnet)
    let hardcoded = {};
    if (chainId === 137) {
        hardcoded = POLYGON_MAINNET;
    } else if (chainId === 56) {
        hardcoded = BSC_MAINNET;
    }

    // Layer 3: Env var overrides (BEZHAS_<CONTRACT>_<CHAINID>)
    const envOverrides = {};
    const prefix = `BEZHAS_CONTRACT_${chainId}_`;
    for (const [key, val] of Object.entries(process.env)) {
        if (key.startsWith(prefix) && val) {
            envOverrides[key.slice(prefix.length)] = val;
        }
    }

    // Also support legacy env var format
    if (chainId === 31337 || chainId === 2708) {
        const legacyMap = {
            BEZCOINV2_ADDRESS_L2: 'BEZCoinV2',
            BEZHAS_TOKEN_ADDRESS_LOCAL: 'BezhasToken',
            LIQUIDITY_FARMING_ADDRESS_L2: 'LiquidityFarming',
            STAKING_POOL_ADDRESS_L2: 'StakingPool',
            GOVERNANCE_SYSTEM_ADDRESS_L2: 'GovernanceSystem',
            QUALITY_ESCROW_ADDRESS_L2: 'QualityEscrow',
            LOGISTICS_NFT_ADDRESS_L2: 'BeZhasLogisticsNFT',
        };
        for (const [envKey, contractName] of Object.entries(legacyMap)) {
            if (process.env[envKey]) envOverrides[contractName] = process.env[envKey];
        }
    }

    // Merge: env > hardcoded > deployed
    return { ...deployed, ...hardcoded, ...envOverrides };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PUBLIC API (backwards-compatible with v2.x)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get contract address + ABI for a specific chain.
 * @param {string} contractName
 * @param {string|number} network - Chain ID or alias ('polygon', 'localhost', 'bezhas_l2', etc.)
 * @returns {{ address: string, abi: Array, chainId: number } | null}
 */
function getContract(contractName, network = 'localhost') {
    const chainId = resolveChainId(network);
    const addresses = _getAddressesForChain(chainId);

    const address = addresses[contractName];
    if (!address) {
        console.warn(`[SDK] Contract "${contractName}" not deployed on chain ${chainId} (${network})`);
        return null;
    }

    const abi = ABIS[contractName];
    if (!abi) {
        // Contract exists on-chain but ABI not in SDK artifacts — return address only
        return { address, abi: null, chainId };
    }

    return { address, abi, chainId };
}

/**
 * Get all deployed addresses for a chain.
 * @param {string|number} network
 * @returns {Object<string, string>}
 */
function getAddresses(network = 'localhost') {
    const chainId = resolveChainId(network);
    return _getAddressesForChain(chainId);
}

/**
 * Get contract ABI by name.
 * @param {string} contractName
 * @returns {Array}
 */
function getABI(contractName) {
    const abi = ABIS[contractName];
    if (!abi) throw new Error(`ABI for contract "${contractName}" not found`);
    return abi;
}

/**
 * List all contracts with known ABIs.
 * @returns {string[]}
 */
function listContracts() {
    return Object.keys(ABIS);
}

/**
 * List all contracts deployed on a chain (includes those without ABIs).
 * @param {string|number} network
 * @returns {string[]}
 */
function listDeployed(network = 'localhost') {
    const chainId = resolveChainId(network);
    return Object.keys(_getAddressesForChain(chainId));
}

/**
 * Check if a contract is deployed on a network.
 * @param {string} contractName
 * @param {string|number} network
 * @returns {boolean}
 */
function isDeployed(contractName, network = 'localhost') {
    const chainId = resolveChainId(network);
    const addresses = _getAddressesForChain(chainId);
    return !!(addresses[contractName]);
}

/**
 * Get chain configuration (RPC, explorer, etc.).
 * @param {string|number} network
 * @returns {Object}
 */
function getChainConfig(network) {
    const chainId = resolveChainId(network);
    const config = CHAIN_CONFIGS[chainId];
    if (!config) throw new Error(`No config for chain ${chainId}`);
    return { chainId, ...config };
}

/**
 * List all supported chains.
 * @returns {{ chainId: number, name: string, aliases: string[] }[]}
 */
function listChains() {
    return Object.entries(CHAIN_CONFIGS).map(([id, c]) => ({
        chainId: parseInt(id),
        name: c.name,
        aliases: c.aliases,
    }));
}

/**
 * Force reload deployment cache (useful after new deploys).
 */
function reloadDeployments() {
    _deploymentCache.clear();
}

// ── Legacy compatibility: 'addresses' object keyed by network name ──────────
const _legacyAddresses = new Proxy({}, {
    get(_, prop) {
        try { return _getAddressesForChain(resolveChainId(prop)); }
        catch { return {}; }
    },
});

// Exportaciones
module.exports = {
    contracts: ABIS,
    addresses: _legacyAddresses,
    getContract,
    getAddresses,
    getABI,
    listContracts,
    listDeployed,
    isDeployed,
    getChainConfig,
    listChains,
    resolveChainId,
    reloadDeployments,
    CHAIN_CONFIGS,
    artifacts: ABI_ARTIFACTS,
};
