/**
 * VIP Controller
 * Maneja la lógica de loyalty y gamificación para el sistema VIP
 */

const ApiKey = require('../models/ApiKey.model');
const User = require('../models/user.model');
const VIPSubscription = require('../models/VIPSubscription.model');

// Definición de Tiers basado en uso mensual de API
const TIERS = [
    {
        name: 'Bronze',
        min: 0,
        max: 50000,
        cashbackRate: 0,
        benefit: 'Documentación Básica',
        color: 'orange',
        gradient: 'from-orange-600 to-orange-800'
    },
    {
        name: 'Silver',
        min: 50000,
        max: 500000,
        cashbackRate: 0.05,
        benefit: '5% Cashback + Soporte 24h',
        color: 'gray',
        gradient: 'from-gray-400 to-gray-600'
    },
    {
        name: 'Gold',
        min: 500000,
        max: 2000000,
        cashbackRate: 0.10,
        benefit: '10% Cashback + AI Scrapers',
        color: 'yellow',
        gradient: 'from-yellow-400 to-yellow-600'
    },
    {
        name: 'Platinum',
        min: 2000000,
        max: Infinity,
        cashbackRate: 0.15,
        benefit: 'Desc. Gas + Nodo Dedicado',
        color: 'slate',
        gradient: 'from-slate-700 to-slate-900'
    },
];

/**
 * Obtener estadísticas de loyalty del usuario
 */
exports.getLoyaltyStats = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id;

        // 1. Obtener todas las API Keys del usuario
        const apiKeys = await ApiKey.find({ user: userId, status: 'active' });

        if (!apiKeys || apiKeys.length === 0) {
            return res.json({
                tier: TIERS[0],
                nextTier: TIERS[1] || null,
                usage: {
                    monthly: 0,
                    total: 0,
                    progress: 0,
                    smartContracts: 0,
                    identityVerifications: 0
                },
                rewards: {
                    balance: 0,
                    cashbackRate: 0,
                    earnedThisMonth: 0
                },
                achievements: []
            });
        }

        // 2. Calcular uso total agregado
        const totalCallsMonth = apiKeys.reduce((acc, key) => acc + (key.usage.requestsThisMonth || 0), 0);
        const totalCallsAllTime = apiKeys.reduce((acc, key) => acc + (key.usage.totalRequests || 0), 0);
        const totalSmartContracts = apiKeys.reduce((acc, key) => acc + (key.usage.smartContractCalls || 0), 0);
        const totalIdentityValidations = apiKeys.reduce((acc, key) => acc + (key.usage.identityValidations || 0), 0);

        // 3. Determinar Tier actual basado en uso mensual
        const currentTier = TIERS.find(t => totalCallsMonth >= t.min && totalCallsMonth < t.max) || TIERS[TIERS.length - 1];
        const currentTierIndex = TIERS.indexOf(currentTier);
        const nextTier = TIERS[currentTierIndex + 1] || null;

        // 4. Calcular progreso al siguiente nivel
        let progressPercent = 100;
        if (nextTier) {
            const range = nextTier.min - currentTier.min;
            const progress = totalCallsMonth - currentTier.min;
            progressPercent = Math.min(Math.max((progress / range) * 100, 0), 100);
        }

        // 5. Obtener balance de rewards (BEZ-Coin)
        const user = await User.findById(userId).select('bezCoinBalance walletAddress');
        const bezBalance = user?.bezCoinBalance || 0;

        // 6. Calcular recompensas ganadas este mes (simulado: 5-15% del gasto según tier)
        const estimatedSpend = totalCallsMonth * 0.001; // $0.001 por llamada (ejemplo)
        const earnedThisMonth = Math.floor(estimatedSpend * currentTier.cashbackRate);

        // 7. Obtener achievements de todas las keys
        let allAchievements = [];
        apiKeys.forEach(key => {
            if (key.achievements && key.achievements.length > 0) {
                allAchievements = [...allAchievements, ...key.achievements];
            }
        });

        // 8. Detectar nuevos achievements potenciales
        const newAchievements = [];

        // Achievement: Speed Demon (500k calls)
        if (totalCallsMonth >= 500000 && !allAchievements.find(a => a.id === 'speed-demon')) {
            newAchievements.push({
                id: 'speed-demon',
                name: 'Speed Demon',
                unlockedAt: new Date()
            });
        }

        // Achievement: Contract Architect (1000 smart contracts)
        if (totalSmartContracts >= 1000 && !allAchievements.find(a => a.id === 'contract-architect')) {
            newAchievements.push({
                id: 'contract-architect',
                name: 'Contract Architect',
                unlockedAt: new Date()
            });
        }

        // Achievement: Identity Pioneer (100 identity validations)
        if (totalIdentityValidations >= 100 && !allAchievements.find(a => a.id === 'identity-pioneer')) {
            newAchievements.push({
                id: 'identity-pioneer',
                name: 'Identity Pioneer',
                unlockedAt: new Date()
            });
        }

        // Guardar nuevos achievements en la primera API key del usuario
        if (newAchievements.length > 0 && apiKeys[0]) {
            apiKeys[0].achievements.push(...newAchievements);
            await apiKeys[0].save();
            allAchievements = [...allAchievements, ...newAchievements];
        }

        res.json({
            tier: currentTier,
            nextTier,
            usage: {
                monthly: totalCallsMonth,
                total: totalCallsAllTime,
                progress: Math.round(progressPercent * 10) / 10,
                smartContracts: totalSmartContracts,
                identityVerifications: totalIdentityValidations
            },
            rewards: {
                balance: bezBalance,
                cashbackRate: currentTier.cashbackRate * 100, // Convert to percentage
                earnedThisMonth
            },
            achievements: allAchievements,
            tiers: TIERS // Enviar todos los tiers para el frontend
        });

    } catch (error) {
        console.error('Error fetching loyalty stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error calculando estadísticas de loyalty',
            error: error.message
        });
    }
};

/**
 * Obtener detalles de ganancias del usuario (para página Rewards)
 */
exports.getRewardsEarnings = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id;

        // 1. Obtener loyalty stats
        req.user.userId = userId; // Asegurar compatibilidad
        await exports.getLoyaltyStats(req, res);

    } catch (error) {
        console.error('Error fetching rewards earnings:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo ganancias',
            error: error.message
        });
    }
};

/**
 * Incrementar contador de smart contracts para una API Key
 */
exports.incrementSmartContractCall = async (apiKeyId) => {
    try {
        const apiKey = await ApiKey.findById(apiKeyId);
        if (apiKey) {
            apiKey.usage.smartContractCalls = (apiKey.usage.smartContractCalls || 0) + 1;
            await apiKey.save();
        }
    } catch (error) {
        console.error('Error incrementing smart contract call:', error);
    }
};

/**
 * Incrementar contador de identity validations para una API Key
 */
exports.incrementIdentityValidation = async (apiKeyId) => {
    try {
        const apiKey = await ApiKey.findById(apiKeyId);
        if (apiKey) {
            apiKey.usage.identityValidations = (apiKey.usage.identityValidations || 0) + 1;
            await apiKey.save();
        }
    } catch (error) {
        console.error('Error incrementing identity validation:', error);
    }
};

module.exports = exports;
