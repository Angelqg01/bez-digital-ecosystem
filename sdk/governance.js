/**
 * @title GovernanceSDK
 * @dev SDK para interactuar con el contrato GovernanceSystem.sol
 * Proporciona métodos para crear propuestas, votar, delegar poder de voto y ejecutar propuestas.
 */

import { ethers } from 'ethers';

// ABI del contrato GovernanceSystem (extracto de las funciones principales)
const GOVERNANCE_ABI = [
    "function createProposal(string title, string description) external returns (uint256)",
    "function vote(uint256 proposalId, uint8 voteType) external",
    "function executeProposal(uint256 proposalId) external",
    "function cancelProposal(uint256 proposalId) external",
    "function delegate(address delegatee) external",
    "function undelegate() external",
    "function getProposal(uint256 proposalId) external view returns (uint256, address, string, string, uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint8)",
    "function getVotingPower(address account) external view returns (uint256)",
    "function proposalState(uint256 proposalId) external view returns (uint8)",
    "function proposalCount() external view returns (uint256)",
    "function hasVoted(uint256 proposalId, address voter) external view returns (bool)",
    "function getVote(uint256 proposalId, address voter) external view returns (uint8, uint256)",
    "function quorumReached(uint256 proposalId) external view returns (bool)",
    "function config() external view returns (uint256, uint256, uint256, uint256, uint256)",

    // Events
    "event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string title, uint256 startTime, uint256 endTime)",
    "event VoteCast(address indexed voter, uint256 indexed proposalId, uint8 vote, uint256 weight)",
    "event ProposalExecuted(uint256 indexed proposalId)",
    "event ProposalCancelled(uint256 indexed proposalId)",
    "event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate)"
];

// Enum para el estado de las propuestas
export const ProposalState = {
    PENDING: 0,
    ACTIVE: 1,
    SUCCEEDED: 2,
    DEFEATED: 3,
    QUEUED: 4,
    EXECUTED: 5,
    CANCELLED: 6
};

export const ProposalStateLabels = {
    0: 'Pendiente',
    1: 'Activa',
    2: 'Aprobada',
    3: 'Rechazada',
    4: 'En Cola',
    5: 'Ejecutada',
    6: 'Cancelada'
};

// Enum para tipos de voto
export const VoteType = {
    AGAINST: 0,
    FOR: 1,
    ABSTAIN: 2
};

export const VoteTypeLabels = {
    0: 'En contra',
    1: 'A favor',
    2: 'Abstención'
};

class GovernanceSDK {
    constructor(contractAddress, provider) {
        this.contractAddress = contractAddress;
        this.provider = provider;
        this.contract = new ethers.Contract(contractAddress, GOVERNANCE_ABI, provider);
        this.eventListeners = {};
    }

    /**
     * Crear una nueva propuesta
     */
    async createProposal(title, description, signer) {
        try {
            const contractWithSigner = this.contract.connect(signer);
            const tx = await contractWithSigner.createProposal(title, description);
            const receipt = await tx.wait();

            // Extraer el proposalId del evento
            const event = receipt.events?.find(e => e.event === 'ProposalCreated');
            const proposalId = event?.args?.proposalId?.toString();

            return {
                success: true,
                proposalId,
                transactionHash: receipt.transactionHash
            };
        } catch (error) {
            console.error('Error creating proposal:', error);
            throw new Error(`Failed to create proposal: ${error.message}`);
        }
    }

    /**
     * Votar en una propuesta
     * @param {number} proposalId - ID de la propuesta
     * @param {number} voteType - 0: Against, 1: For, 2: Abstain
     */
    async vote(proposalId, voteType, signer) {
        try {
            const contractWithSigner = this.contract.connect(signer);
            const tx = await contractWithSigner.vote(proposalId, voteType);
            const receipt = await tx.wait();

            return {
                success: true,
                transactionHash: receipt.transactionHash
            };
        } catch (error) {
            console.error('Error voting:', error);
            throw new Error(`Failed to vote: ${error.message}`);
        }
    }

    /**
     * Ejecutar una propuesta aprobada
     */
    async executeProposal(proposalId, signer) {
        try {
            const contractWithSigner = this.contract.connect(signer);
            const tx = await contractWithSigner.executeProposal(proposalId);
            const receipt = await tx.wait();

            return {
                success: true,
                transactionHash: receipt.transactionHash
            };
        } catch (error) {
            console.error('Error executing proposal:', error);
            throw new Error(`Failed to execute proposal: ${error.message}`);
        }
    }

    /**
     * Cancelar una propuesta (solo admin)
     */
    async cancelProposal(proposalId, signer) {
        try {
            const contractWithSigner = this.contract.connect(signer);
            const tx = await contractWithSigner.cancelProposal(proposalId);
            const receipt = await tx.wait();

            return {
                success: true,
                transactionHash: receipt.transactionHash
            };
        } catch (error) {
            console.error('Error cancelling proposal:', error);
            throw new Error(`Failed to cancel proposal: ${error.message}`);
        }
    }

    /**
     * Delegar poder de voto a otra dirección
     */
    async delegate(delegateeAddress, signer) {
        try {
            const contractWithSigner = this.contract.connect(signer);
            const tx = await contractWithSigner.delegate(delegateeAddress);
            const receipt = await tx.wait();

            return {
                success: true,
                transactionHash: receipt.transactionHash
            };
        } catch (error) {
            console.error('Error delegating:', error);
            throw new Error(`Failed to delegate: ${error.message}`);
        }
    }

    /**
     * Remover delegación de voto
     */
    async undelegate(signer) {
        try {
            const contractWithSigner = this.contract.connect(signer);
            const tx = await contractWithSigner.undelegate();
            const receipt = await tx.wait();

            return {
                success: true,
                transactionHash: receipt.transactionHash
            };
        } catch (error) {
            console.error('Error undelegating:', error);
            throw new Error(`Failed to undelegate: ${error.message}`);
        }
    }

    /**
     * Obtener información completa de una propuesta
     */
    async getProposal(proposalId) {
        try {
            const data = await this.contract.getProposal(proposalId);

            return {
                id: data[0].toString(),
                proposer: data[1],
                title: data[2],
                description: data[3],
                startTime: parseInt(data[4].toString()),
                endTime: parseInt(data[5].toString()),
                forVotes: data[6].toString(),
                againstVotes: data[7].toString(),
                abstainVotes: data[8].toString(),
                quorumRequired: data[9].toString(),
                threshold: data[10].toString(),
                state: parseInt(data[11])
            };
        } catch (error) {
            console.error('Error getting proposal:', error);
            throw new Error(`Failed to get proposal: ${error.message}`);
        }
    }

    /**
     * Obtener el poder de voto de una dirección
     */
    async getVotingPower(address) {
        try {
            const power = await this.contract.getVotingPower(address);
            return power.toString();
        } catch (error) {
            console.error('Error getting voting power:', error);
            return '0';
        }
    }

    /**
     * Obtener el estado de una propuesta
     */
    async getProposalState(proposalId) {
        try {
            const state = await this.contract.proposalState(proposalId);
            return parseInt(state);
        } catch (error) {
            console.error('Error getting proposal state:', error);
            throw new Error(`Failed to get proposal state: ${error.message}`);
        }
    }

    /**
     * Obtener el número total de propuestas
     */
    async getProposalCount() {
        try {
            const count = await this.contract.proposalCount();
            return parseInt(count.toString());
        } catch (error) {
            console.error('Error getting proposal count:', error);
            return 0;
        }
    }

    /**
     * Verificar si una dirección ha votado en una propuesta
     */
    async hasVoted(proposalId, voterAddress) {
        try {
            return await this.contract.hasVoted(proposalId, voterAddress);
        } catch (error) {
            console.error('Error checking if voted:', error);
            return false;
        }
    }

    /**
     * Obtener el voto de una dirección en una propuesta
     */
    async getVote(proposalId, voterAddress) {
        try {
            const [voteType, weight] = await this.contract.getVote(proposalId, voterAddress);
            return {
                voteType: parseInt(voteType),
                weight: weight.toString()
            };
        } catch (error) {
            console.error('Error getting vote:', error);
            return { voteType: null, weight: '0' };
        }
    }

    /**
     * Verificar si se alcanzó el quorum
     */
    async quorumReached(proposalId) {
        try {
            return await this.contract.quorumReached(proposalId);
        } catch (error) {
            console.error('Error checking quorum:', error);
            return false;
        }
    }

    /**
     * Obtener configuración de gobernanza
     */
    async getConfig() {
        try {
            const [votingDelay, votingPeriod, proposalThreshold, quorumPercentage, executionDelay] =
                await this.contract.config();

            return {
                votingDelay: parseInt(votingDelay.toString()),
                votingPeriod: parseInt(votingPeriod.toString()),
                proposalThreshold: proposalThreshold.toString(),
                quorumPercentage: parseInt(quorumPercentage.toString()),
                executionDelay: parseInt(executionDelay.toString())
            };
        } catch (error) {
            console.error('Error getting config:', error);
            return null;
        }
    }

    /**
     * Obtener todas las propuestas (paginadas)
     */
    async getAllProposals(startIndex = 0, count = 10) {
        try {
            const totalCount = await this.getProposalCount();
            const endIndex = Math.min(startIndex + count, totalCount);
            const proposals = [];

            for (let i = startIndex; i < endIndex; i++) {
                const proposal = await this.getProposal(i);
                proposals.push(proposal);
            }

            return {
                proposals,
                total: totalCount,
                hasMore: endIndex < totalCount
            };
        } catch (error) {
            console.error('Error getting all proposals:', error);
            return { proposals: [], total: 0, hasMore: false };
        }
    }

    /**
     * Calcular porcentajes de votos
     */
    calculateVotePercentages(proposal) {
        const forVotes = parseFloat(ethers.utils.formatEther(proposal.forVotes));
        const againstVotes = parseFloat(ethers.utils.formatEther(proposal.againstVotes));
        const abstainVotes = parseFloat(ethers.utils.formatEther(proposal.abstainVotes));
        const totalVotes = forVotes + againstVotes + abstainVotes;

        if (totalVotes === 0) {
            return { forPercent: 0, againstPercent: 0, abstainPercent: 0 };
        }

        return {
            forPercent: ((forVotes / totalVotes) * 100).toFixed(2),
            againstPercent: ((againstVotes / totalVotes) * 100).toFixed(2),
            abstainPercent: ((abstainVotes / totalVotes) * 100).toFixed(2)
        };
    }

    /**
     * Verificar si una propuesta puede ser ejecutada
     */
    async canExecuteProposal(proposalId) {
        try {
            const proposal = await this.getProposal(proposalId);
            const state = await this.getProposalState(proposalId);
            const quorumReached = await this.quorumReached(proposalId);
            const config = await this.getConfig();

            const now = Math.floor(Date.now() / 1000);
            const executionTime = proposal.endTime + config.executionDelay;

            return (
                state === ProposalState.SUCCEEDED &&
                quorumReached &&
                now >= executionTime
            );
        } catch (error) {
            console.error('Error checking if can execute:', error);
            return false;
        }
    }

    /**
     * Event listeners
     */
    onEvent(eventName, callback) {
        const filter = this.contract.filters[eventName]?.();
        if (!filter) {
            console.error(`Event ${eventName} not found`);
            return;
        }

        this.contract.on(filter, callback);

        if (!this.eventListeners[eventName]) {
            this.eventListeners[eventName] = [];
        }
        this.eventListeners[eventName].push(callback);
    }

    offEvent(eventName, callback) {
        const filter = this.contract.filters[eventName]?.();
        if (!filter) return;

        this.contract.off(filter, callback);

        if (this.eventListeners[eventName]) {
            this.eventListeners[eventName] = this.eventListeners[eventName].filter(cb => cb !== callback);
        }
    }

    removeAllListeners() {
        this.contract.removeAllListeners();
        this.eventListeners = {};
    }
}

export default GovernanceSDK;
