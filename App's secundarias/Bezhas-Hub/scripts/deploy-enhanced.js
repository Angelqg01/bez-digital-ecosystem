const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("Starting enhanced BeZhas deployment...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  const deployedContracts = {};

  try {
    // Deploy EnhancedAuthManager
    console.log("\n1. Deploying EnhancedAuthManager...");
    const EnhancedAuthManager = await ethers.getContractFactory("EnhancedAuthManager");
    const enhancedAuthManager = await EnhancedAuthManager.deploy();
    await enhancedAuthManager.waitForDeployment();
    const enhancedAuthManagerAddress = await enhancedAuthManager.getAddress();
    deployedContracts.EnhancedAuthManagerAddress = enhancedAuthManagerAddress;
    console.log("EnhancedAuthManager deployed to:", enhancedAuthManagerAddress);

    // Deploy UserManagement
    console.log("\n2. Deploying UserManagement...");
    const UserManagement = await ethers.getContractFactory("UserManagement");
    const userManagement = await UserManagement.deploy();
    await userManagement.waitForDeployment();
    const userManagementAddress = await userManagement.getAddress();
    deployedContracts.UserManagementAddress = userManagementAddress;
    console.log("UserManagement deployed to:", userManagementAddress);

    // Deploy AdvancedNotificationSystem
    console.log("\n2.1. Deploying AdvancedNotificationSystem...");
    const AdvancedNotificationSystem = await ethers.getContractFactory("AdvancedNotificationSystem");
    const advancedNotificationSystem = await AdvancedNotificationSystem.deploy();
    await advancedNotificationSystem.waitForDeployment();
    const advancedNotificationSystemAddress = await advancedNotificationSystem.getAddress();
    deployedContracts.AdvancedNotificationSystemAddress = advancedNotificationSystemAddress;
    console.log("AdvancedNotificationSystem deployed to:", advancedNotificationSystemAddress);

    // Deploy AdvancedSocialInteractions
    console.log("\n2.2. Deploying AdvancedSocialInteractions...");
    const AdvancedSocialInteractions = await ethers.getContractFactory("AdvancedSocialInteractions");
    const advancedSocialInteractions = await AdvancedSocialInteractions.deploy();
    await advancedSocialInteractions.waitForDeployment();
    const advancedSocialInteractionsAddress = await advancedSocialInteractions.getAddress();
    deployedContracts.AdvancedSocialInteractionsAddress = advancedSocialInteractionsAddress;
    console.log("AdvancedSocialInteractions deployed to:", advancedSocialInteractionsAddress);

    // Deploy GroupsAndCommunities
    console.log("\n2.3. Deploying GroupsAndCommunities...");
    const GroupsAndCommunities = await ethers.getContractFactory("GroupsAndCommunities");
    const groupsAndCommunities = await GroupsAndCommunities.deploy();
    await groupsAndCommunities.waitForDeployment();
    const groupsAndCommunitiesAddress = await groupsAndCommunities.getAddress();
    deployedContracts.GroupsAndCommunitiesAddress = groupsAndCommunitiesAddress;
    console.log("GroupsAndCommunities deployed to:", groupsAndCommunitiesAddress);

    // Deploy PersonalizedFeed
    console.log("\n2.4. Deploying PersonalizedFeed...");
    const PersonalizedFeed = await ethers.getContractFactory("PersonalizedFeed");
    const personalizedFeed = await PersonalizedFeed.deploy();
    await personalizedFeed.waitForDeployment();
    const personalizedFeedAddress = await personalizedFeed.getAddress();
    deployedContracts.PersonalizedFeedAddress = personalizedFeedAddress;
    console.log("PersonalizedFeed deployed to:", personalizedFeedAddress);

    // Deploy AdvancedModerationSystem
    console.log("\n2.5. Deploying AdvancedModerationSystem...");
    const AdvancedModerationSystem = await ethers.getContractFactory("AdvancedModerationSystem");
    const advancedModerationSystem = await AdvancedModerationSystem.deploy();
    await advancedModerationSystem.waitForDeployment();
    const advancedModerationSystemAddress = await advancedModerationSystem.getAddress();
    deployedContracts.AdvancedModerationSystemAddress = advancedModerationSystemAddress;
    console.log("AdvancedModerationSystem deployed to:", advancedModerationSystemAddress);

    // Deploy AdvancedMarketplace
    console.log("\n2.6. Deploying AdvancedMarketplace...");
    const AdvancedMarketplace = await ethers.getContractFactory("AdvancedMarketplace");
    const advancedMarketplace = await AdvancedMarketplace.deploy();
    await advancedMarketplace.waitForDeployment();
    const advancedMarketplaceAddress = await advancedMarketplace.getAddress();
    deployedContracts.AdvancedMarketplaceAddress = advancedMarketplaceAddress;
    console.log("AdvancedMarketplace deployed to:", advancedMarketplaceAddress);

    // Deploy core contracts first to get token address
    console.log("\n2.7. Configuring core contracts...");

    // Use existing BezhasToken
    const BEZHAS_TOKEN_ADDRESS = "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8";
    const bezhasTokenAddress = BEZHAS_TOKEN_ADDRESS;
    deployedContracts.BezhasTokenAddress = bezhasTokenAddress;
    console.log("Using existing BezhasToken at:", bezhasTokenAddress);

    let bezhasToken;
    try {
      bezhasToken = await ethers.getContractAt("BezhasToken", bezhasTokenAddress);
    } catch (e) {
      console.log("Could not attach to BezhasToken contract instance (ABI missing or network issue).");
    }

    // Deploy AdvancedStakingPool
    console.log("\n2.8. Deploying AdvancedStakingPool...");
    const AdvancedStakingPool = await ethers.getContractFactory("AdvancedStakingPool");
    const baseRewardRate = 1000; // 10% APY
    const maxPoolSize = ethers.parseEther("1000000"); // 1M tokens max

    const advancedStakingPool = await AdvancedStakingPool.deploy(
      bezhasTokenAddress,
      bezhasTokenAddress,
      baseRewardRate,
      maxPoolSize
    );
    await advancedStakingPool.waitForDeployment();
    const advancedStakingPoolAddress = await advancedStakingPool.getAddress();
    deployedContracts.AdvancedStakingPoolAddress = advancedStakingPoolAddress;
    console.log("AdvancedStakingPool deployed to:", advancedStakingPoolAddress);

    // Deploy LiquidityFarming
    console.log("\n2.9. Deploying LiquidityFarming...");
    const LiquidityFarming = await ethers.getContractFactory("LiquidityFarming");
    const rewardPerBlock = ethers.parseEther("1"); // 1 token per block
    const startBlock = await ethers.provider.getBlockNumber();
    const bonusEndBlock = startBlock + 100000; // Bonus period

    const liquidityFarming = await LiquidityFarming.deploy(
      bezhasTokenAddress,
      rewardPerBlock,
      startBlock,
      bonusEndBlock
    );
    await liquidityFarming.waitForDeployment();
    const liquidityFarmingAddress = await liquidityFarming.getAddress();
    deployedContracts.LiquidityFarmingAddress = liquidityFarmingAddress;
    console.log("LiquidityFarming deployed to:", liquidityFarmingAddress);

    // Deploy GovernanceSystem
    console.log("\n2.10. Deploying GovernanceSystem...");
    const GovernanceSystem = await ethers.getContractFactory("GovernanceSystem");
    const votingDelay = 1 * 24 * 60 * 60; // 1 day
    const votingPeriod = 7 * 24 * 60 * 60; // 7 days
    const proposalThreshold = ethers.parseEther("1000"); // 1000 tokens to propose
    const quorumPercentage = 500; // 5% quorum

    const governanceSystem = await GovernanceSystem.deploy(
      bezhasTokenAddress,
      votingDelay,
      votingPeriod,
      proposalThreshold,
      quorumPercentage
    );
    await governanceSystem.waitForDeployment();
    const governanceSystemAddress = await governanceSystem.getAddress();
    deployedContracts.GovernanceSystemAddress = governanceSystemAddress;
    console.log("GovernanceSystem deployed to:", governanceSystemAddress);

    // Deploy SecurityManager
    console.log("\n2.11. Deploying SecurityManager...");
    const SecurityManager = await ethers.getContractFactory("SecurityManager");
    const securityManager = await SecurityManager.deploy();
    await securityManager.waitForDeployment();
    const securityManagerAddress = await securityManager.getAddress();
    deployedContracts.SecurityManagerAddress = securityManagerAddress;
    console.log("SecurityManager deployed to:", securityManagerAddress);

    // Deploy BackupRecoverySystem
    console.log("\n2.12. Deploying BackupRecoverySystem...");
    const BackupRecoverySystem = await ethers.getContractFactory("BackupRecoverySystem");
    const backupRecoverySystem = await BackupRecoverySystem.deploy();
    await backupRecoverySystem.waitForDeployment();
    const backupRecoverySystemAddress = await backupRecoverySystem.getAddress();
    deployedContracts.BackupRecoverySystemAddress = backupRecoverySystemAddress;
    console.log("BackupRecoverySystem deployed to:", backupRecoverySystemAddress);

    // Deploy GlobalConfigurationSystem
    console.log("\n2.13. Deploying GlobalConfigurationSystem...");
    const GlobalConfigurationSystem = await ethers.getContractFactory("GlobalConfigurationSystem");
    const globalConfigurationSystem = await GlobalConfigurationSystem.deploy();
    await globalConfigurationSystem.waitForDeployment();
    const globalConfigurationSystemAddress = await globalConfigurationSystem.getAddress();
    deployedContracts.GlobalConfigurationSystemAddress = globalConfigurationSystemAddress;
    console.log("GlobalConfigurationSystem deployed to:", globalConfigurationSystemAddress);

    // Deploy AuthenticationManager (legacy)
    console.log("\n3. Deploying AuthenticationManager (legacy)...");
    const AuthenticationManager = await ethers.getContractFactory("AuthenticationManager");
    const authManager = await AuthenticationManager.deploy();
    await authManager.waitForDeployment();
    const authManagerAddress = await authManager.getAddress();
    deployedContracts.AuthenticationManagerAddress = authManagerAddress;
    console.log("AuthenticationManager deployed to:", authManagerAddress);

    // Deploy NotificationSystem
    console.log("\n4. Deploying NotificationSystem...");
    const NotificationSystem = await ethers.getContractFactory("NotificationSystem");
    const notificationSystem = await NotificationSystem.deploy();
    await notificationSystem.waitForDeployment();
    const notificationSystemAddress = await notificationSystem.getAddress();
    deployedContracts.NotificationSystemAddress = notificationSystemAddress;
    console.log("NotificationSystem deployed to:", notificationSystemAddress);

    // Deploy SocialInteractions
    console.log("\n5. Deploying SocialInteractions...");
    const SocialInteractions = await ethers.getContractFactory("SocialInteractions");
    const socialInteractions = await SocialInteractions.deploy();
    await socialInteractions.waitForDeployment();
    const socialInteractionsAddress = await socialInteractions.getAddress();
    deployedContracts.SocialInteractionsAddress = socialInteractionsAddress;
    console.log("SocialInteractions deployed to:", socialInteractionsAddress);

    // Deploy ModerationSystem
    console.log("\n6. Deploying ModerationSystem...");
    const ModerationSystem = await ethers.getContractFactory("ModerationSystem");
    const moderationSystem = await ModerationSystem.deploy();
    await moderationSystem.waitForDeployment();
    const moderationSystemAddress = await moderationSystem.getAddress();
    deployedContracts.ModerationSystemAddress = moderationSystemAddress;
    console.log("ModerationSystem deployed to:", moderationSystemAddress);

    // Deploy additional core contracts
    console.log("\n3. Deploying additional core contracts...");

    // Deploy BezhasNFT
    const BezhasNFT = await ethers.getContractFactory("BezhasNFT");
    const bezhasNFT = await BezhasNFT.deploy();
    await bezhasNFT.waitForDeployment();
    const bezhasNFTAddress = await bezhasNFT.getAddress();
    deployedContracts.BezhasNFTAddress = bezhasNFTAddress;
    console.log("BezhasNFT deployed to:", bezhasNFTAddress);

    // Deploy UserProfile
    const UserProfile = await ethers.getContractFactory("UserProfile");
    const userProfile = await UserProfile.deploy();
    await userProfile.waitForDeployment();
    const userProfileAddress = await userProfile.getAddress();
    deployedContracts.UserProfileAddress = userProfileAddress;
    console.log("UserProfile deployed to:", userProfileAddress);

    // Deploy Post
    const Post = await ethers.getContractFactory("Post");
    const post = await Post.deploy();
    await post.waitForDeployment();
    const postAddress = await post.getAddress();
    deployedContracts.PostAddress = postAddress;
    console.log("Post deployed to:", postAddress);

    // Deploy Messages
    const Messages = await ethers.getContractFactory("Messages");
    const messages = await Messages.deploy();
    await messages.waitForDeployment();
    const messagesAddress = await messages.getAddress();
    deployedContracts.MessagesAddress = messagesAddress;
    console.log("Messages deployed to:", messagesAddress);

    // Deploy Marketplace
    const Marketplace = await ethers.getContractFactory("Marketplace");
    const marketplace = await Marketplace.deploy();
    await marketplace.waitForDeployment();
    const marketplaceAddress = await marketplace.getAddress();
    deployedContracts.MarketplaceAddress = marketplaceAddress;
    console.log("Marketplace deployed to:", marketplaceAddress);

    // Deploy TokenSale
    const TokenSale = await ethers.getContractFactory("TokenSale");
    const tokenPrice = ethers.parseEther("0.001"); // 0.001 ETH per token
    const tokenSale = await TokenSale.deploy(bezhasTokenAddress, tokenPrice);
    await tokenSale.waitForDeployment();
    const tokenSaleAddress = await tokenSale.getAddress();
    deployedContracts.TokenSaleAddress = tokenSaleAddress;
    console.log("TokenSale deployed to:", tokenSaleAddress);

    // Deploy BezhasBridge (simplified version)
    const BezhasBridge = await ethers.getContractFactory("BezhasBridge");
    const bridge = await BezhasBridge.deploy(ethers.ZeroAddress, bezhasTokenAddress); // No router for simplified version
    await bridge.waitForDeployment();
    const bridgeAddress = await bridge.getAddress();
    deployedContracts.BezhasBridgeAddress = bridgeAddress;
    console.log("BezhasBridge deployed to:", bridgeAddress);

    console.log("\n4. Setting up permissions and roles...");

    // Grant roles to deployer (admin) for EnhancedAuthManager
    await enhancedAuthManager.grantRole(await enhancedAuthManager.ADMIN_ROLE(), deployer.address);
    console.log("Granted ADMIN_ROLE to deployer in EnhancedAuthManager");

    await enhancedAuthManager.grantRole(await enhancedAuthManager.MODERATOR_ROLE(), deployer.address);
    console.log("Granted MODERATOR_ROLE to deployer in EnhancedAuthManager");

    // Grant roles to deployer for UserManagement
    await userManagement.grantRole(await userManagement.MODERATOR_ROLE(), deployer.address);
    console.log("Granted MODERATOR_ROLE to deployer in UserManagement");

    // Grant roles for AdvancedNotificationSystem
    await advancedNotificationSystem.grantRole(await advancedNotificationSystem.NOTIFIER_ROLE(), deployer.address);
    await advancedNotificationSystem.grantRole(await advancedNotificationSystem.MODERATOR_ROLE(), deployer.address);
    console.log("Granted NOTIFIER_ROLE and MODERATOR_ROLE to deployer in AdvancedNotificationSystem");

    // Grant roles for AdvancedSocialInteractions
    await advancedSocialInteractions.grantRole(await advancedSocialInteractions.MODERATOR_ROLE(), deployer.address);
    console.log("Granted MODERATOR_ROLE to deployer in AdvancedSocialInteractions");

    // Grant roles for GroupsAndCommunities
    await groupsAndCommunities.grantRole(await groupsAndCommunities.MODERATOR_ROLE(), deployer.address);
    console.log("Granted MODERATOR_ROLE to deployer in GroupsAndCommunities");

    // Grant roles for AdvancedModerationSystem
    await advancedModerationSystem.grantRole(await advancedModerationSystem.ADMIN_ROLE(), deployer.address);
    console.log("Granted ADMIN_ROLE to deployer for AdvancedModerationSystem");

    // Grant roles for AdvancedMarketplace
    await advancedMarketplace.grantRole(await advancedMarketplace.ADMIN_ROLE(), deployer.address);
    console.log("Granted ADMIN_ROLE to deployer for AdvancedMarketplace");

    // Grant roles for new DeFi and Security contracts
    await advancedStakingPool.grantRole(await advancedStakingPool.ADMIN_ROLE(), deployer.address);
    console.log("Granted ADMIN_ROLE to deployer for AdvancedStakingPool");

    await liquidityFarming.grantRole(await liquidityFarming.ADMIN_ROLE(), deployer.address);
    console.log("Granted ADMIN_ROLE to deployer for LiquidityFarming");

    await governanceSystem.grantRole(await governanceSystem.ADMIN_ROLE(), deployer.address);
    await governanceSystem.grantRole(await governanceSystem.PROPOSER_ROLE(), deployer.address);
    console.log("Granted ADMIN_ROLE and PROPOSER_ROLE to deployer for GovernanceSystem");

    await securityManager.grantRole(await securityManager.ADMIN_ROLE(), deployer.address);
    await securityManager.grantRole(await securityManager.SECURITY_ROLE(), deployer.address);
    console.log("Granted ADMIN_ROLE and SECURITY_ROLE to deployer for SecurityManager");

    await backupRecoverySystem.grantRole(await backupRecoverySystem.ADMIN_ROLE(), deployer.address);
    await backupRecoverySystem.grantRole(await backupRecoverySystem.BACKUP_OPERATOR_ROLE(), deployer.address);
    console.log("Granted ADMIN_ROLE and BACKUP_OPERATOR_ROLE to deployer for BackupRecoverySystem");

    await globalConfigurationSystem.grantRole(await globalConfigurationSystem.ADMIN_ROLE(), deployer.address);
    await globalConfigurationSystem.grantRole(await globalConfigurationSystem.CONFIG_MANAGER_ROLE(), deployer.address);
    console.log("Granted ADMIN_ROLE and CONFIG_MANAGER_ROLE to deployer for GlobalConfigurationSystem");

    // Grant roles for legacy contracts
    await moderationSystem.grantRole(await moderationSystem.MODERATOR_ROLE(), deployer.address);
    console.log("Granted MODERATOR_ROLE to ModerationSystem for deployer");

    await notificationSystem.grantRole(await notificationSystem.NOTIFIER_ROLE(), deployer.address);
    console.log("Granted NOTIFIER_ROLE to NotificationSystem for deployer");

    // Grant roles on BezhasToken (if possible)
    if (bezhasToken) {
      try {
        // Grant MINTER_ROLE to TokenSale contract for BezhasToken
        await bezhasToken.grantRole(await bezhasToken.MINTER_ROLE(), tokenSaleAddress);
        console.log("Granted MINTER_ROLE to TokenSale contract");

        // Grant MINTER_ROLE to bridge for cross-chain operations
        await bezhasToken.grantRole(await bezhasToken.MINTER_ROLE(), bridgeAddress);
        await bezhasToken.grantRole(await bezhasToken.BURNER_ROLE(), bridgeAddress);
        console.log("Granted MINTER_ROLE and BURNER_ROLE to Bridge contract");
      } catch (e) {
        console.log("⚠️ Could not grant roles on BezhasToken (Deployer might not be admin).");
      }
    }

    console.log("\n5. Saving deployment addresses...");

    // Save addresses to backend config
    const backendConfigPath = path.join(__dirname, '..', 'backend', 'contract-addresses.json');
    fs.writeFileSync(backendConfigPath, JSON.stringify(deployedContracts, null, 2));
    console.log("Contract addresses saved to:", backendConfigPath);

    // Also save to a deployment log
    const deploymentLog = {
      timestamp: new Date().toISOString(),
      deployer: deployer.address,
      network: (await ethers.provider.getNetwork()).name,
      chainId: (await ethers.provider.getNetwork()).chainId,
      contracts: deployedContracts
    };

    const logPath = path.join(__dirname, '..', 'deployments', `deployment-${Date.now()}.json`);

    // Create deployments directory if it doesn't exist
    const deploymentsDir = path.dirname(logPath);
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    fs.writeFileSync(logPath, JSON.stringify(deploymentLog, null, 2));
    console.log("Deployment log saved to:", logPath);

    console.log("\n✅ Enhanced BeZhas deployment completed successfully!");
    console.log("\nDeployed contract addresses:");
    Object.entries(deployedContracts).forEach(([name, address]) => {
      console.log(`${name}: ${address}`);
    });

    console.log("\n📋 Next steps:");
    console.log("1. Update your .env file with the new contract addresses");
    console.log("2. Verify contracts on block explorer if on mainnet/testnet");
    console.log("3. Test all functionality in the frontend");
    console.log("4. Set up monitoring and alerts for the contracts");

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment script failed:", error);
    process.exit(1);
  });
