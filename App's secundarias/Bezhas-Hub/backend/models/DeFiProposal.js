const mongoose = require('mongoose');

/**
 * DeFi Proposal Model - Propuestas específicas para parámetros DeFi
 * Extiende las propuestas DAO para incluir acciones DeFi
 */
const deFiProposalSchema = new mongoose.Schema({
    // Referencia a propuesta DAO principal
    daoProposalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DAOProposal',
        required: true,
    },

    // Tipo específico de propuesta DeFi
    proposalType: {
        type: String,
        enum: [
            'ADJUST_STAKING_APY',
            'FUND_FARMING_POOL',
            'UPDATE_REWARD_RATE',
            'CREATE_LP_POOL',
            'TREASURY_ALLOCATION',
            'EMERGENCY_PAUSE',
            'UPDATE_FEE_STRUCTURE'
        ],
        required: true,
    },

    // Parámetros específicos según tipo
    parameters: {
        // Para ADJUST_STAKING_APY
        targetPool: String,
        currentAPY: Number,
        proposedAPY: Number,

        // Para FUND_FARMING_POOL
        poolAddress: String,
        fundingAmount: Number,
        fundingToken: String,
        duration: Number, // días

        // Para UPDATE_REWARD_RATE
        rewardToken: String,
        currentRate: Number,
        proposedRate: Number,

        // Para CREATE_LP_POOL
        token0: String,
        token1: String,
        initialLiquidity0: Number,
        initialLiquidity1: Number,

        // Para TREASURY_ALLOCATION
        allocationType: String,
        percentage: Number,
        destinationPool: String,

        // Justificación económica
        expectedROI: Number,
        riskAssessment: String,
        impactAnalysis: String,
    },

    // Estado de ejecución
    executionStatus: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'failed', 'reverted'],
        default: 'pending',
    },

    // Resultados de la ejecución
    executionResults: {
        txHash: String,
        blockNumber: Number,
        gasUsed: Number,
        actualAPY: Number,
        fundsTransferred: Number,
        timestamp: Date,
        error: String,
    },

    // Simulación pre-ejecución
    simulation: {
        projectedImpact: mongoose.Schema.Types.Mixed,
        riskScore: Number,
        tvlChange: Number,
        aprChange: Number,
        simulatedAt: Date,
    },

    // Métricas de seguimiento post-ejecución
    metrics: {
        tvlBefore: Number,
        tvlAfter: Number,
        apyBefore: Number,
        apyAfter: Number,
        participantsBefore: Number,
        participantsAfter: Number,
        measuredAt: Date,
    },
}, {
    timestamps: true,
});

// Índices para búsquedas eficientes
deFiProposalSchema.index({ daoProposalId: 1 });
deFiProposalSchema.index({ proposalType: 1, executionStatus: 1 });
deFiProposalSchema.index({ 'parameters.targetPool': 1 });
deFiProposalSchema.index({ createdAt: -1 });

// Método virtual para obtener propuesta completa con DAO data
deFiProposalSchema.virtual('fullProposal', {
    ref: 'DAOProposal',
    localField: 'daoProposalId',
    foreignField: '_id',
    justOne: true,
});

// Método para validar parámetros según tipo
deFiProposalSchema.methods.validateParameters = function () {
    const required = {
        'ADJUST_STAKING_APY': ['targetPool', 'currentAPY', 'proposedAPY'],
        'FUND_FARMING_POOL': ['poolAddress', 'fundingAmount', 'fundingToken', 'duration'],
        'UPDATE_REWARD_RATE': ['rewardToken', 'currentRate', 'proposedRate'],
        'CREATE_LP_POOL': ['token0', 'token1', 'initialLiquidity0', 'initialLiquidity1'],
        'TREASURY_ALLOCATION': ['allocationType', 'percentage', 'destinationPool'],
    };

    const requiredFields = required[this.proposalType] || [];
    const missingFields = requiredFields.filter(field => !this.parameters[field]);

    if (missingFields.length > 0) {
        throw new Error(`Missing required parameters: ${missingFields.join(', ')}`);
    }

    return true;
};

// Método para calcular impacto estimado
deFiProposalSchema.methods.estimateImpact = async function () {
    switch (this.proposalType) {
        case 'ADJUST_STAKING_APY':
            const apyDelta = this.parameters.proposedAPY - this.parameters.currentAPY;
            return {
                type: 'APY_CHANGE',
                delta: apyDelta,
                expectedTVLChange: apyDelta > 0 ? '+15%' : '-10%',
                timeToEffect: '7 days',
            };

        case 'FUND_FARMING_POOL':
            return {
                type: 'LIQUIDITY_INJECTION',
                amount: this.parameters.fundingAmount,
                estimatedParticipants: Math.floor(this.parameters.fundingAmount / 1000),
                duration: this.parameters.duration,
            };

        default:
            return { type: 'GENERIC', impact: 'To be determined' };
    }
};

module.exports = mongoose.model('DeFiProposal', deFiProposalSchema);
