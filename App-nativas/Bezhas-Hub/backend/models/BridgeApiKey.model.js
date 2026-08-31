/**
 * Bridge API Key Model
 * Sistema de autenticación para el Universal Bridge API
 */

const mongoose = require('mongoose');

const apiKeySchema = new mongoose.Schema({
    // Identificación
    key: {
        type: String,
        required: true,
        unique: true,
        index: true,
        minlength: 32
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },

    // Propietario
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Plataforma asociada
    platform: {
        type: String,
        required: true,
        enum: ['vinted', 'amazon', 'ebay', 'maersk', 'fedex', 'dhl', 'stripe', 'paypal', 'other'],
        index: true
    },

    // Permisos
    permissions: {
        inventory: {
            type: Boolean,
            default: false
        },
        logistics: {
            type: Boolean,
            default: false
        },
        payments: {
            type: Boolean,
            default: false
        },
        orders: {
            type: Boolean,
            default: false
        }
    },

    // Rate Limiting
    rateLimit: {
        requestsPerMinute: {
            type: Number,
            default: 100
        },
        requestsPerDay: {
            type: Number,
            default: 10000
        }
    },

    // Estado
    active: {
        type: Boolean,
        default: true,
        index: true
    },
    lastUsedAt: {
        type: Date,
        default: null
    },

    // Estadísticas
    stats: {
        totalRequests: {
            type: Number,
            default: 0
        },
        successfulRequests: {
            type: Number,
            default: 0
        },
        failedRequests: {
            type: Number,
            default: 0
        },
        lastError: {
            type: String,
            default: null
        }
    },

    // Seguridad
    ipWhitelist: [{
        type: String,
        trim: true
    }],
    expiresAt: {
        type: Date,
        default: null
    },

    // Metadata
    metadata: {
        type: Map,
        of: String,
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
apiKeySchema.index({ userId: 1, platform: 1 });
apiKeySchema.index({ active: 1, expiresAt: 1 });

// Middleware para actualizar updatedAt
apiKeySchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Método para verificar si la key está expirada
apiKeySchema.methods.isExpired = function () {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
};

// Método para verificar si la key está activa
apiKeySchema.methods.isActive = function () {
    return this.active && !this.isExpired();
};

// Método para incrementar estadísticas
apiKeySchema.methods.incrementStats = function (success = true) {
    this.stats.totalRequests++;
    if (success) {
        this.stats.successfulRequests++;
    } else {
        this.stats.failedRequests++;
    }
    this.lastUsedAt = new Date();
    return this.save();
};

// Método para verificar permisos
apiKeySchema.methods.hasPermission = function (permission) {
    return this.permissions[permission] === true;
};

// Método estático para generar nueva API key
apiKeySchema.statics.generateKey = function () {
    const crypto = require('crypto');
    return 'bez_' + crypto.randomBytes(32).toString('hex');
};

// Método estático para validar formato de key
apiKeySchema.statics.isValidKeyFormat = function (key) {
    return typeof key === 'string' && key.length >= 32 && key.startsWith('bez_');
};

const BridgeApiKey = mongoose.model('BridgeApiKey', apiKeySchema);

module.exports = BridgeApiKey;
