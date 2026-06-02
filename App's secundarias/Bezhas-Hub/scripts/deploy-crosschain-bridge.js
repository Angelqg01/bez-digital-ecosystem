/**
 * Deploy Cross-Chain Bridge Contract
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-crosschain-bridge.js --network <network>
 * 
 * Networks: polygon, amoy, arbitrum, arbitrumSepolia, zkSync, zkSyncSepolia
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const network = hre.network.name;
    console.log(`\n🌉 Deploying CrossChainBridge to ${network}...`);
    console.log("=".repeat(50));

    // Get deployer
    const [deployer] = await hre.ethers.getSigners();
    console.log(`📝 Deployer address: ${deployer.address}`);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log(`💰 Deployer balance: ${hre.ethers.formatEther(balance)} ${getNetworkCurrency(network)}`);

    // Get token address for this network
    const tokenAddress = getTokenAddress(network);
    if (!tokenAddress) {
        throw new Error(`No token address configured for network: ${network}`);
    }
    console.log(`🪙 Token address: ${tokenAddress}`);

    // Deploy CrossChainBridge
    console.log("\n📦 Deploying CrossChainBridge...");
    const CrossChainBridge = await hre.ethers.getContractFactory("CrossChainBridge");
    const bridge = await CrossChainBridge.deploy(tokenAddress);
    await bridge.waitForDeployment();

    const bridgeAddress = await bridge.getAddress();
    console.log(`✅ CrossChainBridge deployed to: ${bridgeAddress}`);

    // Setup initial configuration
    console.log("\n⚙️ Setting up initial configuration...");

    // Add deployer as relayer
    const RELAYER_ROLE = await bridge.RELAYER_ROLE();
    const tx1 = await bridge.grantRole(RELAYER_ROLE, deployer.address);
    await tx1.wait();
    console.log(`✅ Deployer added as relayer`);

    // Get chain ID
    const chainId = (await hre.ethers.provider.getNetwork()).chainId;
    console.log(`📊 Chain ID: ${chainId}`);

    // Save deployment info
    const deploymentInfo = {
        network,
        chainId: chainId.toString(),
        bridgeAddress,
        tokenAddress,
        deployer: deployer.address,
        deployedAt: new Date().toISOString(),
        blockNumber: (await hre.ethers.provider.getBlockNumber()).toString()
    };

    saveDeployment(network, deploymentInfo);

    // Print summary
    console.log("\n" + "=".repeat(50));
    console.log("🎉 DEPLOYMENT COMPLETE!");
    console.log("=".repeat(50));
    console.log(`Network: ${network}`);
    console.log(`Bridge Address: ${bridgeAddress}`);
    console.log(`Token Address: ${tokenAddress}`);
    console.log(`Chain ID: ${chainId}`);
    console.log("=".repeat(50));

    // Verification instructions
    console.log("\n📋 Next Steps:");
    console.log("1. Verify the contract on block explorer:");
    console.log(`   npx hardhat verify --network ${network} ${bridgeAddress} ${tokenAddress}`);
    console.log("\n2. Set trusted remotes for other chains:");
    console.log("   Call setTrustedRemote(chainId, bridgeAddressOnThatChain)");
    console.log("\n3. Update .env.production with the bridge address:");
    console.log(`   BRIDGE_ADDRESS_${network.toUpperCase()}=${bridgeAddress}`);

    return { bridgeAddress, tokenAddress, chainId };
}

function getTokenAddress(network) {
    // Token addresses per network
    const addresses = {
        // Mainnets
        polygon: process.env.BEZ_TOKEN_ADDRESS || "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8",
        arbitrum: process.env.BEZ_TOKEN_ARBITRUM || null,
        zkSync: process.env.BEZ_TOKEN_ZKSYNC || null,

        // Testnets (use mock or test token)
        amoy: process.env.BEZ_TOKEN_AMOY || process.env.TEST_TOKEN_ADDRESS,
        arbitrumSepolia: process.env.BEZ_TOKEN_ARB_SEPOLIA || process.env.TEST_TOKEN_ADDRESS,
        zkSyncSepolia: process.env.BEZ_TOKEN_ZKSYNC_SEPOLIA || process.env.TEST_TOKEN_ADDRESS,

        // Local
        localhost: process.env.TEST_TOKEN_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3",
        hardhat: process.env.TEST_TOKEN_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3"
    };

    return addresses[network];
}

function getNetworkCurrency(network) {
    const currencies = {
        polygon: "MATIC",
        amoy: "MATIC",
        arbitrum: "ETH",
        arbitrumSepolia: "ETH",
        zkSync: "ETH",
        zkSyncSepolia: "ETH",
        localhost: "ETH",
        hardhat: "ETH"
    };
    return currencies[network] || "ETH";
}

function saveDeployment(network, info) {
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const filePath = path.join(deploymentsDir, `crosschain-bridge-${network}.json`);
    fs.writeFileSync(filePath, JSON.stringify(info, null, 2));
    console.log(`\n💾 Deployment info saved to: ${filePath}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Deployment failed:", error);
        process.exit(1);
    });
