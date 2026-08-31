const hre = require("hardhat");
const fs = require("fs");

/**
 * Deploy Marketplace NFT en Polygon Mainnet
 * 
 * Características:
 * - Compra/Venta de NFTs con BEZ-Coin
 * - Comisión configurable para la plataforma
 * - Royalties para creadores
 * - Ofertas y subastas
 */

async function main() {
    console.log("\n🚀 Desplegando Marketplace NFT en Polygon Mainnet...");
    console.log("⚠️  RED DE PRODUCCIÓN - Las transacciones son irreversibles");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deployer:", deployer.address);

    // Verificar balance
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Balance:", hre.ethers.formatEther(balance), "MATIC");

    if (balance < hre.ethers.parseEther("0.2")) {
        throw new Error("❌ Balance insuficiente. Necesitas al menos 0.2 MATIC para el despliegue.");
    }

    // Dirección del contrato BEZ-Coin en Polygon Mainnet
    const bezCoinAddress = process.env.BEZCOIN_CONTRACT_ADDRESS || "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8";
    console.log("BEZ-Coin Contract:", bezCoinAddress);

    // Configuración del Marketplace
    const platformFee = 250; // 2.5% (en basis points, 10000 = 100%)
    const platformFeeRecipient = deployer.address;

    console.log("\n📋 Configuración:");
    console.log("Platform Fee:", platformFee / 100, "%");
    console.log("Fee Recipient:", platformFeeRecipient);

    // Deploy Marketplace
    console.log("\n⏳ Desplegando Marketplace...");
    const Marketplace = await hre.ethers.getContractFactory("NFTMarketplace");
    const marketplace = await Marketplace.deploy(
        bezCoinAddress,
        platformFee,
        platformFeeRecipient
    );

    await marketplace.waitForDeployment();
    const marketplaceAddress = await marketplace.getAddress();

    console.log("✅ Marketplace desplegado en:", marketplaceAddress);

    // Guardar direcciones
    const deployment = {
        network: "polygon-mainnet",
        chainId: 137,
        timestamp: new Date().toISOString(),
        deployer: deployer.address,
        contracts: {
            marketplace: marketplaceAddress,
            bezCoin: bezCoinAddress
        },
        configuration: {
            platformFee: platformFee,
            platformFeePercent: platformFee / 100,
            feeRecipient: platformFeeRecipient
        }
    };

    const deploymentsDir = "./deployments";
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    fs.writeFileSync(
        `${deploymentsDir}/marketplace-polygon-mainnet.json`,
        JSON.stringify(deployment, null, 2)
    );

    console.log("\n📝 Deployment info guardada en: deployments/marketplace-polygon-mainnet.json");

    // Instrucciones de verificación
    console.log("\n🔍 Para verificar el contrato en PolygonScan:");
    console.log(`npx hardhat verify --network polygon ${marketplaceAddress} ${bezCoinAddress} ${platformFee} ${platformFeeRecipient}`);

    // Próximos pasos
    console.log("\n✨ Próximos pasos:");
    console.log("1. Verificar contrato en PolygonScan");
    console.log("2. Actualizar VITE_MARKETPLACE_ADDRESS en frontend/.env");
    console.log("3. Actualizar MARKETPLACE_CONTRACT_ADDRESS en backend/.env");
    console.log("4. Reiniciar backend y frontend");
    console.log("5. Probar creación y compra de NFTs");

    return deployment;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Error:", error);
        process.exit(1);
    });
