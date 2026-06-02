import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const basePath = path.join(__dirname, '..');
const outPath = path.join(basePath, 'smart-contracts', 'out');
const abiPath = path.join(basePath, 'smart-contracts', 'abi');

const sectors = {
    "Logistica": ["BeZhasLogisticsNFT", "QualityEscrow", "DeliveryEscrow", "WarehouseManager"],
    "Bienes Raices": ["LandCadastralRegistry", "LandTitleNFT", "TreasuryVault", "BeZhasWorkflowRegistry"],
    "Salud": ["HealthRecordSBT", "PharmaTracker", "HealthInsuranceEscrow", "ClinicalDataMarketplace"],
    "Energia": ["CarbonCreditToken", "P2PEnergyMarket", "SolarFarmToken", "ESGScoreOracle"],
    "Automotriz": ["VehicleIdentityNFT", "AutoPartsRegistry", "FleetLeaseEscrow", "EVChargeToken"],
    "Manufactura": ["QualityCertificateNFT", "DigitalTwinRegistry", "MaterialTokenMRP", "PredictiveMaintenanceLog"],
    "Agricultura": ["CropTokenFutures", "AgriSupplyChain", "AquaFarmMonitor", "LandTitleNFT"],
    "Seguros": ["PolicyNFT", "ClaimAdjuster", "ReinsurancePool", "ParametricInsurance"],
    "Educacion": ["CourseTokenNFT", "ScholarshipPool", "EduDAO", "SkillBadgeSBT"]
};

function generateApiKey(sector) {
    const prefix = sector.substring(0, 3).toUpperCase();
    return `BZH_${prefix}_CONFIGURE_IN_SECRET_MANAGER`;
}

function getWebhookUrl(sector) {
    const slug = sector.toLowerCase().replace(/ /g, '-');
    return `https://edge.bez.digital/webhook/${slug}`;
}

function readAbiFromJson(filePath) {
    if (fs.existsSync(filePath)) {
        try {
            const compiled = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            return JSON.stringify(Array.isArray(compiled) ? compiled : compiled.abi);
        } catch (e) {
            return null;
        }
    }
    return null;
}

function getAbi(contractName) {
    const exportedAbi = readAbiFromJson(path.join(abiPath, `${contractName}.json`));
    if (exportedAbi) return exportedAbi;

    const foundryArtifact = readAbiFromJson(path.join(outPath, `${contractName}.sol`, `${contractName}.json`));
    if (foundryArtifact) return foundryArtifact;

    return `[ABI de ${contractName} no encontrado en build (ejecutar 'forge build')]`;
}

function generateTxt() {
    let output = "=================================================================\n";
    output += "   BEZHAS BLOCKCHAIN - SUB-APP CREDENTIALS & INTEGRATION DATA\n";
    output += "=================================================================\n\n";
    output += "Este archivo contiene las credenciales (API Keys), Webhooks y ABIs necesarios\n";
    output += "para incrustar los servicios de BeZhas en las Sub Apps de cada sector.\n\n";

    for (const [sector, contracts] of Object.entries(sectors)) {
        output += `-----------------------------------------------------------------\n`;
        output += `SECTOR: ${sector.toUpperCase()}\n`;
        output += `-----------------------------------------------------------------\n`;
        output += `API KEY: ${generateApiKey(sector)}\n`;
        output += `WEBHOOK URL: ${getWebhookUrl(sector)}\n\n`;
        
        output += `CONTRATOS Y ABIs:\n`;
        for (const contract of contracts) {
            output += `\n>> Contrato: ${contract}\n`;
            output += `ABI JSON:\n${getAbi(contract)}\n`;
        }
        output += `\n\n`;
    }

    const outputPath = path.join(basePath, 'bezhas_subapp_credentials.txt');
    fs.writeFileSync(outputPath, output, 'utf8');
    console.log(`✅ Credenciales generadas exitosamente en: ${outputPath}`);
}

generateTxt();
