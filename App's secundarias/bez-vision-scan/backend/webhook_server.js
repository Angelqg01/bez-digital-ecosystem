const express = require('express');
const bodyParser = require('body-parser');
const { ethers } = require('ethers');
const { logisticsNFTAbi, qualityEscrowAbi } = require('./contracts');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

// ==========================================
// CONFIGURACIÓN BLOCKCHAIN Y CONTRATOS
// ==========================================
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'https://polygon-rpc.com');
const logisticsNFTAddress = process.env.LOGISTICS_NFT_ADDRESS || '0x0000000000000000000000000000000000000000';
const qualityEscrowAddress = process.env.QUALITY_ESCROW_ADDRESS || '0x0000000000000000000000000000000000000000';
const bezCoinAddress = process.env.BEZCOIN_ADDRESS || '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8'; // BEZCoinV2
const privateKey = process.env.PRIVATE_KEY || '';

// ABI Básico de BEZCoin (ERC20) para consultar saldos y deducir
const bezCoinAbi = [
    "function balanceOf(address owner) view returns (uint256)",
    "function transferFrom(address sender, address recipient, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)"
];

let logisticsNFT, logisticsNFTWithSigner, qualityEscrow, qualityEscrowWithSigner, bezCoin;
if (privateKey) {
    const wallet = new ethers.Wallet(privateKey, provider);
    if (ethers.isAddress(logisticsNFTAddress)) {
        logisticsNFT = new ethers.Contract(logisticsNFTAddress, logisticsNFTAbi, provider);
        logisticsNFTWithSigner = logisticsNFT.connect(wallet);
    }
    if (ethers.isAddress(qualityEscrowAddress)) {
        qualityEscrow = new ethers.Contract(qualityEscrowAddress, qualityEscrowAbi, provider);
        qualityEscrowWithSigner = qualityEscrow.connect(wallet);
    }
    bezCoin = new ethers.Contract(bezCoinAddress, bezCoinAbi, provider);
}

// ==========================================
// SISTEMA DE CRÉDITOS Y FREEMIUM
// ==========================================
const COST_PER_SCAN = ethers.parseUnits("5.0", 18); // 5 BEZ por escaneo AI/SDK
const FREEMIUM_LIMIT = 100; // 100 peticiones gratis al mes
const apiUsageDB = new Map(); // Simulación de base de datos de uso: apiKey -> { address, count, isPremium }

// Registrar una API Key de prueba (En producción esto viene de la base de datos principal de BeZhas)
apiUsageDB.set(process.env.API_KEY || 'test-key-123', { 
    address: '0xTuDireccionWalletAqui', 
    count: 0, 
    isPremium: false 
});

// Middleware de autenticación y cobro por uso (Freemium / BEZCoin)
async function apiKeyAuthAndCharge(req, res, next) {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    if (!apiKey) return res.status(401).json({ error: 'API KEY ausente' });

    const userRecord = apiUsageDB.get(apiKey);
    if (!userRecord) return res.status(401).json({ error: 'API KEY inválida' });

    // 1. Verificamos el tier Freemium
    if (!userRecord.isPremium && userRecord.count < FREEMIUM_LIMIT) {
        userRecord.count += 1;
        console.log(`[Freemium] Petición API permitida. Uso: ${userRecord.count}/${FREEMIUM_LIMIT}`);
        req.user = userRecord;
        return next();
    }

    // 2. Si excedió Freemium o es Premium, cobramos en BEZ-Coin
    try {
        if (!ethers.isAddress(userRecord.address)) {
            return res.status(402).json({ error: 'Límite Freemium excedido. Configure una wallet para cobro en BEZ-Coin.' });
        }

        const balance = await bezCoin.balanceOf(userRecord.address);
        const allowance = await bezCoin.allowance(userRecord.address, new ethers.Wallet(privateKey).address);

        if (balance < COST_PER_SCAN) {
            return res.status(402).json({ error: 'Saldo de BEZ-Coin insuficiente para cubrir el costo del API/SDK.' });
        }
        if (allowance < COST_PER_SCAN) {
            return res.status(403).json({ error: 'Aprobación (allowance) de BEZ-Coin insuficiente. Apruebe el contrato para cobrar.' });
        }

        // Aquí se ejecutaría el cobro real (requiere gas y tiempo)
        // const tx = await bezCoin.connect(wallet).transferFrom(userRecord.address, treasuryAddress, COST_PER_SCAN);
        // await tx.wait();

        userRecord.count += 1;
        console.log(`[Premium] Cobro de 5 BEZ realizado. Total peticiones: ${userRecord.count}`);
        req.user = userRecord;
        next();
    } catch (err) {
        console.error("Error al procesar cobro BEZ:", err);
        return res.status(500).json({ error: 'Error procesando el pago de API' });
    }
}

// ==========================================
// ENDPOINTS DE PAGOS Y SUSCRIPCIONES
// ==========================================

// Endpoint para obtener link de pago para comprar BEZ-Coin o suscribirse
app.post('/api/billing/buy-credits', async (req, res) => {
    const { amount, currency = 'usd', type = 'credits' } = req.body;
    
    // Aquí se integraría Stripe Payment Links desde el SDK (@bezhas/sdk/stripe-payment-links)
    // Para el entorno de Vision Scan devolvemos un link simulado del ecosistema
    const mockPaymentUrl = `https://pay.bez.digital/checkout?amount=${amount}&type=${type}`;
    
    res.json({
        success: true,
        message: type === 'subscription' ? 'Link para suscripción Premium generado' : 'Link para compra de BEZ-Coin generado',
        paymentUrl: mockPaymentUrl,
        costPerScan: "5 BEZ",
        freemiumLimit: FREEMIUM_LIMIT
    });
});

// ==========================================
// ENDPOINTS DEL ORÁCULO Y LOGÍSTICA
// ==========================================

app.post('/api/mint', apiKeyAuthAndCharge, async (req, res) => {
    if (!logisticsNFTWithSigner) return res.status(400).json({ error: 'Signer no configurado' });
    const { to, uri, containerId } = req.body;
    if (!ethers.isAddress(to)) return res.status(400).json({ error: 'Dirección destino inválida' });
    try {
        const minterRole = await logisticsNFT.MINTER_ROLE();
        const signerAddress = await logisticsNFTWithSigner.signer.getAddress();
        const hasRole = await logisticsNFT.hasRole(minterRole, signerAddress);
        if (!hasRole) return res.status(403).json({ error: 'El signer no tiene el rol MINTER_ROLE' });
        
        const tx = await logisticsNFTWithSigner.safeMint(to, uri, containerId);
        await tx.wait();
        res.json({ status: 'minted', txHash: tx.hash, creditsUsed: 5 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/transfer', apiKeyAuthAndCharge, async (req, res) => {
    if (!logisticsNFTWithSigner) return res.status(400).json({ error: 'Signer no configurado' });
    const { tokenId, to } = req.body;
    if (!ethers.isAddress(to)) return res.status(400).json({ error: 'Dirección destino inválida' });
    try {
        const signerAddress = await logisticsNFTWithSigner.signer.getAddress();
        const tx = await logisticsNFTWithSigner.transferFrom(signerAddress, to, tokenId);
        await tx.wait();
        res.json({ status: 'transferred', txHash: tx.hash });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/sensor/:containerId', apiKeyAuthAndCharge, async (req, res) => {
    const { containerId } = req.params;
    try {
        const data = await qualityEscrow.getLatestData(containerId);
        res.json({ data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/sensor', apiKeyAuthAndCharge, async (req, res) => {
    if (!qualityEscrowWithSigner) return res.status(400).json({ error: 'Signer no configurado' });
    const { containerId, temperature, status } = req.body;
    try {
        const tx = await qualityEscrowWithSigner.registerSensorData(containerId, temperature, status);
        await tx.wait();
        res.json({ status: 'registered', txHash: tx.hash });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Webhook para recepción de eventos logísticos (Aegis/Stripe)
app.post('/webhook/logistica', (req, res) => {
    const event = req.body;
    console.log('Evento recibido en webhook logístico:', event);
    
    // Si el evento es de Stripe (compra de BEZ completada o upgrade premium)
    if (event.type === 'checkout.session.completed') {
        console.log("Pago completado, procesando recarga de BEZ o Upgrade a Premium...");
        // Lógica para acuñar/transferir BEZCoin al usuario
    }
    
    res.status(200).json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor webhook escuchando en puerto ${PORT} con sistema de Billing Activo`);
});
