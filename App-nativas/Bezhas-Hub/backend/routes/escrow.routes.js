const express = require('express');
const router = express.Router();
const { validateCreateService, escrowLimiter } = require('../middleware/escrowValidation');
const { apiKeyAuth, optionalApiKeyAuth } = require('../middleware/apiKeyAuth');
const { ethers } = require('ethers');
const crypto = require('crypto');

// Blockchain configuration
const PROVIDER_URL = process.env.POLYGON_RPC_URL || 'https://rpc-amoy.polygon.technology';
const CONTRACT_ADDRESS = process.env.QUALITY_ESCROW_ADDRESS;
const BEZCOIN_ADDRESS = process.env.BEZCOIN_ADDRESS;

// Load ABIs
const escrowABI = require('../contracts/BeZhasQualityEscrow.json').abi;
const bezCoinABI = require('../contracts/BezCoin.json').abi;

// Initialize provider
const provider = new ethers.JsonRpcProvider(PROVIDER_URL);

// Helper function to get contract instance
const getEscrowContract = (signerOrProvider) => {
    return new ethers.Contract(CONTRACT_ADDRESS, escrowABI, signerOrProvider);
};

const getBezCoinContract = (signerOrProvider) => {
    return new ethers.Contract(BEZCOIN_ADDRESS, bezCoinABI, signerOrProvider);
};

/**
 * @swagger
 * /escrow/create:
 *   post:
 *     summary: Crear nuevo servicio con garantía de calidad
 *     description: Crea un nuevo servicio de escrow con colateral bloqueado y nivel de calidad prometido
 *     tags: [Quality Oracle]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - clientWallet
 *               - amount
 *               - initialQuality
 *             properties:
 *               clientWallet:
 *                 type: string
 *                 description: Dirección Ethereum del cliente
 *                 example: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
 *               amount:
 *                 type: string
 *                 description: Colateral en wei (1 BEZ = 1000000000000000000 wei)
 *                 example: "1000000000000000000"
 *               initialQuality:
 *                 type: integer
 *                 description: Nivel de calidad prometido (1-100)
 *                 minimum: 1
 *                 maximum: 100
 *                 example: 95
 *     responses:
 *       201:
 *         description: Servicio creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Service created successfully"
 *                 serviceId:
 *                   type: integer
 *                   example: 123
 *                 txHash:
 *                   type: string
 *                   example: "0xabc123def456..."
 *       400:
 *         description: Error de validación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimitExceeded'
 */
router.post('/create', apiKeyAuth, escrowLimiter, validateCreateService, async (req, res) => {
    try {
        const { clientWallet, amount, initialQuality, privateKey } = req.body;

        // Validate private key is provided
        if (!privateKey) {
            return res.status(400).json({
                error: 'Private key required',
                message: 'Please provide privateKey to sign the transaction'
            });
        }

        // Create wallet from private key
        const wallet = new ethers.Wallet(privateKey, provider);
        const escrowContract = getEscrowContract(wallet);
        const bezCoinContract = getBezCoinContract(wallet);

        // Check allowance
        const allowance = await bezCoinContract.allowance(wallet.address, CONTRACT_ADDRESS);
        if (allowance < BigInt(amount)) {
            // Approve tokens
            const approveTx = await bezCoinContract.approve(CONTRACT_ADDRESS, amount);
            await approveTx.wait();
        }

        // Create service
        const tx = await escrowContract.createService(clientWallet, amount, initialQuality);
        const receipt = await tx.wait();

        // Extract serviceId from event
        const event = receipt.logs.find(log => {
            try {
                const parsed = escrowContract.interface.parseLog(log);
                return parsed.name === 'ServiceCreated';
            } catch {
                return false;
            }
        });

        const serviceId = event ? Number(escrowContract.interface.parseLog(event).args[0]) : null;

        res.status(201).json({
            message: "Service created successfully",
            serviceId,
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString(),
            apiTier: req.apiTier
        });
    } catch (error) {
        console.error('Error creating service:', error);
        res.status(500).json({
            error: 'Failed to create service',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /escrow/{serviceId}:
 *   get:
 *     summary: Obtener detalles de un servicio
 *     description: Consulta el estado y detalles de un servicio de escrow existente
 *     tags: [Quality Oracle]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del servicio
 *         example: 123
 *     responses:
 *       200:
 *         description: Detalles del servicio
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Service'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Servicio no encontrado
 */
router.get('/:serviceId', apiKeyAuth, async (req, res) => {
    try {
        const serviceId = parseInt(req.params.serviceId);
        const escrowContract = getEscrowContract(provider);

        const service = await escrowContract.services(serviceId);

        // Map status enum
        const statusMap = ['CREATED', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED', 'CANCELLED'];

        res.json({
            id: serviceId,
            businessWallet: service.businessWallet,
            clientWallet: service.clientWallet,
            collateralAmount: service.collateralAmount.toString(),
            initialQuality: Number(service.initialQuality),
            finalQuality: Number(service.finalQuality),
            status: statusMap[Number(service.status)],
            timestamp: new Date(Number(service.timestamp) * 1000).toISOString()
        });
    } catch (error) {
        console.error('Error fetching service:', error);
        res.status(500).json({
            error: 'Failed to fetch service',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /escrow/{serviceId}/finalize:
 *   post:
 *     summary: Finalizar servicio
 *     description: Completa un servicio de escrow y libera el colateral según la calidad final
 *     tags: [Quality Oracle]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del servicio
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - finalQuality
 *             properties:
 *               finalQuality:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 description: Calidad final del servicio
 *                 example: 98
 *     responses:
 *       200:
 *         description: Servicio finalizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 serviceId:
 *                   type: integer
 *                 finalQuality:
 *                   type: integer
 *                 penaltyApplied:
 *                   type: boolean
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/:serviceId/finalize', apiKeyAuth, async (req, res) => {
    try {
        const serviceId = parseInt(req.params.serviceId);
        const { finalQuality, privateKey } = req.body;

        if (!privateKey) {
            return res.status(400).json({
                error: 'Private key required',
                message: 'Please provide privateKey to sign the transaction'
            });
        }

        if (!finalQuality || finalQuality < 1 || finalQuality > 100) {
            return res.status(400).json({
                error: 'Invalid quality',
                message: 'finalQuality must be between 1 and 100'
            });
        }

        const wallet = new ethers.Wallet(privateKey, provider);
        const escrowContract = getEscrowContract(wallet);

        const tx = await escrowContract.finalizeService(serviceId, finalQuality);
        const receipt = await tx.wait();

        // Extract penalty from event
        const event = receipt.logs.find(log => {
            try {
                const parsed = escrowContract.interface.parseLog(log);
                return parsed.name === 'ServiceFinalized';
            } catch {
                return false;
            }
        });

        const penaltyPaid = event ? escrowContract.interface.parseLog(event).args[2].toString() : '0';

        res.json({
            message: "Service finalized successfully",
            serviceId,
            finalQuality,
            penaltyPaid,
            penaltyApplied: BigInt(penaltyPaid) > 0n,
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString()
        });
    } catch (error) {
        console.error('Error finalizing service:', error);
        res.status(500).json({
            error: 'Failed to finalize service',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /escrow/{serviceId}/dispute:
 *   post:
 *     summary: Iniciar disputa de un servicio
 *     description: El cliente o negocio puede disputar un servicio en progreso
 *     tags: [Quality Oracle]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - privateKey
 *             properties:
 *               privateKey:
 *                 type: string
 *                 description: Private key para firmar transacción
 *     responses:
 *       200:
 *         description: Disputa iniciada
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/:serviceId/dispute', apiKeyAuth, async (req, res) => {
    try {
        const serviceId = parseInt(req.params.serviceId);
        const { privateKey } = req.body;

        if (!privateKey) {
            return res.status(400).json({
                error: 'Private key required'
            });
        }

        const wallet = new ethers.Wallet(privateKey, provider);
        const escrowContract = getEscrowContract(wallet);

        const tx = await escrowContract.raiseDispute(serviceId);
        const receipt = await tx.wait();

        res.json({
            message: "Dispute raised successfully",
            serviceId,
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber
        });
    } catch (error) {
        console.error('Error raising dispute:', error);
        res.status(500).json({
            error: 'Failed to raise dispute',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /escrow/stats:
 *   get:
 *     summary: Obtener estadísticas del sistema
 *     description: Retorna métricas generales del Quality Oracle
 *     tags: [Quality Oracle]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas del sistema
 */
router.get('/stats', apiKeyAuth, async (req, res) => {
    try {
        const escrowContract = getEscrowContract(provider);
        const serviceCounter = await escrowContract.serviceCounter();

        res.json({
            totalServices: Number(serviceCounter),
            contractAddress: CONTRACT_ADDRESS,
            bezCoinAddress: BEZCOIN_ADDRESS
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({
            error: 'Failed to fetch stats',
            message: error.message
        });
    }
});

module.exports = router;
