const { ethers } = require("ethers");
const fs = require("fs");
require("dotenv").config();

/**
 * Script de despliegue directo - BeZhasMarketplace
 * Marketplace para vendedores y productos físicos
 * Network: Polygon Mainnet
 * Ethers: v5
 */

const BEZCOIN_ADDRESS = "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8"; // BEZ-Coin
const VENDOR_FEE = "100"; // 100 BEZ para ser vendedor
const PLATFORM_COMMISSION = "250"; // 2.5% (Base 10000)

// Artifact
const marketplaceArtifact = require("../artifacts/contracts/BeZhasMarketplace.sol/BeZhasMarketplace.json");

async function main() {
    console.log("\n🛒 Desplegando BeZhasMarketplace (Polygon Mainnet)...");
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
        maxPriorityFeePerGas: ethers.utils.parseUnits("50", "gwei"),
        maxFeePerGas: ethers.utils.parseUnits("500", "gwei"),
    };
    console.log("⛽ Gas: 50 Gwei priority, 500 Gwei max\n");

    // ========================================================
    // DEPLOY MARKETPLACE
    // ========================================================
    console.log("📦 Desplegando BeZhasMarketplace...");
    console.log("   Token:", BEZCOIN_ADDRESS);
    console.log("   Vendor Fee:", VENDOR_FEE, "BEZ");
    console.log("   Commission:", PLATFORM_COMMISSION, "basis points (2.5%)");

    const MarketplaceFactory = new ethers.ContractFactory(
        marketplaceArtifact.abi,
        marketplaceArtifact.bytecode,
        wallet
    );

    // Constructor: (address _token, uint256 _fee, uint256 _commission)
    const vendorFeeWei = ethers.utils.parseEther(VENDOR_FEE);
    const marketplace = await MarketplaceFactory.deploy(
        BEZCOIN_ADDRESS,
        vendorFeeWei,
        PLATFORM_COMMISSION,
        overrides
    );
    console.log("   Tx Hash:", marketplace.deployTransaction.hash);
    await marketplace.deployed();
    console.log("✅ BeZhasMarketplace Address:", marketplace.address);

    // ========================================================
    // SUMMARY
    // ========================================================
    console.log("\n" + "=".repeat(60));
    console.log("🎉 BEZHAS MARKETPLACE DEPLOYED!");
    console.log("=".repeat(60));
    console.log("\n📋 Contrato desplegado:\n");
    console.log("BeZhasMarketplace:", marketplace.address);
    console.log("\n📝 Variables de entorno:\n");
    console.log("# Backend .env");
    console.log(`BEZHAS_MARKETPLACE_ADDRESS=${marketplace.address}`);
    console.log("\n# Frontend .env");
    console.log(`VITE_BEZHAS_MARKETPLACE_ADDRESS=${marketplace.address}`);
    console.log("\n" + "=".repeat(60));

    // Save deployment data
    const deploymentData = {
        network: "polygon",
        chainId: 137,
        timestamp: new Date().toISOString(),
        deployer: wallet.address,
        contracts: {
            beZhasMarketplace: {
                address: marketplace.address,
                txHash: marketplace.deployTransaction.hash,
                params: {
                    token: BEZCOIN_ADDRESS,
                    vendorFee: VENDOR_FEE + " BEZ",
                    platformCommission: PLATFORM_COMMISSION + " (2.5%)"
                }
            }
        }
    };

    fs.writeFileSync("marketplace-deployment.json", JSON.stringify(deploymentData, null, 2));
    console.log("✅ Deployment data saved to: marketplace-deployment.json\n");

    console.log("📝 Funcionalidades:");
    console.log("1. Registro de vendedores (costo: 100 BEZ)");
    console.log("2. Creación de productos on-chain");
    console.log("3. Compras con comisión del 2.5% para la plataforma");
    console.log("4. Backend escucha eventos para sincronizar con DB\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ ERROR:", error);
        process.exit(1);
    });
