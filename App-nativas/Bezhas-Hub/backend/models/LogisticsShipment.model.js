/**
 * LogisticsShipment Model - Sistema de Envíos y Logística
 * Gestiona envíos de containers (Maersk) y paquetería (TNT, GLS, MRW)
 * Integrado con Quality Oracle para verificación de entregas
 */

const mongoose = require('mongoose');

const ShipmentType = {
    CONTAINER: 'CONTAINER',     // Contenedores marítimos
    PARCEL: 'PARCEL',           // Paquetería estándar
    EXPRESS: 'EXPRESS',         // Envío express
    FREIGHT: 'FREIGHT',         // Carga aérea
    LAST_MILE: 'LAST_MILE'      // Última milla
};

const ShipmentStatus = {
    CREATED: 'CREATED',
    PENDING_PICKUP: 'PENDING_PICKUP',
    PICKED_UP: 'PICKED_UP',
    IN_TRANSIT: 'IN_TRANSIT',
    AT_HUB: 'AT_HUB',
    OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
    DELIVERED: 'DELIVERED',
    FAILED_DELIVERY: 'FAILED_DELIVERY',
    RETURNED: 'RETURNED',
    CANCELLED: 'CANCELLED',
    DELAYED: 'DELAYED',
    CUSTOMS_HOLD: 'CUSTOMS_HOLD'
};

const CarrierProvider = {
    // Containers
    MAERSK: 'MAERSK',
    COSCO: 'COSCO',
    MSC: 'MSC',
    EVERGREEN: 'EVERGREEN',
    CMA_CGM: 'CMA_CGM',
    // Paquetería
    TNT: 'TNT',
    GLS: 'GLS',
    MRW: 'MRW',
    DHL: 'DHL',
    FEDEX: 'FEDEX',
    UPS: 'UPS',
    CORREOS: 'CORREOS',
    SEUR: 'SEUR',
    // Interno
    BEZHAS_LOGISTICS: 'BEZHAS_LOGISTICS'
};

const logisticsShipmentSchema = new mongoose.Schema({
    // Identificador único
    shipmentId: {
        type: String,
        unique: true,
        required: true,
        default: () => `SHIP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
    },

    // Tipo de envío
    type: {
        type: String,
        enum: Object.values(ShipmentType),
        required: true
    },

    // Estado actual
    status: {
        type: String,
        enum: Object.values(ShipmentStatus),
        default: ShipmentStatus.CREATED
    },

    // Transportista
    carrier: {
        provider: {
            type: String,
            enum: Object.values(CarrierProvider),
            required: true
        },
        trackingNumber: {
            type: String,
            required: true,
            index: true
        },
        containerNumber: String,   // Solo para containers
        bookingReference: String,
        serviceType: String,       // e.g., 'Standard', 'Express', 'Economy'
        apiConnected: {
            type: Boolean,
            default: false
        }
    },

    // Usuario que solicita el envío
    sender: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        walletAddress: {
            type: String,
            index: true
        },
        name: String,
        company: String,
        email: String,
        phone: String,
        address: {
            street: String,
            city: String,
            state: String,
            postalCode: String,
            country: String,
            countryCode: String
        },
        coordinates: {
            lat: Number,
            lng: Number
        }
    },

    // Destinatario
    recipient: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        walletAddress: String,
        name: {
            type: String,
            required: true
        },
        company: String,
        email: String,
        phone: String,
        address: {
            street: {
                type: String,
                required: true
            },
            city: {
                type: String,
                required: true
            },
            state: String,
            postalCode: {
                type: String,
                required: true
            },
            country: {
                type: String,
                required: true
            },
            countryCode: String
        },
        coordinates: {
            lat: Number,
            lng: Number
        },
        deliveryInstructions: String
    },

    // Detalles del paquete
    packageDetails: {
        // Para paquetería
        weight: {
            value: Number,
            unit: {
                type: String,
                enum: ['kg', 'lb'],
                default: 'kg'
            }
        },
        dimensions: {
            length: Number,
            width: Number,
            height: Number,
            unit: {
                type: String,
                enum: ['cm', 'in'],
                default: 'cm'
            }
        },
        // Para containers
        containerType: {
            type: String,
            enum: ['20FT', '40FT', '40FT_HIGH_CUBE', '45FT', 'REEFER', 'OPEN_TOP', 'FLAT_RACK']
        },
        containerWeight: Number,     // Peso total con carga
        numberOfPackages: {
            type: Number,
            default: 1
        },
        description: String,
        contents: [{
            description: String,
            quantity: Number,
            value: Number,
            hsCode: String          // Código arancelario
        }],
        declaredValue: {
            amount: Number,
            currency: {
                type: String,
                default: 'EUR'
            }
        },
        isFragile: {
            type: Boolean,
            default: false
        },
        requiresRefrigeration: {
            type: Boolean,
            default: false
        },
        hazardousMaterial: {
            type: Boolean,
            default: false
        },
        hazmatClass: String
    },

    // Costos
    pricing: {
        shippingCost: {
            type: Number,
            required: true
        },
        insuranceCost: {
            type: Number,
            default: 0
        },
        customsFees: {
            type: Number,
            default: 0
        },
        fuelSurcharge: {
            type: Number,
            default: 0
        },
        handlingFees: {
            type: Number,
            default: 0
        },
        platformFee: {
            type: Number,
            default: 0
        },
        totalCost: {
            type: Number,
            required: true
        },
        currency: {
            type: String,
            default: 'EUR'
        },
        // Pago en BEZ
        bezPayment: {
            amount: Number,
            txHash: String,
            paidAt: Date
        }
    },

    // Fechas importantes
    dates: {
        createdAt: {
            type: Date,
            default: Date.now
        },
        scheduledPickup: Date,
        actualPickup: Date,
        estimatedDelivery: Date,
        actualDelivery: Date,
        lastUpdate: Date
    },

    // Historial de tracking
    trackingHistory: [{
        timestamp: {
            type: Date,
            default: Date.now
        },
        status: String,
        location: {
            city: String,
            country: String,
            facility: String,
            coordinates: {
                lat: Number,
                lng: Number
            }
        },
        description: String,
        source: {
            type: String,
            enum: ['CARRIER_API', 'MANUAL', 'WEBHOOK', 'SYSTEM'],
            default: 'SYSTEM'
        }
    }],

    // Ruta del contenedor (solo para marítimo)
    route: {
        origin: {
            port: String,
            portCode: String,
            country: String,
            terminal: String
        },
        destination: {
            port: String,
            portCode: String,
            country: String,
            terminal: String
        },
        vessel: {
            name: String,
            imo: String,
            flag: String
        },
        voyage: String,
        transitPorts: [{
            port: String,
            portCode: String,
            country: String,
            arrivalDate: Date,
            departureDate: Date
        }]
    },

    // Documentos asociados
    documents: [{
        type: {
            type: String,
            enum: ['BILL_OF_LADING', 'COMMERCIAL_INVOICE', 'PACKING_LIST', 'CUSTOMS_DECLARATION',
                'PROOF_OF_DELIVERY', 'INSURANCE_CERTIFICATE', 'LABEL', 'OTHER']
        },
        name: String,
        url: String,              // IPFS URL
        uploadedAt: Date,
        verified: {
            type: Boolean,
            default: false
        }
    }],

    // Proof of Delivery (PoD)
    proofOfDelivery: {
        signature: String,        // Base64 o URL
        signedBy: String,
        signedAt: Date,
        photos: [String],         // URLs de fotos
        notes: String,
        verifiedOnChain: {
            type: Boolean,
            default: false
        },
        txHash: String
    },

    // Integración con Quality Oracle
    qualityOracle: {
        verified: {
            type: Boolean,
            default: false
        },
        verificationId: String,
        score: Number,            // 0-100
        issues: [String],
        verifiedAt: Date
    },

    // Integración con BeZhas (Escrow, NFT)
    bezhasIntegration: {
        orderId: String,          // Referencia a orden de marketplace
        escrowId: String,         // Referencia a escrow contract
        nftId: String,            // Si el envío está ligado a un NFT
        linkedRentalId: String    // Referencia a ClothingRental si aplica
    },

    // Seguro
    insurance: {
        insured: {
            type: Boolean,
            default: false
        },
        provider: String,
        policyNumber: String,
        coverage: Number,
        currency: String,
        claimFiled: {
            type: Boolean,
            default: false
        },
        claimDetails: mongoose.Schema.Types.Mixed
    },

    // Notificaciones
    notifications: {
        emailEnabled: {
            type: Boolean,
            default: true
        },
        smsEnabled: {
            type: Boolean,
            default: false
        },
        webhookEnabled: {
            type: Boolean,
            default: false
        },
        webhookUrl: String,
        discordEnabled: {
            type: Boolean,
            default: false
        }
    },

    // Metadata adicional
    metadata: mongoose.Schema.Types.Mixed,

    // Referencias externas
    externalReferences: {
        purchaseOrderNumber: String,
        invoiceNumber: String,
        customerReference: String
    }

}, {
    timestamps: true
});

// Indexes
logisticsShipmentSchema.index({ 'carrier.trackingNumber': 1 });
logisticsShipmentSchema.index({ 'sender.walletAddress': 1, status: 1 });
logisticsShipmentSchema.index({ 'recipient.walletAddress': 1, status: 1 });
logisticsShipmentSchema.index({ 'carrier.provider': 1, status: 1 });
logisticsShipmentSchema.index({ 'dates.estimatedDelivery': 1 });
logisticsShipmentSchema.index({ createdAt: -1 });

// Methods
logisticsShipmentSchema.methods.addTrackingEvent = async function (event) {
    this.trackingHistory.push({
        timestamp: new Date(),
        ...event
    });
    this.dates.lastUpdate = new Date();

    // Actualizar estado si viene en el evento
    if (event.status) {
        this.status = event.status;
    }

    await this.save();
    return this;
};

logisticsShipmentSchema.methods.recordDelivery = async function (podData) {
    this.proofOfDelivery = {
        ...podData,
        signedAt: new Date()
    };
    this.status = ShipmentStatus.DELIVERED;
    this.dates.actualDelivery = new Date();

    this.trackingHistory.push({
        timestamp: new Date(),
        status: 'DELIVERED',
        description: `Entregado y firmado por ${podData.signedBy}`,
        source: 'SYSTEM'
    });

    await this.save();
    return this;
};

logisticsShipmentSchema.methods.linkToClothingRental = async function (rentalId) {
    this.bezhasIntegration.linkedRentalId = rentalId;
    await this.save();
    return this;
};

// Statics
logisticsShipmentSchema.statics.findByTracking = function (trackingNumber) {
    return this.findOne({ 'carrier.trackingNumber': trackingNumber });
};

logisticsShipmentSchema.statics.findActiveByWallet = function (walletAddress) {
    const activeStatuses = [
        ShipmentStatus.CREATED,
        ShipmentStatus.PENDING_PICKUP,
        ShipmentStatus.PICKED_UP,
        ShipmentStatus.IN_TRANSIT,
        ShipmentStatus.AT_HUB,
        ShipmentStatus.OUT_FOR_DELIVERY
    ];

    return this.find({
        $or: [
            { 'sender.walletAddress': walletAddress.toLowerCase() },
            { 'recipient.walletAddress': walletAddress.toLowerCase() }
        ],
        status: { $in: activeStatuses }
    });
};

logisticsShipmentSchema.statics.getCarrierStats = async function (carrier) {
    return this.aggregate([
        { $match: { 'carrier.provider': carrier } },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                avgDeliveryTime: {
                    $avg: {
                        $subtract: ['$dates.actualDelivery', '$dates.actualPickup']
                    }
                }
            }
        }
    ]);
};

const LogisticsShipment = mongoose.model('LogisticsShipment', logisticsShipmentSchema);

module.exports = {
    LogisticsShipment,
    ShipmentType,
    ShipmentStatus,
    CarrierProvider
};
