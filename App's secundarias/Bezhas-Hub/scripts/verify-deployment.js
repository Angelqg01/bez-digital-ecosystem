const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
    console.log("\n🔍 Quality Oracle Post-Deployment Verification\n");

    // Leer addresses del .env
    require('dotenv').config();
    const escrowAddress = process.env.QUALITY_ESCROW_ADDRESS;
    const bezCoinAddress = process.env.BEZCOIN_ADDRESS;

    if (!escrowAddress || !bezCoinAddress) {
        console.error("❌ Contract addresses not found in .env");
        console.log("   Please run deployment first: npm run deploy:quality-oracle");
        process.exit(1);
    }

    console.log("📋 Contract Addresses:");
    console.log("├─ BezCoin:", bezCoinAddress);
    console.log("└─ QualityEscrow:", escrowAddress);

    // Conectar a los contratos
    const BezCoin = await hre.ethers.getContractFactory("BezhasToken");
    const bezCoin = BezCoin.attach(bezCoinAddress);

    const QualityEscrow = await hre.ethers.getContractFactory("BeZhasQualityEscrow");
    const escrow = QualityEscrow.attach(escrowAddress);

    console.log("\n🔍 Verifying BezCoin Token...");
    try {
        const name = await bezCoin.name();
        const symbol = await bezCoin.symbol();
        const decimals = await bezCoin.decimals();
        const totalSupply = await bezCoin.totalSupply();

        console.log("✅ BezCoin verified:");
        console.log("   Name:", name);
        console.log("   Symbol:", symbol);
        console.log("   Decimals:", decimals.toString());
        console.log("   Total Supply:", hre.ethers.formatEther(totalSupply), "BEZ");
    } catch (error) {
        console.error("❌ Failed to verify BezCoin:", error.message);
    }

    console.log("\n🔍 Verifying Quality Escrow...");
    try {
        const bezTokenAddress = await escrow.bezToken();
        const adminAddress = await escrow.admin();
        const serviceCounter = await escrow.serviceCounter();

        console.log("✅ QualityEscrow verified:");
        console.log("   BEZ Token:", bezTokenAddress);
        console.log("   Admin:", adminAddress);
        console.log("   Total Services:", serviceCounter.toString());

        // Verificar roles
        const MINTER_ROLE = await bezCoin.MINTER_ROLE();
        const hasMinterRole = await bezCoin.hasRole(MINTER_ROLE, escrowAddress);

        if (hasMinterRole) {
            console.log("   Roles: ✅ MINTER_ROLE granted");
        } else {
            console.log("   Roles: ⚠️  MINTER_ROLE NOT granted (penalties won't work!)");
        }
    } catch (error) {
        console.error("❌ Failed to verify QualityEscrow:", error.message);
    }

    console.log("\n📦 Checking ABIs...");
    const backendAbiPath = path.join(__dirname, '..', 'backend', 'contracts', 'BeZhasQualityEscrow.json');
    const frontendAbiPath = path.join(__dirname, '..', 'frontend', 'src', 'contracts', 'BeZhasQualityEscrow.json');

    if (fs.existsSync(backendAbiPath)) {
        console.log("✅ Backend ABI found");
    } else {
        console.log("❌ Backend ABI missing - copy from artifacts/");
    }

    if (fs.existsSync(frontendAbiPath)) {
        console.log("✅ Frontend ABI found");
    } else {
        console.log("❌ Frontend ABI missing - copy from artifacts/");
    }

    console.log("\n📊 PolygonScan Links:");
    console.log(`BezCoin: https://amoy.polygonscan.com/address/${bezCoinAddress}`);
    console.log(`QualityEscrow: https://amoy.polygonscan.com/address/${escrowAddress}`);

    console.log("\n" + "=".repeat(60));
    console.log("✅ Post-Deployment Verification Complete!");
    console.log("=".repeat(60) + "\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
