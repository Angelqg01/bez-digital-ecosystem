const { ethers } = require('hardhat');
const fs = require('fs').promises;
const path = require('path');

/**
 * Script de Deploy - ContentValidator.sol
 * Deploy a Polygon Mumbai (testnet) o Polygon Mainnet
 */
async function main() {
    console.log('🚀 Starting ContentValidator deployment...\n');

    // Obtener signer
    const [deployer] = await ethers.getSigners();
    console.log('📝 Deploying with account:', deployer.address);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log('💰 Account balance:', ethers.formatEther(balance), 'MATIC\n');

    // Verificar balance mínimo
    if (balance < ethers.parseEther('0.1')) {
        throw new Error('❌ Insufficient balance. Need at least 0.1 MATIC for deployment');
    }

    // Obtener direcciones de contratos existentes
    const BEZHAS_TOKEN_ADDRESS = process.env.BEZHAS_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000000';
    const TREASURY_WALLET = process.env.TREASURY_WALLET || deployer.address;

    console.log('📦 Contract Configuration:');
    console.log('   BezCoin Token Address:', BEZHAS_TOKEN_ADDRESS);
    console.log('   Treasury Wallet:', TREASURY_WALLET);
    console.log('   Backend Validator:', deployer.address);
    console.log('');

    // Tarifas iniciales
    const INITIAL_BEZCOIN_FEE = ethers.parseUnits('10', 18); // 10 BezCoin
    const INITIAL_NATIVE_FEE = ethers.parseEther('0.01'); // 0.01 MATIC

    console.log('💵 Initial Validation Fees:');
    console.log('   BezCoin Fee:', ethers.formatUnits(INITIAL_BEZCOIN_FEE, 18), 'BEZ');
    console.log('   Native Fee:', ethers.formatEther(INITIAL_NATIVE_FEE), 'MATIC');
    console.log('');

    // Deploy ContentValidator
    console.log('🔨 Deploying ContentValidator...');
    const ContentValidator = await ethers.getContractFactory('ContentValidator');

    const contentValidator = await ContentValidator.deploy(
        BEZHAS_TOKEN_ADDRESS,
        INITIAL_BEZCOIN_FEE,
        INITIAL_NATIVE_FEE,
        TREASURY_WALLET
    );

    await contentValidator.waitForDeployment();
    const contractAddress = await contentValidator.getAddress();

    console.log('✅ ContentValidator deployed to:', contractAddress);
    console.log('');

    // Autorizar backend wallet como validador
    console.log('🔐 Authorizing backend wallet as validator...');
    const authTx = await contentValidator.setAuthorizedValidator(deployer.address, true);
    await authTx.wait();
    console.log('✅ Backend wallet authorized');
    console.log('');

    // Verificar configuración
    console.log('🔍 Verifying deployment...');
    const bezCoinFee = await contentValidator.validationFeeBezCoin();
    const nativeFee = await contentValidator.validationFeeNative();
    const treasury = await contentValidator.treasuryWallet();
    const isAuthorized = await contentValidator.authorizedValidators(deployer.address);

    console.log('   BezCoin Fee:', ethers.formatUnits(bezCoinFee, 18), 'BEZ');
    console.log('   Native Fee:', ethers.formatEther(nativeFee), 'MATIC');
    console.log('   Treasury:', treasury);
    console.log('   Backend Authorized:', isAuthorized);
    console.log('');

    // Guardar información del deployment
    const deploymentInfo = {
        network: (await ethers.provider.getNetwork()).name,
        chainId: (await ethers.provider.getNetwork()).chainId.toString(),
        contractAddress: contractAddress,
        deployer: deployer.address,
        bezCoinTokenAddress: BEZHAS_TOKEN_ADDRESS,
        treasuryWallet: TREASURY_WALLET,
        initialBezCoinFee: ethers.formatUnits(INITIAL_BEZCOIN_FEE, 18),
        initialNativeFee: ethers.formatEther(INITIAL_NATIVE_FEE),
        deploymentDate: new Date().toISOString(),
        blockNumber: await ethers.provider.getBlockNumber()
    };

    // Guardar en archivo JSON
    const outputPath = path.join(__dirname, '../backend/contract-addresses.json');
    let existingAddresses = {};

    try {
        const existingData = await fs.readFile(outputPath, 'utf8');
        existingAddresses = JSON.parse(existingData);
    } catch (error) {
        // Archivo no existe, crear nuevo
    }

    existingAddresses.ContentValidator = deploymentInfo;

    await fs.writeFile(
        outputPath,
        JSON.stringify(existingAddresses, null, 2),
        'utf8'
    );

    console.log('💾 Deployment info saved to:', outputPath);
    console.log('');

    // Guardar ABI para frontend
    const artifactPath = path.join(__dirname, '../artifacts/contracts/ContentValidator.sol/ContentValidator.json');
    const artifact = JSON.parse(await fs.readFile(artifactPath, 'utf8'));

    const frontendAbiPath = path.join(__dirname, '../frontend/src/contracts/ContentValidator.json');
    await fs.writeFile(
        frontendAbiPath,
        JSON.stringify({ abi: artifact.abi }, null, 2),
        'utf8'
    );

    console.log('💾 ABI saved to:', frontendAbiPath);
    console.log('');

    // Actualizar config.js del frontend
    const configPath = path.join(__dirname, '../frontend/src/contracts/config.js');
    let configContent = '';

    try {
        configContent = await fs.readFile(configPath, 'utf8');
    } catch (error) {
        configContent = 'export const CONTRACT_ADDRESSES = {};\n';
    }

    // Actualizar dirección del ContentValidator
    const newConfigContent = configContent.replace(
        /CONTENT_VALIDATOR_ADDRESS:\s*['"][^'"]*['"]/,
        `CONTENT_VALIDATOR_ADDRESS: '${contractAddress}'`
    );

    if (newConfigContent === configContent) {
        // No se encontró la línea, añadir
        configContent += `\nexport const CONTENT_VALIDATOR_ADDRESS = '${contractAddress}';\n`;
    } else {
        configContent = newConfigContent;
    }

    await fs.writeFile(configPath, configContent, 'utf8');
    console.log('💾 Frontend config updated:', configPath);
    console.log('');

    // Instrucciones finales
    console.log('✅ DEPLOYMENT COMPLETE!\n');
    console.log('📋 Next Steps:');
    console.log('   1. Verify contract on PolygonScan:');
    console.log(`      npx hardhat verify --network ${(await ethers.provider.getNetwork()).name} ${contractAddress} "${BEZHAS_TOKEN_ADDRESS}" "${INITIAL_BEZCOIN_FEE}" "${INITIAL_NATIVE_FEE}" "${TREASURY_WALLET}"`);
    console.log('');
    console.log('   2. Update backend .env with:');
    console.log(`      CONTENT_VALIDATOR_ADDRESS=${contractAddress}`);
    console.log(`      BACKEND_PRIVATE_KEY=<your-backend-wallet-private-key>`);
    console.log('');
    console.log('   3. Fund backend wallet with MATIC for gas:');
    console.log(`      Send 0.5 MATIC to ${deployer.address}`);
    console.log('');
    console.log('   4. Restart backend services to start listening for events');
    console.log('');

    return {
        contractAddress,
        deploymentInfo
    };
}

// Ejecutar script
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Deployment failed:', error);
        process.exit(1);
    });
