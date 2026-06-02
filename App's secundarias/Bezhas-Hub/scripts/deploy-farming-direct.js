const { ethers } = require("ethers");
const fs = require("fs");
require("dotenv").config();

/**
 * Script de despliegue directo - Liquidity Farming System
 * Network: Polygon Mainnet
 * Ethers: v5
 */

// Dirección del token de recompensa (BEZ-Coin)
const REWARD_TOKEN = "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8";

// Artifact
const farmingArtifact = require("../artifacts/contracts/LiquidityFarming.sol/LiquidityFarming.json");

async function main() {
    console.log("\n🌾 Desplegando Liquidity Farming System (Polygon Mainnet)...");
    console.log("⚠️  RED DE PRODUCCIÓN");

    // Setup
    const rpcUrl = process.env.POLYGON_MAINNET_RPC || process.env.POLYGON_RPC_URL || "https://polygon-bor.publicnode.com";
    console.log("📡 RPC:", rpcUrl);

    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) throw new Error("❌ PRIVATE_KEY missing");

    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log("📝 Deployer:", wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log("💰 Balance:", ethers.utils.formatEther(balance), "MATIC");

    // Gas Config
    const overrides = {
        maxPriorityFeePerGas: ethers.utils.parseUnits("35", "gwei"),
        maxFeePerGas: ethers.utils.parseUnits("300", "gwei"),
    };
    console.log("⛽ Gas: 35 Gwei priority, 300 Gwei max\n");

    // Parámetros del contrato
    const currentBlock = await provider.getBlockNumber();
    const REWARD_PER_BLOCK = ethers.utils.parseEther("0.1"); // 0.1 BEZ por bloque
    const START_BLOCK = currentBlock + 100; // Empezar en 100 bloques
    const BLOCKS_PER_YEAR = 365 * 24 * 60 * 30; // ~2 seg/bloque en Polygon
    const BONUS_END_BLOCK = START_BLOCK + BLOCKS_PER_YEAR; // 1 año de bonus

    console.log("📋 Configuración:");
    console.log("   Reward Token:", REWARD_TOKEN);
    console.log("   Reward per Block:", ethers.utils.formatEther(REWARD_PER_BLOCK), "BEZ");
    console.log("   Start Block:", START_BLOCK);
    console.log("   Bonus End Block:", BONUS_END_BLOCK);
    console.log("   Current Block:", currentBlock, "\n");

    // Deploy
    console.log("📦 Desplegando LiquidityFarming...");
    const FarmingFactory = new ethers.ContractFactory(
        farmingArtifact.abi,
        farmingArtifact.bytecode,
        wallet
    );

    const farming = await FarmingFactory.deploy(
        REWARD_TOKEN,
        REWARD_PER_BLOCK,
        START_BLOCK,
        BONUS_END_BLOCK,
        overrides
    );

    console.log("   Tx Hash:", farming.deployTransaction.hash);
    await farming.deployed();
    console.log("✅ LiquidityFarming Address:", farming.address);

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("🎉 LIQUIDITY FARMING DEPLOYED!");
    console.log("=".repeat(60));
    console.log("\nContract Address:", farming.address);
    console.log("\n📝 Variables de entorno:\n");
    console.log("# Backend .env");
    console.log(`LIQUIDITY_FARMING_ADDRESS=${farming.address}`);
    console.log("\n# Frontend .env");
    console.log(`VITE_LIQUIDITY_FARMING_ADDRESS=${farming.address}`);
    console.log("\n" + "=".repeat(60));

    // Save deployment data
    const deploymentData = {
        network: "polygon",
        chainId: 137,
        timestamp: new Date().toISOString(),
        deployer: wallet.address,
        contracts: {
            liquidityFarming: {
                address: farming.address,
                txHash: farming.deployTransaction.hash,
                params: {
                    rewardToken: REWARD_TOKEN,
                    rewardPerBlock: REWARD_PER_BLOCK.toString(),
                    startBlock: START_BLOCK,
                    bonusEndBlock: BONUS_END_BLOCK
                }
            }
        }
    };

    fs.writeFileSync("liquidity-farming-deployment.json", JSON.stringify(deploymentData, null, 2));
    console.log("✅ Deployment data saved to: liquidity-farming-deployment.json\n");

    console.log("📝 Próximos pasos:");
    console.log("1. Fondear el contrato con tokens de recompensa (BEZ)");
    console.log("2. Agregar pools con: farming.add(allocPoint, lpToken, minStake, maxStake, true)");
    console.log("3. Configurar multiplicadores de lock si es necesario\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ ERROR:", error);
        process.exit(1);
    });
