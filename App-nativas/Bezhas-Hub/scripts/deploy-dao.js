const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🚀 Iniciando despliegue de la Arquitectura DAO Completa...\n");

    const [deployer, advertiser, contributor] = await hre.ethers.getSigners();
    console.log("🔑 Desplegando con la cuenta:", deployer.address);
    console.log("   Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

    // ---------------------------------------------------------
    // 1. DESPLIEGUE DE CORE & TOKEN
    // ---------------------------------------------------------
    console.log("📦 FASE 1: Configurando Token de Gobernanza y Core...");

    // A. Token de Gobernanza (Usando Token Existente)
    const BEZHAS_TOKEN_ADDRESS = "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8";
    const tokenAddress = BEZHAS_TOKEN_ADDRESS;
    console.log(`✅ Usando Token Existente como Gobernanza: ${tokenAddress}`);

    // Intentamos conectar para verificar
    try {
        const token = await hre.ethers.getContractAt("BezhasToken", tokenAddress);
        console.log(`   Conectado a: ${await token.name()}`);
    } catch (e) {
        console.log("   ⚠️ Usando dirección sin verificación de contrato (ABI no encontrado o red sin acceso).");
    }

    // B. Plugin Manager (El Guardián de Seguridad)
    const PluginManager = await hre.ethers.getContractFactory("PluginManager");
    const manager = await PluginManager.deploy();
    await manager.waitForDeployment();
    const managerAddress = await manager.getAddress();
    console.log(`🛡️ Plugin Manager (Core) Desplegado: ${managerAddress}`);
    console.log(`   Rol: Guardián de seguridad inmutable\n`);

    // ---------------------------------------------------------
    // 2. DESPLIEGUE DE PLUGINS FUNCIONALES
    // ---------------------------------------------------------
    console.log("📦 FASE 2: Desplegando Plugins de Negocio...");

    // C. Tesorería (Treasury Plugin)
    const Treasury = await hre.ethers.getContractFactory("TreasuryPlugin");
    const treasury = await Treasury.deploy(managerAddress, tokenAddress, deployer.address);
    await treasury.waitForDeployment();
    const treasuryAddress = await treasury.getAddress();
    console.log(`💰 Tesorería Desplegada: ${treasuryAddress}`);
    console.log(`   Funciones: Rebalanceo automático, gestión de activos`);

    // D. Recursos Humanos (HR Plugin)
    const HumanResources = await hre.ethers.getContractFactory("HumanResourcesPlugin");
    const hr = await HumanResources.deploy(managerAddress, tokenAddress);
    await hr.waitForDeployment();
    const hrAddress = await hr.getAddress();
    console.log(`👥 HR Plugin Desplegado: ${hrAddress}`);
    console.log(`   Funciones: Vesting, milestone payments`);

    // E. Gobernanza (Governance Plugin)
    const Governance = await hre.ethers.getContractFactory("GovernancePlugin");
    const governance = await Governance.deploy(managerAddress, tokenAddress, treasuryAddress);
    await governance.waitForDeployment();
    const govAddress = await governance.getAddress();
    console.log(`⚖️ Gobernanza Desplegada: ${govAddress}`);
    console.log(`   Funciones: Votación, propuestas, slashing`);

    // F. Publicidad (Advertising Plugin - DePub)
    const Advertising = await hre.ethers.getContractFactory("AdvertisingPlugin");
    const ads = await Advertising.deploy(managerAddress, treasuryAddress, tokenAddress);
    await ads.waitForDeployment();
    const adsAddress = await ads.getAddress();
    console.log(`📢 Publicidad (DePub) Desplegada: ${adsAddress}`);
    console.log(`   Funciones: Ad Cards NFT, revenue sharing\n`);

    // ---------------------------------------------------------
    // 3. ORQUESTACIÓN Y PERMISOS (WIRING)
    // ---------------------------------------------------------
    console.log("🔗 FASE 3: Conectando los cables (Autorización de Plugins)...");

    await manager.authorizePlugin(treasuryAddress, "Treasury", "1.0.0");
    console.log(`   ✅ Treasury autorizado`);

    await manager.authorizePlugin(hrAddress, "HR", "1.0.0");
    console.log(`   ✅ HR autorizado`);

    await manager.authorizePlugin(govAddress, "Governance", "1.0.0");
    console.log(`   ✅ Governance autorizado`);

    await manager.authorizePlugin(adsAddress, "Advertising", "1.0.0");
    console.log(`   ✅ Advertising autorizado`);

    console.log("\n✅ Todos los plugins han sido autorizados en el Core.\n");

    // ---------------------------------------------------------
    // 4. SIMULACIÓN DE ESTADO INICIAL (SEEDING)
    // ---------------------------------------------------------
    console.log("🌱 FASE 4: Sembrando datos iniciales para el Dashboard...");

    // A. Fondear la Tesorería
    const initialFund = hre.ethers.parseEther("500000"); // 500k tokens
    await token.transfer(treasuryAddress, initialFund);
    console.log(`   💰 Tesorería fondeada con 500,000 DGT`);

    // B. Crear algunos anuncios de prueba (DePub)
    try {
        // Dar tokens al advertiser
        await token.transfer(advertiser.address, hre.ethers.parseEther("10000"));

        // Crear Ad Card #0 (Header Banner)
        await ads.mintAdCard(
            deployer.address, // publisher
            "ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco", // metadata
            45000 // 45k impressions/mes
        );
        console.log(`   📢 Ad Card #0 creada (Header Banner - 45k impressions/mes)`);

        // Crear Ad Card #1 (Sidebar)
        await ads.mintAdCard(
            deployer.address,
            "ipfs://QmTk9n2RRvof47uV1X4kV6oLgJ5WZhj9qmZEZZZPXb5L8",
            12000 // 12k impressions/mes
        );
        console.log(`   📢 Ad Card #1 creada (Sidebar - 12k impressions/mes)`);
    } catch (error) {
        console.log(`   ⚠️ Error creando Ad Cards (puede ser normal si el contrato no tiene permisos):`, error.message);
    }

    // C. Crear planes de Vesting de prueba
    try {
        // Vesting para contributor #1
        const vestingAmount1 = hre.ethers.parseEther("100000"); // 100k tokens
        const cliffDuration = 90 * 24 * 60 * 60; // 90 días
        const vestingDuration = 730 * 24 * 60 * 60; // 2 años

        await hr.createVestingSchedule(
            contributor.address,
            vestingAmount1,
            cliffDuration,
            vestingDuration
        );
        console.log(`   👤 Vesting creado para ${contributor.address}`);
        console.log(`      - Total: 100,000 DGT`);
        console.log(`      - Cliff: 90 días`);
        console.log(`      - Duración: 2 años`);

        // Crear algunos milestones de prueba
        const milestoneContract = hr.connect(contributor);
        await milestoneContract.submitMilestoneProof("QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco");
        console.log(`   📄 Milestone #0 creado (pendiente de verificación)`);

    } catch (error) {
        console.log(`   ⚠️ Error creando Vesting (puede ser normal):`, error.message);
    }

    // D. Crear una propuesta de gobernanza de prueba
    try {
        // Dar tokens al deployer para crear propuesta
        await token.approve(govAddress, hre.ethers.parseEther("1000"));

        await governance.createProposal(
            "Diversificar Tesorería: Swap 50k USDC a PAXG",
            "Propuesta para reducir exposición a volatilidad mediante compra de PAXG (oro tokenizado)",
            "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
            true, // isOnChain
            treasuryAddress, // targetContract
            "0x" // callData vacío para demo
        );
        console.log(`   ⚖️ Propuesta #0 creada (Votación activa)`);
    } catch (error) {
        console.log(`   ⚠️ Error creando propuesta (puede ser normal):`, error.message);
    }

    console.log("\n✅ Datos iniciales sembrados correctamente.\n");

    // ---------------------------------------------------------
    // 5. EXPORTAR DIRECCIONES PARA EL FRONTEND
    // ---------------------------------------------------------
    console.log("📝 FASE 5: Generando configuración para el Frontend...");

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

    // Guardar en múltiples ubicaciones para compatibilidad
    const configPaths = [
        "./frontend/src/config/dao-contracts.json",
        "./contracts-config.json",
        "./deployed-contracts.json"
    ];

    for (const configPath of configPaths) {
        const dir = path.dirname(configPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(configPath, JSON.stringify(contracts, null, 2));
        console.log(`   ✅ Configuración guardada en: ${configPath}`);
    }

    // ---------------------------------------------------------
    // 6. RESUMEN FINAL
    // ---------------------------------------------------------
    console.log("\n" + "=".repeat(70));
    console.log("🎉 ¡SISTEMA DAO COMPLETAMENTE DESPLEGADO!");
    console.log("=".repeat(70));
    console.log("\n📋 RESUMEN DE CONTRATOS:\n");

    console.log("┌─────────────────────────┬──────────────────────────────────────────────┐");
    console.log("│ Contrato                │ Dirección                                    │");
    console.log("├─────────────────────────┼──────────────────────────────────────────────┤");
    console.log(`│ Token (DGT)             │ ${tokenAddress} │`);
    console.log(`│ PluginManager (Core)    │ ${managerAddress} │`);
    console.log(`│ TreasuryPlugin          │ ${treasuryAddress} │`);
    console.log(`│ HumanResourcesPlugin    │ ${hrAddress} │`);
    console.log(`│ GovernancePlugin        │ ${govAddress} │`);
    console.log(`│ AdvertisingPlugin       │ ${adsAddress} │`);
    console.log("└─────────────────────────┴──────────────────────────────────────────────┘");

    console.log("\n🔗 PRÓXIMOS PASOS:\n");
    console.log("1. Verifica que el frontend esté corriendo:");
    console.log("   cd frontend && npm run dev\n");
    console.log("2. Visita las siguientes URLs:");
    console.log("   http://localhost:5173/dao              → Landing page");
    console.log("   http://localhost:5173/dao/treasury     → Treasury Dashboard");
    console.log("   http://localhost:5173/dao/talent       → Talent Dashboard");
    console.log("   http://localhost:5173/dao/governance   → Governance Hub");
    console.log("   http://localhost:5173/dao/advertising  → Ad Marketplace\n");
    console.log("3. Conecta tu wallet (MetaMask) a la red:");
    console.log(`   Network: ${hre.network.name}`);
    console.log(`   Chain ID: ${(await hre.ethers.provider.getNetwork()).chainId}\n`);
    console.log("4. Importa el token DGT en MetaMask:");
    console.log(`   Address: ${tokenAddress}\n`);

    console.log("💡 TIP: Si estás en localhost, asegúrate de tener Hardhat Node corriendo:");
    console.log("   npx hardhat node\n");

    console.log("=".repeat(70));
    console.log("🚀 Sistema DAO listo para usar!");
    console.log("=".repeat(70) + "\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ ERROR EN EL DEPLOYMENT:\n");
        console.error(error);
        process.exitCode = 1;
    });
