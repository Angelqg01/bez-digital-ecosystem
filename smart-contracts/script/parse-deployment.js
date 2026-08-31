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

// ESM, no CommonJS: el package.json de la raíz declara "type": "module", así
// que con `require` este script no arrancaba en absoluto — fallaba antes de la
// primera línea útil. Ése es el motivo de que el fichero de despliegue llevara
// tiempo sin regenerarse y le faltaran contratos.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const chainId = args.find((a) => !a.startsWith('--')) || '31337';
const broadcastDir = path.join(__dirname, '..', 'broadcast', 'DeployAll.s.sol', chainId);
const runLatest = path.join(broadcastDir, 'run-latest.json');

if (!fs.existsSync(runLatest)) {
    console.error(`No broadcast found at: ${runLatest}`);
    console.error('Run the deployment first: forge script script/DeployAll.s.sol --broadcast');
    process.exit(1);
}

const broadcast = JSON.parse(fs.readFileSync(runLatest, 'utf8'));

// ── Punto de partida: lo que YA hay registrado ──────────────────────────────
//
// Este script sólo lee el broadcast de DeployAll.s.sol, pero el fichero de
// despliegue lo alimentan varios scripts (DeployCore, los de wallet, los de
// validación). Antes se construía un objeto vacío y se escribía encima, de modo
// que ejecutar el comando documentado BORRABA todo lo que no viniera de
// DeployAll: la sección `wallet` entera y nueve contratos de `core`.
//
// Se parte del fichero existente y se superpone lo nuevo. Lo que este script no
// conoce, no lo toca.
const deploymentsDir = path.join(__dirname, '..', 'deployments');
const outPath = path.join(deploymentsDir, `${chainId}.json`);

let addresses = { chainId: parseInt(chainId), core: {}, sectors: {} };
let previous = null;
if (fs.existsSync(outPath)) {
    previous = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    addresses = JSON.parse(JSON.stringify(previous));
    addresses.core = addresses.core || {};
    addresses.sectors = addresses.sectors || {};
}
addresses.chainId = parseInt(chainId);
addresses.timestamp = new Date().toISOString();

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
        'ClearanceCertificateNFT', 'CustomsClearanceOracle', 'TrackingIntegrationGateway', 'TrackingToCustomsGateway',
        'TelemetryAnchor'],
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
    // DeliveryEscrow no es de sector: lo lee cargoLinkOnChain desde `core`.
    'DeliveryEscrow',
    // Registro on-chain de los rechazos de Aegis. Ver services/aegisOnChain.js.
    'AegisSecurityProvider',
];

// Build flat lookup of sector membership
const sectorLookup = {};
for (const [sector, contracts] of Object.entries(SECTOR_MAP)) {
    // Sólo se crea la sección si no existía: reasignarla a {} era la otra mitad
    // del borrado silencioso.
    addresses.sectors[sector] = addresses.sectors[sector] || {};
    for (const c of contracts) {
        sectorLookup[c] = sector;
    }
}

// Contratos desplegados que no encajan en ninguna lista.
//
// Esto se registra en vez de descartarse en silencio, que es lo que pasaba
// antes: `TelemetryAnchor` llevaba desplegado en cadena y ausente del JSON sin
// que nada lo dijera, así que la API lo daba por `not_configured` y el anclaje
// de telemetría no ocurría. Un allow-list que tira lo que no conoce sin avisar
// convierte cada contrato nuevo en un fallo silencioso a la espera.
const unlisted = [];
const added = [];
const freshNames = new Set();
const changed = [];

function track(key, before, after) {
    if (!before) added.push(key);
    else if (before.toLowerCase() !== after.toLowerCase()) changed.push({ key, before, after });
}

// Parse broadcast transactions
const txs = broadcast.transactions || [];
for (const tx of txs) {
    if (tx.transactionType !== 'CREATE') continue;
    const name = tx.contractName;
    const addr = tx.contractAddress;
    if (!name || !addr) continue;

    if (CORE_CONTRACTS.includes(name)) {
        track(`core.${name}`, addresses.core[name], addr);
        freshNames.add(`core.${name}`);
        addresses.core[name] = addr;
    } else if (sectorLookup[name]) {
        const sec = sectorLookup[name];
        track(`sectors.${sec}.${name}`, addresses.sectors[sec][name], addr);
        freshNames.add(`sectors.${sec}.${name}`);
        addresses.sectors[sec][name] = addr;
    } else {
        // Desplegado en cadena pero no reconocido por ninguna lista de arriba.
        unlisted.push(name);
    }
}

// ── Informe de lo que va a cambiar ──────────────────────────────────────────
//
// Se imprime SIEMPRE, y antes de escribir. Un script que sustituye direcciones
// de contratos sin decir cuáles es un script en el que no se puede confiar
// cuando el broadcast resulta ser de otra sesión de la cadena.
console.log(`\nDespliegue leído: ${runLatest}`);
console.log(`Contratos nuevos : ${added.length}`);
console.log(`Direcciones que CAMBIAN: ${changed.length}`);
for (const c of changed) console.log(`   ~ ${c.key}\n       ${c.before}\n    -> ${c.after}`);

// ── Colisiones de dirección ─────────────────────────────────────────────────
//
// Dos nombres apuntando a la MISMA dirección es siempre un error de datos: en
// una cadena determinista como Anvil, dos scripts de despliegue distintos
// generan las mismas direcciones, y fusionar sin mirar deja entradas viejas
// apuntando a contratos que ahora son otra cosa.
//
// Es el reverso del fallo que arreglé antes: sobrescribir destruía datos, pero
// conservar una entrada obsoleta conserva una mentira — y una dirección que
// apunta al contrato equivocado es peor que una ausente, porque nadie la
// cuestiona.
const byAddress = new Map();
const walk = (obj, prefix) => {
    for (const [k, v] of Object.entries(obj || {})) {
        if (v && typeof v === 'object') walk(v, `${prefix}${k}.`);
        else if (typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v)) {
            const key = v.toLowerCase();
            if (!byAddress.has(key)) byAddress.set(key, []);
            byAddress.get(key).push(`${prefix}${k}`);
        }
    }
};
walk(addresses.core, 'core.');
walk(addresses.sectors, 'sectors.');
for (const [k, v] of Object.entries(addresses)) {
    if (k !== 'core' && k !== 'sectors' && v && typeof v === 'object') walk(v, `${k}.`);
}

const collisions = [...byAddress.entries()].filter(([, names]) => names.length > 1);
if (collisions.length) {
    console.warn(`\n[AVISO] ${collisions.length} dirección(es) asignadas a MÁS DE UN contrato.`);
    console.warn('   Normalmente significa que quedan entradas de un despliegue anterior');
    console.warn('   cuyas direcciones deterministas coinciden con las de este. Revisa cuál');
    console.warn('   de los dos nombres es el correcto y borra el otro a mano.\n');
    for (const [addr, names] of collisions) {
        console.warn(`   ${addr}`);
        for (const n of names) {
            const fresh = freshNames.has(n) ? ' (de este despliegue)' : ' <- probablemente obsoleto';
            console.warn(`       ${n}${fresh}`);
        }
    }
    console.warn('');
}

if (DRY_RUN) {
    console.log('\n--dry-run: no se ha escrito nada.');
    process.exit(0);
}

if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
}

// Copia de seguridad antes de tocar nada. Las direcciones desplegadas no se
// pueden recomputar: si se pierden, hay que volver a desplegar.
if (previous) {
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
    const backup = `${outPath}.bak-${stamp}`;
    fs.writeFileSync(backup, JSON.stringify(previous, null, 2));
    console.log(`Copia de seguridad: ${path.basename(backup)}`);
}

fs.writeFileSync(outPath, JSON.stringify(addresses, null, 2));

console.log(`\nAddresses written to: ${outPath}`);
console.log(`Core contracts: ${Object.keys(addresses.core).length}`);
let sectorCount = 0;
for (const s of Object.values(addresses.sectors)) {
    sectorCount += Object.keys(s).length;
}
console.log(`Sector contracts: ${sectorCount}`);
console.log(`Total: ${Object.keys(addresses.core).length + sectorCount}`);

if (unlisted.length) {
    console.warn(
        `\n[AVISO] ${unlisted.length} contrato(s) desplegados NO se han escrito en `
        + `${chainId}.json porque no están en CORE_CONTRACTS ni en SECTOR_MAP:`
    );
    for (const n of unlisted) console.warn(`   - ${n}`);
    console.warn('   La API los verá como no configurados. Añádelos a las listas de este fichero.\n');
}
