/**
 * routes/admin-auth.js — Secure Admin Authentication
 * 
 * Security features:
 * - Server-side bcrypt password verification (never client-side)
 * - Wallet signature verification (SIWE pattern)
 * - Strict rate limiting (5 attempts / 15 min per IP)
 * - Nonce-based replay protection
 * - JWT in HttpOnly cookie
 * - Full audit trail of every login attempt
 * - Admin wallet & credentials from env vars (never hardcoded in frontend)
 */
const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { ethers } = require('ethers');
const { query } = require('../db/pool');
const { checkRateLimit } = require('../cache/redis');
const { requireSuperAdmin } = require('../middleware/admin-auth');
const adminCreds = require('../services/adminCredentials');
const totp = require('../services/totp');
const QRCode = require('qrcode');

const router = Router();

// El secreto se toma de config/secrets.js, nunca del entorno directamente.
// Resolverlo aquí por separado reintroducía el fallback 'dev-only-secret'
// cuando NODE_ENV no está puesto — y este módulo emite tokens SUPER_ADMIN,
// así que un secreto de desarrollo aquí es la llave del panel de administración.
const { JWT_SECRET } = require('../config/secrets');

// ── Admin config from env (NEVER hardcode in frontend) ──
// Sin fallbacks. El hash de desarrollo que había aquí estaba publicado en el
// repositorio: cualquiera que leyese el fichero y rompiese ese bcrypt entraba
// como SUPER_ADMIN en todo despliegue que no hubiese puesto la variable. Y la
// wallet por defecto era la del QualityEscrow real, así que un despliegue sin
// configurar aceptaba la firma de una dirección de producción.
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || null;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || null;
const ADMIN_WALLET = process.env.ADMIN_WALLET ? process.env.ADMIN_WALLET.toLowerCase() : null;

// Dominio de la cookie de sesión. En local, API (:3001) y panel (:3000)
// comparten el host `localhost` y la cookie viaja sola. En producción viven en
// subdominios distintos (api.bez.digital / app.bez.digital), y sin Domain la
// cookie queda encerrada en el host de la API y el panel nunca la envía.
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;

// Exigir segundo factor es opt-in: activarlo por defecto dejaría fuera al
// administrador de cualquier despliegue existente en el primer arranque tras
// desplegar esto, antes de haber podido dar de alta el TOTP.
const REQUIRE_2FA = process.env.ADMIN_2FA_REQUIRED === 'true';

const ADMIN_CREDENTIALS_READY = Boolean(ADMIN_USERNAME && ADMIN_PASSWORD_HASH);
const ADMIN_WALLET_READY = Boolean(ADMIN_WALLET);

if (!ADMIN_CREDENTIALS_READY) {
    console.warn('[ADMIN-AUTH] ADMIN_USERNAME / ADMIN_PASSWORD_HASH sin configurar — el login por credenciales queda CERRADO.');
}
if (!ADMIN_WALLET_READY) {
    console.warn('[ADMIN-AUTH] ADMIN_WALLET sin configurar — el login por wallet queda CERRADO.');
}

/**
 * Token de paso intermedio (cambio de contraseña obligatorio, o 2FA pendiente).
 *
 * Lleva `purpose` y NO lleva `role: 'SUPER_ADMIN'`: eso es lo que impide que
 * quien ya ha acertado la contraseña pero aún no ha pasado el segundo factor
 * use este token para entrar en el panel. requireSuperAdmin exige el role, así
 * que un token de propósito rebota en todos los endpoints protegidos.
 */
function issueStepUpToken(purpose, username) {
    return jwt.sign(
        { purpose, username, method: 'credentials' },
        JWT_SECRET,
        { expiresIn: '10m', issuer: 'bezhas-admin-auth' }
    );
}

/** Verifica un token de paso intermedio. Devuelve el payload o null. */
function verifyStepUpToken(req, expectedPurpose) {
    const raw = req.headers['authorization']?.startsWith('Bearer ')
        ? req.headers['authorization'].slice(7)
        : null;
    if (!raw) return null;
    try {
        const decoded = jwt.verify(raw, JWT_SECRET, { issuer: 'bezhas-admin-auth', algorithms: ['HS256'] });
        return decoded.purpose === expectedPurpose ? decoded : null;
    } catch {
        return null;
    }
}

/** Token de sesión completa del panel. */
function issueSessionToken(walletAddress) {
    return jwt.sign(
        {
            role: 'SUPER_ADMIN',
            wallet: walletAddress,
            method: 'credentials',
            iat: Math.floor(Date.now() / 1000),
        },
        JWT_SECRET,
        { expiresIn: '2h', issuer: 'bezhas-admin-auth' }
    );
}

/** Opciones de la cookie de sesión admin, en un solo sitio para no divergir. */
function adminCookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        domain: COOKIE_DOMAIN,
        maxAge: 2 * 60 * 60 * 1000, // 2h
    };
}

// ── Nonce store (in-memory for dev, use Redis in prod) ──
const nonceStore = new Map();

// Cleanup expired nonces every 10 min
const nonceCleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, val] of nonceStore) {
        if (now - val.created > 10 * 60 * 1000) nonceStore.delete(key);
    }
}, 10 * 60 * 1000);
nonceCleanupTimer.unref?.();

// ── Strict rate limiter for admin ──
//
// Con `scope` cada formulario tiene su propio cubo. Compartiendo uno solo,
// cinco erratas escribiendo la contraseña actual en el formulario de rotación
// dejaban al administrador sin poder ni siquiera iniciar sesión durante 15
// minutos — un autobloqueo desde dentro del panel.
function adminRateLimit(scope = 'login', max = 5, windowSec = 15 * 60) {
    return async (req, res, next) => {
        const result = await checkRateLimit(`admin-auth:${scope}:${req.ip}`, max, windowSec);
        if (!result.allowed) {
            await logAttempt(req, 'RATE_LIMITED', false, { scope });
            return res.status(429).json({
                error: `Demasiados intentos. Intente de nuevo en ${Math.ceil(result.resetInSec / 60)} minutos.`,
                retryAfter: result.resetInSec,
            });
        }
        next();
    };
}

// ── Audit logger ──
async function logAttempt(req, method, success, details = {}) {
    try {
        await query(
            `INSERT INTO ai_logs (module, action, severity, input_data, output_data, processing_ms)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                'admin-auth',
                `ADMIN_LOGIN_${method}`,
                success ? 'info' : 'warning',
                JSON.stringify({
                    ip: req.ip,
                    userAgent: req.headers['user-agent']?.substring(0, 200),
                    timestamp: new Date().toISOString(),
                    ...details,
                }),
                JSON.stringify({ success }),
                0,
            ]
        );
    } catch (_) {
        // Non-blocking audit
    }
}

// ── GET /nonce — Generate nonce for SIWE ──
router.get('/nonce', (req, res) => {
    const nonce = crypto.randomBytes(32).toString('hex');
    const id = crypto.randomBytes(16).toString('hex');
    nonceStore.set(id, { nonce, created: Date.now(), used: false });

    // Auto-expire in 5 min
    setTimeout(() => nonceStore.delete(id), 5 * 60 * 1000);

    res.json({ nonceId: id, nonce });
});

// ── POST /login — Credential-based admin login ──
router.post('/login', adminRateLimit('login'), [
    body('username').trim().isLength({ min: 1, max: 50 }).escape(),
    body('password').isLength({ min: 1, max: 128 }),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Datos inválidos' });
    }

    // La credencial vigente sale de la base (rotable desde el panel) y sólo cae
    // al entorno si la base no responde o aún no se ha sembrado la fila.
    const stored = await adminCreds.resolveForLogin();

    // Falla cerrado: sin credenciales configuradas no hay a qué comparar, y
    // dejar pasar aquí equivaldría al fallback hardcodeado que se acaba de
    // quitar. 503 y no 401 porque el problema es del despliegue, no de quien
    // intenta entrar.
    if (!stored) {
        await logAttempt(req, 'CREDENTIALS', false, { reason: 'ADMIN_CREDENTIALS_UNSET' });
        return res.status(503).json({
            error: 'Login de administrador no configurado en este despliegue',
            code: 'ADMIN_CREDENTIALS_UNSET',
        });
    }

    const { username, password } = req.body;

    // Constant-time comparison for username
    const usernameMatch = crypto.timingSafeEqual(
        Buffer.from(username.padEnd(50, '\0')),
        Buffer.from(stored.username.padEnd(50, '\0'))
    );

    // Always verify password (even if username wrong) to prevent timing attacks
    const passwordMatch = await bcrypt.compare(password, stored.passwordHash);

    if (!usernameMatch || !passwordMatch) {
        await logAttempt(req, 'CREDENTIALS', false, { username });
        return res.status(401).json({ error: 'Credenciales de administrador inválidas' });
    }

    // ── Cambio de contraseña obligatorio ──
    // Se devuelve un token de propósito, no la sesión: la contraseña marcada
    // para cambiar no debe abrir el panel ni un segundo.
    if (stored.mustChangePassword) {
        await logAttempt(req, 'CREDENTIALS', true, { username, step: 'force_password_change' });
        return res.json({
            success: true,
            forcePasswordChange: true,
            token: issueStepUpToken('bootstrap', stored.username),
            expiresIn: 600,
        });
    }

    // ── Segundo factor ya dado de alta: pedir el código ──
    if (stored.totpEnabled) {
        await logAttempt(req, 'CREDENTIALS', true, { username, step: '2fa_required' });
        return res.json({
            success: true,
            requires2FA: true,
            tempToken: issueStepUpToken('2fa', stored.username),
            expiresIn: 600,
        });
    }

    // ── 2FA exigido por configuración pero sin dar de alta: alta guiada ──
    if (REQUIRE_2FA) {
        const secret = totp.generateSecret();
        await adminCreds.ensureSchema();
        await adminCreds.setTotpSecret(secret);
        const otpauthUrl = totp.otpauthUrl({ secret, account: stored.username });
        await logAttempt(req, 'CREDENTIALS', true, { username, step: '2fa_setup_required' });
        return res.json({
            success: true,
            requiresSetup2FA: true,
            token: issueStepUpToken('2fa', stored.username),
            otpauthUrl,
            qrCodeUrl: await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 320 }),
            expiresIn: 600,
        });
    }

    await logAttempt(req, 'CREDENTIALS', true, { username });

    // Set HttpOnly secure cookie
    res.cookie('bezhas_admin_token', issueSessionToken(stored.walletAddress), adminCookieOptions());

    res.json({
        success: true,
        role: 'SUPER_ADMIN',
        username: stored.username,
        walletAddress: stored.walletAddress,
        expiresIn: 7200,
    });
});

// ── POST /wallet-login — Wallet signature admin login ──
router.post('/wallet-login', adminRateLimit('wallet-login'), [
    body('address').isEthereumAddress(),
    body('signature').isLength({ min: 1 }),
    body('message').isLength({ min: 1, max: 1000 }),
    body('nonceId').isLength({ min: 1, max: 64 }),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Datos inválidos' });
    }

    // Falla cerrado igual que el login por credenciales: sin ADMIN_WALLET no hay
    // dirección contra la que contrastar la firma recuperada.
    if (!ADMIN_WALLET_READY) {
        await logAttempt(req, 'WALLET', false, { reason: 'ADMIN_WALLET_UNSET' });
        return res.status(503).json({
            error: 'Login por wallet no configurado en este despliegue',
            code: 'ADMIN_WALLET_UNSET',
        });
    }

    const { address, signature, message, nonceId } = req.body;

    // Verify nonce hasn't been used (replay protection)
    const storedNonce = nonceStore.get(nonceId);
    if (!storedNonce || storedNonce.used) {
        await logAttempt(req, 'WALLET', false, { reason: 'invalid_nonce', address });
        return res.status(401).json({ error: 'Nonce inválido o expirado' });
    }

    // Verify nonce is in the signed message
    if (!message.includes(storedNonce.nonce)) {
        await logAttempt(req, 'WALLET', false, { reason: 'nonce_mismatch', address });
        return res.status(401).json({ error: 'Nonce no coincide con el mensaje firmado' });
    }

    // Mark nonce as used (one-time use)
    storedNonce.used = true;

    // Verify the cryptographic signature
    let recoveredAddress;
    try {
        recoveredAddress = ethers.verifyMessage(message, signature);
    } catch (err) {
        await logAttempt(req, 'WALLET', false, { reason: 'invalid_signature', address });
        return res.status(401).json({ error: 'Firma inválida' });
    }

    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        await logAttempt(req, 'WALLET', false, { reason: 'address_mismatch', address });
        return res.status(401).json({ error: 'La firma no corresponde a la dirección' });
    }

    // Verify this is the admin wallet
    if (address.toLowerCase() !== ADMIN_WALLET) {
        await logAttempt(req, 'WALLET', false, { reason: 'not_admin_wallet', address });
        return res.status(403).json({ error: 'Wallet no autorizada para acceso administrativo' });
    }

    // Generate JWT
    const token = jwt.sign(
        {
            role: 'SUPER_ADMIN',
            wallet: ADMIN_WALLET,
            method: 'wallet',
            iat: Math.floor(Date.now() / 1000),
        },
        JWT_SECRET,
        { expiresIn: '2h', issuer: 'bezhas-admin-auth' }
    );

    await logAttempt(req, 'WALLET', true, { address });

    // Set HttpOnly secure cookie
    res.cookie('bezhas_admin_token', token, adminCookieOptions());

    res.json({
        success: true,
        role: 'SUPER_ADMIN',
        expiresIn: 7200,
    });
});

// ── POST /verify — Check if current admin session is valid ──
router.post('/verify', (req, res) => {
    const token = req.cookies?.bezhas_admin_token
        || req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ valid: false });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET, { issuer: 'bezhas-admin-auth', algorithms: ['HS256'] });
        if (decoded.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ valid: false });
        }
        res.json({ valid: true, role: decoded.role, method: decoded.method });
    } catch (err) {
        return res.status(401).json({ valid: false });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
//  QUICK SUPER ADMIN — rotación de credenciales y segundo factor
//
//  El panel (TabIdentity) ya pintaba estos formularios contra endpoints que no
//  existían: los envíos devolvían 404 y la UI mostraba un error genérico.
// ═══════════════════════════════════════════════════════════════════════════

// ── GET /quick-super-admin/status — Estado de la credencial ──
router.get('/quick-super-admin/status', requireSuperAdmin, async (req, res) => {
    try {
        await adminCreds.ensureSchema();
        const status = await adminCreds.status();
        if (!status) {
            return res.status(503).json({
                success: false,
                error: 'Credenciales de administrador no inicializadas',
                code: 'ADMIN_CREDENTIALS_UNSET',
            });
        }
        res.json({ success: true, ...status });
    } catch (error) {
        res.status(500).json({ success: false, error: 'No se pudo leer el estado de la credencial' });
    }
});

// ── POST /quick-super-admin/rotate — Cambiar usuario y contraseña ──
router.post('/quick-super-admin/rotate', requireSuperAdmin, adminRateLimit('rotate', 10), [
    body('username').trim().isLength({ min: 3, max: 50 }),
    body('currentPassword').isLength({ min: 1, max: 128 }),
    body('newPassword').isLength({ min: adminCreds.MIN_PASSWORD_LENGTH, max: 128 }),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: 'Datos inválidos', details: errors.array() });
    }

    const { username, currentPassword, newPassword } = req.body;
    if (currentPassword === newPassword) {
        return res.status(400).json({ success: false, error: 'La nueva contraseña coincide con la actual' });
    }

    try {
        const result = await adminCreds.rotate({ username, currentPassword, newPassword });
        if (!result.ok) {
            await logAttempt(req, 'ROTATE', false, { username, reason: result.error });
            return res.status(result.status || 400).json({ success: false, error: result.error });
        }

        await logAttempt(req, 'ROTATE', true, { username });

        // La sesión en curso se reemite: el token viejo sigue siendo válido
        // hasta que expire, pero al menos quien acaba de rotar no se queda con
        // una sesión atada a la credencial anterior.
        res.cookie('bezhas_admin_token', issueSessionToken(result.row.wallet_address), adminCookieOptions());

        res.json({
            success: true,
            username: result.row.username,
            walletAddress: result.row.wallet_address || '',
            message: 'Credenciales SuperAdmin actualizadas',
        });
    } catch (error) {
        await logAttempt(req, 'ROTATE', false, { username, reason: error.message });
        res.status(500).json({ success: false, error: 'No se pudieron actualizar las credenciales' });
    }
});

// ── POST /quick-super-admin/2fa/setup — Emitir secreto TOTP y QR ──
router.post('/quick-super-admin/2fa/setup', requireSuperAdmin, async (req, res) => {
    try {
        await adminCreds.ensureSchema();
        const current = await adminCreds.status();
        if (!current) {
            return res.status(503).json({ success: false, error: 'Credenciales de administrador no inicializadas' });
        }

        // Secreto nuevo en cada alta: si alguien vio el QR anterior y no llegó
        // a confirmarlo, reutilizarlo le dejaría un segundo factor válido.
        const secret = totp.generateSecret();
        await adminCreds.setTotpSecret(secret);

        const otpauthUrl = totp.otpauthUrl({ secret, account: current.username });
        // Los códigos de respaldo se emiten aquí pero sólo valen tras
        // confirmar el alta: si el usuario nunca escanea el QR, no queremos
        // haber dejado 10 credenciales de acceso vivas por el camino.
        const backupCodes = await adminCreds.regenerateBackupCodes();

        await logAttempt(req, '2FA_SETUP', true, { username: current.username });

        res.json({
            success: true,
            otpauthUrl,
            qrCodeUrl: await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 320 }),
            backupCodes,
            warning: adminCreds.HAS_PERSISTENT_VAULT_KEY
                ? undefined
                : 'VAULT_KEY no configurada: el secreto 2FA no sobrevivirá a un reinicio de la API',
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'No se pudo generar el segundo factor' });
    }
});

// ── POST /quick-super-admin/2fa/verify-setup — Confirmar el alta con un código ──
router.post('/quick-super-admin/2fa/verify-setup', requireSuperAdmin, adminRateLimit('2fa-setup', 10), [
    body('code').trim().matches(/^\d{6}$/),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: 'El código debe tener 6 dígitos' });
    }

    try {
        const secret = await adminCreds.getTotpSecret();
        if (!secret) {
            return res.status(400).json({ success: false, error: 'No hay un alta de 2FA en curso. Genera el QR de nuevo.' });
        }
        if (!totp.verify(secret, req.body.code)) {
            await logAttempt(req, '2FA_VERIFY_SETUP', false, {});
            return res.status(401).json({ success: false, error: 'Código 2FA inválido' });
        }

        await adminCreds.enableTotp();
        // Los códigos de respaldo se renuevan al confirmar: los emitidos en
        // /setup pudieron quedarse en una pantalla que nunca llegó a este paso.
        const backupCodes = await adminCreds.regenerateBackupCodes();
        await logAttempt(req, '2FA_VERIFY_SETUP', true, {});

        res.json({ success: true, backupCodes });
    } catch (error) {
        res.status(500).json({ success: false, error: 'No se pudo activar el segundo factor' });
    }
});

// ── POST /bootstrap-complete — Cambio de contraseña obligatorio ──
// Se autentica con el token de propósito 'bootstrap' que devuelve /login, no
// con una sesión: por definición aquí todavía no hay sesión.
router.post('/bootstrap-complete', adminRateLimit('bootstrap'), [
    body('newPassword').isLength({ min: adminCreds.MIN_PASSWORD_LENGTH, max: 128 }),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: `La contraseña debe tener al menos ${adminCreds.MIN_PASSWORD_LENGTH} caracteres`,
        });
    }

    const stepUp = verifyStepUpToken(req, 'bootstrap');
    if (!stepUp) {
        return res.status(401).json({ success: false, error: 'Token de bootstrap inválido o caducado' });
    }

    try {
        const result = await adminCreds.completeBootstrap(req.body.newPassword);
        if (!result.ok) {
            return res.status(result.status || 400).json({ success: false, error: result.error });
        }
        await logAttempt(req, 'BOOTSTRAP', true, { username: result.row.username });

        // Si el despliegue exige 2FA, el bootstrap encadena con el alta en vez
        // de abrir sesión: entrar sin segundo factor tras un cambio forzado de
        // contraseña dejaría justo el hueco que 2FA viene a cerrar.
        if (REQUIRE_2FA && !result.row.totp_enabled) {
            const secret = totp.generateSecret();
            await adminCreds.setTotpSecret(secret);
            const otpauthUrl = totp.otpauthUrl({ secret, account: result.row.username });
            return res.json({
                success: true,
                requiresSetup2FA: true,
                token: issueStepUpToken('2fa', result.row.username),
                otpauthUrl,
                qrCodeUrl: await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 320 }),
                backupCodes: await adminCreds.regenerateBackupCodes(),
                expiresIn: 600,
            });
        }

        res.cookie('bezhas_admin_token', issueSessionToken(result.row.wallet_address), adminCookieOptions());
        res.json({
            success: true,
            role: 'SUPER_ADMIN',
            username: result.row.username,
            walletAddress: result.row.wallet_address || '',
            expiresIn: 7200,
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'No se pudo completar el cambio de contraseña' });
    }
});

// ── POST /local-2fa/verify — Segundo factor del login ──
router.post('/local-2fa/verify', adminRateLimit('2fa-verify', 8), [
    body('code').trim().isLength({ min: 6, max: 16 }),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: 'Código inválido' });
    }

    const stepUp = verifyStepUpToken(req, '2fa');
    if (!stepUp) {
        return res.status(401).json({ success: false, error: 'Sesión de verificación caducada. Vuelve a iniciar sesión.' });
    }

    try {
        const secret = await adminCreds.getTotpSecret();
        const code = String(req.body.code).trim();

        // Un código de 6 dígitos es TOTP; cualquier otra forma se prueba como
        // código de respaldo. Así el mismo campo del formulario sirve para las
        // dos cosas sin que el usuario tenga que elegir.
        let valid = false;
        let usedBackup = false;
        if (/^\d{6}$/.test(code) && secret) {
            valid = totp.verify(secret, code);
        }
        if (!valid) {
            valid = await adminCreds.consumeBackupCode(code);
            usedBackup = valid;
        }

        if (!valid) {
            await logAttempt(req, '2FA', false, { username: stepUp.username, usedBackup });
            return res.status(401).json({ success: false, error: 'Código 2FA inválido' });
        }

        await adminCreds.markTotpVerified();
        const current = await adminCreds.status();
        await logAttempt(req, '2FA', true, { username: stepUp.username, usedBackup });

        res.cookie('bezhas_admin_token', issueSessionToken(current?.walletAddress || null), adminCookieOptions());
        res.json({
            success: true,
            role: 'SUPER_ADMIN',
            username: current?.username || stepUp.username,
            walletAddress: current?.walletAddress || '',
            usedBackupCode: usedBackup,
            backupCodesRemaining: current?.backupCodesRemaining ?? 0,
            expiresIn: 7200,
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'No se pudo verificar el segundo factor' });
    }
});

// ── POST /logout — Clear admin session ──
router.post('/logout', (req, res) => {
    // Mismo path y domain que al ponerla: si no coinciden, el navegador
    // ignora el borrado y la sesión sigue viva hasta que expire el JWT.
    res.clearCookie('bezhas_admin_token', { path: '/', domain: COOKIE_DOMAIN });
    res.json({ success: true });
});

module.exports = router;
