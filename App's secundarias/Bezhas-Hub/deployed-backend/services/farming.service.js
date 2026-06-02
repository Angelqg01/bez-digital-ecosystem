/**
 * Farming Service - Backend
 * Gestiona la lógica de farming/staking con el contrato
 * Integrado con GlobalSettings para configuración dinámica
 */

const { ethers } = require('ethers');
const FarmingSDK = require('../../sdk/farming');
const web3Service = require('./web3.service');
const settingsHelper = require('../utils/settingsHelper');

class FarmingService {
    constructor() {
        this.farmingAddress = process.env.FARMING_CONTRACT_ADDRESS || null;
        this.provider = null;
        this.sdk = null;
        this.initialized = false;
        this.farmingConfig = null;
    }

    /**
     * Get farming configuration from GlobalSettings
     * @returns {Promise<object>} Farming configuration
     */
    async getFarmingConfig() {
        if (!this.farmingConfig) {
            this.farmingConfig = await settingsHelper.getFarmingConfig();
        }
        return this.farmingConfig;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            // Check if farming is enabled in GlobalSettings
            const isEnabled = await settingsHelper.isEnabled('farming');
            if (!isEnabled) {
                console.warn('⚠️ Farming is disabled in GlobalSettings');
                return;
            }

            // Load farming configuration
            this.farmingConfig = await this.getFarmingConfig();

            // Obtener provider de Web3Service
            this.provider = web3Service.getProvider();

            if (!this.farmingAddress) {
                console.warn('⚠️ Farming contract address not configured');
                return;
            }

            // Inicializar SDK con provider read-only
            this.sdk = new FarmingSDK(this.farmingAddress, this.provider);
            this.initialized = true;

            console.log('✅ Farming Service initialized with dynamic config');
        } catch (error) {
            console.error('Error initializing Farming Service:', error);
        }
    }

    /**
     * Obtener todos los pools activos
     */
    async getAllPools() {
        if (!this.initialized) await this.initialize();
        if (!this.sdk) return [];

        try {
            const poolLength = await this.sdk.getPoolLength();
            const pools = [];

            for (let i = 0; i < poolLength; i++) {
                const poolInfo = await this.sdk.getPoolInfo(i);

                if (poolInfo.isActive) {
                    const apy = await this.sdk.calculateAPY(i, 1); // 1 token por bloque (ajustar según tu config)

                    pools.push({
                        id: i,
                        name: `Pool ${i + 1}`,
                        lpToken: poolInfo.lpToken,
                        totalStaked: poolInfo.totalStaked,
                        allocPoint: poolInfo.allocPoint,
                        apy: apy.toFixed(2),
                        minStake: poolInfo.minStakeAmount,
                        maxStake: poolInfo.maxStakeAmount,
                        isActive: poolInfo.isActive
                    });
                }
            }

            return pools;
        } catch (error) {
            console.error('Error getting all pools:', error);
            return [];
        }
    }

    /**
     * Obtener información del usuario en todos los pools
     */
    async getUserFarmingData(userAddress) {
        if (!this.initialized) await this.initialize();
        if (!this.sdk) return { pools: [], totalStaked: '0', totalRewards: '0' };

        try {
            const poolLength = await this.sdk.getPoolLength();
            const userPools = [];
            let totalStaked = ethers.BigNumber.from(0);
            let totalRewards = ethers.BigNumber.from(0);

            for (let i = 0; i < poolLength; i++) {
                const userInfo = await this.sdk.getUserInfo(i, userAddress);
                const pendingRewards = await this.sdk.getPendingRewards(i, userAddress);

                if (ethers.BigNumber.from(userInfo.amount).gt(0)) {
                    const poolInfo = await this.sdk.getPoolInfo(i);
                    const multiplier = await this.sdk.getLockMultiplier(
                        userInfo.lockEndTime - userInfo.lastStakeTime
                    );

                    userPools.push({
                        poolId: i,
                        staked: userInfo.amount,
                        pendingRewards: pendingRewards.toString(),
                        multiplier: multiplier,
                        lockEndTime: userInfo.lockEndTime,
                        canWithdraw: Date.now() / 1000 >= userInfo.lockEndTime
                    });

                    totalStaked = totalStaked.add(ethers.BigNumber.from(userInfo.amount));
                    totalRewards = totalRewards.add(pendingRewards);
                }
            }

            return {
                pools: userPools,
                totalStaked: totalStaked.toString(),
                totalRewards: totalRewards.toString()
            };
        } catch (error) {
            console.error('Error getting user farming data:', error);
            return { pools: [], totalStaked: '0', totalRewards: '0' };
        }
    }

    /**
     * Obtener estadísticas globales de farming
     */
    async getFarmingStats() {
        if (!this.initialized) await this.initialize();
        if (!this.sdk) return null;

        try {
            const poolLength = await this.sdk.getPoolLength();
            let totalValueLocked = ethers.BigNumber.from(0);
            let activePools = 0;

            for (let i = 0; i < poolLength; i++) {
                const poolInfo = await this.sdk.getPoolInfo(i);
                if (poolInfo.isActive) {
                    totalValueLocked = totalValueLocked.add(
                        ethers.BigNumber.from(poolInfo.totalStaked)
                    );
                    activePools++;
                }
            }

            return {
                totalValueLocked: totalValueLocked.toString(),
                activePools,
                totalPools: poolLength
            };
        } catch (error) {
            console.error('Error getting farming stats:', error);
            return null;
        }
    }

    /**
     * Validar si el usuario puede hacer staking
     */
    async canStake(poolId, amount, userAddress) {
        if (!this.initialized) await this.initialize();
        if (!this.sdk) return { canStake: false, reason: 'Service not initialized' };

        try {
            const poolInfo = await this.sdk.getPoolInfo(poolId);
            const amountBN = ethers.BigNumber.from(amount);

            // Verificar si el pool está activo
            if (!poolInfo.isActive) {
                return { canStake: false, reason: 'Pool is not active' };
            }

            // Verificar mínimo
            if (amountBN.lt(ethers.BigNumber.from(poolInfo.minStakeAmount))) {
                return {
                    canStake: false,
                    reason: `Minimum stake is ${ethers.utils.formatEther(poolInfo.minStakeAmount)} tokens`
                };
            }

            // Verificar máximo
            if (poolInfo.maxStakeAmount !== '0' && amountBN.gt(ethers.BigNumber.from(poolInfo.maxStakeAmount))) {
                return {
                    canStake: false,
                    reason: `Maximum stake is ${ethers.utils.formatEther(poolInfo.maxStakeAmount)} tokens`
                };
            }

            return { canStake: true };
        } catch (error) {
            console.error('Error validating stake:', error);
            return { canStake: false, reason: error.message };
        }
    }

    /**
     * Obtener multiplicadores de lock disponibles desde GlobalSettings
     */
    async getLockMultipliers() {
        // Get lock periods from GlobalSettings
        const config = await this.getFarmingConfig();
        const lockPeriods = config.lockPeriods || [
            { seconds: 0, label: 'Sin bloqueo', days: 0 },
            { seconds: 7 * 24 * 60 * 60, label: '1 semana', days: 7 },
            { seconds: 30 * 24 * 60 * 60, label: '1 mes', days: 30 },
            { seconds: 90 * 24 * 60 * 60, label: '3 meses', days: 90 },
            { seconds: 180 * 24 * 60 * 60, label: '6 meses', days: 180 }
        ];

        if (!this.initialized) await this.initialize();
        if (!this.sdk) return lockPeriods;

        try {
            const multipliers = await Promise.all(
                lockPeriods.map(async (period) => {
                    const multiplier = await this.sdk.getLockMultiplier(period.seconds);
                    return {
                        ...period,
                        multiplier,
                        boost: ((multiplier - 1) * 100).toFixed(1) + '%'
                    };
                })
            );

            return multipliers;
        } catch (error) {
            console.error('Error getting lock multipliers:', error);
            return lockPeriods;
        }
    }

    /**
     * Get public farming configuration for frontend
     * @returns {Promise<object>} Farming config
     */
    async getPublicFarmingConfig() {
        const config = await this.getFarmingConfig();
        return {
            minStake: config.minStake,
            maxStake: config.maxStake,
            lockPeriods: config.lockPeriods,
            emergencyWithdrawFee: config.emergencyWithdrawFee,
            harvestCooldown: config.harvestCooldown,
            compoundingEnabled: config.compoundingEnabled,
            boostMultipliers: config.boostMultipliers,
        };
    }
}

module.exports = new FarmingService();
