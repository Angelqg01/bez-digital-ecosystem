const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

/**
 * Script de despliegue directo usando ethers.js v5 (Bypass Hardhat Runtime)
 * Para RWA System en Polygon Mainnet
 */

// Direcciones conocidas
const BEZ_COIN_ADDRESS = "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8";

// Artifacts
const factoryArtifact = require("../artifacts/contracts/BeZhasRWAFactory.sol/BeZhasRWAFactory.json");
const vaultArtifact = require("../artifacts/contracts/BeZhasVault.sol/BeZhasVault.json");

async function main() {
    console.log("\n🚀 Desplegando BeZhas RWA System (Direct V5)...");
    console.log("⚠️  RED DE PRODUCCIÓN - Polygon Mainnet");

    // Configurar provider
    const rpcUrl = process.env.POLYGON_MAINNET_RPC || process.env.POLYGON_RPC_URL || "https://polygon-bor.publicnode.com";
    console.log("📡 Conectando a RPC:", rpcUrl);

    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) throw new Error("❌ PRIVATE_KEY missing");

    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log("📝 Deployer:", wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log("💰 Balance:", ethers.utils.formatEther(balance), "MATIC");

    // Configuración de Gas manual (Ethers v5 style)
    const overrides = {
        maxPriorityFeePerGas: ethers.utils.parseUnits("35", "gwei"),
        maxFeePerGas: ethers.utils.parseUnits("300", "gwei"),
    };

    // 1. Deploy Factory
    console.log("\n📦 Desplegando BeZhasRWAFactory...");
    const FactoryFactory = new ethers.ContractFactory(factoryArtifact.abi, factoryArtifact.bytecode, wallet);
    const factory = await FactoryFactory.deploy(overrides);
    console.log("   Hash:", factory.deployTransaction.hash);
    await factory.deployed();
    console.log("✅ Factory Address:", factory.address);

    // 2. Deploy Vault
    console.log("\n📦 Desplegando BeZhasVault...");
    const VaultFactory = new ethers.ContractFactory(vaultArtifact.abi, vaultArtifact.bytecode, wallet);
    const vault = await VaultFactory.deploy(BEZ_COIN_ADDRESS, factory.address, overrides);
    console.log("   Hash:", vault.deployTransaction.hash);
    await vault.deployed();
    console.log("✅ Vault Address:", vault.address);

    console.log("\n🎉 DESPLIEGUE FINALIZADO!");
    console.log("-------------------------------------------");
    console.log(`RWA_FACTORY=${factory.address}`);
    console.log(`RWA_VAULT=${vault.address}`);
    console.log("-------------------------------------------");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
