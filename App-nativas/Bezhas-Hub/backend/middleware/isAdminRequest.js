const { verifyAdminToken } = require('./admin.middleware');

/**
 * ¿La petición trae credenciales de administrador VÁLIDAS? Reutiliza verifyAdminToken sin responder nada.
 *
 * Existe porque GET /api/feed decidía «es administrador» con `authorization.includes('Bearer')`: bastaba enviar cualquier cabecera
 * `Authorization: Bearer x` para ver los posts ocultos por moderación.
 */
function isAdminRequest(req) {
    let ok = false;
    const res = { status() { return res; }, json() { return res; }, set() { return res; }, send() { return res; } };
    try { verifyAdminToken(req, res, () => { ok = true; }); } catch (_) { ok = false; }
    return ok;
}

module.exports = isAdminRequest;
