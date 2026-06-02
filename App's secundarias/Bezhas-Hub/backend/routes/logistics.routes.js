const express = require('express');
const router = express.Router();

// Base de datos simulada en memoria para la demo (Estructura Profesional)
let shipmentsDB = [
    {
        id: 1,
        origin: "Puerto de Valencia, ES",
        destination: "Madrid Centro, ES",
        status: "IN_TRANSIT", // PENDING, IN_TRANSIT, DELIVERED, DISPUTED
        cargoType: "Electrónica",
        weight: "500kg",
        payout: "150",
        temperature: 4.2, // Grados Celsius (IoT)
        minTemp: 0,
        maxTemp: 8,
        recipient: "0x123...",
        carrier: "0xCarrier...",
        history: [
            { status: "Created", timestamp: Date.now() - 100000, location: "Valencia" },
            { status: "Picked Up", timestamp: Date.now() - 50000, location: "Valencia" },
        ]
    },
    {
        id: 2,
        origin: "Barcelona, ES",
        destination: "Lyon, FR",
        status: "PENDING",
        cargoType: "Farmacéuticos",
        weight: "200kg",
        payout: "450",
        temperature: null,
        minTemp: 2,
        maxTemp: 8,
        recipient: "0x456...",
        carrier: null, // Aún no tiene transportista (Mercado)
        history: [
            { status: "Created", timestamp: Date.now(), location: "Barcelona" }
        ]
    }
];

// 1. Obtener todos los envíos
router.get('/shipments', (req, res) => {
    res.json(shipmentsDB);
});

// 2. Crear nuevo envío (Smart Contract + NFT con Privacidad)
router.post('/create', (req, res) => {
    const { origin, destination, cargoType, weight, payout, visibility, accessFee, shipper, minTemp, maxTemp } = req.body;

    // Validación de campos requeridos
    if (!origin || !destination || !cargoType || !payout) {
        return res.status(400).json({
            error: "Campos requeridos: origin, destination, cargoType, payout"
        });
    }

    const newShipment = {
        id: shipmentsDB.length + 1,
        origin,
        destination,
        cargoType,
        weight: weight || "N/A",
        payout: parseFloat(payout),
        status: "PENDING",
        carrier: null,
        recipient: shipper || "0xUnknown...",
        temperature: null,
        minTemp: minTemp || null,
        maxTemp: maxTemp || null,
        // Campos de privacidad (integración completa)
        visibility: visibility || 'public',
        accessFee: accessFee ? parseFloat(accessFee) : 0,
        history: [{
            status: "Created",
            timestamp: Date.now(),
            location: origin
        }]
    };

    shipmentsDB.push(newShipment);
    console.log(`✅ Nuevo envío creado (ID: ${newShipment.id}) con privacidad: ${newShipment.visibility}`);
    res.json(newShipment);
});

// 3. Aceptar trabajo (Mercado)
router.post('/accept/:id', (req, res) => {
    const { id } = req.params;
    const { carrier } = req.body;

    const shipment = shipmentsDB.find(s => s.id == id);
    if (!shipment) return res.status(404).json({ error: "Envío no encontrado" });

    shipment.status = "IN_TRANSIT";
    shipment.carrier = carrier;
    shipment.history.push({ status: "Picked Up", timestamp: Date.now(), location: shipment.origin });

    res.json(shipment);
});

// 4. Firmar entrega (Multisig)
router.post('/deliver/:id', (req, res) => {
    const { id } = req.params;

    const shipment = shipmentsDB.find(s => s.id == id);
    if (!shipment) return res.status(404).json({ error: "Envío no encontrado" });

    shipment.status = "DELIVERED";
    shipment.history.push({ status: "Delivered", timestamp: Date.now(), location: shipment.destination });

    res.json(shipment);
});

// Mantener compatibilidad con rutas antiguas por si acaso
router.get('/containers', (req, res) => {
    res.json(shipmentsDB);
});

module.exports = router;
