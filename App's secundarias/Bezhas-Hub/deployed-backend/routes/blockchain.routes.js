const express = require('express');
const router = express.Router();
const contractService = require('../services/blockchain/contractService');
const { ethers } = require('ethers');

// ========================================================================
// RUTAS DE CONSULTA (GET)
// ========================================================================

/**
 * @route   GET /api/blockchain/balance/:address
 * @desc    Obtener balance de BEZ tokens de una dirección
 * @access  Public
 */
router.get('/balance/:address', async (req, res) => {
    try {
        const { address } = req.params;

        if (!ethers.utils.isAddress(address)) {
            return res.status(400).json({ error: 'Dirección inválida' });
        }

        const balance = await contractService.getUserBezBalance(address);

        res.json({
            success: true,
            data: {
                address,
                balance,
                balanceWei: ethers.utils.parseEther(balance).toString()
            }
        });
    } catch (error) {
        console.error('Error obteniendo balance:', error);
        res.status(500).json({
            success: false,
            error: 'Error obteniendo balance',
            details: error.message
        });
    }
});

/**
 * @route   GET /api/blockchain/admin/check/:address
 * @desc    Verificar si una dirección es admin
 * @access  Public
 */
router.get('/admin/check/:address', async (req, res) => {
    try {
        const { address } = req.params;

        if (!ethers.utils.isAddress(address)) {
            return res.status(400).json({ error: 'Dirección inválida' });
        }

        const isAdmin = await contractService.isUserAdmin(address);

        res.json({
            success: true,
            data: {
                address,
                isAdmin
            }
        });
    } catch (error) {
        console.error('Error verificando admin:', error);
        res.status(500).json({
            success: false,
            error: 'Error verificando admin',
            details: error.message
        });
    }
});

/**
 * @route   GET /api/blockchain/vendor/check/:address
 * @desc    Verificar si una dirección es vendor
 * @access  Public
 */
router.get('/vendor/check/:address', async (req, res) => {
    try {
        const { address } = req.params;

        if (!ethers.utils.isAddress(address)) {
            return res.status(400).json({ error: 'Dirección inválida' });
        }

        const isVendor = await contractService.isVendor(address);

        res.json({
            success: true,
            data: {
                address,
                isVendor
            }
        });
    } catch (error) {
        console.error('Error verificando vendor:', error);
        res.status(500).json({
            success: false,
            error: 'Error verificando vendor',
            details: error.message
        });
    }
});

/**
 * @route   GET /api/blockchain/marketplace/products/count
 * @desc    Obtener contador de productos en marketplace
 * @access  Public
 */
router.get('/marketplace/products/count', async (req, res) => {
    try {
        const count = await contractService.getProductCounter();

        res.json({
            success: true,
            data: {
                totalProducts: count
            }
        });
    } catch (error) {
        console.error('Error obteniendo contador de productos:', error);
        res.status(500).json({
            success: false,
            error: 'Error obteniendo contador de productos',
            details: error.message
        });
    }
});

/**
 * @route   GET /api/blockchain/marketplace/product/:id/price
 * @desc    Obtener precio de un producto
 * @access  Public
 */
router.get('/marketplace/product/:id/price', async (req, res) => {
    try {
        const { id } = req.params;

        const price = await contractService.getProductPrice(id);

        res.json({
            success: true,
            data: {
                productId: id,
                price,
                priceWei: ethers.utils.parseEther(price).toString()
            }
        });
    } catch (error) {
        console.error('Error obteniendo precio de producto:', error);
        res.status(500).json({
            success: false,
            error: 'Error obteniendo precio de producto',
            details: error.message
        });
    }
});

/**
 * @route   GET /api/blockchain/gas-price
 * @desc    Obtener precio actual del gas en Polygon
 * @access  Public
 */
router.get('/gas-price', async (req, res) => {
    try {
        const gasPrice = await contractService.getCurrentGasPrice();

        res.json({
            success: true,
            data: {
                gasPriceGwei: gasPrice,
                gasPriceWei: ethers.utils.parseUnits(gasPrice, 'gwei').toString()
            }
        });
    } catch (error) {
        console.error('Error obteniendo gas price:', error);
        res.status(500).json({
            success: false,
            error: 'Error obteniendo gas price',
            details: error.message
        });
    }
});

/**
 * @route   GET /api/blockchain/relayer/balance
 * @desc    Obtener balance del relayer (dirección que firma transacciones del backend)
 * @access  Private (Admin only)
 */
router.get('/relayer/balance', async (req, res) => {
    try {
        // TODO: Agregar middleware de autenticación para admins
        const balance = await contractService.getRelayerBalance();

        res.json({
            success: true,
            data: {
                balanceMatic: balance,
                balanceWei: ethers.utils.parseEther(balance).toString()
            }
        });
    } catch (error) {
        console.error('Error obteniendo balance del relayer:', error);
        res.status(500).json({
            success: false,
            error: 'Error obteniendo balance del relayer',
            details: error.message
        });
    }
});

// ========================================================================
// RUTAS DE ACCIÓN (POST)
// ========================================================================

/**
 * @route   POST /api/blockchain/rewards/distribute
 * @desc    Distribuir rewards BEZ a un usuario
 * @access  Private (Admin only)
 * @body    { userAddress: string, amount: string, reason: string }
 */
router.post('/rewards/distribute', async (req, res) => {
    try {
        // TODO: Agregar middleware de autenticación para admins
        const { userAddress, amount, reason } = req.body;

        // Validaciones
        if (!userAddress || !amount) {
            return res.status(400).json({
                error: 'userAddress y amount son requeridos'
            });
        }

        if (!ethers.utils.isAddress(userAddress)) {
            return res.status(400).json({ error: 'Dirección inválida' });
        }

        // Validar que amount sea un número válido
        try {
            ethers.utils.parseEther(amount);
        } catch (error) {
            return res.status(400).json({ error: 'Amount inválido' });
        }

        // Distribuir rewards
        const tx = await contractService.distributeRewards(userAddress, amount, reason);

        res.json({
            success: true,
            data: {
                userAddress,
                amount,
                reason: reason || 'No especificado',
                transaction: {
                    hash: tx.hash,
                    blockNumber: tx.blockNumber,
                    from: tx.from,
                    to: tx.to,
                    gasUsed: tx.gasUsed?.toString()
                }
            },
            message: 'Rewards distribuidos exitosamente'
        });
    } catch (error) {
        console.error('Error distribuyendo rewards:', error);
        res.status(500).json({
            success: false,
            error: 'Error distribuyendo rewards',
            details: error.message
        });
    }
});

/**
 * @route   POST /api/blockchain/test/connection
 * @desc    Probar conexión con los contratos
 * @access  Public
 */
router.post('/test/connection', async (req, res) => {
    try {
        const gasPrice = await contractService.getCurrentGasPrice();
        const relayerBalance = await contractService.getRelayerBalance();

        res.json({
            success: true,
            data: {
                status: 'connected',
                network: 'Polygon Mainnet',
                chainId: 137,
                gasPrice: `${gasPrice} Gwei`,
                relayerBalance: `${relayerBalance} MATIC`,
                contracts: {
                    bezcoin: contractService.contracts.bezcoin?.address,
                    marketplace: contractService.contracts.marketplace?.address,
                    core: contractService.contracts.core?.address
                }
            },
            message: 'Conexión exitosa con blockchain'
        });
    } catch (error) {
        console.error('Error probando conexión:', error);
        res.status(500).json({
            success: false,
            error: 'Error en conexión con blockchain',
            details: error.message
        });
    }
});

// ========================================================================
// RUTAS DE INFORMACIÓN DE CONTRATOS
// ========================================================================

/**
 * @route   GET /api/blockchain/contracts
 * @desc    Obtener direcciones de todos los contratos desplegados
 * @access  Public
 */
router.get('/contracts', async (req, res) => {
    try {
        const contracts = {
            BEZCOIN: process.env.BEZCOIN_ADDRESS,
            QUALITY_ESCROW: process.env.QUALITY_ESCROW_ADDRESS,
            RWA_FACTORY: process.env.RWA_FACTORY_ADDRESS,
            VAULT: process.env.VAULT_ADDRESS,
            GOVERNANCE_SYSTEM: process.env.GOVERNANCE_SYSTEM_ADDRESS,
            CORE: process.env.CORE_ADDRESS,
            LIQUIDITY_FARMING: process.env.LIQUIDITY_FARMING_ADDRESS,
            NFT_OFFERS: process.env.NFT_OFFERS_ADDRESS,
            NFT_RENTAL: process.env.NFT_RENTAL_ADDRESS,
            MARKETPLACE: process.env.MARKETPLACE_ADDRESS,
            ADMIN_REGISTRY: process.env.ADMIN_REGISTRY_ADDRESS
        };

        res.json({
            success: true,
            data: {
                network: 'Polygon Mainnet',
                chainId: 137,
                contracts
            }
        });
    } catch (error) {
        console.error('Error obteniendo contratos:', error);
        res.status(500).json({
            success: false,
            error: 'Error obteniendo contratos',
            details: error.message
        });
    }
});

module.exports = router;
