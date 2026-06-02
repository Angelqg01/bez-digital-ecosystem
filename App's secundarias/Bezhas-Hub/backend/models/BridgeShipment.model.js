/**
 * Bridge Shipment Model
 * Tracking de envíos desde proveedores logísticos
 */

const mongoose = require('mongoose');

const shipmentEventSchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'exception', 'cancelled']
    },
    location: {
        type: String,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    coordinates: {
        latitude: Number,
        longitude: Number
    }
}, { _id: false });

const bridgeShipmentSchema = new mongoose.Schema({
    // Identificador
    trackingNumber: {
        type: String,
        required: true,
        unique: true,
        index: true,
        uppercase: true
    },

    // Proveedor logístico
    provider: {
        type: String,
        required: true,
        enum: ['maersk', 'fedex', 'dhl', 'ups', 'other'],
        index: true
    },

    // Estado actual
    status: {
        type: String,
        required: true,
        enum: ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'exception', 'cancelled'],
        default: 'pending',
        index: true
    },

    // Ubicación actual
    currentLocation: {
        city: String,
        country: String,
        latitude: Number,
        longitude: Number
    },

    // Estimaciones
    estimatedDelivery: {
        type: Date,
        index: true
    },
    actualDelivery: {
        type: Date
    },

    // Historial de eventos
    events: [shipmentEventSchema],

    // Historial de estados
    statusHistory: [{
        status: {
            type: String,
            enum: ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'exception', 'cancelled']
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],

    // Orden relacionada (si existe)
    orderId: {
        type: String,
        index: true
    },
    beZhasOrderId: {
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
bridgeShipmentSchema.index({ provider: 1, status: 1 });
bridgeShipmentSchema.index({ status: 1, estimatedDelivery: 1 });

// Middleware
bridgeShipmentSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Métodos de instancia
bridgeShipmentSchema.methods.updateStatus = function (newStatus, location = null, description = null) {
    this.status = newStatus;

    // Agregar a historial
    this.statusHistory.push({
        status: newStatus,
        timestamp: new Date()
    });

    // Agregar evento
    const event = {
        timestamp: new Date(),
        status: newStatus,
        description: description || `Status updated to ${newStatus}`
    };

    if (location) {
        event.location = location;
    }

    this.events.push(event);

    // Si está entregado, marcar fecha
    if (newStatus === 'delivered') {
        this.actualDelivery = new Date();
    }

    return this.save();
};

bridgeShipmentSchema.methods.isDelivered = function () {
    return this.status === 'delivered';
};

bridgeShipmentSchema.methods.isDelayed = function () {
    if (!this.estimatedDelivery || this.isDelivered()) return false;
    return new Date() > this.estimatedDelivery;
};

const BridgeShipment = mongoose.model('BridgeShipment', bridgeShipmentSchema);

module.exports = BridgeShipment;
