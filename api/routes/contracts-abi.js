/**
 * routes/contracts-abi.js — Serves deployed contract addresses + ABIs for frontend agents.
 * 
 * Endpoints:
 *   GET  /api/contracts/deployments  → All deployed contract addresses by sector
 *   GET  /api/contracts/abi/:name    → ABI for a specific contract
 *   GET  /api/contracts/agent/:id    → Contracts + ABIs relevant to a specific agent
 */
const { Router } = require('express');
const { param, validationResult } = require('express-validator');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/security');

const router = Router();

// ── Load deployment manifest ──
let deployments = null;
const DEPLOYMENTS_PATH = path.resolve(__dirname, '../../smart-contracts/deployments/31337.json');

function loadDeployments() {
    if (deployments) return deployments;
    try {
        const raw = fs.readFileSync(DEPLOYMENTS_PATH, 'utf-8');
        deployments = JSON.parse(raw);
        return deployments;
    } catch {
        return { chainId: 31337, core: {}, sectors: {} };
    }
}

// ── Agent → Contract mapping ──
const AGENT_CONTRACTS = {
    // MCP Core
    orch: ['BEZCoinV2', 'StakingPool'],
    gas: ['BEZCoinV2'],
    swap: ['BEZCoinV2', 'LiquidityFarming', 'StakingPool'],
    // Oracle
    aegis: ['QualityEscrow', 'BeZhasLogisticsNFT'],
    food: ['QualityEscrow', 'BeZhasLogisticsNFT'],
    cold: ['BeZhasLogisticsNFT', 'QualityEscrow'],
    'cold-chain': ['QualityEscrow', 'PharmaTracker', 'WarehouseManager', 'SupplyTracker'],
    // SSI
    did: ['BEZCoinV2'],
    por: ['StakingPool', 'BEZCoinV2'],
    // DAO
    gov: ['BEZCoinV2', 'StakingPool'],
    hr: ['BEZCoinV2', 'StakingPool'],
    depub: ['BEZCoinV2', 'QualityEscrow'],
    arb: ['QualityEscrow', 'BEZCoinV2'],
    // BaaS
    bridge: ['BEZCoinV2', 'BeZhasBridgeL2'],
    sdk: ['BEZCoinV2', 'BeZhasLogisticsNFT', 'QualityEscrow'],
    audit: ['QualityEscrow'],
    // Tokenomics
    tknomics: ['BEZCoinV2', 'StakingPool', 'LiquidityFarming'],
    pay: ['BEZCoinV2', 'QualityEscrow'],
    stake: ['StakingPool', 'BEZCoinV2', 'LiquidityFarming'],
    greentoken: ['CarbonCreditToken', 'ESGScoreOracle', 'BEZCoinV2'],
    p2penergy: ['P2PEnergyMarket', 'EVChargeToken', 'BEZCoinV2'],
    esgscore: ['ESGScoreOracle', 'CarbonCreditToken'],
    solardefi: ['SolarFarmToken', 'P2PEnergyMarket', 'LiquidityFarming', 'BEZCoinV2'],
    // Healthcare
    medrecord: ['HealthRecordSBT'],
    pharmatrak: ['PharmaTracker'],
    claimbot: ['HealthInsuranceEscrow', 'QualityEscrow'],
    biodata: ['ClinicalDataMarketplace'],
    // Automotive
    vehiclenft: ['VehicleIdentityNFT'],
    autoparts: ['AutoPartsRegistry'],
    fleetdefi: ['FleetLeaseEscrow'],
    evcharge: ['EVChargeToken'],
    // Manufacturing
    qualitychain: ['QualityCertificateNFT'],
    digitaltwin: ['DigitalTwinRegistry'],
    supplymrp: ['MaterialTokenMRP'],
    predmaint: ['PredictiveMaintenanceLog'],
    // Agriculture
    croptoken: ['CropTokenFutures'],
    agrisupply: ['AgriSupplyChain'],
    aquafarm: ['AquaFarmMonitor'],
    landcadastral: ['LandTitleNFT'],
    // Insurance
    policynft: ['PolicyNFT'],
    claimadjuster: ['ClaimAdjuster'],
    parametric: ['ParametricInsurance'],
    reinsurance: ['ReinsurancePool'],
    // Education
    coursetoken: ['CourseTokenNFT'],
    skillbadge: ['SkillBadgeSBT'],
    edudao: ['EduDAO'],
    scholarpool: ['ScholarshipPool'],
    // Entertainment
    fantoken: ['FanTokenDAO'],
    eventticket: ['EventTicketNFT'],
    streamingrights: ['StreamingRightsMarket'],
    royaltydist: ['RoyaltyDistributor'],
    // Legal
    smartlegal: ['SmartLegalContract'],
    evidencevault: ['EvidenceVault'],
    ipregistry: ['IPRegistryNFT'],
    arbitration: ['ArbitrationDAO'],
    // Supply Chain
    supplytracker: ['SupplyTracker', 'SupplierScoreOracle'],
    shiptrack: ['SupplyTracker', 'BeZhasLogisticsNFT', 'QualityEscrow'],
    customsclear: ['CustomsClearanceOracle', 'ClearanceCertificateNFT', 'TrackingToCustomsGateway'],
    warehouse: ['WarehouseManager', 'SupplyTracker', 'SupplierScoreOracle'],
    'rwa-cargo': ['SupplyTracker', 'ProcurementNFT', 'QualityEscrow', 'BeZhasLogisticsNFT'],
    supplierscore: ['SupplierScoreOracle'],
    procurement: ['ProcurementNFT'],
    invoicefactoring: ['InvoiceFactoring'],
    // Gobierno
    citizenid: ['CitizenIdentityNFT'],
    voting: ['VotingSystem'],
    publicbudget: ['PublicBudgetDAO'],
    landregistry: ['LandCadastralRegistry'],
    realestate: ['LandCadastralRegistry', 'LandTitleNFT', 'TreasuryVault'],
    // Finanzas
    creditscore: ['CreditScoreOracle'],
    microlending: ['MicroLendingPool'],
    crowdfunding: ['CrowdfundingPool'],
    treasuryvault: ['TreasuryVault'],
    'port-finance': ['InvoiceFactoring', 'TreasuryVault', 'MicroLendingPool', 'BEZCoinV2'],
    'maritime-insurance': ['PolicyNFT', 'ParametricInsurance', 'ReinsurancePool', 'QualityEscrow'],
    // Servicios
    freelance: ['FreelanceMarketplace'],
    subscription: ['SubscriptionManager'],
    loyalty: ['LoyaltyRewards'],
    servicereputation: ['ServiceReputationNFT'],
    slamonitor: ['SLAMonitor'],
    p2pmarketplace: ['P2PMarketplace'],
    charityvault: ['CharityVault'],
};

// Resolve contract address from deployments
function resolveAddress(contractName) {
    const d = loadDeployments();
    // Check core
    if (d.core?.[contractName]) return d.core[contractName];
    // Check all sectors
    if (d.sectors) {
        for (const sector of Object.values(d.sectors)) {
            if (sector[contractName]) return sector[contractName];
        }
    }
    return null;
}

// ── ABI loader ── tries clean ABIs first, then SDK artifacts, then compiled output
function loadABI(contractName) {
    const searchPaths = [
        // Clean extracted ABIs (from extract-abis.cjs pipeline)
        path.resolve(__dirname, '../../smart-contracts/abi', `${contractName}.json`),
        // SDK artifacts
        path.resolve(__dirname, '../../sdk/artifacts/contracts', `${contractName}.sol`, `${contractName}.json`),
        // quality-oracle subfolder (legacy)
        path.resolve(__dirname, '../../sdk/artifacts/contracts/quality-oracle', `${contractName}.sol`, `${contractName}.json`),
        // smart-contracts compiled output (Foundry raw)
        path.resolve(__dirname, '../../smart-contracts/out', `${contractName}.sol`, `${contractName}.json`),
    ];
    for (const p of searchPaths) {
        try {
            if (fs.existsSync(p)) {
                const raw = JSON.parse(fs.readFileSync(p, 'utf-8'));
                return raw.abi || null;
            }
        } catch { /* skip */ }
    }
    return null;
}

// ── GET /api/contracts/abi/:name ──
router.get('/abi/:name', authenticateToken, [
    param('name').isString().trim().isLength({ min: 1, max: 80 }).matches(/^[A-Za-z0-9_]+$/),
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const contractName = req.params.name;
    const abi = loadABI(contractName);
    const address = resolveAddress(contractName);

    if (!abi) {
        return res.status(404).json({ error: `ABI not found for '${contractName}'` });
    }

    res.json({
        status: 'success',
        data: {
            name: contractName,
            address,
            deployed: !!address,
            abi,
            functions: abi.filter(e => e.type === 'function').length,
            events: abi.filter(e => e.type === 'event').length,
        },
    });
});

// ── GET /api/contracts/deployments ──
router.get('/deployments', authenticateToken, (req, res) => {
    const d = loadDeployments();
    res.json({
        status: 'success',
        data: {
            chainId: d.chainId,
            timestamp: d.timestamp,
            core: d.core || {},
            sectors: d.sectors || {},
            wallet: d.wallet || {},
            total: Object.keys(d.core || {}).length +
                Object.values(d.sectors || {}).reduce((s, sec) => s + Object.keys(sec).length, 0),
        },
    });
});

// ── GET /api/contracts/agent/:id ──
router.get('/agent/:id', authenticateToken, [
    param('id').isString().trim().isLength({ min: 1, max: 50 }),
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const agentId = req.params.id;
    const contractNames = AGENT_CONTRACTS[agentId];

    if (!contractNames) {
        return res.status(404).json({ error: `Agent '${agentId}' not found in contract mapping` });
    }

    const contracts = contractNames.map(name => ({
        name,
        address: resolveAddress(name),
        deployed: !!resolveAddress(name),
    }));

    res.json({
        status: 'success',
        data: {
            agent_id: agentId,
            contracts,
            total_deployed: contracts.filter(c => c.deployed).length,
            total_mapped: contracts.length,
        },
    });
});

// ══════════════════════════════════════════════════════════════════════════════
//  PUBLIC ENDPOINTS (no auth — for SubApp consumption)
// ══════════════════════════════════════════════════════════════════════════════

// ── GET /api/contracts/catalog ──
// Full manifest of all 88 contracts with metadata (no ABIs payload)
router.get('/catalog', (req, res) => {
    const manifestPath = path.resolve(__dirname, '../../smart-contracts/abi/manifest.json');
    let manifest = { contracts: {} };
    try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')); } catch { /* empty */ }

    const d = loadDeployments();
    const catalog = {};
    for (const [name, info] of Object.entries(manifest.contracts || {})) {
        const address = resolveAddress(name);
        catalog[name] = { sector: info.sector, functions: info.functions, events: info.events, deployed: !!address, address: address || null };
    }

    const bySector = {};
    for (const [name, info] of Object.entries(catalog)) {
        if (!bySector[info.sector]) bySector[info.sector] = [];
        bySector[info.sector].push({ name, ...info });
    }

    res.json({ status: 'success', data: { chainId: d.chainId || 31337, totalContracts: Object.keys(catalog).length, totalDeployed: Object.values(catalog).filter(c => c.deployed).length, bySector, contracts: catalog } });
});

// ── GET /api/contracts/sector/:sector ──
// All contracts for a sector with ABIs (e.g., bez-energy queries 'energy')
router.get('/sector/:sector', [
    param('sector').isString().trim().isLength({ min: 1, max: 30 }).matches(/^[a-z_]+$/),
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const sector = req.params.sector;
    const manifestPath = path.resolve(__dirname, '../../smart-contracts/abi/manifest.json');
    let manifest = { contracts: {} };
    try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')); } catch { /* empty */ }

    const sectorContracts = Object.entries(manifest.contracts || {})
        .filter(([, info]) => info.sector === sector)
        .map(([name, info]) => ({ name, address: resolveAddress(name) || null, deployed: !!resolveAddress(name), functions: info.functions, events: info.events, abi: loadABI(name) || [] }));

    if (sectorContracts.length === 0) return res.status(404).json({ error: `No contracts for sector '${sector}'` });
    res.json({ status: 'success', data: { sector, count: sectorContracts.length, deployed: sectorContracts.filter(c => c.deployed).length, contracts: sectorContracts } });
});

// ── GET /api/contracts/abi-public/:name ──
// Public ABI endpoint (no auth) for SubApp integration
router.get('/abi-public/:name', [
    param('name').isString().trim().isLength({ min: 1, max: 80 }).matches(/^[A-Za-z0-9_]+$/),
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const contractName = req.params.name;
    const abi = loadABI(contractName);
    if (!abi) return res.status(404).json({ error: `ABI not found for '${contractName}'` });
    const address = resolveAddress(contractName);
    res.json({ status: 'success', data: { name: contractName, address: address || null, deployed: !!address, chainId: loadDeployments().chainId || 31337, abi } });
});

module.exports = router;
