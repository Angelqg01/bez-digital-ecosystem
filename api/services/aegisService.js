const axios = require('axios');
const { ethers } = require('ethers');
const { getSignedContract, getContract } = require('./contractService');
const aegisOnChain = require('./aegisOnChain');
const { watchTx } = require('./txService');
const { query } = require('../db/pool');
const { publish } = require('../cache/redis');
const { pinJSON, buildLogisticsMetadata } = require('./ipfsService');

// URL del motor Aegis AI (Python)
const AEGIS_URL = process.env.AEGIS_API_URL || 'http://localhost:8001/api/aegis';

// ── Circuit Breaker for Aegis AI ──
const circuitBreaker = {
    failures: 0,
    lastFailure: 0,
    state: 'CLOSED', // CLOSED → OPEN → HALF_OPEN
    THRESHOLD: 3,      // 3 consecutive failures → open
    RESET_MS: 60_000,  // 60s cooldown before half-open
    isOpen() {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailure > this.RESET_MS) {
                this.state = 'HALF_OPEN';
                return false;
            }
            return true;
        }
        return false;
    },
    recordSuccess() {
        this.failures = 0;
        this.state = 'CLOSED';
    },
    recordFailure() {
        this.failures++;
        this.lastFailure = Date.now();
        if (this.failures >= this.THRESHOLD) {
            this.state = 'OPEN';
            console.warn(`[AEGIS] Circuit breaker OPEN after ${this.failures} failures`);
        }
    },
};

class AegisService {
    constructor() {
        this.nftContract = null; // lazy-loaded
    }

    async getNFTContract() {
        if (!this.nftContract) {
            this.nftContract = await getSignedContract('BeZhasLogisticsNFT');
        }
        return this.nftContract;
    }

    /**
     * Valida la telemetría usando Aegis y luego Mintea el NFT Logístico
     */
    async processTelemetryAndTokenize(enterpriseWallet, containerId, telemetryData) {
        console.log(`\n🤖 [AEGIS] Telemetría del contenedor ${containerId}`);

        // 1. Validar telemetría con Aegis Python Core (Circuit Breaker protected)
        let aegisApproval = false;
        let aegisScore = null;
        let usedFallback = false;

        if (circuitBreaker.isOpen()) {
            // Circuit open — reject immediately, do NOT allow fallback bypass
            console.warn('[AEGIS] Circuit breaker OPEN — rejecting telemetry until Aegis recovers');
            // No se ancla: el circuito abierto significa que NO SABEMOS, no que
            // haya una amenaza. Ver aegisOnChain.levelFor().
            await aegisOnChain.signalRejection({
                containerId, wallet: enterpriseWallet, reason: 'circuit_open',
            }).catch(() => {});
            return { success: false, reason: 'AEGIS AI temporarily unavailable. Retry later.' };
        }

        try {
            const aegisResponse = await axios.post(`${AEGIS_URL}/validate`, {
                container_id: containerId,
                telemetry: telemetryData
            }, { timeout: 5000 });

            if (aegisResponse.data.approved) {
                aegisApproval = true;
                aegisScore = aegisResponse.data.score || null;
            }
            circuitBreaker.recordSuccess();
        } catch (err) {
            circuitBreaker.recordFailure();
            // Fallback: stricter range check (cold-chain only)
            const t = telemetryData.temperature;
            const h = telemetryData.humidity;
            aegisApproval = (
                typeof t === 'number' && t >= -20 && t <= -15 &&
                typeof h === 'number' && h >= 0 && h <= 100
            );
            usedFallback = true;
            console.warn("[AEGIS] AI Core offline, using strict fallback validation:", err.message);
        }

        // Log the AI decision to DB
        await query(
            `INSERT INTO ai_logs (module, action, severity, input_data, output_data, confidence) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                'anomaly_detector',
                'telemetry_validate',
                'info',
                JSON.stringify({ walletAddress: enterpriseWallet, containerId, telemetryData }),
                JSON.stringify({ approved: aegisApproval, fallback: usedFallback }),
                aegisScore,
            ]
        );

        if (!aegisApproval) {
            // Deja constancia EN CADENA de que rechazamos. Hasta ahora este
            // hecho vivía sólo en `ai_logs` — una tabla nuestra, editable por
            // nosotros — y es justo el que hay que sostener después ante una
            // aseguradora. Best-effort: si la cadena no está, el rechazo sigue
            // siendo válido; lo que se pierde es la prueba independiente.
            const signal = await aegisOnChain.signalRejection({
                containerId, wallet: enterpriseWallet,
                reason: 'telemetry_rejected', score: aegisScore, usedFallback,
            }).catch((err) => ({ signalled: false, mode: 'signal_error', error: err.message }));

            return {
                success: false,
                reason: 'Telemetry rejected by AEGIS AI. Temperature out of range.',
                signal,
            };
        }
        console.log(`✅ [AEGIS] Telemetría APROBADA.`);

        // 2. Log telemetry to DB
        await query(
            `INSERT INTO telemetry_logs (edge_node, shipment_id, temperature, humidity, gps_lat, gps_lng, ai_verdict)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                enterpriseWallet, containerId,
                telemetryData.temperature, telemetryData.humidity,
                telemetryData.gps_lat || null, telemetryData.gps_lng || null,
                'approved'
            ]
        );

        // 3. Mint the Logistics NFT on-chain
        console.log(`🛠️ [AEGIS] Minteando NFT para ${containerId}...`);
        try {
            const nft = await this.getNFTContract();

            // Build ERC-721 metadata and pin to IPFS (Pinata)
            let metadataUri;
            try {
                const metadata = buildLogisticsMetadata(containerId, telemetryData, {
                    image: `https://bez.digital/nft/logistics/${containerId}.png`,
                });
                const pinResult = await pinJSON(metadata, `logistics-${containerId}`);
                metadataUri = pinResult.ipfsUri;
                console.log(`📌 [IPFS] Metadata pinned: ${metadataUri}`);
            } catch (ipfsErr) {
                // Fallback: on-chain reference URI when Pinata is unreachable or unconfigured
                metadataUri = `https://api.bez.digital/nft/metadata/${containerId}`;
                console.warn(`[IPFS] Pin failed, using fallback URI: ${ipfsErr.message}`);
            }

            const tx = await nft.safeMint(enterpriseWallet, metadataUri, containerId);
            const record = await watchTx(tx.hash, {
                contract: 'BeZhasLogisticsNFT',
                method: 'safeMint',
            });

            console.log(`✅ [AEGIS] NFT minteado. TX: ${record.tx_hash}`);
            await publish('event:aegis:minted', { containerId, txHash: record.tx_hash });

            return {
                success: true,
                message: 'Telemetry validated and NFT minted',
                txHash: record.tx_hash,
                metadataUri,
                blockNumber: record.block_number,
            };
        } catch (mintError) {
            console.error(`❌ [AEGIS] Mint failed:`, mintError.message);
            return { success: false, reason: `NFT mint failed: ${mintError.message}` };
        }
    }
}

module.exports = new AegisService();
