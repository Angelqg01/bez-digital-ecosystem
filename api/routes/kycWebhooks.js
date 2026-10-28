/**
 * kycWebhooks.js — webhooks de proveedores KYC.
 *
 * Montado ANTES de express.json() (como routes/webhooks.js) porque la firma
 * de Didit se calcula sobre el cuerpo tal como llega.
 *
 * POST /api/webhooks/kyc/didit
 */

'use strict';

const express = require('express');
const logger = require('../utils/logger');
const complianceGate = require('../services/complianceGate');
const didit = require('../services/kyc/diditAdapter');

const router = express.Router();

const PROVIDER = 'didit';

router.post('/didit', express.raw({ type: 'application/json', limit: '256kb' }), async (req, res) => {
    const secret = process.env.DIDIT_WEBHOOK_SECRET || '';
    if (!secret) {
        logger.error('DIDIT_WEBHOOK_SECRET no configurado — webhook rechazado');
        return res.status(503).json({ error: 'KYC webhook not configured' });
    }

    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    let body;
    try {
        body = JSON.parse(rawBody.toString('utf8'));
    } catch {
        return res.status(400).json({ error: 'Invalid JSON' });
    }

    const valid = didit.verifyWebhookSignature({
        body,
        headers: req.headers,
        secret,
    });
    if (!valid) {
        logger.warn({ provider: PROVIDER }, 'KYC webhook con firma inválida');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const event = didit.parseSessionEvent(body);
    const level = didit.levelForEvent(event, {
        level2WorkflowId: process.env.DIDIT_LEVEL2_WORKFLOW_ID || '',
    });

    // Eventos sin wallet o sin decisión de aprobación: se acusan recibo (200)
    // para que Didit no reintente, pero no tocan el nivel.
    if (!event.walletAddress || level === null) {
        return res.json({ success: true, ignored: true });
    }

    try {
        // Nunca bajamos el nivel por un evento tardío: un duplicado de
        // «Approved» de un workflow de nivel 1 no debe quitar el nivel 2.
        const current = await complianceGate.getKycLevel(event.walletAddress);
        if (current.level >= level) {
            return res.json({ success: true, unchanged: true });
        }

        const updated = await complianceGate.setKycLevel({
            walletAddress: event.walletAddress,
            level,
            provider: PROVIDER,
            reference: event.sessionId,
        });
        logger.info({ provider: PROVIDER, level: updated.level, sessionId: event.sessionId }, 'KYC level updated by webhook');
        return res.json({ success: true, level: updated.level });
    } catch (error) {
        logger.error(error, 'KYC webhook: no se pudo actualizar el nivel');
        return res.status(500).json({ error: 'Failed to update KYC level' });
    }
});

module.exports = router;
