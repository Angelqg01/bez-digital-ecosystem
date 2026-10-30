'use strict';

/**
 * routes/onboarding-guided.js — cuestionario guiado del chat de la plataforma.
 *
 *   POST /api/onboarding/guided/recommend  { respuestas }               → recomendación (anónimo)
 *   POST /api/onboarding/guided/start      { respuestas, email, consent } → { url, caduca }
 *
 * Anónimo a propósito: quien aún no es cliente es quien lo usa. Las defensas son
 * las del resto de endpoints públicos: cuerpo acotado, esquema cerrado (solo
 * enumerados, sin texto libre) y límite por IP. La contraseña NUNCA llega aquí:
 * `start` solo crea la sesión de alta y devuelve el enlace a la pantalla segura.
 */

const { Router, json } = require('express');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const guided = require('../services/onboardingGuided');
const onboarding = require('../services/onboardingSession');

const router = Router();
router.use(json({ limit: '4kb' }));

const e = guided.enumerados;
const respuestas = z.object({
    cargo: z.enum(e.cargo),
    estructura: z.enum(e.estructura),
    sector: z.enum(e.sector),
    empleados: z.enum(e.empleados),
    facturacion: z.enum(e.facturacion),
    documentos: z.enum(e.documentos),
    caso: z.enum(e.caso),
    integraciones: z.array(z.enum(e.integraciones)).max(4).optional(),
    erp: z.enum(e.erp).optional(),
    participacion: z.enum(e.participacion).optional(),
}).strict();

const iniciar = z.object({
    respuestas,
    email: z.string().trim().toLowerCase().email().max(254),
    consent: z.literal(true),
}).strict();

const limite = (max) => rateLimit({
    windowMs: 60 * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas solicitudes. Inténtalo más tarde.', code: 'rate_limited' },
});

const invalido = (res, err) => res.status(400).json({
    error: 'Datos no válidos',
    code: 'invalid',
    campos: err.issues.map((i) => i.path.join('.')),
});

router.post('/recommend', limite(60), (req, res) => {
    const parsed = respuestas.safeParse(req.body && req.body.respuestas);
    if (!parsed.success) return invalido(res, parsed.error);
    return res.json({ ok: true, recomendacion: guided.recomendar(parsed.data) });
});

router.post('/start', limite(10), async (req, res) => {
    const parsed = iniciar.safeParse(req.body);
    if (!parsed.success) {
        const sinConsent = parsed.error.issues.some((i) => i.path[0] === 'consent');
        if (sinConsent) return res.status(400).json({ error: 'Se requiere tu consentimiento para guardar el email', code: 'consent_required' });
        return invalido(res, parsed.error);
    }
    try {
        const { respuestas: r, email } = parsed.data;
        const sesion = await onboarding.crear({
            kind: 'signup',
            prefill: guided.aPrefill(r, { email }),
            ip: req.ip,
            userAgent: req.get('user-agent') || null,
        });
        return res.status(201).json({ ok: true, url: sesion.url, caduca: sesion.expiresAt });
    } catch (err) {
        if (err && err.name === 'OnboardingError') {
            return res.status(err.code === 'ONBOARDING_RATE' ? 429 : 400).json({ error: err.message, code: err.code });
        }
        return res.status(500).json({ error: 'No se pudo abrir el alta. Inténtalo de nuevo.', code: 'internal' });
    }
});

module.exports = router;
