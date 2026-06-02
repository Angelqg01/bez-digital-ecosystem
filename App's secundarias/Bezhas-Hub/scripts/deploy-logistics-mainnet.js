/**
 * Deploy Logistics Container Contract to Polygon Mainnet
 * Supply Chain Tracking & Container Tokenization
 */

const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
    console.log('📦 Deploying Logistics Container Contract to Polygon Mainnet...\n');

    // Get deployer account
    const [deployer] = await hre.ethers.getSigners();
    console.log('📍 Deploying from:', deployer.address);

    // Check balance
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log('💰 Balance:', hre.ethers.formatEther(balance), 'MATIC\n');

    if (balance < hre.ethers.parseEther('0.05')) {
        throw new Error('❌ Insufficient MATIC balance. Need at least 0.05 MATIC for deployment');
    }

    // Deploy Contract
    console.log('📝 Deploying LogisticsContainer contract...');
    const LogisticsContainer = await hre.ethers.getContractFactory("LogisticsContainer");

    const logistics = await LogisticsContainer.deploy({
        gasLimit: 3000000
    });

    await logistics.waitForDeployment();
    const contractAddress = await logistics.getAddress();

    console.log('✅ LogisticsContainer deployed to:', contractAddress);
    console.log('🔗 PolygonScan:', `https://polygonscan.com/address/${contractAddress}\n`);

    // Save deployment info
    const deploymentInfo = {
        network: hre.network.name,
        chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
        contract: 'LogisticsContainer',
        address: contractAddress,
        deployer: deployer.address,
        deployedAt: new Date().toISOString(),
        blockNumber: await hre.ethers.provider.getBlockNumber(),
        transactionHash: logistics.deploymentTransaction()?.hash,
        verified: false
    };

    const deploymentsDir = path.join(__dirname, '../deployments');
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const filename = `logistics-${hre.network.name}-${Date.now()}.json`;
    const filepath = path.join(deploymentsDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));

    console.log(`\n💾 Deployment info saved to: ${filename}`);

    // Update .env template
    console.log('\n📝 Update your .env file with:');
    console.log('─'.repeat(60));
    console.log(`LOGISTICS_CONTRACT_ADDRESS="${contractAddress}"`);
    console.log('─'.repeat(60));

    // Verification instructions
    console.log('\n✨ Next steps:');
    console.log('1. Update .env with the contract address above');
    console.log('2. Verify contract on PolygonScan:');
    console.log(`   npx hardhat verify --network ${hre.network.name} ${contractAddress}`);
    console.log('3. Test container creation:');
    console.log(`   node scripts/test-logistics.js`);
    console.log('4. Restart backend to load new contract');

    return deploymentInfo;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('\n❌ Deployment failed:', error);
        process.exit(1);
    });
