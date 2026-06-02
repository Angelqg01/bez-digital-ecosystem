const { ethers } = require("ethers");
const fs = require("fs");
require("dotenv").config();

/**
 * Script de despliegue directo usando ethers.js puro
 * Para Quality Oracle en Polygon Mainnet
 */

const OFFICIAL_BEZ_CONTRACT = "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8";

// Cargar contrato compilado
const escrowArtifact = require("../backend/contracts/BeZhasQualityEscrow.json");
const ESCROW_ABI = escrowArtifact.abi;
const ESCROW_BYTECODE = escrowArtifact.bytecode;

async function main() {
    console.log("\n🚀 Desplegando BeZhas Quality Oracle System en Polygon Mainnet...");
    console.log("⚠️  RED DE PRODUCCIÓN - Las transacciones son irreversibles");

    // Configurar provider y wallet (usar RPC alternativo)
    const rpcUrl = process.env.POLYGON_MAINNET_RPC || process.env.POLYGON_RPC_URL || "https://polygon-rpc.com";
    console.log("📡 Conectando a RPC:", rpcUrl);
    const privateKey = process.env.PRIVATE_KEY;

    if (!privateKey) {
        throw new Error("❌ PRIVATE_KEY no configurada en .env");
    }

    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log("📝 Deployer:", wallet.address);

    // Verificar balance
    const balance = await provider.getBalance(wallet.address);
    const balanceMatic = ethers.utils.formatEther(balance);
    console.log("💰 Balance:", balanceMatic, "MATIC");

    if (parseFloat(balanceMatic) < 0.15) {
        throw new Error("❌ Balance insuficiente. Necesitas al menos 0.15 MATIC");
    }

    // Verificar BEZ-Coin
    console.log("\n1️⃣  Verificando BEZ-Coin oficial:", OFFICIAL_BEZ_CONTRACT);
    const bezCoinAbi = [
        "function name() view returns (string)",
        "function symbol() view returns (string)",
        "function totalSupply() view returns (uint256)"
    ];
    const bezCoin = new ethers.Contract(OFFICIAL_BEZ_CONTRACT, bezCoinAbi, provider);

    try {
        const name = await bezCoin.name();
        const symbol = await bezCoin.symbol();
        const totalSupply = await bezCoin.totalSupply();
        console.log(`✅ BEZ-Coin verificado: ${name} (${symbol})`);
        console.log(`   Total Supply: ${ethers.utils.formatEther(totalSupply)} BEZ`);
    } catch (error) {
        throw new Error("❌ No se pudo conectar al contrato BEZ-Coin: " + error.message);
    }

    // Desplegar Quality Escrow
    console.log("\n2️⃣  Desplegando BeZhasQualityEscrow...");

    // Crear factory del contrato
    const EscrowFactory = new ethers.ContractFactory(
        ESCROW_ABI,
        ESCROW_BYTECODE,
        wallet
    );

    // Desplegar con parámetros (gas optimizado para Polygon Mainnet)
    // Polygon requiere altos valores de priority fee (gas tip)
    const overrides = {
        gasLimit: 2000000,
        maxPriorityFeePerGas: ethers.utils.parseUnits("35", "gwei"),
        maxFeePerGas: ethers.utils.parseUnits("250", "gwei"),
    };

    console.log(`⛽ Configuración de Gas: Priority=${ethers.utils.formatUnits(overrides.maxPriorityFeePerGas, "gwei")} Gwei, MaxFee=${ethers.utils.formatUnits(overrides.maxFeePerGas, "gwei")} Gwei`);

    const escrow = await EscrowFactory.deploy(
        OFFICIAL_BEZ_CONTRACT,
        wallet.address,
        overrides
    );

    console.log("⏳ Esperando confirmación...");
    await escrow.deployed();

    const escrowAddress = escrow.address;
    console.log("✅ QualityEscrow desplegado en:", escrowAddress);

    // Guardar información de despliegue
    const deployment = {
        network: "polygon-mainnet",
        chainId: 137,
        timestamp: new Date().toISOString(),
        deployer: wallet.address,
        contracts: {
            bezCoin: OFFICIAL_BEZ_CONTRACT,
            qualityEscrow: escrowAddress
        },
        transactionHash: escrow.deployTransaction.hash
    };

    const deploymentsDir = "./deployments";
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    fs.writeFileSync(
        `${deploymentsDir}/quality-oracle-polygon-mainnet.json`,
        JSON.stringify(deployment, null, 2)
    );

    console.log("\n" + "=".repeat(80));
    console.log("🎉 DESPLIEGUE COMPLETO!");
    console.log("=".repeat(80));
    console.log("\n📋 Contract Addresses:");
    console.log("├─ BezCoin (Oficial):", OFFICIAL_BEZ_CONTRACT);
    console.log("└─ QualityEscrow:", escrowAddress);

    console.log("\n📝 Transaction Hash:", deployment.transactionHash);
    console.log("\n🔍 PolygonScan:");
    console.log(`https://polygonscan.com/address/${escrowAddress}`);

    console.log("\n⚙️  Variables de entorno:");
    console.log("\n# Backend .env");
    console.log(`QUALITY_ESCROW_ADDRESS=${escrowAddress}`);
    console.log("\n# Frontend .env");
    console.log(`VITE_QUALITY_ESCROW_ADDRESS=${escrowAddress}`);

    console.log("\n✨ Próximos pasos:");
    console.log("1. Verificar contrato: npx hardhat verify --network polygon", escrowAddress, OFFICIAL_BEZ_CONTRACT, wallet.address);
    console.log("2. Actualizar variables de entorno");
    console.log("3. Reiniciar servicios");

    return deployment;
}

main()
    .then(() => {
        console.log("\n✅ Script completado exitosamente");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Error:", error.message);
        console.error(error);
        process.exit(1);
    });
