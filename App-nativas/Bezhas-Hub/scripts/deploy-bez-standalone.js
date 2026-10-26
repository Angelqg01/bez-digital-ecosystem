// ⚠️⚠️⚠️ ADVERTENCIA ⚠️⚠️⚠️
// CONTRATO OFICIAL BEZ-COIN YA EXISTE:
// 0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
// NO EJECUTAR ESTE SCRIPT PARA BEZ-COIN
// Ver: CONTRATO_OFICIAL_BEZ.md

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const OFFICIAL_BEZ_CONTRACT = "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8";

// ABI del contrato BezhasToken (solo lo necesario para desplegar)
const BEZ_TOKEN_ABI = [
    "constructor(uint256 initialSupply)",
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)"
];

// Bytecode compilado del BezhasToken (se genera al compilar el contrato)
async function deployToken() {
    console.log("\n⛔ SCRIPT DESHABILITADO ⛔\n");
    console.log("El contrato BEZ-Coin oficial ya existe:");
    console.log(OFFICIAL_BEZ_CONTRACT);
    console.log("\nVer CONTRATO_OFICIAL_BEZ.md para más información.");
    console.log("\n🚫 NO CREAR NUEVOS CONTRATOS BEZ-COIN 🚫\n");
    process.exit(1);

    // Código original deshabilitado:
    console.log("\n🚀 Deploying BEZ-Coin Token to Polygon Amoy Testnet...\n");

    // Configurar provider y wallet
    const rpcUrl = process.env.AMOY_RPC_URL || process.env.POLYGON_AMOY_RPC || 'https://polygon-amoy-bor-rpc.publicnode.com';
    const privateKey = process.env.PRIVATE_KEY;

    if (!privateKey) {
        console.error("❌ ERROR: PRIVATE_KEY not found in .env file!");
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey.startsWith('0x') ? privateKey : '0x' + privateKey, provider);

    console.log("📍 Deployment Info:");
    console.log("  - Network: Polygon Amoy Testnet");
    console.log("  - RPC:", rpcUrl);
    console.log("  - Deployer:", wallet.address);

    // Check balance
    const balance = await provider.getBalance(wallet.address);
    console.log("  - Balance:", ethers.formatEther(balance), "MATIC");

    if (balance === 0n) {
        console.log("\n❌ ERROR: Wallet has no MATIC for gas!");
        console.log("Get testnet MATIC from: https://faucet.polygon.technology/");
        console.log("Send MATIC to:", wallet.address);
        process.exit(1);
    }

    // Leer bytecode compilado
    const artifactPath = path.join(__dirname, '../artifacts/contracts/BezhasToken.sol/BezhasToken.json');

    if (!fs.existsSync(artifactPath)) {
        console.log("\n❌ ERROR: Contract not compiled!");
        console.log("Please run: npx hardhat compile");
        console.log("Expected file:", artifactPath);
        process.exit(1);
    }

    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    const bytecode = artifact.bytecode;

    // Initial supply: 100 million BEZ tokens (with 18 decimals)
    const initialSupply = ethers.parseUnits("100000000", 18);

    console.log("\n💎 Token Configuration:");
    console.log("  - Name: Bez-Coin");
    console.log("  - Symbol: BEZ");
    console.log("  - Initial Supply:", ethers.formatUnits(initialSupply, 18), "BEZ");
    console.log("  - Decimals: 18");

    console.log("\n⏳ Deploying BezhasToken contract...");

    try {
        // Crear factory y desplegar
        const factory = new ethers.ContractFactory(artifact.abi, bytecode, wallet);
        const contract = await factory.deploy(initialSupply);

        console.log("  - Transaction sent:", contract.deploymentTransaction().hash);
        console.log("  - Waiting for confirmation...");

        await contract.waitForDeployment();
        const tokenAddress = await contract.getAddress();

        console.log("\n✅ BEZ-Coin Token deployed successfully!");
        console.log("═══════════════════════════════════════════════");
        console.log("📍 Contract Address:", tokenAddress);
        console.log("═══════════════════════════════════════════════");

        // Verify token details
        console.log("\n🔍 Verifying deployment...");
        const name = await contract.name();
        const symbol = await contract.symbol();
        const decimals = await contract.decimals();
        const totalSupply = await contract.totalSupply();
        const ownerBalance = await contract.balanceOf(wallet.address);

        console.log("  - Name:", name);
        console.log("  - Symbol:", symbol);
        console.log("  - Decimals:", decimals.toString());
        console.log("  - Total Supply:", ethers.formatUnits(totalSupply, 18), "BEZ");
        console.log("  - Owner Balance:", ethers.formatUnits(ownerBalance, 18), "BEZ");

        // Update backend .env file
        const backendEnvPath = path.join(__dirname, "..", "backend", ".env");
        try {
            let envContent = fs.readFileSync(backendEnvPath, "utf8");

            if (envContent.includes("BEZCOIN_ADDRESS=")) {
                envContent = envContent.replace(
                    /BEZCOIN_ADDRESS=.*/,
                    `BEZCOIN_ADDRESS=${tokenAddress}`
                );
            } else {
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
            addresses.network = "amoy";
            addresses.deployedAt = new Date().toISOString();

            fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
            console.log("✅ Updated backend/contract-addresses.json");
        } catch (error) {
            console.log("⚠️  Could not update contract-addresses.json:", error.message);
        }

        console.log("\n📝 Next Steps:");
        console.log("═══════════════════════════════════════════════");
        console.log("1. Transfer tokens to Safe Wallet:");
        console.log(`   node backend/scripts/transfer-to-safe.js`);
        console.log("");
        console.log("2. Approve Hot Wallet from Safe:");
        console.log(`   Hot Wallet: 0x52Df82920CBAE522880dD7657e43d1A754eD044E`);
        console.log("   Go to https://app.safe.global/ and execute:");
        console.log(`   approve(0x52Df82920CBAE522880dD7657e43d1A754eD044E, ${ethers.MaxUint256})`);
        console.log("");
        console.log("3. Verify the setup:");
        console.log("   cd backend && node scripts/fiat-admin.js status");
        console.log("");
        console.log("4. View on PolygonScan:");
        console.log(`   https://amoy.polygonscan.com/address/${tokenAddress}`);
        console.log("═══════════════════════════════════════════════");

    } catch (error) {
        console.error("\n❌ Deployment failed:", error.message);
        if (error.code === 'INSUFFICIENT_FUNDS') {
            console.log("\nYou need more MATIC for gas fees.");
            console.log("Get testnet MATIC from: https://faucet.polygon.technology/");
        }
        process.exit(1);
    }
}

deployToken();
