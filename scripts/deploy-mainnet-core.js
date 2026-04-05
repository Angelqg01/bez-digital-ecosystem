/**
 * ============================================================
 * BeZhas Core — Deploy Script — Polygon Mainnet
 * ============================================================
 *
 * Despliega en orden de dependencias:
 *   1. QualityOracle       (bezToken, treasuryDAO)
 *   2. BeZhasQualityEscrow (bezToken, oracle)
 *   3. StakingPool         (owner, bezToken)
 *   4. BezhasNFT           ()
 *   5. BeZhasMarketplace   (bezToken, oracle)
 *   6. BeZhasRWAFactory    () ← tiene BEZ hardcoded
 *   7. PropertyNFT         ()
 *   8. TokenSale           (bezToken, treasury, price)
 *
 * Usage:
 *   npx hardhat run scripts/deploy-mainnet-core.js --network polygon
 *
 * Requisitos en .env:
 *   PRIVATE_KEY=0x...
 *   POLYGON_RPC_URL=https://...
 *   POLYGONSCAN_API_KEY=...
 *   TREASURY_WALLET=0x...   (tu wallet DAO/treasury)
 *   BEZ_PRICE_WEI=...        (precio de 1 BEZ en wei de POL, ej: 1000000000000 = 0.000001 POL)
 */

const { ethers, run } = require('hardhat');
const fs = require('fs');
const path = require('path');

// ── Constantes ────────────────────────────────────────────────────────────────
const BEZ_TOKEN = process.env.BEZCOIN_CONTRACT_ADDRESS
    || '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8'; // Polygon Mainnet ✅
const TREASURY = process.env.TREASURY_DAO_ADDRESS
    || process.env.TREASURY_WALLET
    || '0x52Df82920CBAE522880dD7657e43d1A754eD044E';
// 1 BEZ = 0.0001 POL (ajustar según precio de mercado)
const BEZ_PRICE_WEI = process.env.BEZ_PRICE_WEI || ethers.parseEther('0.0001').toString();

async function verify(address, constructorArguments = []) {
    console.log(`\n🔍 Verifying ${address} on Polygonscan...`);
    try {
        await run('verify:verify', { address, constructorArguments });
        console.log(`✅ Verified: https://polygonscan.com/address/${address}#code`);
    } catch (e) {
        if (e.message.toLowerCase().includes('already verified')) {
            console.log('⚠️  Already verified — skipping');
        } else {
            console.warn(`⚠️  Verification failed: ${e.message}`);
        }
    }
}

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();

    console.log('\n' + '='.repeat(60));
    console.log('  BeZhas Core Deploy — Polygon Mainnet');
    console.log('='.repeat(60));
    console.log(`  Deployer : ${deployer.address}`);
    console.log(`  Network  : ${network.name} (chainId: ${network.chainId})`);
    console.log(`  BEZ-Coin : ${BEZ_TOKEN}`);
    console.log(`  Treasury : ${TREASURY}`);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`  Balance  : ${ethers.formatEther(balance)} POL`);

    if (balance < ethers.parseEther('0.5')) {
        throw new Error('❌ Balance insuficiente. Necesitas al menos 0.5 POL para el deploy.');
    }

    const deployments = { network: 'polygon', chainId: 137, deployer: deployer.address, bezToken: BEZ_TOKEN };

    // ── 1. QualityOracle ──────────────────────────────────────────────────────
    console.log('\n📦 [1/8] Deploying QualityOracle...');
    const QualityOracle = await ethers.getContractFactory('QualityOracle');
    const oracle = await QualityOracle.deploy(BEZ_TOKEN, TREASURY);
    await oracle.waitForDeployment();
    deployments.qualityOracle = await oracle.getAddress();
    console.log(`✅ QualityOracle: ${deployments.qualityOracle}`);
    await delay(3000);
    await verify(deployments.qualityOracle, [BEZ_TOKEN, TREASURY]);

    // ── 2. BeZhasQualityEscrow ────────────────────────────────────────────────
    console.log('\n📦 [2/8] Deploying BeZhasQualityEscrow...');
    try {
        const Escrow = await ethers.getContractFactory('BeZhasQualityEscrow');
        const escrow = await Escrow.deploy(BEZ_TOKEN, deployments.qualityOracle);
        await escrow.waitForDeployment();
        deployments.qualityEscrow = await escrow.getAddress();
        console.log(`✅ BeZhasQualityEscrow: ${deployments.qualityEscrow}`);
        await delay(3000);
        await verify(deployments.qualityEscrow, [BEZ_TOKEN, deployments.qualityOracle]);
    } catch (e) {
        console.warn(`⚠️  BeZhasQualityEscrow not found or failed: ${e.message}. Skipping.`);
    }

    // ── 3. StakingPool ────────────────────────────────────────────────────────
    console.log('\n📦 [3/8] Deploying StakingPool...');
    const StakingPool = await ethers.getContractFactory('StakingPool');
    const staking = await StakingPool.deploy(deployer.address, BEZ_TOKEN);
    await staking.waitForDeployment();
    deployments.stakingPool = await staking.getAddress();
    console.log(`✅ StakingPool: ${deployments.stakingPool}`);
    await delay(3000);
    await verify(deployments.stakingPool, [deployer.address, BEZ_TOKEN]);

    // ── 4. BezhasNFT ──────────────────────────────────────────────────────────
    console.log('\n📦 [4/8] Deploying BezhasNFT...');
    const BezhasNFT = await ethers.getContractFactory('BezhasNFT');
    const nft = await BezhasNFT.deploy();
    await nft.waitForDeployment();
    deployments.bezhasNFT = await nft.getAddress();
    console.log(`✅ BezhasNFT: ${deployments.bezhasNFT}`);
    await delay(3000);
    await verify(deployments.bezhasNFT, []);

    // ── 5. BeZhasMarketplace ──────────────────────────────────────────────────
    console.log('\n📦 [5/8] Deploying BeZhasMarketplace...');
    try {
        const Marketplace = await ethers.getContractFactory('BeZhasMarketplace');
        const marketplace = await Marketplace.deploy(BEZ_TOKEN, deployments.qualityOracle);
        await marketplace.waitForDeployment();
        deployments.marketplace = await marketplace.getAddress();
        console.log(`✅ BeZhasMarketplace: ${deployments.marketplace}`);
        await delay(3000);
        await verify(deployments.marketplace, [BEZ_TOKEN, deployments.qualityOracle]);
    } catch (e) {
        console.warn(`⚠️  BeZhasMarketplace failed: ${e.message}. Skipping.`);
    }

    // ── 6. BeZhasRWAFactory ───────────────────────────────────────────────────
    console.log('\n📦 [6/8] Deploying BeZhasRWAFactory (BEZ hardcoded)...');
    const RWAFactory = await ethers.getContractFactory('BeZhasRWAFactory');
    const rwa = await RWAFactory.deploy();
    await rwa.waitForDeployment();
    deployments.rwaFactory = await rwa.getAddress();
    console.log(`✅ BeZhasRWAFactory: ${deployments.rwaFactory}`);
    await delay(3000);
    await verify(deployments.rwaFactory, []);

    // ── 7. PropertyNFT ────────────────────────────────────────────────────────
    console.log('\n📦 [7/8] Deploying PropertyNFT...');
    try {
        const PropertyNFT = await ethers.getContractFactory('PropertyNFT');
        const propertyNft = await PropertyNFT.deploy();
        await propertyNft.waitForDeployment();
        deployments.propertyNFT = await propertyNft.getAddress();
        console.log(`✅ PropertyNFT: ${deployments.propertyNFT}`);
        await delay(3000);
        await verify(deployments.propertyNFT, []);
    } catch (e) {
        console.warn(`⚠️  PropertyNFT failed: ${e.message}. Skipping.`);
    }

    // ── 8. TokenSale ──────────────────────────────────────────────────────────
    console.log('\n📦 [8/8] Deploying TokenSale...');
    const TokenSale = await ethers.getContractFactory('TokenSale');
    const tokenSale = await TokenSale.deploy(BEZ_TOKEN, TREASURY, BEZ_PRICE_WEI);
    await tokenSale.waitForDeployment();
    deployments.tokenSale = await tokenSale.getAddress();
    console.log(`✅ TokenSale: ${deployments.tokenSale}`);
    await delay(3000);
    await verify(deployments.tokenSale, [BEZ_TOKEN, TREASURY, BEZ_PRICE_WEI]);

    // ── Guardar addresses ─────────────────────────────────────────────────────
    deployments.deployedAt = new Date().toISOString();
    const outPath = path.join(__dirname, '..', 'deployments', 'mainnet-core.json');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(deployments, null, 2));

    // ── Actualizar .env del frontend y backend ────────────────────────────────
    const envLines = [
        `VITE_QUALITY_ORACLE_ADDRESS=${deployments.qualityOracle}`,
        `VITE_STAKING_POOL_ADDRESS=${deployments.stakingPool}`,
        `VITE_NFT_ADDRESS=${deployments.bezhasNFT}`,
        `VITE_RWA_FACTORY_ADDRESS=${deployments.rwaFactory}`,
        `VITE_TOKEN_SALE_ADDRESS=${deployments.tokenSale}`,
        deployments.marketplace ? `VITE_MARKETPLACE_ADDRESS=${deployments.marketplace}` : '',
        deployments.propertyNFT ? `VITE_PROPERTY_NFT_ADDRESS=${deployments.propertyNFT}` : '',
    ].filter(Boolean).join('\n');

    const frontendEnv = path.join(__dirname, '..', 'frontend', '.env');
    const backendEnv = path.join(__dirname, '..', 'backend', '.env');

    // Append to existing .env files without overwriting other vars
    for (const envFile of [frontendEnv, backendEnv]) {
        let existing = '';
        try { existing = fs.readFileSync(envFile, 'utf8'); } catch (_) { }

        const linesToAdd = envLines.split('\n').filter(line => {
            const key = line.split('=')[0];
            return !existing.includes(key + '=');
        });

        if (linesToAdd.length > 0) {
            fs.appendFileSync(envFile, '\n# ── Mainnet Core Deploy ──\n' + linesToAdd.join('\n') + '\n');
            console.log(`\n📝 Updated ${path.basename(envFile)} with ${linesToAdd.length} new addresses`);
        }
    }

    // ── Resumen final ─────────────────────────────────────────────────────────
    console.log('\n' + '='.repeat(60));
    console.log('  ✅ DEPLOY COMPLETADO');
    console.log('='.repeat(60));
    console.log(JSON.stringify(deployments, null, 2));
    console.log(`\n📄 Saved to: ${outPath}`);
    console.log('\n⚠️  PRÓXIMOS PASOS:');
    console.log('  1. Envía BEZ al TokenSale contract para que los usuarios puedan comprar');
    console.log(`     → npx hardhat transfer --to ${deployments.tokenSale} --amount 1000000`);
    console.log('  2. Registra el deployer como VALIDATOR_ROLE en QualityOracle (backend)');
    console.log('  3. Actualiza GCP secrets con las nuevas addresses');
    console.log('     → npm run gcp:deploy');
}

main().catch(err => {
    console.error('❌ Deploy failed:', err);
    process.exit(1);
});
