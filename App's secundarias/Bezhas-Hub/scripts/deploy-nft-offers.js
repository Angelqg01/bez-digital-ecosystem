const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
    console.log("🚀 Iniciando despliegue de NFTOffers...\n");

    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log("📝 Desplegando con la cuenta:", deployer.address);

    // Get deployer balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("💰 Balance de la cuenta:", ethers.formatEther(balance), "MATIC\n");

    // Get BEZ token address from environment or config
    const BEZ_TOKEN_ADDRESS = process.env.BEZ_TOKEN_ADDRESS || "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8";
    console.log("🪙 Dirección del BEZ Token:", BEZ_TOKEN_ADDRESS);

    // Deploy NFTOffers contract
    console.log("\n📦 Desplegando contrato NFTOffers...");
    const NFTOffers = await ethers.getContractFactory("NFTOffers");
    const nftOffers = await NFTOffers.deploy(BEZ_TOKEN_ADDRESS);

    await nftOffers.waitForDeployment();
    const nftOffersAddress = await nftOffers.getAddress();

    console.log("✅ NFTOffers desplegado en:", nftOffersAddress);

    // Configure initial parameters
    console.log("\n⚙️ Configurando parámetros iniciales...");

    const feeRecipient = process.env.FEE_RECIPIENT || deployer.address;
    console.log("👤 Fee Recipient:", feeRecipient);

    // Set fee recipient if different from deployer
    if (feeRecipient !== deployer.address) {
        console.log("📝 Configurando Fee Recipient...");
        const setRecipientTx = await nftOffers.setProtocolFeeRecipient(feeRecipient);
        await setRecipientTx.wait();
        console.log("✅ Fee Recipient configurado");
    }

    // Get configuration
    const protocolFee = await nftOffers.protocolFee();
    const minOfferDuration = await nftOffers.minOfferDuration();
    const maxOfferDuration = await nftOffers.maxOfferDuration();

    console.log("\n📊 Configuración inicial:");
    console.log("- Protocol Fee:", (Number(protocolFee) / 100).toFixed(2) + "%");
    console.log("- Duración mínima ofertas:", (Number(minOfferDuration) / 86400), "días");
    console.log("- Duración máxima ofertas:", (Number(maxOfferDuration) / 86400), "días");

    // Get BezhasNFT address if exists
    let bezhasNFTAddress = process.env.BEZHAS_NFT_ADDRESS;

    if (bezhasNFTAddress) {
        console.log("\n🎨 BezhasNFT detectado:", bezhasNFTAddress);
    }

    // Save deployment info
    const deploymentInfo = {
        network: (await ethers.provider.getNetwork()).name,
        chainId: (await ethers.provider.getNetwork()).chainId.toString(),
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {
            NFTOffers: {
                address: nftOffersAddress,
                bezToken: BEZ_TOKEN_ADDRESS,
                feeRecipient: feeRecipient,
                config: {
                    protocolFee: Number(protocolFee),
                    minOfferDuration: Number(minOfferDuration),
                    maxOfferDuration: Number(maxOfferDuration)
                }
            }
        },
        gasUsed: {
            deployment: "Estimated ~3.5M gas"
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

    existingConfig.NFTOffers = deploymentInfo;
    fs.writeFileSync(configPath, JSON.stringify(existingConfig, null, 2));

    console.log("\n💾 Información de despliegue guardada en:", configPath);

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("📋 RESUMEN DEL DESPLIEGUE");
    console.log("=".repeat(60));
    console.log("Contrato NFTOffers:", nftOffersAddress);
    console.log("BEZ Token:", BEZ_TOKEN_ADDRESS);
    console.log("Fee Recipient:", feeRecipient);
    console.log("Protocol Fee:", (Number(protocolFee) / 100).toFixed(2) + "%");
    console.log("Duración ofertas:", (Number(minOfferDuration) / 86400), "-", (Number(maxOfferDuration) / 86400), "días");
    console.log("=".repeat(60));

    // Verification instructions
    console.log("\n📝 Para verificar el contrato en PolygonScan:");
    console.log(`npx hardhat verify --network polygon ${nftOffersAddress} ${BEZ_TOKEN_ADDRESS}`);

    // Usage examples
    console.log("\n💡 EJEMPLOS DE USO:");
    console.log("\n1. Crear una oferta:");
    console.log("   await nftOffers.createOffer(");
    console.log("     nftContractAddress,");
    console.log("     tokenId,");
    console.log("     ethers.parseEther('100'), // 100 BEZ");
    console.log("     7 * 24 * 60 * 60 // 7 días");
    console.log("   )");

    console.log("\n2. Crear contra-oferta:");
    console.log("   await nftOffers.createCounterOffer(");
    console.log("     offerId,");
    console.log("     ethers.parseEther('150') // 150 BEZ");
    console.log("   )");

    console.log("\n3. Aceptar oferta:");
    console.log("   await nftContract.approve(nftOffersAddress, tokenId)");
    console.log("   await nftOffers.acceptOffer(offerId)");

    console.log("\n✨ ¡Despliegue completado exitosamente!");

    // Return deployment info for testing
    return {
        nftOffersAddress,
        bezTokenAddress: BEZ_TOKEN_ADDRESS,
        feeRecipient,
        protocolFee: Number(protocolFee),
        minOfferDuration: Number(minOfferDuration),
        maxOfferDuration: Number(maxOfferDuration)
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
