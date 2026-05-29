const mongoose = require('mongoose');

/**
 * OpenClawClient Model - Persistencia de provisiones del agente IA
 * 
 * Almacena las credenciales y configuraciones de cada cliente 
 * que utiliza el Bridge de OpenClaw.
 */
const openClawClientSchema = new mongoose.Schema({
    // Wallet del cliente (identificador principal)
    walletAddress: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true
    },

    // ID único interno generado por OpenClaw
    clientId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    // Plan de suscripción (starter, pro, enterprise, vip)
    plan: {
        type: String,
        required: true,
        enum: ['starter', 'pro', 'enterprise', 'vip'],
        default: 'starter'
    },

    // Lista de plataformas habilitadas
    platforms: [{
        type: String
    }],

    // Credenciales por plataforma { 'vinted': { apiKey, webhookSecret, ... } }
    credentials: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
    },

    // Hash de la transacción de pago/suscripción
    txHash: {
        type: String,
        index: true
    },

    // Estado de la provisión
    status: {
        type: String,
        enum: ['active', 'revoked', 'expired', 'pending'],
        default: 'active',
        index: true
    },

    // Webhook URL del cliente para notificaciones
    webhookUrl: {
        type: String,
        trim: true
    },

    // Métricas de uso diario
    usage: {
        requestsToday: { type: Number, default: 0 },
        webhooksToday: { type: Number, default: 0 },
        lastUsed: Date
    },

    // Fechas clave
    provisionedAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: Date,
    revokedAt: Date,
    revokeReason: String

}, {
    timestamps: true
});

// Índice para limpieza de expirados
openClawClientSchema.index({ expiresAt: 1, status: 1 });

/**
 * Incrementar contadores de uso
 */
openClawClientSchema.methods.recordRequest = async function() {
    this.usage.requestsToday += 1;
    this.usage.lastUsed = new Date();
    return await this.save();
};

module.exports = mongoose.model('OpenClawClient', openClawClientSchema);
