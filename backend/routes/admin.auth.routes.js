const express = require('express');
const router = express.Router();
const User = require('../models/pg/User');
const { UserRole } = require('../models/mockModels');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const totpService = require('../services/totp.service');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const adminNonces = new Map();
const ADMIN_SESSION_ROLES = ['SUPER_ADMIN', 'ADMIN', 'DEVELOPER', 'DEVOPS', 'SECURITY', 'HUMAN_RESOURCES'];

function getJwtSecret() {
    if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET is required in production');
    }
    return process.env.JWT_SECRET || 'bezhas-local-dev-only-secret';
}

function verifyAdminJwt(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Admin token requerido.' });

    try {
        const decoded = jwt.verify(token, getJwtSecret());
        const role = String(decoded.role || '').toUpperCase();
        const roles = Array.isArray(decoded.roles) ? decoded.roles.map((item) => String(item).toUpperCase()) : [];
        if (!ADMIN_SESSION_ROLES.includes(role) && !roles.some((item) => ADMIN_SESSION_ROLES.includes(item))) {
            return res.status(403).json({ error: 'Acceso admin requerido.' });
        }
        req.admin = decoded;
        return next();
    } catch {
        return res.status(401).json({ error: 'Admin token inválido o expirado.' });
    }
}

function verifyAdminSession(req, res, next) {
    return verifyAdminJwt(req, res, () => {
        const twoFactorRequired = process.env.BOOTSTRAP_ADMIN_REQUIRE_2FA !== 'false';
        if (twoFactorRequired && !req.admin.bootstrap && req.admin.twoFactorVerified !== true) {
            return res.status(403).json({ error: 'Verificación 2FA requerida para Core admin.' });
        }
        return next();
    });
}

function getLocalAdminStorePath() {
    return process.env.LOCAL_ADMIN_STORE_PATH || path.join(__dirname, '..', '.runtime', 'core-admin.json');
}

function loadLocalAdmin() {
    try {
        const raw = fs.readFileSync(getLocalAdminStorePath(), 'utf8');
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function saveLocalAdmin(data) {
    const target = getLocalAdminStorePath();
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(data, null, 2), { mode: 0o600 });
}

function issueAdminToken(payload, expiresIn = '12h') {
    return jwt.sign({
        role: 'SUPER_ADMIN',
        roles: ['SUPER_ADMIN', 'ADMIN', 'DEVELOPER', 'DEVOPS', 'SECURITY'],
        scopes: ['*', 'core:admin', 'core:developer', 'core:security', 'subapp:user', 'subapp:enterprise', 'developer:api', 'node:heartbeat', 'mcp:invoke'],
        twoFactorVerified: true,
        ...payload,
    }, getJwtSecret(), { expiresIn });
}

function sanitizeBackupCodes(backupCodes = []) {
    return Array.isArray(backupCodes) ? backupCodes.filter(Boolean) : [];
}

function getHubEnvPath() {
    return path.resolve(__dirname, '..', '..', '.env');
}

function updateEnvFileValues(updates) {
    const target = getHubEnvPath();
    const existing = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
    let next = existing;

    for (const [key, value] of Object.entries(updates)) {
        const serialized = String(value).includes('$') || String(value).includes(' ')
            ? `"${String(value).replace(/"/g, '\\"')}"`
            : String(value);
        const line = `${key}=${serialized}`;
        const pattern = new RegExp(`^${key}=.*$`, 'm');
        next = pattern.test(next)
            ? next.replace(pattern, line)
            : `${next.replace(/\s*$/, '')}\n${line}\n`;
    }

    fs.writeFileSync(target, next, { mode: 0o600 });
}

function normalizeEnvSecret(value) {
    return String(value || '').trim().replace(/^["']|["']$/g, '');
}

function getQuickSuperAdminStorePath() {
    return process.env.QUICK_SUPER_ADMIN_STORE_PATH || path.join(__dirname, '..', '.runtime', 'quick-super-admin.json');
}

function loadQuickSuperAdminStore() {
    try {
        return JSON.parse(fs.readFileSync(getQuickSuperAdminStorePath(), 'utf8'));
    } catch {
        return {
            passwordHistory: [],
            is2FAEnabled: false,
            twoFactorSecret: null,
            pendingTwoFactorSecret: null,
            backupCodes: [],
        };
    }
}

function saveQuickSuperAdminStore(data) {
    const target = getQuickSuperAdminStorePath();
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(data, null, 2), { mode: 0o600 });
}

async function passwordMatchesAnyHash(password, hashes) {
    for (const hash of hashes.filter(Boolean)) {
        if (await bcrypt.compare(password, hash)) return true;
    }
    return false;
}

// Load Super Admin Wallets from environment
const SUPER_ADMIN_WALLETS = (process.env.SUPER_ADMIN_WALLETS || '')
    .split(',')
    .map(addr => addr.trim().toLowerCase())
    .filter(Boolean);

// Load Admin Wallets from environment
const ADMIN_WALLETS = (process.env.ADMIN_WALLETS || '')
    .split(',')
    .map(addr => addr.trim().toLowerCase())
    .filter(Boolean);

// Load Treasury Wallet from environment
const TREASURY_WALLET = (process.env.TREASURY_WALLET || '').trim().toLowerCase();

// Load Community Wallet from environment
const COMMUNITY_WALLET = (process.env.COMMUNITY_WALLET || '').trim().toLowerCase();

let QUICK_SUPER_ADMIN_WALLET = (process.env.QUICK_SUPER_ADMIN_WALLET || '').trim().toLowerCase();
let QUICK_SUPER_ADMIN_USERNAME = (process.env.QUICK_SUPER_ADMIN_USERNAME || '').trim().toLowerCase();
let QUICK_SUPER_ADMIN_PASSWORD_HASH = normalizeEnvSecret(process.env.QUICK_SUPER_ADMIN_PASSWORD_HASH);
let QUICK_SUPER_ADMIN_REQUIRE_2FA = String(process.env.QUICK_SUPER_ADMIN_REQUIRE_2FA || 'false').toLowerCase() === 'true';

if (QUICK_SUPER_ADMIN_WALLET && !SUPER_ADMIN_WALLETS.includes(QUICK_SUPER_ADMIN_WALLET)) {
    SUPER_ADMIN_WALLETS.push(QUICK_SUPER_ADMIN_WALLET);
}

/**
 * Admin Role Definitions with specific permissions
 */
const ADMIN_ROLES = {
    SUPER_ADMIN: {
        name: 'SUPER_ADMIN',
        label: 'Super Administrador',
        permissions: ['*'], // All permissions
        color: 'gold'
    },
    ADMIN: {
        name: 'ADMIN',
        label: 'Administrador',
        permissions: ['admin.read', 'admin.write', 'admin.users', 'admin.system', 'admin.config'],
        color: 'blue'
    },
    DEVELOPER: {
        name: 'DEVELOPER',
        label: 'Desarrollador',
        permissions: ['admin.read', 'developer.tools', 'developer.debug', 'developer.api', 'developer.logs'],
        color: 'purple'
    },
    TREASURY: {
        name: 'TREASURY',
        label: 'Tesorería',
        permissions: ['admin.read', 'treasury.read', 'treasury.write', 'treasury.transfers', 'dao.treasury'],
        color: 'green'
    },
    DAO: {
        name: 'DAO',
        label: 'DAO Manager',
        permissions: ['admin.read', 'dao.proposals', 'dao.voting', 'dao.governance', 'dao.treasury'],
        color: 'cyan'
    },
    COMMUNITY: {
        name: 'COMMUNITY',
        label: 'Comunidad/Recompensas',
        permissions: ['admin.read', 'community.rewards', 'community.staking', 'community.events'],
        color: 'orange'
    },
    HUMAN_RESOURCES: {
        name: 'HUMAN_RESOURCES',
        label: 'Recursos Humanos',
        permissions: ['admin.read', 'hr.users', 'hr.reports'],
        color: 'pink'
    }
};

/**
 * Get role for a wallet address
 */
function getWalletRole(walletAddress) {
    const normalized = walletAddress.toLowerCase();

    // Check Super Admin first
    if (SUPER_ADMIN_WALLETS.includes(normalized)) {
        return ADMIN_ROLES.SUPER_ADMIN;
    }

    // Check Treasury wallet
    if (TREASURY_WALLET && normalized === TREASURY_WALLET) {
        return ADMIN_ROLES.TREASURY;
    }

    // Check Community wallet
    if (COMMUNITY_WALLET && normalized === COMMUNITY_WALLET) {
        return ADMIN_ROLES.COMMUNITY;
    }

    // Check Admin wallets
    if (ADMIN_WALLETS.includes(normalized)) {
        return ADMIN_ROLES.ADMIN;
    }

    return null;
}

router.get('/auth/nonce', (_req, res) => {
    const nonceId = crypto.randomUUID();
    const nonce = crypto.randomBytes(24).toString('hex');
    adminNonces.set(nonceId, { nonce, createdAt: Date.now() });
    res.json({ nonceId, nonce });
});

function isBootstrapEnabled() {
    if (!process.env.BOOTSTRAP_ADMIN_EMAIL || !process.env.BOOTSTRAP_ADMIN_PASSWORD_HASH) return false;
    if (String(process.env.BOOTSTRAP_ADMIN_DISABLED || '').toLowerCase() === 'true') return false;
    const expiresAt = process.env.BOOTSTRAP_ADMIN_EXPIRES_AT ? Date.parse(process.env.BOOTSTRAP_ADMIN_EXPIRES_AT) : 0;
    return !expiresAt || expiresAt > Date.now();
}

/**
 * POST /api/admin/auth/bootstrap-login
 * Temporary break-glass admin login. The password is never stored in repo; provide a bcrypt hash via env.
 */
router.post('/auth/bootstrap-login', [
    body('username').isString().notEmpty(),
    body('password').isString().notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Credenciales inválidas.' });

    const username = String(req.body.username || '').trim().toLowerCase();
    if (
        QUICK_SUPER_ADMIN_USERNAME &&
        QUICK_SUPER_ADMIN_WALLET &&
        QUICK_SUPER_ADMIN_PASSWORD_HASH &&
        username === QUICK_SUPER_ADMIN_USERNAME
    ) {
        const ok = await bcrypt.compare(String(req.body.password), QUICK_SUPER_ADMIN_PASSWORD_HASH);
        if (!ok) return res.status(401).json({ error: 'Credenciales de administrador inválidas.' });

        const quickStore = loadQuickSuperAdminStore();
        const requiresQuick2FA = QUICK_SUPER_ADMIN_REQUIRE_2FA || quickStore.is2FAEnabled;
        if (requiresQuick2FA && !quickStore.is2FAEnabled) {
            return res.status(403).json({
                error: '2FA requerido para el acceso rápido SuperAdmin. Configúralo desde Identity & Security.',
                requiresSetup2FA: true,
            });
        }

        if (requiresQuick2FA) {
            const tempToken = issueAdminToken({
                id: QUICK_SUPER_ADMIN_WALLET,
                email: `${QUICK_SUPER_ADMIN_USERNAME}@bezhas.local`,
                username: QUICK_SUPER_ADMIN_USERNAME,
                walletAddress: QUICK_SUPER_ADMIN_WALLET,
                wallet_address: QUICK_SUPER_ADMIN_WALLET,
                bootstrap: false,
                pending2FA: true,
                twoFactorVerified: false,
                authMethod: 'quick-super-admin',
            }, '15m');

            return res.json({
                success: true,
                token: tempToken,
                tempToken,
                expiresIn: 15 * 60,
                forcePasswordChange: false,
                requires2FA: true,
                role: 'SUPER_ADMIN',
                walletAddress: QUICK_SUPER_ADMIN_WALLET,
                username: QUICK_SUPER_ADMIN_USERNAME,
            });
        }

        const token = issueAdminToken({
            id: QUICK_SUPER_ADMIN_WALLET,
            email: `${QUICK_SUPER_ADMIN_USERNAME}@bezhas.local`,
            username: QUICK_SUPER_ADMIN_USERNAME,
            walletAddress: QUICK_SUPER_ADMIN_WALLET,
            wallet_address: QUICK_SUPER_ADMIN_WALLET,
            bootstrap: false,
            forcePasswordChange: false,
            twoFactorVerified: true,
            authMethod: 'quick-super-admin',
        });

        res.cookie('bezhas_admin_session', 'active', {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 12 * 60 * 60 * 1000,
        });

        return res.json({
            success: true,
            token,
            expiresIn: 12 * 60 * 60,
            forcePasswordChange: false,
            requires2FA: false,
            adminUrl: '/admin/login',
            role: 'SUPER_ADMIN',
            walletAddress: QUICK_SUPER_ADMIN_WALLET,
            username: QUICK_SUPER_ADMIN_USERNAME,
        });
    }

    const localAdmin = loadLocalAdmin();
    if (localAdmin?.email && username === String(localAdmin.email).toLowerCase()) {
        const ok = await bcrypt.compare(String(req.body.password), localAdmin.passwordHash);
        if (!ok) return res.status(401).json({ error: 'Credenciales de administrador inválidas.' });

        if (process.env.BOOTSTRAP_ADMIN_REQUIRE_2FA !== 'false' && !localAdmin.is2FAEnabled) {
            return res.status(403).json({
                error: '2FA no está habilitado para este admin local. Repite el bootstrap seguro.',
                requiresSetup2FA: true,
            });
        }

        if (process.env.BOOTSTRAP_ADMIN_REQUIRE_2FA !== 'false') {
            const token = issueAdminToken({
                id: localAdmin.id || 'local-core-admin',
                email: localAdmin.email,
                bootstrap: false,
                pending2FA: true,
                twoFactorVerified: false,
                forcePasswordChange: false,
            }, '15m');

            return res.json({
                success: true,
                token,
                tempToken: token,
                expiresIn: 15 * 60,
                forcePasswordChange: false,
                requires2FA: true,
                adminUrl: '/admin/login',
            });
        }

        const token = issueAdminToken({
            id: localAdmin.id || 'local-core-admin',
            email: localAdmin.email,
            bootstrap: false,
            forcePasswordChange: false,
        });

        res.cookie('bezhas_admin_session', 'active', {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 12 * 60 * 60 * 1000,
        });

        return res.json({
            success: true,
            token,
            expiresIn: 12 * 60 * 60,
            forcePasswordChange: false,
            requires2FA: false,
            adminUrl: '/admin/login',
        });
    }

    if (!isBootstrapEnabled()) {
        return res.status(403).json({ error: 'Bootstrap admin no está habilitado o ha expirado.' });
    }

    const expectedEmail = process.env.BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase();
    if (username !== expectedEmail) {
        return res.status(401).json({ error: 'Credenciales de administrador inválidas.' });
    }

    const ok = await bcrypt.compare(String(req.body.password), process.env.BOOTSTRAP_ADMIN_PASSWORD_HASH);
    if (!ok) return res.status(401).json({ error: 'Credenciales de administrador inválidas.' });

    const token = issueAdminToken({
        id: 'bootstrap-admin',
        email: expectedEmail,
        bootstrap: true,
        forcePasswordChange: process.env.BOOTSTRAP_ADMIN_FORCE_PASSWORD_CHANGE !== 'false',
        twoFactorVerified: process.env.BOOTSTRAP_ADMIN_REQUIRE_2FA === 'false',
    }, '30m');

    res.cookie('bezhas_admin_session', 'active', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 60 * 1000,
    });

    res.json({
        success: true,
        token,
        expiresIn: 30 * 60,
        forcePasswordChange: true,
        requires2FA: process.env.BOOTSTRAP_ADMIN_REQUIRE_2FA !== 'false',
        adminUrl: '/admin/login',
        message: 'Bootstrap admin autenticado. Cambia la contraseña y configura 2FA antes de operación normal.',
    });
});

router.post('/auth/bootstrap-complete', verifyAdminSession, [
    body('newPassword').isString().isLength({ min: 14 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 14 caracteres.' });
    }
    if (!req.admin.bootstrap) {
        return res.status(403).json({ error: 'Este endpoint solo completa un bootstrap activo.' });
    }

    const email = String(req.admin.email || process.env.BOOTSTRAP_ADMIN_EMAIL || '').toLowerCase();
    if (!email) return res.status(400).json({ error: 'No hay email admin disponible para guardar.' });

    const passwordHash = await bcrypt.hash(String(req.body.newPassword), 12);
    const twoFactorRequired = process.env.BOOTSTRAP_ADMIN_REQUIRE_2FA !== 'false';
    const setupData = twoFactorRequired ? await totpService.generate2FASecret(email) : null;

    saveLocalAdmin({
        id: 'local-core-admin',
        email,
        passwordHash,
        roles: ['SUPER_ADMIN', 'ADMIN', 'DEVOPS', 'SECURITY'],
        twoFactorSecret: setupData ? totpService.encryptSecret(setupData.secret) : null,
        backupCodes: setupData ? sanitizeBackupCodes(setupData.backupCodes) : [],
        is2FAEnabled: !twoFactorRequired,
        createdAt: new Date().toISOString(),
        rotatedAt: new Date().toISOString(),
    });

    const token = issueAdminToken({
        id: 'local-core-admin',
        email,
        bootstrap: twoFactorRequired,
        pending2FA: twoFactorRequired,
        forcePasswordChange: false,
        twoFactorVerified: !twoFactorRequired,
    }, twoFactorRequired ? '30m' : '12h');

    res.json({
        success: true,
        token,
        expiresIn: twoFactorRequired ? 30 * 60 : 12 * 60 * 60,
        requiresSetup2FA: twoFactorRequired,
        qrCodeUrl: setupData?.qrCodeUrl,
        otpauthUrl: setupData?.otpauthUrl,
        backupCodes: setupData?.backupCodes || [],
        message: twoFactorRequired
            ? 'Admin local creado. Escanea el QR y verifica 2FA para activar la sesión final.'
            : 'Admin local creado. Deshabilita BOOTSTRAP_ADMIN_* o define BOOTSTRAP_ADMIN_DISABLED=true y reinicia.',
    });
});

router.post('/auth/local-2fa/verify', verifyAdminJwt, [
    body('code').isString().isLength({ min: 6, max: 12 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Código 2FA inválido.' });

    if (req.admin.authMethod === 'quick-super-admin') {
        const quickStore = loadQuickSuperAdminStore();
        if (!quickStore.is2FAEnabled || !quickStore.twoFactorSecret) {
            return res.status(400).json({ error: '2FA SuperAdmin no está configurado.' });
        }

        const rawCode = String(req.body.code || '').replace(/\s/g, '');
        const secret = totpService.decryptSecret(quickStore.twoFactorSecret);
        let valid = totpService.verify2FAToken(rawCode, secret);
        let backupCodes = sanitizeBackupCodes(quickStore.backupCodes);

        if (!valid && rawCode.length === 8) {
            const backupResult = totpService.verifyBackupCode(rawCode, backupCodes);
            valid = backupResult.valid;
            backupCodes = backupResult.remainingCodes;
        }

        if (!valid) return res.status(401).json({ error: 'Código 2FA inválido.' });

        saveQuickSuperAdminStore({
            ...quickStore,
            backupCodes,
            last2FAVerifiedAt: new Date().toISOString(),
        });

        const token = issueAdminToken({
            id: QUICK_SUPER_ADMIN_WALLET,
            email: `${QUICK_SUPER_ADMIN_USERNAME}@bezhas.local`,
            username: QUICK_SUPER_ADMIN_USERNAME,
            walletAddress: QUICK_SUPER_ADMIN_WALLET,
            wallet_address: QUICK_SUPER_ADMIN_WALLET,
            bootstrap: false,
            pending2FA: false,
            forcePasswordChange: false,
            twoFactorVerified: true,
            authMethod: 'quick-super-admin',
        });

        return res.json({
            success: true,
            token,
            expiresIn: 12 * 60 * 60,
            role: 'SUPER_ADMIN',
            walletAddress: QUICK_SUPER_ADMIN_WALLET,
            username: QUICK_SUPER_ADMIN_USERNAME,
            message: '2FA SuperAdmin verificado. Sesión global activada.',
        });
    }

    const localAdmin = loadLocalAdmin();
    if (!localAdmin?.twoFactorSecret) {
        return res.status(400).json({ error: '2FA local no fue iniciado.' });
    }
    if (String(req.admin.email || '').toLowerCase() !== String(localAdmin.email || '').toLowerCase()) {
        return res.status(403).json({ error: 'El token no corresponde al admin local.' });
    }

    const rawCode = String(req.body.code || '').replace(/\s/g, '');
    const secret = totpService.decryptSecret(localAdmin.twoFactorSecret);
    let valid = totpService.verify2FAToken(rawCode, secret);
    let backupCodes = sanitizeBackupCodes(localAdmin.backupCodes);

    if (!valid && rawCode.length === 8) {
        const backupResult = totpService.verifyBackupCode(rawCode, backupCodes);
        valid = backupResult.valid;
        backupCodes = backupResult.remainingCodes;
    }

    if (!valid) return res.status(401).json({ error: 'Código 2FA inválido.' });

    saveLocalAdmin({
        ...localAdmin,
        backupCodes,
        is2FAEnabled: true,
        twoFactorEnabledAt: localAdmin.twoFactorEnabledAt || new Date().toISOString(),
        rotatedAt: new Date().toISOString(),
    });

    const token = issueAdminToken({
        id: localAdmin.id || 'local-core-admin',
        email: localAdmin.email,
        bootstrap: false,
        pending2FA: false,
        forcePasswordChange: false,
        twoFactorVerified: true,
    });

    res.json({
        success: true,
        token,
        expiresIn: 12 * 60 * 60,
        message: '2FA verificado. Sesión admin Core activada.',
    });
});

router.post('/auth/quick-super-admin/rotate', verifyAdminSession, [
    body('username').isString().trim().isLength({ min: 3, max: 80 }).matches(/^[a-zA-Z0-9._@-]+$/),
    body('currentPassword').isString().notEmpty(),
    body('newPassword').isString().isLength({ min: 1, max: 128 }),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Usuario o contraseña inválidos.' });
    }

    const role = String(req.admin.role || '').toUpperCase();
    const roles = Array.isArray(req.admin.roles) ? req.admin.roles.map((item) => String(item).toUpperCase()) : [];
    if (role !== 'SUPER_ADMIN' && !roles.includes('SUPER_ADMIN')) {
        return res.status(403).json({ error: 'Solo SUPER_ADMIN puede rotar estas credenciales.' });
    }

    if (!QUICK_SUPER_ADMIN_WALLET) {
        return res.status(400).json({ error: 'QUICK_SUPER_ADMIN_WALLET no está configurado.' });
    }

    const username = String(req.body.username || '').trim().toLowerCase();
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    const currentOk = await bcrypt.compare(currentPassword, QUICK_SUPER_ADMIN_PASSWORD_HASH);
    if (!currentOk) {
        return res.status(401).json({ error: 'La contraseña actual no es correcta.' });
    }

    const quickStore = loadQuickSuperAdminStore();
    const previousHashes = [QUICK_SUPER_ADMIN_PASSWORD_HASH, ...sanitizeBackupCodes(quickStore.passwordHistory)].slice(0, 4);
    if (await passwordMatchesAnyHash(newPassword, previousHashes)) {
        return res.status(409).json({
            error: 'La nueva contraseña coincide con una de las últimas 3 contraseñas o con la actual. Elige una contraseña nueva.',
            code: 'PASSWORD_REUSED',
        });
    }
    if (newPassword.length < 14) {
        return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 14 caracteres.' });
    }

    const passwordHash = await bcrypt.hash(String(req.body.newPassword), 12);

    updateEnvFileValues({
        QUICK_SUPER_ADMIN_USERNAME: username,
        QUICK_SUPER_ADMIN_PASSWORD_HASH: passwordHash,
    });

    saveQuickSuperAdminStore({
        ...quickStore,
        passwordHistory: [QUICK_SUPER_ADMIN_PASSWORD_HASH, ...sanitizeBackupCodes(quickStore.passwordHistory)].slice(0, 3),
        lastPasswordRotatedAt: new Date().toISOString(),
    });

    process.env.QUICK_SUPER_ADMIN_USERNAME = username;
    process.env.QUICK_SUPER_ADMIN_PASSWORD_HASH = passwordHash;
    QUICK_SUPER_ADMIN_USERNAME = username;
    QUICK_SUPER_ADMIN_PASSWORD_HASH = passwordHash;

    return res.json({
        success: true,
        username,
        walletAddress: QUICK_SUPER_ADMIN_WALLET,
        message: 'Credenciales rápidas SuperAdmin rotadas. Usa el nuevo usuario y contraseña en el próximo login.',
    });
});

router.get('/auth/quick-super-admin/status', verifyAdminSession, (_req, res) => {
    const quickStore = loadQuickSuperAdminStore();
    return res.json({
        success: true,
        username: QUICK_SUPER_ADMIN_USERNAME,
        walletAddress: QUICK_SUPER_ADMIN_WALLET,
        twoFactorEnabled: Boolean(quickStore.is2FAEnabled),
        passwordHistoryCount: sanitizeBackupCodes(quickStore.passwordHistory).length,
        lastPasswordRotatedAt: quickStore.lastPasswordRotatedAt || null,
        last2FAVerifiedAt: quickStore.last2FAVerifiedAt || null,
    });
});

router.post('/auth/quick-super-admin/2fa/setup', verifyAdminSession, async (_req, res) => {
    const quickStore = loadQuickSuperAdminStore();
    const setupData = await totpService.generate2FASecret(QUICK_SUPER_ADMIN_USERNAME || QUICK_SUPER_ADMIN_WALLET);

    saveQuickSuperAdminStore({
        ...quickStore,
        pendingTwoFactorSecret: totpService.encryptSecret(setupData.secret),
        pendingBackupCodes: setupData.backupCodes,
        pending2FACreatedAt: new Date().toISOString(),
    });

    return res.json({
        success: true,
        qrCodeUrl: setupData.qrCodeUrl,
        otpauthUrl: setupData.otpauthUrl,
        backupCodes: setupData.backupCodes,
        message: 'Escanea el QR con Google Authenticator/Authy y verifica el código para activar 2FA.',
    });
});

router.post('/auth/quick-super-admin/2fa/verify-setup', verifyAdminSession, [
    body('code').isString().isLength({ min: 6, max: 12 }),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Código 2FA inválido.' });

    const quickStore = loadQuickSuperAdminStore();
    if (!quickStore.pendingTwoFactorSecret) {
        return res.status(400).json({ error: 'No hay configuración 2FA pendiente.' });
    }

    const rawCode = String(req.body.code || '').replace(/\s/g, '');
    const secret = totpService.decryptSecret(quickStore.pendingTwoFactorSecret);
    if (!totpService.verify2FAToken(rawCode, secret)) {
        return res.status(401).json({ error: 'Código 2FA inválido.' });
    }

    saveQuickSuperAdminStore({
        ...quickStore,
        is2FAEnabled: true,
        twoFactorSecret: quickStore.pendingTwoFactorSecret,
        backupCodes: sanitizeBackupCodes(quickStore.pendingBackupCodes),
        pendingTwoFactorSecret: null,
        pendingBackupCodes: [],
        twoFactorEnabledAt: new Date().toISOString(),
    });

    process.env.QUICK_SUPER_ADMIN_REQUIRE_2FA = 'true';
    QUICK_SUPER_ADMIN_REQUIRE_2FA = true;
    updateEnvFileValues({ QUICK_SUPER_ADMIN_REQUIRE_2FA: 'true' });

    return res.json({
        success: true,
        backupCodes: sanitizeBackupCodes(quickStore.pendingBackupCodes),
        message: '2FA SuperAdmin activado. El próximo login requerirá código de la app.',
    });
});

router.post('/auth/quick-super-admin/2fa/disable', verifyAdminSession, [
    body('code').isString().isLength({ min: 6, max: 12 }),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Código 2FA inválido.' });

    const quickStore = loadQuickSuperAdminStore();
    if (!quickStore.is2FAEnabled || !quickStore.twoFactorSecret) {
        return res.status(400).json({ error: '2FA SuperAdmin no está activo.' });
    }

    const rawCode = String(req.body.code || '').replace(/\s/g, '');
    const secret = totpService.decryptSecret(quickStore.twoFactorSecret);
    if (!totpService.verify2FAToken(rawCode, secret)) {
        return res.status(401).json({ error: 'Código 2FA inválido.' });
    }

    saveQuickSuperAdminStore({
        ...quickStore,
        is2FAEnabled: false,
        twoFactorSecret: null,
        backupCodes: [],
        twoFactorDisabledAt: new Date().toISOString(),
    });

    process.env.QUICK_SUPER_ADMIN_REQUIRE_2FA = 'false';
    QUICK_SUPER_ADMIN_REQUIRE_2FA = false;
    updateEnvFileValues({ QUICK_SUPER_ADMIN_REQUIRE_2FA: 'false' });

    return res.json({ success: true, message: '2FA SuperAdmin desactivado.' });
});

/**
 * Verify admin permissions
 * GET /api/admin/verify-permissions
 */
router.get('/verify-permissions', verifyAdminSession, async (req, res) => {
    try {
        const walletAddress = req.headers['x-wallet-address'] || req.admin.walletAddress || req.admin.wallet_address;

        if (!walletAddress) {
            return res.json({
                authorized: true,
                role: req.admin.role,
                roleLabel: req.admin.role,
                permissions: req.admin.scopes || [],
                roleColor: 'blue'
            });
        }

        const normalizedAddress = walletAddress.toLowerCase();

        // Check wallet-based roles first (env-configured wallets)
        const walletRole = getWalletRole(normalizedAddress);
        if (walletRole) {
            return res.json({
                authorized: true,
                role: walletRole.name,
                roleLabel: walletRole.label,
                permissions: walletRole.permissions,
                roleColor: walletRole.color
            });
        }

        // Check in database for user-based roles
        const user = await User.findOne({
            walletAddress: normalizedAddress
        });

        if (!user) {
            return res.status(403).json({
                authorized: false,
                message: 'User not found'
            });
        }

        // Check if user has Admin or Developer role
        const allowedRoles = [UserRole.ADMIN, UserRole.DEVELOPER];
        if (allowedRoles.includes(user.role)) {
            const roleConfig = user.role === UserRole.ADMIN
                ? ADMIN_ROLES.ADMIN
                : ADMIN_ROLES.DEVELOPER;

            return res.json({
                authorized: true,
                role: roleConfig.name,
                roleLabel: roleConfig.label,
                permissions: roleConfig.permissions,
                roleColor: roleConfig.color
            });
        }

        // Not authorized
        return res.status(403).json({
            authorized: false,
            message: `Insufficient permissions. Current role: ${user.role}`,
            requiredRoles: ['SUPER_ADMIN', 'ADMIN', 'DEVELOPER', 'TREASURY', 'DAO', 'COMMUNITY']
        });

    } catch (error) {
        console.error('Error verifying admin permissions:', error);
        res.status(500).json({
            authorized: false,
            message: 'Internal server error'
        });
    }
});

/**
 * Check if user is Super Admin
 * GET /api/admin/check-super-admin
 */
router.get('/check-super-admin', verifyAdminSession, async (req, res) => {
    try {
        const walletAddress = req.headers['x-wallet-address'] || req.admin.walletAddress || req.admin.wallet_address;

        if (!walletAddress) {
            return res.json({ isSuperAdmin: String(req.admin.role || '').toUpperCase() === 'SUPER_ADMIN' });
        }

        const normalizedAddress = walletAddress.toLowerCase();
        const isSuperAdmin = SUPER_ADMIN_WALLETS.includes(normalizedAddress);

        res.json({ isSuperAdmin });

    } catch (error) {
        console.error('Error checking super admin:', error);
        res.json({ isSuperAdmin: false });
    }
});

/**
 * Get current user's admin info
 * GET /api/admin/me
 */
router.get('/me', verifyAdminSession, async (req, res) => {
    try {
        const walletAddress = req.headers['x-wallet-address'] || req.admin.walletAddress || req.admin.wallet_address;

        if (!walletAddress) {
            return res.json({
                id: req.admin.id,
                email: req.admin.email,
                role: req.admin.role,
                roles: req.admin.roles || [req.admin.role],
                permissions: req.admin.scopes || [],
                forcePasswordChange: Boolean(req.admin.forcePasswordChange),
                bootstrap: Boolean(req.admin.bootstrap)
            });
        }

        const normalizedAddress = walletAddress.toLowerCase();

        // Check wallet-based roles first (env-configured wallets)
        const walletRole = getWalletRole(normalizedAddress);
        if (walletRole) {
            return res.json({
                walletAddress: normalizedAddress,
                role: walletRole.name,
                roleLabel: walletRole.label,
                isSuperAdmin: walletRole.name === 'SUPER_ADMIN',
                permissions: walletRole.permissions,
                roleColor: walletRole.color
            });
        }

        // Check in database
        const user = await User.findOne({
            walletAddress: normalizedAddress
        });

        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        const allowedRoles = [UserRole.ADMIN, UserRole.DEVELOPER];
        if (!allowedRoles.includes(user.role)) {
            return res.status(403).json({
                error: 'Insufficient permissions'
            });
        }

        const roleConfig = user.role === UserRole.ADMIN
            ? ADMIN_ROLES.ADMIN
            : ADMIN_ROLES.DEVELOPER;

        res.json({
            walletAddress: normalizedAddress,
            role: roleConfig.name,
            roleLabel: roleConfig.label,
            isSuperAdmin: false,
            username: user.username,
            email: user.email,
            permissions: roleConfig.permissions,
            roleColor: roleConfig.color
        });

    } catch (error) {
        console.error('Error getting admin info:', error);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});

/**
 * Get all admin roles configuration
 * GET /api/admin/roles
 */
router.get('/roles', verifyAdminSession, async (req, res) => {
    try {
        res.json({
            success: true,
            roles: ADMIN_ROLES,
            configuredWallets: {
                superAdminCount: SUPER_ADMIN_WALLETS.length,
                adminCount: ADMIN_WALLETS.length,
                hasTreasury: !!TREASURY_WALLET,
                hasCommunity: !!COMMUNITY_WALLET
            }
        });
    } catch (error) {
        console.error('Error getting roles:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Helper to get user by temp token without 2fa_verified claim
 */
const verifyTempToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token requerido' });

    try {
        const decoded = jwt.verify(token, getJwtSecret());
        req.tempAdmin = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
    }
};

/**
 * @route   POST /api/admin/auth/oauth/google
 * @desc    Admin login with Google. Requires 2FA follow-up.
 */
router.post('/oauth/google', [
    body('idToken').isString().notEmpty()
], async (req, res) => {
    try {
        const { idToken } = req.body;
        const googleClientId = process.env.GOOGLE_CLIENT_ID;
        
        let payload;
        if (googleClientId && !googleClientId.includes('YOUR_GOOGLE_CLIENT_ID')) {
            const { OAuth2Client } = require('google-auth-library');
            const client = new OAuth2Client(googleClientId);
            const ticket = await client.verifyIdToken({ idToken, audience: googleClientId });
            payload = ticket.getPayload();
        } else {
            console.warn('⚠️ Admin Google Auth: SIMULATION MODE');
            payload = {
                email: `admin_${Date.now()}@bez.digital`,
                name: 'Simulated Admin',
                sub: `google_admin_${Date.now()}`
            };
        }

        const email = payload.email.toLowerCase();
        
        // Find existing user or create one (only if they are an admin by config)
        let user = await User.findOne({ email });
        
        // Check if user is actually an admin
        // Note: For a real platform, you might check if they are in an ALLOWED_ADMIN_EMAILS list,
        // but here we check if their existing user profile has an ADMIN role, OR we just let them log in 
        // to setup if we want to bootstrap. Let's assume user must already have admin roles in DB.
        
        if (!user) {
            // Check if it's the environment wallet... wait, we only have emails from Google.
            // So we must have seeded them. We'll create the user if it's a known admin domain or just let them be USER
            return res.status(403).json({ error: 'Usuario no encontrado o no tiene permisos de administrador.' });
        }

        const isAdmin = user.roles && (
            user.roles.includes('ADMIN') || 
            user.roles.includes('SUPER_ADMIN') || 
            user.roles.includes('DEVELOPER') ||
            user.roles.includes('HUMAN_RESOURCES')
        );

        if (!isAdmin) {
            return res.status(403).json({ error: 'Esta cuenta de Google no tiene privilegios de administrador.' });
        }

        // Generate temporary token for 2FA progression
        const tempToken = jwt.sign({ id: user._id, role: 'admin', isTemp: true }, getJwtSecret(), { expiresIn: '15m' });

        if (user.is2FAEnabled) {
            return res.json({
                message: '2FA Requerido',
                requires2FA: true,
                tempToken
            });
        } else {
            return res.json({
                message: 'Configuración 2FA Requerida',
                requiresSetup2FA: true,
                tempToken
            });
        }
    } catch (error) {
        console.error('Error in Admin Google Auth:', error);
        res.status(500).json({ error: 'Error en autenticación administrativa.' });
    }
});

/**
 * @route   POST /api/admin/auth/wallet
 * @desc    Admin login with Wallet Address (WA). Requires 2FA follow-up.
 */
router.post('/wallet', [
    body('walletAddress').optional().isString(),
    body('address').optional().isString()
], async (req, res) => {
    try {
        const walletAddress = req.body.walletAddress || req.body.address;
        if (!walletAddress) return res.status(400).json({ error: 'walletAddress requerido.' });
        const normalizedAddress = walletAddress.toLowerCase();
        const nonceRecord = req.body.nonceId ? adminNonces.get(req.body.nonceId) : null;
        if (req.body.nonceId) {
            adminNonces.delete(req.body.nonceId);
            if (!nonceRecord || Date.now() - nonceRecord.createdAt > 5 * 60 * 1000) {
                return res.status(401).json({ error: 'Nonce inválido o expirado.' });
            }
        }
        
        let user = await (User.findOne ? User.findOne({ walletAddress: normalizedAddress }) : User.findByWallet(normalizedAddress));
        
        if (!user) {
            // Check if it's the environment wallet manually bypassing DB for super admins
            const walletRole = getWalletRole(normalizedAddress);
            if (!walletRole) {
                return res.status(403).json({ error: 'Wallet no encontrada o no tiene permisos de administrador.' });
            }
            
            user = {
                _id: normalizedAddress,
                id: normalizedAddress,
                walletAddress: normalizedAddress,
                username: `Admin_${normalizedAddress.slice(2, 8)}`,
                email: `admin_${normalizedAddress.slice(2, 8)}@bezhas.local`,
                role: walletRole.name,
                roles: [walletRole.name]
            };
        }

        const isAdmin = user.roles && (
            user.roles.includes('ADMIN') || 
            user.roles.includes('SUPER_ADMIN') || 
            user.roles.includes('DEVELOPER') ||
            user.roles.includes('HUMAN_RESOURCES') ||
            user.role === 'ADMIN' ||
            user.role === 'DEVELOPER' ||
            user.role === 'SUPER_ADMIN'
        );

        if (!isAdmin && !getWalletRole(normalizedAddress)) {
            return res.status(403).json({ error: 'Esta wallet no tiene privilegios de administrador.' });
        }

        // Generate temporary token for 2FA progression
        const tempToken = jwt.sign({ id: user._id || user.id, role: 'admin', isTemp: true }, getJwtSecret(), { expiresIn: '15m' });

        if (user.is2FAEnabled) {
            return res.json({
                message: '2FA Requerido',
                requires2FA: true,
                tempToken
            });
        } else {
            return res.json({
                message: 'Configuración 2FA Requerida',
                requiresSetup2FA: true,
                tempToken
            });
        }
    } catch (error) {
        console.error('Error in Admin Wallet Auth:', error);
        res.status(500).json({ error: 'Error en autenticación administrativa.' });
    }
});

/**
 * @route   POST /api/admin/auth/2fa/setup
 * @desc    Generate 2FA secret for admin
 */
router.post('/2fa/setup', verifyTempToken, async (req, res) => {
    try {
        const user = await User.findById(req.tempAdmin.id);
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
        
        if (user.is2FAEnabled) {
            return res.status(400).json({ error: '2FA ya está habilitado para este administrador.' });
        }

        const setupData = await totpService.generate2FASecret(user.email);
        
        // Save encrypted secret
        user.twoFactorSecret = totpService.encryptSecret(setupData.secret);
        await user.save();

        res.json({
            qrCodeUrl: setupData.qrCodeUrl,
            backupCodes: setupData.backupCodes
        });
    } catch (error) {
        console.error('Error setting up admin 2FA:', error);
        res.status(500).json({ error: 'Error configurando 2FA' });
    }
});

/**
 * @route   POST /api/admin/auth/2fa/verify
 * @desc    Verify 2FA token to finalize login or setup
 */
router.post('/2fa/verify', [
    body('code').isString().notEmpty()
], verifyTempToken, async (req, res) => {
    try {
        const { code, backupCodes } = req.body; // Backup codes provided if it's the setup step
        const user = await User.findById(req.tempAdmin.id).select('+twoFactorSecret +backupCodes');
        
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
        if (!user.twoFactorSecret) return res.status(400).json({ error: '2FA setup was not initiated' });

        const secret = totpService.decryptSecret(user.twoFactorSecret);
        
        // For login via backup code
        if (code.length === 8 && user.is2FAEnabled) {
            const backupResult = totpService.verifyBackupCode(code, user.backupCodes);
            if (!backupResult.valid) return res.status(401).json({ error: 'Código de respaldo inválido' });
            
            user.backupCodes = backupResult.remainingCodes;
            await user.save();
        } else {
            // Normal TOTP verification
            const isValid = totpService.verify2FAToken(code, secret);
            if (!isValid) return res.status(401).json({ error: 'Código 2FA inválido' });
        }

        // If it was setup, activate 2FA
        if (!user.is2FAEnabled) {
            user.is2FAEnabled = true;
            if (backupCodes) user.backupCodes = backupCodes;
            await user.save();
        }

        // Issue final Admin JWT with twoFactorVerified: true
        const finalToken = jwt.sign({ 
            id: user._id, 
            role: 'admin', 
            twoFactorVerified: true 
        }, getJwtSecret(), { expiresIn: '12h' });

        res.json({
            message: 'Autenticación exitosa',
            token: finalToken,
            user: {
                id: user._id,
                email: user.email,
                username: user.username,
                roles: user.roles
            }
        });
    } catch (error) {
        console.error('Error verifying admin 2FA:', error);
        res.status(500).json({ error: 'Error verificando 2FA' });
    }
});

module.exports = router;
