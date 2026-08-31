#!/usr/bin/env node

/**
 * Deploy Script for Revenue Stream Native
 * 
 * Automatiza el deployment completo:
 * 1. Deploy smart contract
 * 2. Verify en Polygonscan
 * 3. Grant roles
 * 4. Configure monitoring
 * 5. Test system
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

async function deployContract() {
    log('\n━━━ Step 1: Deploy Smart Contract ━━━', 'cyan');

    try {
        const [deployer] = await ethers.getSigners();
        log(`  Deployer: ${deployer.address}`, 'blue');

        const balance = await ethers.provider.getBalance(deployer.address);
        log(`  Balance: ${ethers.formatEther(balance)} MATIC`, 'blue');

        if (balance < ethers.parseEther('0.1')) {
            log('  ⚠️  Low balance! You might need more MATIC for gas', 'yellow');
        }

        // Deploy BezToken (si no existe)
        log('\n  📝 Deploying BezToken...', 'blue');
        const BezToken = await ethers.getContractFactory('BezToken');
        const bezToken = await BezToken.deploy();
        await bezToken.waitForDeployment();
        const bezTokenAddress = await bezToken.getAddress();
        log(`  ✓ BezToken deployed: ${bezTokenAddress}`, 'green');

        // Deploy BezLiquidityRamp
        log('\n  📝 Deploying BezLiquidityRamp...', 'blue');
        const BezLiquidityRamp = await ethers.getContractFactory('BezLiquidityRamp');
        const ramp = await BezLiquidityRamp.deploy(
            bezTokenAddress,
            deployer.address // treasury inicial
        );
        await ramp.waitForDeployment();
        const rampAddress = await ramp.getAddress();
        log(`  ✓ BezLiquidityRamp deployed: ${rampAddress}`, 'green');

        // Save addresses
        const fs = require('fs');
        const addresses = {
            bezToken: bezTokenAddress,
            bezLiquidityRamp: rampAddress,
            deployer: deployer.address,
            network: (await ethers.provider.getNetwork()).name,
            timestamp: new Date().toISOString()
        };

        fs.writeFileSync(
            './deployment-addresses.json',
            JSON.stringify(addresses, null, 2)
        );
        log('\n  ✓ Addresses saved to deployment-addresses.json', 'green');

        return { bezToken, ramp, addresses };
    } catch (error) {
        log(`  ✗ Deployment failed: ${error.message}`, 'red');
        throw error;
    }
}

async function verifyContracts(addresses) {
    log('\n━━━ Step 2: Verify Contracts ━━━', 'cyan');

    const verify = await askQuestion('  Do you want to verify contracts on Polygonscan? (y/n): ');

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
        log('  ✓ BezToken verified', 'green');

        log('\n  📝 Verifying BezLiquidityRamp...', 'blue');
        await run('verify:verify', {
            address: addresses.bezLiquidityRamp,
            constructorArguments: [addresses.bezToken, addresses.deployer]
        });
        log('  ✓ BezLiquidityRamp verified', 'green');

    } catch (error) {
        log(`  ⚠️  Verification failed: ${error.message}`, 'yellow');
        log('  You can verify manually later using:', 'yellow');
        log(`    npx hardhat verify --network polygon ${addresses.bezLiquidityRamp} ${addresses.bezToken} ${addresses.deployer}`, 'yellow');
    }
}

async function grantRoles(ramp) {
    log('\n━━━ Step 3: Grant Roles ━━━', 'cyan');

    const signerAddress = await askQuestion('  Enter SIGNER address (or press Enter to use deployer): ');
    const finalSigner = signerAddress || (await ethers.provider.getSigner()).address;

    try {
        log(`\n  📝 Granting SIGNER_ROLE to ${finalSigner}...`, 'blue');
        const SIGNER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('SIGNER_ROLE'));
        const tx = await ramp.grantRole(SIGNER_ROLE, finalSigner);
        await tx.wait();
        log('  ✓ SIGNER_ROLE granted', 'green');

        log(`  📝 Verifying role...`, 'blue');
        const hasRole = await ramp.hasRole(SIGNER_ROLE, finalSigner);
        if (hasRole) {
            log('  ✓ Role verified successfully', 'green');
        } else {
            log('  ✗ Role verification failed', 'red');
        }

    } catch (error) {
        log(`  ✗ Failed to grant roles: ${error.message}`, 'red');
        throw error;
    }
}

async function configureMonitoring(addresses) {
    log('\n━━━ Step 4: Configure Monitoring ━━━', 'cyan');

    const fs = require('fs');
    const envPath = './backend/.env';
    let envContent = '';

    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
    }

    // Update contract address
    if (envContent.includes('BEZ_LIQUIDITY_RAMP_ADDRESS=')) {
        envContent = envContent.replace(
            /BEZ_LIQUIDITY_RAMP_ADDRESS=.*/,
            `BEZ_LIQUIDITY_RAMP_ADDRESS=${addresses.bezLiquidityRamp}`
        );
    } else {
        envContent += `\n# Revenue Stream Native\nBEZ_LIQUIDITY_RAMP_ADDRESS=${addresses.bezLiquidityRamp}\n`;
    }

    fs.writeFileSync(envPath, envContent);
    log('  ✓ Updated backend/.env with contract address', 'green');

    // Ask about webhook configuration
    const configWebhooks = await askQuestion('\n  Do you want to configure webhooks now? (y/n): ');

    if (configWebhooks.toLowerCase() === 'y') {
        const discord = await askQuestion('  Discord webhook URL (or press Enter to skip): ');
        const slack = await askQuestion('  Slack webhook URL (or press Enter to skip): ');
        const email = await askQuestion('  Alert email address (or press Enter to skip): ');

        if (discord) {
            envContent = envContent.includes('DISCORD_WEBHOOK_URL=')
                ? envContent.replace(/DISCORD_WEBHOOK_URL=.*/, `DISCORD_WEBHOOK_URL=${discord}`)
                : envContent + `\nDISCORD_WEBHOOK_URL=${discord}\n`;
        }

        if (slack) {
            envContent = envContent.includes('SLACK_WEBHOOK_URL=')
                ? envContent.replace(/SLACK_WEBHOOK_URL=.*/, `SLACK_WEBHOOK_URL=${slack}`)
                : envContent + `\nSLACK_WEBHOOK_URL=${slack}\n`;
        }

        if (email) {
            envContent = envContent.includes('ALERT_EMAIL_TO=')
                ? envContent.replace(/ALERT_EMAIL_TO=.*/, `ALERT_EMAIL_TO=${email}`)
                : envContent + `\nALERT_EMAIL_TO=${email}\n`;
        }

        fs.writeFileSync(envPath, envContent);
        log('  ✓ Webhooks configured', 'green');
    }
}

async function testSystem() {
    log('\n━━━ Step 5: Test System ━━━', 'cyan');

    const runTests = await askQuestion('  Do you want to run test suite? (y/n): ');

    if (runTests.toLowerCase() !== 'y') {
        log('  ⊘ Skipping tests', 'yellow');
        return;
    }

    try {
        log('\n  📝 Running tests...', 'blue');
        const { spawn } = require('child_process');

        const testProcess = spawn('node', ['backend/scripts/testMonitoring.js'], {
            stdio: 'inherit'
        });

        await new Promise((resolve, reject) => {
            testProcess.on('close', code => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Tests failed with code ${code}`));
                }
            });
        });

        log('  ✓ All tests passed', 'green');
    } catch (error) {
        log(`  ⚠️  Tests failed: ${error.message}`, 'yellow');
    }
}

async function displaySummary(addresses) {
    log('\n═══════════════════════════════════════════════════════════', 'cyan');
    log('  Deployment Summary', 'cyan');
    log('═══════════════════════════════════════════════════════════', 'cyan');

    log('\n📝 Deployed Contracts:', 'magenta');
    log(`  BezToken: ${addresses.bezToken}`, 'blue');
    log(`  BezLiquidityRamp: ${addresses.bezLiquidityRamp}`, 'blue');

    log('\n🔗 Polygonscan Links:', 'magenta');
    const network = addresses.network === 'matic' ? 'polygonscan.com' : 'mumbai.polygonscan.com';
    log(`  Token: https://${network}/address/${addresses.bezToken}`, 'blue');
    log(`  Ramp: https://${network}/address/${addresses.bezLiquidityRamp}`, 'blue');

    log('\n🚀 Next Steps:', 'magenta');
    log('  1. Start monitoring:', 'blue');
    log('     pm2 start ecosystem.config.js --only revenue-monitor', 'cyan');
    log('  2. Or run directly:', 'blue');
    log('     node backend/scripts/monitorRevenue.js', 'cyan');
    log('  3. View dashboard:', 'blue');
    log('     Import RevenueAnalytics component in your admin panel', 'cyan');
    log('  4. Check documentation:', 'blue');
    log('     MONITORING_GUIDE.md', 'cyan');

    log('\n═══════════════════════════════════════════════════════════\n', 'cyan');
    log('🎉 Deployment completed successfully!', 'green');
    log('   Revenue Stream Native is ready to use.\n', 'green');
}

async function main() {
    console.clear();
    log('═══════════════════════════════════════════════════════════', 'cyan');
    log('  BeZhas Revenue Stream Native - Deployment Script', 'cyan');
    log('═══════════════════════════════════════════════════════════', 'cyan');

    try {
        // Check if deployment already exists
        const fs = require('fs');
        if (fs.existsSync('./deployment-addresses.json')) {
            const useExisting = await askQuestion('\n  Found existing deployment. Use it? (y/n): ');

            if (useExisting.toLowerCase() === 'y') {
                const addresses = JSON.parse(fs.readFileSync('./deployment-addresses.json', 'utf8'));
                log('\n  Using existing deployment:', 'yellow');
                log(`  BezLiquidityRamp: ${addresses.bezLiquidityRamp}`, 'blue');

                await configureMonitoring(addresses);
                await testSystem();
                await displaySummary(addresses);
                return;
            }
        }

        // Full deployment
        const { bezToken, ramp, addresses } = await deployContract();
        await verifyContracts(addresses);
        await grantRoles(ramp);
        await configureMonitoring(addresses);
        await testSystem();
        await displaySummary(addresses);

    } catch (error) {
        log(`\n✗ Deployment failed: ${error.message}`, 'red');
        console.error(error);
        process.exit(1);
    }
}

// Run deployment
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exit(1);
    });
}

module.exports = { main };
