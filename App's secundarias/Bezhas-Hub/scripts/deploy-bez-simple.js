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

const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
    console.log("\n⛔ SCRIPT DESHABILITADO ⛔\n");
    console.log("Este script NO debe usarse para desplegar BEZ-Coin.\n");
    console.log("CONTRATO OFICIAL BEZ-COIN:", OFFICIAL_BEZ_CONTRACT);
    console.log("Network: Polygon Amoy (ChainID 80002)\n");
    console.log("Ver CONTRATO_OFICIAL_BEZ.md para más información.\n");
    process.exit(1);

// Código original comentado para referencia
/*
console.log("\n🚀 Desplegando BEZ Token en Polygon Amoy...\n");

// Obtener el signer
const [deployer] = await ethers.getSigners();
console.log("📝 Cuenta de deployment:", deployer.address);

// Obtener balance
const balance = await ethers.provider.getBalance(deployer.address);
console.log("💰 Balance:", ethers.formatEther(balance), "MATIC\n");

if (parseFloat(ethers.formatEther(balance)) < 0.01) {
    console.log("❌ Balance insuficiente para deployment");
    process.exit(1);
}

// Deploy BEZ Token
console.log("1️⃣  Desplegando BezhasToken...");
const BezhasToken = await ethers.getContractFactory("BezhasToken");

// 10 millones de tokens iniciales
const initialSupply = ethers.parseEther("10000000");
console.log("   Supply inicial: 10,000,000 BEZ");

const bezToken = await BezhasToken.deploy(initialSupply);
await bezToken.waitForDeployment();

const tokenAddress = await bezToken.getAddress();
console.log("✅ BezhasToken desplegado en:", tokenAddress);

// Verificar deployment
console.log("\n2️⃣  Verificando deployment...");
const name = await bezToken.name();
const symbol = await bezToken.symbol();
const decimals = await bezToken.decimals();
const totalSupply = await bezToken.totalSupply();

console.log("   Nombre:", name);
console.log("   Símbolo:", symbol);
console.log("   Decimales:", decimals);
console.log("   Supply Total:", ethers.formatEther(totalSupply), "BEZ");

// Transferir tokens a Hot Wallet
const HOT_WALLET = "0x52Df82920CBAE522880dD7657e43d1A754eD044E";
const transferAmount = ethers.parseEther("1000000"); // 1M BEZ a Hot Wallet

console.log("\n3️⃣  Transfiriendo tokens a Hot Wallet...");
console.log("   Destinatario:", HOT_WALLET);
console.log("   Cantidad:", ethers.formatEther(transferAmount), "BEZ");

const transferTx = await bezToken.transfer(HOT_WALLET, transferAmount);
await transferTx.wait();

const hotWalletBalance = await bezToken.balanceOf(HOT_WALLET);
console.log("✅ Balance Hot Wallet:", ethers.formatEther(hotWalletBalance), "BEZ");

// Resumen
console.log("\n" + "=".repeat(80));
console.log("🎉 DEPLOYMENT COMPLETADO");
console.log("=".repeat(80));
console.log("\n📋 Información del Contrato:");
console.log("   Address:", tokenAddress);
console.log("   Network: Polygon Amoy (ChainID 80002)");
console.log("   Explorer: https://amoy.polygonscan.com/address/" + tokenAddress);

console.log("\n⚙️  ACTUALIZA TUS .ENV:");
console.log("\n# Root .env");
console.log(`BEZCOIN_CONTRACT_ADDRESS="${tokenAddress}"`);

console.log("\n# backend/.env");
console.log(`BEZCOIN_CONTRACT_ADDRESS=${tokenAddress}`);

console.log("\n# frontend/.env");
console.log(`VITE_BEZCOIN_CONTRACT_ADDRESS=${tokenAddress}`);

console.log("\n💡 PRÓXIMO PASO:");
console.log("   1. Actualizar las direcciones en los .env");
console.log("   2. Ejecutar: node test-wallet-simple.js");
console.log("   3. Iniciar backend y realizar pago de prueba");

console.log("\n" + "=".repeat(80) + "\n");
}

main()
.then(() => process.exit(0))
.catch((error) => {
    console.error("\n❌ Error en deployment:");
    console.error(error);
    process.exit(1);
});
