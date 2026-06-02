
import { ethers } from 'ethers';
import { 
    BEZCoinV2ABI, 
    BeZhasStakingABI, 
    BeZhasBridgeABI, 
    BeZhasTreasuryABI 
} from '@/lib/abi';

export class TokenomicsEngine {
  constructor(providerOrSigner, contractAddresses = {}) {
    this.provider = providerOrSigner;
    // En ethers v6, el signer se maneja de forma distinta, pero para compatibilidad:
    this.signer = providerOrSigner.getSigner ? null : providerOrSigner; 
    
    // Direcciones de contratos
    this.addresses = {
      bez: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
      wbez: contractAddresses.wbez || '0x0000000000000000000000000000000000000000', // Placeholder
      stakingPool: contractAddresses.stakingPool || '0x0000000000000000000000000000000000000000', // Placeholder
      bridges: { 
        l1: '0x0000000000000000000000000000000000000000',
        l2: '0x0000000000000000000000000000000000000000'
      },
      ...contractAddresses
    };

    // Instancias de contratos
    this.bezContract = new ethers.Contract(this.addresses.bez, BEZCoinV2ABI, this.provider);
    
    if (this.addresses.stakingPool !== ethers.ZeroAddress) {
        this.stakingContract = new ethers.Contract(this.addresses.stakingPool, BeZhasStakingABI, this.provider);
    }

    this.cache = new Map();
  }

  // --------- MÉTODOS DE LECTURA UNIFICADOS ---------

  async getStakingPosition(address) {
    if (!this.stakingContract) {
        return { amount: "0.0", lockEnd: 0, apy: "0.0", rewards: "0.0" };
    }

    const cacheKey = `staking_${address}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
    
    try {
        const [amount, lockEnd, apy, rewards] = await Promise.all([
            this.stakingContract.balanceOf(address),
            this.stakingContract.lockEnd(address),
            this.stakingContract.currentAPY ? this.stakingContract.currentAPY() : Promise.resolve(0),
            this.stakingContract.pendingRewards ? this.stakingContract.pendingRewards(address) : Promise.resolve(0)
        ]);

        const data = {
            amount: ethers.formatEther(amount),
            lockEnd: Number(lockEnd),
            apy: (Number(apy) / 100).toFixed(2),
            rewards: ethers.formatEther(rewards)
        };

        this.cache.set(cacheKey, data);
        setTimeout(() => this.cache.delete(cacheKey), 30000); // TTL 30s
        return data;
    } catch (error) {
        console.error("Error fetching staking position:", error);
        return { amount: "0.0", lockEnd: 0, apy: "0.0", rewards: "0.0" };
    }
  }

  async getAllFarmingPools(address) {
    // Mock por ahora, expandir cuando se desplieguen los contratos de farming
    return [
      { pair: "BEZ/USDT", tvl: "1.2M", apy: 24.5, userLp: "0", pendingRewards: "0" }
    ];
  }

  async getPortfolio(address) {
    try {
        const bezBal = await this.bezContract.balanceOf(address);
        // wBEZ mock si no hay contrato
        const wbezBal = this.wbezContract ? await this.wbezContract.balanceOf(address) : 0n;
        
        return {
            bez: ethers.formatEther(bezBal),
            wbez: ethers.formatEther(wbezBal),
            totalValue: ethers.formatEther(bezBal + wbezBal)
        };
    } catch (error) {
        console.error("Error fetching portfolio:", error);
        return { bez: "0.0", wbez: "0.0", totalValue: "0.0" };
    }
  }

  // --------- MÉTODOS DE ESCRITURA ---------
  
  async stake(amount) {
    if (!this.signer) throw new Error("Signer required for transactions");
    const tx = await this.stakingContract.connect(this.signer).stake(ethers.parseEther(amount));
    await tx.wait();
    this.invalidateCache(`staking_`);
    return tx;
  }

  async unstake(amount) {
    if (!this.signer) throw new Error("Signer required for transactions");
    const tx = await this.stakingContract.connect(this.signer).unstake(ethers.parseEther(amount));
    await tx.wait();
    this.invalidateCache(`staking_`);
    return tx;
  }

  async claimStakingRewards() {
    if (!this.signer) throw new Error("Signer required for transactions");
    const tx = await this.stakingContract.connect(this.signer).claimRewards();
    await tx.wait();
    this.invalidateCache(`staking_`);
    return tx;
  }

  invalidateCache(prefix) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) this.cache.delete(key);
    }
  }
}
