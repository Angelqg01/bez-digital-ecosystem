const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Deploying Tokenized Post System...\n");

    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log("📍 Deploying contracts with account:", deployer.address);
    console.log("💰 Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

    // ==================== DEPLOY USER PROFILE ====================
    console.log("1️⃣  Deploying UserProfile...");
    const UserProfile = await ethers.getContractFactory("UserProfile");
    const userProfile = await UserProfile.deploy();
    await userProfile.waitForDeployment();
    const userProfileAddress = await userProfile.getAddress();
    console.log("✅ UserProfile deployed to:", userProfileAddress, "\n");

    // ==================== DEPLOY BEZHAS TOKEN ====================
    console.log("2️⃣  Configuring BezhasToken...");
    const BEZHAS_TOKEN_ADDRESS = "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8";
    const bezhasTokenAddress = BEZHAS_TOKEN_ADDRESS;
    console.log("✅ Using Existing BezhasToken:", bezhasTokenAddress);

    let bezhasToken;
    try {
        bezhasToken = await ethers.getContractAt("BezhasToken", bezhasTokenAddress);
    } catch (e) {
        console.log("   ⚠️ Could not attach to contract instance.");
    }

    // ==================== DEPLOY TOKEN SALE ====================
    console.log("3️⃣  Deploying TokenSale...");
    const tokenPrice = ethers.parseEther("0.001"); // 0.001 ETH per BEZ token
    const TokenSale = await ethers.getContractFactory("TokenSale");
    const tokenSale = await TokenSale.deploy(
        bezhasTokenAddress,
        deployer.address, // wallet address to receive ETH
        tokenPrice
    );
    await tokenSale.waitForDeployment();
    const tokenSaleAddress = await tokenSale.getAddress();
    console.log("✅ TokenSale deployed to:", tokenSaleAddress);
    console.log("   Price per token:", ethers.formatEther(tokenPrice), "ETH\n");

    // Transfer tokens to TokenSale contract for selling
    console.log("4️⃣  Transferring tokens to TokenSale...");
    if (bezhasToken) {
        try {
            const tokensForSale = ethers.parseEther("100000"); // 100k tokens for sale
            await bezhasToken.transfer(tokenSaleAddress, tokensForSale);
            console.log("✅ Transferred", ethers.formatEther(tokensForSale), "BEZ to TokenSale\n");
        } catch (e) {
            console.log("   ⚠️ Could not transfer tokens (Check balance/permissions).");
        }
    }

    // ==================== DEPLOY TOKENIZED POST ====================
    console.log("5️⃣  Deploying TokenizedPost...");
    const TokenizedPost = await ethers.getContractFactory("TokenizedPost");
    const tokenizedPost = await TokenizedPost.deploy(
        userProfileAddress,
        bezhasTokenAddress
    );
    await tokenizedPost.waitForDeployment();
    const tokenizedPostAddress = await tokenizedPost.getAddress();
    console.log("✅ TokenizedPost deployed to:", tokenizedPostAddress, "\n");

    // ==================== GRANT MINTER ROLE ====================
    console.log("6️⃣  Granting MINTER_ROLE to TokenizedPost...");
    const MINTER_ROLE = await bezhasToken.MINTER_ROLE();
    await bezhasToken.grantRole(MINTER_ROLE, tokenizedPostAddress);
    console.log("✅ MINTER_ROLE granted to TokenizedPost\n");

    // ==================== CREATE TEST PROFILE ====================
    console.log("7️⃣  Creating test user profile...");
    await userProfile.createProfile("TestUser", "QmTestBio", "QmTestAvatar");
    console.log("✅ Test profile created for deployer\n");

    // ==================== SUMMARY ====================
    console.log("=".repeat(60));
    console.log("📋 DEPLOYMENT SUMMARY");
    console.log("=".repeat(60));
    console.log("UserProfile:      ", userProfileAddress);
    console.log("BezhasToken:      ", bezhasTokenAddress);
    console.log("TokenSale:        ", tokenSaleAddress);
    console.log("TokenizedPost:    ", tokenizedPostAddress);
    console.log("=".repeat(60));
    console.log("\n💾 Saving contract addresses...");

    // Save addresses to JSON file
    const fs = require("fs");
    const path = require("path");

    const addresses = {
        UserProfileAddress: userProfileAddress,
        BezhasTokenAddress: bezhasTokenAddress,
        TokenSaleAddress: tokenSaleAddress,
        TokenizedPostAddress: tokenizedPostAddress,
        DeploymentTimestamp: new Date().toISOString(),
        Network: (await ethers.provider.getNetwork()).name,
        ChainId: (await ethers.provider.getNetwork()).chainId.toString()
    };

    // Save to multiple locations for frontend and backend
    const locations = [
        path.join(__dirname, "../frontend/src/contract-addresses.json"),
        path.join(__dirname, "../backend/contract-addresses.json"),
        path.join(__dirname, "../contract-addresses.json")
    ];

    locations.forEach(location => {
        try {
            fs.writeFileSync(location, JSON.stringify(addresses, null, 2));
            console.log("✅ Saved to:", location);
        } catch (error) {
            console.log("⚠️  Could not save to:", location);
        }
    });

    console.log("\n🎉 Deployment complete!");
    console.log("\n📚 Next steps:");
    console.log("1. Update frontend/.env with contract addresses");
    console.log("2. Run 'npm run dev' in frontend to start the app");
    console.log("3. Import BEZ token to MetaMask:");
    console.log("   - Address:", bezhasTokenAddress);
    console.log("   - Symbol: BEZ");
    console.log("   - Decimals: 18");
    console.log("\n💡 Test the system:");
    console.log("1. Buy BEZ tokens from TokenSale");
    console.log("2. Create a tokenized post (costs 10 BEZ, rewards 5 BEZ)");
    console.log("3. Check your BEZ balance and verified post badge");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
