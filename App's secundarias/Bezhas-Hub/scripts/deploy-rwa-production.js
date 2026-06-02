const hre = require("hardhat");
const { ethers } = require("hardhat");

/**
 * Deploy BeZhas RWA Factory and Vault System (Production)
 * Network: Polygon Mainnet
 * BEZ-Coin: 0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
 */
async function main() {
    console.log("🚀 Desplegando Sistema RWA (Producción) en Polygon...\n");
    console.log("⚠️  RED DE PRODUCCIÓN - Costos reales activados");

    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Balance:", ethers.formatEther(balance), "MATIC\n");

    // Configuración de Gas
    const overrides = {
        maxPriorityFeePerGas: ethers.parseUnits("35", "gwei"),
        maxFeePerGas: ethers.parseUnits("300", "gwei"),
    };
    console.log("⛽ Gas Config:", {
        priority: "35 Gwei",
        max: "300 Gwei"
    });

    const BEZ_COIN_ADDRESS = "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8";

    // 1. Deploy RWA Factory
    console.log("\n📦 Deploying BeZhasRWAFactory...");
    const RWAFactory = await ethers.getContractFactory("BeZhasRWAFactory");
    const rwaFactory = await RWAFactory.deploy(overrides);
    await rwaFactory.waitForDeployment();
    const factoryAddress = await rwaFactory.getAddress();
    console.log("✅ BeZhasRWAFactory deployed to:", factoryAddress);

    // 2. Deploy Vault
    console.log("\n📦 Deploying BeZhasVault...");
    const Vault = await ethers.getContractFactory("BeZhasVault");

    // El constructor de Vault requiere (bezCoinAddress, rwaFactoryAddress)
    const vault = await Vault.deploy(BEZ_COIN_ADDRESS, factoryAddress, overrides);
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    console.log("✅ BeZhasVault deployed to:", vaultAddress);

    // 3. Configuration (Si es necesario)
    // Nota: Evitamos transacciones extra si no son críticas para ahorrar gas inicial

    console.log("\n🎉 RWA SYSTEM DEPLOYED SUCCESSFULLY!");
    console.log("---------------------------------------");
    console.log(`RWA_FACTORY_ADDRESS=${factoryAddress}`);
    console.log(`RWA_VAULT_ADDRESS=${vaultAddress}`);
    console.log("---------------------------------------");

    console.log("\n📝 Verificando configuración...");
    try {
        const setFee = await rwaFactory.tokenizationFee();
        console.log("   Fee Actual:", ethers.formatEther(setFee), "BEZ");
    } catch (e) {
        console.log("   (Skipping read check due to potential RPC timeout)");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ ERROR:", error);
        process.exitCode = 1;
    });
