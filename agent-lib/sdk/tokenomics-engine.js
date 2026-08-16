
const { ethers } = require('ethers');

// ABIs mínimos necesarios para el agente
const BEZ_ABI = ["function balanceOf(address) view returns (uint256)", "function totalSupply() view returns (uint256)"];
const STAKING_ABI = [
    "function balanceOf(address) view returns (uint256)", 
    "function currentAPY() view returns (uint256)",
    "function pendingRewards(address) view returns (uint256)",
    "function totalStaked() view returns (uint256)"
];

class TokenomicsEngine {
  constructor(providerOrSigner, contractAddresses = {}) {
    this.provider = providerOrSigner;
    this.signer = providerOrSigner.getSigner ? null : providerOrSigner; 
    
    this.addresses = {
      bez: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
      stakingPool: contractAddresses.stakingPool || '0x0000000000000000000000000000000000000000',
      ...contractAddresses
    };

    this.bezContract = new ethers.Contract(this.addresses.bez, BEZ_ABI, this.provider);
    if (this.addresses.stakingPool !== ethers.ZeroAddress) {
        this.stakingContract = new ethers.Contract(this.addresses.stakingPool, STAKING_ABI, this.provider);
    }

    this.cache = new Map();
  }

  async getStakingPosition(address) {
    if (!this.stakingContract) return { amount: "0", apy: "0", rewards: "0" };
    const [amount, apy, rewards] = await Promise.all([
      this.stakingContract.balanceOf(address),
      this.stakingContract.currentAPY(),
      this.stakingContract.pendingRewards(address)
    ]);
    return {
      amount: ethers.formatEther(amount),
      apy: (Number(apy) / 100).toFixed(2),
      rewards: ethers.formatEther(rewards)
    };
  }

  async getTotalSupply() {
    const supply = await this.bezContract.totalSupply();
    return ethers.formatEther(supply);
  }

  async getTVL() {
    if (!this.stakingContract) return "0";
    const total = await this.stakingContract.totalStaked();
    return ethers.formatEther(total);
  }
}

module.exports = { TokenomicsEngine };
