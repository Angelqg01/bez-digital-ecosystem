const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const provider = hre.ethers.provider;

    console.log("\n" + "=".repeat(60));
    console.log("💰 WALLET BALANCE CHECK - Polygon Amoy");
    console.log("=".repeat(60) + "\n");

    console.log("📍 Network:", hre.network.name);
    console.log("📍 Chain ID:", (await provider.getNetwork()).chainId);
    console.log("📍 Wallet:", deployer.address);

    const balance = await provider.getBalance(deployer.address);
    const balanceInMatic = parseFloat(hre.ethers.formatEther(balance));

    console.log("\n💵 Current Balance:");
    console.log("   Wei:", balance.toString());
    console.log("   MATIC:", balanceInMatic.toFixed(6));

    const feeData = await provider.getFeeData();
    const gasPriceGwei = parseFloat(hre.ethers.formatUnits(feeData.gasPrice || 0, "gwei"));
    console.log("\n⛽ Gas Info:");
    console.log("   Gas Price:", gasPriceGwei.toFixed(2), "gwei");

    // Estimate deployment costs
    const estimatedGas = 4550000; // ~4.55M gas for full deployment
    const estimatedCostWei = BigInt(estimatedGas) * (feeData.gasPrice || BigInt(0));
    const estimatedCostMatic = parseFloat(hre.ethers.formatEther(estimatedCostWei));

    console.log("\n📊 Deployment Cost Estimate:");
    console.log("   Estimated Gas:", estimatedGas.toLocaleString());
    console.log("   Estimated Cost:", estimatedCostMatic.toFixed(6), "MATIC");

    console.log("\n" + "=".repeat(60));

    const minRequired = 0.05;
    const recommended = 0.1;

    if (balanceInMatic < minRequired) {
        console.log("❌ INSUFFICIENT FUNDS FOR DEPLOYMENT");
        console.log("=".repeat(60));
        console.log("\n⚠️  Status:");
        console.log("   Current:", balanceInMatic.toFixed(6), "MATIC");
        console.log("   Required:", minRequired, "MATIC (minimum)");
        console.log("   Shortage:", (minRequired - balanceInMatic).toFixed(6), "MATIC");
        console.log("   Recommended:", recommended, "MATIC (with safety margin)");

        console.log("\n💡 Get MATIC from faucet:");
        console.log("   🌐 https://faucet.polygon.technology/");
        console.log("   1. Select 'Polygon Amoy'");
        console.log("   2. Paste wallet:", deployer.address);
        console.log("   3. Complete CAPTCHA");
        console.log("   4. Wait 1-2 minutes");
        console.log("   5. You'll receive: 0.1 - 0.5 MATIC");

        console.log("\n📖 For more faucet options:");
        console.log("   See: ERROR_FONDOS_INSUFICIENTES.md\n");

        process.exitCode = 1;
    } else if (balanceInMatic < recommended) {
        console.log("⚠️  MARGINAL BALANCE - DEPLOYMENT MAY FAIL");
        console.log("=".repeat(60));
        console.log("\n⚠️  Warning:");
        console.log("   Current:", balanceInMatic.toFixed(6), "MATIC");
        console.log("   Minimum:", minRequired, "MATIC");
        console.log("   Recommended:", recommended, "MATIC");
        console.log("   Margin:", (balanceInMatic - minRequired).toFixed(6), "MATIC");

        console.log("\n💡 Recommendation:");
        console.log("   Get more MATIC from faucet to avoid failures");
        console.log("   🌐 https://faucet.polygon.technology/");
        console.log("\n✅ You can try deployment, but it might fail due to gas fluctuations\n");
    } else {
        console.log("✅ SUFFICIENT BALANCE FOR DEPLOYMENT");
        console.log("=".repeat(60));
        console.log("\n✅ Status:");
        console.log("   Current:", balanceInMatic.toFixed(6), "MATIC");
        console.log("   Required:", minRequired, "MATIC");
        console.log("   Excess:", (balanceInMatic - minRequired).toFixed(6), "MATIC");

        console.log("\n🚀 Ready to deploy! Run:");
        console.log("   npm run deploy:quality-oracle");
        console.log("");
    }
}

main().catch((error) => {
    console.error("\n❌ Error checking balance:", error.message);
    process.exitCode = 1;
});
