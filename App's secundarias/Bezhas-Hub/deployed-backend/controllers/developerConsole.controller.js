const ApiKey = require('../models/ApiKey.model');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const mongoose = require('mongoose');
const db = require('../database/inMemoryDB');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// Helper para verificar conexión a DB
const isMongoConnected = () => mongoose.connection.readyState === 1;

// Helper para generar key sin modelo
const generateKey = (environment, sector) => {
    const prefix = environment === 'production' ? 'bzh_live' : 'bzh_test';
    const randomPart = crypto.randomBytes(24).toString('hex');
    return `${prefix}_${sector}_${randomPart}`;
};

const hashKey = (key) => crypto.createHash('sha256').update(key).digest('hex');

/**
 * @desc    Crear nueva API Key
 * @route   POST /api/developer/keys
 * @access  Private
 */
exports.createApiKey = asyncHandler(async (req, res, next) => {
    try {
        const { name, description, sector, permissions, environment, rateLimit } = req.body;
        const userId = req.user?.id || 'mock-admin-id';

        // Validación básica
        if (!name || !sector) {
            return next(new ErrorResponse('Nombre y sector son requeridos', 400));
        }

        let responseData;
        let fullKey;

        if (isMongoConnected()) {
            // --- MOMGODB IMPLEMENTATION ---

            // Limitar número de API Keys por usuario
            const existingKeys = await ApiKey.countDocuments({
                user: userId,
                status: { $ne: 'revoked' }
            });

            const maxKeys = req.user?.role === 'admin' ? 50 : 10;
            if (existingKeys >= maxKeys) {
                return next(new ErrorResponse(`Has alcanzado el límite de ${maxKeys} API Keys`, 403));
            }

            const key = ApiKey.generateKey(userId, sector, environment || 'development');
            const keyHash = ApiKey.hashKey(key);

            const apiKey = await ApiKey.create({
                name,
                description,
                sector,
                key,
                keyHash,
                user: userId,
                permissions: permissions || [],
                environment: environment || 'development',
                rateLimit: rateLimit || {}
            });

            responseData = apiKey.toJSON();
            fullKey = key;

        } else {
            // --- IN-MEMORY FALLBACK ---
            console.warn('⚠️ MongoDB not connected. Using In-Memory Store for API Key.');

            const existingKeys = Array.from(db.apiKeys.values()).filter(k => k.user === userId && k.status !== 'revoked').length;
            if (existingKeys >= 10) return next(new ErrorResponse('Límite de API Keys alcanzado (In-Memory)', 403));

            const key = generateKey(environment, sector);
            const keyHash = hashKey(key);

            const newApiKey = {
                _id: uuidv4(),
                name,
                description,
                sector,
                keyHash, // Store hash, not key
                user: userId,
                permissions: permissions || [],
                environment: environment || 'development',
                status: 'active',
                usage: { totalRequests: 0, requestsToday: 0, requestsThisMonth: 0, lastUsed: null },
                rateLimit: rateLimit || { requestsPerMinute: 60, requestsPerDay: 10000 },
                createdAt: new Date(),
                updatedAt: new Date()
            };

            db.apiKeys.set(newApiKey._id, newApiKey);

            responseData = { ...newApiKey };
            fullKey = key;
        }

        // Respuesta común
        responseData.key = fullKey; // Mostrar clave completa SOLO AQUI

        res.status(201).json({
            success: true,
            data: responseData,
            message: '⚠️ Guarda esta clave. No podrás verla nuevamente.'
        });

    } catch (error) {
        console.error('❌ Error creating API Key:', error);
        return next(new ErrorResponse('Error al crear API Key: ' + error.message, 500));
    }
});

/**
 * @desc    Obtener todas las API Keys del usuario
 * @route   GET /api/developer/keys
 * @access  Private
 */
exports.getApiKeys = asyncHandler(async (req, res, next) => {
    try {
        const userId = req.user?.id || 'mock-admin-id';
        let apiKeys;

        if (isMongoConnected()) {
            apiKeys = await ApiKey.find({
                user: userId,
                status: { $ne: 'revoked' }
            })
                .select('-keyHash')
                .sort('-createdAt');
        } else {
            apiKeys = Array.from(db.apiKeys.values())
                .filter(k => k.user === userId && k.status !== 'revoked')
                .sort((a, b) => b.createdAt - a.createdAt);
        }

        res.status(200).json({
            success: true,
            count: apiKeys.length,
            data: apiKeys
        });

    } catch (error) {
        console.error('❌ Error getting API Keys:', error);
        return next(new ErrorResponse('Error al obtener API Keys: ' + error.message, 500));
    }
});

/**
 * @desc    Obtener detalles de una API Key específica
 * @route   GET /api/developer/keys/:id
 * @access  Private
 */
exports.getApiKeyById = asyncHandler(async (req, res, next) => {
    try {
        const userId = req.user?.id || 'mock-admin-id';
        let apiKey;

        if (isMongoConnected()) {
            apiKey = await ApiKey.findById(req.params.id).select('-keyHash');
        } else {
            apiKey = db.apiKeys.get(req.params.id);
        }

        if (!apiKey) {
            return next(new ErrorResponse('API Key no encontrada', 404));
        }

        // Autenticación In-Memory simplificada: Asumimos mock-admin-id si no hay auth real
        const keyOwner = apiKey.user.toString();
        if (keyOwner !== userId && req.user?.role !== 'admin') {
            return next(new ErrorResponse('No autorizado', 403));
        }

        res.status(200).json({
            success: true,
            data: apiKey
        });

    } catch (error) {
        console.error('❌ Error getting API Key by ID:', error);
        return next(new ErrorResponse('Error al obtener API Key: ' + error.message, 500));
    }
});

/**
 * @desc    Actualizar API Key (permisos, nombre, rate limits)
 * @route   PUT /api/developer/keys/:id
 * @access  Private
 */
exports.updateApiKey = asyncHandler(async (req, res, next) => {
    const userId = req.user?.id || 'mock-admin-id';
    const allowedFields = ['name', 'description', 'permissions', 'status', 'rateLimit', 'webhooks', 'ipWhitelist'];
    let apiKey;

    if (isMongoConnected()) {
        apiKey = await ApiKey.findById(req.params.id);
        if (!apiKey) return next(new ErrorResponse('API Key no encontrada', 404));
        if (apiKey.user.toString() !== userId && req.user?.role !== 'admin') return next(new ErrorResponse('No autorizado', 403));

        const updateFields = {};
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) updateFields[field] = req.body[field];
        });

        apiKey = await ApiKey.findByIdAndUpdate(req.params.id, updateFields, { new: true, runValidators: true }).select('-keyHash');
    } else {
        apiKey = db.apiKeys.get(req.params.id);
        if (!apiKey) return next(new ErrorResponse('API Key no encontrada', 404));
        if (apiKey.user !== userId && req.user?.role !== 'admin') return next(new ErrorResponse('No autorizado', 403));

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) apiKey[field] = req.body[field];
        });
        apiKey.updatedAt = new Date();
        db.apiKeys.set(apiKey._id, apiKey);
    }

    res.status(200).json({
        success: true,
        data: apiKey
    });
});

/**
 * @desc    Eliminar/Revocar API Key
 * @route   DELETE /api/developer/keys/:id
 * @access  Private
 */
exports.deleteApiKey = asyncHandler(async (req, res, next) => {
    const userId = req.user?.id || 'mock-admin-id';

    if (isMongoConnected()) {
        const apiKey = await ApiKey.findById(req.params.id);
        if (!apiKey) return next(new ErrorResponse('API Key no encontrada', 404));

        // Soft delete
        apiKey.status = 'revoked';
        await apiKey.save();
    } else {
        const apiKey = db.apiKeys.get(req.params.id);
        if (!apiKey) return next(new ErrorResponse('API Key no encontrada', 404));

        apiKey.status = 'revoked';
        apiKey.updatedAt = new Date();
        db.apiKeys.set(apiKey._id, apiKey);
    }

    res.status(200).json({
        success: true,
        data: {},
        message: 'API Key revocada exitosamente'
    });
});

/**
 * @desc    Rotar API Key (generar nueva clave)
 * @route   POST /api/developer/keys/:id/rotate
 * @access  Private
 */
exports.rotateApiKey = asyncHandler(async (req, res, next) => {
    const userId = req.user?.id || 'mock-admin-id';
    let responseData;
    let newKey;

    if (isMongoConnected()) {
        const apiKey = await ApiKey.findById(req.params.id);
        if (!apiKey) return next(new ErrorResponse('API Key no encontrada', 404));

        newKey = await apiKey.rotateKey(); // Implementado en el modelo
        responseData = apiKey.toJSON();
    } else {
        const apiKey = db.apiKeys.get(req.params.id);
        if (!apiKey) return next(new ErrorResponse('API Key no encontrada', 404));

        newKey = generateKey(apiKey.environment, apiKey.sector);
        apiKey.keyHash = hashKey(newKey);
        apiKey.lastRotated = new Date();
        apiKey.updatedAt = new Date();
        db.apiKeys.set(apiKey._id, apiKey);

        responseData = { ...apiKey };
    }

    responseData.key = newKey; // Devolver clave completa

    res.status(200).json({
        success: true,
        data: responseData,
        message: '⚠️ Nueva clave generada. Actualiza tu aplicación.'
    });
});

/**
 * @desc    Obtener estadísticas de uso de una API Key
 * @route   GET /api/developer/keys/:id/usage
 * @access  Private
 */
exports.getApiKeyUsageStats = asyncHandler(async (req, res, next) => {
    // Implementación simplificada
    const userId = req.user?.id || 'mock-admin-id';
    let stats;

    if (isMongoConnected()) {
        const apiKey = await ApiKey.findById(req.params.id);
        if (!apiKey) return next(new ErrorResponse('Not found', 404));
        stats = apiKey.usage;
        stats.rateLimit = apiKey.rateLimit;
    } else {
        const apiKey = db.apiKeys.get(req.params.id);
        if (!apiKey) return next(new ErrorResponse('Not found', 404));
        stats = { ...apiKey.usage, rateLimit: apiKey.rateLimit };
    }

    res.status(200).json({ success: true, data: stats });
});

/**
 * @desc    Probar API Key con request simulado
 * @route   POST /api/developer/keys/:id/test
 * @access  Private
 */
exports.testApiKey = asyncHandler(async (req, res, next) => {
    const userId = req.user?.id || 'mock-admin-id';
    let apiKey;

    if (isMongoConnected()) {
        apiKey = await ApiKey.findById(req.params.id);
    } else {
        apiKey = db.apiKeys.get(req.params.id);
    }

    if (!apiKey) return next(new ErrorResponse('API Key no encontrada', 404));

    // In-memory helper for permission check
    const hasPermission = (permission) => apiKey.permissions.includes(permission);

    const { endpoint, permission } = req.body;

    if (apiKey.status !== 'active') {
        return res.status(200).json({
            success: false,
            test: { status: 'failed', reason: `API Key está ${apiKey.status}` }
        });
    }

    if (permission && !hasPermission(permission)) {
        return res.status(200).json({
            success: false,
            test: { status: 'failed', reason: `Permiso '${permission}' no otorgado` }
        });
    }

    res.status(200).json({
        success: true,
        test: {
            status: 'success',
            message: 'API Key es válida y funcional',
            endpoint: endpoint || 'N/A',
            permissions: apiKey.permissions
        }
    });
});

/**
 * @desc    Agregar webhook a una API Key
 * @route   POST /api/developer/keys/:id/webhooks
 * @access  Private
 */
exports.addWebhook = asyncHandler(async (req, res, next) => {
    const userId = req.user?.id || 'mock-admin-id';
    const { url, events, secret } = req.body;

    // Validación básica
    if (!url || !events || events.length === 0) {
        return next(new ErrorResponse('URL y eventos son requeridos', 400));
    }

    // Validar formato de URL
    try {
        new URL(url);
    } catch (e) {
        return next(new ErrorResponse('URL inválida', 400));
    }

    let apiKey;

    if (isMongoConnected()) {
        apiKey = await ApiKey.findById(req.params.id);
        if (!apiKey) return next(new ErrorResponse('API Key no encontrada', 404));
        if (apiKey.user.toString() !== userId && req.user?.role !== 'admin') {
            return next(new ErrorResponse('No autorizado', 403));
        }

        // Agregar webhook
        const webhook = {
            url,
            events,
            secret: secret || crypto.randomBytes(32).toString('hex'),
            active: true
        };

        apiKey.webhooks.push(webhook);
        await apiKey.save();

        res.status(201).json({
            success: true,
            data: webhook,
            message: 'Webhook agregado exitosamente'
        });
    } else {
        apiKey = db.apiKeys.get(req.params.id);
        if (!apiKey) return next(new ErrorResponse('API Key no encontrada', 404));
        if (apiKey.user !== userId && req.user?.role !== 'admin') {
            return next(new ErrorResponse('No autorizado', 403));
        }

        const webhook = {
            id: uuidv4(),
            url,
            events,
            secret: secret || crypto.randomBytes(32).toString('hex'),
            active: true
        };

        if (!apiKey.webhooks) apiKey.webhooks = [];
        apiKey.webhooks.push(webhook);
        apiKey.updatedAt = new Date();
        db.apiKeys.set(apiKey._id, apiKey);

        res.status(201).json({
            success: true,
            data: webhook,
            message: 'Webhook agregado exitosamente'
        });
    }
});

/**
 * @desc    Eliminar webhook de una API Key
 * @route   DELETE /api/developer/keys/:keyId/webhooks/:webhookId
 * @access  Private
 */
exports.deleteWebhook = asyncHandler(async (req, res, next) => {
    const userId = req.user?.id || 'mock-admin-id';
    const { keyId, webhookId } = req.params;

    if (isMongoConnected()) {
        const apiKey = await ApiKey.findById(keyId);
        if (!apiKey) return next(new ErrorResponse('API Key no encontrada', 404));
        if (apiKey.user.toString() !== userId && req.user?.role !== 'admin') {
            return next(new ErrorResponse('No autorizado', 403));
        }

        // Eliminar webhook
        apiKey.webhooks = apiKey.webhooks.filter(w => w._id.toString() !== webhookId);
        await apiKey.save();

        res.status(200).json({
            success: true,
            message: 'Webhook eliminado exitosamente'
        });
    } else {
        const apiKey = db.apiKeys.get(keyId);
        if (!apiKey) return next(new ErrorResponse('API Key no encontrada', 404));
        if (apiKey.user !== userId && req.user?.role !== 'admin') {
            return next(new ErrorResponse('No autorizado', 403));
        }

        apiKey.webhooks = (apiKey.webhooks || []).filter(w => w.id !== webhookId);
        apiKey.updatedAt = new Date();
        db.apiKeys.set(apiKey._id, apiKey);

        res.status(200).json({
            success: true,
            message: 'Webhook eliminado exitosamente'
        });
    }
});

/**
 * @desc    Obtener webhooks de una API Key
 * @route   GET /api/developer/keys/:id/webhooks
 * @access  Private
 */
exports.getWebhooks = asyncHandler(async (req, res, next) => {
    const userId = req.user?.id || 'mock-admin-id';
    let apiKey;

    if (isMongoConnected()) {
        apiKey = await ApiKey.findById(req.params.id);
    } else {
        apiKey = db.apiKeys.get(req.params.id);
    }

    if (!apiKey) return next(new ErrorResponse('API Key no encontrada', 404));

    res.status(200).json({
        success: true,
        data: apiKey.webhooks || []
    });
});

/**
 * @desc    Obtener estadísticas agregadas de uso de todas las API Keys del usuario
 * @route   GET /api/developer/usage-stats/:address
 * @access  Public (no requiere auth, usa address de wallet)
 */
exports.getUsageStats = asyncHandler(async (req, res, next) => {
    const { address } = req.params;

    if (!address) {
        return next(new ErrorResponse('Address de wallet requerida', 400));
    }

    let apiKeys = [];

    if (isMongoConnected()) {
        // Buscar todas las API Keys del usuario por address (en lugar de user ID)
        apiKeys = await ApiKey.find({
            owner: address.toLowerCase(),
            status: { $ne: 'revoked' }
        });
    } else {
        // Buscar en memoria
        apiKeys = Array.from(db.apiKeys.values()).filter(
            k => k.owner && k.owner.toLowerCase() === address.toLowerCase() && k.status !== 'revoked'
        );
    }

    if (apiKeys.length === 0) {
        return res.json({
            success: true,
            data: {
                requestsThisMonth: 0,
                totalRequests: 0,
                smartContractCalls: 0,
                identityValidations: 0,
                requestsToday: 0
            }
        });
    }

    // Agregar métricas de todas las keys
    const stats = apiKeys.reduce((acc, key) => {
        const usage = key.usage || {};
        return {
            requestsThisMonth: acc.requestsThisMonth + (usage.requestsThisMonth || 0),
            totalRequests: acc.totalRequests + (usage.totalRequests || 0),
            smartContractCalls: acc.smartContractCalls + (usage.smartContractCalls || 0),
            identityValidations: acc.identityValidations + (usage.identityValidations || 0),
            requestsToday: acc.requestsToday + (usage.requestsToday || 0)
        };
    }, {
        requestsThisMonth: 0,
        totalRequests: 0,
        smartContractCalls: 0,
        identityValidations: 0,
        requestsToday: 0
    });

    res.json({
        success: true,
        data: stats
    });
});
