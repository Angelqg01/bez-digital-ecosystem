const { ethers } = require("ethers");
const fs = require("fs");
require("dotenv").config();

/**
 * Script de despliegue directo - NFT Marketplace Extensions
 * Despliega: NFTOffers y NFTRental
 * Network: Polygon Mainnet
 * Ethers: v5
 */

const PAYMENT_TOKEN = "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8"; // BEZ-Coin

// Artifacts
const offersArtifact = require("../artifacts/contracts/NFTOffers.sol/NFTOffers.json");
const rentalArtifact = require("../artifacts/contracts/NFTRental.sol/NFTRental.json");

async function main() {
    console.log("\n🎨 Desplegando NFT Marketplace Extensions (Polygon Mainnet)...");
    console.log("⚠️  RED DE PRODUCCIÓN");

    // Setup
    const rpcUrl = process.env.POLYGON_MAINNET_RPC || process.env.POLYGON_RPC_URL || "https://polygon-bor.publicnode.com";
    console.log("📡 RPC:", rpcUrl);

    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) throw new Error("❌ PRIVATE_KEY missing");

    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log("📝 Deployer:", wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log("💰 Balance:", ethers.utils.formatEther(balance), "MATIC");

    // Gas Config
    const overrides = {
        maxPriorityFeePerGas: ethers.utils.parseUnits("35", "gwei"),
        maxFeePerGas: ethers.utils.parseUnits("300", "gwei"),
    };
    console.log("⛽ Gas: 35 Gwei priority, 300 Gwei max\n");

    // ========================================================
    // 1. DEPLOY NFT OFFERS
    // ========================================================
    console.log("📦 Desplegando NFTOffers...");
    const OffersFactory = new ethers.ContractFactory(
        offersArtifact.abi,
        offersArtifact.bytecode,
        wallet
    );

    // Constructor requires: (address _paymentToken, address _feeRecipient)
    const offers = await OffersFactory.deploy(PAYMENT_TOKEN, wallet.address, overrides);
    rentalArtifact.bytecode,
        wallet
    );

    const rental = await RentalFactory.deploy(PAYMENT_TOKEN, overrides);
    console.log("   Tx Hash:", rental.deployTransaction.hash);
    await rental.deployed();
    console.log("✅ NFTRental Address:", rental.address);

    // ========================================================
    // SUMMARY
    // ========================================================
    console.log("\n" + "=".repeat(60));
    console.log("🎉 NFT MARKETPLACE EXTENSIONS DEPLOYED!");
    console.log("=".repeat(60));
    console.log("\n📋 Contratos desplegados:\n");
    console.log("NFTOffers:", offers.address);
    console.log("NFTRental:", rental.address);
    console.log("\n📝 Variables de entorno:\n");
    console.log("# Backend .env");
    console.log(`NFT_OFFERS_ADDRESS=${offers.address}`);
    console.log(`NFT_RENTAL_ADDRESS=${rental.address}`);
    console.log("\n# Frontend .env");
    console.log(`VITE_NFT_OFFERS_ADDRESS=${offers.address}`);
    console.log(`VITE_NFT_RENTAL_ADDRESS=${rental.address}`);
    console.log("\n" + "=".repeat(60));

    // Save deployment data
    const deploymentData = {
        network: "polygon",
        chainId: 137,
        timestamp: new Date().toISOString(),
        deployer: wallet.address,
        contracts: {
            nftOffers: {
                address: offers.address,
                txHash: offers.deployTransaction.hash,
                params: {
                    paymentToken: PAYMENT_TOKEN
                }
            },
            nftRental: {
                address: rental.address,
                txHash: rental.deployTransaction.hash,
                params: {
                    paymentToken: PAYMENT_TOKEN
                }
            }
        }
    };

    fs.writeFileSync("nft-extensions-deployment.json", JSON.stringify(deploymentData, null, 2));
    console.log("✅ Deployment data saved to: nft-extensions-deployment.json\n");

    console.log("📝 Próximos pasos:");
    console.log("1. NFTOffers: Los usuarios pueden hacer ofertas en cualquier NFT");
    console.log("2. NFTRental: Los propietarios pueden listar NFTs para alquilar");
    console.log("3. Ambos contratos usan BEZ-Coin como moneda de pago\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ ERROR:", error);
        process.exit(1);
    });
