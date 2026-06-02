const ethers = require('ethers');
require('dotenv').config({ path: '../.env' });

async function verify() {
    console.log("Iniciando verificación de Blockchain y Componentes...");
    const rpcUrl = process.env.BEZHAS_L2_RPC_URL || 'http://localhost:8545';
    console.log(`Conectando a RPC: ${rpcUrl}`);
    
    try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const blockNumber = await provider.getBlockNumber();
        console.log(`✅ Conexión L2 exitosa. Bloque actual: ${blockNumber}`);
        
        const network = await provider.getNetwork();
        console.log(`✅ Network ID: ${network.chainId}`);
        
        const adminWallet = process.env.ADMIN_WALLET || "0x52df82920cbae522880dd7657e43d1a754ed044e";
        const balance = await provider.getBalance(adminWallet);
        console.log(`✅ Balance de ADMIN_WALLET: ${ethers.formatEther(balance)} BEZ`);

    } catch (e) {
        console.log(`❌ Falla en la conexión L2: ${e.message}`);
        process.exit(1);
    }
}

verify();
