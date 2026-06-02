/**
 * ClothingRental Routes - API para Alquiler/Compra de Ropa
 * Integración con cadena AEGIS para evaluación de transacciones
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

// Servicio de ClothingRental
const clothingRentalService = require('../services/clothing-rental.service');

// Middleware de autenticación (opcional en desarrollo)
const optionalAuth = (req, res, next) => {
    // En producción, implementar verificación JWT
    req.user = req.user || { walletAddress: req.headers['x-wallet-address'] };
    next();
};

/**
 * @swagger
 * /api/clothing-rental:
 *   post:
 *     summary: Crear nueva solicitud de alquiler/compra
 *     tags: [ClothingRental]
 */
router.post('/',
    optionalAuth,
    [
        body('transactionType').isIn(['RENTAL', 'PURCHASE', 'RENT_TO_OWN']),
        body('merchantId').notEmpty(),
        body('items').isArray({ min: 1 }),
        body('items.*.name').notEmpty(),
        body('items.*.category').notEmpty()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const rental = await clothingRentalService.createRental({
                ...req.body,
                customerWallet: req.user.walletAddress || req.body.customerWallet
            });

            res.status(201).json({
                success: true,
                message: 'Solicitud de alquiler creada. Iniciando evaluación AEGIS...',
                data: rental
            });
        } catch (error) {
            console.error('Error creating rental:', error);
            res.status(500).json({ error: error.message });
        }
    }
);

/**
 * @swagger
 * /api/clothing-rental/customer/{walletAddress}:
 *   get:
 *     summary: Obtener alquileres de un cliente
 *     tags: [ClothingRental]
 */
router.get('/customer/:walletAddress', async (req, res) => {
    try {
        const rentals = await clothingRentalService.getRentalsByCustomer(
            req.params.walletAddress
        );
        res.json({
            success: true,
            count: rentals.length,
            data: rentals
        });
    } catch (error) {
        console.error('Error fetching customer rentals:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/clothing-rental/merchant/{walletAddress}:
 *   get:
 *     summary: Obtener alquileres de un comercio
 *     tags: [ClothingRental]
 */
router.get('/merchant/:walletAddress', async (req, res) => {
    try {
        const rentals = await clothingRentalService.getRentalsByMerchant(
            req.params.walletAddress
        );
        res.json({
            success: true,
            count: rentals.length,
            data: rentals
        });
    } catch (error) {
        console.error('Error fetching merchant rentals:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/clothing-rental/{rentalId}:
 *   get:
 *     summary: Obtener detalle de un alquiler
 *     tags: [ClothingRental]
 */
router.get('/:rentalId', async (req, res) => {
    try {
        const rental = await clothingRentalService.getRentalById(req.params.rentalId);
        if (!rental) {
            return res.status(404).json({ error: 'Alquiler no encontrado' });
        }
        res.json({
            success: true,
            data: rental
        });
    } catch (error) {
        console.error('Error fetching rental:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/clothing-rental/{rentalId}/aegis/initiate:
 *   post:
 *     summary: Iniciar cadena de evaluación AEGIS
 *     tags: [ClothingRental, AEGIS]
 */
router.post('/:rentalId/aegis/initiate', async (req, res) => {
    try {
        const rental = await clothingRentalService.initiateAegisEvaluation(
            req.params.rentalId
        );
        res.json({
            success: true,
            message: 'Cadena AEGIS iniciada',
            data: {
                rentalId: rental.rentalId,
                status: rental.status,
                aegisStatus: rental.aegisEvaluation
            }
        });
    } catch (error) {
        console.error('Error initiating AEGIS:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/clothing-rental/{rentalId}/aegis/status:
 *   get:
 *     summary: Obtener estado de evaluación AEGIS
 *     tags: [ClothingRental, AEGIS]
 */
router.get('/:rentalId/aegis/status', async (req, res) => {
    try {
        const status = await clothingRentalService.getAegisStatus(req.params.rentalId);
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('Error fetching AEGIS status:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/clothing-rental/{rentalId}/merchant-decision:
 *   post:
 *     summary: Registrar decisión del comercio basada en AEGIS
 *     tags: [ClothingRental]
 */
router.post('/:rentalId/merchant-decision',
    optionalAuth,
    [
        body('decision').isIn(['APPROVED', 'REJECTED', 'COUNTER_OFFER']),
        body('notes').optional().isString()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const rental = await clothingRentalService.recordMerchantDecision(
                req.params.rentalId,
                req.body
            );

            res.json({
                success: true,
                message: `Decisión registrada: ${req.body.decision}`,
                data: rental
            });
        } catch (error) {
            console.error('Error recording decision:', error);
            res.status(500).json({ error: error.message });
        }
    }
);

/**
 * @swagger
 * /api/clothing-rental/{rentalId}/payment:
 *   post:
 *     summary: Registrar pago de alquiler
 *     tags: [ClothingRental]
 */
router.post('/:rentalId/payment',
    [
        body('type').isIn(['RENTAL_FEE', 'DEPOSIT', 'EXTENSION', 'PURCHASE', 'REFUND', 'PENALTY']),
        body('amount').isNumeric(),
        body('txHash').optional().isString()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const rental = await clothingRentalService.recordPayment(
                req.params.rentalId,
                req.body
            );

            res.json({
                success: true,
                message: 'Pago registrado',
                data: rental
            });
        } catch (error) {
            console.error('Error recording payment:', error);
            res.status(500).json({ error: error.message });
        }
    }
);

/**
 * @swagger
 * /api/clothing-rental/{rentalId}/return:
 *   post:
 *     summary: Registrar devolución de ropa
 *     tags: [ClothingRental]
 */
router.post('/:rentalId/return',
    [
        body('returnCondition').isIn(['PERFECT', 'GOOD', 'DAMAGED', 'MISSING_ITEMS']),
        body('returnNotes').optional().isString(),
        body('returnPhotos').optional().isArray()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const rental = await clothingRentalService.processReturn(
                req.params.rentalId,
                req.body
            );

            res.json({
                success: true,
                message: 'Devolución procesada',
                data: rental
            });
        } catch (error) {
            console.error('Error processing return:', error);
            res.status(500).json({ error: error.message });
        }
    }
);

/**
 * @swagger
 * /api/clothing-rental/{rentalId}/review:
 *   post:
 *     summary: Agregar review de cliente o comercio
 *     tags: [ClothingRental]
 */
router.post('/:rentalId/review',
    [
        body('reviewerType').isIn(['customer', 'merchant']),
        body('rating').isInt({ min: 1, max: 5 }),
        body('comment').optional().isString()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const rental = await clothingRentalService.addReview(
                req.params.rentalId,
                req.body
            );

            res.json({
                success: true,
                message: 'Review agregado',
                data: rental
            });
        } catch (error) {
            console.error('Error adding review:', error);
            res.status(500).json({ error: error.message });
        }
    }
);

/**
 * @swagger
 * /api/clothing-rental/pending-aegis:
 *   get:
 *     summary: Obtener alquileres pendientes de revisión AEGIS
 *     tags: [ClothingRental, AEGIS]
 */
router.get('/pending-aegis', async (req, res) => {
    try {
        const rentals = await clothingRentalService.getPendingAegisReview();
        res.json({
            success: true,
            count: rentals.length,
            data: rentals
        });
    } catch (error) {
        console.error('Error fetching pending AEGIS:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/clothing-rental/stats:
 *   get:
 *     summary: Obtener estadísticas del sistema
 *     tags: [ClothingRental]
 */
router.get('/stats/overview', async (req, res) => {
    try {
        const stats = await clothingRentalService.getSystemStats();
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/clothing-rental/categories:
 *   get:
 *     summary: Obtener categorías disponibles
 *     tags: [ClothingRental]
 */
router.get('/categories', (req, res) => {
    res.json({
        success: true,
        data: {
            categories: ['FORMAL', 'CASUAL', 'LUXURY', 'WEDDING', 'COSTUME', 'SPORTSWEAR', 'WORKWEAR', 'VINTAGE', 'SUSTAINABLE'],
            transactionTypes: ['RENTAL', 'PURCHASE', 'RENT_TO_OWN'],
            statuses: ['PENDING', 'AEGIS_REVIEW', 'APPROVED', 'REJECTED', 'ACTIVE', 'RETURNED', 'COMPLETED', 'DISPUTED', 'CANCELLED']
        }
    });
});

module.exports = router;
