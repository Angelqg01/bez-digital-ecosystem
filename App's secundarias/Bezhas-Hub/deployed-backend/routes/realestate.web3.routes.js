const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
require('dotenv').config();

const contractJson = require('../../artifacts/contracts/BeZhasRealEstate.sol/BeZhasRealEstate.json');
const abi = contractJson.abi;
const contractAddress = process.env.REALESTATE_CONTRACT_ADDRESS;

const provider = new ethers.JsonRpcProvider(process.env.POLYGON_AMOY_RPC);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(contractAddress, abi, wallet);

// Comprar acciones
router.post('/buy/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { amount } = req.body;
        const tx = await contract.buyShares(id, amount, {
            value: ethers.parseEther("0.01") // Ajusta según el precio real
        });
        const receipt = await tx.wait();
        res.json({ success: true, txHash: receipt.hash });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Simular reserva (Booking)
router.post('/book/:id', async (req, res) => {
    try {
        const { revenue } = req.body;
        const tx = await contract.depositRevenue(req.params.id, {
            value: ethers.parseUnits(revenue, "wei")
        });
        const receipt = await tx.wait();
        res.json({ message: "Revenue distributed to shareholders", txHash: receipt.hash });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Reclamar dividendos
router.post('/claim/:id', async (req, res) => {
    try {
        const tx = await contract.claimDividends(req.params.id);
        const receipt = await tx.wait();
        res.json({ message: "Dividends claimed", txHash: receipt.hash });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
