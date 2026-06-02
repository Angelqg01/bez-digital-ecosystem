/**
 * @title Governance Routes
 * @dev API endpoints para el sistema de gobernanza DAO
 */

const express = require('express');
const router = express.Router();
const governanceService = require('../services/governance.service');
const { protect } = require('../middleware/auth.middleware');

/**
 * @route   GET /api/governance/proposals
 * @desc    Obtener todas las propuestas con paginación
 * @access  Public
 */
router.get('/proposals', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const result = await governanceService.getAllProposals(page, limit);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error fetching proposals:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener propuestas',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/governance/proposal/:proposalId
 * @desc    Obtener una propuesta específica por ID
 * @access  Public
 */
router.get('/proposal/:proposalId', async (req, res) => {
    try {
        const { proposalId } = req.params;

        if (!proposalId && proposalId !== '0') {
            return res.status(400).json({
                success: false,
                message: 'ID de propuesta requerido'
            });
        }

        const proposal = await governanceService.getProposalById(proposalId);

        res.json({
            success: true,
            data: proposal
        });
    } catch (error) {
        console.error('Error fetching proposal:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener propuesta',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/governance/stats
 * @desc    Obtener estadísticas globales de gobernanza
 * @access  Public
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await governanceService.getGovernanceStats();

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching governance stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener estadísticas',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/governance/user/:address
 * @desc    Obtener datos de gobernanza de un usuario
 * @access  Protected
 */
router.get('/user/:address', protect, async (req, res) => {
    try {
        const { address } = req.params;

        if (!address) {
            return res.status(400).json({
                success: false,
                message: 'Dirección de usuario requerida'
            });
        }

        // Verificar que el usuario solo puede ver sus propios datos (o admin)
        if (req.user.walletAddress.toLowerCase() !== address.toLowerCase() && !req.user.isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'No autorizado para ver estos datos'
            });
        }

        const userData = await governanceService.getUserGovernanceData(address);

        res.json({
            success: true,
            data: userData
        });
    } catch (error) {
        console.error('Error fetching user governance data:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener datos del usuario',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/governance/validate-proposal
 * @desc    Validar si un usuario puede crear una propuesta
 * @access  Protected
 */
router.post('/validate-proposal', protect, async (req, res) => {
    try {
        const { userAddress } = req.body;

        if (!userAddress) {
            return res.status(400).json({
                success: false,
                message: 'Dirección de usuario requerida'
            });
        }

        const validation = await governanceService.canCreateProposal(userAddress);

        res.json({
            success: true,
            data: validation
        });
    } catch (error) {
        console.error('Error validating proposal creation:', error);
        res.status(500).json({
            success: false,
            message: 'Error al validar creación de propuesta',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/governance/validate-vote
 * @desc    Validar si un usuario puede votar en una propuesta
 * @access  Protected
 */
router.post('/validate-vote', protect, async (req, res) => {
    try {
        const { proposalId, userAddress } = req.body;

        if (!proposalId && proposalId !== 0) {
            return res.status(400).json({
                success: false,
                message: 'ID de propuesta requerido'
            });
        }

        if (!userAddress) {
            return res.status(400).json({
                success: false,
                message: 'Dirección de usuario requerida'
            });
        }

        const validation = await governanceService.canVote(proposalId, userAddress);

        res.json({
            success: true,
            data: validation
        });
    } catch (error) {
        console.error('Error validating vote:', error);
        res.status(500).json({
            success: false,
            message: 'Error al validar voto',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/governance/active
 * @desc    Obtener solo las propuestas activas
 * @access  Public
 */
router.get('/active', async (req, res) => {
    try {
        const allProposals = await governanceService.getAllProposals(1, 100);
        const activeProposals = allProposals.proposals.filter(p => p.isActive);

        res.json({
            success: true,
            data: {
                proposals: activeProposals,
                count: activeProposals.length
            }
        });
    } catch (error) {
        console.error('Error fetching active proposals:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener propuestas activas',
            error: error.message
        });
    }
});

module.exports = router;
