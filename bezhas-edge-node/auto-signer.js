const { ethers } = require('ethers');
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const axios = require('axios');

// Dynamically resolve the local SDK path (graceful if unavailable in container)
let MCPClient = null;
let getABI = null;
let ESCROW_ABI = [];

try {
    const sdkPath = path.resolve(__dirname, '../sdk/mcp-integration');
    MCPClient = require(sdkPath);
} catch {
    console.warn('⚠️ SDK mcp-integration not available — MCP verification disabled');
    MCPClient = class NoopMCP { async connect() { return { success: false }; } };
}

try {
    const contractsSdk = require(path.resolve(__dirname, '../sdk/contracts'));
    getABI = contractsSdk.getABI;
    ESCROW_ABI = getABI('QualityEscrow');
} catch {
    console.warn('⚠️ SDK contracts not available — using empty ABI');
    getABI = () => [];
}

// EdgeNodeRewards ABI — load from Foundry output
let EDGE_NODE_REWARDS_ABI = null;
try {
    const artifactPath = path.resolve(__dirname, '../smart-contracts/out/EdgeNodeRewards.sol/EdgeNodeRewards.json');
    if (fs.existsSync(artifactPath)) {
        const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));
        EDGE_NODE_REWARDS_ABI = artifact.abi;
    }
} catch (err) {
    console.warn('⚠️ EdgeNodeRewards ABI not found, contribution recording disabled');
}

// The address of the QualityEscrow / AI Smart Contract on your L2
const CONTRACT_ADDRESS = process.env.ESCROW_CONTRACT_ADDRESS || "0xYourQualityEscrowContractAddress";
const EDGE_NODE_REWARDS_ADDRESS = process.env.EDGE_NODE_REWARDS_ADDRESS || "";

// Control Center API — for HITL confirmation gate
const CONTROL_CENTER_API = process.env.API_URL || 'http://localhost:3001/api';
const EDGE_NODE_API_KEY  = process.env.EDGE_NODE_API_KEY  || '';

// Task type → points mapping (matches EdgeNodeRewards contract docs)
const TASK_POINTS = {
    'IoT Traceability': 5,
    'AI Image Verification': 10,
    'Compliance Check': 15,
    'Supply Chain Validation': 8,
    'Smart Contract Deploy': 20,
    'DAO Vote Participation': 3,
    'Enterprise Referral': 50,
    'default': 5
};

// ── Risk thresholds ───────────────────────────────────────────────────────────
// Transactions above this BEZ value require human confirmation from the dashboard.
const HITL_AMOUNT_THRESHOLD_BEZ = parseFloat(process.env.HITL_AMOUNT_THRESHOLD_BEZ || '1000');
// Time to wait for operator confirmation (default: 5 minutes)
const HITL_TIMEOUT_MS = parseInt(process.env.HITL_TIMEOUT_MS || '300000', 10);

/**
 * Request human confirmation from the Control Center for a high-risk operation.
 *
 * The Control Center's /api/agent/confirm endpoint stores the request
 * and waits for an admin to approve/reject via the dashboard.
 *
 * @param {object} payload - { operationType, contractAddress, params, estimatedValueBez }
 * @returns {Promise<boolean>} true = approved, false = rejected/timeout
 */
async function requestHumanConfirmation(payload) {
    if (!EDGE_NODE_API_KEY) {
        console.warn('⚠️ HITL: EDGE_NODE_API_KEY not set — skipping confirmation gate (auto-approve in dev mode)');
        return true;
    }

    console.log('\n🔐 HITL: Solicitando confirmación humana al Control Center...');
    console.log(`   Operación: ${payload.operationType}`);
    console.log(`   Valor estimado: ${payload.estimatedValueBez} BEZ`);
    console.log(`   Tiempo de espera: ${HITL_TIMEOUT_MS / 1000}s`);

    let requestId;
    try {
        // Register the pending confirmation request
        const resp = await axios.post(
            `${CONTROL_CENTER_API}/agent/edge-confirm`,
            {
                operationType: payload.operationType,
                contractAddress: payload.contractAddress,
                params: payload.params,
                estimatedValueBez: payload.estimatedValueBez,
                nodeId: process.env.EDGE_NODE_ID || 'edge-node-default',
                requestedAt: new Date().toISOString(),
            },
            {
                headers: { Authorization: `Bearer ${EDGE_NODE_API_KEY}` },
                timeout: 10000,
            }
        );
        requestId = resp.data?.requestId;
    } catch (err) {
        console.warn(`⚠️ HITL: No se pudo registrar la solicitud (${err.message}) — continuando sin gate`);
        return true; // Fail-open in connectivity issues to avoid halting the Edge Node indefinitely
    }

    // ── Poll for decision ──────────────────────────────────────────────────────
    const pollInterval = 5000; // 5s between polls
    const deadline = Date.now() + HITL_TIMEOUT_MS;

    console.log(`⏳ HITL: Esperando respuesta del operador... (RequestID: ${requestId})`);

    while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, pollInterval));
        try {
            const status = await axios.get(
                `${CONTROL_CENTER_API}/agent/edge-confirm/${requestId}`,
                { headers: { Authorization: `Bearer ${EDGE_NODE_API_KEY}` }, timeout: 5000 }
            );
            const decision = status.data?.decision;
            if (decision === 'approved') {
                console.log('✅ HITL: Operación APROBADA por el operador');
                return true;
            }
            if (decision === 'rejected') {
                console.log('❌ HITL: Operación RECHAZADA por el operador');
                return false;
            }
            // 'pending' — keep polling
        } catch (err) {
            // Transient network error — keep polling until deadline
            console.warn(`⚠️ HITL: Error de polling (${err.message}) — reintentando...`);
        }
    }

    // Timeout expired
    console.warn(`⏱️ HITL: Tiempo de confirmación agotado (${HITL_TIMEOUT_MS / 1000}s) — rechazando operación`);
    return false;
}

/**
 * Determine whether a given operation requires human confirmation.
 * Rules:
 *   - Always require if estimated value > HITL_AMOUNT_THRESHOLD_BEZ
 *   - Always require for deploy and bridge operations
 *   - Never require for read-only / DePIN reward recording
 */
function requiresHITL(operationType, estimatedValueBez = 0) {
    const highRiskTypes = ['smart-contract-deploy', 'bridge-payment', 'treasury-withdraw'];
    if (highRiskTypes.includes(operationType)) return true;
    if (estimatedValueBez >= HITL_AMOUNT_THRESHOLD_BEZ) return true;
    return false;
}

async function autoSignAndSend(containerId, temperature, statusString) {
    try {
        console.log(`\n================================`);
        console.log(`🤖 VERIFICACIÓN DE IA (MCP)`);
        console.log(`================================`);

        // 1. Initialize MCP Client to connect to the AI Engine Server
        const mcp = new MCPClient({ serverUrl: process.env.MCP_URL || 'http://localhost:3002' });
        const mcpConnected = await mcp.connect();

        let aiApproved = true;

        if (!mcpConnected.success) {
            console.warn("⚠️ Advertencia: No se pudo conectar al servidor IA MCP. Procediendo con validación estándar.");
        } else {
            // Call the AI Compliance Tool via SDK wrapper
            console.log(`🔍 Evaluando cumplimiento regulatorio para: ${containerId}`);
            const aiResponse = await mcp.verifyRegulatoryCompliance(
                containerId,
                parseInt(temperature),
                "Edge Node Checkpoint"
            );

            if (aiResponse.success) {
                const { approved, reason, confidence } = aiResponse.result;
                console.log(`🧠 Decisión de IA: ${approved ? '✅ APROBADO' : '❌ RECHAZADO'}`);
                console.log(`📝 Razón: ${reason} (Confianza: ${Math.round(confidence * 100)}%)`);

                if (!approved) {
                    throw new Error(`Intervención de IA: Transacción detenida. Razón: ${reason}`);
                }
                aiApproved = approved;
            } else {
                console.warn("⚠️ Fallo en la evaluación de la IA, ignorando guardia.");
            }
        }

        // 2. ── HITL Gate (Human-in-the-Loop) ──────────────────────────────────────
        //    Estimate value for the threshold check (IoT registration = low value)
        const estimatedValueBez = 0; // Sensor data registration has no direct BEZ movement
        const operationType = 'supply-chain-validation';

        if (requiresHITL(operationType, estimatedValueBez)) {
            const humanApproved = await requestHumanConfirmation({
                operationType,
                contractAddress: CONTRACT_ADDRESS,
                params: { containerId, temperature, statusString },
                estimatedValueBez,
            });

            if (!humanApproved) {
                throw new Error('HITL: Operación rechazada por el operador o timeout alcanzado');
            }
        }

        console.log(`\n================================`);
        console.log(`⚡ FIRMADOR BLOCKCHAIN ACTIVADO`);
        console.log(`================================`);

        // 3. Connect to the BeZhas L2 Network
        const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || "http://localhost:8545");

        // 4. Load the Wallet securely from environment
        const privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) throw new Error("PRIVATE_KEY is not set in environment");

        const wallet = new ethers.Wallet(privateKey, provider);
        console.log(`🔐 Signing with delegated wallet: ${wallet.address}`);

        // 5. Instantiate the Contract
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ESCROW_ABI, wallet);

        // 6. Construct and Send the Transaction
        console.log(`✉️ Sometiendo datos autorizados a QualityEscrow.sol [${containerId}]...`);
        const tx = await contract.registerSensorData(containerId, Math.round(temperature), statusString || "transit");

        console.log(`⏳ Esperando confirmación en L2 (Tx Hash: ${tx.hash})`);
        const receipt = await tx.wait();

        console.log(`✅ ¡Confirmado en bloque ${receipt.blockNumber}!`);

        // 7. Record contribution points in EdgeNodeRewards
        await recordContributionPoints(wallet, provider, 'Supply Chain Validation');

        return receipt;

    } catch (error) {
        console.error("🚨 Ejecución detenida:", error.message || error);
        throw error;
    }
}

/**
 * Records contribution points in EdgeNodeRewards contract after a successful validation.
 * Requires ORACLE_ROLE on the caller wallet.
 */
async function recordContributionPoints(wallet, provider, taskType = 'default') {
    if (!EDGE_NODE_REWARDS_ABI || !EDGE_NODE_REWARDS_ADDRESS) {
        return; // Silently skip if not configured
    }

    try {
        const points = TASK_POINTS[taskType] || TASK_POINTS['default'];
        const rewardsContract = new ethers.Contract(EDGE_NODE_REWARDS_ADDRESS, EDGE_NODE_REWARDS_ABI, wallet);

        console.log(`📊 Registrando ${points} puntos DePIN [${taskType}] en EdgeNodeRewards...`);
        const tx = await rewardsContract.recordValidation(wallet.address, points, taskType);
        const receipt = await tx.wait();
        console.log(`🏆 Puntos DePIN registrados en bloque ${receipt.blockNumber}`);
    } catch (err) {
        // Don't fail the main validation if reward recording fails
        console.warn(`⚠️ No se pudieron registrar puntos DePIN: ${err.message}`);
    }
}

module.exports = {
    autoSignAndSend,
    recordContributionPoints,
    requestHumanConfirmation,
    requiresHITL,
    TASK_POINTS
};
