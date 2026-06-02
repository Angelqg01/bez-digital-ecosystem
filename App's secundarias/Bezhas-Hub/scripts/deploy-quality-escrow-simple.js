const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

// ⚠️ USAR CONTRATO BEZ OFICIAL
const OFFICIAL_BEZ_CONTRACT = "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8";

async function main() {
    console.log("\n🚀 Desplegando Quality Oracle a Polygon Amoy...\n");
    console.log("📋 Usando BEZ Token Oficial:", OFFICIAL_BEZ_CONTRACT);

    const [deployer] = await hre.ethers.getSigners();
    console.log("👤 Deployer:", deployer.address);

    // Verificar balance
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("💰 Balance:", hre.ethers.formatEther(balance), "MATIC\n");

    if (balance === 0n) {
        console.log("❌ ERROR: No tienes MATIC para gas!");
        console.log("   Obtén MATIC gratis: https://faucet.polygon.technology/");
        process.exit(1);
    }

    // Deploy BeZhasQualityEscrow
    console.log("📦 Desplegando BeZhasQualityEscrow...");
    const QualityEscrow = await hre.ethers.getContractFactory("BeZhasQualityEscrow");
    const escrow = await QualityEscrow.deploy(OFFICIAL_BEZ_CONTRACT, deployer.address);

    console.log("⏳ Esperando confirmación...");
    await escrow.waitForDeployment();
    const escrowAddress = await escrow.getAddress();

    console.log("\n✅ Quality Escrow desplegado!");
    console.log("   Address:", escrowAddress);
    console.log("   Explorer:", `https://amoy.polygonscan.com/address/${escrowAddress}`);

    // Guardar en archivo
    const deploymentInfo = {
        network: hre.network.name,
        chainId: 80002,
        timestamp: new Date().toISOString(),
        deployer: deployer.address,
        contracts: {
            BeZhasQualityEscrow: escrowAddress,
            BezToken: OFFICIAL_BEZ_CONTRACT
        }
    };

    // Guardar en deployments/
    const deploymentsDir = path.join(__dirname, '../deployments');
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const deploymentFile = path.join(deploymentsDir, `quality-oracle-amoy-${Date.now()}.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    console.log("\n💾 Deployment guardado:", deploymentFile);

    // Actualizar .env
    console.log("\n📝 Agrega estas variables a tu .env:");
    console.log(`QUALITY_ESCROW_ADDRESS=${escrowAddress}`);
    console.log(`VITE_QUALITY_ESCROW_ADDRESS=${escrowAddress}`);

    console.log("\n✅ Deployment completado exitosamente!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error durante deployment:");
        console.error(error);
        process.exit(1);
    });
