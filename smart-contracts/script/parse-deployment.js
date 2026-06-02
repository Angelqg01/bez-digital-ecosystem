/**
 * parse-deployment.js
 * 
 * Parses Foundry broadcast JSON output and generates addresses.json
 * for the backend API and frontend.
 * 
 * Usage:
 *   node script/parse-deployment.js [chainId]
 *   node script/parse-deployment.js 31337   (Anvil)
 *   node script/parse-deployment.js 2708    (BeZhas L2)
 */

const fs = require('fs');
const path = require('path');

const chainId = process.argv[2] || '31337';
const broadcastDir = path.join(__dirname, '..', 'broadcast', 'DeployAll.s.sol', chainId);
const runLatest = path.join(broadcastDir, 'run-latest.json');

if (!fs.existsSync(runLatest)) {
    console.error(`No broadcast found at: ${runLatest}`);
    console.error('Run the deployment first: forge script script/DeployAll.s.sol --broadcast');
    process.exit(1);
}

const broadcast = JSON.parse(fs.readFileSync(runLatest, 'utf8'));

const addresses = {
    chainId: parseInt(chainId),
    timestamp: new Date().toISOString(),
    core: {},
    sectors: {}
};

// Known contract names grouped by sector
const SECTOR_MAP = {
    health: ['HealthRecordSBT', 'PharmaTracker', 'HealthInsuranceEscrow', 'ClinicalDataMarketplace'],
    energy: ['CarbonCreditToken', 'P2PEnergyMarket', 'SolarFarmToken', 'ESGScoreOracle'],
    automotive: ['VehicleIdentityNFT', 'AutoPartsRegistry', 'FleetLeaseEscrow', 'EVChargeToken'],
    manufacturing: ['QualityCertificateNFT', 'DigitalTwinRegistry', 'MaterialTokenMRP', 'PredictiveMaintenanceLog'],
    agriculture: ['CropTokenFutures', 'AgriSupplyChain', 'AquaFarmMonitor', 'LandTitleNFT'],
    insurance: ['PolicyNFT', 'ParametricInsurance', 'ClaimAdjuster', 'ReinsurancePool'],
    education: ['CourseTokenNFT', 'SkillBadgeSBT', 'EduDAO', 'ScholarshipPool'],
    entertainment: ['EventTicketNFT', 'FanTokenDAO', 'RoyaltyDistributor', 'StreamingRightsMarket'],
    legal: ['SmartLegalContract', 'EvidenceVault', 'ArbitrationDAO', 'IPRegistryNFT'],
    supplychain: ['SupplyTracker', 'ProcurementNFT', 'WarehouseManager', 'SupplierScoreOracle',
        'ClearanceCertificateNFT', 'CustomsClearanceOracle', 'TrackingIntegrationGateway', 'TrackingToCustomsGateway'],
    government: ['CitizenIdentityNFT', 'PublicBudgetDAO', 'LandCadastralRegistry', 'VotingSystem'],
    finance: ['MicroLendingPool', 'InvoiceFactoring', 'CreditScoreOracle', 'TreasuryVault'],
    services: ['FreelanceMarketplace', 'SubscriptionManager', 'SLAMonitor', 'ServiceReputationNFT'],
    otros: ['LoyaltyRewards', 'CrowdfundingPool', 'P2PMarketplace', 'CharityVault']
};

// Core contracts (plus validation system contracts)
// Note: backend/seed-contracts.js and frontend address lookups depend on this list.
const CORE_CONTRACTS = [
    'BEZCoinV2',
    'BeZhasLogisticsNFT',
    'QualityEscrow',
    'BeZhasBridgeL2',
    'StakingPool',
    'LiquidityFarming',
    'ValidatorRegistry',
    'EdgeNodeRewards',
    'SequencerRotation',
    'SlashingManager',
];

// Build flat lookup of sector membership
const sectorLookup = {};
for (const [sector, contracts] of Object.entries(SECTOR_MAP)) {
    addresses.sectors[sector] = {};
    for (const c of contracts) {
        sectorLookup[c] = sector;
    }
}

// Parse broadcast transactions
const txs = broadcast.transactions || [];
for (const tx of txs) {
    if (tx.transactionType !== 'CREATE') continue;
    const name = tx.contractName;
    const addr = tx.contractAddress;
    if (!name || !addr) continue;

    if (CORE_CONTRACTS.includes(name)) {
        addresses.core[name] = addr;
    } else if (sectorLookup[name]) {
        addresses.sectors[sectorLookup[name]][name] = addr;
    }
}

// Write output
const deploymentsDir = path.join(__dirname, '..', 'deployments');
if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
}

const outPath = path.join(deploymentsDir, `${chainId}.json`);
fs.writeFileSync(outPath, JSON.stringify(addresses, null, 2));

console.log(`\nAddresses written to: ${outPath}`);
console.log(`Core contracts: ${Object.keys(addresses.core).length}`);
let sectorCount = 0;
for (const s of Object.values(addresses.sectors)) {
    sectorCount += Object.keys(s).length;
}
console.log(`Sector contracts: ${sectorCount}`);
console.log(`Total: ${Object.keys(addresses.core).length + sectorCount}`);
