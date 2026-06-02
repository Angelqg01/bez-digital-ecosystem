#!/usr/bin/env node

/**
 * Mumbai Testnet Deployment & Testing Script
 * 
 * Automatiza todo el proceso de testing en Mumbai:
 * 1. Deploy contracts a Mumbai
 * 2. Configure monitoring
 * 3. Execute test swaps
 * 4. Verify results
 */

require('dotenv').config({ path: './backend/.env' });
const { ethers } = require('hardhat');
const readline = require('readline');

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
}

async function checkBalance() {
    log('\n━━━ Checking Wallet Balance ━━━', 'cyan');

    try {
        const [deployer] = await ethers.getSigners();
        const balance = await ethers.provider.getBalance(deployer.address);

        log(`  Address: ${deployer.address}`, 'blue');
        log(`  Balance: ${ethers.formatEther(balance)} MATIC`, 'blue');

        if (balance < ethers.parseEther('0.5')) {
            log('\n  ⚠️  Low balance! You need MATIC for gas.', 'yellow');
            log('  Get testnet MATIC from:', 'yellow');
            log('  https://faucet.polygon.technology/', 'cyan');

            const proceed = await askQuestion('\n  Continue anyway? (y/n): ');
            if (proceed.toLowerCase() !== 'y') {
                process.exit(0);
            }
        } else {
            log('  ✓ Balance is sufficient', 'green');
        }

        return deployer;
    } catch (error) {
        log(`  ✗ Failed to check balance: ${error.message}`, 'red');
        throw error;
    }
}

async function deployContracts() {
    log('\n━━━ Deploying Contracts to Mumbai ━━━', 'cyan');

    try {
        const [deployer] = await ethers.getSigners();

        // Deploy BezToken (Mock USDC for testing)
        log('\n  📝 Deploying Mock USDC...', 'blue');
        const MockUSDC = await ethers.getContractFactory('BezToken');
        const mockUSDC = await MockUSDC.deploy();
        await mockUSDC.waitForDeployment();
        const usdcAddress = await mockUSDC.getAddress();
        log(`  ✓ Mock USDC: ${usdcAddress}`, 'green');

        // Deploy BezToken
        log('\n  📝 Deploying BEZ Token...', 'blue');
        const BezToken = await ethers.getContractFactory('BezToken');
        const bezToken = await BezToken.deploy();
        await bezToken.waitForDeployment();
        const bezAddress = await bezToken.getAddress();
        log(`  ✓ BEZ Token: ${bezAddress}`, 'green');

        // Deploy BezLiquidityRamp
        log('\n  📝 Deploying BezLiquidityRamp...', 'blue');
        const BezLiquidityRamp = await ethers.getContractFactory('BezLiquidityRamp');
        const ramp = await BezLiquidityRamp.deploy(
            bezAddress,
            deployer.address // treasury
        );
        await ramp.waitForDeployment();
        const rampAddress = await ramp.getAddress();
        log(`  ✓ BezLiquidityRamp: ${rampAddress}`, 'green');

        // Mint test tokens
        log('\n  📝 Minting test tokens...', 'blue');

        // Mint USDC to deployer
        const usdcAmount = ethers.parseUnits('10000', 6); // 10,000 USDC
        await mockUSDC.mint(deployer.address, usdcAmount);
        log(`  ✓ Minted 10,000 USDC to ${deployer.address}`, 'green');

        // Mint BEZ to contract for swaps
        const bezAmount = ethers.parseEther('1000000'); // 1M BEZ
        await bezToken.mint(rampAddress, bezAmount);
        log(`  ✓ Minted 1,000,000 BEZ to contract`, 'green');

        // Grant roles
        log('\n  📝 Granting roles...', 'blue');
        const SIGNER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('SIGNER_ROLE'));
        await ramp.grantRole(SIGNER_ROLE, deployer.address);
        log('  ✓ SIGNER_ROLE granted', 'green');

        return {
            mockUSDC,
            bezToken,
            ramp,
            addresses: {
                mockUSDC: usdcAddress,
                bezToken: bezAddress,
                ramp: rampAddress,
                deployer: deployer.address
            }
        };
    } catch (error) {
        log(`  ✗ Deployment failed: ${error.message}`, 'red');
        throw error;
    }
}

async function verifyContracts(addresses) {
    log('\n━━━ Verifying Contracts on Mumbai Polygonscan ━━━', 'cyan');

    const verify = await askQuestion('  Verify contracts? (y/n): ');

    if (verify.toLowerCase() !== 'y') {
        log('  ⊘ Skipping verification', 'yellow');
        return;
    }

    try {
        const { run } = require('hardhat');

        log('\n  📝 Verifying BezToken...', 'blue');
        await run('verify:verify', {
            address: addresses.bezToken,
            constructorArguments: []
        });

        log('\n  📝 Verifying BezLiquidityRamp...', 'blue');
        await run('verify:verify', {
            address: addresses.ramp,
            constructorArguments: [addresses.bezToken, addresses.deployer]
        });

        log('  ✓ Contracts verified', 'green');
    } catch (error) {
        log(`  ⚠️  Verification failed: ${error.message}`, 'yellow');
    }
}

async function executeTestSwaps(contracts) {
    log('\n━━━ Executing Test Swaps ━━━', 'cyan');

    const numSwaps = parseInt(await askQuestion('  How many test swaps? (1-10): ')) || 3;

    try {
        const [deployer] = await ethers.getSigners();
        const { mockUSDC, ramp } = contracts;

        // Approve USDC
        log('\n  📝 Approving USDC...', 'blue');
        const usdcAmount = ethers.parseUnits('1000', 6); // 1000 USDC total
        await mockUSDC.approve(await ramp.getAddress(), usdcAmount);
        log('  ✓ USDC approved', 'green');

        for (let i = 1; i <= numSwaps; i++) {
            log(`\n  📝 Executing swap ${i}/${numSwaps}...`, 'blue');

            const swapAmount = ethers.parseUnits((50 + i * 10).toString(), 6);
            const serviceId = ['LIQUIDITY_RAMP', 'NFT_PURCHASE', 'PREMIUM_SUBSCRIPTION'][i % 3];

            // Create signature (simplified for testing)
            const domain = {
                name: 'BezLiquidityRamp',
                version: '1',
                chainId: 80001, // Mumbai
                verifyingContract: await ramp.getAddress()
            };

            const types = {
                AutoSwap: [
                    { name: 'user', type: 'address' },
                    { name: 'usdcAmount', type: 'uint256' },
                    { name: 'serviceId', type: 'string' },
                    { name: 'deadline', type: 'uint256' }
                ]
            };

            const deadline = Math.floor(Date.now() / 1000) + 3600;

            const value = {
                user: deployer.address,
                usdcAmount: swapAmount,
                serviceId: serviceId,
                deadline: deadline
            };

            const signature = await deployer.signTypedData(domain, types, value);

            // Execute swap
            const tx = await ramp.autoSwap(signature, swapAmount, serviceId, deadline);
            const receipt = await tx.wait();

            log(`  ✓ Swap ${i} completed`, 'green');
            log(`    Amount: $${ethers.formatUnits(swapAmount, 6)} USDC`, 'blue');
            log(`    Service: ${serviceId}`, 'blue');
            log(`    Tx: ${receipt.hash}`, 'cyan');

            // Wait a bit between swaps
            if (i < numSwaps) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        log('\n  ✓ All test swaps completed!', 'green');

    } catch (error) {
        log(`  ✗ Test swap failed: ${error.message}`, 'red');
        throw error;
    }
}

async function verifyResults(contracts) {
    log('\n━━━ Verifying Results ━━━', 'cyan');

    try {
        const { ramp } = contracts;

        // Get contract stats
        log('\n  📊 Fetching contract stats...', 'blue');
        const stats = await ramp.getStats();

        log('\n  ✓ Contract Stats:', 'green');
        log(`    Total Volume: $${ethers.formatUnits(stats[0], 6)} USDC`, 'blue');
        log(`    Total Fees: $${ethers.formatUnits(stats[1], 6)} USDC`, 'blue');
        log(`    Total Swaps: ${stats[2].toString()}`, 'blue');

        // Check treasury balance
        const treasury = await ramp.treasury();
        const [deployer] = await ethers.getSigners();
        const treasuryBalance = await ethers.provider.getBalance(treasury);

        log(`\n  💰 Treasury:`, 'green');
        log(`    Address: ${treasury}`, 'blue');
        log(`    Balance: ${ethers.formatEther(treasuryBalance)} MATIC`, 'blue');

    } catch (error) {
        log(`  ✗ Verification failed: ${error.message}`, 'red');
        throw error;
    }
}

async function saveConfiguration(addresses) {
    log('\n━━━ Saving Configuration ━━━', 'cyan');

    try {
        const fs = require('fs');

        // Save to file
        const config = {
            network: 'mumbai',
            chainId: 80001,
            ...addresses,
            timestamp: new Date().toISOString(),
            explorer: 'https://mumbai.polygonscan.com'
        };

        fs.writeFileSync(
            './mumbai-deployment.json',
            JSON.stringify(config, null, 2)
        );

        log('  ✓ Configuration saved to mumbai-deployment.json', 'green');

        // Update .env
        log('\n  📝 Updating .env file...', 'blue');

        let envContent = '';
        if (fs.existsSync('./backend/.env')) {
            envContent = fs.readFileSync('./backend/.env', 'utf8');
        }

        // Add Mumbai config
        if (!envContent.includes('MUMBAI_CONTRACT_ADDRESS')) {
            envContent += `\n# Mumbai Testnet\nMUMBAI_CONTRACT_ADDRESS=${addresses.ramp}\nMUMBAI_USDC_ADDRESS=${addresses.mockUSDC}\nMUMBAI_BEZ_ADDRESS=${addresses.bezToken}\n`;
            fs.writeFileSync('./backend/.env', envContent);
            log('  ✓ .env updated with Mumbai addresses', 'green');
        }

    } catch (error) {
        log(`  ⚠️  Failed to save configuration: ${error.message}`, 'yellow');
    }
}

async function displaySummary(addresses) {
    log('\n═══════════════════════════════════════════════════════════', 'cyan');
    log('  Mumbai Testnet Deployment Summary', 'cyan');
    log('═══════════════════════════════════════════════════════════', 'cyan');

    log('\n📝 Deployed Contracts:', 'magenta');
    log(`  Mock USDC: ${addresses.mockUSDC}`, 'blue');
    log(`  BEZ Token: ${addresses.bezToken}`, 'blue');
    log(`  Liquidity Ramp: ${addresses.ramp}`, 'blue');

    log('\n🔗 Mumbai Polygonscan:', 'magenta');
    log(`  USDC: https://mumbai.polygonscan.com/address/${addresses.mockUSDC}`, 'cyan');
    log(`  BEZ: https://mumbai.polygonscan.com/address/${addresses.bezToken}`, 'cyan');
    log(`  Ramp: https://mumbai.polygonscan.com/address/${addresses.ramp}`, 'cyan');

    log('\n🎯 Next Steps:', 'magenta');
    log('  1. Start monitoring:', 'blue');
    log('     POLYGON_RPC_URL=$MUMBAI_RPC_URL node backend/scripts/monitorRevenue.js', 'cyan');
    log('  2. Test frontend:', 'blue');
    log('     Update contract address in frontend and test swaps', 'cyan');
    log('  3. Verify events:', 'blue');
    log('     Check that monitoring detects swaps and sends notifications', 'cyan');

    log('\n💡 Testing Tips:', 'magenta');
    log('  - Get Mumbai MATIC: https://faucet.polygon.technology/', 'blue');
    log('  - View transactions: https://mumbai.polygonscan.com/', 'blue');
    log('  - Use different wallets to test user scenarios', 'blue');
    log('  - Monitor gas usage for optimization', 'blue');

    log('\n═══════════════════════════════════════════════════════════\n', 'cyan');
    log('🎉 Mumbai testnet deployment completed!', 'green');
    log('   Your contracts are ready for testing.\n', 'green');
}

async function main() {
    console.clear();
    log('═══════════════════════════════════════════════════════════', 'cyan');
    log('  BeZhas Revenue Stream - Mumbai Testnet Setup', 'cyan');
    log('═══════════════════════════════════════════════════════════', 'cyan');

    try {
        // Check balance
        await checkBalance();

        // Deploy contracts
        const contracts = await deployContracts();
        const { addresses } = contracts;

        // Verify contracts
        await verifyContracts(addresses);

        // Execute test swaps
        const testSwaps = await askQuestion('\n  Execute test swaps? (y/n): ');
        if (testSwaps.toLowerCase() === 'y') {
            await executeTestSwaps(contracts);
            await verifyResults(contracts);
        }

        // Save configuration
        await saveConfiguration(addresses);

        // Display summary
        await displaySummary(addresses);

    } catch (error) {
        log(`\n✗ Mumbai setup failed: ${error.message}`, 'red');
        console.error(error);
        process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exit(1);
    });
}

module.exports = { main };
