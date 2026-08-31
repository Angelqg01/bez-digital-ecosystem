const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
require('dotenv').config();

const contractJson = require('../../artifacts/contracts/LogisticsContainer.sol/LogisticsContainer.json');
const abi = contractJson.abi;
const contractAddress = process.env.LOGISTICS_CONTRACT_ADDRESS;

const provider = new ethers.JsonRpcProvider(process.env.POLYGON_AMOY_RPC);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(contractAddress, abi, wallet);

// Mint nuevo contenedor
router.post('/create', async (req, res) => {
    try {
        const { ownerAddress, idManual, contents, origin, metadataURI } = req.body;
        const tx = await contract.mintContainer(
            ownerAddress,
            idManual,
            contents,
            origin,
            metadataURI
        );
        const receipt = await tx.wait();
        res.json({ success: true, txHash: receipt.hash, message: "Contenedor tokenizado en la blockchain" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Actualizar estado
router.post('/update/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { newStatus, locationData } = req.body;

        // Actualizar ubicación y estado en la blockchain
        // Verifica que tu contrato LogisticsContainer.sol tenga esta función
        const tx = await contract.updateLocation(
            id,
            locationData || "Unknown Location",
            newStatus
        );

        const receipt = await tx.wait();
        res.json({
            success: true,
            txHash: receipt.hash,
            message: "Estado del contenedor actualizado en blockchain"
        });
    } catch (error) {
        console.error("Error updating container:", error);
        res.status(500).json({ error: error.message });
    }
});

// Obtener información del contenedor
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const container = await contract.getContainer(id);

        res.json({
            success: true,
            container: {
                owner: container.owner,
                idManual: container.idManual,
                contents: container.contents,
                origin: container.origin,
                currentLocation: container.currentLocation,
                status: container.status,
                metadataURI: container.metadataURI
            }
        });
    } catch (error) {
        console.error("Error fetching container:", error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
