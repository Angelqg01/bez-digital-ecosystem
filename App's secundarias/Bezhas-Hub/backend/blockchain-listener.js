require('dotenv').config();
const { ethers } = require("ethers");
const User = require("./models/user.model");
const Product = require("./models/product.model");
const config = require("./config.json");

// Configuración
const PROVIDER_URL = process.env.RPC_URL || "http://127.0.0.1:8545"; // Default to local hardhat
const CONTRACT_ADDRESS = process.env.MARKETPLACE_ADDRESS || config.contractAddresses?.BeZhasMarketplaceAddress;
const CONTRACT_ABI = require("./abis/BeZhasMarketplace.json"); // El JSON del contrato compilado

async function startListener() {
    if (!CONTRACT_ADDRESS) {
        console.error("❌ MARKETPLACE_ADDRESS not set in .env");
        return;
    }

    console.log(`Connecting to provider: ${PROVIDER_URL}`);
    const provider = new ethers.JsonRpcProvider(PROVIDER_URL);

    // Check connection
    try {
        const network = await provider.getNetwork();
        console.log(`Connected to network: ${network.name} (chainId: ${network.chainId})`);
    } catch (err) {
        console.error("❌ Failed to connect to provider:", err.message);
        return;
    }

    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

    console.log(`🎧 Escuchando eventos del Marketplace BeZhas en ${CONTRACT_ADDRESS}...`);

    // --- LISTENER 1: Nuevo Vendedor Registrado ---
    contract.on("VendorStatusUpdated", async (userAddress, status, timestamp, event) => {
        console.log(`Nuevo Vendedor detectado: ${userAddress}`);
        try {
            // Buscamos al usuario por su wallet en TU base de datos
            // Asumo que en tu DB tienes un campo 'walletAddress'
            await User.findOneAndUpdate(
                { walletAddress: userAddress.toLowerCase() },
                { role: 'vendor', isVerifiedVendor: true }
            );
            console.log("✅ Base de datos actualizada: Usuario ahora es Vendedor.");
        } catch (err) {
            console.error("❌ Error actualizando DB:", err);
        }
    });

    // --- LISTENER 2: Nuevo Producto Creado ---
    contract.on("ProductCreated", async (id, seller, price, metadataCID, event) => {
        console.log(`Nuevo Producto #${id} de ${seller}`);

        // Aquí podrías fetchear datos de IPFS si usas metadataCID
        // const metadata = await fetchIPFS(metadataCID);

        try {
            await Product.create({
                blockchainId: id.toString(),
                sellerWallet: seller.toLowerCase(),
                priceNative: ethers.formatUnits(price, 18), // Convertir Wei a Tokens
                ipfsHash: metadataCID,
                isSold: false,
                createdAt: new Date()
            });
            console.log("✅ Producto indexado en DB local.");
        } catch (err) {
            console.error("❌ Error indexando producto:", err);
        }
    });

    // --- LISTENER 3: Producto Vendido ---
    contract.on("ProductSold", async (id, buyer, price, timestamp, event) => {
        console.log(`Venta confirmada: Producto #${id}`);
        try {
            await Product.findOneAndUpdate(
                { blockchainId: id.toString() },
                { isSold: true, buyerWallet: buyer.toLowerCase() }
            );
            // Aquí podrías disparar notificaciones (Email/Push) al vendedor
            // sendNotificationToSeller(sellerWallet, "Has vendido un producto!");
        } catch (err) {
            console.error("❌ Error actualizando venta:", err);
        }
    });
}

startListener();
