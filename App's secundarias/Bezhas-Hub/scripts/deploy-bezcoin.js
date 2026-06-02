// ⚠️⚠️⚠️ ADVERTENCIA ⚠️⚠️⚠️
// CONTRATO OFICIAL BEZ-COIN YA EXISTE:
// 0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
// NO EJECUTAR ESTE SCRIPT PARA BEZ-COIN
// Ver: CONTRATO_OFICIAL_BEZ.md

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const OFFICIAL_BEZ_CONTRACT = "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8";

async function main() {
    console.log("\n⛔ SCRIPT DESHABILITADO ⛔\n");
    console.log("El contrato BEZ-Coin oficial ya existe:");
    console.log(OFFICIAL_BEZ_CONTRACT);
    console.log("\nVer CONTRATO_OFICIAL_BEZ.md para más información.");
    console.log("\n🚫 NO CREAR NUEVOS CONTRATOS BEZ-COIN 🚫\n");
    process.exit(1);

    // Código original deshabilitado:
    console.log("\n🚀 Deploying BEZ-Coin Token to Polygon Amoy Testnet...\n");

    const [deployer] = await hre.ethers.getSigners();

    console.log("📍 Deployment Info:");
    console.log("  - Network:", hre.network.name);
    console.log("  - Deployer:", deployer.address);

    // Check deployer balance
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("  - Balance:", hre.ethers.formatEther(balance), "MATIC");

    if (balance === 0n) {
        console.log("\n❌ ERROR: Deployer has no MATIC for gas!");
        console.log("Get testnet MATIC from: https://faucet.polygon.technology/");
        process.exit(1);
    }

    // Initial supply: 100 million BEZ tokens (with 18 decimals)
    const initialSupply = hre.ethers.parseUnits("100000000", 18);
    console.log("\n💎 Token Configuration:");
    console.log("  - Name: Bez-Coin");
    console.log("  - Symbol: BEZ");
    console.log("  - Initial Supply:", hre.ethers.formatUnits(initialSupply, 18), "BEZ");
    console.log("  - Decimals: 18");

    console.log("\n⏳ Deploying BezhasToken contract...");

    const BezhasToken = await hre.ethers.getContractFactory("BezhasToken");
    const bezToken = await BezhasToken.deploy(initialSupply);

    console.log("  - Transaction sent, waiting for confirmation...");
    await bezToken.waitForDeployment();

    const tokenAddress = await bezToken.getAddress();

    console.log("\n✅ BEZ-Coin Token deployed successfully!");
    console.log("═══════════════════════════════════════════════");
    console.log("📍 Contract Address:", tokenAddress);
    console.log("═══════════════════════════════════════════════");

    // Verify token details
    console.log("\n🔍 Verifying deployment...");
    const name = await bezToken.name();
    const symbol = await bezToken.symbol();
    const decimals = await bezToken.decimals();
    const totalSupply = await bezToken.totalSupply();
    const ownerBalance = await bezToken.balanceOf(deployer.address);

    console.log("  - Name:", name);
    console.log("  - Symbol:", symbol);
    console.log("  - Decimals:", decimals.toString());
    console.log("  - Total Supply:", hre.ethers.formatUnits(totalSupply, 18), "BEZ");
    console.log("  - Owner Balance:", hre.ethers.formatUnits(ownerBalance, 18), "BEZ");

    // Update backend .env file
    const backendEnvPath = path.join(__dirname, "..", "backend", ".env");
    try {
        let envContent = fs.readFileSync(backendEnvPath, "utf8");

        // Replace BEZCOIN_ADDRESS
        if (envContent.includes("BEZCOIN_ADDRESS=")) {
            envContent = envContent.replace(
                /BEZCOIN_ADDRESS=.*/,
                `BEZCOIN_ADDRESS=${tokenAddress}`
            );
        } else {
            // Add if doesn't exist
            envContent += `\nBEZCOIN_ADDRESS=${tokenAddress}\n`;
        }

        fs.writeFileSync(backendEnvPath, envContent);
        console.log("\n✅ Updated backend/.env with new token address");
    } catch (error) {
        console.log("\n⚠️  Could not update backend/.env:", error.message);
    }

    // Save to contract addresses file
    const addressesPath = path.join(__dirname, "..", "backend", "contract-addresses.json");
    try {
        let addresses = {};
        if (fs.existsSync(addressesPath)) {
            addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
        }

        addresses.BezhasToken = tokenAddress;
        addresses.network = hre.network.name;
        addresses.deployedAt = new Date().toISOString();

        fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
        console.log("✅ Updated backend/contract-addresses.json");
    } catch (error) {
        console.log("⚠️  Could not update contract-addresses.json:", error.message);
    }

    console.log("\n📝 Next Steps:");
    console.log("═══════════════════════════════════════════════");
    console.log("1. Transfer tokens to Safe Wallet:");
    console.log(`   Safe: 0x3EfC42095E8503d41Ad8001328FC23388E00e8a3`);
    console.log(`   Command: npx hardhat run scripts/transfer-to-safe.js --network amoy`);
    console.log("");
    console.log("2. Approve Hot Wallet from Safe:");
    console.log(`   Hot Wallet: 0x52Df82920CBAE522880dD7657e43d1A754eD044E`);
    console.log("   Execute in Gnosis Safe: approve(hotWallet, maxUint256)");
    console.log("");
    console.log("3. Verify the setup:");
    console.log("   cd backend && node scripts/fiat-admin.js status");
    console.log("");
    console.log("4. View on PolygonScan:");
    console.log(`   https://amoy.polygonscan.com/address/${tokenAddress}`);
    console.log("═══════════════════════════════════════════════");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Deployment failed:", error);
        process.exit(1);
    });
