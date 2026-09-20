const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// RPC Provider (Polygon Mainnet) - ethers v6
const provider = new ethers.JsonRpcProvider(
    process.env.POLYGON_MAINNET_RPC || process.env.POLYGON_RPC_URL || 'https://polygon-bor.publicnode.com'
);

// Direcciones de contratos desde .env
const CONTRACTS = {
    BEZCOIN: process.env.BEZCOIN_ADDRESS || process.env.BEZCOIN_CONTRACT_ADDRESS,
    QUALITY_ESCROW: process.env.QUALITY_ESCROW_ADDRESS,
    RWA_FACTORY: process.env.RWA_FACTORY,
    RWA_VAULT: process.env.RWA_VAULT,
    GOVERNANCE: process.env.GOVERNANCE_SYSTEM_ADDRESS,
    CORE: process.env.BEZHAS_CORE_ADDRESS,
    FARMING: process.env.LIQUIDITY_FARMING_ADDRESS,
    NFT_OFFERS: process.env.NFT_OFFERS_ADDRESS,
    NFT_RENTAL: process.env.NFT_RENTAL_ADDRESS,
    MARKETPLACE: process.env.BEZHAS_MARKETPLACE_ADDRESS,
    ADMIN_REGISTRY: process.env.ADMIN_REGISTRY_ADDRESS
};

// ABIs - Importar desde artifacts compilados
//
// Los nombres se validan antes de entrar en la ruta. Vienen de constantes de
// este mismo fichero, así que hoy no hay agujero; pero la firma aceptaba
// cualquier cadena, y un `..` en el nombre habría permitido cargar un JSON de
// cualquier punto del disco. El validador lo cierra por construcción.
const NOMBRE_VALIDO = /^[A-Za-z0-9_]+$/;

const rutaDeArtefacto = (partes) => {
    for (const parte of partes) {
        if (!NOMBRE_VALIDO.test(parte)) {
            throw new Error(`Nombre de artefacto no válido: ${parte}`);
        }
    }
    return `../../artifacts/contracts/${partes.slice(0, -2).concat(partes[partes.length - 2] + '.sol', partes[partes.length - 1] + '.json').join('/')}`;
};

const getABI = (contractName, fileName = contractName) => {
    try {
        // La ruta la construye `rutaDeArtefacto`, que exige /^[A-Za-z0-9_]+$/
        // en cada parte: no puede salir de artifacts/contracts/.
        // eslint-disable-next-line security/detect-non-literal-require
        const artifact = require(rutaDeArtefacto([fileName, contractName]));
        return artifact.abi;
    } catch (error) {
        console.warn(`⚠️  No se pudo cargar ABI de ${contractName}:`, error.message);
        return [];
    }
};

const getABIFromSubfolder = (subfolder, contractName, fileName = contractName) => {
    try {
        // La ruta la construye `rutaDeArtefacto`, que exige /^[A-Za-z0-9_]+$/
        // en cada parte: no puede salir de artifacts/contracts/.
        // eslint-disable-next-line security/detect-non-literal-require
        const artifact = require(rutaDeArtefacto([subfolder, fileName, contractName]));
        return artifact.abi;
    } catch (error) {
        console.warn(`⚠️  No se pudo cargar ABI de ${contractName} desde ${subfolder}:`, error.message);
        return [];
    }
};

// ABIs de contratos
const ABIS = {
    BEZCOIN: getABI('BezhasToken'),
    QUALITY_ESCROW: getABIFromSubfolder('quality-oracle', 'BeZhasQualityEscrow'),
    RWA_FACTORY: getABI('BeZhasRWAFactory'),
    RWA_VAULT: getABI('BeZhasVault'),
    GOVERNANCE: getABI('GovernanceSystem'),
    CORE: getABI('BeZhasCore'),
    FARMING: getABI('LiquidityFarming'),
    NFT_OFFERS: getABI('NFTOffers'),
    NFT_RENTAL: getABI('NFTRental'),
    MARKETPLACE: getABI('BeZhasMarketplace'),
    ADMIN_REGISTRY: getABIFromSubfolder('admin', 'BeZhasAdminRegistry')
};

// Validar que las direcciones existen
const validateContracts = () => {
    const missingContracts = [];
    for (const [key, address] of Object.entries(CONTRACTS)) {
        if (!address || address === 'undefined') {
            missingContracts.push(key);
        }
    }

    if (missingContracts.length > 0) {
        console.warn('⚠️  Contratos sin dirección configurada:', missingContracts.join(', '));
        console.warn('   Verifica las variables de entorno en .env');
    }
};

validateContracts();

module.exports = {
    provider,
    CONTRACTS,
    ABIS,
    getABI,
    getABIFromSubfolder
};
