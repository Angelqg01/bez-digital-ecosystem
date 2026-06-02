const { Queue, Worker } = require('bullmq');
const mongoose = require('mongoose');
const ethers = require('ethers');
const UnifiedAI = require('../unified-ai.service');
const alertSystem = require('../alert-system.service');
const User = require('../../models/pg/User');
const Transaction = require('../../models/pg/Transaction');
const Post = require('../../models/post.model');
const fs = require('fs').promises;
const path = require('path');
const skillAutomator = require('./skillAutomator.service');

// ===================================
// 1. CONFIGURACIÓN DEL SISTEMA
// ===================================

const provider = new ethers.JsonRpcProvider(process.env.AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology');

let tokenContract = null;
if (process.env.BEZCOIN_CONTRACT_ADDRESS) {
    tokenContract = new ethers.Contract(
        process.env.BEZCOIN_CONTRACT_ADDRESS,
        ['function balanceOf(address) view returns (uint256)', 'event Transfer(address indexed from, address indexed to, uint256 value)'],
        provider
    );
}

// Cola de diagnósticos — SOLO si Redis disponible
let diagnosticQueue = null;
const BULLMQ_FORCE_DISABLED_DIAG = ['true', '1'].includes((process.env.DISABLE_BULLMQ || '').toLowerCase());
const REDIS_AVAILABLE = !!process.env.REDIS_URL && !BULLMQ_FORCE_DISABLED_DIAG;
if (REDIS_AVAILABLE) {
    try {
        diagnosticQueue = new Queue('diagnostic-agent', {
            connection: {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                maxRetriesPerRequest: null,
                retryStrategy: (times) => times > 3 ? null : Math.min(times * 500, 3000),
            }
        });
    } catch (e) {
        console.warn('⚠️ Diagnostic queue disabled:', e.message);
    }
} else {
    console.info('ℹ️ REDIS_URL not set — diagnostic queue disabled');
}

// ===================================
// 2. MODELOS DE DATOS
// ===================================

// Esquema para Logs de Diagnóstico
const DiagnosticLogSchema = new mongoose.Schema({
    category: {
        type: String,
        enum: ['blockchain', 'database', 'payment', 'content', 'system', 'bridge'],
        required: true
    },
    severity: {
        type: String,
        enum: ['info', 'warning', 'error', 'critical'],
        default: 'info'
    },
    issue: String,
    affectedEntity: {
        entityType: String,
        entityId: mongoose.Schema.Types.ObjectId
    },
    diagnosticData: mongoose.Schema.Types.Mixed,
    aiAnalysis: String,
    autoResolvedStatus: {
        attempted: { type: Boolean, default: false },
        success: { type: Boolean, default: false },
        resolution: String
    },
    createdAt: { type: Date, default: Date.now, index: true }
});

const DiagnosticLog = mongoose.model('DiagnosticLog', DiagnosticLogSchema);

// Esquema para Reportes de Mantenimiento
const MaintenanceReportSchema = new mongoose.Schema({
    summary: String,
    healthScore: { type: Number, min: 0, max: 100 },
    checksPerformed: {
        blockchain: Number,
        database: Number,
        payments: Number,
        content: Number
    },
    issuesDetected: Number,
    issuesResolved: Number,
    recommendations: [String],
    detailedFindings: mongoose.Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now, index: true }
});

const MaintenanceReport = mongoose.model('MaintenanceReport', MaintenanceReportSchema);

// ===================================
// 3. HERRAMIENTAS DE DIAGNÓSTICO
// ===================================

class DiagnosticTools {
    static async verifyBlockchainTransaction(txHash, expectedAmount, userWallet) {
        try {
            console.log(`🔍 Verificando transacción: ${txHash}`);

            if (!tokenContract) {
                return { exists: false, issue: 'Token contract not configured' };
            }

            const tx = await provider.getTransaction(txHash);

            if (!tx) {
                return {
                    exists: false,
                    issue: 'Transaction not found on blockchain',
                    recommendation: 'User may have provided incorrect hash'
                };
            }

            const receipt = await provider.getTransactionReceipt(txHash);

            if (receipt.status === 0) {
                return {
                    exists: true,
                    success: false,
                    issue: 'Transaction reverted on blockchain',
                    blockNumber: receipt.blockNumber,
                    recommendation: 'Check gas limits and contract logic'
                };
            }

            return {
                exists: true,
                success: true,
                blockNumber: receipt.blockNumber,
                issue: null,
                recommendation: 'Transaction confirmed successfully'
            };

        } catch (error) {
            console.error('❌ Error verifying blockchain tx:', error);
            return {
                exists: false,
                error: error.message,
                recommendation: 'RPC endpoint may be down or network congestion'
            };
        }
    }

    static async diagnoseCreditMismatch(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                return { error: 'User not found' };
            }

            const dbBalance = user.credits || 0;
            let blockchainBalance = 0;

            if (user.walletAddress && tokenContract) {
                const balance = await tokenContract.balanceOf(user.walletAddress);
                blockchainBalance = parseFloat(ethers.formatUnits(balance, 18));
            }

            const discrepancy = Math.abs(blockchainBalance - dbBalance);

            return {
                userId: user._id,
                username: user.username || 'Unknown',
                dbBalance,
                blockchainBalance,
                discrepancy,
                hasIssue: discrepancy > 1,
                recommendation: discrepancy > 1
                    ? 'Force sync: Update DB to match blockchain balance'
                    : 'Balances are aligned'
            };

        } catch (error) {
            return { error: error.message };
        }
    }

    static async analyzeErrorPatterns() {
        const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const recentErrors = await DiagnosticLog.find({
            severity: { $in: ['error', 'critical'] },
            createdAt: { $gte: last24Hours }
        });

        const errorsByCategory = recentErrors.reduce((acc, log) => {
            acc[log.category] = (acc[log.category] || 0) + 1;
            return acc;
        }, {});

        return {
            totalErrors: recentErrors.length,
            errorsByCategory,
            criticalCount: recentErrors.filter(e => e.severity === 'critical').length,
            needsAttention: recentErrors.length > 10
        };
    }

    static async generateHealthScore() {
        const [
            totalUsers,
            recentErrors,
            pendingTransactions,
            activeContent
        ] = await Promise.all([
            User.countDocuments().catch(() => 0),
            DiagnosticLog.countDocuments({
                severity: { $in: ['error', 'critical'] },
                createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            }).catch(() => 0),
            Transaction.countDocuments({ status: 'pending' }).catch(() => 0),
            Post.countDocuments({
                createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
            }).catch(() => 0)
        ]);

        let healthScore = 100;
        healthScore -= Math.min(recentErrors * 5, 40);
        healthScore -= Math.min(pendingTransactions * 2, 20);
        if (activeContent > 100) healthScore = Math.min(healthScore + 5, 100);

        const result = {
            score: Math.max(healthScore, 0),
            metrics: {
                totalUsers,
                recentErrors,
                pendingTransactions,
                activeContent
            },
            status: healthScore > 80 ? 'healthy' : healthScore > 50 ? 'warning' : 'critical'
        };

        // Enviar alerta si health score está bajo
        if (healthScore < 60) {
            const details = {
                database: true, // Simplificado, mejorar con checks reales
                redis: true,
                blockchain: tokenContract !== null,
                api: true,
                recommendations: [
                    recentErrors > 10 ? `Revisar ${recentErrors} errores recientes` : null,
                    pendingTransactions > 5 ? `Procesar ${pendingTransactions} transacciones pendientes` : null
                ].filter(Boolean)
            };

            try {
                await alertSystem.sendHealthAlert(healthScore, details);
            } catch (err) {
                console.error('Failed to send health alert:', err.message);
            }
        }

        return result;
    }

    /**
     * Diagnose Universal Bridge Adapters
     * Checks if third-party adapters (Airbnb, Maersk, Vinted) are healthy
     */
    static async verifyBridgeConnectivity() {
        const { getAvailableAdapters, createAdapter } = require('../../bridge/adapters');
        const adapters = getAvailableAdapters();
        const results = [];

        for (const platformId of adapters) {
            try {
                // Instanciar un adaptador de prueba (con config vacía o mock)
                const adapter = createAdapter(platformId, { isHealthCheck: true });
                
                // Si el adaptador tiene un método verifyHealth, lo usamos
                const isHealthy = adapter.verifyHealth ? await adapter.verifyHealth() : true;
                
                results.push({
                    platform: platformId,
                    status: isHealthy ? 'healthy' : 'degraded',
                    latency: 0 // TODO: medir latencia real
                });
            } catch (err) {
                results.push({
                    platform: platformId,
                    status: 'error',
                    error: err.message
                });
            }
        }

        const degradedCount = results.filter(r => r.status !== 'healthy').length;

        return {
            totalAdapters: adapters.length,
            results,
            hasIssue: degradedCount > 0,
            issueCount: degradedCount,
            recommendation: degradedCount > 0 ? 'Review API keys and platform status' : 'All bridges online'
        };
    }
}

// ===================================
// 4. ACCIONES DE AUTO-RECUPERACIÓN
// ===================================

class AutoRecoveryActions {
    static async forceSyncUserBalance(userId) {
        try {
            const user = await User.findById(userId);
            if (!user || !user.walletAddress || !tokenContract) {
                return { success: false, reason: 'User has no wallet or contract not configured' };
            }

            const balance = await tokenContract.balanceOf(user.walletAddress);
            const blockchainBalance = parseFloat(ethers.formatUnits(balance, 18));

            const oldBalance = user.credits;
            user.credits = blockchainBalance;
            await user.save();

            await DiagnosticLog.create({
                category: 'database',
                severity: 'info',
                issue: 'Balance mismatch auto-resolved',
                affectedEntity: { entityType: 'user', entityId: userId },
                autoResolvedStatus: {
                    attempted: true,
                    success: true,
                    resolution: `Updated DB balance from ${oldBalance} to ${blockchainBalance} BEZ`
                }
            });

            // Enviar alerta de sincronización exitosa
            try {
                await alertSystem.sendSyncSuccess(userId, blockchainBalance);
            } catch (err) {
                console.error('Failed to send sync alert:', err.message);
            }

            // Registrar en SkillAutomator para aprendizaje IA
            await skillAutomator.registerOptimization({
                area: 'database',
                before: `User ${userId} balance mismatch (${oldBalance} BEZ)`,
                after: `Synced with blockchain (${blockchainBalance} BEZ)`,
                impact: 'Resolved discrepancy between on-chain and off-chain data'
            });

            return {
                success: true,
                oldBalance,
                newBalance: blockchainBalance
            };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async retryFailedTransaction(transactionId) {
        try {
            const transaction = await Transaction.findById(transactionId);
            if (!transaction || transaction.status !== 'failed') {
                return { success: false, reason: 'Transaction not eligible for retry' };
            }

            transaction.status = 'pending';
            transaction.retryCount = (transaction.retryCount || 0) + 1;
            await transaction.save();

            return { success: true, retriesAttempted: transaction.retryCount };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

// ===================================
// 5. WORKER DE DIAGNÓSTICO
// ===================================

let diagnosticWorker = null;
if (REDIS_AVAILABLE) {
    try {
        diagnosticWorker = new Worker('diagnostic-agent', async job => {
            const { action, data } = job.data;

            console.log(`🤖 Diagnostic Agent executing: ${action}`);

            switch (action) {
                case 'verify_transaction': {
                    const result = await DiagnosticTools.verifyBlockchainTransaction(
                        data.txHash,
                        data.expectedAmount,
                        data.userWallet
                    );

                    if (result.issue) {
                        await DiagnosticLog.create({
                            category: 'blockchain',
                            severity: result.exists ? 'warning' : 'error',
                            issue: result.issue,
                            diagnosticData: result,
                            affectedEntity: { entityType: 'transaction', entityId: data.transactionId }
                        });
                    }

                    return result;
                }

                case 'diagnose_credit_mismatch': {
                    const diagnosis = await DiagnosticTools.diagnoseCreditMismatch(data.userId);

                    if (diagnosis.hasIssue) {
                        const recovery = await AutoRecoveryActions.forceSyncUserBalance(data.userId);
                        return { diagnosis, recovery };
                    }

                    return { diagnosis, recovery: { notNeeded: true } };
                }

                case 'analyze_system_health': {
                    const health = await DiagnosticTools.generateHealthScore();
                    const errorPatterns = await DiagnosticTools.analyzeErrorPatterns();
                    const bridgeStatus = await DiagnosticTools.verifyBridgeConnectivity();

                    const aiPrompt = `
                        Actúa como SRE de BeZhas. Analiza estos datos del sistema:
                        
                        Health Score: ${health.score}/100
                        Estado: ${health.status}
                        Puente Universal: ${bridgeStatus.issueCount} incidentes en ${bridgeStatus.totalAdapters} adaptadores.
                        Errores recientes: ${errorPatterns.totalErrors}
                        
                        Puentes degradados: ${bridgeStatus.results.filter(r => r.status !== 'healthy').map(r => r.platform).join(', ')}
                        
                        Provee:
                        1. Diagnóstico ejecutivo (2 líneas)
                        2. Top 3 recomendaciones (prioriza el puente si fallan)
                        3. Predicción de estabilidad para próximas 48h
                    `;

                    const aiAnalysis = await UnifiedAI.generateContent(aiPrompt);

                    await MaintenanceReport.create({
                        summary: aiAnalysis,
                        healthScore: health.score,
                        checksPerformed: { blockchain: 1, database: 1, payments: 1, content: 1, bridge: 1 },
                        issuesDetected: errorPatterns.totalErrors + bridgeStatus.issueCount,
                        issuesResolved: 0,
                        recommendations: bridgeStatus.hasIssue 
                            ? [`Review ${bridgeStatus.issueCount} bridge issues`, ...health.metrics.pendingTransactions > 5 ? ['Check txs'] : []]
                            : ['Check logs', 'Monitor blockchain sync'],
                        detailedFindings: { health, errorPatterns, bridgeStatus }
                    });

                    return { health, errorPatterns, bridgeStatus, aiAnalysis };
                }

                case 'nightly_maintenance': {
                    console.log('🌙 Iniciando mantenimiento nocturno automático...');

                    const health = await DiagnosticTools.generateHealthScore();
                    const errorPatterns = await DiagnosticTools.analyzeErrorPatterns();

                    const users = await User.find({ walletAddress: { $exists: true, $ne: null } }).limit(100);
                    let syncedUsers = 0;

                    for (const user of users) {
                        const diagnosis = await DiagnosticTools.diagnoseCreditMismatch(user._id);
                        if (diagnosis.hasIssue) {
                            await AutoRecoveryActions.forceSyncUserBalance(user._id);
                            syncedUsers++;
                        }
                    }

                    const aiPrompt = `
                        Reporte de Mantenimiento Nocturno - BeZhas
                        
                        Health Score: ${health.score}/100
                        Usuarios sincronizados: ${syncedUsers}
                        Errores detectados (24h): ${errorPatterns.totalErrors}
                        
                        Genera un informe ejecutivo para el administrador incluyendo:
                        1. Estado general del sistema
                        2. Acciones correctivas tomadas automáticamente
                        3. Recomendaciones para mañana
                        4. Predicción de carga para la próxima semana
                    `;

                    const aiReport = await UnifiedAI.generateContent(aiPrompt);

                    const report = await MaintenanceReport.create({
                        summary: aiReport,
                        healthScore: health.score,
                        checksPerformed: {
                            blockchain: users.length,
                            database: users.length,
                            payments: 0,
                            content: health.metrics.activeContent
                        },
                        issuesDetected: errorPatterns.totalErrors,
                        issuesResolved: syncedUsers,
                        recommendations: ['Monitor blockchain sync', 'Check critical errors'],
                        detailedFindings: { health, errorPatterns, syncedUsers }
                    });

                    const reportPath = path.join(__dirname, '../../../REPORTS/MAINTENANCE');
                    await fs.mkdir(reportPath, { recursive: true });

                    const filename = `maintenance_${new Date().toISOString().split('T')[0]}.md`;
                    await fs.writeFile(
                        path.join(reportPath, filename),
                        `# Reporte de Mantenimiento - ${new Date().toLocaleDateString()}\n\n${aiReport}`
                    );

                    console.log(`✅ Mantenimiento completado. Reporte guardado: ${filename}`);

                    // Guardar snapshot de configuración actual como parte del mantenimiento
                    await skillAutomator.snapshotConfig();

                    return { report, syncedUsers, filename };
                }

                default:
                    throw new Error(`Unknown diagnostic action: ${action}`);
            }
        }, {
            connection: {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                maxRetriesPerRequest: null,
                retryStrategy: (times) => times > 3 ? null : Math.min(times * 500, 3000),
            }
        });
        console.log('✅ Diagnostic worker initialized');
    } catch (e) {
        console.warn('⚠️ Diagnostic worker disabled:', e.message);
    }
}

// ===================================
// 6. API PÚBLICA DEL SERVICIO
// ===================================

// Helper: safely add to queue or return error
const safeQueueAdd = async (name, data) => {
    if (!diagnosticQueue) {
        console.warn(`⚠️ Diagnostic queue unavailable — skipping ${name}`);
        return { queued: false, reason: 'Redis unavailable' };
    }
    return await diagnosticQueue.add(name, data);
};

module.exports = {
    DiagnosticLog,
    MaintenanceReport,
    DiagnosticTools,
    AutoRecoveryActions,
    diagnosticQueue,
    diagnosticWorker,

    async diagnoseTransaction(txHash, expectedAmount, userWallet, transactionId) {
        return await safeQueueAdd('verify_transaction', {
            action: 'verify_transaction',
            data: { txHash, expectedAmount, userWallet, transactionId }
        });
    },

    async diagnoseCreditIssue(userId) {
        return await safeQueueAdd('diagnose_credit_mismatch', {
            action: 'diagnose_credit_mismatch',
            data: { userId }
        });
    },

    async analyzeSystemHealth() {
        return await safeQueueAdd('analyze_system_health', {
            action: 'analyze_system_health',
            data: {}
        });
    },

    async runNightlyMaintenance() {
        return await safeQueueAdd('nightly_maintenance', {
            action: 'nightly_maintenance',
            data: {}
        });
    }
};
