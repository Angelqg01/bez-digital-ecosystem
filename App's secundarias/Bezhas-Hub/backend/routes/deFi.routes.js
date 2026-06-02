const express = require('express');
const router = express.Router();
const DeFiProposal = require('../models/DeFiProposal');
const DAOProposal = require('../models/DAOProposal');
const TreasuryTransaction = require('../models/TreasuryTransaction');
const deFiIntegrationService = require('../services/defi-integration.service');
const rateLimit = require('express-rate-limit');

// Rate limiter para endpoints DeFi
const deFiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // Máximo 100 requests por ventana
    message: { success: false, error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Aplicar rate limiter a todas las rutas
router.use(deFiLimiter);

// Flag para usar datos mock
const USE_MOCK_DATA = true;

/**
 * 📊 GET /api/defi/pools-status
 * Obtener estado de todos los pools DeFi
 */
router.get('/pools-status', async (req, res) => {
    try {
        const status = deFiIntegrationService.getPoolsStatus();

        res.json({
            success: true,
            data: status,
            timestamp: new Date(),
        });
    } catch (error) {
        console.error('Error fetching pools status:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * 📈 GET /api/defi/treasury-balance
 * Obtener balance del treasury para propuestas DeFi
 */
router.get('/treasury-balance', async (req, res) => {
    try {
        const balance = deFiIntegrationService.getTreasuryBalance();

        res.json({
            success: true,
            balance,
            timestamp: new Date(),
        });
    } catch (error) {
        console.error('Error fetching treasury balance:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * 🎯 POST /api/defi/proposals/create
 * Crear nueva propuesta DeFi
 */
router.post('/proposals/create', async (req, res) => {
    try {
        const {
            title,
            description,
            proposalType,
            parameters,
            creator,
        } = req.body;

        // Validar datos requeridos
        if (!title || !description || !proposalType || !creator) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: title, description, proposalType, creator',
            });
        }

        // Validar tipos de propuesta permitidos
        const allowedTypes = [
            'ADJUST_STAKING_APY',
            'FUND_FARMING_POOL',
            'UPDATE_REWARD_RATE',
            'CREATE_LP_POOL',
            'TREASURY_ALLOCATION'
        ];

        if (!allowedTypes.includes(proposalType)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid proposal type',
            });
        }

        // Sanitizar strings para prevenir XSS
        const sanitizedTitle = String(title).substring(0, 200).trim();
        const sanitizedDescription = String(description).substring(0, 2000).trim();
        const sanitizedCreator = String(creator).substring(0, 42).trim();

        // Validar formato de dirección Ethereum si es necesario
        if (creator.startsWith('0x') && !/^0x[a-fA-F0-9]{40}$/.test(creator)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid Ethereum address format',
            });
        }

        if (USE_MOCK_DATA) {
            // Modo mock para desarrollo
            const mockProposal = {
                _id: `defi-${Date.now()}`,
                daoProposalId: `dao-${Date.now()}`,
                proposalType,
                parameters,
                executionStatus: 'pending',
                title: sanitizedTitle,
                description: sanitizedDescription,
                creator: sanitizedCreator,
                createdAt: new Date(),
                votingEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                votesFor: 0,
                votesAgainst: 0,
                status: 'active',
            };

            return res.status(201).json({
                success: true,
                proposal: mockProposal,
                message: 'DeFi proposal created successfully (mock mode)',
            });
        }

        // Crear propuesta DAO principal
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 7); // 7 días de votación

        const daoProposal = await DAOProposal.create({
            title,
            description,
            category: 'protocol',
            creator,
            status: 'active',
            endDate,
            votesFor: 0,
            votesAgainst: 0,
        });

        // Crear propuesta DeFi vinculada
        const deFiProposal = await DeFiProposal.create({
            daoProposalId: daoProposal._id,
            proposalType,
            parameters,
            executionStatus: 'pending',
        });

        // Validar parámetros
        await deFiProposal.validateParameters();

        // Estimar impacto
        const impact = await deFiProposal.estimateImpact();
        deFiProposal.simulation = {
            projectedImpact: impact,
            simulatedAt: new Date(),
        };
        await deFiProposal.save();

        res.status(201).json({
            success: true,
            proposal: {
                ...deFiProposal.toObject(),
                daoProposal: daoProposal.toObject(),
            },
            impact,
            message: 'DeFi proposal created successfully',
        });
    } catch (error) {
        console.error('Error creating DeFi proposal:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * 📋 GET /api/defi/proposals
 * Listar todas las propuestas DeFi
 */
router.get('/proposals', async (req, res) => {
    try {
        const { status, proposalType, limit = 20, page = 1 } = req.query;

        if (USE_MOCK_DATA) {
            // Datos mock para desarrollo
            const mockProposals = [
                {
                    _id: 'defi-1',
                    daoProposalId: 'dao-1',
                    proposalType: 'ADJUST_STAKING_APY',
                    title: 'Increase BEZ Staking APY to 25%',
                    description: 'Proposal to increase staking rewards to attract more liquidity',
                    parameters: {
                        targetPool: 'BEZ-MAIN',
                        currentAPY: 15,
                        proposedAPY: 25,
                        expectedROI: 18,
                    },
                    executionStatus: 'pending',
                    votesFor: 450000,
                    votesAgainst: 120000,
                    status: 'active',
                    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
                    votingEndsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                },
                {
                    _id: 'defi-2',
                    daoProposalId: 'dao-2',
                    proposalType: 'FUND_FARMING_POOL',
                    title: 'Fund BEZ-USDC LP Pool with 100k BEZ',
                    description: 'Allocate 100,000 BEZ tokens from treasury to farming rewards',
                    parameters: {
                        poolAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
                        fundingAmount: 100000,
                        fundingToken: 'BEZ',
                        duration: 90,
                    },
                    executionStatus: 'completed',
                    votesFor: 680000,
                    votesAgainst: 45000,
                    status: 'approved',
                    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
                    executedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
                },
                {
                    _id: 'defi-3',
                    daoProposalId: 'dao-3',
                    proposalType: 'CREATE_LP_POOL',
                    title: 'Create BEZ-ETH LP Pool',
                    description: 'Create new liquidity pool for BEZ/ETH trading pair',
                    parameters: {
                        token0: 'BEZ',
                        token1: 'ETH',
                        initialLiquidity0: 500000,
                        initialLiquidity1: 25,
                    },
                    executionStatus: 'pending',
                    votesFor: 320000,
                    votesAgainst: 180000,
                    status: 'active',
                    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
                    votingEndsAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
                },
            ];

            // Aplicar filtros
            let filtered = mockProposals;
            if (status) {
                filtered = filtered.filter(p => p.status === status);
            }
            if (proposalType) {
                filtered = filtered.filter(p => p.proposalType === proposalType);
            }

            return res.json({
                success: true,
                proposals: filtered,
                total: filtered.length,
                page: parseInt(page),
                limit: parseInt(limit),
            });
        }

        // Modo con base de datos
        const query = {};
        if (status) query.executionStatus = status;
        if (proposalType) query.proposalType = proposalType;

        const skip = (page - 1) * limit;
        const proposals = await DeFiProposal.find(query)
            .populate('daoProposalId')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(skip);

        const total = await DeFiProposal.countDocuments(query);

        res.json({
            success: true,
            proposals,
            total,
            page: parseInt(page),
            limit: parseInt(limit),
        });
    } catch (error) {
        console.error('Error fetching DeFi proposals:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * 🔍 GET /api/defi/proposals/:id
 * Obtener detalles de una propuesta DeFi específica
 */
router.get('/proposals/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (USE_MOCK_DATA) {
            // Mock data
            const mockProposal = {
                _id: id,
                daoProposalId: 'dao-1',
                proposalType: 'ADJUST_STAKING_APY',
                title: 'Increase BEZ Staking APY to 25%',
                description: 'Detailed proposal to increase staking rewards...',
                parameters: {
                    targetPool: 'BEZ-MAIN',
                    currentAPY: 15,
                    proposedAPY: 25,
                    expectedROI: 18,
                    impactAnalysis: 'Expected 40% increase in TVL within 30 days',
                },
                executionStatus: 'pending',
                simulation: {
                    projectedImpact: {
                        type: 'APY_CHANGE',
                        delta: 10,
                        expectedTVLChange: '+15%',
                        timeToEffect: '7 days',
                    },
                    riskScore: 3.5,
                    tvlChange: 15,
                },
                createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            };

            return res.json({
                success: true,
                proposal: mockProposal,
            });
        }

        const proposal = await DeFiProposal.findById(id).populate('daoProposalId');

        if (!proposal) {
            return res.status(404).json({
                success: false,
                error: 'Proposal not found',
            });
        }

        res.json({
            success: true,
            proposal,
        });
    } catch (error) {
        console.error('Error fetching proposal:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * ✅ POST /api/defi/proposals/:id/execute
 * Ejecutar propuesta DeFi aprobada
 */
router.post('/proposals/:id/execute', async (req, res) => {
    try {
        const { id } = req.params;

        if (USE_MOCK_DATA) {
            // Simular ejecución
            const executionResult = await deFiIntegrationService.executeProposal({
                proposalType: 'ADJUST_STAKING_APY',
                parameters: {
                    targetPool: 'BEZ-MAIN',
                    currentAPY: 15,
                    proposedAPY: 25,
                },
            });

            return res.json({
                success: true,
                execution: executionResult,
                message: 'Proposal executed successfully (mock mode)',
            });
        }

        // Obtener propuesta
        const deFiProposal = await DeFiProposal.findById(id).populate('daoProposalId');

        if (!deFiProposal) {
            return res.status(404).json({
                success: false,
                error: 'Proposal not found',
            });
        }

        // Validar que la propuesta DAO está aprobada
        if (deFiProposal.daoProposalId.status !== 'approved') {
            return res.status(400).json({
                success: false,
                error: 'DAO proposal must be approved before execution',
            });
        }

        // Marcar como en progreso
        deFiProposal.executionStatus = 'in_progress';
        await deFiProposal.save();

        // Ejecutar propuesta
        const executionResult = await deFiIntegrationService.executeProposal(deFiProposal);

        // Actualizar con resultados
        deFiProposal.executionStatus = 'completed';
        deFiProposal.executionResults = executionResult;
        await deFiProposal.save();

        // Actualizar propuesta DAO
        deFiProposal.daoProposalId.status = 'executed';
        deFiProposal.daoProposalId.executedAt = new Date();
        await deFiProposal.daoProposalId.save();

        // Registrar transacción en treasury si aplica
        if (executionResult.fundsTransferred || executionResult.fundsAllocated) {
            await TreasuryTransaction.create({
                type: 'withdrawal',
                token: deFiProposal.parameters.fundingToken || 'BEZ',
                amount: executionResult.fundsTransferred || executionResult.fundsAllocated,
                proposalId: deFiProposal.daoProposalId._id,
                txHash: executionResult.txHash,
                description: `DeFi proposal execution: ${deFiProposal.proposalType}`,
                status: 'completed',
            });
        }

        res.json({
            success: true,
            proposal: deFiProposal,
            execution: executionResult,
            message: 'Proposal executed successfully',
        });
    } catch (error) {
        console.error('Error executing proposal:', error);

        // Marcar como fallida
        if (!USE_MOCK_DATA) {
            await DeFiProposal.findByIdAndUpdate(req.params.id, {
                executionStatus: 'failed',
                'executionResults.error': error.message,
            });
        }

        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * 📊 GET /api/defi/analytics
 * Obtener analytics de propuestas DeFi
 */
router.get('/analytics', async (req, res) => {
    try {
        const analytics = {
            totalProposals: 3,
            activeProposals: 2,
            executedProposals: 1,
            failedProposals: 0,

            byType: {
                ADJUST_STAKING_APY: 1,
                FUND_FARMING_POOL: 1,
                CREATE_LP_POOL: 1,
            },

            treasuryImpact: {
                totalAllocated: 100000,
                totalReturned: 15000,
                netFlow: -85000,
            },

            poolsImpact: {
                stakingPools: 1,
                farmingPools: 1,
                totalTVLIncrease: '+450000',
            },
        };

        res.json({
            success: true,
            analytics,
            timestamp: new Date(),
        });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

module.exports = router;
