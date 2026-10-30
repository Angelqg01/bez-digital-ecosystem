'use strict';

/**
 * routes/funnel-events.js — eventos del embudo del chat.
 *
 *   POST /api/funnel/events   { event, trigger?, step?, path, mode, sid, source? }  →  204
 *
 * Público y anónimo: lo llama el navegador de quien aún no es cliente. Por eso el esquema es cerrado
 * (solo enumerados y valores acotados, `.strict()`), el cuerpo pequeño y el límite por IP estricto. No
 * hay campo donde escribir un mensaje, un email o una respuesta: ver db/migrations/075.
 *
 * Responde 204 también cuando descarta el evento por no válido: medir no debe romper la página ni
 * dar pistas a quien sondea.
 */

const { Router, json } = require('express');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { query } = require('../db/pool');
const logger = require('../utils/logger');

const router = Router();
router.use(json({ limit: '2kb' }));

const EVENTS = [
    'nudge_shown', 'nudge_clicked', 'nudge_dismissed',
    'chat_opened', 'onboarding_started', 'onboarding_step', 'onboarding_email_saved',
    'onboarding_completed', 'onboarding_link_opened',
];
const TRIGGERS = ['home', 'pricing', 'developers', 'subapp', 'second_visit', 'questionnaire_idle', 'checkout', 'credits'];
const STEPS = ['cargo', 'estructura', 'empresa', 'caso', 'integraciones', 'erp', 'participacion'];

const schema = z.object({
    event: z.enum(EVENTS),
    trigger: z.enum(TRIGGERS).optional(),
    step: z.enum(STEPS).optional(),
    // Solo la ruta: sin query ni fragmento, que pueden llevar tokens.
    path: z.string().max(120).regex(/^\/[A-Za-z0-9/_.\-]*$/),
    mode: z.enum(['contextual', 'personalized']),
    sid: z.string().min(8).max(36).regex(/^[a-z0-9-]+$/),
    source: z.string().max(40).regex(/^[a-z0-9_.\-]+$/i).optional(),
}).strict();

const limite = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => res.status(204).end(),
});

router.post('/events', limite, async (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(204).end();
    const e = parsed.data;
    try {
        await query(
            `INSERT INTO funnel_events (event, trigger_id, step, path, mode, sid, source)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            // `source` solo se admite con consentimiento: en modo contextual se descarta aunque llegue.
            [e.event, e.trigger || null, e.step || null, e.path, e.mode, e.sid, e.mode === 'personalized' ? (e.source || null) : null]
        );
    } catch (err) {
        logger.warn({ err: err.message }, 'No se pudo guardar un evento del embudo');
    }
    return res.status(204).end();
});

module.exports = router;
