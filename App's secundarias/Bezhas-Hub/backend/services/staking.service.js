/**
 * Staking Service - Backend
 * Gestiona la lógica de staking directo de tokens BEZ (Single-sided staking)
 * Integrado con GlobalSettings para configuración dinámica
 */

const { ethers } = require('ethers');
const web3Service = require('./web3.service');
const settingsHelper = require('../utils/settingsHelper');
const pino = require('pino');
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

class StakingService {
    constructor() {
        this.stakingAddress = process.env.STAKING_CONTRACT_ADDRESS || null;
        this.provider = null;
        this.initialized = false;
        this.stakingConfig = null;
        this.stakingContract = null;
    }

    /**
     * Get staking configuration from GlobalSettings
     * @returns {Promise<object>} Staking configuration
     */
    async getStakingConfig() {
        if (!this.stakingConfig) {
            this.stakingConfig = await settingsHelper.getStakingConfig();
        }
        return this.stakingConfig;
    }

    /**
     * Initialize the staking service
     */
    async initialize() {
        if (this.initialized) return;

        try {
            // Check if staking is enabled in GlobalSettings
            const isEnabled = await settingsHelper.isEnabled('staking');
            if (!isEnabled) {
                logger.warn('⚠️ Staking is disabled in GlobalSettings');
                return;
            }

            // Load staking configuration
            this.stakingConfig = await this.getStakingConfig();

            // Obtener provider de Web3Service
            this.provider = web3Service.getProvider();

            if (!this.stakingAddress) {
                logger.warn('⚠️ Staking contract address not configured');
                return;
            }

            // Initialize contract instance
            const STAKING_ABI = [
                "function stake(uint256 amount, uint256 lockPeriodId) public",
                "function withdraw(uint256 amount) public",
                "function claimRewards() public",
                "function getStakedBalance(address account) view returns (uint256)",
                "function getPendingRewards(address account) view returns (uint256)",
                "function getUserInfo(address account) view returns (uint256 amount, uint256 rewardDebt, uint256 lockEndTime, uint256 lastStakeTime)",
                "function getLockPeriods() view returns (tuple(uint256 days, uint256 bonusMultiplier, bool enabled)[])"
            ];

            this.stakingContract = new ethers.Contract(this.stakingAddress, STAKING_ABI, this.provider);
            this.initialized = true;

            logger.info({
                address: this.stakingAddress,
                enabled: isEnabled,
                rewardRate: this.stakingConfig.rewardRatePercent + '%'
            }, '✅ Staking Service initialized with dynamic config');
        } catch (error) {
            logger.error({ error: error.message }, '❌ Error initializing Staking Service');
        }
    }

    /**
     * Obtener estadísticas globales de staking
     */
    async getGlobalStats() {
        if (!this.initialized) await this.initialize();
        const config = await this.getStakingConfig();

        return {
            enabled: config.enabled,
            rewardRate: config.rewardRatePercent,
            minStake: config.minStakeAmount,
            maxStake: config.maxStakeAmount,
            compounding: config.compoundingEnabled,
            unstakeCooldown: config.unstakeCooldownHours,
            lockPeriods: config.lockPeriods || []
        };
    }

    /**
     * Obtener información del usuario en staking
     * @param {string} userAddress - Dirección del usuario
     */
    async getUserData(userAddress) {
        if (!this.initialized) await this.initialize();
        if (!this.stakingContract) return null;

        try {
            const userInfo = await this.stakingContract.getUserInfo(userAddress);
            const pendingRewards = await this.stakingContract.getPendingRewards(userAddress);

            return {
                stakedAmount: ethers.formatEther(userInfo.amount),
                pendingRewards: ethers.formatEther(pendingRewards),
                lockEndTime: Number(userInfo.lockEndTime),
                lastStakeTime: Number(userInfo.lastStakeTime),
                isLocked: (Date.now() / 1000) < Number(userInfo.lockEndTime)
            };
        } catch (error) {
            logger.error({ error: error.message, userAddress }, 'Error getting user staking data');
            return null;
        }
    }

    /**
     * Validar si un usuario puede realizar un staking
     * @param {string} amount - Cantidad en unidades BEZ (string)
     */
    async validateStake(amount) {
        if (!this.initialized) await this.initialize();
        const config = await this.getStakingConfig();
        const amountBN = ethers.parseEther(amount);

        // Validar contra límites de GlobalSettings
        if (amountBN < ethers.parseEther(config.minStakeAmount)) {
            return { valid: false, reason: `Minimum stake is ${config.minStakeAmount} BEZ` };
        }

        if (config.maxStakeAmount !== '0' && amountBN > ethers.parseEther(config.maxStakeAmount)) {
            return { valid: false, reason: `Maximum stake is ${config.maxStakeAmount} BEZ` };
        }

        return { valid: true };
    }

    /**
     * Invalida caché de configuración (llamado tras actualización en Admin)
     */
    invalidateCache() {
        this.stakingConfig = null;
        this.initialized = false;
    }
}

module.exports = new StakingService();
