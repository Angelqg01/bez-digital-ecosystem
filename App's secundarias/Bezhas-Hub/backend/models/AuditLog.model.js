const mongoose = require('mongoose');

/**
 * AuditLog Model - Platform-wide audit trail for administrative actions
 * 
 * Captures who did what, when, and what changed.
 * Especially important for configuration changes in GlobalSettings.
 */
const auditLogSchema = new mongoose.Schema({
    // User who performed the action (Admin) - Optional if performed by system
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
        index: true
    },

    // Name or identifier of the performer (e.g., 'admin@bez.digital', 'system')
    performedBy: {
        type: String,
        required: true,
        index: true
    },

    // Action name (e.g., 'UPDATE_GLOBAL_SETTINGS')
    action: {
        type: String,
        required: true,
        index: true
    },

    // Resource being modified (e.g., 'global_settings')
    resource: {
        type: String,
        required: true,
        index: true
    },

    // Document ID of the resource (if applicable)
    resourceId: {
        type: String,
        index: true
    },

    // Section within the resource (e.g., 'defi', 'token')
    section: {
        type: String,
        index: true
    },

    // State before change (null for creation)
    previousState: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },

    // State after change
    newState: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },

    // Request metadata
    metadata: {
        ipAddress: String,
        userAgent: String,
        method: String,
        path: String
    },

    // Timestamp
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: false // Manual timestamp via createdAt
});

// TTL Index: Keep audit logs for 1 year (365 days)
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

/**
 * Create an audit entry
 * @param {object} params - Audit parameters
 * @returns {Promise<object>} Created log entry
 */
auditLogSchema.statics.log = async function (params) {
    try {
        const log = new this(params);
        return await log.save();
    } catch (error) {
        console.error('❌ Failed to create AuditLog:', error.message);
        // We don't throw here to avoid breaking the main operation if logging fails
        return null;
    }
};

module.exports = mongoose.model('AuditLog', auditLogSchema);
