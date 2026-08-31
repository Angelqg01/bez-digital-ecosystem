'use strict';

const express = require('express');
const svc = require('../services/pureScanService');

/**
 * Rutas de BZ PureScan — trazabilidad alimentaria.
 *
 * CAMBIO DE CONTRATO (antes: mocks síncronos)
 * Estos endpoints devolvían datos inventados en la misma respuesta: siempre los
 * mismos aguacates Hass, hashes de transacción con Math.random() e inventario
 * aleatorio. El análisis real lo hace el AgentManager, cuya API es asíncrona, así
 * que /analyze pasa a responder 202 con un scanRef y el cliente sondea
 * GET /scans/:ref hasta que el estado sea 'completed'.
 *
 *   POST /analyze            → 202 { scanRef, status: 'analyzing'|'unavailable' }
 *   GET  /scans/:ref         → estado y análisis del escaneo
 *   GET  /scans              → historial (de la base de datos)
 *   POST /scans/:ref/result  → escritura del resultado por el agente
 *   POST /scans/:ref/feedback→ feedback humano (HITL)
 *   POST /blockchain/sync    → emite el DPP y ancla su raíz merkle
 *   GET  /dpp/:ref           → estado del pasaporte
 *   GET  /inventory          → inventario
 *   GET  /analytics          → agregados reales
 *   GET  /profile/did        → DID derivado de la wallet configurada
 */
module.exports = function (manager = null, bridge = null) {
    const router = express.Router();

    /** Envuelve un handler async para que un throw acabe en 500 y no cuelgue. */
    const wrap = (fn) => (req, res) => {
        Promise.resolve(fn(req, res)).catch((error) => {
            if (!res.headersSent) {
                res.status(500).json({ success: false, error: error.message });
            }
        });
    };

    // ── Escaneo ──────────────────────────────────────────────────────────────
    router.post('/analyze', wrap(async (req, res) => {
        const { sku, product, batch, walletAddress, ...rest } = req.body || {};

        const scan = await svc.createScan(
            { sku, product, batch, walletAddress, payload: rest },
            manager
        );

        // 202: aceptado y en curso. 503 si no hay runtime al que encargárselo —
        // preferible a devolver un análisis inventado en trazabilidad alimentaria.
        const status = scan.status === 'unavailable' ? 503 : 202;

        res.status(status).json({
            success: scan.status !== 'unavailable',
            scanRef: scan.scan_ref,
            status: scan.status,
            taskId: scan.taskId || null,
            poll: `/api/purescan/scans/${scan.scan_ref}`,
            ...(scan.error ? { error: scan.error } : {}),
        });
    }));

    router.get('/scans/:ref', wrap(async (req, res) => {
        const scan = await svc.getScan(req.params.ref);
        if (!scan) return res.status(404).json({ success: false, error: 'Escaneo no encontrado' });

        res.json({
            success: true,
            scanRef: scan.scan_ref,
            status: scan.status,
            analysis: scan.analysis || null,
            riskLevel: scan.risk_level || null,
            error: scan.error_message || null,
            createdAt: scan.created_at,
            updatedAt: scan.updated_at,
        });
    }));

    router.get('/scans', wrap(async (req, res) => {
        const scans = await svc.listScans({
            limit: req.query.limit,
            status: req.query.status || null,
        });
        res.json({ success: true, scans });
    }));

    /**
     * Escritura del resultado por parte del agente, que cierra el sondeo.
     * Protegida con la clave interna: quien pueda escribir aquí decide si un
     * lote de comida es apto.
     */
    router.post('/scans/:ref/result', wrap(async (req, res) => {
        const expected = process.env.INTERNAL_API_KEY;
        if (!expected || req.get('x-internal-key') !== expected) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { analysis, error } = req.body || {};

        if (error) {
            const failed = await svc.setScanStatus(req.params.ref, 'failed', { errorMessage: error });
            if (!failed) return res.status(404).json({ success: false, error: 'Escaneo no encontrado' });
            return res.json({ success: true, status: 'failed' });
        }

        if (!analysis || typeof analysis !== 'object') {
            return res.status(400).json({ success: false, error: 'Falta el objeto analysis' });
        }

        const updated = await svc.completeScan(req.params.ref, analysis);
        if (!updated) return res.status(404).json({ success: false, error: 'Escaneo no encontrado' });

        res.json({ success: true, status: updated.status, riskLevel: updated.risk_level || null });
    }));

    router.post('/scans/:ref/feedback', wrap(async (req, res) => {
        const { verdict, comment, createdBy } = req.body || {};

        let saved;
        try {
            saved = await svc.recordFeedback(req.params.ref, { verdict, comment, createdBy });
        } catch (err) {
            return res.status(400).json({ success: false, error: err.message });
        }

        if (!saved) return res.status(404).json({ success: false, error: 'Escaneo no encontrado' });
        res.status(201).json({ success: true, feedbackId: saved.id, verdict: saved.verdict });
    }));

    // ── Digital Product Passport ─────────────────────────────────────────────
    router.post('/blockchain/sync', wrap(async (req, res) => {
        const { scanRef = null, ...payload } = req.body || {};

        if (!payload || Object.keys(payload).length === 0) {
            return res.status(400).json({ success: false, error: 'El DPP no puede ir vacío' });
        }

        const dpp = await svc.createDpp({ scanRef, payload }, bridge);

        res.status(dpp.status === 'failed' ? 502 : 201).json({
            success: dpp.status !== 'failed',
            dppRef: dpp.dpp_ref,
            status: dpp.status,
            leafHash: dpp.leaf_hash,
            merkleRoot: dpp.merkle_root,
            anchorTxHash: dpp.anchor_tx_hash || dpp.txHash || null,
            anchored: Boolean(dpp.anchored),
            ...(dpp.reason ? { reason: dpp.reason } : {}),
            ...(dpp.error ? { error: dpp.error } : {}),
        });
    }));

    router.get('/dpp/:ref', wrap(async (req, res) => {
        const dpp = await svc.getDpp(req.params.ref);
        if (!dpp) return res.status(404).json({ success: false, error: 'DPP no encontrado' });
        res.json({ success: true, dpp });
    }));

    // ── Inventario y analíticas ──────────────────────────────────────────────
    router.get('/inventory', wrap(async (req, res) => {
        const inventory = await svc.listInventory({ limit: req.query.limit });
        res.json({ success: true, inventory });
    }));

    router.put('/inventory/:sku', wrap(async (req, res) => {
        const { product, quantity, batch, status } = req.body || {};
        const row = await svc.upsertInventory({
            sku: req.params.sku, product, quantity, batch, status,
        });
        res.json({ success: true, sku: req.params.sku, id: row ? row.id : null });
    }));

    router.get('/analytics', wrap(async (_req, res) => {
        res.json({ success: true, ...(await svc.getAnalytics()) });
    }));

    router.get('/profile/did', wrap(async (_req, res) => {
        const did = svc.getNodeDid();
        if (!did.did) return res.status(503).json({ success: false, ...did });
        res.json({ success: true, ...did });
    }));

    return router;
};
