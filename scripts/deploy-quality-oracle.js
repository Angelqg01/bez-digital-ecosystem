// ⚠️ ADVERTENCIA: Este script despliega Quality Oracle en Polygon Mainnet
// El CONTRATO BEZ-COIN OFICIAL ya existe:
// 0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8 (Polygon Mainnet)
//
// Este script despliega:
//   1. QualityOracle.sol  → Sistema multi-sector de validación on-chain
//   2. BeZhasQualityEscrow → Escrow de colateral para validaciones
//
// Uso:
//   npx hardhat run scripts/deploy-quality-oracle.js --network polygon
//   npx hardhat run scripts/deploy-quality-oracle.js --network amoy   (testnet)
//
// Ver: CONTRATO_OFICIAL_BEZ.md

require('dotenv').config({ path: './.env' });
require('dotenv').config({ path: './backend/.env' });

const hre = require('hardhat');
const { ethers, run, network } = hre;
const fs = require('fs');
const path = require('path');

// ─── OFFICIAL ADDRESSES ───────────────────────────────────────────────────────
const OFFICIAL_BEZ_CONTRACT = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';
const TREASURY_DAO = '0x89c23890c742d710265dD61be789C71dC8999b12';

const COLORS = {
    reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m',
    yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m', magenta: '\x1b[35m'
};
const log = (msg, color = 'reset') => console.log(`${COLORS[color]}${msg}${COLORS.reset}`);

function updateEnvFile(envPath, key, value) {
    if (!fs.existsSync(envPath)) return;
    let content = fs.readFileSync(envPath, 'utf8');
    const regex = new RegExp(`^${key}=.*$`, 'm');
    content = regex.test(content)
        ? content.replace(regex, `${key}=${value}`)
        : content + `\n${key}=${value}\n`;
    fs.writeFileSync(envPath, content);
    log(`  ✓ ${path.basename(envPath)}: ${key}=${value}`, 'green');
}

async function main() {
    console.log('\n' + '═'.repeat(65));
    log('  BeZhas QualityOracle — Hardhat Deployment Script', 'cyan');
    log(`  Network: ${network.name} (chainId: ${network.config.chainId})`, 'cyan');
    console.log('═'.repeat(65));

    // ─── 1. Signer & balance check ───────────────────────────────────────────
    const [deployer] = await ethers.getSigners();
    const balance = await ethers.provider.getBalance(deployer.address);
    const balanceMatic = parseFloat(ethers.formatEther(balance));

    log(`\n  Deployer: ${deployer.address}`, 'blue');
    log(`  Balance:  ${balanceMatic.toFixed(4)} MATIC`, 'blue');

    if (balanceMatic < 0.5 && network.name === 'polygon') {
        log('\n  ✗ Balance < 0.5 MATIC! Aborting mainnet deploy.', 'red');
        log('    Deposit MATIC at https://wallet.polygon.technology/', 'yellow');
        process.exit(1);
    }

    const bezCoinAddress = OFFICIAL_BEZ_CONTRACT;
    log(`\n  BEZ Token (oficial): ${bezCoinAddress}`, 'blue');
    log(`  Treasury DAO:        ${TREASURY_DAO}`, 'blue');

    // Verify BEZ contract is reachable
    log('\n  Verifying BEZ-Coin contract...', 'blue');
    try {
        const iface = new ethers.Interface(['function symbol() view returns (string)']);
        const bez = new ethers.Contract(bezCoinAddress, iface, deployer);
        const symbol = await bez.symbol();
        log(`  ✓ BEZ-Coin reachable: ${symbol}`, 'green');
    } catch (err) {
        log(`  ⚠️  Could not read BEZ symbol (may be non-standard ERC-20): ${err.message}`, 'yellow');
    }

    // ─── 2. Deploy QualityOracle ─────────────────────────────────────────────
    log('\n━━━ Step 1: Deploying QualityOracle.sol ━━━', 'cyan');
    let oracleAddress;
    try {
        const QualityOracle = await ethers.getContractFactory('QualityOracle');
        log('  Sending deployment transaction...', 'blue');
        const oracle = await QualityOracle.deploy(bezCoinAddress, TREASURY_DAO);
        await oracle.waitForDeployment();
        oracleAddress = await oracle.getAddress();
        log(`  ✓ QualityOracle deployed: ${oracleAddress}`, 'green');
        log(`  Explorer: https://${network.name === 'polygon' ? '' : 'amoy.'}polygonscan.com/address/${oracleAddress}`, 'blue');
    } catch (err) {
        log(`  ✗ QualityOracle deploy failed: ${err.message}`, 'red');
        throw err;
    }

    // ─── 3. Deploy BeZhasQualityEscrow ───────────────────────────────────────
    log('\n━━━ Step 2: Deploying BeZhasQualityEscrow.sol ━━━', 'cyan');
    let escrowAddress;
    try {
        const QualityEscrow = await ethers.getContractFactory('BeZhasQualityEscrow');
        log('  Sending deployment transaction...', 'blue');
        const escrow = await QualityEscrow.deploy(bezCoinAddress, deployer.address);
        await escrow.waitForDeployment();
        escrowAddress = await escrow.getAddress();
        log(`  ✓ QualityEscrow deployed: ${escrowAddress}`, 'green');
        log(`  Explorer: https://${network.name === 'polygon' ? '' : 'amoy.'}polygonscan.com/address/${escrowAddress}`, 'blue');
    } catch (err) {
        log(`  ✗ QualityEscrow deploy failed: ${err.message}`, 'red');
        log('  Continuing without escrow...', 'yellow');
    }

    // ─── 4. Save deployment info ─────────────────────────────────────────────
    log('\n━━━ Step 3: Saving Deployment Info ━━━', 'cyan');
    const deploymentsDir = './deployments';
    if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });

    const deployInfo = {
        network: network.name,
        chainId: network.config.chainId,
        timestamp: new Date().toISOString(),
        deployer: deployer.address,
        contracts: {
            bezCoin: bezCoinAddress,
            qualityOracle: oracleAddress,
            qualityEscrow: escrowAddress || 'DEPLOY_FAILED',
            treasuryDAO: TREASURY_DAO,
        },
        explorerUrls: {
            qualityOracle: `https://${network.name === 'polygon' ? '' : 'amoy.'}polygonscan.com/address/${oracleAddress}`,
            qualityEscrow: escrowAddress ? `https://${network.name === 'polygon' ? '' : 'amoy.'}polygonscan.com/address/${escrowAddress}` : null,
        }
    };

    const deployFile = `${deploymentsDir}/quality-oracle-${network.name}.json`;
    fs.writeFileSync(deployFile, JSON.stringify(deployInfo, null, 2));
    log(`  ✓ Saved to: ${deployFile}`, 'green');

    // ─── 5. Auto-update .env files ───────────────────────────────────────────
    log('\n━━━ Step 4: Updating .env Files ━━━', 'cyan');
    const frontendEnv = path.resolve(__dirname, '../frontend/.env');
    const backendEnv = path.resolve(__dirname, '../backend/.env');

    if (oracleAddress) {
        updateEnvFile(frontendEnv, 'VITE_QUALITY_ORACLE_ADDRESS', oracleAddress);
        updateEnvFile(backendEnv, 'QUALITY_ORACLE_ADDRESS', oracleAddress);
    }
    if (escrowAddress) {
        updateEnvFile(frontendEnv, 'VITE_QUALITY_ESCROW_ADDRESS', escrowAddress);
        updateEnvFile(backendEnv, 'QUALITY_ESCROW_ADDRESS', escrowAddress);
    }

    // ─── 6. Verify on Polygonscan (mainnet only) ─────────────────────────────
    if (network.name === 'polygon' || network.name === 'amoy') {
        log('\n━━━ Step 5: Verifying Contracts on Polygonscan ━━━', 'cyan');
        log('  Waiting 35s for block indexing...', 'blue');
        await new Promise(r => setTimeout(r, 35_000));

        for (const [label, address, args] of [
            ['QualityOracle', oracleAddress, [bezCoinAddress, TREASURY_DAO]],
            ...(escrowAddress ? [['QualityEscrow', escrowAddress, [bezCoinAddress, deployer.address]]] : []),
        ]) {
            try {
                await run('verify:verify', { address, constructorArguments: args });
                log(`  ✓ ${label} verified`, 'green');
            } catch (err) {
                if (err.message.includes('Already Verified')) {
                    log(`  ✓ ${label} already verified`, 'green');
                } else {
                    log(`  ⚠️  ${label} verification failed: ${err.message}`, 'yellow');
                    log(`     Manual: npx hardhat verify --network ${network.name} ${address} ${args.join(' ')}`, 'yellow');
                }
            }
        }
    }

    // ─── 7. Summary ──────────────────────────────────────────────────────────
    console.log('\n' + '═'.repeat(65));
    log('  ✅ Deployment Complete!', 'green');
    console.log('═'.repeat(65));
    log(`\n  QualityOracle:  ${oracleAddress}`, 'magenta');
    if (escrowAddress) log(`  QualityEscrow:  ${escrowAddress}`, 'magenta');
    log(`  Network:        ${network.name}`, 'magenta');
    log('\n  Next steps:', 'cyan');
    log('  1. Add QUALITY_ORACLE_ADDRESS to GCP Secret Manager:', 'blue');
    log(`     gcloud secrets create QUALITY_ORACLE_ADDRESS --data-stdin`, 'yellow');
    log('  2. Update cloudbuild.yaml --set-secrets to include QUALITY_ORACLE_ADDRESS', 'blue');
    log('  3. Redeploy: gcloud builds submit --config=cloudbuild.yaml', 'blue');
    log('  4. Run E2E: node scripts/test-orchestrator-e2e.js\n', 'blue');
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(`\x1b[31m✗ Deployment failed:\x1b[0m`, err.message);
        console.error(err);
        process.exit(1);
    });
