// SPDX-License-Identifier: MIT
const hre = require("hardhat");
const { ethers } = require("hardhat");

/**
 * Deployment script for BezLiquidityRamp contract
 * 
 * This script deploys the Revenue Stream Native system with:
 * - 0.5% platform fee (50 basis points)
 * - Signature-based authorization (AI Risk Engine)
 * - Treasury wallet for sustainable development funding
 * - Integration with Uniswap-compatible DEX (QuickSwap on Polygon)
 * 
 * Revenue Model: $1M monthly volume × 0.5% = $5,000/month → $60,000/year
 */

async function main() {
    console.log("\n🚀 Starting BezLiquidityRamp deployment...\n");

    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MATIC\n");

    // ========================================
    // CONFIGURATION - UPDATE THESE VALUES
    // ========================================

    // Polygon Mainnet Addresses
    const QUICKSWAP_ROUTER = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff"; // QuickSwap V2 Router
    const BEZ_TOKEN = "0xYourBezTokenAddress"; // TODO: Replace with actual BEZ token address
    const USDC_TOKEN = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // USDC on Polygon
    const ADMIN_ADDRESS = deployer.address; // Initial admin (can be changed later)
    const TREASURY_ADDRESS = "0xYourTreasuryWalletAddress"; // TODO: Replace with treasury wallet

    // Polygon Mumbai Testnet Addresses (for testing)
    // const QUICKSWAP_ROUTER = "0x8954AfA98594b838bda56FE4C12a09D7739D179b"; // QuickSwap Router Mumbai
    // const BEZ_TOKEN = "0xYourTestnetBezTokenAddress";
    // const USDC_TOKEN = "0x0FA8781a83E46826621b3BC094Ea2A0212e71B23"; // Mock USDC Mumbai
    // const ADMIN_ADDRESS = deployer.address;
    // const TREASURY_ADDRESS = "0xYourTestnetTreasuryAddress";

    console.log("📋 Configuration:");
    console.log("  - DEX Router:", QUICKSWAP_ROUTER);
    console.log("  - BEZ Token:", BEZ_TOKEN);
    console.log("  - Stablecoin (USDC):", USDC_TOKEN);
    console.log("  - Admin:", ADMIN_ADDRESS);
    console.log("  - Treasury:", TREASURY_ADDRESS);
    console.log("");

    // Validation
    if (BEZ_TOKEN === "0xYourBezTokenAddress" || TREASURY_ADDRESS === "0xYourTreasuryWalletAddress") {
        throw new Error("❌ Please update BEZ_TOKEN and TREASURY_ADDRESS in deployment script!");
    }

    // ========================================
    // DEPLOY CONTRACT
    // ========================================

    console.log("⏳ Deploying BezLiquidityRamp contract...");

    const BezLiquidityRamp = await ethers.getContractFactory("BezLiquidityRamp");
    const liquidityRamp = await BezLiquidityRamp.deploy(
        QUICKSWAP_ROUTER,
        BEZ_TOKEN,
        USDC_TOKEN,
        ADMIN_ADDRESS,
        TREASURY_ADDRESS
    );

    await liquidityRamp.waitForDeployment();
    const contractAddress = await liquidityRamp.getAddress();

    console.log("✅ BezLiquidityRamp deployed to:", contractAddress);
    console.log("");

    // ========================================
    // SETUP ROLES
    // ========================================

    console.log("⚙️  Setting up roles...");

    // Grant SIGNER_ROLE to backend AI wallet
    const AI_SIGNER_ADDRESS = process.env.AI_SIGNER_ADDRESS || "0xYourBackendWalletAddress";

    if (AI_SIGNER_ADDRESS === "0xYourBackendWalletAddress") {
        console.log("⚠️  Warning: AI_SIGNER_ADDRESS not set in environment!");
        console.log("   You'll need to grant SIGNER_ROLE manually after deployment.");
    } else {
        const SIGNER_ROLE = await liquidityRamp.SIGNER_ROLE();
        const tx = await liquidityRamp.grantRole(SIGNER_ROLE, AI_SIGNER_ADDRESS);
        await tx.wait();
        console.log("✅ Granted SIGNER_ROLE to:", AI_SIGNER_ADDRESS);
    }

    // Verify initial configuration
    const platformFee = await liquidityRamp.platformFeeBps();
    const treasuryWallet = await liquidityRamp.treasuryWallet();

    console.log("");
    console.log("📊 Contract Configuration:");
    console.log("  - Platform Fee:", platformFee.toString(), "BPS (", platformFee / 100, "%)");
    console.log("  - Treasury Wallet:", treasuryWallet);
    console.log("");

    // ========================================
    // VERIFY ON POLYGONSCAN
    // ========================================

    if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
        console.log("⏳ Waiting 1 minute before verification...");
        await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 1 minute

        console.log("🔍 Verifying contract on Polygonscan...");

        try {
            await hre.run("verify:verify", {
                address: contractAddress,
                constructorArguments: [
                    QUICKSWAP_ROUTER,
                    BEZ_TOKEN,
                    USDC_TOKEN,
                    ADMIN_ADDRESS,
                    TREASURY_ADDRESS
                ],
            });
            console.log("✅ Contract verified on Polygonscan!");
        } catch (error) {
            console.log("⚠️  Verification failed:", error.message);
            console.log("   You can verify manually later using:");
            console.log(`   npx hardhat verify --network ${hre.network.name} ${contractAddress} ${QUICKSWAP_ROUTER} ${BEZ_TOKEN} ${USDC_TOKEN} ${ADMIN_ADDRESS} ${TREASURY_ADDRESS}`);
        }
    }

    // ========================================
    // DEPLOYMENT SUMMARY
    // ========================================

    console.log("");
    console.log("🎉 DEPLOYMENT COMPLETE!");
    console.log("=".repeat(60));
    console.log("");
    console.log("📝 Next Steps:");
    console.log("");
    console.log("1. Update backend .env:");
    console.log(`   BEZ_LIQUIDITY_RAMP_ADDRESS=${contractAddress}`);
    console.log(`   AI_SIGNER_PRIVATE_KEY=<your-backend-wallet-private-key>`);
    console.log("");
    console.log("2. Update frontend .env:");
    console.log(`   VITE_BEZ_LIQUIDITY_RAMP_ADDRESS=${contractAddress}`);
    console.log("");
    console.log("3. Grant SIGNER_ROLE to backend wallet (if not done above):");
    console.log(`   liquidityRamp.grantRole(SIGNER_ROLE, "${AI_SIGNER_ADDRESS}");`);
    console.log("");
    console.log("4. Test the complete flow:");
    console.log("   - User requests swap on frontend");
    console.log("   - Backend AI evaluates risk and signs");
    console.log("   - User executes swap on-chain");
    console.log("   - Verify fee collection in treasury wallet");
    console.log("");
    console.log("5. Monitor revenue:");
    console.log("   - Check treasury wallet balance");
    console.log("   - Query contract stats: getStats()");
    console.log("   - Track totalFeesCollected on-chain");
    console.log("");
    console.log("=".repeat(60));
    console.log("");

    // Save deployment info to file
    const fs = require("fs");
    const deploymentInfo = {
        network: hre.network.name,
        contractAddress,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        configuration: {
            router: QUICKSWAP_ROUTER,
            bezToken: BEZ_TOKEN,
            stablecoin: USDC_TOKEN,
            admin: ADMIN_ADDRESS,
            treasury: TREASURY_ADDRESS,
            platformFeeBps: platformFee.toString()
        }
    };

    fs.writeFileSync(
        `deployment-${hre.network.name}-${Date.now()}.json`,
        JSON.stringify(deploymentInfo, null, 2)
    );

    console.log("💾 Deployment info saved to deployment-*.json");
    console.log("");
}

// Execute deployment
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
