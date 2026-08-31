const { Router } = require('express');
const verifyAdminJWT = require('../middleware/verifyAdminJWT');
const sdkAdminCtrl = require('../controllers/sdkAdmin.controller');

const router = Router();

// All SDK admin routes require admin authentication
router.use(verifyAdminJWT);

// ── Global Config ──
router.get('/overview', sdkAdminCtrl.getOverview);
router.get('/config', sdkAdminCtrl.getFullConfig);
router.patch('/config', sdkAdminCtrl.updateGlobalSettings);

// ── Modules ──
router.get('/modules', sdkAdminCtrl.getModules);
router.get('/modules/:moduleId', sdkAdminCtrl.getModule);
router.patch('/modules/:moduleId', sdkAdminCtrl.updateModule);
router.patch('/modules/:moduleId/toggle', sdkAdminCtrl.toggleModule);

// ── AI Models ──
router.get('/ai-models', sdkAdminCtrl.getAIModels);
router.post('/ai-models', sdkAdminCtrl.addAIModel);
router.patch('/ai-models/:modelId', sdkAdminCtrl.updateAIModel);
router.delete('/ai-models/:modelId', sdkAdminCtrl.deleteAIModel);
router.patch('/ai-models/:modelId/toggle', sdkAdminCtrl.toggleAIModel);

// ── Access Tiers ──
router.get('/tiers', sdkAdminCtrl.getAccessTiers);
router.patch('/tiers/:tierName', sdkAdminCtrl.updateAccessTier);

// ── Webhooks ──
router.get('/webhooks', sdkAdminCtrl.getWebhooks);
router.post('/webhooks', sdkAdminCtrl.addWebhook);
router.patch('/webhooks/:webhookId', sdkAdminCtrl.updateWebhook);
router.delete('/webhooks/:webhookId', sdkAdminCtrl.deleteWebhook);
router.post('/webhooks/:webhookId/test', sdkAdminCtrl.testWebhook);

// ── MCP Server ──
router.get('/mcp/health', sdkAdminCtrl.checkMCPHealth);

module.exports = router;
