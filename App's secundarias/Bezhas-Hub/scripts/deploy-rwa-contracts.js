/**
 * Deploy ALL RWA Contracts to Polygon Mainnet
 * Real Estate + Logistics Container
 */

const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function deployRealEstate(deployer) {
    console.log('\n🏠 Deploying BeZhasRealEstate...');
    const BeZhasRealEstate = await hre.ethers.getContractFactory("BeZhasRealEstate");
    const realEstate = await BeZhasRealEstate.deploy({ gasLimit: 5000000 });
    await realEstate.waitForDeployment();
    const address = await realEstate.getAddress();
    console.log('   ✅ Deployed to:', address);
    return { name: 'BeZhasRealEstate', address, contract: realEstate };
}

async function deployLogistics(deployer) {
    console.log('\n📦 Deploying LogisticsContainer...');
    const LogisticsContainer = await hre.ethers.getContractFactory("LogisticsContainer");
    const logistics = await LogisticsContainer.deploy({ gasLimit: 3000000 });
    await logistics.waitForDeployment();
    const address = await logistics.getAddress();
    console.log('   ✅ Deployed to:', address);
    return { name: 'LogisticsContainer', address, contract: logistics };
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🚀 DEPLOYING RWA CONTRACTS TO POLYGON MAINNET');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Get deployer
    const [deployer] = await hre.ethers.getSigners();
    console.log('📍 Deployer Address:', deployer.address);

    // Check balance
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    const balanceFormatted = hre.ethers.formatEther(balance);
    console.log('💰 Balance:', balanceFormatted, 'MATIC');

    if (balance < hre.ethers.parseEther('0.2')) {
        console.error('\n❌ INSUFFICIENT BALANCE');
        console.error('   Need at least 0.2 MATIC for deployment');
        console.error(`   Current balance: ${balanceFormatted} MATIC`);
        process.exit(1);
    }

    // Network info
    const network = await hre.ethers.provider.getNetwork();
    console.log('🌐 Network:', hre.network.name);
    console.log('🔗 Chain ID:', network.chainId.toString());
    console.log('📊 Block Number:', await hre.ethers.provider.getBlockNumber());

    console.log('\n⏳ Starting deployments...\n');
    console.log('─'.repeat(60));

    // Deploy contracts
    const deployments = [];

    try {
        // 1. Real Estate
        const realEstate = await deployRealEstate(deployer);
        deployments.push(realEstate);

        // Wait 10 seconds between deployments
        console.log('\n⏸️  Waiting 10 seconds before next deployment...');
        await new Promise(resolve => setTimeout(resolve, 10000));

        // 2. Logistics
        const logistics = await deployLogistics(deployer);
        deployments.push(logistics);

    } catch (error) {
        console.error('\n❌ Deployment failed:', error.message);
        throw error;
    }

    console.log('\n' + '─'.repeat(60));
    console.log('✅ ALL CONTRACTS DEPLOYED SUCCESSFULLY');
    console.log('─'.repeat(60));

    // Summary
    console.log('\n📋 DEPLOYMENT SUMMARY:');
    console.log('═══════════════════════════════════════════════════════════');
    deployments.forEach(({ name, address }) => {
        console.log(`\n${name}:`);
        console.log(`   Address: ${address}`);
        console.log(`   PolygonScan: https://polygonscan.com/address/${address}`);
    });
    console.log('\n═══════════════════════════════════════════════════════════');

    // Save deployment file
    const deploymentData = {
        network: hre.network.name,
        chainId: network.chainId.toString(),
        deployedAt: new Date().toISOString(),
        deployer: deployer.address,
        blockNumber: await hre.ethers.provider.getBlockNumber(),
        contracts: deployments.map(({ name, address }) => ({ name, address }))
    };

    const deploymentsDir = path.join(__dirname, '../deployments');
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const filename = `rwa-contracts-${hre.network.name}-${Date.now()}.json`;
    const filepath = path.join(deploymentsDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(deploymentData, null, 2));

    console.log(`\n💾 Deployment data saved to: deployments/${filename}`);

    // .env update instructions
    console.log('\n📝 UPDATE YOUR .env FILE:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`REALESTATE_CONTRACT_ADDRESS="${deployments[0].address}"`);
    console.log(`LOGISTICS_CONTRACT_ADDRESS="${deployments[1].address}"`);
    console.log('═══════════════════════════════════════════════════════════');

    // Verification commands
    console.log('\n🔍 VERIFY CONTRACTS ON POLYGONSCAN:');
    console.log('═══════════════════════════════════════════════════════════');
    deployments.forEach(({ name, address }) => {
        console.log(`npx hardhat verify --network ${hre.network.name} ${address}`);
    });
    console.log('═══════════════════════════════════════════════════════════');

    // Next steps
    console.log('\n✨ NEXT STEPS:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('1. Copy the addresses above to your .env file');
    console.log('2. Run the verification commands');
    console.log('3. Restart your backend server:');
    console.log('   pnpm run start:backend');
    console.log('4. Test the contracts:');
    console.log('   node scripts/test-rwa-contracts.js');
    console.log('═══════════════════════════════════════════════════════════');

    console.log('\n🎉 DEPLOYMENT COMPLETE!\n');

    return deploymentData;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('\n❌ DEPLOYMENT FAILED:', error);
        process.exit(1);
    });
