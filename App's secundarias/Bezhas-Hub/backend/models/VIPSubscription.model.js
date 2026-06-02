const mongoose = require('mongoose');

const vipSubscriptionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    walletAddress: {
        type: String,
        required: true,
        index: true,
        lowercase: true
    },
    tier: {
        type: String,
        enum: ['bronze', 'silver', 'gold', 'platinum'],
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'cancelled', 'expired', 'pending'],
        default: 'active',
        index: true
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date,
        required: true,
        index: true
    },
    // Integración con Stripe
    stripeCustomerId: {
        type: String,
        sparse: true,
        index: true
    },
    stripeSubscriptionId: {
        type: String,
        sparse: true,
        index: true
    },
    stripePaymentMethod: String,

    // Beneficios del tier
    benefits: {
        discountPercentage: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },
        shippingDiscount: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },
        bezBonus: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },
        nftBadge: {
            type: String,
            default: null
        },
        nftMinted: {
            type: Boolean,
            default: false
        },
        nftTokenId: String,
        prioritySupport: {
            type: Boolean,
            default: false
        },
        exclusiveAccess: {
            type: Boolean,
            default: false
        }
    },

    // Historial de ahorros
    savingsHistory: [{
        date: {
            type: Date,
            default: Date.now
        },
        amount: {
            type: Number,
            required: true
        },
        currency: {
            type: String,
            default: 'EUR'
        },
        description: String,
        transactionType: {
            type: String,
            enum: ['marketplace_discount', 'shipping_discount', 'bez_bonus', 'special_offer']
        },
        relatedTransaction: String
    }],

    // Estadísticas de uso
    stats: {
        totalSavings: {
            type: Number,
            default: 0
        },
        totalPurchases: {
            type: Number,
            default: 0
        },
        totalShipments: {
            type: Number,
            default: 0
        },
        bezEarned: {
            type: Number,
            default: 0
        },
        lastActivity: Date
    },

    // Pagos y renovación
    billing: {
        price: {
            type: Number,
            required: true
        },
        currency: {
            type: String,
            default: 'EUR'
        },
        billingCycle: {
            type: String,
            enum: ['monthly', 'yearly'],
            default: 'monthly'
        },
        nextBillingDate: Date,
        autoRenew: {
            type: Boolean,
            default: true
        },
        lastPaymentDate: Date,
        lastPaymentAmount: Number,
        paymentHistory: [{
            date: Date,
            amount: Number,
            status: {
                type: String,
                enum: ['succeeded', 'failed', 'pending', 'refunded']
            },
            stripeInvoiceId: String
        }]
    },

    // Metadata adicional
    metadata: {
        referralCode: String,
        referredBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        source: {
            type: String,
            enum: ['web', 'mobile', 'api', 'admin'],
            default: 'web'
        },
        notes: String
    },

    // Cancelación
    cancellation: {
        cancelledAt: Date,
        reason: String,
        cancelledBy: {
            type: String,
            enum: ['user', 'admin', 'system', 'payment_failed']
        },
        refunded: {
            type: Boolean,
            default: false
        }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Índices compuestos para queries comunes
vipSubscriptionSchema.index({ walletAddress: 1, status: 1 });
vipSubscriptionSchema.index({ status: 1, endDate: 1 });
vipSubscriptionSchema.index({ tier: 1, status: 1 });

// Virtual para días restantes
vipSubscriptionSchema.virtual('daysRemaining').get(function () {
    if (!this.endDate) return 0;
    const now = new Date();
    const diff = this.endDate - now;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

// Virtual para estado activo
vipSubscriptionSchema.virtual('isActive').get(function () {
    return this.status === 'active' && this.endDate > new Date();
});

// Método estático para obtener suscripción activa por wallet
vipSubscriptionSchema.statics.getActiveSubscription = async function (walletAddress) {
    return this.findOne({
        walletAddress: walletAddress.toLowerCase(),
        status: 'active',
        endDate: { $gt: new Date() }
    }).sort({ tier: -1 }); // Retornar el tier más alto si hay múltiples
};

// Método para calcular total de ahorros
vipSubscriptionSchema.methods.calculateTotalSavings = function () {
    return this.savingsHistory.reduce((total, item) => total + item.amount, 0);
};

// Método para agregar ahorro
vipSubscriptionSchema.methods.addSaving = function (amount, description, transactionType) {
    this.savingsHistory.push({
        amount,
        description,
        transactionType,
        date: new Date()
    });
    this.stats.totalSavings += amount;
    this.stats.lastActivity = new Date();
};

// Método para verificar si puede renovarse
vipSubscriptionSchema.methods.canRenew = function () {
    return this.billing.autoRenew && this.status === 'active';
};

// Método para cancelar suscripción
vipSubscriptionSchema.methods.cancel = function (reason, cancelledBy = 'user') {
    this.status = 'cancelled';
    this.cancellation = {
        cancelledAt: new Date(),
        reason,
        cancelledBy
    };
    this.billing.autoRenew = false;
};

// Hook pre-save para calcular estadísticas
vipSubscriptionSchema.pre('save', function (next) {
    if (this.isModified('savingsHistory')) {
        this.stats.totalSavings = this.calculateTotalSavings();
    }
    next();
});

// Hook para expirar suscripciones
vipSubscriptionSchema.methods.checkExpiration = function () {
    if (this.endDate < new Date() && this.status === 'active') {
        this.status = 'expired';
        return true;
    }
    return false;
};

module.exports = mongoose.model('VIPSubscription', vipSubscriptionSchema);
