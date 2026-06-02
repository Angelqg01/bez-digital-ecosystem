const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const { ethers } = require('ethers');
const logger = require('../utils/logger');
const ContentValidatorABI = require('../contracts/ContentValidator.json');

// Cargar configuración del contrato
const CONTENT_VALIDATOR_ADDRESS = process.env.CONTENT_VALIDATOR_ADDRESS;

/**
 * POST /api/validation/initiate
 * Inicia el proceso de validación (pre-verificación)
 */
router.post('/initiate', [
    body('contentData').notEmpty().withMessage('Content data is required'),
    body('contentType').isIn(['post', 'reel', 'article']).withMessage('Invalid content type'),
    body('authorAddress').notEmpty().isEthereumAddress().withMessage('Invalid Ethereum address')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }

    try {
        const { contentData, contentType, authorAddress } = req.body;

        // Generar hash SHA-256 del contenido
        const contentString = JSON.stringify({
            ...contentData,
            timestamp: Date.now(),
            author: authorAddress
        });

        const contentHash = ethers.keccak256(ethers.toUtf8Bytes(contentString));

        logger.info({
            contentHash,
            authorAddress,
            contentType
        }, 'Validation initiated');

        // Obtener tarifas del contrato
        const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        const contract = new ethers.Contract(
            CONTENT_VALIDATOR_ADDRESS,
            ContentValidatorABI.abi,
            provider
        );

        const bezCoinFee = await contract.validationFeeBezCoin();
        const nativeFee = await contract.validationFeeNative();

        res.json({
            success: true,
            contentHash,
            validationId: `temp_${Date.now()}`,
            fees: {
                bezCoin: ethers.formatUnits(bezCoinFee, 18),
                matic: ethers.formatEther(nativeFee),
                fiat: 9.99 // EUR
            },
            contractAddress: CONTENT_VALIDATOR_ADDRESS
        });

    } catch (error) {
        logger.error({ error: error.message }, 'Error initiating validation');
        res.status(500).json({
            success: false,
            error: 'Failed to initiate validation',
            message: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/validation/check/:contentHash
 * Verifica si un contenido está validado
 */
router.get('/check/:contentHash', async (req, res) => {
    try {
        const { contentHash } = req.params;

        // Validar formato de hash
        if (!contentHash.startsWith('0x') || contentHash.length !== 66) {
            return res.status(400).json({
                success: false,
                error: 'Invalid content hash format'
            });
        }

        const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        const contract = new ethers.Contract(
            CONTENT_VALIDATOR_ADDRESS,
            ContentValidatorABI.abi,
            provider
        );

        // Verificar en blockchain
        const isValidated = await contract.isContentValidated(contentHash);

        if (isValidated) {
            // Obtener datos completos de validación
            const validation = await contract.getValidation(contentHash);

            res.json({
                success: true,
                isValidated: true,
                validation: {
                    contentHash: validation.contentHash,
                    author: validation.author,
                    timestamp: Number(validation.timestamp),
                    contentUri: validation.contentUri,
                    contentType: validation.contentType,
                    validationId: Number(validation.validationId),
                    paymentMethod: ['BezCoin', 'NativeCurrency', 'FiatDelegated'][validation.paymentMethod],
                    isActive: validation.isActive
                }
            });
        } else {
            res.json({
                success: true,
                isValidated: false
            });
        }

    } catch (error) {
        logger.error({ error: error.message }, 'Error checking validation');
        res.status(500).json({
            success: false,
            error: 'Failed to check validation status'
        });
    }
});

/**
 * GET /api/validation/author/:address
 * Obtiene todas las validaciones de un autor
 */
router.get('/author/:address', [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Invalid limit'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Invalid offset')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }

    try {
        const { address } = req.params;
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;

        // Validar dirección Ethereum
        if (!ethers.isAddress(address)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid Ethereum address'
            });
        }

        const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        const contract = new ethers.Contract(
            CONTENT_VALIDATOR_ADDRESS,
            ContentValidatorABI.abi,
            provider
        );

        // Obtener validaciones del autor
        const validationHashes = await contract.getAuthorValidations(address);

        // Paginar resultados
        const paginatedHashes = validationHashes.slice(offset, offset + limit);

        // Obtener datos completos de cada validación
        const validations = await Promise.all(
            paginatedHashes.map(async (hash) => {
                const validation = await contract.getValidation(hash);
                return {
                    contentHash: validation.contentHash,
                    author: validation.author,
                    timestamp: Number(validation.timestamp),
                    contentUri: validation.contentUri,
                    contentType: validation.contentType,
                    validationId: Number(validation.validationId),
                    paymentMethod: ['BezCoin', 'NativeCurrency', 'FiatDelegated'][validation.paymentMethod],
                    isActive: validation.isActive
                };
            })
        );

        res.json({
            success: true,
            total: validationHashes.length,
            limit,
            offset,
            validations
        });

    } catch (error) {
        logger.error({ error: error.message }, 'Error fetching author validations');
        res.status(500).json({
            success: false,
            error: 'Failed to fetch validations'
        });
    }
});

/**
 * GET /api/validation/stats
 * Obtiene estadísticas globales de validaciones
 */
router.get('/stats', async (req, res) => {
    try {
        const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        const contract = new ethers.Contract(
            CONTENT_VALIDATOR_ADDRESS,
            ContentValidatorABI.abi,
            provider
        );

        const totalValidations = await contract.totalValidations();
        const bezCoinFee = await contract.validationFeeBezCoin();
        const nativeFee = await contract.validationFeeNative();

        // TODO: Obtener estadísticas adicionales de la base de datos
        // - Validaciones por día/semana/mes
        // - Método de pago más usado
        // - Tipos de contenido más validados

        res.json({
            success: true,
            stats: {
                totalValidations: Number(totalValidations),
                fees: {
                    bezCoin: ethers.formatUnits(bezCoinFee, 18),
                    matic: ethers.formatEther(nativeFee),
                    fiat: 9.99
                },
                contractAddress: CONTENT_VALIDATOR_ADDRESS
            }
        });

    } catch (error) {
        logger.error({ error: error.message }, 'Error fetching validation stats');
        res.status(500).json({
            success: false,
            error: 'Failed to fetch stats'
        });
    }
});

/**
 * POST /api/validation/revoke (Admin only)
 * Revoca una validación (contenido ilegal o fraudulento)
 */
router.post('/revoke', [
    body('contentHash').notEmpty().withMessage('Content hash is required'),
    body('reason').notEmpty().withMessage('Reason is required')
], async (req, res) => {
    // TODO: Implementar autenticación de admin
    // if (!req.user || !req.user.isAdmin) {
    //     return res.status(403).json({ error: 'Unauthorized' });
    // }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }

    try {
        const { contentHash, reason } = req.body;

        const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        const wallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);
        const contract = new ethers.Contract(
            CONTENT_VALIDATOR_ADDRESS,
            ContentValidatorABI.abi,
            wallet
        );

        // Revocar validación
        const tx = await contract.revokeValidation(contentHash, reason);
        const receipt = await tx.wait();

        logger.warn({
            contentHash,
            reason,
            txHash: receipt.hash
        }, 'Validation revoked');

        res.json({
            success: true,
            transactionHash: receipt.hash,
            message: 'Validation revoked successfully'
        });

    } catch (error) {
        logger.error({ error: error.message }, 'Error revoking validation');
        res.status(500).json({
            success: false,
            error: 'Failed to revoke validation',
            message: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;
