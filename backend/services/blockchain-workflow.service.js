/**
 * ============================================================================
 * BeZhas Blockchain Workflow Sync Service
 * ============================================================================
 */

const Workflow = require('../models/pg/Workflow');
const logger = require('../utils/logger');
const path = require('path');

// Cargamos el SDK de la carpeta de Blockchain
const BeZhasSDK = require(path.join('d:/Documentos D/Documentos Yoe/BeZhas/BeZhas Blockchain/sdk/index.js'));

class BlockchainWorkflowService {
    constructor() {
        this.sdk = new BeZhasSDK({
            network: process.env.BEZHAS_NETWORK || 'testnet',
            apiUrl: process.env.BEZHAS_API_URL
        });
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;
        
        // Carga de clave privada del administrador para firmar transacciones on-chain
        const adminKey = process.env.WORKFLOW_ADMIN_KEY;
        if (adminKey) {
            await this.sdk.connectWithPrivateKey(adminKey);
        }
        
        this.isInitialized = true;
        logger.info('🔗 Blockchain Workflow Service Initialized');
    }

    /**
     * Sincroniza un workflow local con la blockchain
     */
    async syncToChain(workflowId) {
        try {
            const workflow = await Workflow.findById(workflowId);
            if (!workflow) throw new Error('Workflow not found');

            logger.info({ workflowId: workflow._name }, '⛓️ Registering workflow on-chain...');

            // Hasheamos el contenido para integridad
            const contentHash = this.sdk.utils.keccak256(JSON.stringify(workflow.steps));

            // Llamada al nuevo contrato BeZhasWorkflowRegistry
            const tx = await this.sdk.contracts.WorkflowRegistry.registerWorkflow(
                workflow.name,
                contentHash
            );

            // Actualizamos la base de datos con el hash y el ID on-chain
            workflow.blockchain = {
                onChainId: tx.id, // Suponiendo que el contrato devuelve el ID en el evento
                txHash: tx.hash,
                isVerified: true,
                contractAddress: this.sdk.contracts.WorkflowRegistry.address
            };

            await workflow.save();
            logger.info(`✅ Workflow ${workflow.name} verificado on-chain (Tx: ${tx.hash})`);
            
            return tx;
        } catch (error) {
            logger.error({ error }, 'Sync to chain failed');
            throw error;
        }
    }

    /**
     * Registra una ejecución de workflow on-chain (Prueba de Ejecución)
     */
    async recordRunOnChain(workflowId, runId, runResults) {
        try {
            const workflow = await Workflow.findById(workflowId);
            if (!workflow?.blockchain?.onChainId) return;

            const runHash = this.sdk.utils.keccak256(JSON.stringify(runResults));

            const tx = await this.sdk.contracts.WorkflowRegistry.recordExecution(
                workflow.blockchain.onChainId,
                runHash
            );

            logger.info(`📝 Ejecución ${runId} persistida en la blockchain propia de BeZhas.`);
        } catch (error) {
            logger.warn({ error }, 'Could not record run on-chain. Continuing anyway.');
        }
    }
}

module.exports = new BlockchainWorkflowService();
