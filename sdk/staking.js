/**
 * ============================================================================
 * BEZHAS SDK - STAKING MODULE
 * ============================================================================
 * 
 * Módulo para gestionar staking de BEZ tokens
 * Permite stake, unstake, y claim de rewards
 */

const axios = require('axios');
const { ethers } = require('ethers');

class StakingManager {
    /**
     * @param {Object} config - Configuración del SDK
     * @param {string} config.apiUrl - URL del backend API
     * @param {string} config.rpcUrl - URL del RPC de Polygon
     * @param {string} config.stakingContractAddress - Dirección del contrato de staking
     */
    constructor(config) {
        this.apiUrl = config.apiUrl || 'http://localhost:3001';
        this.rpcUrl = config.rpcUrl || 'https://polygon-bor.publicnode.com';
        this.stakingContractAddress = config.stakingContractAddress || process.env.LIQUIDITY_FARMING_ADDRESS;

        this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
        this.axios = axios.create({
            baseURL: this.apiUrl,
            headers: { 'Content-Type': 'application/json' }
        });

        // ABI mínimo para staking
        this.stakingABI = [
            'function stake(uint256 amount) external',
            'function unstake(uint256 amount) external',
            'function claimRewards() external',
            'function getStakeInfo(address user) view returns (uint256 amount, uint256 rewards, uint256 lastClaim)',
            'function calculateRewards(address user) view returns (uint256)',
            'function totalStaked() view returns (uint256)'
        ];
    }

    /**
     * Realiza stake de BEZ tokens
     * @param {string} amount - Cantidad de BEZ a stakear
     * @param {Object} signer - Signer de ethers.js
     * @returns {Promise<Object>} Resultado de la transacción
     */
    async stake(amount, signer) {
        try {
            const contract = new ethers.Contract(
                this.stakingContractAddress,
                this.stakingABI,
                signer
            );

            const amountWei = ethers.parseEther(amount.toString());
            const tx = await contract.stake(amountWei);
            const receipt = await tx.wait();

            return {
                success: true,
                transactionHash: receipt.hash,
                amount,
                blockNumber: receipt.blockNumber
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Retira tokens stakeados
     * @param {string} amount - Cantidad de BEZ a retirar
     * @param {Object} signer - Signer de ethers.js
     * @returns {Promise<Object>} Resultado de la transacción
     */
    async unstake(amount, signer) {
        try {
            const contract = new ethers.Contract(
                this.stakingContractAddress,
                this.stakingABI,
                signer
            );

            const amountWei = ethers.parseEther(amount.toString());
            const tx = await contract.unstake(amountWei);
            const receipt = await tx.wait();

            return {
                success: true,
                transactionHash: receipt.hash,
                amount,
                blockNumber: receipt.blockNumber
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Reclama rewards acumulados
     * @param {Object} signer - Signer de ethers.js
     * @returns {Promise<Object>} Resultado de la transacción
     */
    async claimRewards(signer) {
        try {
            const contract = new ethers.Contract(
                this.stakingContractAddress,
                this.stakingABI,
                signer
            );

            const tx = await contract.claimRewards();
            const receipt = await tx.wait();

            return {
                success: true,
                transactionHash: receipt.hash,
                blockNumber: receipt.blockNumber
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Obtiene información de staking del usuario
     * @param {string} userAddress - Dirección del usuario
     * @returns {Promise<Object>} Información de staking
     */
    async getStakingInfo(userAddress) {
        try {
            const contract = new ethers.Contract(
                this.stakingContractAddress,
                this.stakingABI,
                this.provider
            );

            const [amount, rewards, lastClaim] = await contract.getStakeInfo(userAddress);

            return {
                success: true,
                stakedAmount: ethers.formatEther(amount),
                pendingRewards: ethers.formatEther(rewards),
                lastClaimTimestamp: Number(lastClaim),
                lastClaimDate: new Date(Number(lastClaim) * 1000).toISOString()
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Calcula rewards pendientes
     * @param {string} userAddress - Dirección del usuario
     * @returns {Promise<Object>} Rewards calculados
     */
    async calculateRewards(userAddress) {
        try {
            const contract = new ethers.Contract(
                this.stakingContractAddress,
                this.stakingABI,
                this.provider
            );

            const rewards = await contract.calculateRewards(userAddress);

            return {
                success: true,
                pendingRewards: ethers.formatEther(rewards),
                rewardsWei: rewards.toString()
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Obtiene el total stakeado en el contrato
     * @returns {Promise<Object>} Total stakeado
     */
    async getTotalStaked() {
        try {
            const contract = new ethers.Contract(
                this.stakingContractAddress,
                this.stakingABI,
                this.provider
            );

            const total = await contract.totalStaked();

            return {
                success: true,
                totalStaked: ethers.formatEther(total),
                totalStakedWei: total.toString()
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Calcula APY estimado
     * @param {string} amount - Cantidad a stakear
     * @param {number} duration - Duración en días
     * @returns {Promise<Object>} APY calculado
     */
    async calculateAPY(amount, duration = 365) {
        try {
            // Llamar al backend para cálculo de APY
            const response = await this.axios.post('/api/staking/calculate-apy', {
                amount,
                duration
            });

            return {
                success: true,
                apy: response.data.apy,
                estimatedRewards: response.data.estimatedRewards,
                duration
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }
}

module.exports = StakingManager;
