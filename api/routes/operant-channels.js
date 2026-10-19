/**
 * routes/operant-channels.js — entrada pública de los canales de mensajería hacia OPERANT.
 *
 *   POST /api/operant/channels/telegram     webhook del bot de Telegram
 *
 * OPERANT en Cloud Run es privado (--no-allow-unauthenticated): Telegram no puede
 * llamarle. Entra por aquí: la API comprueba el secreto que Telegram manda en
 * `X-Telegram-Bot-Api-Secret-Token`, descarta repeticiones y reenvía el update a
 * OPERANT con el puente (ID token + el mismo secreto, que OPERANT vuelve a verificar).
 *
 * Telegram reintenta cuando no recibe un 200, así que, salvo secreto inválido, se
 * contesta SIEMPRE 200: un fallo interno no debe convertirse en el mismo mensaje
 * entregado cinco veces. Los duplicados además se descartan por `update_id`.
 */

'use strict';

const crypto = require('crypto');
const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const operant = require('../services/operantBridge');
const logger = require('../utils/logger');

const router = Router();
const TENANT = process.env.BEZHAS_TENANT_ID || 'bezhas';
const VISTOS = new Map();            // update_id -> expira
const TTL_MS = 15 * 60 * 1000;

function secretoValido(req) {
    const esperado = process.env.OPERANT_TELEGRAM_SECRET || '';
    const recibido = String(req.headers['x-telegram-bot-api-secret-token'] || '');
    if (!esperado || !recibido) return false;
    const h = (v) => crypto.createHash('sha256').update(v).digest();
    return crypto.timingSafeEqual(h(recibido), h(esperado));
}

function yaVisto(updateId) {
    const ahora = Date.now();
    for (const [k, exp] of VISTOS) if (exp < ahora) VISTOS.delete(k);
    if (updateId == null) return false;
    if (VISTOS.has(updateId)) return true;
    VISTOS.set(updateId, ahora + TTL_MS);
    return false;
}

const limite = rateLimit({
    windowMs: 60 * 1000, max: 120, keyGenerator: (req) => req.ip,
    message: { error: 'too_many_requests' }, standardHeaders: true, legacyHeaders: false,
});

router.post('/telegram', limite, async (req, res) => {
    if (!process.env.OPERANT_TELEGRAM_SECRET) return res.status(503).json({ error: 'telegram_not_configured' });
    if (!secretoValido(req)) return res.status(401).json({ error: 'unauthorized' });

    const update = req.body || {};
    if (yaVisto(update.update_id)) return res.json({ ok: true, duplicate: true });

    try {
        await operant.forwardChannel({
            channel: 'telegram', tenantId: TENANT, body: update,
            headers: { 'x-telegram-bot-api-secret-token': String(process.env.OPERANT_TELEGRAM_SECRET) },
        });
    } catch (err) {
        // Sin reintento de Telegram: el mensaje se pierde y queda en el log para repasarlo.
        logger.warn({ updateId: update.update_id, error: err.message }, 'Telegram → OPERANT: no se pudo reenviar');
    }
    res.json({ ok: true });
});

module.exports = router;
