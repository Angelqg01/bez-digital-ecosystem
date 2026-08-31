const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await hre.ethers.getSigners();

    console.log("🚀 Desplegando contratos con la cuenta:", deployer.address);

    // --- CONFIGURACIÓN INICIAL ---
    const VENDOR_FEE = hre.ethers.parseUnits("50", 18); // 50 Tokens para ser vendedor
    const COMMISSION = 250; // 2.5% de comisión

    // Dirección FIJA del token existente (Persistencia Real)
    const BEZHAS_TOKEN_ADDRESS = "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8";
    let tokenAddress = BEZHAS_TOKEN_ADDRESS;

    console.log("🪙 Usando Token Existente:", tokenAddress);

    // Verificamos si podemos conectar al token (opcional, solo para log)
    try {
        const token = await hre.ethers.getContractAt("BezhasToken", tokenAddress);
        const name = await token.name();
        console.log(`   ✅ Conectado a: ${name} (${tokenAddress})`);
    } catch (e) {
        console.log("   ⚠️ No se pudo verificar el nombre del token, pero se usará la dirección proporcionada.");
    }

    // --- DESPLIEGUE DEL MARKETPLACE ---
    console.log("Deploying BeZhasMarketplace...");
    const Marketplace = await hre.ethers.getContractFactory("BeZhasMarketplace");

    // Constructor: (TokenAddress, VendorFee, Commission)
    const marketplace = await Marketplace.deploy(tokenAddress, VENDOR_FEE, COMMISSION);

    await marketplace.waitForDeployment();
    const marketAddress = await marketplace.target;

    console.log("----------------------------------------------------");
    console.log("🎉 BeZhas Marketplace desplegado exitosamente");
    console.log("📍 Dirección del Contrato:", marketAddress);
    console.log("🪙 Token usado:", tokenAddress);
    console.log("----------------------------------------------------");

    console.log("⚠️  IMPORTANTE: Copia la 'Dirección del Contrato' a tu archivo .env del Backend.");

    // Persist addresses to backend/config.json (without secrets)
    try {
        const backendConfigPath = path.join(__dirname, "..", "backend", "config.json");
        let current = {};
        if (fs.existsSync(backendConfigPath)) {
            try { current = JSON.parse(fs.readFileSync(backendConfigPath, "utf8")); } catch (_) { }
        }

        // Update only the relevant addresses
        const addresses = {
            ...current.contractAddresses,
            BezhasTokenAddress: tokenAddress,
            BeZhasMarketplaceAddress: marketAddress
        };

        const merged = { ...(current || {}), contractAddresses: addresses };
        fs.writeFileSync(backendConfigPath, JSON.stringify(merged, null, 2));
        console.log(`\n📝 Addresses saved to ${backendConfigPath}`);
    } catch (err) {
        console.warn("Could not write backend config:", err);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
