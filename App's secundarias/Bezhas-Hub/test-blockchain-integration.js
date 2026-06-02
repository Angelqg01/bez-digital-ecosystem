const axios = require('axios');
const { ethers } = require('ethers');

// Configuración
const API_BASE = process.env.API_BASE || 'http://localhost:5000/api/blockchain';
const TEST_ADDRESS = '0x3EfC42095E8503d41Ad8001328FC23388E00e8a3'; // Safe Wallet (admin)

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

function logTest(number, description) {
    console.log(`\n${colors.cyan}${number}️⃣  ${description}${colors.reset}`);
}

function logSuccess(message) {
    log(`✅ ${message}`, 'green');
}

function logError(message) {
    log(`❌ ${message}`, 'red');
}

async function testBlockchainIntegration() {
    log('\n🧪 BEZHAS BLOCKCHAIN INTEGRATION TEST\n', 'blue');
    log('═══════════════════════════════════════════════════', 'cyan');

    let passedTests = 0;
    let failedTests = 0;

    try {
        // Test 1: Probar conexión
        logTest('1', 'Testing blockchain connection');
        try {
            const response = await axios.post(`${API_BASE}/test/connection`);
            if (response.data.success) {
                logSuccess(`Connection: ${response.data.data.status}`);
                logSuccess(`Network: ${response.data.data.network} (Chain ID: ${response.data.data.chainId})`);
                logSuccess(`Gas Price: ${response.data.data.gasPrice}`);
                logSuccess(`Relayer Balance: ${response.data.data.relayerBalance}`);
                passedTests++;
            } else {
                logError('Connection test failed');
                failedTests++;
            }
        } catch (error) {
            logError(`Connection error: ${error.message}`);
            failedTests++;
        }

        // Test 2: Obtener lista de contratos
        logTest('2', 'Getting deployed contracts');
        try {
            const response = await axios.get(`${API_BASE}/contracts`);
            if (response.data.success) {
                const contracts = response.data.data.contracts;
                const contractCount = Object.keys(contracts).length;
                logSuccess(`Found ${contractCount} deployed contracts:`);

                Object.entries(contracts).forEach(([name, address]) => {
                    if (address) {
                        log(`   ${name}: ${address}`, 'yellow');
                    } else {
                        log(`   ${name}: ⚠️  Not deployed`, 'red');
                    }
                });
                passedTests++;
            } else {
                logError('Failed to get contracts');
                failedTests++;
            }
        } catch (error) {
            logError(`Get contracts error: ${error.message}`);
            failedTests++;
        }

        // Test 3: Obtener gas price actual
        logTest('3', 'Getting current gas price');
        try {
            const response = await axios.get(`${API_BASE}/gas-price`);
            if (response.data.success) {
                const gasPrice = response.data.data.gasPriceGwei;
                logSuccess(`Current Gas Price: ${gasPrice} Gwei`);

                // Validar que el gas price sea razonable (entre 1 y 1000 Gwei)
                const gasPriceNum = parseFloat(gasPrice);
                if (gasPriceNum > 0 && gasPriceNum < 1000) {
                    logSuccess('Gas price is within normal range');
                } else {
                    log('⚠️  Gas price seems unusual', 'yellow');
                }
                passedTests++;
            } else {
                logError('Failed to get gas price');
                failedTests++;
            }
        } catch (error) {
            logError(`Get gas price error: ${error.message}`);
            failedTests++;
        }

        // Test 4: Verificar balance BEZ de una dirección
        logTest('4', `Getting BEZ balance for ${TEST_ADDRESS}`);
        try {
            const response = await axios.get(`${API_BASE}/balance/${TEST_ADDRESS}`);
            if (response.data.success) {
                const balance = response.data.data.balance;
                logSuccess(`BEZ Balance: ${balance} BEZ`);

                // Convertir a número para validación
                const balanceNum = parseFloat(balance);
                if (balanceNum >= 0) {
                    logSuccess('Balance retrieved successfully');
                }
                passedTests++;
            } else {
                logError('Failed to get balance');
                failedTests++;
            }
        } catch (error) {
            logError(`Get balance error: ${error.message}`);
            failedTests++;
        }

        // Test 5: Verificar si la dirección es admin
        logTest('5', `Checking admin status for ${TEST_ADDRESS}`);
        try {
            const response = await axios.get(`${API_BASE}/admin/check/${TEST_ADDRESS}`);
            if (response.data.success) {
                const isAdmin = response.data.data.isAdmin;
                if (isAdmin) {
                    logSuccess('Address IS an admin ✓');
                } else {
                    log('Address is NOT an admin', 'yellow');
                }
                passedTests++;
            } else {
                logError('Failed to check admin status');
                failedTests++;
            }
        } catch (error) {
            logError(`Check admin error: ${error.message}`);
            failedTests++;
        }

        // Test 6: Verificar si la dirección es vendor
        logTest('6', `Checking vendor status for ${TEST_ADDRESS}`);
        try {
            const response = await axios.get(`${API_BASE}/vendor/check/${TEST_ADDRESS}`);
            if (response.data.success) {
                const isVendor = response.data.data.isVendor;
                if (isVendor) {
                    logSuccess('Address IS a vendor ✓');
                } else {
                    log('Address is NOT a vendor', 'yellow');
                }
                passedTests++;
            } else {
                logError('Failed to check vendor status');
                failedTests++;
            }
        } catch (error) {
            logError(`Check vendor error: ${error.message}`);
            failedTests++;
        }

        // Test 7: Obtener contador de productos del marketplace
        logTest('7', 'Getting marketplace product count');
        try {
            const response = await axios.get(`${API_BASE}/marketplace/products/count`);
            if (response.data.success) {
                const count = response.data.data.totalProducts;
                logSuccess(`Total Products in Marketplace: ${count}`);
                passedTests++;
            } else {
                logError('Failed to get product count');
                failedTests++;
            }
        } catch (error) {
            logError(`Get product count error: ${error.message}`);
            failedTests++;
        }

        // Test 8: Obtener balance del relayer
        logTest('8', 'Getting relayer balance');
        try {
            const response = await axios.get(`${API_BASE}/relayer/balance`);
            if (response.data.success) {
                const balance = response.data.data.balanceMatic;
                logSuccess(`Relayer Balance: ${balance} MATIC`);

                // Validar que el relayer tenga suficiente balance
                const balanceNum = parseFloat(balance);
                if (balanceNum > 1) {
                    logSuccess('Relayer has sufficient balance for operations');
                } else if (balanceNum > 0.1) {
                    log('⚠️  Relayer balance is low, consider refilling', 'yellow');
                } else {
                    log('⚠️  Relayer balance is critically low!', 'red');
                }
                passedTests++;
            } else {
                logError('Failed to get relayer balance');
                failedTests++;
            }
        } catch (error) {
            logError(`Get relayer balance error: ${error.message}`);
            failedTests++;
        }

        // Test 9: Validar formato de dirección
        logTest('9', 'Testing address validation');
        try {
            const invalidAddress = '0xinvalid';
            const response = await axios.get(`${API_BASE}/balance/${invalidAddress}`);
            logError('Should have rejected invalid address');
            failedTests++;
        } catch (error) {
            if (error.response && error.response.status === 400) {
                logSuccess('Invalid address correctly rejected');
                passedTests++;
            } else {
                logError(`Unexpected error: ${error.message}`);
                failedTests++;
            }
        }

        // Resumen
        log('\n═══════════════════════════════════════════════════', 'cyan');
        log('\n📊 TEST SUMMARY\n', 'blue');
        log(`Total Tests: ${passedTests + failedTests}`, 'cyan');
        logSuccess(`Passed: ${passedTests}`);
        if (failedTests > 0) {
            logError(`Failed: ${failedTests}`);
        }

        const successRate = ((passedTests / (passedTests + failedTests)) * 100).toFixed(1);
        log(`\nSuccess Rate: ${successRate}%`, successRate === '100.0' ? 'green' : 'yellow');

        if (passedTests === passedTests + failedTests) {
            log('\n🎉 ALL TESTS PASSED! Integration is working correctly.\n', 'green');
            process.exit(0);
        } else {
            log('\n⚠️  Some tests failed. Check the errors above.\n', 'yellow');
            process.exit(1);
        }

    } catch (error) {
        logError(`\n❌ Critical error during testing: ${error.message}\n`);
        process.exit(1);
    }
}

// Ejecutar tests
if (require.main === module) {
    log('\n🚀 Starting blockchain integration tests...\n', 'cyan');
    log('Target API:', API_BASE, 'yellow');
    log('Test Address:', TEST_ADDRESS, 'yellow');

    testBlockchainIntegration();
}

module.exports = { testBlockchainIntegration };
