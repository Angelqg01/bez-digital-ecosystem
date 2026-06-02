const hre = require("hardhat");
const { ethers } = require("hardhat");

/**
 * Deploy BeZhas RWA Factory and Vault System
 * Network: Polygon Mainnet
 * BEZ-Coin: 0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
 */
async function main() {
    console.log("🚀 Deploying BeZhas RWA System to Polygon...\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", ethers.formatEther(balance), "MATIC\n");

    // BEZ-Coin address (fixed)
    const BEZ_COIN_ADDRESS = "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8";

    // 1. Deploy RWA Factory
    console.log("📦 Deploying BeZhasRWAFactory...");
    const RWAFactory = await ethers.getContractFactory("BeZhasRWAFactory");
    const rwaFactory = await RWAFactory.deploy();
    await rwaFactory.waitForDeployment();
    const factoryAddress = await rwaFactory.getAddress();
    console.log("✅ BeZhasRWAFactory deployed to:", factoryAddress);

    // 2. Deploy Vault
    console.log("\n📦 Deploying BeZhasVault...");
    const Vault = await ethers.getContractFactory("BeZhasVault");
    const vault = await Vault.deploy(BEZ_COIN_ADDRESS, factoryAddress);
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    console.log("✅ BeZhasVault deployed to:", vaultAddress);

    // 3. Configuration
    console.log("\n⚙️  Configuring contracts...");

    // Get current tokenization fee
    const currentFee = await rwaFactory.tokenizationFee();
    console.log("Tokenization Fee:", ethers.formatEther(currentFee), "BEZ");

    // Wait for confirmations
    console.log("\n⏳ Waiting for block confirmations...");
    const factoryReceipt = await rwaFactory.deploymentTransaction().wait(5);
    const vaultReceipt = await vault.deploymentTransaction().wait(5);

    // 4. Verify contracts on PolygonScan
    console.log("\n🔍 Verifying contracts on PolygonScan...");

    try {
        await hre.run("verify:verify", {
            address: factoryAddress,
            constructorArguments: [],
        });
        console.log("✅ RWAFactory verified");
    } catch (error) {
        console.log("⚠️  RWAFactory verification failed:", error.message);
    }

    try {
        await hre.run("verify:verify", {
            address: vaultAddress,
            constructorArguments: [BEZ_COIN_ADDRESS, factoryAddress],
        });
        console.log("✅ Vault verified");
    } catch (error) {
        console.log("⚠️  Vault verification failed:", error.message);
    }

    // 5. Summary
    console.log("\n" + "=".repeat(60));
    console.log("📋 DEPLOYMENT SUMMARY");
    console.log("=".repeat(60));
    console.log("Network:", hre.network.name);
    console.log("Deployer:", deployer.address);
    console.log("\nContract Addresses:");
    console.log("├─ BeZhasRWAFactory:", factoryAddress);
    console.log("├─ BeZhasVault:", vaultAddress);
    console.log("└─ BEZ-Coin:", BEZ_COIN_ADDRESS);
    console.log("\nTokenization Fee:", ethers.formatEther(currentFee), "BEZ");
    console.log("\n✅ Deployment Complete!");
    console.log("=".repeat(60));

    // 6. Environment Variables for Frontend
    console.log("\n📝 Add these to your .env file:");
    console.log("─".repeat(60));
    console.log(`VITE_RWA_FACTORY_ADDRESS=${factoryAddress}`);
    console.log(`VITE_RWA_VAULT_ADDRESS=${vaultAddress}`);
    console.log(`VITE_BEZ_COIN_ADDRESS=${BEZ_COIN_ADDRESS}`);
    console.log("─".repeat(60));

    // 7. Next Steps
    console.log("\n📌 Next Steps:");
    console.log("1. Update frontend .env with the addresses above");
    console.log("2. Test tokenization with a small asset");
    console.log("3. Activate assets in vault for dividend distribution");
    console.log("4. Configure metadata URI endpoint");
    console.log("\n🎉 Ready to tokenize Real World Assets!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
