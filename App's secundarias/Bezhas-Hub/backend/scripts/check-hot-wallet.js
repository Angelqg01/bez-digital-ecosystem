/**
 * Hot Wallet Status Checker
 * Verifica el estado de la Hot Wallet para pagos automáticos
 */

const { ethers } = require('ethers');
require('dotenv').config();

const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || 'https://polygon-bor.publicnode.com';
const HOT_WALLET_PRIVATE_KEY = process.env.HOT_WALLET_PRIVATE_KEY;
const BEZCOIN_ADDRESS = process.env.BEZCOIN_CONTRACT_ADDRESS || '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';

const TOKEN_ABI = [
    "function balanceOf(address account) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function name() view returns (string)"
];

async function checkHotWalletStatus() {
    try {
        console.log('🔍 Verificando Hot Wallet Status...\n');

        // Initialize Provider
        const provider = new ethers.JsonRpcProvider(POLYGON_RPC_URL);
        console.log('✅ Conectado a Polygon RPC');

        // Initialize Wallet
        if (!HOT_WALLET_PRIVATE_KEY) {
            throw new Error('❌ HOT_WALLET_PRIVATE_KEY no configurada en .env');
        }

        const wallet = new ethers.Wallet(HOT_WALLET_PRIVATE_KEY, provider);
        const hotWalletAddress = wallet.address;

        console.log(`📍 Hot Wallet Address: ${hotWalletAddress}\n`);

        // Check MATIC Balance (for gas)
        const maticBalance = await provider.getBalance(hotWalletAddress);
        const maticFormatted = ethers.formatEther(maticBalance);

        console.log('⛽ MATIC Balance (para gas):');
        console.log(`   ${maticFormatted} MATIC`);

        if (parseFloat(maticFormatted) < 0.01) {
            console.log('   ⚠️  WARNING: Saldo bajo de MATIC. Fondea al menos 0.1 MATIC');
        } else if (parseFloat(maticFormatted) < 0.1) {
            console.log('   ⚠️  CAUTION: Considera fondear más MATIC para múltiples transacciones');
        } else {
            console.log('   ✅ Saldo suficiente para gas');
        }

        // Check BEZ Token Balance
        console.log('\n💎 BEZ Token Balance:');
        const bezContract = new ethers.Contract(BEZCOIN_ADDRESS, TOKEN_ABI, provider);

        const tokenName = await bezContract.name();
        const tokenSymbol = await bezContract.symbol();
        const decimals = await bezContract.decimals();
        const bezBalance = await bezContract.balanceOf(hotWalletAddress);
        const bezFormatted = ethers.formatUnits(bezBalance, decimals);

        console.log(`   Token: ${tokenName} (${tokenSymbol})`);
        console.log(`   Balance: ${bezFormatted} ${tokenSymbol}`);
        console.log(`   Contract: ${BEZCOIN_ADDRESS}`);

        if (parseFloat(bezFormatted) < 100) {
            console.log('   ⚠️  WARNING: Saldo muy bajo de BEZ tokens');
            console.log('   💡 Transfiere BEZ tokens a esta wallet para distribución automática');
        } else if (parseFloat(bezFormatted) < 1000) {
            console.log('   ⚠️  CAUTION: Considera transferir más BEZ tokens');
        } else {
            console.log('   ✅ Saldo suficiente para distribución');
        }

        // Network Info
        console.log('\n🌐 Network Info:');
        const network = await provider.getNetwork();
        const blockNumber = await provider.getBlockNumber();
        console.log(`   Chain ID: ${network.chainId}`);
        console.log(`   Network: ${network.name}`);
        console.log(`   Block Number: ${blockNumber}`);

        // Funding Instructions
        console.log('\n📋 Instrucciones de Fondeo:');
        console.log('   1. MATIC (para gas):');
        console.log(`      - Envía al menos 0.5 MATIC a: ${hotWalletAddress}`);
        console.log('      - Usa Polygon Bridge: https://wallet.polygon.technology/');
        console.log('   ');
        console.log('   2. BEZ Tokens (para distribución):');
        console.log(`      - Envía BEZ tokens a: ${hotWalletAddress}`);
        console.log('      - Desde tu wallet principal o exchange');
        console.log('   ');
        console.log('   3. Verificación:');
        console.log('      - PolygonScan: https://polygonscan.com/address/' + hotWalletAddress);

        // Status Summary
        console.log('\n📊 Status Summary:');
        const maticOk = parseFloat(maticFormatted) >= 0.1;
        const bezOk = parseFloat(bezFormatted) >= 100;
        const allOk = maticOk && bezOk;

        console.log(`   MATIC Ready: ${maticOk ? '✅' : '❌'}`);
        console.log(`   BEZ Ready: ${bezOk ? '✅' : '❌'}`);
        console.log(`   System Ready: ${allOk ? '✅ OPERATIONAL' : '❌ NEEDS FUNDING'}`);

        if (!allOk) {
            console.log('\n⚠️  ACCIÓN REQUERIDA: Fondea la Hot Wallet antes de activar pagos');
        } else {
            console.log('\n🎉 Hot Wallet lista para distribución automática!');
        }

        return {
            address: hotWalletAddress,
            matic: maticFormatted,
            bez: bezFormatted,
            operational: allOk
        };

    } catch (error) {
        console.error('\n❌ Error verificando Hot Wallet:', error.message);
        throw error;
    }
}

// Execute if run directly
if (require.main === module) {
    checkHotWalletStatus()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { checkHotWalletStatus };
