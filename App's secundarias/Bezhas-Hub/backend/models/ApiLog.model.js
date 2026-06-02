const mongoose = require('mongoose');

/**
 * Modelo para el sistema de logs de API
 * Permite auditoría y análisis de uso del SDK
 */
const apiLogSchema = new mongoose.Schema({
    // Referencia a la API Key utilizada
    apiKey: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ApiKey',
        required: true,
        index: true
    },

    // Usuario propietario de la API Key
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Información de la petición
    request: {
        method: {
            type: String,
            enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
            required: true
        },
        endpoint: {
            type: String,
            required: true,
            index: true
        },
        // Permiso requerido para el endpoint
        permission: String,
        // Headers (sin datos sensibles)
        userAgent: String,
        // Body size en bytes
        bodySize: Number
    },

    // Información de la respuesta
    response: {
        statusCode: {
            type: Number,
            required: true,
            index: true
        },
        // Tiempo de respuesta en ms
        responseTime: {
            type: Number,
            required: true
        },
        // Tamaño de respuesta en bytes
        responseSize: Number,
        // Si hubo error, guardar mensaje
        errorMessage: String
    },

    // Información del cliente
    client: {
        ipAddress: {
            type: String,
            index: true
        },
        country: String,
        city: String,
        // Fingerprint único del cliente (opcional)
        fingerprint: String
    },

    // Metadata adicional
    metadata: {
        type: Map,
        of: String
    },

    // Timestamp
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }

}, {
    timestamps: false, // Usamos timestamp manual
    // Optimización: TTL index para auto-eliminar logs antiguos (90 días)
    expires: '90d'
});

// Índices compuestos para consultas eficientes
apiLogSchema.index({ apiKey: 1, timestamp: -1 });
apiLogSchema.index({ user: 1, timestamp: -1 });
apiLogSchema.index({ 'request.endpoint': 1, timestamp: -1 });
apiLogSchema.index({ 'response.statusCode': 1, timestamp: -1 });
apiLogSchema.index({ timestamp: -1 }); // Para queries de rango temporal

// Métodos estáticos para analytics

/**
 * Obtener estadísticas de uso por API Key
 */
apiLogSchema.statics.getKeyStats = async function (apiKeyId, startDate, endDate) {
    const matchStage = {
        apiKey: new mongoose.Types.ObjectId(apiKeyId),
        timestamp: {
            $gte: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default: últimos 30 días
            $lte: endDate || new Date()
        }
    };

    const stats = await this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: null,
                totalRequests: { $sum: 1 },
                successfulRequests: {
                    $sum: { $cond: [{ $lt: ['$response.statusCode', 400] }, 1, 0] }
                },
                failedRequests: {
                    $sum: { $cond: [{ $gte: ['$response.statusCode', 400] }, 1, 0] }
                },
                avgResponseTime: { $avg: '$response.responseTime' },
                totalDataTransferred: { $sum: { $add: ['$request.bodySize', '$response.responseSize'] } }
            }
        }
    ]);

    return stats[0] || {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        avgResponseTime: 0,
        totalDataTransferred: 0
    };
};

/**
 * Obtener endpoints más utilizados
 */
apiLogSchema.statics.getTopEndpoints = async function (apiKeyId, limit = 10) {
    return this.aggregate([
        {
            $match: {
                apiKey: new mongoose.Types.ObjectId(apiKeyId),
                timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Últimos 7 días
            }
        },
        {
            $group: {
                _id: '$request.endpoint',
                count: { $sum: 1 },
                avgResponseTime: { $avg: '$response.responseTime' },
                errorRate: {
                    $avg: { $cond: [{ $gte: ['$response.statusCode', 400] }, 1, 0] }
                }
            }
        },
        { $sort: { count: -1 } },
        { $limit: limit },
        {
            $project: {
                endpoint: '$_id',
                count: 1,
                avgResponseTime: { $round: ['$avgResponseTime', 2] },
                errorRate: { $multiply: [{ $round: ['$errorRate', 4] }, 100] },
                _id: 0
            }
        }
    ]);
};

/**
 * Obtener actividad por día
 */
apiLogSchema.statics.getDailyActivity = async function (apiKeyId, days = 30) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return this.aggregate([
        {
            $match: {
                apiKey: new mongoose.Types.ObjectId(apiKeyId),
                timestamp: { $gte: startDate }
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: '$timestamp' },
                    month: { $month: '$timestamp' },
                    day: { $dayOfMonth: '$timestamp' }
                },
                requests: { $sum: 1 },
                errors: {
                    $sum: { $cond: [{ $gte: ['$response.statusCode', 400] }, 1, 0] }
                }
            }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
        {
            $project: {
                date: {
                    $dateFromParts: {
                        year: '$_id.year',
                        month: '$_id.month',
                        day: '$_id.day'
                    }
                },
                requests: 1,
                errors: 1,
                _id: 0
            }
        }
    ]);
};

/**
 * Detectar anomalías (picos de errores)
 */
apiLogSchema.statics.detectAnomalies = async function (apiKeyId, threshold = 0.2) {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    return this.aggregate([
        {
            $match: {
                apiKey: new mongoose.Types.ObjectId(apiKeyId),
                timestamp: { $gte: last24h }
            }
        },
        {
            $group: {
                _id: {
                    $dateToString: { format: '%Y-%m-%d %H:00', date: '$timestamp' }
                },
                total: { $sum: 1 },
                errors: {
                    $sum: { $cond: [{ $gte: ['$response.statusCode', 400] }, 1, 0] }
                }
            }
        },
        {
            $project: {
                hour: '$_id',
                total: 1,
                errors: 1,
                errorRate: {
                    $cond: [
                        { $eq: ['$total', 0] },
                        0,
                        { $divide: ['$errors', '$total'] }
                    ]
                },
                _id: 0
            }
        },
        {
            $match: {
                errorRate: { $gte: threshold }
            }
        },
        { $sort: { hour: -1 } }
    ]);
};

module.exports = mongoose.model('ApiLog', apiLogSchema);
