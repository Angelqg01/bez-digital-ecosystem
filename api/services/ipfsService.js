const axios = require('axios');
const FormData = require('form-data');

/**
 * IPFS Service — uploads metadata to Pinata (or compatible IPFS gateway).
 *
 * Env vars:
 *   PINATA_JWT          — Pinata v2 JWT bearer token (preferred)
 *   PINATA_API_KEY      — Pinata v1 API key (fallback)
 *   PINATA_API_SECRET   — Pinata v1 secret (fallback)
 *   IPFS_GATEWAY_URL    — Public gateway for reads (default: https://gateway.pinata.cloud/ipfs)
 */

const PINATA_BASE = 'https://api.pinata.cloud';
const GATEWAY_URL = process.env.IPFS_GATEWAY_URL || 'https://gateway.pinata.cloud/ipfs';

function getAuthHeaders() {
    const jwt = process.env.PINATA_JWT;
    if (jwt) {
        return { Authorization: `Bearer ${jwt}` };
    }
    const key = process.env.PINATA_API_KEY;
    const secret = process.env.PINATA_API_SECRET;
    if (key && secret) {
        return { pinata_api_key: key, pinata_secret_api_key: secret };
    }
    return null;
}

/**
 * Upload JSON metadata to IPFS via Pinata's pinJSONToIPFS endpoint.
 * @param {object} metadata — JSON object to pin
 * @param {string} name — Human-readable pin name for Pinata dashboard
 * @returns {{ ipfsHash: string, ipfsUri: string, gatewayUrl: string }}
 */
async function pinJSON(metadata, name = 'bezhas-metadata') {
    const headers = getAuthHeaders();
    if (!headers) {
        throw new Error('IPFS: No Pinata credentials configured (set PINATA_JWT or PINATA_API_KEY + PINATA_API_SECRET)');
    }

    const response = await axios.post(
        `${PINATA_BASE}/pinning/pinJSONToIPFS`,
        {
            pinataContent: metadata,
            pinataMetadata: { name },
        },
        { headers, timeout: 30000 },
    );

    const hash = response.data.IpfsHash;
    return {
        ipfsHash: hash,
        ipfsUri: `ipfs://${hash}`,
        gatewayUrl: `${GATEWAY_URL}/${hash}`,
    };
}

/**
 * Upload a file buffer to IPFS via Pinata's pinFileToIPFS endpoint.
 * @param {Buffer} buffer — raw file bytes
 * @param {string} filename — original file name
 * @returns {{ ipfsHash: string, ipfsUri: string, gatewayUrl: string }}
 */
async function pinFile(buffer, filename = 'file') {
    const headers = getAuthHeaders();
    if (!headers) {
        throw new Error('IPFS: No Pinata credentials configured');
    }

    const form = new FormData();
    form.append('file', buffer, { filename });
    form.append('pinataMetadata', JSON.stringify({ name: filename }));

    const response = await axios.post(
        `${PINATA_BASE}/pinning/pinFileToIPFS`,
        form,
        { headers: { ...headers, ...form.getHeaders() }, timeout: 60000, maxBodyLength: Infinity },
    );

    const hash = response.data.IpfsHash;
    return {
        ipfsHash: hash,
        ipfsUri: `ipfs://${hash}`,
        gatewayUrl: `${GATEWAY_URL}/${hash}`,
    };
}

/**
 * Build standard NFT metadata (ERC-721 Metadata JSON Schema) for a logistics shipment.
 */
function buildLogisticsMetadata(containerId, telemetry, extra = {}) {
    return {
        name: `BeZhas Logistics — ${containerId}`,
        description: `Verified shipment NFT for container ${containerId}. Telemetry validated by Aegis AI.`,
        external_url: `https://bez.digital/shipment/${containerId}`,
        attributes: [
            { trait_type: 'Container ID', value: containerId },
            { trait_type: 'Temperature (°C)', value: telemetry.temperature, display_type: 'number' },
            { trait_type: 'Humidity (%)', value: telemetry.humidity, display_type: 'number' },
            ...(telemetry.gps_lat ? [{ trait_type: 'GPS Latitude', value: telemetry.gps_lat }] : []),
            ...(telemetry.gps_lng ? [{ trait_type: 'GPS Longitude', value: telemetry.gps_lng }] : []),
            { trait_type: 'Validated At', value: new Date().toISOString() },
            { trait_type: 'AI Engine', value: 'Aegis v2' },
        ],
        ...extra,
    };
}

module.exports = { pinJSON, pinFile, buildLogisticsMetadata, GATEWAY_URL };
