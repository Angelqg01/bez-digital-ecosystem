const LeadScraper = require('../services/lead-scraper.service');
const OutboundMessaging = require('../services/outbound-messaging.service');

/**
 * AGENTS CONTROLLER (AIOps Nivel 5)
 * Gestiona el ciclo de vida de los agentes autónomos de adquisición.
 */

// 1. Obtener estado de los agentes
exports.getAgentsStatus = async (req, res) => {
    try {
        const scraperStatus = LeadScraper.getStatus();
        const messagingStatus = OutboundMessaging.getStatus();

        res.status(200).json({
            success: true,
            data: {
                scraper: scraperStatus,
                messaging: messagingStatus,
                wallet: { status: 'Active', balance: 'Ready' } // Mock de conectividad a la wallet principal
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 2. Iniciar campaña autónoma (Scrape + Message)
exports.startAcquisitionCampaign = async (req, res) => {
    try {
        const { sector, keywords, limit } = req.body;

        if (!sector) {
            return res.status(400).json({ success: false, message: 'El sector es requerido.' });
        }

        // Respuesta inmediata, el proceso continúa asíncronamente
        res.status(202).json({
            success: true,
            message: `Campaña iniciada para el sector: ${sector}. Los mensajes quedarán pendientes de aprobación humana.`
        });

        // 1. Scrape Leads
        const scrapeResult = await LeadScraper.startCampaign(sector, keywords, limit || 5);

        // 2. Si se encontraron leads, disparar Pitching
        if (scrapeResult.success && scrapeResult.leads.length > 0) {
            console.log(`[Agente Principal] 🤖 Creando ${scrapeResult.leads.length} borradores pendientes de aprobación...`);
            await OutboundMessaging.createApprovalDrafts(scrapeResult.leads, scrapeResult.campaignId);
        }

    } catch (error) {
        console.error('[AgentsController] Error en campaña:', error.message);
    }
};

// 4. Aprobar y enviar un lead concreto (Human-in-the-loop)
exports.approveLeadOutreach = async (req, res) => {
    try {
        const approver = req.user?.email || req.user?.walletAddress || req.headers['x-admin-user'] || 'human-admin';
        const result = await OutboundMessaging.approveAndSendLead(req.params.leadId, approver);

        if (!result.success && result.error === 'Lead not found') {
            return res.status(404).json(result);
        }

        const status = result.success ? 200 : result.blocked ? 409 : 400;
        res.status(status).json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 3. Ejecutar Pitch de prueba (Manual)
exports.testPitch = async (req, res) => {
    try {
        const { email, type, companyName } = req.body;

        const mockLead = {
            contactEmail: email,
            type: type || 'B2B',
            companyName: companyName || 'Empresa de Prueba',
            whatsappNumber: req.body.phone || null
        };

        const pitch = OutboundMessaging.generatePitch(mockLead);
        const channel = mockLead.whatsappNumber ? 'WhatsApp' : 'Email';

        const result = await OutboundMessaging.sendMessage(mockLead, pitch, channel);

        res.status(200).json({
            success: true,
            pitch: pitch,
            deliveryResult: result
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
