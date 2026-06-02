
export class RewardsTracker {
  constructor(provider) {
    this.provider = provider;
  }

  async getTotalPendingRewards(address) {
    return {
      totalPending: 57.7,
      stakingRewards: 45.2,
      farmingRewards: 12.5,
      nodeRewards: 0
    };
  }

  async claimAll(address) {
    console.log(`Claiming all rewards for ${address}...`);
    return { hash: "0x..." };
  }
}
