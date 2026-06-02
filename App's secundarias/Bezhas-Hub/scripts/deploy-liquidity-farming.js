/**
 * Script de Despliegue - Liquidity Farming
 * Despliega el contrato LiquidityFarming y configura pools iniciales
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🌾 Iniciando despliegue de Liquidity Farming System...\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("🔑 Desplegando con la cuenta:", deployer.address);
    console.log("   Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

    // 1. Obtener direcciones de contratos necesarios
    const REWARD_TOKEN = process.env.BEZHAS_TOKEN_ADDRESS || "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8";
    const REWARD_PER_BLOCK = hre.ethers.parseEther("0.1"); // 0.1 BEZ por bloque
    const START_BLOCK = await hre.ethers.provider.getBlockNumber();
    const BONUS_END_BLOCK = START_BLOCK + (365 * 24 * 60 * 60 / 2); // ~1 año (2 seg/bloque)

    console.log("📋 Configuración:");
    console.log("   Reward Token:", REWARD_TOKEN);
    console.log("   Reward per Block:", hre.ethers.formatEther(REWARD_PER_BLOCK), "BEZ");
    console.log("   Start Block:", START_BLOCK);
    console.log("   Bonus End Block:", BONUS_END_BLOCK, "\n");

    // 2. Desplegar LiquidityFarming
    console.log("📦 Desplegando LiquidityFarming...");
    const LiquidityFarming = await hre.ethers.getContractFactory("LiquidityFarming");
    const farming = await LiquidityFarming.deploy(
        REWARD_TOKEN,
        REWARD_PER_BLOCK,
        START_BLOCK,
        BONUS_END_BLOCK
    );

    await farming.waitForDeployment();
    const farmingAddress = await farming.getAddress();
    console.log("✅ LiquidityFarming desplegado en:", farmingAddress);

    // 3. Configurar roles
    console.log("\n🔐 Configurando roles...");
    const ADMIN_ROLE = await farming.ADMIN_ROLE();
    const OPERATOR_ROLE = await farming.OPERATOR_ROLE();

    // El deployer ya tiene el rol de admin por defecto
    console.log("✅ Admin Role asignado a:", deployer.address);

    // 4. Crear pool inicial (si hay LP token disponible)
    console.log("\n🏊 Configurando pool inicial...");

    // Pool para BEZ Token (como ejemplo, en producción sería un LP token)
    const ALLOC_POINT = 100; // Weight del pool
    const MIN_STAKE = hre.ethers.parseEther("1"); // Mínimo 1 BEZ
    const MAX_STAKE = hre.ethers.parseEther("1000000"); // Máximo 1M BEZ
    const WITH_UPDATE = true;

    try {
        const tx = await farming.add(
            ALLOC_POINT,
            REWARD_TOKEN, // En producción usar LP token
            MIN_STAKE,
            MAX_STAKE,
            WITH_UPDATE
        );
        await tx.wait();
        console.log("✅ Pool inicial creado (Pool ID: 0)");
        console.log("   LP Token:", REWARD_TOKEN);
        console.log("   Alloc Point:", ALLOC_POINT);
        console.log("   Min Stake:", hre.ethers.formatEther(MIN_STAKE), "BEZ");
        console.log("   Max Stake:", hre.ethers.formatEther(MAX_STAKE), "BEZ");
    } catch (error) {
        console.log("⚠️  No se pudo crear pool inicial:", error.message);
    }

    // 5. Configurar multiplicadores de lock
    console.log("\n⏱️  Configurando multiplicadores de lock...");
    const lockPeriods = [
        { period: 7 * 24 * 60 * 60, multiplier: 110, name: "7 días - 10% boost" },
        { period: 30 * 24 * 60 * 60, multiplier: 125, name: "30 días - 25% boost" },
        { period: 90 * 24 * 60 * 60, multiplier: 150, name: "90 días - 50% boost" },
        { period: 180 * 24 * 60 * 60, multiplier: 200, name: "180 días - 100% boost" },
        { period: 365 * 24 * 60 * 60, multiplier: 300, name: "365 días - 200% boost" }
    ];

    try {
        for (const lock of lockPeriods) {
            const tx = await farming.setLockMultiplier(lock.period, lock.multiplier);
            await tx.wait();
            console.log(`✅ ${lock.name}`);
        }
    } catch (error) {
        console.log("⚠️  No se pudieron configurar multiplicadores:", error.message);
    }

    // 6. Transferir tokens de recompensa al contrato
    console.log("\n💰 Fondeo del contrato con tokens de recompensa...");
    try {
        const rewardToken = await hre.ethers.getContractAt("IERC20", REWARD_TOKEN);
        const fundAmount = hre.ethers.parseEther("100000"); // 100k BEZ para recompensas

        // Verificar balance del deployer
        const deployerBalance = await rewardToken.balanceOf(deployer.address);
        console.log("   Balance del deployer:", hre.ethers.formatEther(deployerBalance), "BEZ");

        if (deployerBalance >= fundAmount) {
            const transferTx = await rewardToken.transfer(farmingAddress, fundAmount);
            await transferTx.wait();
            console.log("✅ Transferidos:", hre.ethers.formatEther(fundAmount), "BEZ al contrato");
        } else {
            console.log("⚠️  Balance insuficiente para fondear el contrato");
            console.log("   Se necesitan al menos:", hre.ethers.formatEther(fundAmount), "BEZ");
        }
    } catch (error) {
        console.log("⚠️  No se pudo fondear el contrato:", error.message);
    }

    // 7. Guardar información de despliegue
    console.log("\n💾 Guardando información de despliegue...");

    const network = hre.network.name;
    const deploymentInfo = {
        network: network,
        contractName: "LiquidityFarming",
        address: farmingAddress,
        rewardToken: REWARD_TOKEN,
        rewardPerBlock: REWARD_PER_BLOCK.toString(),
        startBlock: START_BLOCK,
        bonusEndBlock: BONUS_END_BLOCK,
        deployer: deployer.address,
        deployedAt: new Date().toISOString(),
        pools: [
            {
                id: 0,
                lpToken: REWARD_TOKEN,
                allocPoint: ALLOC_POINT,
                minStake: MIN_STAKE.toString(),
                maxStake: MAX_STAKE.toString()
            }
        ],
        lockMultipliers: lockPeriods
    };

    // Guardar en archivo JSON
    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const deploymentFile = path.join(deploymentsDir, `liquidity-farming-${network}.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    console.log("✅ Información guardada en:", deploymentFile);

    // 8. Actualizar .env con la nueva dirección
    console.log("\n📝 Actualizando .env...");
    const envPath = path.join(__dirname, "../.env");
    let envContent = "";

    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, "utf8");
    }

    const envKey = network === "localhost"
        ? "LIQUIDITY_FARMING_ADDRESS_LOCAL"
        : network === "amoy"
            ? "LIQUIDITY_FARMING_ADDRESS_AMOY"
            : "LIQUIDITY_FARMING_ADDRESS_POLYGON";

    // Agregar o actualizar la variable
    const regex = new RegExp(`^${envKey}=.*$`, "m");
    if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${envKey}="${farmingAddress}"`);
    } else {
        envContent += `\n${envKey}="${farmingAddress}"\n`;
    }

    fs.writeFileSync(envPath, envContent);
    console.log(`✅ Variable ${envKey} actualizada en .env`);

    // 9. Actualizar SDK config
    console.log("\n🔧 Actualizando SDK config...");
    const sdkConfigPath = path.join(__dirname, "../sdk/contracts.js");

    console.log("⚠️  Recuerda actualizar manualmente el SDK en sdk/contracts.js si es necesario");
    console.log("   Agregar la dirección en el objeto de addresses para la red:", network);

    // 10. Resumen final
    console.log("\n" + "=".repeat(70));
    console.log("✅ DESPLIEGUE COMPLETADO");
    console.log("=".repeat(70));
    console.log("📋 Información:");
    console.log("   Network:", network);
    console.log("   LiquidityFarming:", farmingAddress);
    console.log("   Reward Token:", REWARD_TOKEN);
    console.log("   Pools creados: 1");
    console.log("   Lock Multipliers:", lockPeriods.length);
    console.log("\n📚 Próximos pasos:");
    console.log("   1. Verificar el contrato en el explorador (opcional)");
    console.log("   2. Probar el SDK: node sdk/test-contracts-sdk.js");
    console.log("   3. Iniciar el backend con la nueva dirección");
    console.log("   4. Probar la UI en el frontend");
    console.log("\n💡 Comandos útiles:");
    console.log("   Verificar contrato:");
    console.log(`   npx hardhat verify --network ${network} ${farmingAddress} "${REWARD_TOKEN}" "${REWARD_PER_BLOCK}" ${START_BLOCK} ${BONUS_END_BLOCK}`);
    console.log("\n   Interactuar con el contrato:");
    console.log(`   npx hardhat console --network ${network}`);
    console.log("=".repeat(70));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
