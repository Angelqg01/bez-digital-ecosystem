/**
 * Bridge Synced Item Model
 * Items sincronizados desde plataformas externas
 */

const mongoose = require('mongoose');

const bridgeSyncedItemSchema = new mongoose.Schema({
    // Identificadores
    beZhasId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    externalId: {
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

    // Información del producto
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500
    },
    description: {
        type: String,
        trim: true,
        maxlength: 5000
    },

    // Precio
    price: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        required: true,
        uppercase: true,
        default: 'EUR'
    },

    // Media
    images: [{
        type: String,
        trim: true
    }],

    // Categorización
    category: {
        type: String,
        trim: true,
        index: true
    },
    condition: {
        type: String,
        enum: ['new', 'like_new', 'used_excellent', 'used_good', 'used_fair', 'used_poor', 'damaged'],
        default: 'used_good'
    },

    // Metadata del producto
    metadata: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
    },

    // Estado de sincronización
    syncStatus: {
        type: String,
        enum: ['pending', 'synced', 'error', 'out_of_sync'],
        default: 'synced',
        index: true
    },
    syncedAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    lastSyncAt: {
        type: Date,
        default: Date.now
    },
    syncError: {
        type: String,
        default: null
    },

    // Usuario que sincronizó (si aplica)
    syncedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },

    // API Key usada
    apiKey: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BridgeApiKey',
        required: true
    },

    // Disponibilidad
    available: {
        type: Boolean,
        default: true,
        index: true
    },
    stock: {
        type: Number,
        default: 1,
        min: 0
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
bridgeSyncedItemSchema.index({ platform: 1, externalId: 1 }, { unique: true });
bridgeSyncedItemSchema.index({ platform: 1, syncStatus: 1 });
bridgeSyncedItemSchema.index({ available: 1, syncStatus: 1 });
bridgeSyncedItemSchema.index({ category: 1, available: 1 });

// Middleware
bridgeSyncedItemSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Métodos de instancia
bridgeSyncedItemSchema.methods.markSynced = function () {
    this.syncStatus = 'synced';
    this.lastSyncAt = new Date();
    this.syncError = null;
    return this.save();
};

bridgeSyncedItemSchema.methods.markError = function (error) {
    this.syncStatus = 'error';
    this.syncError = error;
    return this.save();
};

const BridgeSyncedItem = mongoose.model('BridgeSyncedItem', bridgeSyncedItemSchema);

module.exports = BridgeSyncedItem;
