const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
    console.log("🚀 Iniciando despliegue de NFTRental...\n");

    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log("📝 Desplegando con la cuenta:", deployer.address);

    // Get deployer balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("💰 Balance de la cuenta:", ethers.formatEther(balance), "MATIC\n");

    // Get BEZ token address from environment or config
    const BEZ_TOKEN_ADDRESS = process.env.BEZ_TOKEN_ADDRESS || "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8";
    console.log("🪙 Dirección del BEZ Token:", BEZ_TOKEN_ADDRESS);

    // Deploy NFTRental contract
    console.log("\n📦 Desplegando contrato NFTRental...");
    const NFTRental = await ethers.getContractFactory("NFTRental");
    const nftRental = await NFTRental.deploy(BEZ_TOKEN_ADDRESS);

    await nftRental.waitForDeployment();
    const nftRentalAddress = await nftRental.getAddress();

    console.log("✅ NFTRental desplegado en:", nftRentalAddress);

    // Get BezhasNFT address (if exists)
    let bezhasNFTAddress = process.env.BEZHAS_NFT_ADDRESS;

    // Configure fee recipient (deployer by default)
    console.log("\n⚙️ Configurando parámetros iniciales...");

    const feeRecipient = process.env.FEE_RECIPIENT || deployer.address;
    console.log("👤 Fee Recipient:", feeRecipient);

    // If BezhasNFT exists, allow it
    if (bezhasNFTAddress) {
        console.log("\n🎨 Permitiendo BezhasNFT:", bezhasNFTAddress);
        const allowTx = await nftRental.allowNFTContract(bezhasNFTAddress, true);
        await allowTx.wait();
        console.log("✅ BezhasNFT permitido");
    }

    // Save deployment info
    const deploymentInfo = {
        network: (await ethers.provider.getNetwork()).name,
        chainId: (await ethers.provider.getNetwork()).chainId.toString(),
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {
            NFTRental: {
                address: nftRentalAddress,
                bezToken: BEZ_TOKEN_ADDRESS,
                feeRecipient: feeRecipient,
                allowedNFTs: bezhasNFTAddress ? [bezhasNFTAddress] : []
            }
        },
        gasUsed: {
            deployment: "Estimated ~2.5M gas"
        }
    };

    // Save to config file
    const configPath = path.join(__dirname, '../config/deployments.json');
    const configDir = path.dirname(configPath);

    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }

    let existingConfig = {};
    if (fs.existsSync(configPath)) {
        existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }

    existingConfig.NFTRental = deploymentInfo;
    fs.writeFileSync(configPath, JSON.stringify(existingConfig, null, 2));

    console.log("\n💾 Información de despliegue guardada en:", configPath);

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("📋 RESUMEN DEL DESPLIEGUE");
    console.log("=".repeat(60));
    console.log("Contrato NFTRental:", nftRentalAddress);
    console.log("BEZ Token:", BEZ_TOKEN_ADDRESS);
    console.log("Fee Recipient:", feeRecipient);
    if (bezhasNFTAddress) {
        console.log("NFTs Permitidos:", bezhasNFTAddress);
    }
    console.log("=".repeat(60));

    // Verification instructions
    console.log("\n📝 Para verificar el contrato en PolygonScan:");
    console.log(`npx hardhat verify --network polygon ${nftRentalAddress} ${BEZ_TOKEN_ADDRESS}`);

    console.log("\n✨ ¡Despliegue completado exitosamente!");

    // Return deployment info for testing
    return {
        nftRentalAddress,
        bezTokenAddress: BEZ_TOKEN_ADDRESS,
        feeRecipient
    };
}

// Execute deployment
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("❌ Error en el despliegue:", error);
            process.exit(1);
        });
}

module.exports = main;
