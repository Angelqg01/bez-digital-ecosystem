const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
    console.log("🚀 Starting BeZhasQualityEscrow deployment...\n");

    // Get deployment parameters
    const BEZ_TOKEN_ADDRESS = process.env.BEZ_TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000";
    const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS || (await hre.ethers.getSigners())[0].address;

    console.log("📋 Deployment Parameters:");
    console.log("   BEZ Token Address:", BEZ_TOKEN_ADDRESS);
    console.log("   Admin Address:", ADMIN_ADDRESS);
    console.log();

    // Deploy BeZhasQualityEscrow
    console.log("📦 Deploying BeZhasQualityEscrow...");
    const BeZhasQualityEscrow = await hre.ethers.getContractFactory("BeZhasQualityEscrow");
    const escrow = await BeZhasQualityEscrow.deploy(BEZ_TOKEN_ADDRESS, ADMIN_ADDRESS);

    await escrow.waitForDeployment();
    const escrowAddress = await escrow.getAddress();

    console.log("✅ BeZhasQualityEscrow deployed to:", escrowAddress);
    console.log();

    // Save deployment info
    const deploymentInfo = {
        network: hre.network.name,
        chainId: hre.network.config.chainId,
        timestamp: new Date().toISOString(),
        contracts: {
            BeZhasQualityEscrow: {
                address: escrowAddress,
                bezTokenAddress: BEZ_TOKEN_ADDRESS,
                adminAddress: ADMIN_ADDRESS
            }
        }
    };

    // Save to contract-addresses.json (backend)
    const backendConfigPath = path.join(__dirname, '../backend/contract-addresses.json');
    let backendConfig = {};
    if (fs.existsSync(backendConfigPath)) {
        backendConfig = JSON.parse(fs.readFileSync(backendConfigPath, 'utf8'));
    }
    backendConfig.BeZhasQualityEscrow = escrowAddress;
    fs.writeFileSync(backendConfigPath, JSON.stringify(backendConfig, null, 2));
    console.log("✅ Backend config updated:", backendConfigPath);

    // Save to contract-addresses.json (frontend)
    const frontendConfigPath = path.join(__dirname, '../frontend/src/contract-addresses.json');
    let frontendConfig = {};
    if (fs.existsSync(frontendConfigPath)) {
        frontendConfig = JSON.parse(fs.readFileSync(frontendConfigPath, 'utf8'));
    }
    frontendConfig.BeZhasQualityEscrow = escrowAddress;
    fs.writeFileSync(frontendConfigPath, JSON.stringify(frontendConfig, null, 2));
    console.log("✅ Frontend config updated:", frontendConfigPath);

    // Save deployment info
    const deploymentsDir = path.join(__dirname, '../deployments');
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    const deploymentPath = path.join(deploymentsDir, `escrow-${hre.network.name}-${Date.now()}.json`);
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log("✅ Deployment info saved:", deploymentPath);

    console.log("\n🎉 Deployment completed successfully!");
    console.log("\n📝 Next steps:");
    console.log("   1. Update .env with BEZ_TOKEN_ADDRESS if not set");
    console.log("   2. Grant ARBITRATOR_ROLE to trusted addresses");
    console.log("   3. Test the contract with sample transactions");
    console.log(`   4. Verify on explorer: npx hardhat verify --network ${hre.network.name} ${escrowAddress} "${BEZ_TOKEN_ADDRESS}" "${ADMIN_ADDRESS}"`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
