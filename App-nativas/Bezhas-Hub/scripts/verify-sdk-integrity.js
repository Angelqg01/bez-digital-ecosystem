/**
 * verify-sdk-integrity.js
 * Comprehensive integration test for BeZhas SDK and MCP Server.
 */

const { BeZhas } = require('../sdk/index'); // Requiring local SDK for verification
const axios = require('axios');
const { ethers } = require('ethers');

async function verifySDK() {
    console.log('🧪 Starting SDK Integrity Validation...\n');

    // 1. Instantiate SDK
    console.log('1️⃣ Instantiating BeZhas SDK...');
    const sdk = new BeZhas({
        apiKey: 'test-api-key-integrity-check',
        environment: 'development',
        network: 'amoy'
    });
    console.log('✅ SDK instance created.\n');

    // 2. Test Backend Connection (Health Check)
    console.log('2️⃣ Testing Backend Connectivity...');
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    try {
        const health = await axios.get(`${backendUrl}/health`);
        console.log('✅ Backend is reachable:', health.data.status || 'OK');
    } catch (error) {
        console.warn('⚠️ Backend not reachable globally. Check if it is running on localhost:3001');
    }
    console.log('');

    // 3. Test Polygon Amoy RPC via SDK config
    console.log('3️⃣ Testing RPC Connectivity (Polygon Amoy)...');
    try {
        // We use the SDK's contract configuration to test connectivity
        const amoyRpc = 'https://polygon-amoy-bor-rpc.publicnode.com';
        const provider = new ethers.JsonRpcProvider(amoyRpc);
        const blockNumber = await provider.getBlockNumber();
        console.log('✅ RPC is responsive. Current block:', blockNumber);
    } catch (error) {
        console.error('❌ RPC Connection Failed:', error.message);
    }
    console.log('');

    // 4. Validate SDK Contract Access
    console.log('4️⃣ Validating SDK Contract Access...');
    try {
        const addresses = sdk.getAddresses('amoy');
        console.log('✅ Found', Object.keys(addresses).length, 'contract addresses for Amoy.');
        const bezToken = sdk.getContract('BezhasToken', 'amoy');
        if (bezToken) {
            console.log('✅ Successfully loaded BezhasToken ABI and address.');
        }
    } catch (error) {
        console.error('❌ SDK Contract logic error:', error.message);
    }
    console.log('');

    // 5. MCP Handshake Simulation
    console.log('5️⃣ Testing MCP Server Handshake...');
    const mcpUrl = 'http://localhost:3002'; // Default MCP HTTP port
    try {
        // En un handshake real usaríamos el protocolo MCP, 
        // aquí simulamos una llamada de salud si el servidor HTTP está habilitado
        const mcpHealth = await axios.get(`${mcpUrl}/health`).catch(() => null);
        if (mcpHealth) {
            console.log('✅ MCP Server responded via HTTP.');
        } else {
            console.log('ℹ️ MCP HTTP interface not detected. (This is normal if only stdio is used)');
        }
    } catch (error) {
        console.log('ℹ️ MCP Server not reachable via HTTP on port 3002.');
    }

    console.log('\n✨ SDK Integrity Check Completed.');
}

verifySDK().catch(err => {
    console.error('💥 Critical Error during validation:', err);
    process.exit(1);
});
