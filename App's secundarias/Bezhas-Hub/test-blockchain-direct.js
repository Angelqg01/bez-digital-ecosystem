// Script de ejemplo para probar la conexión blockchain directamente
// Sin necesidad del backend, solo usando ethers.js

const { ethers } = require('ethers');
require('dotenv').config();

// Colores para consola
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// Contratos
const CONTRACTS = {
    BEZCOIN: process.env.BEZCOIN_ADDRESS || process.env.BEZCOIN_CONTRACT_ADDRESS,
    MARKETPLACE: process.env.BEZHAS_MARKETPLACE_ADDRESS,
    CORE: process.env.BEZHAS_CORE_ADDRESS,
    FARMING: process.env.LIQUIDITY_FARMING_ADDRESS
};

// ABIs mínimos para testing
const ERC20_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function totalSupply() view returns (uint256)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)'
];

const MARKETPLACE_ABI = [
    'function isVendor(address user) view returns (bool)',
    'function productCount() view returns (uint256)'
];

const CORE_ABI = [
    'function hasRole(bytes32 role, address account) view returns (bool)'
];

async function testBlockchainDirect() {
    log('\n🔗 BeZhas Blockchain - Test de Conexión Directa\n', 'cyan');
    log('══════════════════════════════════════════════════════\n', 'cyan');

    try {
        // Conectar al provider con configuración mejorada
        log('📡 Conectando a Polygon Mainnet...', 'yellow');
        const rpcUrl = process.env.POLYGON_MAINNET_RPC || process.env.POLYGON_RPC_URL;
        const provider = new ethers.providers.StaticJsonRpcProvider(
            rpcUrl,
            { name: 'matic', chainId: 137 }
        );

        // Verificar conexión con timeout
        const network = await Promise.race([
            provider.getNetwork(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Network timeout')), 10000))
        ]);

        // Obtener gas price
        const gasPrice = await provider.getGasPrice();
        const gasPriceGwei = ethers.utils.formatUnits(gasPrice, 'gwei');
        log(`✅ Gas Price: ${parseFloat(gasPriceGwei).toFixed(2)} Gwei\n`, 'green');

        // Test BEZ-Coin
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
        log('🪙 BEZ-Coin Contract', 'blue');
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');

        if (CONTRACTS.BEZCOIN) {
            const bezToken = new ethers.Contract(CONTRACTS.BEZCOIN, ERC20_ABI, provider);

            log(`📍 Address: ${CONTRACTS.BEZCOIN}`, 'yellow');

            const symbol = await bezToken.symbol();
            log(`✅ Symbol: ${symbol}`, 'green');

            const decimals = await bezToken.decimals();
            log(`✅ Decimals: ${decimals}`, 'green');

            const totalSupply = await bezToken.totalSupply();
            const formattedSupply = ethers.utils.formatUnits(totalSupply, decimals);
            log(`✅ Total Supply: ${parseFloat(formattedSupply).toLocaleString()} ${symbol}`, 'green');

            // Test balance de Safe Wallet (admin)
            const safeWallet = '0x3EfC42095E8503d41Ad8001328FC23388E00e8a3';
            const balance = await bezToken.balanceOf(safeWallet);
            const formattedBalance = ethers.utils.formatUnits(balance, decimals);
            log(`✅ Safe Wallet Balance: ${parseFloat(formattedBalance).toLocaleString()} ${symbol}\n`, 'green');
        } else {
            log('⚠️  BEZ-Coin address not found in .env\n', 'red');
        }

        // Test Marketplace
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
        log('🛒 Marketplace Contract', 'blue');
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');

        if (CONTRACTS.MARKETPLACE) {
            const marketplace = new ethers.Contract(CONTRACTS.MARKETPLACE, MARKETPLACE_ABI, provider);

            log(`📍 Address: ${CONTRACTS.MARKETPLACE}`, 'yellow');

            const productCount = await marketplace.productCount();
            log(`✅ Total Products: ${productCount.toString()}`, 'green');

            // Test si Safe Wallet es vendor
            const safeWallet = '0x3EfC42095E8503d41Ad8001328FC23388E00e8a3';
            const isVendor = await marketplace.isVendor(safeWallet);
            log(`✅ Safe Wallet is Vendor: ${isVendor ? 'Yes' : 'No'}\n`, 'green');
        } else {
            log('⚠️  Marketplace address not found in .env\n', 'red');
        }

        // Test BeZhasCore (Admin role)
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
        log('⚙️  BeZhasCore Contract', 'blue');
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');

        if (CONTRACTS.CORE) {
            const core = new ethers.Contract(CONTRACTS.CORE, CORE_ABI, provider);

            log(`📍 Address: ${CONTRACTS.CORE}`, 'yellow');

            // DEFAULT_ADMIN_ROLE = 0x00...00
            const ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
            const safeWallet = '0x3EfC42095E8503d41Ad8001328FC23388E00e8a3';

            const isAdmin = await core.hasRole(ADMIN_ROLE, safeWallet);
            log(`✅ Safe Wallet is Admin: ${isAdmin ? 'Yes' : 'No'}\n`, 'green');
        } else {
            log('⚠️  BeZhasCore address not found in .env\n', 'red');
        }

        // Resumen de contratos
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
        log('📋 Contratos Desplegados', 'blue');
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');

        Object.entries(CONTRACTS).forEach(([name, address]) => {
            if (address) {
                log(`✅ ${name.padEnd(20)} ${address}`, 'green');
            } else {
                log(`❌ ${name.padEnd(20)} Not configured`, 'red');
            }
        });

        log('\n══════════════════════════════════════════════════════\n', 'cyan');
        log('🎉 Conexión exitosa con todos los contratos!\n', 'green');
        log('Para más información, ejecuta:', 'yellow');
        log('  • node test-blockchain-integration.js (requiere backend corriendo)', 'white');
        log('  • .\\test-integration.ps1 (test completo con backend)', 'white');
        log('  • Ver BLOCKCHAIN_QUICK_START.md para guía completa\n', 'white');

    } catch (error) {
        log(`\n❌ Error: ${error.message}\n`, 'red');
        console.error(error);
        process.exit(1);
    }
}

// Ejecutar test
if (require.main === module) {
    testBlockchainDirect();
}

module.exports = { testBlockchainDirect };
