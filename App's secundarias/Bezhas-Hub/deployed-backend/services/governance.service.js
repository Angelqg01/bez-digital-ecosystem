/**
 * @title Governance Service
 * @dev Servicio backend para el sistema de gobernanza DAO
 * Maneja propuestas, votaciones y delegación de poder
 */

const GovernanceSDK = require('../../sdk/governance');
const { ProposalState, ProposalStateLabels, VoteType, VoteTypeLabels } = require('../../sdk/governance');
const web3Service = require('./web3.service');
const settingsHelper = require('../utils/settingsHelper');
const { ethers } = require('ethers');

class GovernanceService {
    constructor() {
        this.sdk = null;
        this.contractAddress = process.env.GOVERNANCE_CONTRACT_ADDRESS;
        this.initialized = false;
        this.daoConfig = null;
    }

    /**
     * Get DAO configuration from GlobalSettings
     * @returns {Promise<object>} DAO settings
     */
    async getDaoConfig() {
        if (!this.daoConfig) {
            this.daoConfig = await settingsHelper.getDaoConfig();
        }
        return this.daoConfig;
    }

    /**
     * Inicializar el SDK de Gobernanza
     */
    async initialize() {
        if (this.initialized && this.sdk) {
            return this.sdk;
        }

        try {
            // Check if DAO is enabled in GlobalSettings
            const isEnabled = await settingsHelper.isEnabled('dao');
            if (!isEnabled) {
                console.warn('⚠️ DAO is disabled in GlobalSettings');
                return null;
            }

            if (!this.contractAddress) {
                console.warn('⚠️ GOVERNANCE_CONTRACT_ADDRESS no configurado en .env - Servicio de gobernanza no disponible');
                return null;
            }

            const provider = web3Service.getProvider();
            this.sdk = new GovernanceSDK(this.contractAddress, provider);
            this.initialized = true;

            // Load DAO config
            this.daoConfig = await settingsHelper.getDaoConfig();

            console.log('✅ GovernanceService initialized with dynamic config');
            return this.sdk;
        } catch (error) {
            console.error('❌ Error initializing GovernanceService:', error);
            return null;
        }
    }

    /**
     * Obtener todas las propuestas con metadatos adicionales
     */
    async getAllProposals(page = 1, limit = 10) {
        try {
            await this.initialize();

            if (!this.sdk) {
                // Retornar estructura vacía si no está configurado
                return {
                    proposals: [],
                    pagination: {
                        page,
                        limit,
                        total: 0,
                        totalPages: 0,
                        hasMore: false
                    }
                };
            }

            const startIndex = (page - 1) * limit;
            const result = await this.sdk.getAllProposals(startIndex, limit);

            // Enriquecer datos de propuestas
            const enrichedProposals = await Promise.all(
                result.proposals.map(async (proposal) => {
                    const percentages = this.sdk.calculateVotePercentages(proposal);
                    const quorumReached = await this.sdk.quorumReached(proposal.id);
                    const canExecute = await this.sdk.canExecuteProposal(proposal.id);

                    return {
                        ...proposal,
                        stateLabel: ProposalStateLabels[proposal.state],
                        ...percentages,
                        quorumReached,
                        canExecute,
                        timeRemaining: this.calculateTimeRemaining(proposal),
                        isActive: proposal.state === ProposalState.ACTIVE
                    };
                })
            );

            return {
                proposals: enrichedProposals,
                pagination: {
                    page,
                    limit,
                    total: result.total,
                    totalPages: Math.ceil(result.total / limit),
                    hasMore: result.hasMore
                }
            };
        } catch (error) {
            console.error('Error getting all proposals:', error);
            throw new Error('Failed to fetch proposals');
        }
    }

    /**
     * Obtener una propuesta específica con todos los detalles
     */
    async getProposalById(proposalId) {
        try {
            await this.initialize();

            const proposal = await this.sdk.getProposal(proposalId);
            const percentages = this.sdk.calculateVotePercentages(proposal);
            const quorumReached = await this.sdk.quorumReached(proposalId);
            const canExecute = await this.sdk.canExecuteProposal(proposalId);
            const state = await this.sdk.getProposalState(proposalId);

            return {
                ...proposal,
                state,
                stateLabel: ProposalStateLabels[state],
                ...percentages,
                quorumReached,
                canExecute,
                timeRemaining: this.calculateTimeRemaining(proposal),
                isActive: state === ProposalState.ACTIVE,
                isVotingOpen: this.isVotingOpen(proposal)
            };
        } catch (error) {
            console.error('Error getting proposal by ID:', error);
            throw new Error('Failed to fetch proposal');
        }
    }

    /**
     * Obtener datos de gobernanza del usuario
     */
    async getUserGovernanceData(userAddress) {
        try {
            await this.initialize();

            if (!this.sdk) {
                return {
                    userAddress,
                    votingPower: '0',
                    votingPowerFormatted: '0',
                    proposalsVoted: 0,
                    votedProposals: [],
                    canPropose: false
                };
            }

            // Obtener poder de voto
            const votingPower = await this.sdk.getVotingPower(userAddress);

            // Obtener todas las propuestas y filtrar las que el usuario ha votado
            const allProposals = await this.sdk.getAllProposals(0, 100); // Últimas 100 propuestas
            const votedProposals = [];

            for (const proposal of allProposals.proposals) {
                const hasVoted = await this.sdk.hasVoted(proposal.id, userAddress);
                if (hasVoted) {
                    const vote = await this.sdk.getVote(proposal.id, userAddress);
                    votedProposals.push({
                        proposalId: proposal.id,
                        title: proposal.title,
                        voteType: vote.voteType,
                        voteTypeLabel: VoteTypeLabels[vote.voteType],
                        weight: vote.weight,
                        proposalState: proposal.state,
                        proposalStateLabel: ProposalStateLabels[proposal.state]
                    });
                }
            }

            return {
                userAddress,
                votingPower,
                votingPowerFormatted: ethers.utils.formatEther(votingPower),
                proposalsVoted: votedProposals.length,
                votedProposals,
                canPropose: parseFloat(ethers.utils.formatEther(votingPower)) >=
                    parseFloat(this.daoConfig?.proposalThreshold || '100000')
            };
        } catch (error) {
            console.error('Error getting user governance data:', error);
            throw new Error('Failed to fetch user governance data');
        }
    }

    /**
     * Get governance configuration from GlobalSettings
     * @returns {Promise<object>} Governance config for frontend
     */
    async getGovernanceConfig() {
        const config = await this.getDaoConfig();
        return {
            quorumPercentage: config.quorumPercentage,
            votingPeriodDays: config.votingPeriodDays,
            proposalThreshold: config.proposalThreshold,
            executionDelayHours: config.executionDelayHours,
            allowDelegation: config.allowDelegation,
            maxDelegations: config.maxDelegations,
            rewardPerVote: config.rewardPerVote,
            vetoEnabled: config.vetoEnabled,
            vetoThreshold: config.vetoThreshold,
            categories: config.proposalCategories,
        };
    }

    /**
     * Obtener estadísticas globales de gobernanza
     */
    async getGovernanceStats() {
        try {
            await this.initialize();

            if (!this.sdk) {
                return {
                    totalProposals: 0,
                    activeProposals: 0,
                    executedProposals: 0,
                    stateCounts: {
                        pending: 0,
                        active: 0,
                        succeeded: 0,
                        defeated: 0,
                        executed: 0,
                        cancelled: 0
                    },
                    config: {
                        votingDelay: 0,
                        votingDelayHours: 0,
                        votingPeriod: 0,
                        votingPeriodDays: 0,
                        proposalThreshold: '0',
                        proposalThresholdFormatted: '0',
                        quorumPercentage: 0,
                        executionDelay: 0,
                        executionDelayDays: 0
                    }
                };
            }

            const config = await this.sdk.getConfig();
            const totalProposals = await this.sdk.getProposalCount();

            // Contar propuestas por estado
            const stateCounts = {
                pending: 0,
                active: 0,
                succeeded: 0,
                defeated: 0,
                executed: 0,
                cancelled: 0
            };

            for (let i = 0; i < totalProposals; i++) {
                const state = await this.sdk.getProposalState(i);
                switch (state) {
                    case ProposalState.PENDING: stateCounts.pending++; break;
                    case ProposalState.ACTIVE: stateCounts.active++; break;
                    case ProposalState.SUCCEEDED: stateCounts.succeeded++; break;
                    case ProposalState.DEFEATED: stateCounts.defeated++; break;
                    case ProposalState.EXECUTED: stateCounts.executed++; break;
                    case ProposalState.CANCELLED: stateCounts.cancelled++; break;
                }
            }

            return {
                totalProposals,
                activeProposals: stateCounts.active,
                executedProposals: stateCounts.executed,
                stateCounts,
                config: {
                    votingDelay: config.votingDelay,
                    votingDelayHours: config.votingDelay / 3600,
                    votingPeriod: config.votingPeriod,
                    votingPeriodDays: config.votingPeriod / 86400,
                    proposalThreshold: config.proposalThreshold,
                    proposalThresholdFormatted: ethers.utils.formatEther(config.proposalThreshold),
                    quorumPercentage: config.quorumPercentage / 100,
                    executionDelay: config.executionDelay,
                    executionDelayDays: config.executionDelay / 86400
                }
            };
        } catch (error) {
            console.error('Error getting governance stats:', error);
            throw new Error('Failed to fetch governance stats');
        }
    }

    /**
     * Validar si un usuario puede crear una propuesta
     */
    async canCreateProposal(userAddress) {
        try {
            await this.initialize();

            const votingPower = await this.sdk.getVotingPower(userAddress);
            const config = await this.sdk.getConfig();

            const hasEnoughTokens = parseFloat(ethers.utils.formatEther(votingPower)) >=
                parseFloat(ethers.utils.formatEther(config.proposalThreshold));

            return {
                canPropose: hasEnoughTokens,
                votingPower,
                votingPowerFormatted: ethers.utils.formatEther(votingPower),
                requiredThreshold: config.proposalThreshold,
                requiredThresholdFormatted: ethers.utils.formatEther(config.proposalThreshold),
                reason: hasEnoughTokens ? 'Usuario tiene suficientes tokens' : 'Tokens insuficientes para crear propuesta'
            };
        } catch (error) {
            console.error('Error checking if can create proposal:', error);
            return {
                canPropose: false,
                reason: 'Error al verificar elegibilidad'
            };
        }
    }

    /**
     * Validar si un usuario puede votar en una propuesta
     */
    async canVote(proposalId, userAddress) {
        try {
            await this.initialize();

            const proposal = await this.sdk.getProposal(proposalId);
            const hasVoted = await this.sdk.hasVoted(proposalId, userAddress);
            const votingPower = await this.sdk.getVotingPower(userAddress);
            const now = Math.floor(Date.now() / 1000);

            const isVotingOpen = now >= proposal.startTime && now <= proposal.endTime;
            const hasVotingPower = parseFloat(ethers.utils.formatEther(votingPower)) > 0;

            let reason = 'Usuario puede votar';
            let canVote = true;

            if (hasVoted) {
                reason = 'Ya has votado en esta propuesta';
                canVote = false;
            } else if (!hasVotingPower) {
                reason = 'No tienes poder de voto';
                canVote = false;
            } else if (!isVotingOpen) {
                reason = now < proposal.startTime ? 'La votación aún no comienza' : 'La votación ha terminado';
                canVote = false;
            }

            return {
                canVote,
                reason,
                hasVoted,
                votingPower,
                votingPowerFormatted: ethers.utils.formatEther(votingPower),
                isVotingOpen
            };
        } catch (error) {
            console.error('Error checking if can vote:', error);
            return {
                canVote: false,
                reason: 'Error al verificar elegibilidad de voto'
            };
        }
    }

    /**
     * Calcular tiempo restante de votación
     */
    calculateTimeRemaining(proposal) {
        const now = Math.floor(Date.now() / 1000);

        if (now < proposal.startTime) {
            const diff = proposal.startTime - now;
            return {
                status: 'not_started',
                seconds: diff,
                label: this.formatTime(diff)
            };
        } else if (now <= proposal.endTime) {
            const diff = proposal.endTime - now;
            return {
                status: 'active',
                seconds: diff,
                label: this.formatTime(diff)
            };
        } else {
            return {
                status: 'ended',
                seconds: 0,
                label: 'Finalizada'
            };
        }
    }

    /**
     * Formatear tiempo en formato legible
     */
    formatTime(seconds) {
        if (seconds <= 0) return 'Finalizada';

        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    }

    /**
     * Verificar si la votación está abierta
     */
    isVotingOpen(proposal) {
        const now = Math.floor(Date.now() / 1000);
        return now >= proposal.startTime && now <= proposal.endTime;
    }
}

module.exports = new GovernanceService();
