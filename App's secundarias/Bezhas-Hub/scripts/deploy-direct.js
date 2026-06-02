// ⚠️ ⚠️ ⚠️ ADVERTENCIA ⚠️ ⚠️ ⚠️
// 
// CONTRATO OFICIAL BEZ-COIN YA EXISTE:
// 0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
//
// NO EJECUTAR ESTE SCRIPT PARA BEZ-COIN
// Este script está DESHABILITADO para evitar despliegues accidentales
//
// Ver: CONTRATO_OFICIAL_BEZ.md
// ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️

const OFFICIAL_BEZ_CONTRACT = "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8";

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function main() {
    console.log("\n⛔ SCRIPT DESHABILITADO ⛔\n");
    console.log("Este script NO debe usarse para desplegar BEZ-Coin.\n");
    console.log("CONTRATO OFICIAL BEZ-COIN:", OFFICIAL_BEZ_CONTRACT);
    console.log("Network: Polygon Amoy (ChainID 80002)\n");
    console.log("Ver CONTRATO_OFICIAL_BEZ.md para más información.\n");
    process.exit(1);

// Código original comentado para referencia
/*
console.log("\n🚀 Desplegando BEZ Token directo con ethers.js\n");

// Configuración
const RPC_URL = process.env.POLYGON_RPC_URL || "https://rpc-amoy.polygon.technology";
const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.HOT_WALLET_PRIVATE_KEY;

if (!PRIVATE_KEY) {
    console.log("❌ PRIVATE_KEY no encontrada en .env");
    process.exit(1);
}

// Conectar a la red
console.log("📡 Conectando a Polygon Amoy...");
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

console.log("📝 Deployer:", wallet.address);
const balance = await wallet.getBalance();
console.log("💰 Balance:", ethers.utils.formatEther(balance), "MATIC\n");

if (parseFloat(ethers.utils.formatEther(balance)) < 1) {
    console.log("⚠️  Balance bajo, pero continuando...");
}

// Cargar ABI y Bytecode del contrato compilado
console.log("📦 Cargando contrato BezhasToken...");
const artifactPath = path.join(__dirname, "../artifacts/contracts/BezhasToken.sol/BezhasToken.json");

if (!fs.existsSync(artifactPath)) {
    console.log("❌ Contrato no compilado. Ejecuta: pnpm exec hardhat compile");
    process.exit(1);
}

const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
const { abi, bytecode } = artifact;

console.log("✅ ABI y Bytecode cargados");

// Deploy
console.log("\n1️⃣  Desplegando contrato...");
const BezhasToken = new ethers.ContractFactory(abi, bytecode, wallet);

const initialSupply = ethers.utils.parseEther("10000000"); // 10M BEZ
console.log("   Supply inicial: 10,000,000 BEZ");

const bezToken = await BezhasToken.deploy(initialSupply, {
    gasLimit: 3000000 // Límite de gas manual
});

console.log("⏳ Esperando confirmación...");
console.log("   TX Hash:", bezToken.deployTransaction.hash);

await bezToken.deployed();

console.log("✅ Contrato desplegado en:", bezToken.address);

// Verificar deployment
console.log("\n2️⃣  Verificando deployment...");
const name = await bezToken.name();
const symbol = await bezToken.symbol();
const decimals = await bezToken.decimals();
const totalSupply = await bezToken.totalSupply();

console.log("   Nombre:", name);
console.log("   Símbolo:", symbol);
console.log("   Decimales:", decimals.toString());
console.log("   Supply Total:", ethers.utils.formatEther(totalSupply), "BEZ");

// Transferir a Hot Wallet
const HOT_WALLET = "0x52Df82920CBAE522880dD7657e43d1A754eD044E";
const transferAmount = ethers.utils.parseEther("1000000"); // 1M BEZ

console.log("\n3️⃣  Transfiriendo tokens a Hot Wallet...");
console.log("   Destinatario:", HOT_WALLET);
console.log("   Cantidad:", ethers.utils.formatEther(transferAmount), "BEZ");

const transferTx = await bezToken.transfer(HOT_WALLET, transferAmount);
await transferTx.wait();

const hotBalance = await bezToken.balanceOf(HOT_WALLET);
console.log("✅ Balance Hot Wallet:", ethers.utils.formatEther(hotBalance), "BEZ");

// Resumen
console.log("\n" + "=".repeat(80));
console.log("🎉 DEPLOYMENT COMPLETADO");
console.log("=".repeat(80));
console.log("\n📋 Dirección del Contrato:", bezToken.address);
console.log("🔗 Explorer: https://amoy.polygonscan.com/address/" + bezToken.address);

console.log("\n⚙️  ACTUALIZA TUS .ENV:\n");
console.log('BEZCOIN_CONTRACT_ADDRESS="' + bezToken.address + '"');
console.log("\n" + "=".repeat(80) + "\n");

return bezToken.address;
}

main()
.then((address) => {
    console.log("✅ Deployment exitoso");
    process.exit(0);
})
.catch((error) => {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
});
