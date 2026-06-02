const express = require('express');
const router = express.Router();
const DAOProposal = require('../models/DAOProposal');
const DAOVote = require('../models/DAOVote');
const DAODelegate = require('../models/DAODelegate');
const DAOSettings = require('../models/DAOSettings');
const TreasuryTransaction = require('../models/TreasuryTransaction');
// const User = require('../models/user.model'); // Comentado temporalmente
// const { authenticateToken, isAdmin } = require('../middleware/auth.middleware'); // Comentado temporalmente
const { mockProposals, mockSettings, mockTreasuryTransactions, mockDelegates } = require('./daoMockData');

// Flag para usar datos mock cuando MongoDB no esté disponible
const USE_MOCK_DATA = true; // Cambiar a false cuando MongoDB esté configurado

// 📊 Obtener estado general de la DAO
router.get('/state', async (req, res) => {
    try {
        if (USE_MOCK_DATA) {
            // Devolver datos mock
            const treasuryBalance = mockTreasuryTransactions.reduce((acc, tx) => {
                if (tx.type === 'deposit') {
                    acc[tx.token] = (acc[tx.token] || 0) + tx.amount;
                }
                return acc;
            }, {});

            const state = {
                treasury: {
                    totalUSD: treasuryBalance.USDC || 0,
                    totalBEZ: treasuryBalance.BEZ || 0,
                    ethBalance: treasuryBalance.ETH || 0,
                    usdcBalance: treasuryBalance.USDC || 0,
                    assets: Object.entries(treasuryBalance).map(([token, amount]) => ({
                        token,
                        amount,
                    })),
                },
                members: {
                    total: 1250,
                    active: 876,
                    delegates: mockDelegates.length,
                },
                proposals: {
                    active: mockProposals.filter(p => p.status === 'active').length,
                    approved: mockProposals.filter(p => p.status === 'approved').length,
                    rejected: mockProposals.filter(p => p.status === 'rejected').length,
                    total: mockProposals.length,
                },
                settings: mockSettings,
            };

            return res.json(state);
        }
        const [proposals, delegates, transactions, settings] = await Promise.all([
            DAOProposal.find(),
            DAODelegate.find(),
            TreasuryTransaction.find().sort({ createdAt: -1 }).limit(100),
            DAOSettings.findOne() || DAOSettings.create({
                quorumPercentage: 10,
                votingPeriodDays: 7,
                proposalThreshold: 100000,
                allowDelegation: true,
            }),
        ]);

        // Calcular tesorería
        const treasuryBalance = transactions.reduce((acc, tx) => {
            if (tx.type === 'deposit') {
                acc[tx.token] = (acc[tx.token] || 0) + tx.amount;
            } else if (tx.type === 'withdrawal') {
                acc[tx.token] = (acc[tx.token] || 0) - tx.amount;
            }
            return acc;
        }, {});

        // Calcular miembros activos (usuarios con BEZ tokens)
        const totalMembers = await User.countDocuments();
        const activeMembers = await User.countDocuments({ 'wallet.bezBalance': { $gt: 0 } });

        const state = {
            treasury: {
                totalUSD: treasuryBalance.USDC || 0,
                totalBEZ: treasuryBalance.BEZ || 0,
                ethBalance: treasuryBalance.ETH || 0,
                usdcBalance: treasuryBalance.USDC || 0,
                assets: Object.entries(treasuryBalance).map(([token, amount]) => ({
                    token,
                    amount,
                })),
            },
            members: {
                total: totalMembers,
                active: activeMembers,
                delegates: delegates.length,
            },
            proposals: {
                active: proposals.filter(p => p.status === 'active').length,
                approved: proposals.filter(p => p.status === 'approved').length,
                rejected: proposals.filter(p => p.status === 'rejected').length,
                total: proposals.length,
            },
            settings: settings || {
                quorumPercentage: 10,
                votingPeriodDays: 7,
                proposalThreshold: 100000,
                allowDelegation: true,
            },
        };

        res.json(state);
    } catch (error) {
        console.error('Error getting DAO state:', error);
        res.status(500).json({ error: 'Error al obtener estado de la DAO' });
    }
});

// 📋 Obtener propuestas
router.get('/proposals', async (req, res) => {
    try {
        if (USE_MOCK_DATA) {
            const { filter = 'all' } = req.query;

            let filteredProposals = mockProposals;
            if (filter !== 'all') {
                filteredProposals = mockProposals.filter(p => p.status === filter);
            }

            // Agregar información de votos totales
            const proposalsWithVotes = filteredProposals.map(proposal => ({
                ...proposal,
                totalVotes: proposal.votesFor + proposal.votesAgainst,
                voters: [],
            }));

            return res.json(proposalsWithVotes);
        }

        const { filter = 'all', limit = 50 } = req.query;

        let query = {};
        if (filter === 'active') query.status = 'active';
        else if (filter === 'approved') query.status = 'approved';
        else if (filter === 'rejected') query.status = 'rejected';
        else if (filter === 'executed') query.status = 'executed';

        const proposals = await DAOProposal.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .populate('creator', 'username wallet.address');

        // Calcular votos para cada propuesta
        const proposalsWithVotes = await Promise.all(
            proposals.map(async (proposal) => {
                const votes = await DAOVote.find({ proposalId: proposal._id });
                const votesFor = votes.filter(v => v.support).reduce((sum, v) => sum + v.votingPower, 0);
                const votesAgainst = votes.filter(v => !v.support).reduce((sum, v) => sum + v.votingPower, 0);

                return {
                    ...proposal.toObject(),
                    votesFor,
                    votesAgainst,
                    totalVotes: votes.length,
                    voters: votes.map(v => v.voter),
                };
            })
        );

        res.json(proposalsWithVotes);
    } catch (error) {
        console.error('Error getting proposals:', error);
        res.status(500).json({ error: 'Error al obtener propuestas' });
    }
});

// ✍️ Crear propuesta
router.post('/proposals', async (req, res) => {
    try {
        const { title, description, category, creator, actions } = req.body;

        if (!title || !description || !creator) {
            return res.status(400).json({ error: 'Faltan campos requeridos' });
        }

        // Verificar que el creador tenga suficientes tokens
        const user = await User.findOne({ 'wallet.address': creator.toLowerCase() });
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const settings = await DAOSettings.findOne();
        const threshold = settings?.proposalThreshold || 100000;

        if ((user.wallet?.bezBalance || 0) < threshold) {
            return res.status(403).json({
                error: `Necesitas al menos ${threshold} BEZ para crear propuestas`
            });
        }

        // Calcular fecha de fin
        const votingPeriodDays = settings?.votingPeriodDays || 7;
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + votingPeriodDays);

        const proposal = await DAOProposal.create({
            title,
            description,
            category: category || 'general',
            creator: user._id,
            status: 'active',
            startDate: new Date(),
            endDate,
            actions: actions || [],
        });

        await proposal.populate('creator', 'username wallet.address');

        res.status(201).json(proposal);
    } catch (error) {
        console.error('Error creating proposal:', error);
        res.status(500).json({ error: 'Error al crear propuesta' });
    }
});

// 🗳️ Votar en propuesta
router.post('/proposals/:id/vote', async (req, res) => {
    try {
        const { id } = req.params;
        const { voter, support } = req.body;

        if (!voter || support === undefined) {
            return res.status(400).json({ error: 'Faltan campos requeridos' });
        }

        const proposal = await DAOProposal.findById(id);
        if (!proposal) {
            return res.status(404).json({ error: 'Propuesta no encontrada' });
        }

        if (proposal.status !== 'active') {
            return res.status(400).json({ error: 'La propuesta no está activa' });
        }

        if (new Date() > proposal.endDate) {
            proposal.status = 'expired';
            await proposal.save();
            return res.status(400).json({ error: 'La propuesta ha expirado' });
        }

        // Verificar si ya votó
        const existingVote = await DAOVote.findOne({
            proposalId: id,
            voter: voter.toLowerCase()
        });

        if (existingVote) {
            return res.status(400).json({ error: 'Ya has votado en esta propuesta' });
        }

        // Obtener poder de voto del usuario
        const user = await User.findOne({ 'wallet.address': voter.toLowerCase() });
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        let votingPower = user.wallet?.bezBalance || 0;

        // Verificar si tiene votos delegados
        const delegations = await DAODelegate.find({ delegate: voter.toLowerCase(), active: true });
        for (const delegation of delegations) {
            const delegator = await User.findOne({ 'wallet.address': delegation.delegator });
            if (delegator) {
                votingPower += delegator.wallet?.bezBalance || 0;
            }
        }

        if (votingPower === 0) {
            return res.status(403).json({ error: 'No tienes poder de voto' });
        }

        // Registrar voto
        const vote = await DAOVote.create({
            proposalId: id,
            voter: voter.toLowerCase(),
            support,
            votingPower,
        });

        // Actualizar propuesta con el voto
        if (support) {
            proposal.votesFor = (proposal.votesFor || 0) + votingPower;
        } else {
            proposal.votesAgainst = (proposal.votesAgainst || 0) + votingPower;
        }
        await proposal.save();

        // Verificar si alcanzó quorum
        const settings = await DAOSettings.findOne();
        const quorum = settings?.quorumPercentage || 10;
        const totalVotingPower = await User.aggregate([
            { $group: { _id: null, total: { $sum: '$wallet.bezBalance' } } }
        ]);
        const total = totalVotingPower[0]?.total || 1;
        const currentVotes = proposal.votesFor + proposal.votesAgainst;

        if ((currentVotes / total) * 100 >= quorum && new Date() > proposal.endDate) {
            if (proposal.votesFor > proposal.votesAgainst) {
                proposal.status = 'approved';
            } else {
                proposal.status = 'rejected';
            }
            await proposal.save();
        }

        res.json({ success: true, vote, proposal });
    } catch (error) {
        console.error('Error voting:', error);
        res.status(500).json({ error: 'Error al votar' });
    }
});

// 🚀 Ejecutar propuesta (solo admin)
router.post('/proposals/:id/execute', async (req, res) => {
    try {
        const { id } = req.params;

        const proposal = await DAOProposal.findById(id);
        if (!proposal) {
            return res.status(404).json({ error: 'Propuesta no encontrada' });
        }

        if (proposal.status !== 'approved') {
            return res.status(400).json({ error: 'Solo se pueden ejecutar propuestas aprobadas' });
        }

        // Ejecutar acciones de la propuesta
        for (const action of proposal.actions) {
            // Aquí se ejecutarían las acciones reales
            console.log('Ejecutando acción:', action);
        }

        proposal.status = 'executed';
        proposal.executedAt = new Date();
        await proposal.save();

        res.json({ success: true, proposal });
    } catch (error) {
        console.error('Error executing proposal:', error);
        res.status(500).json({ error: 'Error al ejecutar propuesta' });
    }
});

// 👥 Obtener delegados
router.get('/delegates', async (req, res) => {
    try {
        if (USE_MOCK_DATA) {
            const mockDelegatesData = [
                {
                    address: '0xabcdef1234567890abcdef1234567890abcdef12',
                    username: 'MegaVoter',
                    avatar: null,
                    delegators: ['0x1111111111111111111111111111111111111111', '0x2222222222222222222222222222222222222222'],
                    totalVotingPower: 350000,
                    votesCount: 45,
                    participationRate: 0.95
                },
                {
                    address: '0x9876543210fedcba9876543210fedcba98765432',
                    username: 'DAOLeader',
                    avatar: null,
                    delegators: ['0x3333333333333333333333333333333333333333'],
                    totalVotingPower: 280000,
                    votesCount: 38,
                    participationRate: 0.88
                }
            ];

            return res.json(mockDelegatesData);
        }

        const delegations = await DAODelegate.find({ active: true });

        // Agrupar por delegado
        const delegateMap = {};
        for (const delegation of delegations) {
            if (!delegateMap[delegation.delegate]) {
                delegateMap[delegation.delegate] = {
                    address: delegation.delegate,
                    delegators: [],
                    totalVotingPower: 0,
                };
            }

            const delegator = await User.findOne({ 'wallet.address': delegation.delegator });
            if (delegator) {
                delegateMap[delegation.delegate].delegators.push(delegation.delegator);
                delegateMap[delegation.delegate].totalVotingPower += delegator.wallet?.bezBalance || 0;
            }
        }

        // Convertir a array y ordenar
        const delegates = Object.values(delegateMap)
            .sort((a, b) => b.totalVotingPower - a.totalVotingPower)
            .slice(0, 50);

        // Enriquecer con datos de usuario
        const enrichedDelegates = await Promise.all(
            delegates.map(async (delegate) => {
                const user = await User.findOne({ 'wallet.address': delegate.address });
                const votes = await DAOVote.find({ voter: delegate.address });

                return {
                    ...delegate,
                    username: user?.username || 'Unknown',
                    avatar: user?.avatar || null,
                    votesCount: votes.length,
                    participationRate: 0, // Calcular basado en propuestas totales
                };
            })
        );

        res.json(enrichedDelegates);
    } catch (error) {
        console.error('Error getting delegates:', error);
        res.status(500).json({ error: 'Error al obtener delegados' });
    }
});

// 🔄 Delegar votos
router.post('/delegate', async (req, res) => {
    try {
        const { delegator, delegate } = req.body;

        if (!delegator || !delegate) {
            return res.status(400).json({ error: 'Faltan campos requeridos' });
        }

        if (delegator.toLowerCase() === delegate.toLowerCase()) {
            return res.status(400).json({ error: 'No puedes delegarte a ti mismo' });
        }

        // Verificar configuración
        const settings = await DAOSettings.findOne();
        if (!settings?.allowDelegation) {
            return res.status(403).json({ error: 'La delegación está deshabilitada' });
        }

        // Desactivar delegación anterior
        await DAODelegate.updateMany(
            { delegator: delegator.toLowerCase() },
            { active: false }
        );

        // Crear nueva delegación
        const delegation = await DAODelegate.create({
            delegator: delegator.toLowerCase(),
            delegate: delegate.toLowerCase(),
            active: true,
        });

        res.json({ success: true, delegation });
    } catch (error) {
        console.error('Error delegating:', error);
        res.status(500).json({ error: 'Error al delegar votos' });
    }
});

// 👤 Obtener datos del usuario
router.get('/user/:address', async (req, res) => {
    try {
        const { address } = req.params;

        const user = await User.findOne({ 'wallet.address': address.toLowerCase() });
        if (!user) {
            return res.json({
                votingPower: 0,
                delegatedTo: null,
                delegations: [],
                rewards: 0,
                votingHistory: [],
                proposalsCreated: [],
            });
        }

        const votingPower = user.wallet?.bezBalance || 0;
        const delegation = await DAODelegate.findOne({
            delegator: address.toLowerCase(),
            active: true
        });
        const delegations = await DAODelegate.find({
            delegate: address.toLowerCase(),
            active: true
        });
        const votes = await DAOVote.find({ voter: address.toLowerCase() });
        const proposals = await DAOProposal.find({ creator: user._id });

        res.json({
            votingPower,
            delegatedTo: delegation?.delegate || null,
            delegations: delegations.map(d => d.delegator),
            rewards: user.rewards?.dao || 0,
            votingHistory: votes,
            proposalsCreated: proposals,
        });
    } catch (error) {
        console.error('Error getting user data:', error);
        res.status(500).json({ error: 'Error al obtener datos del usuario' });
    }
});

// 💰 Obtener transacciones de tesorería
router.get('/treasury/transactions', async (req, res) => {
    try {
        if (USE_MOCK_DATA) {
            return res.json(mockTreasuryTransactions);
        }

        const { limit = 100 } = req.query;

        const transactions = await TreasuryTransaction.find()
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        res.json(transactions);
    } catch (error) {
        console.error('Error getting treasury transactions:', error);
        res.status(500).json({ error: 'Error al obtener transacciones' });
    }
});

// 💵 Añadir fondos a tesorería (solo admin - para testing)
router.post('/treasury/deposit', async (req, res) => {
    try {
        const { token, amount, description } = req.body;

        if (!token || !amount) {
            return res.status(400).json({ error: 'Token y amount son requeridos' });
        }

        const transaction = await TreasuryTransaction.create({
            type: 'deposit',
            token: token.toUpperCase(),
            amount: parseFloat(amount),
            description: description || `Depósito de ${amount} ${token}`,
            status: 'completed',
        });

        res.json({ success: true, transaction });
    } catch (error) {
        console.error('Error adding treasury funds:', error);
        res.status(500).json({ error: 'Error al añadir fondos' });
    }
});

// 🎁 Reclamar recompensas
router.post('/rewards/claim', async (req, res) => {
    try {
        const { address } = req.body;

        const user = await User.findOne({ 'wallet.address': address.toLowerCase() });
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const rewards = user.rewards?.dao || 0;
        if (rewards === 0) {
            return res.status(400).json({ error: 'No tienes recompensas para reclamar' });
        }

        // Transferir recompensas
        user.wallet.bezBalance = (user.wallet?.bezBalance || 0) + rewards;
        user.rewards.dao = 0;
        await user.save();

        res.json({ success: true, amount: rewards });
    } catch (error) {
        console.error('Error claiming rewards:', error);
        res.status(500).json({ error: 'Error al reclamar recompensas' });
    }
});

// ⚙️ Actualizar configuración (solo admin)
router.put('/settings', async (req, res) => {
    try {
        const { quorumPercentage, votingPeriodDays, proposalThreshold, allowDelegation } = req.body;

        let settings = await DAOSettings.findOne();
        if (!settings) {
            settings = await DAOSettings.create({
                quorumPercentage: quorumPercentage || 10,
                votingPeriodDays: votingPeriodDays || 7,
                proposalThreshold: proposalThreshold || 100000,
                allowDelegation: allowDelegation !== undefined ? allowDelegation : true,
            });
        } else {
            if (quorumPercentage !== undefined) settings.quorumPercentage = quorumPercentage;
            if (votingPeriodDays !== undefined) settings.votingPeriodDays = votingPeriodDays;
            if (proposalThreshold !== undefined) settings.proposalThreshold = proposalThreshold;
            if (allowDelegation !== undefined) settings.allowDelegation = allowDelegation;
            await settings.save();
        }

        res.json({ success: true, settings });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Error al actualizar configuración' });
    }
});

// 📊 Obtener estadísticas
router.get('/statistics', async (req, res) => {
    try {
        const proposals = await DAOProposal.find();
        const votes = await DAOVote.find();
        const delegates = await DAODelegate.find({ active: true });
        const users = await User.countDocuments();

        const stats = {
            totalProposals: proposals.length,
            activeProposals: proposals.filter(p => p.status === 'active').length,
            totalVotes: votes.length,
            totalDelegates: delegates.length,
            participationRate: users > 0 ? (votes.length / users) * 100 : 0,
            avgVotesPerProposal: proposals.length > 0 ? votes.length / proposals.length : 0,
        };

        res.json(stats);
    } catch (error) {
        console.error('Error getting statistics:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

module.exports = router;
