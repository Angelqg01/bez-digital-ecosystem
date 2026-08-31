/**
 * ClothingRental Model - Sistema de Alquiler/Compra de Ropa
 * Integra con AEGIS para monitoreo de transacciones y detección de fraude
 * 
 * Cadena AEGIS:
 * 1. Cliente solicita alquiler/compra
 * 2. AEGIS analiza el perfil del cliente (anomaly_detector)
 * 3. AEGIS evalúa sentimiento de reviews previos (sentiment_analyzer)
 * 4. AEGIS optimiza la experiencia de usuario (ux_optimizer)
 * 5. Comercio aprueba/rechaza basado en score AEGIS
 * 6. Transacción se ejecuta on-chain con BEZ tokens
 */

const mongoose = require('mongoose');

// Enums
const RentalType = {
    RENTAL: 'RENTAL',           // Alquiler temporal
    PURCHASE: 'PURCHASE',       // Compra definitiva
    RENT_TO_OWN: 'RENT_TO_OWN' // Alquiler con opción a compra
};

const RentalStatus = {
    PENDING: 'PENDING',               // Esperando aprobación
    AEGIS_REVIEW: 'AEGIS_REVIEW',     // En revisión por AEGIS
    APPROVED: 'APPROVED',             // Aprobado por comercio
    REJECTED: 'REJECTED',             // Rechazado
    ACTIVE: 'ACTIVE',                 // Alquiler activo
    RETURNED: 'RETURNED',             // Ropa devuelta
    COMPLETED: 'COMPLETED',           // Transacción completada
    DISPUTED: 'DISPUTED',             // En disputa
    CANCELLED: 'CANCELLED'            // Cancelado
};

const ClothingCategory = {
    FORMAL: 'FORMAL',           // Trajes, vestidos de gala
    CASUAL: 'CASUAL',           // Ropa casual
    LUXURY: 'LUXURY',           // Ropa de lujo/diseñador
    WEDDING: 'WEDDING',         // Vestidos de novia, trajes
    COSTUME: 'COSTUME',         // Disfraces
    SPORTSWEAR: 'SPORTSWEAR',   // Ropa deportiva
    WORKWEAR: 'WORKWEAR',       // Uniformes, ropa de trabajo
    VINTAGE: 'VINTAGE',         // Ropa vintage
    SUSTAINABLE: 'SUSTAINABLE'  // Ropa sostenible/reciclada
};

const clothingRentalSchema = new mongoose.Schema({
    // Identificadores
    rentalId: {
        type: String,
        unique: true,
        required: true,
        default: () => `RENT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
    },

    // Cliente
    customer: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        walletAddress: {
            type: String,
            required: true,
            index: true
        },
        displayName: String,
        email: String,
        phone: String,
        shippingAddress: {
            street: String,
            city: String,
            state: String,
            postalCode: String,
            country: String,
            coordinates: {
                lat: Number,
                lng: Number
            }
        }
    },

    // Comercio/Vendedor
    merchant: {
        merchantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        walletAddress: {
            type: String,
            required: true,
            index: true
        },
        businessName: {
            type: String,
            required: true
        },
        businessType: {
            type: String,
            enum: ['BOUTIQUE', 'DEPARTMENT_STORE', 'DESIGNER', 'VINTAGE_SHOP', 'ONLINE_ONLY', 'SUSTAINABLE'],
            default: 'BOUTIQUE'
        },
        rating: {
            type: Number,
            min: 0,
            max: 5,
            default: 0
        },
        verifiedMerchant: {
            type: Boolean,
            default: false
        }
    },

    // Tipo de transacción
    transactionType: {
        type: String,
        enum: Object.values(RentalType),
        required: true,
        default: RentalType.RENTAL
    },

    // Estado
    status: {
        type: String,
        enum: Object.values(RentalStatus),
        default: RentalStatus.PENDING
    },

    // Artículo(s) de ropa
    items: [{
        itemId: {
            type: String,
            required: true
        },
        name: {
            type: String,
            required: true
        },
        description: String,
        category: {
            type: String,
            enum: Object.values(ClothingCategory),
            required: true
        },
        brand: String,
        size: String,
        color: String,
        condition: {
            type: String,
            enum: ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR'],
            default: 'GOOD'
        },
        images: [String],            // URLs de imágenes (IPFS)
        retailPrice: Number,          // Precio de venta original
        rentalPricePerDay: Number,    // Precio por día de alquiler
        depositRequired: Number,      // Depósito de seguridad
        insuranceIncluded: {
            type: Boolean,
            default: false
        }
    }],

    // Período de alquiler (solo para RENTAL y RENT_TO_OWN)
    rentalPeriod: {
        startDate: Date,
        endDate: Date,
        durationDays: Number,
        extensionAllowed: {
            type: Boolean,
            default: true
        },
        maxExtensionDays: {
            type: Number,
            default: 30
        }
    },

    // Precios y pagos
    pricing: {
        subtotal: {
            type: Number,
            required: true
        },
        deposit: {
            type: Number,
            default: 0
        },
        insuranceFee: {
            type: Number,
            default: 0
        },
        deliveryFee: {
            type: Number,
            default: 0
        },
        platformFee: {
            type: Number,
            default: 0
        },
        totalAmount: {
            type: Number,
            required: true
        },
        currency: {
            type: String,
            default: 'BEZ'
        },
        fiatEquivalent: {
            amount: Number,
            currency: {
                type: String,
                default: 'EUR'
            }
        }
    },

    // Pagos on-chain
    payments: [{
        paymentId: String,
        type: {
            type: String,
            enum: ['RENTAL_FEE', 'DEPOSIT', 'EXTENSION', 'PURCHASE', 'REFUND', 'PENALTY']
        },
        amount: Number,
        currency: String,
        txHash: String,
        blockNumber: Number,
        status: {
            type: String,
            enum: ['PENDING', 'CONFIRMED', 'FAILED'],
            default: 'PENDING'
        },
        paidAt: Date
    }],

    // AEGIS Integration - Cadena de evaluación
    aegisEvaluation: {
        // Paso 1: Evaluación inicial
        initiated: {
            type: Boolean,
            default: false
        },
        initiatedAt: Date,

        // Paso 2: Detección de anomalías (anomaly_detector.py)
        anomalyDetection: {
            checked: { type: Boolean, default: false },
            checkedAt: Date,
            score: {
                type: Number,
                min: 0,
                max: 1
            },
            flags: [String],           // Banderas de alerta
            riskLevel: {
                type: String,
                enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
            },
            details: mongoose.Schema.Types.Mixed
        },

        // Paso 3: Análisis de sentimiento (sentiment_analyzer.py)
        sentimentAnalysis: {
            checked: { type: Boolean, default: false },
            checkedAt: Date,
            customerSentiment: {
                type: Number,
                min: -1,
                max: 1
            },
            merchantSentiment: {
                type: Number,
                min: -1,
                max: 1
            },
            reviewsAnalyzed: Number,
            concerns: [String],
            details: mongoose.Schema.Types.Mixed
        },

        // Paso 4: Optimización UX (ux_optimizer.py)
        uxOptimization: {
            checked: { type: Boolean, default: false },
            checkedAt: Date,
            suggestedImprovements: [String],
            personalizationApplied: mongoose.Schema.Types.Mixed,
            conversionProbability: Number
        },

        // Resultado final AEGIS
        finalScore: {
            type: Number,
            min: 0,
            max: 100
        },
        recommendation: {
            type: String,
            enum: ['APPROVE', 'MANUAL_REVIEW', 'REJECT', 'ESCALATE']
        },
        completedAt: Date,
        processingTimeMs: Number,

        // Decisión del comercio basada en AEGIS
        merchantDecision: {
            decision: {
                type: String,
                enum: ['APPROVED', 'REJECTED', 'COUNTER_OFFER']
            },
            decidedAt: Date,
            notes: String,
            counterOfferDetails: mongoose.Schema.Types.Mixed
        }
    },

    // Logística
    logistics: {
        deliveryMethod: {
            type: String,
            enum: ['PICKUP', 'STANDARD_DELIVERY', 'EXPRESS_DELIVERY', 'SAME_DAY']
        },
        carrier: String,
        trackingNumber: String,
        deliveredAt: Date,
        returnTrackingNumber: String,
        returnedAt: Date,
        returnCondition: {
            type: String,
            enum: ['PERFECT', 'GOOD', 'DAMAGED', 'MISSING_ITEMS']
        },
        returnNotes: String,
        returnPhotos: [String]
    },

    // Historial de eventos
    timeline: [{
        event: {
            type: String,
            required: true
        },
        description: String,
        actor: String,           // userId o 'AEGIS' o 'SYSTEM'
        timestamp: {
            type: Date,
            default: Date.now
        },
        metadata: mongoose.Schema.Types.Mixed
    }],

    // Disputas
    dispute: {
        isDisputed: {
            type: Boolean,
            default: false
        },
        disputeId: String,
        reason: String,
        openedBy: String,        // 'CUSTOMER' o 'MERCHANT'
        openedAt: Date,
        resolution: String,
        resolvedAt: Date,
        refundAmount: Number,
        penaltyApplied: Boolean
    },

    // Reviews
    reviews: {
        customerReview: {
            rating: { type: Number, min: 1, max: 5 },
            comment: String,
            photoUrls: [String],
            createdAt: Date
        },
        merchantReview: {
            rating: { type: Number, min: 1, max: 5 },
            comment: String,
            createdAt: Date
        }
    },

    // NFT asociado (opcional - para items exclusivos)
    nftDetails: {
        isNFTBacked: {
            type: Boolean,
            default: false
        },
        nftContractAddress: String,
        nftTokenId: String,
        nftMetadataUri: String
    },

    // Metadata adicional
    metadata: mongoose.Schema.Types.Mixed

}, {
    timestamps: true
});

// Indexes para búsquedas optimizadas
clothingRentalSchema.index({ 'customer.walletAddress': 1, status: 1 });
clothingRentalSchema.index({ 'merchant.walletAddress': 1, status: 1 });
clothingRentalSchema.index({ 'aegisEvaluation.finalScore': 1 });
clothingRentalSchema.index({ createdAt: -1 });
clothingRentalSchema.index({ 'items.category': 1 });

// Virtuals
clothingRentalSchema.virtual('isActive').get(function() {
    return ['ACTIVE', 'AEGIS_REVIEW', 'APPROVED'].includes(this.status);
});

clothingRentalSchema.virtual('needsReturn').get(function() {
    if (this.transactionType !== RentalType.RENTAL) return false;
    if (!this.rentalPeriod?.endDate) return false;
    return new Date() > this.rentalPeriod.endDate && this.status === 'ACTIVE';
});

// Methods
clothingRentalSchema.methods.initiateAegisChain = async function() {
    this.aegisEvaluation.initiated = true;
    this.aegisEvaluation.initiatedAt = new Date();
    this.status = RentalStatus.AEGIS_REVIEW;
    
    this.timeline.push({
        event: 'AEGIS_CHAIN_INITIATED',
        description: 'Cadena de evaluación AEGIS iniciada',
        actor: 'SYSTEM',
        timestamp: new Date()
    });
    
    await this.save();
    return this;
};

clothingRentalSchema.methods.updateAegisStep = async function(step, data) {
    const now = new Date();
    
    switch(step) {
        case 'ANOMALY_DETECTION':
            this.aegisEvaluation.anomalyDetection = {
                checked: true,
                checkedAt: now,
                ...data
            };
            break;
        case 'SENTIMENT_ANALYSIS':
            this.aegisEvaluation.sentimentAnalysis = {
                checked: true,
                checkedAt: now,
                ...data
            };
            break;
        case 'UX_OPTIMIZATION':
            this.aegisEvaluation.uxOptimization = {
                checked: true,
                checkedAt: now,
                ...data
            };
            break;
    }
    
    this.timeline.push({
        event: `AEGIS_${step}_COMPLETE`,
        description: `Paso ${step} completado por AEGIS`,
        actor: 'AEGIS',
        timestamp: now,
        metadata: data
    });
    
    await this.save();
    return this;
};

clothingRentalSchema.methods.completeAegisEvaluation = async function(finalScore, recommendation) {
    const now = new Date();
    const startTime = this.aegisEvaluation.initiatedAt || now;
    
    this.aegisEvaluation.finalScore = finalScore;
    this.aegisEvaluation.recommendation = recommendation;
    this.aegisEvaluation.completedAt = now;
    this.aegisEvaluation.processingTimeMs = now - startTime;
    
    this.timeline.push({
        event: 'AEGIS_EVALUATION_COMPLETE',
        description: `Evaluación AEGIS completada. Score: ${finalScore}, Recomendación: ${recommendation}`,
        actor: 'AEGIS',
        timestamp: now,
        metadata: { finalScore, recommendation }
    });
    
    await this.save();
    return this;
};

clothingRentalSchema.methods.recordPayment = async function(paymentData) {
    this.payments.push({
        paymentId: `PAY-${Date.now()}`,
        ...paymentData,
        paidAt: new Date()
    });
    
    this.timeline.push({
        event: 'PAYMENT_RECORDED',
        description: `Pago de ${paymentData.amount} ${paymentData.currency} registrado`,
        actor: 'SYSTEM',
        timestamp: new Date(),
        metadata: paymentData
    });
    
    await this.save();
    return this;
};

// Statics
clothingRentalSchema.statics.findByCustomerWallet = function(walletAddress) {
    return this.find({ 'customer.walletAddress': walletAddress.toLowerCase() });
};

clothingRentalSchema.statics.findByMerchantWallet = function(walletAddress) {
    return this.find({ 'merchant.walletAddress': walletAddress.toLowerCase() });
};

clothingRentalSchema.statics.findPendingAegisReview = function() {
    return this.find({ status: RentalStatus.AEGIS_REVIEW });
};

clothingRentalSchema.statics.getStatsByMerchant = async function(merchantId) {
    return this.aggregate([
        { $match: { 'merchant.merchantId': mongoose.Types.ObjectId(merchantId) } },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalRevenue: { $sum: '$pricing.totalAmount' }
            }
        }
    ]);
};

// Export
const ClothingRental = mongoose.model('ClothingRental', clothingRentalSchema);

module.exports = {
    ClothingRental,
    RentalType,
    RentalStatus,
    ClothingCategory
};
