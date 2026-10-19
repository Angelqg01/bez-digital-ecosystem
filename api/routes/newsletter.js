/**
 * routes/newsletter.js — suscripción a la newsletter con doble confirmación.
 *
 *   POST /api/newsletter/request            (clave interna) pide la suscripción; devuelve los enlaces
 *   GET  /api/newsletter/confirm/:token     página con botón «Confirmar»
 *   POST /api/newsletter/confirm/:token     confirma (el botón)
 *   GET  /api/newsletter/unsubscribe/:token página con botón «Darme de baja»
 *   POST /api/newsletter/unsubscribe/:token da de baja (también sirve de baja en un clic, RFC 8058)
 *
 * Quién pide: OPERANT, cuando alguien escribe «quiero la newsletter» por Telegram,
 * correo o chat. Por eso `/request` exige la clave interna (la misma que autentica
 * el puente API ↔ OPERANT): sin ella cualquiera podría usar este servidor para
 * hacer que BeZhas escriba a un tercero. El correo con el enlace lo manda OPERANT
 * desde su buzón; aquí no se envía nada.
 *
 * Confirmar es un POST tras un botón, no un GET directo: los antivirus y los
 * clientes de correo «abren» los enlaces de los mensajes para analizarlos, y con
 * un GET eso confirmaría suscripciones que nadie ha pedido.
 */

'use strict';

const crypto = require('crypto');
const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { query } = require('../db/pool');
const logger = require('../utils/logger');

const router = Router();

const PUBLIC_BASE = (process.env.PUBLIC_NEWSLETTER_BASE_URL || process.env.PUBLIC_PAY_BASE_URL || 'https://api.bezhas.com').replace(/\/$/, '');
// No se vuelve a mandar confirmación si hay una pedida hace menos de esto.
const REENVIO_MIN = parseInt(process.env.NEWSLETTER_REENVIO_MIN || '10', 10);

const CONSENT_TEXT = 'Acepto recibir la newsletter de BeZhas por correo electrónico. '
    + 'Puedo darme de baja en cualquier momento desde cualquier envío.';

const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
const token = () => crypto.randomBytes(32).toString('hex');
const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/;

function claveInternaValida(req) {
    const esperada = process.env.OPERANT_INTERNAL_KEY || '';
    const recibida = String(req.headers['x-api-key'] || '');
    if (!esperada || !recibida) return false;
    const a = Buffer.from(sha256(recibida), 'hex');
    const b = Buffer.from(sha256(esperada), 'hex');
    return crypto.timingSafeEqual(a, b);
}

const limitePeticiones = rateLimit({
    windowMs: 60 * 1000, max: 30, keyGenerator: (req) => req.ip,
    message: { error: 'too_many_requests' }, standardHeaders: true, legacyHeaders: false,
});

router.post('/request', limitePeticiones, async (req, res) => {
    if (!claveInternaValida(req)) return res.status(401).json({ error: 'unauthorized' });

    const email = String(req.body?.email || '').trim().toLowerCase();
    const source = String(req.body?.source || '').toLowerCase();
    const language = String(req.body?.language || 'es').slice(0, 8);
    if (!EMAIL_RE.test(email) || email.length > 254) return res.status(400).json({ error: 'invalid_email' });
    if (!['telegram', 'email', 'chat', 'web'].includes(source)) return res.status(400).json({ error: 'invalid_source' });

    try {
        const { rows } = await query(
            `SELECT status, requested_at FROM newsletter_subscribers WHERE LOWER(email) = $1 LIMIT 1`, [email]
        );
        const previa = rows[0];
        if (previa?.status === 'confirmed') return res.json({ status: 'already_confirmed' });
        if (previa?.status === 'pending'
            && Date.now() - new Date(previa.requested_at).getTime() < REENVIO_MIN * 60 * 1000) {
            return res.json({ status: 'pending_recent' });
        }

        const confirmToken = token();
        const unsubToken = token();
        // Una baja previa NO se pisa en silencio: quien se dio de baja y vuelve a pedirlo
        // por su cuenta ha cambiado de opinión, y el nuevo consentimiento lo reemplaza.
        await query(
            `INSERT INTO newsletter_subscribers
                 (email, status, confirm_token_hash, unsub_token_hash, language, source, consent_text, requested_at)
             VALUES ($1, 'pending', $2, $3, $4, $5, $6, NOW())
             ON CONFLICT (LOWER(email)) DO UPDATE
                SET status = 'pending', confirm_token_hash = EXCLUDED.confirm_token_hash,
                    unsub_token_hash = EXCLUDED.unsub_token_hash, language = EXCLUDED.language,
                    source = EXCLUDED.source, consent_text = EXCLUDED.consent_text,
                    requested_at = NOW(), confirmed_at = NULL, unsubscribed_at = NULL`,
            [email, sha256(confirmToken), sha256(unsubToken), language, source, CONSENT_TEXT]
        );
        res.json({
            status: 'pending',
            confirmUrl: `${PUBLIC_BASE}/api/newsletter/confirm/${confirmToken}`,
            unsubscribeUrl: `${PUBLIC_BASE}/api/newsletter/unsubscribe/${unsubToken}`,
        });
    } catch (err) {
        logger.error({ error: err.message }, 'newsletter: no se pudo registrar la petición');
        res.status(500).json({ error: 'server_error' });
    }
});

// ── Páginas públicas (sin scripts: el botón es un <form method=post>) ──────────────

function pagina(titulo, cuerpo) {
    return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>${titulo} · BeZhas</title>
<style>body{background:#0b0f14;color:#e8edf2;font:16px/1.5 system-ui,sans-serif;display:flex;min-height:100vh;
align-items:center;justify-content:center;margin:0;padding:20px}.c{background:#121821;border:1px solid #1e2732;
border-radius:16px;padding:28px;max-width:440px;text-align:center}button{background:#00D4AA;color:#06251e;border:0;
padding:12px 22px;border-radius:12px;font-weight:700;font-size:15px;cursor:pointer}p{color:#8b98a5}</style></head>
<body><div class="c"><h1 style="font-size:20px">${titulo}</h1>${cuerpo}</div></body></html>`;
}
const TOKEN_RE = /^[0-9a-f]{64}$/;
const enviar = (res, html, status = 200) => {
    res.status(status).set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'Referrer-Policy': 'no-referrer' })
        .type('html').send(html);
};

router.get('/confirm/:token', (req, res) => {
    if (!TOKEN_RE.test(req.params.token)) return enviar(res, pagina('Enlace no válido', '<p>Este enlace no es válido.</p>'), 404);
    enviar(res, pagina('Confirma tu suscripción',
        `<p>Pulsa para confirmar que quieres recibir la newsletter de BeZhas.</p>
<form method="post" action="/api/newsletter/confirm/${req.params.token}"><button type="submit">Confirmar suscripción</button></form>`));
});

router.post('/confirm/:token', limitePeticiones, async (req, res) => {
    if (!TOKEN_RE.test(req.params.token)) return enviar(res, pagina('Enlace no válido', '<p>Este enlace no es válido.</p>'), 404);
    try {
        const { rows } = await query(
            `UPDATE newsletter_subscribers
                SET status = 'confirmed', confirmed_at = NOW(), confirm_token_hash = NULL
              WHERE confirm_token_hash = $1 AND status = 'pending'
              RETURNING id`, [sha256(req.params.token)]
        );
        if (!rows.length) {
            return enviar(res, pagina('Enlace caducado o ya usado', '<p>Si ya confirmaste, no hace falta nada más.</p>'), 410);
        }
        enviar(res, pagina('¡Suscripción confirmada!', '<p>Gracias. Recibirás la newsletter de BeZhas. Puedes darte de baja desde cualquier envío.</p>'));
    } catch (err) {
        logger.error({ error: err.message }, 'newsletter: fallo al confirmar');
        enviar(res, pagina('Error', '<p>No se pudo confirmar ahora. Inténtalo de nuevo en unos minutos.</p>'), 500);
    }
});

router.get('/unsubscribe/:token', (req, res) => {
    if (!TOKEN_RE.test(req.params.token)) return enviar(res, pagina('Enlace no válido', '<p>Este enlace no es válido.</p>'), 404);
    enviar(res, pagina('Darte de baja',
        `<p>¿Quieres dejar de recibir la newsletter de BeZhas?</p>
<form method="post" action="/api/newsletter/unsubscribe/${req.params.token}"><button type="submit">Darme de baja</button></form>`));
});

router.post('/unsubscribe/:token', limitePeticiones, async (req, res) => {
    if (!TOKEN_RE.test(req.params.token)) return enviar(res, pagina('Enlace no válido', '<p>Este enlace no es válido.</p>'), 404);
    try {
        const { rows } = await query(
            `UPDATE newsletter_subscribers
                SET status = 'unsubscribed', unsubscribed_at = NOW(), confirm_token_hash = NULL
              WHERE unsub_token_hash = $1 AND status <> 'unsubscribed'
              RETURNING id`, [sha256(req.params.token)]
        );
        // Idempotente: ya dado de baja también es éxito (no se revela si existía).
        enviar(res, pagina('Baja realizada', `<p>${rows.length ? 'Te hemos dado de baja.' : 'No recibirás más correos de la newsletter.'}</p>`));
    } catch (err) {
        logger.error({ error: err.message }, 'newsletter: fallo en la baja');
        enviar(res, pagina('Error', '<p>No se pudo procesar ahora. Inténtalo de nuevo en unos minutos.</p>'), 500);
    }
});

module.exports = router;
module.exports.CONSENT_TEXT = CONSENT_TEXT;
