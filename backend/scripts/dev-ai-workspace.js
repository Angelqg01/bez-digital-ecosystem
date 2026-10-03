#!/usr/bin/env node
/**
 * Servidor de DESARROLLO LOCAL del AI Workspace (chat + RAG seguro + login).
 *
 * Arranca sin Postgres, MongoDB ni Redis: los usuarios viven en memoria y se pierden al
 * reiniciar. Monta las rutas REALES (`ai-workspace`, `wallet-auth`) con su `protect`, límites y
 * RAG; solo sustituye el modelo de usuarios y el registro/login por email.
 *
 *   node backend/scripts/dev-ai-workspace.js          # http://localhost:5000
 *   PORT=5001 ANTHROPIC_API_KEY=... node backend/scripts/dev-ai-workspace.js
 *
 * Sin ANTHROPIC_API_KEY ni OPENAI_API_KEY responde en modo local (fragmentos de la documentación).
 * NUNCA se ejecuta con NODE_ENV=production.
 */
const path = require('path');
const crypto = require('crypto');

if (process.env.NODE_ENV === 'production') {
    console.error('dev-ai-workspace no puede ejecutarse con NODE_ENV=production');
    process.exit(1);
}
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
try { require('dotenv').config({ path: path.join(__dirname, '../.env') }); } catch (_) { /* dotenv opcional */ }

// ─── Modelo de usuarios en memoria (sustituye a models/pg/User) ───────────────
const users = new Map(); // id -> user
const byEmail = new Map();
const byWallet = new Map();
let seq = 0;
// Los usuarios solo existen en memoria: nada de lo que se persista debe sobrevivir con un id reutilizable.
process.env.AI_CONVERSATIONS_PERSIST = process.env.AI_CONVERSATIONS_PERSIST || 'false';
process.env.KNOWLEDGE_PERSIST = process.env.KNOWLEDGE_PERSIST || 'false';

const hashPassword = (pw, salt = crypto.randomBytes(16).toString('hex')) =>
    `${salt}:${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
const checkPassword = (pw, stored) => {
    const [salt, hash] = String(stored || '').split(':');
    if (!salt || !hash) return false;
    const a = Buffer.from(hash, 'hex');
    const b = crypto.scryptSync(pw, salt, 64);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const MemoryUser = {
    async create(d) {
        seq += 1;
        const id = `dev-${crypto.randomUUID()}`; // único entre ejecuciones (nunca se reutiliza un id)
        const user = {
            id, _id: id,
            username: d.username || `user${seq}`,
            email: d.email || null,
            password: d.password || null,
            walletAddress: d.walletAddress ? String(d.walletAddress).toLowerCase() : null,
            roles: d.roles || ['USER'],
            role: 'USER',
            subscription: d.subscription || 'FREE',
            createdAt: new Date().toISOString(),
            async save() { return this; },
        };
        users.set(id, user);
        if (user.email) byEmail.set(user.email, user);
        if (user.walletAddress) byWallet.set(user.walletAddress, user);
        return user;
    },
    findById(id) {
        const u = users.get(String(id)) || null;
        const p = Promise.resolve(u);
        p.select = () => Promise.resolve(u);
        return p;
    },
    async findByWallet(w) { return byWallet.get(String(w).toLowerCase()) || null; },
    async findByEmail(e) { return byEmail.get(String(e).toLowerCase()) || null; },
    async findOne() { return null; },
};

// Sustituye los métodos del modelo real (la MISMA clase que usan protect, wallet-auth, etc.).
// Cargar el modelo solo crea el pool de pg; no se conecta hasta la primera consulta.
const RealUser = require('../models/pg/User');
Object.assign(RealUser, {
    create: MemoryUser.create,
    findById: MemoryUser.findById,
    findByWallet: MemoryUser.findByWallet,
    findByEmail: MemoryUser.findByEmail,
    findOne: MemoryUser.findOne,
});

const express = require('express');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/jwtSecret');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// CORS solo para el frontend local (Next en :3000, Vite en :5173).
const ORIGINS = (process.env.DEV_ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173').split(',');
app.use((req, res, next) => {
    if (ORIGINS.includes(req.headers.origin)) {
        res.set({
            'Access-Control-Allow-Origin': req.headers.origin,
            // El cliente usa axios con withCredentials: sin esto el navegador bloquea las respuestas.
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            Vary: 'Origin',
        });
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
});
app.use((req, _res, next) => { req.log = { info() {}, warn: console.warn, error: console.error }; next(); });

const sign = (id) => jwt.sign({ id }, getJwtSecret(), { expiresIn: '7d' });
const publicUser = (u) => ({ id: u.id, username: u.username, email: u.email, walletAddress: u.walletAddress, roles: u.roles });

const DEV_PLANS = ['starter', 'creator', 'business', 'enterprise'];

// ─── Registro / login por email (versión de desarrollo) ───────────────────────
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}$/;
app.post('/api/auth/register-email', async (req, res) => {
    const { email, password, username } = req.body || {};
    if (typeof email !== 'string' || !EMAIL.test(email)) return res.status(400).json({ error: 'Email válido requerido' });
    if (typeof password !== 'string' || password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    if (byEmail.has(email.toLowerCase())) return res.status(409).json({ error: 'Email ya registrado' });
    // Solo en este servidor de desarrollo: `plan` permite probar las funciones de pago (documentos exclusivos, etc.).
    const plan = typeof req.body.plan === 'string' && DEV_PLANS.includes(req.body.plan.toLowerCase()) ? req.body.plan.toLowerCase() : undefined;
    const user = await MemoryUser.create({
        subscription: plan,
        email: email.toLowerCase(), password: hashPassword(password),
        username: typeof username === 'string' && /^[\w .-]{1,50}$/.test(username) ? username : undefined,
    });
    res.status(201).json({ message: 'Usuario registrado exitosamente', user: publicUser(user), token: sign(user.id) });
});

app.post('/api/auth/login-email', async (req, res) => {
    const { email, password } = req.body || {};
    const user = typeof email === 'string' ? byEmail.get(email.toLowerCase()) : null;
    // Mismo mensaje y mismo trabajo (scrypt) exista o no el usuario, para no filtrar cuentas.
    const ok = checkPassword(String(password || ''), user ? user.password : hashPassword('x'));
    if (!user || !ok) return res.status(401).json({ error: 'Credenciales inválidas' });
    res.json({ message: 'Login exitoso', user: publicUser(user), token: sign(user.id) });
});

app.get('/api/health', (_req, res) => res.json({ ok: true, mode: 'dev-ai-workspace', users: users.size }));

// ─── Rutas reales ─────────────────────────────────────────────────────────────
app.use('/api/wallet-auth', require('../routes/wallet-auth.routes'));
app.use('/api/ai-workspace', require('../routes/ai-workspace.routes'));

// Documentos exclusivos de plan (datos de DESARROLLO): solo los planes de pago los recuperan; el plan gratuito, no.
const { knowledge } = require('../services/knowledge');
const devAdmin = { userId: 'dev-seed', tenantId: 'dev-seed', roles: ['ADMIN', 'USER'], plan: 'enterprise' };
setTimeout(() => {
    for (const [id, title, content] of [
        ['excl_001', 'Guía exclusiva: estrategia de staking para clientes Creator', 'Guía exclusiva para clientes de pago. La estrategia de staking recomendada para planes Creator, Business y Enterprise combina un bloqueo de 90 días con reinversión mensual de recompensas, y reserva un 20% para el pool de liquidez de BZ Capital.'],
        ['excl_002', 'Manual exclusivo: tokenización de activos con soporte prioritario', 'Manual exclusivo para clientes de pago. La tokenización de inmuebles incluye simulación previa, valoración independiente, aprobación de cumplimiento y firma segura; los planes Business y Enterprise tienen un gestor dedicado.'],
    ]) {
        knowledge.ingest(devAdmin, { id, title, content, classification: 'PUBLIC', global: true, allowed_plans: ['creator', 'business', 'enterprise'], source: 'dev_exclusive' })
            .catch((e) => console.warn('⚠️ seed exclusivo:', e.message));
    }
}, 200);

app.use((req, res) => res.status(404).json({ error: 'No encontrado' }));

if (require.main === module) {
    const port = Number(process.env.PORT || 5000);
    app.listen(port, () => {
        const { pickProvider } = require('../services/ai-gateway');
        console.log(`\n🧠 AI Workspace (desarrollo) en http://localhost:${port}`);
        console.log(`   Proveedor de IA: ${pickProvider()}${pickProvider() === 'extractive' ? '  (define ANTHROPIC_API_KEY u OPENAI_API_KEY para usar un modelo)' : ''}`);
        console.log('   Usuarios en memoria. Frontend: NEXT_PUBLIC_API_URL=http://localhost:' + port + '\n');
    });
}

module.exports = { app, MemoryUser };
