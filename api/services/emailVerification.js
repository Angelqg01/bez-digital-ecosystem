'use strict';

/**
 * emailVerification — confirmación del email de una cuenta (migración 070).
 *
 *   issue()    crea un token de un solo uso (24 h) y anula los anteriores sin usar
 *   consume()  lo gasta y marca el email como verificado
 *   send()     manda el correo con el botón que lleva al Hub a elegir plan
 *
 * El token viaja solo en el enlace del correo; en la base sólo está su SHA-256.
 */
const crypto = require('crypto');
const { query } = require('../db/pool');
const { sendMail } = require('./mailer');
const logger = require('../utils/logger');

const TTL_HOURS = 24;
const hash = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const hubUrl = () => String(process.env.HUB_PUBLIC_URL || 'https://hub.bezhas.com').replace(/\/+$/, '');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function issue(userId, { returnTo = null } = {}) {
    await query('UPDATE email_verifications SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL', [userId]);
    const token = crypto.randomBytes(32).toString('hex');
    await query(
        `INSERT INTO email_verifications (user_id, token_hash, return_to, expires_at)
         VALUES ($1, $2, $3, NOW() + INTERVAL '${TTL_HOURS} hours')`,
        [userId, hash(token), returnTo]
    );
    return token;
}

/** Cuánto tiempo después de usarlo sigue sirviendo el enlace del correo para volver a elegir plan (sin sesión nueva). */
const REUSE_DAYS = 30;

/**
 * @returns {Promise<{userId: string, returnTo: string|null, first: boolean}|null>}
 *   first=true: primer uso, acaba de verificarse el email (el llamante puede dar sesión).
 *   first=false: el enlace ya se gastó pero el email está verificado: sirve para volver a /planes, nunca para dar
 *   sesión (si no, quien reenvíe o robe el correo entraría a la cuenta una y otra vez).
 *   null si no existe, caducó sin usarse o fue sustituido por otro y el email sigue sin verificar.
 */
async function consume(token) {
    if (!/^[0-9a-f]{64}$/.test(String(token || ''))) return null;
    const { rows } = await query(
        `UPDATE email_verifications SET used_at = NOW()
          WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
          RETURNING user_id, return_to`,
        [hash(token)]
    );
    if (rows.length) {
        await query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = $1', [rows[0].user_id]);
        return { userId: rows[0].user_id, returnTo: rows[0].return_to, first: true };
    }
    const prev = await query(
        `SELECT v.user_id, v.return_to
           FROM email_verifications v JOIN users u ON u.id = v.user_id
          WHERE v.token_hash = $1 AND v.used_at > NOW() - INTERVAL '${REUSE_DAYS} days' AND u.email_verified_at IS NOT NULL`,
        [hash(token)]
    );
    return prev.rows.length ? { userId: prev.rows[0].user_id, returnTo: prev.rows[0].return_to, first: false } : null;
}

function link(token, returnTo) {
    const u = new URL(`${hubUrl()}/confirmar`);
    u.searchParams.set('token', token);
    if (returnTo) u.searchParams.set('return', returnTo);
    return u.toString();
}

function buildMessage({ username, bezhas_id: bezhasId }, url) {
    const nombre = username || 'hola';
    const text = [
        `Hola ${nombre},`,
        '',
        `Tu BeZhas ID es ${bezhasId}: es único para todas las apps nativas de BeZhas.`,
        'Confirma tu email y elige tu plan desde este enlace (caduca en 24 horas):',
        '',
        url,
        '',
        'Si no has creado tú esta cuenta, ignora este mensaje: sin confirmar, no se activa nada.',
        '— BeZhas',
    ].join('\n');
    const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f2f5f5;font-family:Arial,Helvetica,sans-serif;color:#08161a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #d8e0e1;border-radius:16px">
<tr><td style="padding:32px">
<p style="margin:0 0 4px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#046c7a">BeZhas</p>
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.2">Confirma tu email y elige tu plan</h1>
<p style="margin:0 0 12px;line-height:1.55">Hola ${esc(nombre)}, tu cuenta está creada. Tu <strong>BeZhas ID</strong> es:</p>
<p style="margin:0 0 20px;font-family:Consolas,monospace;font-size:20px;letter-spacing:.06em"><strong>${esc(bezhasId)}</strong></p>
<p style="margin:0 0 24px;line-height:1.55;color:#46595e">Es único para todas las apps nativas de BeZhas: con él entras en todas sin volver a registrarte.</p>
<p style="margin:0 0 24px"><a href="${esc(url)}" style="display:inline-block;background:#046c7a;color:#fff;text-decoration:none;font-weight:700;padding:14px 26px;border-radius:999px">Confirmar email y elegir plan</a></p>
<p style="margin:0 0 8px;font-size:13px;color:#5a6d71;line-height:1.5">El enlace caduca en 24 horas. Si el botón no funciona, copia esta dirección en el navegador:<br><span style="word-break:break-all">${esc(url)}</span></p>
<p style="margin:16px 0 0;font-size:13px;color:#5a6d71">Si no has creado tú esta cuenta, ignora este mensaje: sin confirmar, no se activa nada.</p>
</td></tr></table></td></tr></table></body></html>`;
    return { text, html };
}

/** Manda el correo de confirmación. No lanza: devuelve {sent} para que el registro no falle si el correo sí. */
async function send(user, token, returnTo) {
    try {
        const { text, html } = buildMessage(user, link(token, returnTo));
        const r = await sendMail({ to: user.email, subject: 'Confirma tu email y elige tu plan de BeZhas', text, html });
        return { sent: !!r.sent };
    } catch (e) {
        logger.warn({ userId: user.id, error: e.message }, 'No se pudo enviar el correo de confirmación');
        return { sent: false };
    }
}

module.exports = { issue, consume, send, link, buildMessage, hash, TTL_HOURS };
