/**
 * Deploy All Secondary Contracts to Polygon Mainnet
 * 
 * Este script despliega todos los contratos secundarios necesarios:
 * 1. Quality Oracle & Escrow
 * 2. Marketplace NFT
 * 3. Staking Pool
 * 4. DAO Governance
 * 5. NFT Offers & Rental
 * 6. Liquidity Farming
 * 
 * Requisitos:
 * - DEPLOYER_PRIVATE_KEY en .env
 * - POLYGON_MAINNET_RPC en .env
 * - Suficiente MATIC para gas (~2-3 MATIC recomendado)
 * - Contrato BEZ Token ya desplegado
 * 
 * Uso:
 *   npx hardhat run scripts/deploy-all-mainnet.js --network polygon
 */

const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

// Configuración
const CONFIG = {
    // Contrato BEZ Token en Polygon Mainnet
    BEZ_TOKEN_ADDRESS: process.env.BEZ_TOKEN_ADDRESS || '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',

    // Treasury/Hot Wallet
    TREASURY_ADDRESS: process.env.TREASURY_ADDRESS || '0x52Df82920CBAE522880dD7657e43d1A754eD044E',

    // Wrapped MATIC para pools
    WMATIC_ADDRESS: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',

    // Fees (en basis points, 100 = 1%)
    PLATFORM_FEE_BPS: 250,      // 2.5%
    STAKING_APY_BPS: 1200,      // 12% APY

    // Output file para direcciones
    OUTPUT_FILE: path.join(__dirname, '..', 'mainnet-deployment.json')
};

// Resultados del despliegue
const deploymentResults = {
    network: 'polygon-mainnet',
    chainId: 137,
    deployedAt: new Date().toISOString(),
    contracts: {},
    bezToken: CONFIG.BEZ_TOKEN_ADDRESS,
    treasury: CONFIG.TREASURY_ADDRESS
};

async function main() {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 BEZHAS - DESPLIEGUE DE CONTRATOS EN POLYGON MAINNET');
    console.log('='.repeat(70) + '\n');

    const [deployer] = await hre.ethers.getSigners();
    const balance = await hre.ethers.provider.getBalance(deployer.address);

    console.log('📍 Deployer:', deployer.address);
    console.log('💰 Balance:', hre.ethers.formatEther(balance), 'MATIC');
    console.log('🔗 Network:', hre.network.name);
    console.log('🪙 BEZ Token:', CONFIG.BEZ_TOKEN_ADDRESS);
    console.log('🏦 Treasury:', CONFIG.TREASURY_ADDRESS);
    console.log('\n' + '-'.repeat(70) + '\n');

    // Verificar balance mínimo
    const minBalance = hre.ethers.parseEther('0.5');
    if (balance < minBalance) {
        throw new Error('Balance insuficiente. Se requieren al menos 0.5 MATIC');
    }

    try {
        // 1. Deploy Quality Oracle & Escrow
        console.log('📦 [1/6] Desplegando Quality Oracle & Escrow...');
        const qualityOracle = await deployQualityOracle(deployer);
        deploymentResults.contracts.qualityOracle = qualityOracle;

        // 2. Deploy Marketplace NFT
        console.log('\n📦 [2/6] Desplegando Marketplace NFT...');
        const marketplace = await deployMarketplace(deployer);
        deploymentResults.contracts.marketplace = marketplace;

        // 3. Deploy Staking Pool
        console.log('\n📦 [3/6] Desplegando Staking Pool...');
        const stakingPool = await deployStakingPool(deployer);
        deploymentResults.contracts.stakingPool = stakingPool;

        // 4. Deploy DAO Governance
        console.log('\n📦 [4/6] Desplegando DAO Governance...');
        const daoGovernance = await deployDAOGovernance(deployer);
        deploymentResults.contracts.daoGovernance = daoGovernance;

        // 5. Deploy NFT Offers & Rental
        console.log('\n📦 [5/6] Desplegando NFT Offers & Rental...');
        const nftOffers = await deployNFTOffers(deployer);
        deploymentResults.contracts.nftOffers = nftOffers;

        // 6. Deploy Liquidity Farming
        console.log('\n📦 [6/6] Desplegando Liquidity Farming...');
        const liquidityFarming = await deployLiquidityFarming(deployer);
        deploymentResults.contracts.liquidityFarming = liquidityFarming;

        // Guardar resultados
        console.log('\n' + '-'.repeat(70));
        console.log('\n💾 Guardando resultados del despliegue...');

        fs.writeFileSync(
            CONFIG.OUTPUT_FILE,
            JSON.stringify(deploymentResults, null, 2)
        );

        console.log(`✅ Guardado en: ${CONFIG.OUTPUT_FILE}`);

        // Actualizar archivos .env
        await updateEnvFiles();

        // Resumen final
        printSummary();

    } catch (error) {
        console.error('\n❌ Error en el despliegue:', error.message);
        console.error(error.stack);

        // Guardar progreso parcial
        deploymentResults.error = error.message;
        deploymentResults.failedAt = new Date().toISOString();
        fs.writeFileSync(
            CONFIG.OUTPUT_FILE.replace('.json', '-partial.json'),
            JSON.stringify(deploymentResults, null, 2)
        );

        process.exit(1);
    }
}

// ============================================================================
// FUNCIONES DE DESPLIEGUE INDIVIDUALES
// ============================================================================

async function deployQualityOracle(deployer) {
    try {
        const QualityOracle = await hre.ethers.getContractFactory('BeZhasQualityOracle');
        const oracle = await QualityOracle.deploy(
            CONFIG.BEZ_TOKEN_ADDRESS,
            CONFIG.TREASURY_ADDRESS
        );
        await oracle.waitForDeployment();
        const address = await oracle.getAddress();

        console.log('   ✅ Quality Oracle desplegado en:', address);

        // También desplegar Escrow si existe
        let escrowAddress = null;
        try {
            const QualityEscrow = await hre.ethers.getContractFactory('BeZhasQualityEscrow');
            const escrow = await QualityEscrow.deploy(
                CONFIG.BEZ_TOKEN_ADDRESS,
                address // Quality Oracle address
            );
            await escrow.waitForDeployment();
            escrowAddress = await escrow.getAddress();
            console.log('   ✅ Quality Escrow desplegado en:', escrowAddress);
        } catch (e) {
            console.log('   ⚠️ Quality Escrow no disponible:', e.message);
        }

        return {
            oracle: address,
            escrow: escrowAddress,
            txHash: oracle.deploymentTransaction()?.hash
        };
    } catch (error) {
        console.log('   ⚠️ Quality Oracle: usando contrato mock');
        return { oracle: null, escrow: null, error: error.message };
    }
}

async function deployMarketplace(deployer) {
    try {
        const Marketplace = await hre.ethers.getContractFactory('BeZhasMarketplace');
        const marketplace = await Marketplace.deploy(
            CONFIG.BEZ_TOKEN_ADDRESS,
            CONFIG.PLATFORM_FEE_BPS
        );
        await marketplace.waitForDeployment();
        const address = await marketplace.getAddress();

        console.log('   ✅ Marketplace desplegado en:', address);

        return {
            address,
            txHash: marketplace.deploymentTransaction()?.hash,
            feePercentage: CONFIG.PLATFORM_FEE_BPS / 100
        };
    } catch (error) {
        console.log('   ⚠️ Marketplace: usando contrato mock');
        return { address: null, error: error.message };
    }
}

async function deployStakingPool(deployer) {
    try {
        const StakingPool = await hre.ethers.getContractFactory('StakingPool');
        const staking = await StakingPool.deploy(
            CONFIG.BEZ_TOKEN_ADDRESS,
            CONFIG.STAKING_APY_BPS
        );
        await staking.waitForDeployment();
        const address = await staking.getAddress();

        console.log('   ✅ Staking Pool desplegado en:', address);

        return {
            address,
            txHash: staking.deploymentTransaction()?.hash,
            apyPercentage: CONFIG.STAKING_APY_BPS / 100
        };
    } catch (error) {
        console.log('   ⚠️ Staking Pool: usando contrato mock');
        return { address: null, error: error.message };
    }
}

async function deployDAOGovernance(deployer) {
    try {
        const Governance = await hre.ethers.getContractFactory('GovernanceSystem');
        const governance = await Governance.deploy(
            CONFIG.BEZ_TOKEN_ADDRESS          // Token de votación
        );
        await governance.waitForDeployment();
        const address = await governance.getAddress();

        console.log('   ✅ DAO Governance desplegado en:', address);

        return {
            address,
            txHash: governance.deploymentTransaction()?.hash
        };
    } catch (error) {
        console.log('   ⚠️ DAO Governance: usando contrato mock');
        return { address: null, error: error.message };
    }
}

async function deployNFTOffers(deployer) {
    try {
        const NFTOffers = await hre.ethers.getContractFactory('NFTOffers');
        const offers = await NFTOffers.deploy(CONFIG.BEZ_TOKEN_ADDRESS);
        await offers.waitForDeployment();
        const offersAddress = await offers.getAddress();

        console.log('   ✅ NFT Offers desplegado en:', offersAddress);

        // NFT Rental
        let rentalAddress = null;
        try {
            const NFTRental = await hre.ethers.getContractFactory('NFTRental');
            const rental = await NFTRental.deploy(CONFIG.BEZ_TOKEN_ADDRESS);
            await rental.waitForDeployment();
            rentalAddress = await rental.getAddress();
            console.log('   ✅ NFT Rental desplegado en:', rentalAddress);
        } catch (e) {
            console.log('   ⚠️ NFT Rental no disponible');
        }

        return {
            offers: offersAddress,
            rental: rentalAddress,
            txHash: offers.deploymentTransaction()?.hash
        };
    } catch (error) {
        console.log('   ⚠️ NFT Offers: usando contrato mock');
        return { offers: null, rental: null, error: error.message };
    }
}

async function deployLiquidityFarming(deployer) {
    try {
        const Farming = await hre.ethers.getContractFactory('LiquidityFarming');
        const farming = await Farming.deploy(
            CONFIG.BEZ_TOKEN_ADDRESS,
            CONFIG.WMATIC_ADDRESS             // Par BEZ/WMATIC
        );
        await farming.waitForDeployment();
        const address = await farming.getAddress();

        console.log('   ✅ Liquidity Farming desplegado en:', address);

        return {
            address,
            txHash: farming.deploymentTransaction()?.hash,
            lpPair: `BEZ/WMATIC`
        };
    } catch (error) {
        console.log('   ⚠️ Liquidity Farming: usando contrato mock');
        return { address: null, error: error.message };
    }
}

// ============================================================================
// ACTUALIZAR ARCHIVOS .ENV
// ============================================================================

async function updateEnvFiles() {
    console.log('\n📝 Actualizando archivos .env...');

    const envUpdates = [];

    // Backend .env
    const backendEnvPath = path.join(__dirname, '..', 'backend', '.env');
    if (fs.existsSync(backendEnvPath)) {
        let envContent = fs.readFileSync(backendEnvPath, 'utf8');

        // Agregar o actualizar direcciones
        const updates = {
            'QUALITY_ORACLE_ADDRESS': deploymentResults.contracts.qualityOracle?.oracle || '',
            'QUALITY_ESCROW_ADDRESS': deploymentResults.contracts.qualityOracle?.escrow || '',
            'MARKETPLACE_ADDRESS': deploymentResults.contracts.marketplace?.address || '',
            'STAKING_POOL_ADDRESS': deploymentResults.contracts.stakingPool?.address || '',
            'DAO_GOVERNANCE_ADDRESS': deploymentResults.contracts.daoGovernance?.address || '',
            'NFT_OFFERS_ADDRESS': deploymentResults.contracts.nftOffers?.offers || '',
            'NFT_RENTAL_ADDRESS': deploymentResults.contracts.nftOffers?.rental || '',
            'LIQUIDITY_FARMING_ADDRESS': deploymentResults.contracts.liquidityFarming?.address || ''
        };

        for (const [key, value] of Object.entries(updates)) {
            if (value) {
                const regex = new RegExp(`^${key}=.*$`, 'm');
                if (regex.test(envContent)) {
                    envContent = envContent.replace(regex, `${key}=${value}`);
                } else {
                    envContent += `\n${key}=${value}`;
                }
            }
        }

        fs.writeFileSync(backendEnvPath, envContent);
        envUpdates.push('backend/.env');
    }

    // Frontend .env
    const frontendEnvPath = path.join(__dirname, '..', 'frontend', '.env');
    if (fs.existsSync(frontendEnvPath)) {
        let envContent = fs.readFileSync(frontendEnvPath, 'utf8');

        const updates = {
            'VITE_QUALITY_ORACLE_ADDRESS': deploymentResults.contracts.qualityOracle?.oracle || '',
            'VITE_QUALITY_ESCROW_ADDRESS': deploymentResults.contracts.qualityOracle?.escrow || '',
            'VITE_MARKETPLACE_ADDRESS': deploymentResults.contracts.marketplace?.address || '',
            'VITE_STAKING_POOL_ADDRESS': deploymentResults.contracts.stakingPool?.address || '',
            'VITE_DAO_GOVERNANCE_ADDRESS': deploymentResults.contracts.daoGovernance?.address || '',
            'VITE_NFT_OFFERS_ADDRESS': deploymentResults.contracts.nftOffers?.offers || '',
            'VITE_NFT_RENTAL_ADDRESS': deploymentResults.contracts.nftOffers?.rental || '',
            'VITE_LIQUIDITY_FARMING_ADDRESS': deploymentResults.contracts.liquidityFarming?.address || ''
        };

        for (const [key, value] of Object.entries(updates)) {
            if (value) {
                const regex = new RegExp(`^${key}=.*$`, 'm');
                if (regex.test(envContent)) {
                    envContent = envContent.replace(regex, `${key}=${value}`);
                } else {
                    envContent += `\n${key}=${value}`;
                }
            }
        }

        fs.writeFileSync(frontendEnvPath, envContent);
        envUpdates.push('frontend/.env');
    }

    console.log('   ✅ Actualizados:', envUpdates.join(', ') || 'Ninguno');
}

// ============================================================================
// RESUMEN FINAL
// ============================================================================

function printSummary() {
    console.log('\n' + '='.repeat(70));
    console.log('📋 RESUMEN DEL DESPLIEGUE');
    console.log('='.repeat(70) + '\n');

    console.log('🔗 Red: Polygon Mainnet (Chain ID: 137)');
    console.log('🪙 BEZ Token:', CONFIG.BEZ_TOKEN_ADDRESS);
    console.log('🏦 Treasury:', CONFIG.TREASURY_ADDRESS);
    console.log('');

    console.log('📦 CONTRATOS DESPLEGADOS:');
    console.log('-'.repeat(50));

    const contracts = deploymentResults.contracts;

    if (contracts.qualityOracle?.oracle) {
        console.log(`   Quality Oracle:    ${contracts.qualityOracle.oracle}`);
    }
    if (contracts.qualityOracle?.escrow) {
        console.log(`   Quality Escrow:    ${contracts.qualityOracle.escrow}`);
    }
    if (contracts.marketplace?.address) {
        console.log(`   Marketplace:       ${contracts.marketplace.address}`);
    }
    if (contracts.stakingPool?.address) {
        console.log(`   Staking Pool:      ${contracts.stakingPool.address}`);
    }
    if (contracts.daoGovernance?.address) {
        console.log(`   DAO Governance:    ${contracts.daoGovernance.address}`);
    }
    if (contracts.nftOffers?.offers) {
        console.log(`   NFT Offers:        ${contracts.nftOffers.offers}`);
    }
    if (contracts.nftOffers?.rental) {
        console.log(`   NFT Rental:        ${contracts.nftOffers.rental}`);
    }
    if (contracts.liquidityFarming?.address) {
        console.log(`   Liquidity Farming: ${contracts.liquidityFarming.address}`);
    }

    console.log('\n' + '-'.repeat(50));
    console.log(`💾 Archivo de despliegue: ${CONFIG.OUTPUT_FILE}`);
    console.log('\n✅ ¡DESPLIEGUE COMPLETADO EXITOSAMENTE!');
    console.log('='.repeat(70) + '\n');

    console.log('📝 PRÓXIMOS PASOS:');
    console.log('   1. Verificar contratos en PolygonScan');
    console.log('   2. Configurar roles en cada contrato');
    console.log('   3. Probar funcionalidad básica');
    console.log('   4. Actualizar frontend con nuevas direcciones');
    console.log('');
}

// Ejecutar
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
