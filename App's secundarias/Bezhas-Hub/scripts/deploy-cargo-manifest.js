/**
 * BeZhas Cargo Manifest NFT - Deployment Script
 * Deploy to Polygon Mainnet with BEZ-Coin integration
 */

const hre = require("hardhat");
const { ethers } = require("hardhat");

// BEZ-Coin address on Polygon
const BEZ_COIN_ADDRESS = "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8";

// Registration fee: 0.05 USD in BEZ-Coin (adjust based on BEZ price)
// If 1 BEZ = $0.10, then fee = 0.5 BEZ
// This should be updated based on current market price
const REGISTRATION_FEE_BEZ = ethers.utils.parseUnits("0.5", 18); // 0.5 BEZ

async function main() {
    console.log("🚀 Deploying CargoManifestNFT to Polygon...\n");

    const [deployer] = await ethers.getSigners();
    console.log("📝 Deploying contracts with account:", deployer.address);
    console.log("💰 Account balance:", ethers.utils.formatEther(await deployer.getBalance()), "POL\n");

    // Deploy CargoManifestNFT
    console.log("📦 Deploying CargoManifestNFT contract...");
    const CargoManifestNFT = await ethers.getContractFactory("CargoManifestNFT");
    const cargoManifest = await CargoManifestNFT.deploy(
        BEZ_COIN_ADDRESS,
        REGISTRATION_FEE_BEZ
    );

    await cargoManifest.deployed();
    console.log("✅ CargoManifestNFT deployed to:", cargoManifest.address);
    console.log("🔗 BEZ-Coin address:", BEZ_COIN_ADDRESS);
    console.log("💵 Registration fee:", ethers.utils.formatUnits(REGISTRATION_FEE_BEZ, 18), "BEZ\n");

    // Wait for a few block confirmations
    console.log("⏳ Waiting for block confirmations...");
    await cargoManifest.deployTransaction.wait(5);
    console.log("✅ Confirmed!\n");

    // Verify contract on PolygonScan
    if (hre.network.name !== "localhost" && hre.network.name !== "hardhat") {
        console.log("🔍 Verifying contract on PolygonScan...");
        try {
            await hre.run("verify:verify", {
                address: cargoManifest.address,
                constructorArguments: [BEZ_COIN_ADDRESS, REGISTRATION_FEE_BEZ],
            });
            console.log("✅ Contract verified on PolygonScan!\n");
        } catch (error) {
            console.log("❌ Verification failed:", error.message, "\n");
        }
    }

    // Display deployment summary
    console.log("=".repeat(60));
    console.log("📋 DEPLOYMENT SUMMARY");
    console.log("=".repeat(60));
    console.log("Contract Address:", cargoManifest.address);
    console.log("Network:", hre.network.name);
    console.log("Deployer:", deployer.address);
    console.log("BEZ-Coin:", BEZ_COIN_ADDRESS);
    console.log("Registration Fee:", ethers.utils.formatUnits(REGISTRATION_FEE_BEZ, 18), "BEZ");
    console.log("=".repeat(60));
    console.log("\n📝 Add to your .env file:");
    console.log(`REACT_APP_CARGO_MANIFEST_CONTRACT=${cargoManifest.address}`);
    console.log("\n🎉 Deployment completed successfully!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
