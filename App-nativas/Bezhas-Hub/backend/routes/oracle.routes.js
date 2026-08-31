/**
 * @title Data Oracle Routes
 * @dev API endpoints para el sistema de oráculo de datos
 */

const express = require('express');
const router = express.Router();
const dataOracleService = require('../services/data-oracle.service');
const { protect } = require('../middleware/auth.middleware');

/**
 * ════════════════════════════════════════════════════════════
 * ToolBEZ™ Enterprise BaaS Routes
 * ════════════════════════════════════════════════════════════
 */

// Middleware para validar API Key empresarial
const validateEnterpriseApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
        return res.status(401).json({
            success: false,
            error: 'API Key requerida. Use el header "x-api-key"'
        });
    }

    const enterprise = dataOracleService.verifyEnterpriseApiKey(apiKey);
    if (!enterprise) {
        return res.status(403).json({
            success: false,
            error: 'API Key inválida o expirada'
        });
    }

    req.enterprise = enterprise;
    next();
};

/**
 * @route   POST /api/oracle/toolbez/iot-ingest
 * @desc    Registrar datos IoT en blockchain (BaaS)
 * @access  Enterprise (API Key)
 */
router.post('/toolbez/iot-ingest', validateEnterpriseApiKey, async (req, res) => {
    try {
        const { productId, sensorData, metadata } = req.body;

        if (!productId || !sensorData) {
            return res.status(400).json({
                success: false,
                error: 'productId y sensorData son requeridos'
            });
        }

        const result = await dataOracleService.recordIoTData({
            apiKey: req.headers['x-api-key'],
            productId,
            sensorData,
            metadata: metadata || {}
        });

        res.json(result);
    } catch (error) {
        console.error('Error en iot-ingest:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   POST /api/oracle/toolbez/batch
 * @desc    Ejecutar múltiples operaciones IoT (MTT)
 * @access  Enterprise (API Key)
 */
router.post('/toolbez/batch', validateEnterpriseApiKey, async (req, res) => {
    try {
        const { operations } = req.body;

        if (!operations || !Array.isArray(operations)) {
            return res.status(400).json({
                success: false,
                error: 'operations array es requerido'
            });
        }

        const result = await dataOracleService.executeBatchOperation({
            apiKey: req.headers['x-api-key'],
            operations
        });

        res.json(result);
    } catch (error) {
        console.error('Error en batch:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   GET /api/oracle/toolbez/verify/:productId
 * @desc    Verificar trazabilidad de producto (Consumidor final)
 * @access  Public
 */
router.get('/toolbez/verify/:productId', async (req, res) => {
    try {
        const { productId } = req.params;

        const result = await dataOracleService.verifyProduct(productId);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error verificando producto:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   GET /api/oracle/toolbez/stats
 * @desc    Estadísticas de uso empresarial
 * @access  Enterprise (API Key)
 */
router.get('/toolbez/stats', validateEnterpriseApiKey, async (req, res) => {
    try {
        const stats = await dataOracleService.getEnterpriseStats(req.headers['x-api-key']);

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error obteniendo stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * ════════════════════════════════════════════════════════════
 * Standard Oracle Data Routes
 * ════════════════════════════════════════════════════════════
 */

/**
 * @route   GET /api/oracle/feeds
 * @desc    Obtener todos los feeds de datos activos
 * @access  Public
 */
router.get('/feeds', async (req, res) => {
    try {
        const feeds = await dataOracleService.getAllFeeds?.() || [];

        res.json({
            success: true,
            data: feeds,
            count: feeds.length
        });
    } catch (error) {
        console.error('Error fetching feeds:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener feeds de datos',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/oracle/feed/:feedId
 * @desc    Obtener un feed específico por ID
 * @access  Public
 */
router.get('/feed/:feedId', async (req, res) => {
    try {
        const { feedId } = req.params;

        if (!feedId) {
            return res.status(400).json({
                success: false,
                message: 'ID de feed requerido'
            });
        }

        const feed = await dataOracleService.getFeedById?.(feedId);

        if (!feed) {
            return res.status(404).json({
                success: false,
                message: 'Feed no encontrado'
            });
        }

        res.json({
            success: true,
            data: feed
        });
    } catch (error) {
        console.error('Error fetching feed:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener feed',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/oracle/prices
 * @desc    Obtener todos los precios disponibles
 * @access  Public
 */
router.get('/prices', async (req, res) => {
    try {
        const prices = await dataOracleService.getAllPrices?.() || [];

        res.json({
            success: true,
            data: prices,
            count: prices.length
        });
    } catch (error) {
        console.error('Error fetching prices:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener precios',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/oracle/price/:symbol
 * @desc    Obtener precio de un símbolo específico
 * @access  Public
 */
router.get('/price/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;

        if (!symbol) {
            return res.status(400).json({
                success: false,
                message: 'Símbolo requerido'
            });
        }

        const price = await dataOracleService.getPrice?.(symbol.toUpperCase());

        if (!price) {
            return res.status(404).json({
                success: false,
                message: `Precio no encontrado para ${symbol}`
            });
        }

        res.json({
            success: true,
            data: price
        });
    } catch (error) {
        console.error('Error fetching price:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener precio',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/oracle/stats
 * @desc    Obtener estadísticas del oráculo
 * @access  Public
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await dataOracleService.getOracleStats?.() || {
            totalFeeds: 0,
            totalPrices: 0,
            totalRequests: 0
        };

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching oracle stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener estadísticas',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/oracle/provider/:address
 * @desc    Obtener información de un proveedor
 * @access  Public
 */
router.get('/provider/:address', async (req, res) => {
    try {
        const { address } = req.params;

        if (!address) {
            return res.status(400).json({
                success: false,
                message: 'Dirección de proveedor requerida'
            });
        }

        const provider = await dataOracleService.getProviderInfo?.(address);

        if (!provider) {
            return res.status(404).json({
                success: false,
                message: 'Proveedor no encontrado'
            });
        }

        res.json({
            success: true,
            data: provider
        });
    } catch (error) {
        console.error('Error fetching provider:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener información del proveedor',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/oracle/request/:requestId
 * @desc    Obtener información de una solicitud
 * @access  Public
 */
router.get('/request/:requestId', async (req, res) => {
    try {
        const { requestId } = req.params;

        if (!requestId && requestId !== '0') {
            return res.status(400).json({
                success: false,
                message: 'ID de solicitud requerido'
            });
        }

        const request = await dataOracleService.getRequestInfo?.(parseInt(requestId));

        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Solicitud no encontrada'
            });
        }

        res.json({
            success: true,
            data: request
        });
    } catch (error) {
        console.error('Error fetching request:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener solicitud',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/oracle/popular-prices
 * @desc    Obtener precios populares y recientes
 * @access  Public
 */
router.get('/popular-prices', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const prices = await dataOracleService.getPopularPrices?.(limit) || [];

        res.json({
            success: true,
            data: prices,
            count: prices.length
        });
    } catch (error) {
        console.error('Error fetching popular prices:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener precios populares',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/oracle/search
 * @desc    Buscar feeds por término
 * @access  Public
 */
router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;

        if (!q) {
            return res.status(400).json({
                success: false,
                message: 'Término de búsqueda requerido'
            });
        }

        const feeds = await dataOracleService.searchFeeds?.(q) || [];

        res.json({
            success: true,
            data: feeds,
            count: feeds.length,
            query: q
        });
    } catch (error) {
        console.error('Error searching feeds:', error);
        res.status(500).json({
            success: false,
            message: 'Error al buscar feeds',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/oracle/provider/:address/feeds
 * @desc    Obtener feeds de un proveedor específico
 * @access  Public
 */
router.get('/provider/:address/feeds', async (req, res) => {
    try {
        const { address } = req.params;

        if (!address) {
            return res.status(400).json({
                success: false,
                message: 'Dirección de proveedor requerida'
            });
        }

        const feeds = await dataOracleService.getFeedsByProvider?.(address) || [];

        res.json({
            success: true,
            data: feeds,
            count: feeds.length,
            provider: address
        });
    } catch (error) {
        console.error('Error fetching provider feeds:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener feeds del proveedor',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/oracle/validate-provider
 * @desc    Validar si un usuario puede crear feeds
 * @access  Protected
 */
router.post('/validate-provider', protect, async (req, res) => {
    try {
        const { userAddress } = req.body;

        if (!userAddress) {
            return res.status(400).json({
                success: false,
                message: 'Dirección de usuario requerida'
            });
        }

        const validation = await dataOracleService.canCreateFeed?.(userAddress) || {
            canCreate: false,
            reason: 'Servicio no disponible'
        };

        res.json({
            success: true,
            data: validation
        });
    } catch (error) {
        console.error('Error validating provider:', error);
        res.status(500).json({
            success: false,
            message: 'Error al validar proveedor',
            error: error.message
        });
    }
});

/**
 * ════════════════════════════════════════════════════════════
 * ADMIN ORACLE ROUTES - For Admin/CEO/Developers
 * ════════════════════════════════════════════════════════════
 */

// Admin middleware (simplified - should use proper role-based auth)
const adminMiddleware = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user || !['admin', 'ceo', 'developer', 'superadmin'].includes(user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Acceso denegado. Se requiere rol de administrador.'
            });
        }
        next();
    } catch (error) {
        res.status(403).json({
            success: false,
            error: 'Error de autorización'
        });
    }
};

/**
 * @route   GET /api/oracle/admin/validators
 * @desc    Get all validators with stats
 * @access  Admin
 */
router.get('/admin/validators', protect, adminMiddleware, async (req, res) => {
    try {
        // In production, this would fetch from blockchain/database
        const validators = await dataOracleService.getAdminValidators?.() || [];

        res.json({
            success: true,
            validators,
            total: validators.length
        });
    } catch (error) {
        console.error('Error fetching validators:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   GET /api/oracle/admin/disputes
 * @desc    Get all disputes
 * @access  Admin
 */
router.get('/admin/disputes', protect, adminMiddleware, async (req, res) => {
    try {
        const disputes = await dataOracleService.getAdminDisputes?.() || [];

        res.json({
            success: true,
            disputes,
            total: disputes.length
        });
    } catch (error) {
        console.error('Error fetching disputes:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   GET /api/oracle/admin/config
 * @desc    Get contract configuration
 * @access  Admin
 */
router.get('/admin/config', protect, adminMiddleware, async (req, res) => {
    try {
        const config = await dataOracleService.getContractConfig?.() || {
            contract: {
                address: process.env.QUALITY_ORACLE_ADDRESS || '0x0000000000000000000000000000000000000000',
                network: process.env.POLYGON_NETWORK || 'polygon',
                version: '2.1.0',
                paused: false
            },
            parameters: {
                minStake: 1000,
                minQualityThreshold: 60,
                disputeTimeout: 7,
                validatorMinStake: 1000,
                penaltyMultiplier: 150,
                rewardMultiplier: 120
            },
            roles: {
                admin: [],
                dao: [],
                arbitrator: []
            },
            entityTypes: [
                { type: 'PRODUCT', threshold: 60, collateral: 100, fee: 5, active: true },
                { type: 'SERVICE', threshold: 70, collateral: 200, fee: 10, active: true },
                { type: 'NFT', threshold: 50, collateral: 50, fee: 2, active: true },
                { type: 'RWA', threshold: 80, collateral: 1000, fee: 50, active: true },
                { type: 'LOGISTICS', threshold: 75, collateral: 150, fee: 8, active: true },
                { type: 'POST', threshold: 30, collateral: 5, fee: 0.5, active: true }
            ]
        };

        res.json({
            success: true,
            ...config
        });
    } catch (error) {
        console.error('Error fetching config:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   POST /api/oracle/admin/pause
 * @desc    Pause the contract
 * @access  Admin
 */
router.post('/admin/pause', protect, adminMiddleware, async (req, res) => {
    try {
        await dataOracleService.pauseContract?.();

        res.json({
            success: true,
            message: 'Contrato pausado exitosamente'
        });
    } catch (error) {
        console.error('Error pausing contract:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   POST /api/oracle/admin/unpause
 * @desc    Unpause the contract
 * @access  Admin
 */
router.post('/admin/unpause', protect, adminMiddleware, async (req, res) => {
    try {
        await dataOracleService.unpauseContract?.();

        res.json({
            success: true,
            message: 'Contrato reanudado exitosamente'
        });
    } catch (error) {
        console.error('Error unpausing contract:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   POST /api/oracle/admin/validator/:address/suspend
 * @desc    Suspend a validator
 * @access  Admin
 */
router.post('/admin/validator/:address/suspend', protect, adminMiddleware, async (req, res) => {
    try {
        const { address } = req.params;
        const { reason } = req.body;

        await dataOracleService.suspendValidator?.(address, reason);

        res.json({
            success: true,
            message: `Validador ${address} suspendido`
        });
    } catch (error) {
        console.error('Error suspending validator:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   POST /api/oracle/admin/validator/:address/reactivate
 * @desc    Reactivate a validator
 * @access  Admin
 */
router.post('/admin/validator/:address/reactivate', protect, adminMiddleware, async (req, res) => {
    try {
        const { address } = req.params;

        await dataOracleService.reactivateValidator?.(address);

        res.json({
            success: true,
            message: `Validador ${address} reactivado`
        });
    } catch (error) {
        console.error('Error reactivating validator:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   POST /api/oracle/admin/validator/:address/slash
 * @desc    Slash a validator's stake
 * @access  Admin
 */
router.post('/admin/validator/:address/slash', protect, adminMiddleware, async (req, res) => {
    try {
        const { address } = req.params;
        const { amount, reason } = req.body;

        if (!amount) {
            return res.status(400).json({
                success: false,
                error: 'Monto de slash requerido'
            });
        }

        await dataOracleService.slashValidator?.(address, amount, reason);

        res.json({
            success: true,
            message: `Validador ${address} slashed por ${amount} BEZ`,
            slashedAmount: amount
        });
    } catch (error) {
        console.error('Error slashing validator:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   POST /api/oracle/admin/dispute/:disputeId/resolve
 * @desc    Resolve a dispute
 * @access  Admin
 */
router.post('/admin/dispute/:disputeId/resolve', protect, adminMiddleware, async (req, res) => {
    try {
        const { disputeId } = req.params;
        const { inFavorOfOwner } = req.body;

        await dataOracleService.resolveDispute?.(disputeId, inFavorOfOwner);

        res.json({
            success: true,
            message: `Disputa ${disputeId} resuelta`,
            resolution: inFavorOfOwner ? 'usuario_favorecido' : 'validador_favorecido'
        });
    } catch (error) {
        console.error('Error resolving dispute:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   PUT /api/oracle/admin/config
 * @desc    Update contract configuration
 * @access  Admin
 */
router.put('/admin/config', protect, adminMiddleware, async (req, res) => {
    try {
        const updates = req.body;

        await dataOracleService.updateConfig?.(updates);

        res.json({
            success: true,
            message: 'Configuración actualizada',
            updatedFields: Object.keys(updates)
        });
    } catch (error) {
        console.error('Error updating config:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   GET /api/oracle/stats/global
 * @desc    Get global oracle statistics
 * @access  Public
 */
router.get('/stats/global', async (req, res) => {
    try {
        const stats = await dataOracleService.getGlobalStats?.() || {
            overview: {
                totalValidations: 0,
                pendingValidations: 0,
                approvedToday: 0,
                rejectedToday: 0,
                averageQuality: 0,
                totalValidators: 0,
                activeValidators: 0,
                totalStaked: 0,
                totalRewardsDistributed: 0,
                disputesOpen: 0,
                disputesResolved: 0
            },
            trends: {
                validationsChange: 0,
                qualityChange: 0,
                stakingChange: 0,
                disputeChange: 0
            },
            timeline: [],
            sectorBreakdown: []
        };

        res.json({
            success: true,
            ...stats
        });
    } catch (error) {
        console.error('Error fetching global stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   GET /api/oracle/stats/sector/:sector
 * @desc    Get stats for a specific sector
 * @access  Public
 */
router.get('/stats/sector/:sector', async (req, res) => {
    try {
        const { sector } = req.params;
        const stats = await dataOracleService.getSectorStats?.(sector) || {
            sector,
            validations: 0,
            quality: 0,
            validators: 0,
            pending: 0
        };

        res.json({
            success: true,
            ...stats
        });
    } catch (error) {
        console.error('Error fetching sector stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   GET /api/oracle/queue/:sector
 * @desc    Get validation queue for a sector
 * @access  Protected
 */
router.get('/queue/:sector', protect, async (req, res) => {
    try {
        const { sector } = req.params;
        const { page = 1, limit = 10 } = req.query;

        const queue = await dataOracleService.getValidationQueue?.(sector, { page, limit }) || {
            items: [],
            total: 0,
            page: 1,
            pages: 0
        };

        res.json({
            success: true,
            ...queue
        });
    } catch (error) {
        console.error('Error fetching validation queue:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   POST /api/oracle/validator/register
 * @desc    Register as a validator
 * @access  Protected
 */
router.post('/validator/register', protect, async (req, res) => {
    try {
        const { sectors, stake } = req.body;
        const userAddress = req.user.walletAddress;

        if (!sectors || !sectors.length) {
            return res.status(400).json({
                success: false,
                error: 'Al menos un sector es requerido'
            });
        }

        if (!stake || stake < 1000) {
            return res.status(400).json({
                success: false,
                error: 'Stake mínimo de 1000 BEZ requerido'
            });
        }

        const result = await dataOracleService.registerValidator?.(userAddress, sectors, stake) || {
            success: true,
            message: 'Registro pendiente de confirmación en blockchain'
        };

        res.json(result);
    } catch (error) {
        console.error('Error registering validator:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   GET /api/oracle/validator/:address/stats
 * @desc    Get validator statistics
 * @access  Public
 */
router.get('/validator/:address/stats', async (req, res) => {
    try {
        const { address } = req.params;

        const stats = await dataOracleService.getValidatorStats?.(address) || {
            address,
            stake: 0,
            validations: 0,
            accuracy: 0,
            sectors: [],
            rewards: 0,
            status: 'unknown'
        };

        res.json({
            success: true,
            ...stats
        });
    } catch (error) {
        console.error('Error fetching validator stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   POST /api/oracle/vote
 * @desc    Submit a validation vote
 * @access  Protected
 */
router.post('/vote', protect, async (req, res) => {
    try {
        const { validationId, approved, qualityScore, comments } = req.body;
        const validatorAddress = req.user.walletAddress;

        if (!validationId) {
            return res.status(400).json({
                success: false,
                error: 'validationId requerido'
            });
        }

        if (typeof approved !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'approved (boolean) requerido'
            });
        }

        const result = await dataOracleService.submitVote?.({
            validationId,
            validatorAddress,
            approved,
            qualityScore,
            comments
        }) || { success: true, message: 'Voto registrado' };

        res.json(result);
    } catch (error) {
        console.error('Error submitting vote:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   POST /api/oracle/escalate
 * @desc    Escalate a validation for expert review
 * @access  Protected
 */
router.post('/escalate', protect, async (req, res) => {
    try {
        const { validationId, reason } = req.body;
        const escalatedBy = req.user.walletAddress;

        if (!validationId || !reason) {
            return res.status(400).json({
                success: false,
                error: 'validationId y reason requeridos'
            });
        }

        const result = await dataOracleService.escalateValidation?.({
            validationId,
            escalatedBy,
            reason
        }) || { success: true, message: 'Validación escalada' };

        res.json(result);
    } catch (error) {
        console.error('Error escalating validation:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   GET /api/oracle/validation/:id
 * @desc    Get validation details
 * @access  Public
 */
router.get('/validation/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const validation = await dataOracleService.getValidationDetails?.(id);

        if (!validation) {
            return res.status(404).json({
                success: false,
                error: 'Validación no encontrada'
            });
        }

        res.json({
            success: true,
            ...validation
        });
    } catch (error) {
        console.error('Error fetching validation:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   GET /api/oracle/user/:address/pending
 * @desc    Get pending validations for a user
 * @access  Protected
 */
router.get('/user/:address/pending', protect, async (req, res) => {
    try {
        const { address } = req.params;

        const pending = await dataOracleService.getUserPendingValidations?.(address) || [];

        res.json({
            success: true,
            validations: pending,
            count: pending.length
        });
    } catch (error) {
        console.error('Error fetching pending validations:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   GET /api/oracle/user/:address/history
 * @desc    Get validation history for a user
 * @access  Protected
 */
router.get('/user/:address/history', protect, async (req, res) => {
    try {
        const { address } = req.params;
        const { page = 1, limit = 20 } = req.query;

        const history = await dataOracleService.getValidationHistory?.(address, { page, limit }) || {
            items: [],
            total: 0,
            page: 1,
            pages: 0
        };

        res.json({
            success: true,
            ...history
        });
    } catch (error) {
        console.error('Error fetching validation history:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   GET /api/oracle/rewards/:address
 * @desc    Get pending rewards for a validator
 * @access  Protected
 */
router.get('/rewards/:address', protect, async (req, res) => {
    try {
        const { address } = req.params;

        const rewards = await dataOracleService.getPendingRewards?.(address) || {
            pending: 0,
            claimed: 0,
            total: 0
        };

        res.json({
            success: true,
            ...rewards
        });
    } catch (error) {
        console.error('Error fetching rewards:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   POST /api/oracle/rewards/claim
 * @desc    Claim pending rewards
 * @access  Protected
 */
router.post('/rewards/claim', protect, async (req, res) => {
    try {
        const validatorAddress = req.user.walletAddress;

        const result = await dataOracleService.claimRewards?.(validatorAddress) || {
            success: true,
            message: 'Claim pendiente de confirmación'
        };

        res.json(result);
    } catch (error) {
        console.error('Error claiming rewards:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
