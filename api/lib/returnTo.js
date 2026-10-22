'use strict';

/**
 * returnTo — URL de la app a la que se devuelve al usuario tras registrarse, confirmar el email o pagar un plan.
 *
 * Sólo se aceptan destinos propios: https en bezhas.com o cualquiera de sus subdominios (hub, energy, pay…).
 * En desarrollo, además, http://localhost y 127.0.0.1. Todo lo demás (otros dominios, javascript:, URLs con
 * usuario/contraseña, esquemas raros) se descarta: si no, el enlace del correo serviría de redirección abierta
 * para phishing. Devuelve la URL normalizada o null.
 */
const DOMAIN = process.env.RETURN_TO_DOMAIN || 'bezhas.com';
const MAX_LEN = 1000;

function safeReturnTo(raw) {
    if (typeof raw !== 'string' || !raw || raw.length > MAX_LEN) return null;
    let u;
    try { u = new URL(raw.trim()); } catch { return null; }
    if (u.username || u.password) return null;
    const host = u.hostname.toLowerCase();
    const propio = host === DOMAIN || host.endsWith(`.${DOMAIN}`);
    if (u.protocol === 'https:' && propio) return u.toString();
    const local = host === 'localhost' || host === '127.0.0.1';
    if (u.protocol === 'http:' && local && process.env.NODE_ENV !== 'production') return u.toString();
    return null;
}

module.exports = { safeReturnTo };
