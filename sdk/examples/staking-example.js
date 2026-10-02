/**
 * BeZhas SDK - Staking Example
 * 
 * This example demonstrates how to use the Staking module
 * to stake BEZ tokens and earn rewards.
 */

const { BeZhasAPIClient } = require('@bezhas/sdk');
const { ethers } = require('ethers');

// Initialize the SDK
const bezhas = new BeZhasAPIClient({
    apiUrl: process.env.BEZHAS_API_URL || 'https://api.bezhas.com',
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-bor.publicnode.com',
    network: 'polygon'
});

async function stakingExample() {
    console.log('🎯 BeZhas SDK - Staking Example\n');

    try {
        // Connect wallet (for browser, use window.ethereum)
        // For Node.js, use private key
        const provider = new ethers.JsonRpcProvider(bezhas.config.rpcUrl);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

        console.log(`📍 Wallet Address: ${wallet.address}\n`);

        // 1. Get staking info
        console.log('1️⃣ Fetching staking information...');
        const info = await bezhas.staking.getStakingInfo(wallet.address);

        if (info.success) {
            console.log('✅ Staking Info:');
            console.log(`   Staked Amount: ${info.stakedAmount} BEZ`);
            console.log(`   Pending Rewards: ${info.pendingRewards} BEZ`);
            console.log(`   Staking Since: ${info.stakingSince || 'Not staking'}`);
        }

        // 2. Calculate APY
        console.log('\n2️⃣ Calculating APY...');
        const apy = await bezhas.staking.calculateAPY();

        if (apy.success) {
            console.log('✅ Current APY:');
            console.log(`   APY: ${apy.apy}%`);
            console.log(`   Total Staked: ${apy.totalStaked} BEZ`);
        }

        // 3. Stake tokens
        console.log('\n3️⃣ Staking 1000 BEZ tokens...');
        const stakeAmount = 1000;
        const stakeResult = await bezhas.staking.stake(stakeAmount, wallet);

        if (stakeResult.success) {
            console.log('✅ Tokens staked successfully!');
            console.log(`   Transaction: ${stakeResult.transactionHash}`);
            console.log(`   Amount: ${stakeResult.amount} BEZ`);
            console.log(`   Block: ${stakeResult.blockNumber}`);
        }

        // 4. Calculate rewards
        console.log('\n4️⃣ Calculating pending rewards...');
        const rewards = await bezhas.staking.calculateRewards(wallet.address);

        if (rewards.success) {
            console.log('✅ Pending Rewards:');
            console.log(`   Amount: ${rewards.rewards} BEZ`);
            console.log(`   Estimated Value: $${rewards.estimatedValue}`);
        }

        // 5. Claim rewards
        console.log('\n5️⃣ Claiming rewards...');
        const claimResult = await bezhas.staking.claimRewards(wallet);

        if (claimResult.success) {
            console.log('✅ Rewards claimed!');
            console.log(`   Transaction: ${claimResult.transactionHash}`);
            console.log(`   Amount: ${claimResult.amount} BEZ`);
        }

        // 6. Get total staked in contract
        console.log('\n6️⃣ Fetching total staked...');
        const totalStaked = await bezhas.staking.getTotalStaked();

        if (totalStaked.success) {
            console.log('✅ Contract Statistics:');
            console.log(`   Total Staked: ${totalStaked.totalStaked} BEZ`);
            console.log(`   Total Stakers: ${totalStaked.totalStakers}`);
        }

        // 7. Unstake tokens (optional)
        console.log('\n7️⃣ Unstaking 500 BEZ tokens...');
        const unstakeAmount = 500;
        const unstakeResult = await bezhas.staking.unstake(unstakeAmount, wallet);

        if (unstakeResult.success) {
            console.log('✅ Tokens unstaked successfully!');
            console.log(`   Transaction: ${unstakeResult.transactionHash}`);
            console.log(`   Amount: ${unstakeResult.amount} BEZ`);
        }

        console.log('\n✅ Staking example completed!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Run the example
if (require.main === module) {
    stakingExample();
}

module.exports = stakingExample;
