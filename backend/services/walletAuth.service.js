/**
 * Login / registro con wallet (SIWE, EIP-4361) que emite el MISMO JWT que
 * email+password, de modo que `protect` lo acepta sin cambios.
 *
 * Garantías:
 *  - Nonce generado en servidor, ligado a la dirección, de un solo uso y con caducidad.
 *  - Dominio del mensaje firmado en una lista de permitidos (anti-phishing).
 *  - El mensaje debe tener caducidad (expirationTime) acotada.
 *  - Sin JWT_SECRET configurado NO se emite token (nunca se usa un secreto por defecto).
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { SiweMessage, generateNonce } = require('siwe');

const NONCE_TTL_MS = 5 * 60 * 1000;
const MAX_NONCES = 10_000;
const MAX_MESSAGE_LIFETIME_MS = 15 * 60 * 1000;
const JWT_TTL = process.env.WALLET_AUTH_JWT_TTL || '7d';

const nonces = new Map(); // nonce -> { address, exp }

const allowedDomains = () =>
    (process.env.WALLET_AUTH_ALLOWED_DOMAINS || 'localhost:3000,localhost:3001,localhost:5000,bezhas.com,www.bezhas.com')
        .split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);

const isAddress = (a) => /^0x[a-fA-F0-9]{40}$/.test(String(a || ''));
const fail = (status, message) => Object.assign(new Error(message), { status });

function sweep(now = Date.now()) {
    for (const [n, v] of nonces) if (v.exp < now) nonces.delete(n);
    // Tope duro: si se llena, se descartan los más antiguos (Map conserva orden de inserción).
    while (nonces.size > MAX_NONCES) nonces.delete(nonces.keys().next().value);
}

function issueNonce(address) {
    if (!isAddress(address)) throw fail(400, 'Dirección de wallet inválida');
    sweep();
    const nonce = generateNonce();
    nonces.set(nonce, { address: address.toLowerCase(), exp: Date.now() + NONCE_TTL_MS });
    return { nonce, expiresIn: NONCE_TTL_MS / 1000, domains: allowedDomains() };
}

/** Verifica el mensaje SIWE firmado y devuelve la dirección verificada (minúsculas). */
async function verifySignedMessage({ message, signature }) {
    if (typeof message !== 'string' || typeof signature !== 'string' || message.length > 2000 || signature.length > 400) {
        throw fail(400, 'message y signature son obligatorios');
    }
    let siwe;
    try { siwe = new SiweMessage(message); } catch (_) { throw fail(400, 'Mensaje SIWE inválido'); }

    const domain = String(siwe.domain || '').toLowerCase();
    if (!allowedDomains().includes(domain)) throw fail(401, 'Dominio no permitido');

    // Caducidad obligatoria y acotada.
    if (!siwe.expirationTime) throw fail(401, 'El mensaje debe incluir expirationTime');
    const exp = Date.parse(siwe.expirationTime);
    if (!Number.isFinite(exp) || exp - Date.now() > MAX_MESSAGE_LIFETIME_MS) throw fail(401, 'expirationTime fuera de rango');

    // Nonce: existente, no caducado y ligado a la dirección. Se consume SIEMPRE (un solo uso).
    const entry = nonces.get(siwe.nonce);
    nonces.delete(siwe.nonce);
    const address = String(siwe.address || '').toLowerCase();
    if (!entry || entry.exp < Date.now() || entry.address !== address) throw fail(401, 'Nonce inválido o caducado');

    let result;
    try { result = await siwe.verify({ signature, domain: siwe.domain, nonce: siwe.nonce }); } catch (_) { result = { success: false }; }
    if (!result || result.success !== true) throw fail(401, 'Firma inválida');
    return address;
}

function signToken(userId) {
    if (!process.env.JWT_SECRET) throw fail(503, 'Autenticación no configurada');
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: JWT_TTL });
}

/**
 * mode: 'login' (la wallet debe existir), 'register' (no debe existir) o 'either'.
 * `deps` permite inyectar el modelo en tests.
 */
async function loginOrRegisterWithWallet({ message, signature, mode = 'either', profile = {} }, deps = {}) {
    const address = await verifySignedMessage({ message, signature });

    // Los modelos se cargan tras validar la firma: entradas inválidas no tocan la BD.
    const User = deps.User || require('../models/pg/User');
    const ensureAdmin = deps.ensureSuperAdminRole || require('../middleware/auth.middleware').ensureSuperAdminRole;

    let user = await User.findByWallet(address);
    const isNewUser = !user;
    if (mode === 'login' && isNewUser) throw fail(404, 'Usuario no encontrado. Regístrate primero.');
    if (mode === 'register' && !isNewUser) throw fail(409, 'La wallet ya está registrada');

    if (isNewUser) {
        const username = typeof profile.username === 'string' && /^[\w .-]{1,50}$/.test(profile.username.trim())
            ? profile.username.trim() : `User_${address.slice(2, 8)}`;
        let email = null;
        if (profile.email) {
            if (typeof profile.email !== 'string' || profile.email.length > 254 || !/^[^\s@]{1,64}@[^\s@]{1,255}$/.test(profile.email)) throw fail(400, 'Email inválido');
            email = profile.email.toLowerCase();
            if (await User.findByEmail(email)) throw fail(409, 'Email ya registrado');
        }
        user = await User.create({
            walletAddress: address,
            username,
            email,
            roles: ['USER'],
            accountType: 'individual',
            affiliate: { referralCode: `BZH${crypto.randomBytes(4).toString('hex').toUpperCase()}` },
        });
    }
    user = await ensureAdmin(user);

    return {
        isNewUser,
        token: signToken(user._id || user.id),
        user: {
            id: user._id || user.id,
            username: user.username,
            walletAddress: user.walletAddress || address,
            roles: user.roles,
            subscription: user.subscription,
            vipTier: user.vipTier,
        },
    };
}

module.exports = { issueNonce, verifySignedMessage, loginOrRegisterWithWallet, _nonces: nonces };
