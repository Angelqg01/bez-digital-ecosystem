const express = require('express');
const router = express.Router();
const diagnosticController = require('../controllers/diagnostic.controller');
const { verifyAdminToken } = require('../middleware/admin.middleware');

// Rutas protegidas con autenticación admin
router.post('/transaction', verifyAdminToken, diagnosticController.diagnoseTransaction);
router.post('/credits/:userId', verifyAdminToken, diagnosticController.diagnoseCreditIssue);
router.get('/health', verifyAdminToken, diagnosticController.getSystemHealth);
router.get('/reports', verifyAdminToken, diagnosticController.getMaintenanceReports);
router.get('/logs', verifyAdminToken, diagnosticController.getDiagnosticLogs);
router.post('/manual-maintenance', verifyAdminToken, diagnosticController.runManualMaintenance);

module.exports = router;
