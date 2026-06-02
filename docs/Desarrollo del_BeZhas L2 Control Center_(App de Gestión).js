// admin-api/server.js
const express = require('express');
const { exec } = require('child_process');
const { ethers } = require('ethers');
const app = express();

app.use(express.json());

// Conexión local a tu blockchain
const provider = new ethers.JsonRpcProvider('http://localhost:8545');
// Wallet administradora
const adminWallet = new ethers.Wallet('TU_CLAVE_PRIVADA_ADMIN', provider);

// 1. ENDPOINT: Control de Tarifas de Gas (Llama al SystemConfig L1/L2)
app.post('/api/gas/update', async (req, res) => {
    const { newBaseFee } = req.body;
    // Aquí invocarías al contrato SystemConfig para actualizar la variable gasPriceOracle
    // (Lógica simplificada para el ejemplo)
    res.json({ message: `Tarifa base de gas BEZ actualizada a ${newBaseFee}` });
});

// 2. ENDPOINT: Minting (Acuñar) o Burn (Quemar) BEZ Token en L2
app.post('/api/token/mint', async (req, res) => {
    const { targetAddress, amount } = req.body;
    // ABI del contrato BEZ Token
    const tokenContract = new ethers.Contract('0xEcBa...', ['function mint(address,uint256)'], adminWallet);
    const tx = await tokenContract.mint(targetAddress, ethers.parseEther(amount.toString()));
    await tx.wait();
    res.json({ message: `Acuñados ${amount} BEZ a ${targetAddress}`, txHash: tx.hash });
});

// 3. ENDPOINT: Control de Servidor (Reiniciar Blockchain)
app.post('/api/system/restart-node', (req, res) => {
    exec('docker restart bezhas-geth bezhas-node', (error, stdout) => {
        if(error) return res.status(500).json({error: "Fallo al reiniciar"});
        res.json({ message: "Nodo reiniciado correctamente" });
    });
});

app.listen(8080, () => console.log('Admin API corriendo en puerto 8080'));