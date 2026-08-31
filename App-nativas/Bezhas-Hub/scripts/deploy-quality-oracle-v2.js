// ⚠️ QUALITY ORACLE V2 - Multi-Sector Validation System
// Despliega el nuevo QualityOracle expandido con soporte para:
// - PRODUCT, SERVICE, NFT, RWA, LOGISTICS, SDK_INTERACTION, POST, REVIEW, TRANSACTION
//
// Contrato BEZ-Coin Oficial: 0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
// Treasury DAO: 0x89c23890c742d710265dd61be789c71dc8999b12
// LP Pool QuickSwap: 0x4edc77de01f2a2c87611c2f8e9249be43df745a9

const OFFICIAL_BEZ_CONTRACT = "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8";
const TREASURY_DAO = "0x89c23890c742d710265dd61be789c71dc8999b12";
const LP_POOL_QUICKSWAP = "0x4edc77de01f2a2c87611c2f8e9249be43df745a9";

const hre = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("\n🚀 Deploying Quality Oracle V2 - Multi-Sector Validation System\n");
    console.log("═".repeat(70));
    console.log("⚠️  RED DE PRODUCCIÓN - Las transacciones son irreversibles");
    console.log("═".repeat(70));

    console.log("\n📋 Configuración:");
    console.log("   BEZ-Coin Oficial:", OFFICIAL_BEZ_CONTRACT);
    console.log("   Treasury DAO:", TREASURY_DAO);
    console.log("   LP Pool QuickSwap:", LP_POOL_QUICKSWAP);

    const [deployer] = await hre.ethers.getSigners();
    console.log("\n📝 Deployer:", deployer.address);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("💰 Balance:", hre.ethers.formatEther(balance), "MATIC");

    if (balance < hre.ethers.parseEther("0.5")) {
        throw new Error("❌ Balance insuficiente. Necesitas al menos 0.5 MATIC para el despliegue del QualityOracle.");
    }

    // Determinar si estamos en mainnet o testnet
    const network = await hre.ethers.provider.getNetwork();
    const isMainnet = network.chainId === 137n;
    const bezTokenAddress = OFFICIAL_BEZ_CONTRACT;

    // Verificar contrato BEZ-Coin (solo en mainnet)
    console.log("\n1️⃣  Verificando BEZ-Coin...");
    if (isMainnet) {
        try {
            // Usar ABI mínimo para verificar el token
            const minimalABI = [
                "function symbol() view returns (string)",
                "function totalSupply() view returns (uint256)"
            ];
            const bezCoin = new hre.ethers.Contract(OFFICIAL_BEZ_CONTRACT, minimalABI, hre.ethers.provider);
            const symbol = await bezCoin.symbol();
            const totalSupply = await bezCoin.totalSupply();
            console.log(`   ✅ BEZ-Coin verificado: ${symbol}`);
            console.log(`   📊 Supply: ${hre.ethers.formatEther(totalSupply)} BEZ`);
        } catch (error) {
            console.log(`   ⚠️  No se pudo verificar BEZ-Coin: ${error.message}`);
            console.log(`   📝 Continuando con la dirección conocida: ${bezTokenAddress}`);
        }
    } else {
        console.log(`   ⚠️  Red de prueba (chainId: ${network.chainId}) - saltando verificación BEZ-Coin`);
        console.log(`   📝 Usando dirección BEZ-Coin: ${bezTokenAddress}`);
    }

    // Deploy Quality Oracle V2
    console.log("\n2️⃣  Deploying QualityOracle V2...");
    const QualityOracle = await hre.ethers.getContractFactory("QualityOracle");
    const qualityOracle = await QualityOracle.deploy(bezTokenAddress, TREASURY_DAO);
    await qualityOracle.waitForDeployment();
    const oracleAddress = await qualityOracle.getAddress();
    console.log("   ✅ QualityOracle deployed to:", oracleAddress);

    // Configurar umbrales por tipo de entidad
    console.log("\n3️⃣  Configurando umbrales por tipo de entidad...");

    const entityTypes = [
        { type: 0, name: "PRODUCT", threshold: 70 },
        { type: 1, name: "SERVICE", threshold: 75 },
        { type: 2, name: "NFT", threshold: 60 },
        { type: 3, name: "RWA", threshold: 85 },
        { type: 4, name: "LOGISTICS", threshold: 80 },
        { type: 5, name: "SDK_INTERACTION", threshold: 50 },
        { type: 6, name: "POST", threshold: 40 },
        { type: 7, name: "REVIEW", threshold: 65 },
        { type: 8, name: "TRANSACTION", threshold: 70 }
    ];

    for (const entity of entityTypes) {
        try {
            const tx = await qualityOracle.setEntityThreshold(entity.type, entity.threshold);
            await tx.wait();
            console.log(`   ✅ ${entity.name}: ${entity.threshold}%`);
        } catch (error) {
            console.log(`   ⚠️  ${entity.name}: Error configurando (${error.message})`);
        }
    }

    // Configurar el deployer como arbitrador inicial
    console.log("\n4️⃣  Configurando roles...");
    try {
        const ARBITRATOR_ROLE = await qualityOracle.ARBITRATOR_ROLE();
        const tx = await qualityOracle.grantRole(ARBITRATOR_ROLE, deployer.address);
        await tx.wait();
        console.log("   ✅ Arbitrator role granted to deployer");
    } catch (error) {
        console.log("   ⚠️  Error otorgando rol de arbitrador:", error.message);
    }

    // Guardar deployment info
    console.log("\n5️⃣  Guardando información de despliegue...");
    const deployment = {
        network: hre.network.name,
        chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
        timestamp: new Date().toISOString(),
        deployer: deployer.address,
        contracts: {
            qualityOracle: oracleAddress,
            bezCoin: OFFICIAL_BEZ_CONTRACT,
            treasuryDAO: TREASURY_DAO,
            lpPoolQuickSwap: LP_POOL_QUICKSWAP
        },
        entityThresholds: entityTypes.reduce((acc, e) => {
            acc[e.name] = e.threshold;
            return acc;
        }, {}),
        features: [
            "Multi-sector validation (9 entity types)",
            "Validator staking system (1000 BEZ minimum)",
            "Dispute resolution with arbitrator",
            "Penalty/reward system",
            "Configurable thresholds per entity type"
        ]
    };

    const deploymentsDir = "./deployments";
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const filename = `quality-oracle-v2-${hre.network.name}-${Date.now()}.json`;
    fs.writeFileSync(
        `${deploymentsDir}/${filename}`,
        JSON.stringify(deployment, null, 2)
    );
    console.log(`   ✅ Guardado en: ${deploymentsDir}/${filename}`);

    // Summary
    console.log("\n" + "═".repeat(70));
    console.log("🎉 QUALITY ORACLE V2 DEPLOYED SUCCESSFULLY!");
    console.log("═".repeat(70));
    console.log("\n📋 Contract Addresses:");
    console.log("   QualityOracle:", oracleAddress);
    console.log("   BEZ-Coin:", OFFICIAL_BEZ_CONTRACT);
    console.log("   Treasury DAO:", TREASURY_DAO);
    console.log("   LP Pool:", LP_POOL_QUICKSWAP);

    console.log("\n📊 Entity Validation Thresholds:");
    entityTypes.forEach(e => {
        console.log(`   ${e.name}: ${e.threshold}%`);
    });

    console.log("\n🔧 Próximos pasos:");
    console.log("   1. Verificar contrato en Polygonscan");
    console.log("   2. Registrar validadores iniciales");
    console.log("   3. Conectar con frontend (useQualityOracle hook)");
    console.log("   4. Integrar con BeZhasQualityEscrow existente");

    // Verificación automática en Polygonscan (si está en mainnet)
    if (hre.network.name === "polygon" || hre.network.name === "polygon-mainnet") {
        console.log("\n6️⃣  Verificando en Polygonscan...");
        try {
            await hre.run("verify:verify", {
                address: oracleAddress,
                constructorArguments: [OFFICIAL_BEZ_CONTRACT],
            });
            console.log("   ✅ Contrato verificado en Polygonscan");
        } catch (error) {
            console.log("   ⚠️  Error verificando:", error.message);
            console.log("   💡 Puedes verificar manualmente con:");
            console.log(`      npx hardhat verify --network polygon ${oracleAddress} ${OFFICIAL_BEZ_CONTRACT}`);
        }
    }

    return deployment;
}

main()
    .then((deployment) => {
        console.log("\n✅ Script completado exitosamente");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Error:", error);
        process.exit(1);
    });
