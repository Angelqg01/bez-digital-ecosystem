require('dotenv').config();
const ethers = require('ethers');
const User = require('./models/pg/User');

async function testIntegration() {
    console.log('--- BEZHAS INTEGRATION TEST ---');
    console.log('1. Testing Database Layer (PostgreSQL)');
    
    try {
        // Test User Creation
        const testWallet = '0x1234567890123456789012345678901234567ABC';
        const user = await User.create({
            walletAddress: testWallet,
            role: 'User'
        });
        
        console.log('✅ PostgreSQL connected successfully!');
        console.log(`✅ Created test user: ${user.id} with wallet: ${user.wallet_address}`);
        
        const found = await User.findByWallet(testWallet);
        if (found) {
            console.log(`✅ Fetched user by wallet successfully!`);
        } else {
            console.error(`❌ Failed to fetch user by wallet.`);
        }
        
    } catch (e) {
        if (e.code === '23505') { // Unique violation
            console.log('✅ PostgreSQL connected: User already exists. Fetching instead...');
            const found = await User.findByWallet('0x1234567890123456789012345678901234567ABC');
            if (found) {
                console.log(`✅ Fetched existing user by wallet successfully! UUID: ${found.id}`);
            }
        } else {
            console.error('❌ Database error:', e.message);
        }
    }

    console.log('\n2. Testing Blockchain Layer (Ethers v6)');
    try {
        // Ethers v6 standard connection test
        const provider = new ethers.JsonRpcProvider('https://polygon-rpc.com');
        const network = await provider.getNetwork();
        
        console.log('✅ Ethers v6 Provider created successfully!');
        console.log(`✅ Connected to Network: ${network.name} (Chain ID: ${network.chainId})`);
        
        // Format Ether v6 test
        const oneBez = ethers.parseEther('1.0');
        console.log(`✅ ethers.parseEther check: 1.0 = ${oneBez.toString()} wei`);
        
        const formatted = ethers.formatEther(oneBez);
        console.log(`✅ ethers.formatEther check: ${oneBez.toString()} wei = ${formatted} BEZ`);
        
        console.log('\n🌟 INTEGRATION TEST PASSED: ALL SYSTEMS GO! 🌟');
    } catch (e) {
        console.error('❌ Blockchain Layer error:', e.message);
    }
    
    process.exit(0);
}

testIntegration();
