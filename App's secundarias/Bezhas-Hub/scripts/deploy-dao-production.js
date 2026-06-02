const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🚀 Iniciando despliegue de Producción de la Arquitectura DAO...\n");
    console.log("⚠️  RED DE PRODUCCIÓN - Las transacciones son irreversibles (Polygon Mainnet)");

    const [deployer] = await hre.ethers.getSigners();
    console.log("🔑 Desplegando con la cuenta:", deployer.address);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("   Balance:", hre.ethers.formatEther(balance), "MATIC\n");

    // Configuración de Gas para Polygon Mainnet (Critico)
    const overrides = {
        maxPriorityFeePerGas: hre.ethers.parseUnits("35", "gwei"),
        maxFeePerGas: hre.ethers.parseUnits("250", "gwei"),
    };
    console.log("⛽ Configuración de Gas Manual:", {
        priority: "35 Gwei",
        max: "250 Gwei"
    });

    // ---------------------------------------------------------
    // 1. DESPLIEGUE DE CORE & TOKEN
    // ---------------------------------------------------------
    console.log("📦 FASE 1: Conectando Core...");

    // A. Token de Gobernanza (Usando Token Existente)
    const BEZHAS_TOKEN_ADDRESS = "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8";
    const tokenAddress = BEZHAS_TOKEN_ADDRESS;
    console.log(`✅ Token de Gobernanza: ${tokenAddress}`);

    // B. Plugin Manager (El Guardián de Seguridad)
    console.log("   - Desplegando PluginManager...");
    const PluginManager = await hre.ethers.getContractFactory("PluginManager");
    const manager = await PluginManager.deploy(overrides);
    await manager.waitForDeployment();
    const managerAddress = await manager.getAddress();
    console.log(`🛡️ Plugin Manager (Core) Desplegado: ${managerAddress}`);

    // ---------------------------------------------------------
    // 2. DESPLIEGUE DE PLUGINS FUNCIONALES
    // ---------------------------------------------------------
    console.log("📦 FASE 2: Desplegando Plugins de Negocio...");

    // C. Tesorería (Treasury Plugin)
    console.log("   - Desplegando TreasuryPlugin...");
    const Treasury = await hre.ethers.getContractFactory("TreasuryPlugin");
    const treasury = await Treasury.deploy(managerAddress, tokenAddress, deployer.address, overrides);
    await treasury.waitForDeployment();
    const treasuryAddress = await treasury.getAddress();
    console.log(`💰 Tesorería Desplegada: ${treasuryAddress}`);

    // D. Recursos Humanos (HR Plugin)
    console.log("   - Desplegando HumanResourcesPlugin...");
    const HumanResources = await hre.ethers.getContractFactory("HumanResourcesPlugin");
    const hr = await HumanResources.deploy(managerAddress, tokenAddress, overrides);
    await hr.waitForDeployment();
    const hrAddress = await hr.getAddress();
    console.log(`👥 HR Plugin Desplegado: ${hrAddress}`);

    // E. Gobernanza (Governance Plugin)
    console.log("   - Desplegando GovernancePlugin...");
    const Governance = await hre.ethers.getContractFactory("GovernancePlugin");
    const governance = await Governance.deploy(managerAddress, tokenAddress, treasuryAddress, overrides);
    await governance.waitForDeployment();
    const govAddress = await governance.getAddress();
    console.log(`⚖️ Gobernanza Desplegada: ${govAddress}`);

    // F. Publicidad (Advertising Plugin - DePub)
    console.log("   - Desplegando AdvertisingPlugin...");
    const Advertising = await hre.ethers.getContractFactory("AdvertisingPlugin");
    const ads = await Advertising.deploy(managerAddress, treasuryAddress, tokenAddress, overrides);
    await ads.waitForDeployment();
    const adsAddress = await ads.getAddress();
    console.log(`📢 Publicidad (DePub) Desplegada: ${adsAddress}`);

    // ---------------------------------------------------------
    // 3. ORQUESTACIÓN Y PERMISOS (WIRING)
    // ---------------------------------------------------------
    console.log("🔗 FASE 3: Conectando los cables (Autorización de Plugins)...");

    console.log("   - Autorizando Treasury...");
    await (await manager.authorizePlugin(treasuryAddress, "Treasury", "1.0.0", overrides)).wait();

    console.log("   - Autorizando HR...");
    await (await manager.authorizePlugin(hrAddress, "HR", "1.0.0", overrides)).wait();

    console.log("   - Autorizando Governance...");
    await (await manager.authorizePlugin(govAddress, "Governance", "1.0.0", overrides)).wait();

    console.log("   - Autorizando Advertising...");
    await (await manager.authorizePlugin(adsAddress, "Advertising", "1.0.0", overrides)).wait();

    console.log("\n✅ Todos los plugins han sido autorizados en el Core.\n");

    console.log("⚠️ OMITIENDO FASE DE 'SEEDING' (Creación de datos dummy) para evitar costos en Mainnet.");

    // ---------------------------------------------------------
    // 5. EXPORTAR DIRECCIONES
    // ---------------------------------------------------------
    console.log("📝 FASE 5: Generando configuración...");

    const contracts = {
        network: hre.network.name,
        chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
        deployer: deployer.address,
        contracts: {
            token: {
                address: tokenAddress,
                name: "DAO Governance Token",
                symbol: "DGT"
            },
            pluginManager: {
                address: managerAddress,
                name: "PluginManager (Core)"
            },
            treasury: {
                address: treasuryAddress,
                name: "TreasuryPlugin"
            },
            hr: {
                address: hrAddress,
                name: "HumanResourcesPlugin"
            },
            governance: {
                address: govAddress,
                name: "GovernancePlugin"
            },
            advertising: {
                address: adsAddress,
                name: "AdvertisingPlugin"
            }
        },
        timestamp: new Date().toISOString()
    };

    // Imprimir para logs
    console.log(JSON.stringify(contracts, null, 2));

    // Guardar en archivo local temporal
    fs.writeFileSync("dao-production-deployment.json", JSON.stringify(contracts, null, 2));
    console.log("✅ Configuración guardada en dao-production-deployment.json");

    console.log("\n🔗 ACTUALIZA TUS .ENV CON ESTAS DIRECCIONES:");
    console.log(`BEZHAS_CORE_ADDRESS=${managerAddress}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ ERROR EN EL DEPLOYMENT:\n");
        console.error(error);
        process.exitCode = 1;
    });
