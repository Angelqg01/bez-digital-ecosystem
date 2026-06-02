/**
 * Deploy All Core Contracts to Amoy Testnet
 * Despliega ContentValidator y otros contratos core para testing
 */

const { ethers } = require('hardhat');
const fs = require('fs').promises;
const path = require('path');

// Configuración de contratos a desplegar
const CONTRACTS_CONFIG = {
    contentValidator: {
        enabled: true,
        params: {
            bezCoinFee: ethers.parseUnits('10', 18), // 10 BEZ
            nativeFee: ethers.parseEther('0.01') // 0.01 MATIC
        }
    },
    rewardsCalculator: {
        enabled: true,
        params: {
            baseReward: ethers.parseUnits('1', 18) // 1 BEZ base reward
        }
    }
};

async function main() {
    console.log('🚀 Deploying BeZhas Core Contracts to Amoy Testnet\n');
    console.log('='.repeat(80));
    console.log('');

    // 1. Setup deployer
    const [deployer] = await ethers.getSigners();
    console.log('📝 Deployer:', deployer.address);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log('💰 Balance:', ethers.formatEther(balance), 'MATIC');
    console.log('');

    // Verificar balance mínimo
    if (balance < ethers.parseEther('0.5')) {
        console.log('⚠️  WARNING: Low balance. Recommended: 0.5 MATIC minimum');
        console.log('   Get test MATIC: https://faucet.polygon.technology/');
        console.log('');
    }

    // 2. Configurar direcciones base
    const BEZHAS_TOKEN_ADDRESS = process.env.BEZHAS_TOKEN_ADDRESS || ethers.ZeroAddress;
    const TREASURY_WALLET = process.env.TREASURY_WALLET || deployer.address;

    console.log('📦 Configuration:');
    console.log('   Network: Polygon Amoy (ChainID 80002)');
    console.log('   BEZ Token:', BEZHAS_TOKEN_ADDRESS);
    console.log('   Treasury:', TREASURY_WALLET);
    console.log('');

    const deploymentInfo = {
        network: 'polygon-amoy',
        chainId: 80002,
        timestamp: new Date().toISOString(),
        deployer: deployer.address,
        contracts: {}
    };

    // 3. Deploy ContentValidator
    if (CONTRACTS_CONFIG.contentValidator.enabled) {
        console.log('='.repeat(80));
        console.log('1️⃣  Deploying ContentValidator...');
        console.log('='.repeat(80));

        try {
            const ContentValidator = await ethers.getContractFactory('ContentValidator');
            const contentValidator = await ContentValidator.deploy(
                BEZHAS_TOKEN_ADDRESS,
                CONTRACTS_CONFIG.contentValidator.params.bezCoinFee,
                CONTRACTS_CONFIG.contentValidator.params.nativeFee,
                TREASURY_WALLET
            );

            await contentValidator.waitForDeployment();
            const address = await contentValidator.getAddress();

            // Autorizar deployer como validador
            console.log('   🔐 Authorizing backend validator...');
            const authTx = await contentValidator.setAuthorizedValidator(deployer.address, true);
            await authTx.wait();

            console.log('✅ ContentValidator deployed:', address);
            console.log('   BezCoin Fee:', ethers.formatUnits(CONTRACTS_CONFIG.contentValidator.params.bezCoinFee, 18), 'BEZ');
            console.log('   Native Fee:', ethers.formatEther(CONTRACTS_CONFIG.contentValidator.params.nativeFee), 'MATIC');
            console.log('   Backend Authorized: ✓');
            console.log('');

            deploymentInfo.contracts.contentValidator = {
                address,
                bezCoinFee: CONTRACTS_CONFIG.contentValidator.params.bezCoinFee.toString(),
                nativeFee: CONTRACTS_CONFIG.contentValidator.params.nativeFee.toString(),
                treasury: TREASURY_WALLET
            };
        } catch (error) {
            console.error('❌ Failed to deploy ContentValidator:', error.message);
            throw error;
        }
    }

    // 4. Deploy RewardsCalculator (si está habilitado)
    if (CONTRACTS_CONFIG.rewardsCalculator.enabled) {
        console.log('='.repeat(80));
        console.log('2️⃣  Deploying RewardsCalculator...');
        console.log('='.repeat(80));

        try {
            const RewardsCalculator = await ethers.getContractFactory('BeZhasRewardsCalculator');
            const rewardsCalculator = await RewardsCalculator.deploy(BEZHAS_TOKEN_ADDRESS);

            await rewardsCalculator.waitForDeployment();
            const address = await rewardsCalculator.getAddress();

            console.log('✅ RewardsCalculator deployed:', address);
            console.log('   Base Reward:', ethers.formatUnits(CONTRACTS_CONFIG.rewardsCalculator.params.baseReward, 18), 'BEZ');
            console.log('');

            deploymentInfo.contracts.rewardsCalculator = {
                address,
                baseReward: CONTRACTS_CONFIG.rewardsCalculator.params.baseReward.toString()
            };
        } catch (error) {
            console.error('❌ Failed to deploy RewardsCalculator:', error.message);
            throw error;
        }
    }

    // 5. Guardar deployment info
    console.log('='.repeat(80));
    console.log('3️⃣  Saving Deployment Info...');
    console.log('='.repeat(80));

    const deploymentsDir = path.join(__dirname, '..', 'deployments');
    await fs.mkdir(deploymentsDir, { recursive: true });

    const timestamp = Date.now();
    const filename = `amoy-${timestamp}.json`;
    const filepath = path.join(deploymentsDir, filename);

    await fs.writeFile(filepath, JSON.stringify(deploymentInfo, null, 2));
    console.log('✅ Deployment saved:', filename);
    console.log('');

    // También guardar como "latest"
    const latestPath = path.join(deploymentsDir, 'amoy-latest.json');
    await fs.writeFile(latestPath, JSON.stringify(deploymentInfo, null, 2));
    console.log('✅ Latest deployment updated: amoy-latest.json');
    console.log('');

    // 6. Actualizar .env (generar instrucciones)
    console.log('='.repeat(80));
    console.log('4️⃣  Environment Variables Update');
    console.log('='.repeat(80));
    console.log('');
    console.log('Add these to your backend/.env file:');
    console.log('');
    console.log(`CONTENT_VALIDATOR_ADDRESS=${deploymentInfo.contracts.contentValidator?.address || 'N/A'}`);
    console.log(`REWARDS_CALCULATOR_ADDRESS=${deploymentInfo.contracts.rewardsCalculator?.address || 'N/A'}`);
    console.log(`POLYGON_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_API_KEY`);
    console.log(`CHAIN_ID=80002`);
    console.log('');

    // 7. Resumen final
    console.log('='.repeat(80));
    console.log('🎉 DEPLOYMENT COMPLETE!');
    console.log('='.repeat(80));
    console.log('');
    console.log('📋 Summary:');
    console.log('   Network: Polygon Amoy (Testnet)');
    console.log('   ChainID: 80002');
    console.log('   Deployer:', deployer.address);
    console.log('');
    console.log('📦 Deployed Contracts:');

    Object.entries(deploymentInfo.contracts).forEach(([name, info]) => {
        console.log(`   ${name}:`, info.address);
    });

    console.log('');
    console.log('🔗 Verify contracts:');
    Object.entries(deploymentInfo.contracts).forEach(([name, info]) => {
        console.log(`   https://amoy.polygonscan.com/address/${info.address}`);
    });

    console.log('');
    console.log('📝 Next Steps:');
    console.log('   1. Update backend/.env with contract addresses');
    console.log('   2. Run: node tests/validation-endpoints.test.js');
    console.log('   3. Test validation flow in frontend');
    console.log('   4. (Optional) Verify contracts on PolygonScan:');
    console.log('      npx hardhat verify --network amoy <CONTRACT_ADDRESS>');
    console.log('');
    console.log('='.repeat(80));
}

// Manejo de errores
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('\n❌ Deployment Failed:');
        console.error(error);
        process.exit(1);
    });
