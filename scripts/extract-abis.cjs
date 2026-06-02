#!/usr/bin/env node
/**
 * extract-abis.js — BeZhas ABI Extraction & Sync Pipeline
 * 
 * Reads Foundry compiled output from smart-contracts/out/,
 * extracts pure ABI arrays, and syncs them to:
 *   1. smart-contracts/abi/<ContractName>.json  (canonical ABIs)
 *   2. sdk/artifacts/contracts/<ContractName>.sol/<ContractName>.json (SDK format)
 * 
 * Also generates a contracts-manifest.json with metadata for the SDK.
 * 
 * Usage: node scripts/extract-abis.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'smart-contracts', 'out');
const ABI_DIR = path.join(ROOT, 'smart-contracts', 'abi');
const SDK_ARTIFACTS = path.join(ROOT, 'sdk', 'artifacts', 'contracts');
const DEPLOYMENTS_FILE = path.join(ROOT, 'smart-contracts', 'deployments', '31337.json');

// ── BeZhas contracts to extract (mapped from src/ structure) ──
// Only extract our contracts, not OpenZeppelin/forge-std internals
const BEZHAS_CONTRACTS = {
  // ═══ CORE (src/core/) ═══
  core: [
    'AegisSecurityProvider',
    'BEZCoinV2',
    'BEZPolygonBridge',
    'BEZSectorStandard',
    'BeZhasBridgeL2',
    'BeZhasDEX',
    'BeZhasPayment',
    'BeZhasWorkflowRegistry',
    'DeliveryEscrow',
    'EdgeNodeRewards',
    'GovernanceSystem',
    'L2Sequencer',
    'LiquidityFarming',
    'OpenClawAgent',
    'QualityEscrow',
    'SequencerRotation',
    'SlashingManager',
    'StakingPool',
    'ValidatorRegistry',
    'WrappedBEZ',
  ],

  // ═══ WALLET (src/wallet/) ═══
  wallet: [
    'SmartWallet',
    'SmartWalletFactory',
    'MultiSigWallet',
    'Paymaster',
    'SecurityModule',
    'WalletGuardian',
  ],

  // ═══ TOKENS (src/tokens/) ═══
  tokens: [
    'BeZhasLogisticsNFT',
  ],

  // ═══ BRIDGES (src/bridges/) ═══
  bridges: [],

  // ═══ IDENTITY ═══
  identity: [
    'IdentityRegistry',
  ],

  // ═══ SECTOR: HEALTH (src/health/) ═══
  health: [
    'HealthRecordSBT',
    'PharmaTracker',
    'HealthInsuranceEscrow',
    'ClinicalDataMarketplace',
  ],

  // ═══ SECTOR: ENERGY (src/energy/) ═══
  energy: [
    'CarbonCreditToken',
    'P2PEnergyMarket',
    'SolarFarmToken',
    'ESGScoreOracle',
  ],

  // ═══ SECTOR: AUTOMOTIVE (src/automotive/) ═══
  automotive: [
    'VehicleIdentityNFT',
    'AutoPartsRegistry',
    'FleetLeaseEscrow',
    'EVChargeToken',
  ],

  // ═══ SECTOR: MANUFACTURING (src/manufacturing/) ═══
  manufacturing: [
    'QualityCertificateNFT',
    'DigitalTwinRegistry',
    'MaterialTokenMRP',
    'PredictiveMaintenanceLog',
  ],

  // ═══ SECTOR: AGRICULTURE (src/agriculture/) ═══
  agriculture: [
    'CropTokenFutures',
    'AgriSupplyChain',
    'AquaFarmMonitor',
    'LandTitleNFT',
  ],

  // ═══ SECTOR: INSURANCE (src/insurance/) ═══
  insurance: [
    'PolicyNFT',
    'ParametricInsurance',
    'ClaimAdjuster',
    'ReinsurancePool',
  ],

  // ═══ SECTOR: EDUCATION (src/education/) ═══
  education: [
    'CourseTokenNFT',
    'SkillBadgeSBT',
    'EduDAO',
    'ScholarshipPool',
  ],

  // ═══ SECTOR: ENTERTAINMENT (src/entertainment/) ═══
  entertainment: [
    'EventTicketNFT',
    'FanTokenDAO',
    'RoyaltyDistributor',
    'StreamingRightsMarket',
  ],

  // ═══ SECTOR: LEGAL (src/legal/) ═══
  legal: [
    'SmartLegalContract',
    'EvidenceVault',
    'ArbitrationDAO',
    'IPRegistryNFT',
  ],

  // ═══ SECTOR: SUPPLY CHAIN (src/supplychain/) ═══
  supplychain: [
    'SupplyTracker',
    'ProcurementNFT',
    'WarehouseManager',
    'SupplierScoreOracle',
    'ClearanceCertificateNFT',
    'CustomsClearanceOracle',
    'TrackingIntegrationGateway',
    'TrackingToCustomsGateway',
  ],

  // ═══ SECTOR: GOVERNMENT (src/government/) ═══
  government: [
    'CitizenIdentityNFT',
    'PublicBudgetDAO',
    'LandCadastralRegistry',
    'VotingSystem',
  ],

  // ═══ SECTOR: FINANCE (src/finance/) ═══
  finance: [
    'MicroLendingPool',
    'InvoiceFactoring',
    'CreditScoreOracle',
    'TreasuryVault',
  ],

  // ═══ SECTOR: SERVICES (src/services/) ═══
  services: [
    'FreelanceMarketplace',
    'SubscriptionManager',
    'SLAMonitor',
    'ServiceReputationNFT',
  ],

  // ═══ SECTOR: OTROS (src/otros/) ═══
  otros: [
    'LoyaltyRewards',
    'CrowdfundingPool',
    'P2PMarketplace',
    'CharityVault',
  ],
};

// ── Flatten all contract names ──
const ALL_CONTRACTS = [];
for (const [sector, contracts] of Object.entries(BEZHAS_CONTRACTS)) {
  for (const name of contracts) {
    ALL_CONTRACTS.push({ name, sector });
  }
}

console.log(`\n🔧 BeZhas ABI Extraction Pipeline`);
console.log(`═══════════════════════════════════════`);
console.log(`📦 Contracts to extract: ${ALL_CONTRACTS.length}`);
console.log(`📂 Source: ${OUT_DIR}`);
console.log(`📂 Target ABI: ${ABI_DIR}`);
console.log(`📂 Target SDK: ${SDK_ARTIFACTS}\n`);

// ── Ensure output directories ──
fs.mkdirSync(ABI_DIR, { recursive: true });
fs.mkdirSync(SDK_ARTIFACTS, { recursive: true });

// ── Extract ABIs ──
const results = { success: [], missing: [], errors: [] };
const manifest = {};

for (const { name, sector } of ALL_CONTRACTS) {
  const foundryPath = path.join(OUT_DIR, `${name}.sol`, `${name}.json`);
  
  if (!fs.existsSync(foundryPath)) {
    results.missing.push(name);
    console.log(`  ⚠️  MISSING: ${name}.sol (sector: ${sector})`);
    continue;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(foundryPath, 'utf-8'));
    const abi = raw.abi;
    const methodIds = raw.methodIdentifiers || {};

    if (!abi || !Array.isArray(abi) || abi.length === 0) {
      results.errors.push({ name, error: 'Empty ABI' });
      console.log(`  ❌ EMPTY ABI: ${name}`);
      continue;
    }

    // 1. Write clean ABI to smart-contracts/abi/
    const cleanAbi = {
      contractName: name,
      sector: sector,
      abi: abi,
      methodIdentifiers: methodIds,
    };
    fs.writeFileSync(
      path.join(ABI_DIR, `${name}.json`),
      JSON.stringify(cleanAbi, null, 2)
    );

    // 2. Write Foundry-format artifact to sdk/artifacts/contracts/
    const sdkDir = path.join(SDK_ARTIFACTS, `${name}.sol`);
    fs.mkdirSync(sdkDir, { recursive: true });
    // SDK needs the full artifact (abi + bytecode for deploy)
    const sdkArtifact = {
      contractName: name,
      abi: abi,
      bytecode: raw.bytecode?.object || '',
      deployedBytecode: raw.deployedBytecode?.object || '',
    };
    fs.writeFileSync(
      path.join(sdkDir, `${name}.json`),
      JSON.stringify(sdkArtifact, null, 2)
    );

    // 3. Add to manifest
    const fnCount = abi.filter(e => e.type === 'function').length;
    const evCount = abi.filter(e => e.type === 'event').length;
    const errCount = abi.filter(e => e.type === 'error').length;

    manifest[name] = {
      sector,
      functions: fnCount,
      events: evCount,
      errors: errCount,
      abiPath: `abi/${name}.json`,
      sdkPath: `sdk/artifacts/contracts/${name}.sol/${name}.json`,
    };

    results.success.push(name);
    console.log(`  ✅ ${name} — ${fnCount} functions, ${evCount} events`);
  } catch (err) {
    results.errors.push({ name, error: err.message });
    console.log(`  ❌ ERROR: ${name} — ${err.message}`);
  }
}

// ── Write manifest ──
const manifestPath = path.join(ROOT, 'smart-contracts', 'abi', 'manifest.json');
const fullManifest = {
  generated: new Date().toISOString(),
  totalContracts: ALL_CONTRACTS.length,
  extracted: results.success.length,
  missing: results.missing.length,
  errors: results.errors.length,
  contracts: manifest,
};
fs.writeFileSync(manifestPath, JSON.stringify(fullManifest, null, 2));

// ── Generate SDK ABI_ARTIFACTS require map ──
const requireLines = results.success.map(name => {
  return `    ${name}: require('./artifacts/contracts/${name}.sol/${name}.json'),`;
});

const sdkMapPath = path.join(ROOT, 'smart-contracts', 'abi', 'sdk-require-map.js');
const sdkMap = `/**
 * Auto-generated ABI_ARTIFACTS map for sdk/contracts.js
 * Generated: ${new Date().toISOString()}
 * Contracts: ${results.success.length}
 * 
 * Copy this block into sdk/contracts.js to replace the existing ABI_ARTIFACTS
 */
const ABI_ARTIFACTS = {
${requireLines.join('\n')}
};
`;
fs.writeFileSync(sdkMapPath, sdkMap);

// ── Summary ──
console.log(`\n═══════════════════════════════════════`);
console.log(`📊 Results:`);
console.log(`   ✅ Extracted: ${results.success.length}`);
console.log(`   ⚠️  Missing:   ${results.missing.length}`);
console.log(`   ❌ Errors:    ${results.errors.length}`);
console.log(`\n📄 Manifest: ${manifestPath}`);
console.log(`📄 SDK Map:  ${sdkMapPath}`);

if (results.missing.length > 0) {
  console.log(`\n⚠️  Missing contracts (need forge build):`);
  results.missing.forEach(n => console.log(`   - ${n}`));
}

if (results.errors.length > 0) {
  console.log(`\n❌ Errors:`);
  results.errors.forEach(e => console.log(`   - ${e.name}: ${e.error}`));
}

console.log(`\n✨ Done! Next steps:`);
console.log(`   1. Review sdk-require-map.js`);
console.log(`   2. Update sdk/contracts.js with the new ABI_ARTIFACTS`);
console.log(`   3. Run: node -e "const s=require('./sdk'); console.log(s.listContracts())"`);
console.log(``);
