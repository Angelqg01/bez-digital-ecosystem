const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// --- CONFIGURACIÓN ---
// Dirección FIJA del token existente
const BEZHAS_TOKEN_ADDRESS = "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8";

// Configuración de routers CCIP
const networkConfig = {
  sepolia: { router: "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59" },
  amoy: { router: "0x9C32fCB86BF0f4a1A8921a9Fe46de3198bb884B2" },
  polygon: { router: "0x3C3D92629A02a8D95D5CB9650fe641a0CBB45490" }, // Router Mainnet Polygon
  hardhat: { router: "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF" },
};

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const networkName = hre.network.name;

  console.log(`\n🚀 Iniciando despliegue (Recuperación Inteligente) en: ${networkName}`);
  console.log(`👤 Desplegador: ${deployer.address}`);
  console.log(`🪙 Token Base: ${BEZHAS_TOKEN_ADDRESS}`);

  // 1. Cargar configuración existente para evitar redespliegues
  const backendConfigPath = path.resolve(__dirname, "../backend/config.json");
  let existingConfig = {};
  if (fs.existsSync(backendConfigPath)) {
    try {
      existingConfig = JSON.parse(fs.readFileSync(backendConfigPath, "utf8"));
      console.log("   📂 Configuración previa cargada. Se omitirán contratos ya desplegados.");
    } catch (e) {
      console.warn("   ⚠️ Error leyendo config.json, se iniciará desde cero.");
    }
  }
  const existingAddresses = existingConfig.contractAddresses || {};

  // Helper para desplegar o cargar
  const deployOrLoad = async (contractName, args = [], keyName) => {
    // Si ya existe en el config y tiene dirección, lo reutilizamos
    if (existingAddresses[keyName] && hre.ethers.isAddress(existingAddresses[keyName])) {
      console.log(`\n⏭️  ${contractName} ya existe en ${existingAddresses[keyName]} (Omitido)`);
      return { target: existingAddresses[keyName], isNew: false };
    }

    console.log(`\n🚀 Desplegando ${contractName}...`);
    try {
      const contract = await hre.ethers.deployContract(contractName, args);
      await contract.waitForDeployment();
      console.log(`   ✅ ${contractName} desplegado en: ${contract.target}`);

      // Esperar confirmaciones si es red pública
      if (networkName !== "hardhat" && networkName !== "localhost") {
        console.log("   ⏳ Esperando confirmaciones...");
        await contract.deploymentTransaction().wait(2);
      }

      return { target: contract.target, isNew: true };
    } catch (error) {
      console.error(`   ❌ Error desplegando ${contractName}: ${error.message}`);
      throw error;
    }
  };

  try {
    // --- CONTRATOS ---

    // 2. UserProfile
    const userProfile = await deployOrLoad("UserProfile", [deployer.address], "UserProfileAddress");

    // 3. Post
    const post = await deployOrLoad("Post", [userProfile.target], "PostAddress");

    // 4. BezhasNFT
    const bezhasNFT = await deployOrLoad("BezhasNFT", [], "BezhasNFTAddress");

    // 5. AdvancedMarketplace
    const marketplace = await deployOrLoad("AdvancedMarketplace", [BEZHAS_TOKEN_ADDRESS, deployer.address], "MarketplaceAddress");

    // 6. StakingPool
    const stakingPool = await deployOrLoad("StakingPool", [deployer.address, BEZHAS_TOKEN_ADDRESS], "StakingPoolAddress");

    // 7. TokenSale
    const tokenPrice = hre.ethers.parseEther("0.001");
    const tokenSale = await deployOrLoad("TokenSale", [BEZHAS_TOKEN_ADDRESS, deployer.address, tokenPrice], "TokenSaleAddress");

    // 8. Messages
    const messages = await deployOrLoad("Messages", [], "MessagesAddress");

    // 9. BezhasBridge
    const routerAddress = networkConfig[networkName]?.router || deployer.address;
    const bezhasBridge = await deployOrLoad("BezhasBridge", [routerAddress, BEZHAS_TOKEN_ADDRESS], "BezhasBridgeAddress");

    // 10. BeZhasMarketplace (Main)
    const vendorFee = hre.ethers.parseUnits("500", 18);
    const platformCommission = 250;
    const bezhasMarketplace = await deployOrLoad("BeZhasMarketplace", [BEZHAS_TOKEN_ADDRESS, vendorFee, platformCommission], "BeZhasMarketplaceAddress");

    // 11. GamificationSystem
    const gamificationSystem = await deployOrLoad("GamificationSystem", [BEZHAS_TOKEN_ADDRESS], "GamificationAddress");

    // 12. Desplegar Logística
    const Logistics = await hre.ethers.getContractFactory("LogisticsContainer");
    const logistics = await Logistics.deploy();
    await logistics.waitForDeployment();
    console.log(`Logística NFT desplegado en: ${await logistics.getAddress()}`);

    // 13. Desplegar Real Estate
    const RealEstate = await hre.ethers.getContractFactory("BeZhasRealEstate");
    const realEstate = await RealEstate.deploy();
    await realEstate.waitForDeployment();
    console.log(`Real Estate Token desplegado en: ${await realEstate.getAddress()}`);

    // --- GUARDAR ---
    const finalAddresses = {
      UserProfileAddress: userProfile.target,
      PostAddress: post.target,
      BezhasNFTAddress: bezhasNFT.target,
      MarketplaceAddress: marketplace.target,
      StakingPoolAddress: stakingPool.target,
      BezhasTokenAddress: BEZHAS_TOKEN_ADDRESS,
      TokenSaleAddress: tokenSale.target,
      MessagesAddress: messages.target,
      BezhasBridgeAddress: bezhasBridge.target,
      BeZHasMarketplaceAddress: bezhasMarketplace.target,
      GamificationAddress: gamificationSystem.target,
      LogisticsContainerAddress: logistics.target,
      BeZhasRealEstateAddress: realEstate.target
    };

    // Guardamos en disco inmediatamente
    const newConfig = { ...existingConfig, contractAddresses: finalAddresses };
    fs.writeFileSync(backendConfigPath, JSON.stringify(newConfig, null, 2));
    console.log(`\n💾 Configuración actualizada en ${backendConfigPath}`);

    // --- POST-DEPLOYMENT SETUP ---
    console.log("\n⚙️  Configuración Post-Despliegue...");

    // Solo intentamos configurar si tenemos acceso al token
    let bezhasTokenContract;
    try {
      bezhasTokenContract = await hre.ethers.getContractAt("BezhasToken", BEZHAS_TOKEN_ADDRESS);
    } catch (e) { }

    if (bezhasTokenContract && bezhasBridge.isNew) {
      try {
        console.log("   -> Configurando roles del Bridge...");
        const minterRole = await bezhasTokenContract.MINTER_ROLE();
        const burnerRole = await bezhasTokenContract.BURNER_ROLE();
        await (await bezhasTokenContract.grantRole(minterRole, bezhasBridge.target)).wait();
        await (await bezhasTokenContract.grantRole(burnerRole, bezhasBridge.target)).wait();
        console.log("      ✅ Roles asignados.");
      } catch (e) { console.log("      ⚠️ No se pudieron asignar roles (¿Falta admin?)."); }
    }

    if (bezhasTokenContract && tokenSale.isNew) {
      try {
        console.log("   -> Fondeando TokenSale...");
        const amount = hre.ethers.parseUnits("50000", 18);
        if ((await bezhasTokenContract.balanceOf(deployer.address)) >= amount) {
          await (await bezhasTokenContract.transfer(tokenSale.target, amount)).wait();
          console.log("      ✅ TokenSale fondeado.");
        }
      } catch (e) { console.log("      ⚠️ No se pudo fondear TokenSale."); }
    }

    console.log("\n✨ Despliegue Finalizado Exitosamente!");

  } catch (error) {
    console.error("\n❌ Error Fatal:", error);
    process.exitCode = 1;
  }
}

main();
