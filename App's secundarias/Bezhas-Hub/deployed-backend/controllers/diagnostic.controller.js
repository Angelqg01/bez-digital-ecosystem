const DiagnosticService = require('../services/automation/diagnosticAgent.service');

class DiagnosticController {
    async diagnoseTransaction(req, res) {
        try {
            const { txHash, expectedAmount, userWallet, transactionId } = req.body;

            if (!txHash || !expectedAmount || !userWallet) {
                return res.status(400).json({
                    error: 'Missing required fields: txHash, expectedAmount, userWallet'
                });
            }

            const job = await DiagnosticService.diagnoseTransaction(
                txHash,
                expectedAmount,
                userWallet,
                transactionId
            );

            const result = await job.waitUntilFinished(
                DiagnosticService.diagnosticQueue.events,
                30000
            );

            res.json({
                success: true,
                diagnosis: result,
                jobId: job.id
            });

        } catch (error) {
            console.error('❌ Error in transaction diagnosis:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async diagnoseCreditIssue(req, res) {
        try {
            const { userId } = req.params;

            const job = await DiagnosticService.diagnoseCreditIssue(userId);
            const result = await job.waitUntilFinished(
                DiagnosticService.diagnosticQueue.events,
                30000
            );

            res.json({
                success: true,
                diagnosis: result.diagnosis,
                recovery: result.recovery,
                jobId: job.id
            });

        } catch (error) {
            console.error('❌ Error in credit diagnosis:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async getSystemHealth(req, res) {
        try {
            const job = await DiagnosticService.analyzeSystemHealth();
            const result = await job.waitUntilFinished(
                DiagnosticService.diagnosticQueue.events,
                30000
            );

            res.json({
                success: true,
                health: result.health,
                errorPatterns: result.errorPatterns,
                aiAnalysis: result.aiAnalysis
            });

        } catch (error) {
            console.error('❌ Error in health check:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async getMaintenanceReports(req, res) {
        try {
            const { limit = 10 } = req.query;

            const reports = await DiagnosticService.MaintenanceReport
                .find()
                .sort({ createdAt: -1 })
                .limit(parseInt(limit));

            res.json({
                success: true,
                count: reports.length,
                reports
            });

        } catch (error) {
            console.error('❌ Error fetching reports:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async getDiagnosticLogs(req, res) {
        try {
            const { category, severity, limit = 50 } = req.query;

            const filter = {};
            if (category) filter.category = category;
            if (severity) filter.severity = severity;

            const logs = await DiagnosticService.DiagnosticLog
                .find(filter)
                .sort({ createdAt: -1 })
                .limit(parseInt(limit));

            res.json({
                success: true,
                count: logs.length,
                logs
            });

        } catch (error) {
            console.error('❌ Error fetching logs:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async runManualMaintenance(req, res) {
        try {
            const job = await DiagnosticService.runNightlyMaintenance();

            res.json({
                success: true,
                message: 'Maintenance job scheduled',
                jobId: job.id
            });

        } catch (error) {
            console.error('❌ Error starting maintenance:', error);
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new DiagnosticController();
