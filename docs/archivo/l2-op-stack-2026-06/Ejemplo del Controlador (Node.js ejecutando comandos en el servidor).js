// backend/controllers/nodeController.js
const { exec } = require('child_process');
const axios = require('axios');

// Función para reiniciar el nodo Secuenciador desde la App
exports.restartSequencer = (req, res) => {
    // La app ejecuta el comando Docker localmente en el servidor
    exec('docker-compose -f /ruta/a/tu/blockchain/docker-compose.yml restart bezhas-geth', (error, stdout, stderr) => {
        if (error) {
            return res.status(500).json({ status: "error", message: "Fallo al reiniciar el nodo." });
        }
        res.json({ status: "success", message: "Nodo Secuenciador reiniciado correctamente." });
    });
};

// Función para leer el bloque actual (Llamada RPC local)
exports.getNetworkStatus = async (req, res) => {
    try {
        // Llama al propio nodo que corre en localhost
        const response = await axios.post('http://localhost:8545', {
            jsonrpc: "2.0",
            method: "eth_blockNumber",
            params: