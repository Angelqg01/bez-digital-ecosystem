const hre = require("hardhat");

/**
 * Script to transfer MATIC from Safe Wallet to EOA
 * 
 * IMPORTANT: This requires you to have the private key of a Safe signer
 * and enough signers to meet the threshold.
 * 
 * For most cases, use Safe UI instead: https://app.safe.global/
 */

async function main() {
    console.log("\n" + "=".repeat(60));
    console.log("🔄 TRANSFER FROM SAFE WALLET TO EOA");
    console.log("=".repeat(60) + "\n");

    // Check if we have a Safe signer key
    const safeSignerKey = process.env.SAFE_SIGNER_PRIVATE_KEY;

    if (!safeSignerKey) {
        console.log("❌ SAFE_SIGNER_PRIVATE_KEY not found in .env");
        console.log("\n⚠️  This script requires a private key of a Safe signer.");
        console.log("\nℹ️  Safe Wallets are multi-signature contracts and cannot be");
        console.log("   accessed directly with hardhat's default configuration.");
        console.log("\n✅ RECOMMENDED APPROACH:");
        console.log("   Use Safe UI to transfer funds manually:");
        console.log("\n   1. Go to: https://app.safe.global/");
        console.log("   2. Connect your wallet (signer of the Safe)");
        console.log("   3. Select Polygon Amoy network");
        console.log("   4. Select Safe:", "0x3EfC42095E8503d41Ad8001328FC23388E00e8a3");
        console.log("   5. New Transaction → Send Token");
        console.log("   6. Send 0.15 MATIC to:", "0x52Df82920CBAE522880dD7657e43d1A754eD044E");
        console.log("\n📖 Documentation:");
        console.log("   https://docs.safe.global/");
        console.log("");
        process.exitCode = 1;
        return;
    }

    // If they have Safe SDK installed, we could implement the transfer
    // For now, guide them to use Safe UI
    console.log("⚠️  Safe transactions require multiple signatures.");
    console.log("   Please use Safe UI for transfers.");
    console.log("\n🌐 https://app.safe.global/");
    console.log("");
}

main().catch((error) => {
    console.error("\n❌ Error:", error.message);
    process.exitCode = 1;
});
