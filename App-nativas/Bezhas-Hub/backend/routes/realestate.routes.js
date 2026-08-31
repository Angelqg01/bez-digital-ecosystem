const express = require('express');
const router = express.Router();

// Base de datos simulada de Propiedades Tokenizadas
let properties = [
    {
        id: 1,
        title: "Luxury Penthouse Madrid",
        location: "Gran Vía, Madrid, ES",
        type: "Residential",
        totalValue: 1500000,
        tokenPrice: 50, // Precio por token/acción
        tokensAvailable: 10000,
        tokensSold: 8500,
        apy: 8.5, // Retorno anual estimado
        occupancy: 100, // % Ocupación
        image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80",
        documents: { deed: "QmHash...", audit: "QmHash..." }
    },
    {
        id: 2,
        title: "Tech Hub Office Space",
        location: "22@ District, Barcelona, ES",
        type: "Commercial",
        totalValue: 4200000,
        tokenPrice: 100,
        tokensAvailable: 42000,
        tokensSold: 12000,
        apy: 12.2,
        occupancy: 85,
        image: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80",
        documents: { deed: "QmHash...", audit: "QmHash..." }
    }
];

// Portafolio simulado del usuario (en memoria)
let userPortfolio = [];

// GET: Listar propiedades
router.get('/properties', (req, res) => {
    res.json(properties);
});

// GET: Portafolio del usuario
router.get('/portfolio', (req, res) => {
    // Calcular rentas acumuladas simuladas
    const portfolioWithRent = userPortfolio.map(item => ({
        ...item,
        claimableRent: (item.tokensOwned * item.tokenPrice * (item.apy / 100) / 12).toFixed(4) // Renta mensual simulada
    }));
    res.json(portfolioWithRent);
});

// POST: Invertir (Comprar Tokens)
router.post('/invest', (req, res) => {
    const { propertyId, amountTokens } = req.body;
    const property = properties.find(p => p.id === propertyId);

    if (!property) return res.status(404).json({ error: "Propiedad no encontrada" });
    if (property.tokensAvailable - property.tokensSold < amountTokens) {
        return res.status(400).json({ error: "No hay suficientes tokens disponibles" });
    }

    // Actualizar propiedad
    property.tokensSold += parseInt(amountTokens);

    // Actualizar portafolio usuario
    const existingInv = userPortfolio.find(p => p.id === propertyId);
    if (existingInv) {
        existingInv.tokensOwned += parseInt(amountTokens);
    } else {
        userPortfolio.push({
            ...property,
            tokensOwned: parseInt(amountTokens),
            purchaseDate: new Date()
        });
    }

    res.json({ success: true, message: "Inversión realizada con éxito", property });
});

// POST: Reclamar Rentas
router.post('/claim', (req, res) => {
    const { propertyId } = req.body;
    // En una app real, esto enviaría tokens a la wallet
    res.json({ success: true, message: "Rentas transferidas a tu wallet", txHash: "0x123...abc" });
});

// POST: Staking (Simulado)
router.post('/stake', (req, res) => {
    const { amount } = req.body;
    // Aquí se bloquearían los tokens en el contrato de staking
    res.json({
        success: true,
        message: `Has stakeado ${amount} tokens exitosamente.`,
        apy: 12.5,
        estimatedRewards: (amount * 0.125).toFixed(2)
    });
});

module.exports = router;
