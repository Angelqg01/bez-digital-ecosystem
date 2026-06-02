/**
 * Deploy BeZhas Real Estate Contract to Polygon Mainnet
 * RWA (Real World Assets) Tokenization Platform
 */

const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
    console.log('🏠 Deploying BeZhas Real Estate Contract to Polygon Mainnet...\n');

    // Get deployer account
    const [deployer] = await hre.ethers.getSigners();
    console.log('📍 Deploying from:', deployer.address);

    // Check balance
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log('💰 Balance:', hre.ethers.formatEther(balance), 'MATIC\n');

    if (balance < hre.ethers.parseEther('0.1')) {
        throw new Error('❌ Insufficient MATIC balance. Need at least 0.1 MATIC for deployment');
    }

    // Deploy Contract
    console.log('📝 Deploying BeZhasRealEstate contract...');
    const BeZhasRealEstate = await hre.ethers.getContractFactory("BeZhasRealEstate");

    const realEstate = await BeZhasRealEstate.deploy({
        gasLimit: 5000000
    });

    await realEstate.waitForDeployment();
    const contractAddress = await realEstate.getAddress();

    console.log('✅ BeZhasRealEstate deployed to:', contractAddress);
    console.log('🔗 PolygonScan:', `https://polygonscan.com/address/${contractAddress}\n`);

    // Verify deployment
    console.log('🔍 Verifying deployment...');
    const owner = await realEstate.owner();
    console.log('   Owner:', owner);
    console.log('   URI Pattern:', await realEstate.uri(0));

    // Save deployment info
    const deploymentInfo = {
        network: hre.network.name,
        chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
        contract: 'BeZhasRealEstate',
        address: contractAddress,
        deployer: deployer.address,
        deployedAt: new Date().toISOString(),
        blockNumber: await hre.ethers.provider.getBlockNumber(),
        transactionHash: realEstate.deploymentTransaction()?.hash,
        verified: false
    };

    const deploymentsDir = path.join(__dirname, '../deployments');
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const filename = `realestate-${hre.network.name}-${Date.now()}.json`;
    const filepath = path.join(deploymentsDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));

    console.log(`\n💾 Deployment info saved to: ${filename}`);

    // Update .env template
    console.log('\n📝 Update your .env file with:');
    console.log('─'.repeat(60));
    console.log(`REALESTATE_CONTRACT_ADDRESS="${contractAddress}"`);
    console.log('─'.repeat(60));

    // Verification instructions
    console.log('\n✨ Next steps:');
    console.log('1. Update .env with the contract address above');
    console.log('2. Verify contract on PolygonScan:');
    console.log(`   npx hardhat verify --network ${hre.network.name} ${contractAddress}`);
    console.log('3. Create some test properties:');
    console.log(`   node scripts/seed-realestate.js`);
    console.log('4. Restart backend to load new contract');

    return deploymentInfo;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('\n❌ Deployment failed:', error);
        process.exit(1);
    });
