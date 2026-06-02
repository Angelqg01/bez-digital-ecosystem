const hre = require("hardhat");

async function main() {
    const provider = hre.ethers.provider;

    console.log("\n" + "=".repeat(60));
    console.log("🔍 CHECKING SAFE WALLET BALANCE");
    console.log("=".repeat(60) + "\n");

    // Safe Wallet address
    const safeAddress = "0x3EfC42095E8503d41Ad8001328FC23388E00e8a3";

    // Current EOA address
    const [deployer] = await hre.ethers.getSigners();
    const eoaAddress = deployer.address;

    console.log("📍 Addresses:");
    console.log("   Safe Wallet:", safeAddress);
    console.log("   EOA (deployment):", eoaAddress);
    console.log("   Network:", hre.network.name);

    // Check Safe Wallet balance
    const safeBalance = await provider.getBalance(safeAddress);
    const safeBalanceMatic = parseFloat(hre.ethers.formatEther(safeBalance));

    console.log("\n💰 Safe Wallet Balance:");
    console.log("   Wei:", safeBalance.toString());
    console.log("   MATIC:", safeBalanceMatic.toFixed(6));

    // Check EOA balance
    const eoaBalance = await provider.getBalance(eoaAddress);
    const eoaBalanceMatic = parseFloat(hre.ethers.formatEther(eoaBalance));

    console.log("\n💰 EOA Balance:");
    console.log("   Wei:", eoaBalance.toString());
    console.log("   MATIC:", eoaBalanceMatic.toFixed(6));

    console.log("\n" + "=".repeat(60));

    const minRequired = 0.1;
    const transferAmount = 0.15; // Transfer 0.15 MATIC

    if (safeBalanceMatic < minRequired) {
        console.log("❌ SAFE WALLET HAS INSUFFICIENT FUNDS");
        console.log("=".repeat(60));
        console.log("\n⚠️  Safe Wallet also needs more MATIC");
        console.log("   Current:", safeBalanceMatic.toFixed(6), "MATIC");
        console.log("   Required:", minRequired, "MATIC");
        console.log("\n💡 Both wallets need funding from faucet:");
        console.log("   🌐 https://faucet.polygon.technology/");
        console.log("");
        process.exitCode = 1;
    } else {
        console.log("✅ SAFE WALLET HAS SUFFICIENT FUNDS");
        console.log("=".repeat(60));
        console.log("\n💵 Safe has:", safeBalanceMatic.toFixed(6), "MATIC");
        console.log("   Recommended transfer:", transferAmount, "MATIC");
        console.log("   This would give EOA:", (eoaBalanceMatic + transferAmount).toFixed(6), "MATIC");

        console.log("\n🔄 How to Transfer from Safe to EOA:");
        console.log("\n📱 Option 1: Using Safe UI (Recommended)");
        console.log("   1. Go to: https://app.safe.global/");
        console.log("   2. Connect and select Polygon Amoy network");
        console.log("   3. Select your Safe:", safeAddress);
        console.log("   4. Click 'New Transaction' → 'Send Token'");
        console.log("   5. Asset: MATIC (native)");
        console.log("   6. Recipient:", eoaAddress);
        console.log("   7. Amount:", transferAmount, "MATIC");
        console.log("   8. Review and execute");
        console.log("   9. Wait for confirmation (~1 min)");

        console.log("\n💻 Option 2: Using MetaMask");
        console.log("   1. Open MetaMask");
        console.log("   2. Switch to Polygon Amoy network");
        console.log("   3. Connect to your Safe (if configured)");
        console.log("   4. Send", transferAmount, "MATIC to:", eoaAddress);

        console.log("\n🔑 Option 3: Script Transfer (if you have Safe signer key)");
        console.log("   If you have a private key of one of the Safe signers:");
        console.log("   Run: npm run transfer-from-safe");

        console.log("\n⏭️  After Transfer:");
        console.log("   1. Wait for transaction confirmation");
        console.log("   2. Run: npm run check-balance");
        console.log("   3. Run: npm run deploy:quality-oracle");
        console.log("");
    }
}

main().catch((error) => {
    console.error("\n❌ Error:", error.message);
    process.exitCode = 1;
});
