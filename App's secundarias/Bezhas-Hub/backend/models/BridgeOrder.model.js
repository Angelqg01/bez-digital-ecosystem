/**
 * Bridge Order Model
 * Órdenes creadas desde plataformas externas
 */

const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    externalId: {
        type: String,
        required: true
    },
    beZhasId: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
        default: 1
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        required: true,
        uppercase: true
    }
}, { _id: false });

const bridgeOrderSchema = new mongoose.Schema({
    // Identificadores
    beZhasOrderId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    externalOrderId: {
        type: String,
        required: true,
        index: true
    },
    platform: {
        type: String,
        required: true,
        enum: ['vinted', 'amazon', 'ebay', 'other'],
        index: true
    },

    // Comprador
    buyer: {
        externalId: {
            type: String,
            required: true
        },
        beZhasId: String,
        email: {
            type: String,
            trim: true,
            lowercase: true
        },
        username: {
            type: String,
            trim: true
        }
    },

    // Vendedor
    seller: {
        externalId: {
            type: String,
            required: true
        },
        beZhasId: String,
        email: {
            type: String,
            trim: true,
            lowercase: true
        },
        username: {
            type: String,
            trim: true
        }
    },

    // Items
    items: [orderItemSchema],

    // Dirección de envío
    shippingAddress: {
        street: String,
        city: String,
        state: String,
        postalCode: String,
        country: String
    },

    // Montos
    totalAmount: {
        type: Number,
        required: true,
        min: 0
    },
    shippingCost: {
        type: Number,
        default: 0,
        min: 0
    },
    currency: {
        type: String,
        required: true,
        uppercase: true,
        default: 'EUR'
    },

    // Estado de la orden
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
        default: 'pending',
        index: true
    },

    // Estado del pago
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending',
        index: true
    },
    paidAt: {
        type: Date
    },

    // Escrow
    escrowId: {
        type: String,
        index: true
    },
    escrowStatus: {
        type: String,
        enum: ['pending', 'locked', 'released', 'refunded'],
        default: 'pending'
    },

    // Tracking
    trackingNumber: {
        type: String,
        index: true
    },

    // API Key usada
    apiKey: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BridgeApiKey',
        required: true
    },

    // Metadata
    metadata: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
    },

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Índices compuestos
bridgeOrderSchema.index({ platform: 1, externalOrderId: 1 }, { unique: true });
bridgeOrderSchema.index({ status: 1, paymentStatus: 1 });
bridgeOrderSchema.index({ 'buyer.email': 1 });
bridgeOrderSchema.index({ 'seller.email': 1 });

// Middleware
bridgeOrderSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Métodos de instancia
bridgeOrderSchema.methods.updateStatus = function (newStatus) {
    this.status = newStatus;
    return this.save();
};

bridgeOrderSchema.methods.markPaid = function () {
    this.paymentStatus = 'paid';
    this.paidAt = new Date();
    return this.save();
};

bridgeOrderSchema.methods.canBeCancelled = function () {
    return ['pending', 'confirmed'].includes(this.status);
};

bridgeOrderSchema.methods.getTotalWithShipping = function () {
    return this.totalAmount + this.shippingCost;
};

const BridgeOrder = mongoose.model('BridgeOrder', bridgeOrderSchema);

module.exports = BridgeOrder;
