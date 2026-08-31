const { ethers } = require("ethers");
const fs = require("fs");
require("dotenv").config();

/**
 * Script de despliegue directo - BeZhasAdminRegistry
 * Sistema de gestión de administradores on-chain
 * Network: Polygon Mainnet
 * Ethers: v5
 */

// Artifact
const adminRegistryArtifact = require("../artifacts/contracts/admin/BeZhasAdminRegistry.sol/BeZhasAdminRegistry.json");

async function main() {
    console.log("\n👮 Desplegando BeZhasAdminRegistry (Polygon Mainnet)...");
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
    // DEPLOY ADMIN REGISTRY
    // ========================================================
    console.log("📦 Desplegando BeZhasAdminRegistry...");
    console.log("   El deployer será el primer admin automáticamente");

    const AdminRegistryFactory = new ethers.ContractFactory(
        adminRegistryArtifact.abi,
        adminRegistryArtifact.bytecode,
        wallet
    );

    // Constructor: No requiere parámetros, msg.sender será el owner y primer admin
    const adminRegistry = await AdminRegistryFactory.deploy(overrides);
    console.log("   Tx Hash:", adminRegistry.deployTransaction.hash);
    await adminRegistry.deployed();
    console.log("✅ BeZhasAdminRegistry Address:", adminRegistry.address);

    // Verificar que el deployer es admin
    const isAdmin = await adminRegistry.isAdmin(wallet.address);
    console.log("   Deployer is admin:", isAdmin ? "✅ YES" : "❌ NO");

    // ========================================================
    // SUMMARY
    // ========================================================
    console.log("\n" + "=".repeat(60));
    console.log("🎉 ADMIN REGISTRY DEPLOYED!");
    console.log("=".repeat(60));
    console.log("\n📋 Contrato desplegado:\n");
    console.log("BeZhasAdminRegistry:", adminRegistry.address);
    console.log("Owner & First Admin:", wallet.address);
    console.log("\n📝 Variables de entorno:\n");
    console.log("# Backend .env");
    console.log(`ADMIN_REGISTRY_ADDRESS=${adminRegistry.address}`);
    console.log("\n# Frontend .env");
    console.log(`VITE_ADMIN_REGISTRY_ADDRESS=${adminRegistry.address}`);
    console.log("\n" + "=".repeat(60));

    // Save deployment data
    const deploymentData = {
        network: "polygon",
        chainId: 137,
        timestamp: new Date().toISOString(),
        deployer: wallet.address,
        contracts: {
            beZhasAdminRegistry: {
                address: adminRegistry.address,
                txHash: adminRegistry.deployTransaction.hash,
                owner: wallet.address,
                firstAdmin: wallet.address
            }
        }
    };

    fs.writeFileSync("admin-registry-deployment.json", JSON.stringify(deploymentData, null, 2));
    console.log("✅ Deployment data saved to: admin-registry-deployment.json\n");

    console.log("📝 Próximos pasos:");
    console.log("1. Usar addAdmin(address) para agregar más administradores");
    console.log("2. Usar removeAdmin(address) para remover admins (excepto el owner)");
    console.log("3. Usar isAdmin(address) para verificar si una dirección es admin");
    console.log("4. Integrar con el backend para validación de permisos\n");

    console.log("⚠️  IMPORTANTE:");
    console.log("- Solo el owner puede agregar/remover admins");
    console.log("- El owner no puede removerse a sí mismo");
    console.log("- Guarda bien la private key del owner\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ ERROR:", error);
        process.exit(1);
    });
