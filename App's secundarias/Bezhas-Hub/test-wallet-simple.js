#!/usr/bin/env node

/**
 * Test simplificado para verificar configuración de Hot Wallet
 */

const { ethers } = require('ethers');
require('dotenv').config({ path: './backend/.env' });

console.log('\n' + '='.repeat(80));
console.log('🧪 TEST SIMPLIFICADO - HOT WALLET & FIAT GATEWAY');
console.log('='.repeat(80) + '\n');

// Test 1: Variables de entorno
console.log('📋 Test 1: Variables de Entorno\n');

const requiredEnvVars = {
    'HOT_WALLET_PRIVATE_KEY': process.env.HOT_WALLET_PRIVATE_KEY,
    'POLYGON_RPC_URL': process.env.POLYGON_RPC_URL,
    'BEZCOIN_CONTRACT_ADDRESS': process.env.BEZCOIN_CONTRACT_ADDRESS
};

let envOk = true;
for (const [key, value] of Object.entries(requiredEnvVars)) {
    if (value) {
        console.log(`  ✅ ${key}: ${value.substring(0, 20)}...`);
    } else {
        console.log(`  ❌ ${key}: MISSING`);
        envOk = false;
    }
}

if (!envOk) {
    console.log('\n❌ Faltan variables de entorno. Verifica backend/.env\n');
    process.exit(1);
}

// Test 2: Conectar a Polygon
console.log('\n📡 Test 2: Conexión a Polygon Amoy\n');

const provider = new ethers.providers.JsonRpcProvider(process.env.POLYGON_RPC_URL);

async function testPolygonConnection() {
    try {
        const network = await provider.getNetwork();
        console.log(`  ✅ Conectado a Polygon ChainID: ${network.chainId}`);

        if (network.chainId === 80002n) {
            console.log(`  ✅ Red correcta: Amoy Testnet`);
        } else {
            console.log(`  ⚠️  Advertencia: No estás en Amoy (${network.chainId})`);
        }

        return true;
    } catch (error) {
        console.log(`  ❌ Error conectando a Polygon: ${error.message}`);
        return false;
    }
}

// Test 3: Validar Hot Wallet
console.log('\n🔑 Test 3: Hot Wallet\n');

async function testHotWallet() {
    try {
        const wallet = new ethers.Wallet(process.env.HOT_WALLET_PRIVATE_KEY, provider);
        console.log(`  ✅ Hot Wallet Address: ${wallet.address}`);

        // Verificar balance de MATIC
        const balance = await provider.getBalance(wallet.address);
        const maticBalance = ethers.utils.formatEther(balance);

        return { wallet, maticBalance: parseFloat(maticBalance) };
    } catch (error) {
        console.log(`  ❌ Error validando wallet: ${error.message}`);
        return null;
    }
}

// Test 4: Validar contrato BEZ
console.log('\n💎 Test 4: Contrato BEZ Token\n');

const BEZ_ABI = [
    "function balanceOf(address account) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function name() view returns (string)",
    "function symbol() view returns (string)"
];

async function testBezContract(wallet) {
    try {
        const bezContract = new ethers.Contract(
            process.env.BEZCOIN_CONTRACT_ADDRESS,
            BEZ_ABI,
            wallet
        );

        const name = await bezContract.name();
        const symbol = await bezContract.symbol();
        const decimals = await bezContract.decimals();

        console.log(`  ✅ Token Name: ${name}`);
        console.log(`  ✅ Token Symbol: ${symbol}`);
        console.log(`  ✅ Decimals: ${decimals}`);

        const balance = await bezContract.balanceOf(wallet.address);
        const bezBalance = ethers.utils.formatUnits(balance, decimals);
        console.log(`  💰 BEZ Balance: ${bezBalance} BEZ`);

        if (parseFloat(bezBalance) >= 1000) {
            console.log(`  ✅ Balance suficiente de BEZ`);
        } else {
            console.log(`  ⚠️  Balance bajo de BEZ (necesita min 1000)`);
        }

        return { bezBalance: parseFloat(bezBalance) };
    } catch (error) {
        console.log(`  ❌ Error validando contrato BEZ: ${error.message}`);
        return null;
    }
}

// Test 5: Simular transferencia (sin ejecutar)
console.log('\n🧪 Test 5: Simulación de Transferencia\n');

async function simulateTransfer(wallet) {
    try {
        const recipientAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'; // Dirección de prueba
        const bezAmount = 100; // 100 BEZ

        const bezContract = new ethers.Contract(
            process.env.BEZCOIN_CONTRACT_ADDRESS,
            BEZ_ABI,
            wallet
        );

        const decimals = await bezContract.decimals();
        const amountWei = ethers.utils.parseUnits(bezAmount.toString(), decimals);

        // Estimar gas (sin ejecutar)
        const gasEstimate = await bezContract.estimateGas.transfer(recipientAddress, amountWei);
        const gasPrice = await provider.getGasPrice();
        const estimatedCost = gasEstimate.mul(gasPrice);

        console.log(`  ✅ Simulación exitosa:`);
        console.log(`     Destinatario: ${recipientAddress}`);
        console.log(`     Cantidad: ${bezAmount} BEZ`);
        console.log(`     Gas estimado: ${gasEstimate.toString()} units`);
        console.log(`     Costo aprox: ${ethers.utils.formatEther(estimatedCost)} MATIC`);
        return true;
    } catch (error) {
        console.log(`  ❌ Error simulando transferencia: ${error.message}`);
        return false;
    }
}

// Ejecutar todos los tests
async function runAllTests() {
    const polygonOk = await testPolygonConnection();
    if (!polygonOk) {
        console.log('\n❌ No se pudo conectar a Polygon\n');
        process.exit(1);
    }

    const walletData = await testHotWallet();
    if (!walletData) {
        console.log('\n❌ Hot Wallet no válida\n');
        process.exit(1);
    }

    const bezData = await testBezContract(walletData.wallet);
    if (!bezData) {
        console.log('\n❌ Contrato BEZ no accesible\n');
        process.exit(1);
    }

    const transferOk = await simulateTransfer(walletData.wallet);

    // Resumen final
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESUMEN FINAL');
    console.log('='.repeat(80) + '\n');

    const allOk = polygonOk && walletData && bezData && transferOk &&
        walletData.maticBalance >= 0.01 && bezData.bezBalance >= 1000;

    if (allOk) {
        console.log('🎉 ¡TODOS LOS TESTS PASARON!');
        console.log('\n✅ Sistema listo para distribución de tokens');
        console.log('✅ Hot Wallet configurada correctamente');
        console.log('✅ Balance suficiente de MATIC y BEZ');
        console.log('\n💡 Próximo paso: Configurar webhook de Stripe y realizar pago de prueba');
    } else {
        console.log('⚠️  ALGUNOS CHECKS FALLARON\n');

        if (walletData.maticBalance < 0.01) {
            console.log('❌ Necesitas más MATIC para gas (min 0.01)');
            console.log('   Fondea en: https://faucet.polygon.technology');
        }

        if (bezData.bezBalance < 1000) {
            console.log('❌ Necesitas más BEZ tokens (min 1000)');
            console.log('   Transfiere desde Safe Wallet o mint más tokens');
        }

        if (!transferOk) {
            console.log('❌ La simulación de transferencia falló');
            console.log('   Verifica permisos del contrato');
        }
    }

    console.log('\n' + '='.repeat(80) + '\n');
}

runAllTests().catch(error => {
    console.error('\n❌ Error fatal:', error.message);
    process.exit(1);
});
