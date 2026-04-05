/**
 * BeZhas Farming SDK
 * Interacción con el contrato LiquidityFarming
 */

const { ethers } = require('ethers');
const farmingABI = require('./artifacts/contracts/LiquidityFarming.sol/LiquidityFarming.json').abi;

class FarmingSDK {
    constructor(contractAddress, providerOrSigner) {
        this.contract = new ethers.Contract(contractAddress, farmingABI, providerOrSigner);
        this.contractAddress = contractAddress;
    }

    /**
     * Depositar tokens en un pool de farming
     * @param {number} pid - Pool ID
     * @param {string} amount - Cantidad en wei
     * @param {number} lockPeriod - Período de bloqueo en segundos (0, 7 days, 30 days, etc.)
     * @returns {Promise<ethers.ContractTransaction>}
     */
    async deposit(pid, amount, lockPeriod = 0) {
        try {
            const tx = await this.contract.deposit(pid, amount, lockPeriod);
            return tx;
        } catch (error) {
            console.error('Error depositing:', error);
            throw error;
        }
    }

    /**
     * Retirar tokens de un pool
     * @param {number} pid - Pool ID
     * @param {string} amount - Cantidad en wei
     * @returns {Promise<ethers.ContractTransaction>}
     */
    async withdraw(pid, amount) {
        try {
            const tx = await this.contract.withdraw(pid, amount);
            return tx;
        } catch (error) {
            console.error('Error withdrawing:', error);
            throw error;
        }
    }

    /**
     * Reclamar recompensas acumuladas
     * @param {number} pid - Pool ID
     * @returns {Promise<ethers.ContractTransaction>}
     */
    async claimRewards(pid) {
        try {
            const tx = await this.contract.claimRewards(pid);
            return tx;
        } catch (error) {
            console.error('Error claiming rewards:', error);
            throw error;
        }
    }

    /**
     * Obtener recompensas pendientes del usuario
     * @param {number} pid - Pool ID
     * @param {string} userAddress - Dirección del usuario
     * @returns {Promise<BigNumber>}
     */
    async getPendingRewards(pid, userAddress) {
        try {
            const pending = await this.contract.pendingReward(pid, userAddress);
            return pending;
        } catch (error) {
            console.error('Error getting pending rewards:', error);
            throw error;
        }
    }

    /**
     * Obtener información del usuario en un pool
     * @param {number} pid - Pool ID
     * @param {string} userAddress - Dirección del usuario
     * @returns {Promise<Object>}
     */
    async getUserInfo(pid, userAddress) {
        try {
            const info = await this.contract.getUserInfo(pid, userAddress);
            return {
                amount: info.amount.toString(),
                rewardDebt: info.rewardDebt.toString(),
                pendingRewards: info.pendingRewards.toString(),
                lastStakeTime: info.lastStakeTime.toNumber(),
                lockEndTime: info.lockEndTime.toNumber(),
                multiplier: info.multiplier.toNumber()
            };
        } catch (error) {
            console.error('Error getting user info:', error);
            throw error;
        }
    }

    /**
     * Obtener información de un pool
     * @param {number} pid - Pool ID
     * @returns {Promise<Object>}
     */
    async getPoolInfo(pid) {
        try {
            const info = await this.contract.getPoolInfo(pid);
            return {
                lpToken: info.lpToken,
                allocPoint: info.allocPoint.toNumber(),
                lastRewardBlock: info.lastRewardBlock.toNumber(),
                accRewardPerShare: info.accRewardPerShare.toString(),
                totalStaked: info.totalStaked.toString(),
                minStakeAmount: info.minStakeAmount.toString(),
                maxStakeAmount: info.maxStakeAmount.toString(),
                isActive: info.isActive
            };
        } catch (error) {
            console.error('Error getting pool info:', error);
            throw error;
        }
    }

    /**
     * Obtener cantidad total de pools
     * @returns {Promise<number>}
     */
    async getPoolLength() {
        try {
            const length = await this.contract.poolLength();
            return length.toNumber();
        } catch (error) {
            console.error('Error getting pool length:', error);
            throw error;
        }
    }

    /**
     * Calcular APY de un pool
     * @param {number} pid - Pool ID
     * @param {number} rewardPerBlock - Recompensas por bloque
     * @param {number} blocksPerYear - Bloques por año (~2.5s por bloque en Polygon = 12,614,400 bloques/año)
     * @returns {Promise<number>} APY en porcentaje
     */
    async calculateAPY(pid, rewardPerBlock, blocksPerYear = 12614400) {
        try {
            const poolInfo = await this.getPoolInfo(pid);
            const totalAllocPoint = await this.contract.totalAllocPoint();

            // Calcular recompensas anuales del pool
            const poolAllocPoint = poolInfo.allocPoint;
            const poolShare = poolAllocPoint / totalAllocPoint.toNumber();
            const annualRewards = rewardPerBlock * blocksPerYear * poolShare;

            // APY = (Recompensas Anuales / TVL) * 100
            const tvl = parseFloat(ethers.utils.formatEther(poolInfo.totalStaked));
            const apy = tvl > 0 ? (annualRewards / tvl) * 100 : 0;

            return apy;
        } catch (error) {
            console.error('Error calculating APY:', error);
            return 0;
        }
    }

    /**
     * Obtener multiplicador de bloqueo
     * @param {number} lockPeriod - Período en segundos
     * @returns {Promise<number>}
     */
    async getLockMultiplier(lockPeriod) {
        try {
            const multiplier = await this.contract.lockMultipliers(lockPeriod);
            return multiplier.toNumber() / 10000; // Convertir de basis points a decimal
        } catch (error) {
            console.error('Error getting lock multiplier:', error);
            return 1;
        }
    }

    /**
     * Retiro de emergencia (sin recompensas)
     * @param {number} pid - Pool ID
     * @returns {Promise<ethers.ContractTransaction>}
     */
    async emergencyWithdraw(pid) {
        try {
            const tx = await this.contract.emergencyWithdraw(pid);
            return tx;
        } catch (error) {
            console.error('Error emergency withdrawing:', error);
            throw error;
        }
    }

    /**
     * Escuchar eventos del contrato
     * @param {string} eventName - Nombre del evento
     * @param {function} callback - Función callback
     */
    onEvent(eventName, callback) {
        this.contract.on(eventName, callback);
    }

    /**
     * Dejar de escuchar eventos
     * @param {string} eventName - Nombre del evento
     * @param {function} callback - Función callback
     */
    offEvent(eventName, callback) {
        this.contract.off(eventName, callback);
    }
}

module.exports = FarmingSDK;
