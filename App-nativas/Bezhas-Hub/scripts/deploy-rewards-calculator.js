const hre = require("hardhat");

async function main() {
    console.log("🚀 Deploying BeZhasRewardsCalculator...\n");

    // Get deployer account
    const [deployer] = await hre.ethers.getSigners();
    console.log("📝 Deploying with account:", deployer.address);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("💰 Account balance:", hre.ethers.formatEther(balance), "MATIC\n");

    // Deploy BeZhasRewardsCalculator
    const BeZhasRewardsCalculator = await hre.ethers.getContractFactory("BeZhasRewardsCalculator");
    const rewardsCalculator = await BeZhasRewardsCalculator.deploy();

    await rewardsCalculator.waitForDeployment();
    const contractAddress = await rewardsCalculator.getAddress();

    console.log("✅ BeZhasRewardsCalculator deployed to:", contractAddress);
    console.log("");

    // Verify contract constants
    console.log("🔍 Verifying contract constants...\n");

    const decimals = await rewardsCalculator.DECIMALS();
    console.log("   DECIMALS:", decimals.toString());

    const postValue = await rewardsCalculator.POST_VALUE();
    console.log("   POST_VALUE:", hre.ethers.formatEther(postValue), "BEZ");

    const commentValue = await rewardsCalculator.COMMENT_VALUE();
    console.log("   COMMENT_VALUE:", hre.ethers.formatEther(commentValue), "BEZ");

    const likeValue = await rewardsCalculator.LIKE_VALUE();
    console.log("   LIKE_VALUE:", hre.ethers.formatEther(likeValue), "BEZ");

    const shareValue = await rewardsCalculator.SHARE_VALUE();
    console.log("   SHARE_VALUE:", hre.ethers.formatEther(shareValue), "BEZ");

    const premiumValue = await rewardsCalculator.PREMIUM_INTERACTION_VALUE();
    console.log("   PREMIUM_INTERACTION_VALUE:", hre.ethers.formatEther(premiumValue), "BEZ");

    const referralValue = await rewardsCalculator.REFERRAL_VALUE();
    console.log("   REFERRAL_VALUE:", hre.ethers.formatEther(referralValue), "BEZ");

    console.log("");

    // Get daily limits
    const limits = await rewardsCalculator.getDailyLimits();
    console.log("📊 Daily Limits:");
    console.log("   Max Posts:", limits.maxPosts.toString());
    console.log("   Max Comments:", limits.maxComments.toString());
    console.log("   Max Likes:", limits.maxLikes.toString());
    console.log("   Max Shares:", limits.maxShares.toString());
    console.log("   Max Premium Interactions:", limits.maxPremiumInteractions.toString());
    console.log("   Max Referrals:", limits.maxReferrals.toString());
    console.log("");

    // Test calculation
    console.log("🧪 Testing calculation with sample data...\n");

    const sampleActions = {
        posts: 5n,
        comments: 20n,
        likes: 50n,
        shares: 10n,
        premiumInteractions: 3n,
        referrals: 1n
    };

    const sampleUserData = {
        level: 5n,
        loginStreak: 15n,
        vipTier: 0n // Standard user
    };

    const result = await rewardsCalculator.calculateDailyRewards(sampleActions, sampleUserData);

    console.log("   Base Rewards:", hre.ethers.formatEther(result.baseRewards), "BEZ");
    console.log("   Level Multiplier:", Number(result.levelMultiplier) / 100, "%");
    console.log("   Streak Bonus:", Number(result.streakBonus) / 100, "%");
    console.log("   VIP Multiplier:", Number(result.vipMultiplier) / 100, "%");
    console.log("   Total Daily (Standard):", hre.ethers.formatEther(result.totalDaily), "BEZ");
    console.log("   Total with VIP:", hre.ethers.formatEther(result.totalWithVIP), "BEZ");
    console.log("");

    // Save deployment info
    const fs = require("fs");
    const path = require("path");

    const deploymentInfo = {
        network: hre.network.name,
        contractAddress: contractAddress,
        deployer: deployer.address,
        blockNumber: await hre.ethers.provider.getBlockNumber(),
        timestamp: new Date().toISOString(),
        chainId: (await hre.ethers.provider.getNetwork()).chainId.toString()
    };

    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const deploymentPath = path.join(deploymentsDir, `rewards-calculator-${hre.network.name}.json`);
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));

    console.log("📄 Deployment info saved to:", deploymentPath);
    console.log("");

    console.log("🎉 Deployment completed successfully!");
    console.log("");
    console.log("📋 Next steps:");
    console.log("   1. Update frontend/src/contracts/config.js with the contract address:");
    console.log(`      address: '${contractAddress}'`);
    console.log("");
    console.log("   2. Verify contract on PolygonScan:");
    console.log(`      npx hardhat verify --network ${hre.network.name} ${contractAddress}`);
    console.log("");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
