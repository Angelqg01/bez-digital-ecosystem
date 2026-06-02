const express = require('express');
const router = express.Router();
const farmingService = require('../services/farming.service');
const { protect } = require('../middleware/auth.middleware');

// Rutas públicas (solo lectura)

/**
 * GET /api/farming/pools
 * Obtener todos los pools activos
 */
router.get('/pools', async (req, res) => {
    try {
        const pools = await farmingService.getAllPools();

        res.json({
            success: true,
            data: pools
        });
    } catch (error) {
        console.error('Error getting pools:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get pools',
            details: error.message
        });
    }
});

/**
 * GET /api/farming/stats
 * Obtener estadísticas globales de farming
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await farmingService.getFarmingStats();

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error getting farming stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get farming stats'
        });
    }
});

/**
 * GET /api/farming/multipliers
 * Obtener multiplicadores de lock disponibles
 */
router.get('/multipliers', async (req, res) => {
    try {
        const multipliers = await farmingService.getLockMultipliers();

        res.json({
            success: true,
            data: multipliers
        });
    } catch (error) {
        console.error('Error getting multipliers:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get multipliers'
        });
    }
});

// Rutas protegidas (requieren autenticación)

/**
 * GET /api/farming/user/:address
 * Obtener datos de farming del usuario
 * Nota: Es lectura pública ya que los datos de staking son visibles en blockchain
 */
router.get('/user/:address', async (req, res) => {
    try {
        const { address } = req.params;

        // Validar que la dirección es válida
        if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid wallet address'
            });
        }

        const userData = await farmingService.getUserFarmingData(address);

        res.json({
            success: true,
            data: userData
        });
    } catch (error) {
        console.error('Error getting user farming data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get user farming data'
        });
    }
});

/**
 * POST /api/farming/validate-stake
 * Validar si el usuario puede hacer staking
 */
router.post('/validate-stake', protect, async (req, res) => {
    try {
        const { poolId, amount, userAddress } = req.body;

        if (!poolId || !amount || !userAddress) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        const validation = await farmingService.canStake(poolId, amount, userAddress);

        res.json({
            success: true,
            data: validation
        });
    } catch (error) {
        console.error('Error validating stake:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to validate stake'
        });
    }
});

/**
 * GET /api/farming/pool/:poolId
 * Obtener información detallada de un pool específico
 */
router.get('/pool/:poolId', async (req, res) => {
    try {
        const { poolId } = req.params;

        await farmingService.initialize();
        if (!farmingService.sdk) {
            return res.status(503).json({
                success: false,
                error: 'Farming service not available'
            });
        }

        const poolInfo = await farmingService.sdk.getPoolInfo(parseInt(poolId));
        const apy = await farmingService.sdk.calculateAPY(parseInt(poolId), 1);

        res.json({
            success: true,
            data: {
                ...poolInfo,
                apy: apy.toFixed(2)
            }
        });
    } catch (error) {
        console.error('Error getting pool info:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get pool info'
        });
    }
});

module.exports = router;
