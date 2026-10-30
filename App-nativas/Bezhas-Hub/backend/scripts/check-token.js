const { ethers } = require('ethers');

async function checkContract() {
    const provider = new ethers.JsonRpcProvider('https://polygon-amoy-bor-rpc.publicnode.com');
    const tokenAbi = [
        'function decimals() view returns (uint8)',
        'function symbol() view returns (string)',
        'function name() view returns (string)'
    ];

    const tokenAddress = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';
    const token = new ethers.Contract(tokenAddress, tokenAbi, provider);

    console.log('🔍 Checking BEZ Token Contract...\n');
    console.log(`Address: ${tokenAddress}`);
    console.log(`Network: Polygon Amoy Testnet\n`);

    try {
        const symbol = await token.symbol();
        console.log(`✅ Symbol: ${symbol}`);

        const decimals = await token.decimals();
        console.log(`✅ Decimals: ${decimals}`);

        const name = await token.name();
        console.log(`✅ Name: ${name}`);

        console.log('\n✅ Contract exists and is valid!');
    } catch (error) {
        console.log(`\n❌ Error: ${error.message}`);
        console.log('\nPossible causes:');
        console.log('1. Contract not deployed on Amoy Testnet at this address');
        console.log('2. Wrong network (maybe deployed on Polygon Mainnet?)');
        console.log('3. RPC endpoint issue');
    }
}

checkContract();
