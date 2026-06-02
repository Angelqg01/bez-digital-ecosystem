const { Queue, Worker } = require('bullmq');
const mongoose = require('mongoose');
const ethers = require('ethers');
const UnifiedAI = require('../unified-ai.service');
const alertSystem = require('../alert-system.service');
const User = require('../../models/user.model');
const Transaction = require('../../models/transaction.model');
const Post = require('../../models/post.model');
const fs = require('fs').promises;
const path = require('path');

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

// Cola de diagnósticos
const diagnosticQueue = new Queue('diagnostic-agent', {
    connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379
    }
});

// ===================================
// 2. MODELOS DE DATOS
// ===================================

// Esquema para Logs de Diagnóstico
const DiagnosticLogSchema = new mongoose.Schema({
    category: {
        type: String,
        enum: ['blockchain', 'database', 'payment', 'content', 'system'],
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

const diagnosticWorker = new Worker('diagnostic-agent', async job => {
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

            const aiPrompt = `
                Actúa como SRE de BeZhas. Analiza estos datos del sistema:
                
                Health Score: ${health.score}/100
                Estado: ${health.status}
                Errores recientes: ${errorPatterns.totalErrors}
                Errores críticos: ${errorPatterns.criticalCount}
                
                Métricas:
                - Usuarios: ${health.metrics.totalUsers}
                - Transacciones pendientes: ${health.metrics.pendingTransactions}
                - Contenido activo (7 días): ${health.metrics.activeContent}
                
                Provee:
                1. Diagnóstico ejecutivo (2 líneas)
                2. Top 3 recomendaciones
                3. Predicción de estabilidad para próximas 48h
            `;

            const aiAnalysis = await UnifiedAI.generateContent(aiPrompt);

            await MaintenanceReport.create({
                summary: aiAnalysis,
                healthScore: health.score,
                checksPerformed: {
                    blockchain: 1,
                    database: 1,
                    payments: 1,
                    content: 1
                },
                issuesDetected: errorPatterns.totalErrors,
                issuesResolved: 0,
                recommendations: ['Check logs', 'Monitor blockchain sync', 'Review pending transactions'],
                detailedFindings: { health, errorPatterns }
            });

            return { health, errorPatterns, aiAnalysis };
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

            return { report, syncedUsers, filename };
        }

        default:
            throw new Error(`Unknown diagnostic action: ${action}`);
    }
}, {
    connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379
    }
});

// ===================================
// 6. API PÚBLICA DEL SERVICIO
// ===================================

module.exports = {
    DiagnosticLog,
    MaintenanceReport,
    DiagnosticTools,
    AutoRecoveryActions,
    diagnosticQueue,
    diagnosticWorker,

    async diagnoseTransaction(txHash, expectedAmount, userWallet, transactionId) {
        return await diagnosticQueue.add('verify_transaction', {
            action: 'verify_transaction',
            data: { txHash, expectedAmount, userWallet, transactionId }
        });
    },

    async diagnoseCreditIssue(userId) {
        return await diagnosticQueue.add('diagnose_credit_mismatch', {
            action: 'diagnose_credit_mismatch',
            data: { userId }
        });
    },

    async analyzeSystemHealth() {
        return await diagnosticQueue.add('analyze_system_health', {
            action: 'analyze_system_health',
            data: {}
        });
    },

    async runNightlyMaintenance() {
        return await diagnosticQueue.add('nightly_maintenance', {
            action: 'nightly_maintenance',
            data: {}
        });
    }
};
