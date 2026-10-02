/**
 * Identidad de wallet SOLO a partir de una sesión autenticada.
 *
 * La cabecera `x-wallet-address` y los campos de body la declara el cliente: cualquiera puede
 * enviar la dirección de otra persona. Nunca debe usarse como identidad ni como prueba de
 * propiedad. La wallet válida es la que lleva el usuario autenticado por JWT (req.user) o el
 * token de administración (req.admin).
 */
const ADDRESS = /^0x[a-fA-F0-9]{40}$/;

function authenticatedWallet(req) {
    const candidate =
        (req.user && (req.user.walletAddress || req.user.wallet_address)) ||
        (req.admin && (req.admin.walletAddress || req.admin.wallet_address));
    return typeof candidate === 'string' && ADDRESS.test(candidate) ? candidate.toLowerCase() : null;
}

/** Exige que la sesión autenticada tenga una wallet; la deja en req.walletAddress. */
function requireWallet(req, res, next) {
    const wallet = authenticatedWallet(req);
    if (!wallet) {
        return res.status(401).json({ success: false, error: 'Se requiere una sesión autenticada con wallet' });
    }
    req.walletAddress = wallet;
    return next();
}

module.exports = { authenticatedWallet, requireWallet };
