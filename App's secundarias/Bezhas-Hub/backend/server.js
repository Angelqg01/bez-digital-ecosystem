console.log('🚀 Starting server initialization...');

// Lista de errores conocidos que no deben detener el servidor
const IGNORABLE_ERRORS = [
    'ECONNREFUSED',
    'filter not found',
    'could not coalesce error',
    'Redis connection',
    'Failed to reconnect',
    'ERR max requests limit exceeded', // Upstash free tier limit
    'max requests limit',              // Upstash variant
    'ReplyError',                      // ioredis/Redis command errors
    '@bezhas/sdk',                     // SDK optional modules (farming, governance, oracle)
    'ERR_MODULE_NOT_FOUND',            // ESM module resolution failures
    'Cannot find module',              // CJS module resolution failures
    'Cannot find package',             // NPM package resolution failures
];


process.on('uncaughtException', (err, origin) => {
    const errorMessage = err.message || '';
    const errorStack = err.stack || '';

    // Verificar si es un error ignorable
    const isIgnorable = IGNORABLE_ERRORS.some(pattern =>
        errorMessage.includes(pattern) || errorStack.includes(pattern)
    );

    if (isIgnorable) {
        console.warn(`⚠️  Non-fatal error (${origin}): ${errorMessage}`);
        return; // No detener el servidor
    }

    // Solo detener por errores críticos de sintaxis o módulos faltantes
    console.error(`\n${'='.repeat(80)}`);
    console.error(`FATAL: Excepción no capturada: ${err.message}`);
    console.error(`Origen: ${origin}`);
    console.error(`Stack trace:`);
    console.error(err.stack);
    console.error(`${'='.repeat(80)}\n`);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    const reasonStr = reason?.toString() || '';

    // Ignorar rechazos de promesas relacionados con Redis y RPC
    const isIgnorable = IGNORABLE_ERRORS.some(pattern =>
        reasonStr.includes(pattern)
    );

    if (isIgnorable) {
        console.warn(`⚠️  Non-fatal rejection: ${reasonStr}`);
        return;
    }

    console.error(`\n${'='.repeat(80)}`);
    console.error('FATAL: Rechazo de promesa no manejado:', reason);
    console.error(`${'='.repeat(80)}\n`);
    // Se recomienda no cerrar en unhandledRejection, pero para diagnóstico es útil
    // process.exit(1); 
});

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// --- BEZHAS AUTOMATION ENGINES ---
// 1. Reward System (Weekly, Quality-Based, Threshold-Check)
// TEMPORARILY DISABLED - Requires MongoDB connection
// require('./services/automation/rewardSystem.service');

// 2. MCP Intelligence Scheduler (Gas, Price, Holders, DAO — auto every N min)
try {
    const mcpScheduler = require('./services/mcp-scheduler.service');
    if (process.env.NODE_ENV !== 'test') {
        mcpScheduler.start();
        console.log('✅ MCP Scheduler started');
    } else {
        console.log('ℹ️ MCP Scheduler disabled in test environment');
    }
} catch (e) {
    console.warn('⚠️  MCP Scheduler not available:', e.message);
}

// 2. Third Party Usage Analysis Service
const ThirdPartyAnalyzer = process.env.NODE_ENV === 'test'
    ? null
    : require('./services/automation/thirdPartyAnalyzer.service');
// 3. Diagnostic Agent (Auto-Recovery, Health Monitoring)
const DiagnosticService = process.env.NODE_ENV === 'test'
    ? null
    : require('./services/automation/diagnosticAgent.service');
// 4. Webhook-Blockchain Bridge (External Sales -> On-chain Rewards)
if (process.env.NODE_ENV !== 'test') {
    const WebhookBridge = require('./services/bridge/WebhookBlockchainBridge');
    WebhookBridge.init();
}

const cron = require('node-cron');
// ---------------------------------
const validator = require('validator');
const http = require('http');
const { ethers } = require('ethers');
const jwt = require('jsonwebtoken');
let User;
try {
    User = require('./models/user.model');
} catch (error) {
    console.warn('⚠️ Mongo user model unavailable, using PG/local user model:', error.message);
    User = require('./models/pg/User');
}

// Suppress ethers.js annoying console logs
const originalConsoleError = console.error;
console.error = (...args) => {
    // Filter out repetitive ethers.js provider errors
    const message = args[0]?.toString() || '';
    if (message.includes('JsonRpcProvider failed to detect network') ||
        message.includes('retry in 1s') ||
        message.includes('filter not found') ||
        message.includes('could not coalesce error') ||
        message.includes('ECONNREFUSED') ||
        message.includes('AggregateError')) {
        return; // Suppress these specific errors
    }
    originalConsoleError.apply(console, args);
};

// Load and validate environment variables early
const config = require('./config');
console.log('✅ config loaded');

const FORBIDDEN_PRODUCTION_SECRET_VALUES = new Set([
    'default_secret',
    'supersecret_fallback_change_in_prod',
    'dev-admin-token-12345-very-secure-token',
    'dev-jwt-secret-key-for-bezhas-platform-2024-very-long-and-secure',
    'dev-contact-encryption-key-32-characters-long-string'
]);

function assertProductionSecret(name, { minLength = 32 } = {}) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is required in production`);
    }
    if (value.length < minLength || FORBIDDEN_PRODUCTION_SECRET_VALUES.has(value)) {
        throw new Error(`${name} must be rotated from the development/default value before production`);
    }
}

function validateProductionSecrets() {
    if (process.env.NODE_ENV !== 'production') return;

    assertProductionSecret('JWT_SECRET', { minLength: 32 });
    assertProductionSecret('ADMIN_TOKEN', { minLength: 32 });
    assertProductionSecret('CONTACT_ENCRYPTION_KEY', { minLength: 32 });
    if (process.env.AUTH_BYPASS_ENABLED === 'true') {
        throw new Error('AUTH_BYPASS_ENABLED must be false in production');
    }
}

validateProductionSecrets();

const { GoogleGenerativeAI } = require('@google/generative-ai');
console.log('✅ GoogleGenerativeAI loaded');
const { WebSocketServer, setWebSocketServerInstance, startAdEventSimulation } = require('./websocket-server');
console.log('✅ WebSocketServer loaded');
const pino = require('pino');
const expressPino = require('express-pino-logger');
console.log('✅ pino loaded');
const { z } = require('zod');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
console.log('✅ validators loaded');
const healthService = require('./services/health.service');
console.log('✅ healthService loaded');
const redisService = require('./services/redis.service');
console.log('✅ redisService loaded');
const telemetryService = require('./services/telemetry.service');
console.log('✅ telemetryService loaded');

// ============================================================================
// WEB3 CORE SERVICES (Indexer, AA, Cache, WebSocket Hub, DID, Storage)
// ============================================================================
let web3Core = null;
let web3CoreRoutes = null;
try {
    web3Core = require('./services/web3-core.init');
    web3CoreRoutes = require('./routes/web3-core.routes');
    console.log('✅ web3Core services loaded');
} catch (error) {
    console.warn('⚠️ web3Core services unavailable in Hub Control Plane:', error.message);
    web3CoreRoutes = express.Router().use((req, res) => {
        res.status(503).json({
            error: 'web3-core unavailable',
            message: 'Web3 runtime services must be served by the dedicated gateway/subapps.'
        });
    });
}

console.log('📦 Loading auditLogger middleware...');
const { audit, requestLogger, errorLogger } = require('./middleware/auditLogger');
console.log('✅ auditLogger loaded');
console.log('✅ auditLogger loaded');
const { httpsEnforcement, securityHeaders, validateOrigin } = require('./middleware/httpsEnforcement');
console.log('✅ httpsEnforcement loaded');
const { sanitizeInput, preventSqlInjection, preventNoSqlInjection } = require('./middleware/inputSanitization');
console.log('✅ inputSanitization loaded');
const AdvancedRateLimiter = require('./middleware/advancedRateLimiter');
console.log('✅ AdvancedRateLimiter loaded');
const MessageRateLimiter = require('./middleware/messageRateLimiter');
console.log('✅ MessageRateLimiter loaded');
let mongoose = null;
try {
    mongoose = require('mongoose');
} catch (error) {
    console.warn('⚠️ Mongoose unavailable; MongoDB-backed features disabled:', error.message);
}

// ── MongoDB Connection ──
const MONGODB_URI = process.env.MONGODB_URI;
if (mongoose && MONGODB_URI && process.env.NODE_ENV !== 'test') {
    mongoose.connect(MONGODB_URI, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
    })
        .then(() => console.log('✅ MongoDB connected successfully'))
        .catch(err => console.error('❌ MongoDB initial connection error:', err.message));

    mongoose.connection.on('error', (err) => {
        console.error('❌ MongoDB connection error:', err.message);
    });
    mongoose.connection.on('disconnected', () => {
        console.warn('⚠️ MongoDB disconnected. Attempting to reconnect...');
    });
    mongoose.connection.on('reconnected', () => {
        console.log('✅ MongoDB reconnected');
    });
} else {
    console.warn('⚠️ MONGODB_URI not set — features requiring MongoDB (SDK Admin, Developer Console) will be unavailable');
}

// Suppress Mongoose duplicate index warnings
process.removeAllListeners('warning');
process.on('warning', (warning) => {
    // Suppress specific mongoose warnings
    if (warning.name === 'MONGOOSE' && warning.message?.includes('Duplicate schema index')) {
        return; // Ignore duplicate index warnings
    }
    console.warn(warning);
});

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// Structured logger
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// DEBUG: Log all requests
app.use((req, res, next) => {
    console.log(`[DEBUG] Request: ${req.method} ${req.url}`);
    next();
});

app.use((req, res, next) => {
    req.id = uuidv4();
    next();
});
app.use(expressPino({ logger }));

// `config` is loaded above and will have exited the process if env is invalid


// Initialize WebSocket server
console.log('🔌 Initializing WebSocket Server...');
const wsServer = process.env.NODE_ENV === 'test' ? null : new WebSocketServer(server);
if (wsServer) {
    setWebSocketServerInstance(wsServer);
}
console.log('✅ WebSocket Server initialized');

// ============================================================================
// SECURITY MIDDLEWARE - Applied in order
// ============================================================================

// 1. HTTPS Enforcement (producción)
app.use(httpsEnforcement);

// 2. Origin Validation & CORS
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

// Always allow production and standard dev origins
if (!allowedOrigins.includes('https://bez.digital')) allowedOrigins.push('https://bez.digital');
if (!allowedOrigins.includes('https://www.bez.digital')) allowedOrigins.push('https://www.bez.digital');

if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.push(
        'http://localhost:5173', 'http://127.0.0.1:5173',
        'http://localhost:5174', 'http://127.0.0.1:5174',
        'http://localhost:3000', 'http://127.0.0.1:3000',
        'http://127.0.0.1:58425'
    );
}

console.log('✅ Allowed Origins:', allowedOrigins);

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        // Normalize origin: remove trailing slash if any
        const normalizedOrigin = origin.endsWith('/') ? origin.slice(0, -1) : origin;

        const isAllowed = allowedOrigins.some(ao =>
            normalizedOrigin === ao ||
            (ao.includes('*') && normalizedOrigin.endsWith(ao.replace('*', '')))
        ) || normalizedOrigin === 'https://bez.digital' || normalizedOrigin === 'https://www.bez.digital';

        if (isAllowed) {
            callback(null, true);
        } else {
            // Reject silently with false instead of throwing Error to prevent 500s on OPTIONS requests
            console.warn(`⚠️ CORS Warning: Origin ${normalizedOrigin} blocked.`);
            callback(null, false);
        }
    },
    credentials: true,
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'x-wallet-address',
        'x-api-key',
        'x-request-id',
        'X-Requested-With',
        'Accept',
        'Origin'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    exposedHeaders: ['x-request-id'],
    optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
};

// Mount CORS before anything else that might block the request
app.use(cors(corsOptions));
// Fallback explicit OPTIONS setup
app.options('*', cors(corsOptions));

// 3. Security Headers
app.use(securityHeaders);

// 4. Request Logger (audit trail)
app.use(requestLogger);

// 5. Input Sanitization (prevent injections)
app.use(sanitizeInput);
app.use(preventSqlInjection);
app.use(preventNoSqlInjection);


const cspDirectives = {
    directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://js.stripe.com", "https://maps.googleapis.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: [
            "'self'",
            "https://api.walletconnect.com",
            "https://relay.walletconnect.com",
            "wss://relay.walletconnect.com",
            "https://rpc.walletconnect.com",
            "https://explorer-api.walletconnect.com",
            "https://keys.walletconnect.com",
            "https://api.web3modal.com",
            "https://pulse.walletconnect.com",
            "https://secure.walletconnect.com",
            "https://secure.walletconnect.org",
            "https://secure-mobile.walletconnect.com",
            "https://secure-mobile.walletconnect.org",
            "https://*.infura.io",
            "https://*.alchemy.com",
            "https://*.polygon.technology",
            "https://polygon-rpc.com",
            "wss://*.infura.io",
            "wss://*.alchemy.com"
        ].concat(allowedOrigins),
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        frameSrc: [
            "'self'",
            "https://verify.walletconnect.com",
            "https://verify.walletconnect.org",
            "https://secure.walletconnect.com",
            "https://secure.walletconnect.org",
            "https://secure-mobile.walletconnect.com",
            "https://secure-mobile.walletconnect.org",
            "https://js.stripe.com"
        ],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
};

if (process.env.NODE_ENV === 'production') {
    app.use(helmet({ contentSecurityPolicy: cspDirectives }));
} else {
    // In development, disable CSP to avoid WalletConnect and other issues
    app.use(helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: false
    }));
}

// Global rate limiting - more permissive for development
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 500 : 2000, // Very permissive in dev
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too many requests',
            message: 'Por favor, espera un momento antes de hacer más solicitudes.',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
        });
    }
});
app.use(limiter);

// REMOVED: questsLimiter - quests system eliminated, rewards uses generic limiter now
// const questsLimiter = rateLimit({
//     windowMs: 1 * 60 * 1000, // 1 minute
//     max: process.env.NODE_ENV === 'production' ? 30 : 300,
//     skipSuccessfulRequests: true,
//     handler: (req, res) => {
//         res.status(429).json({
//             error: 'Too many requests',
//             message: 'Demasiadas solicitudes a misiones. Por favor, espera un momento.',
//             retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
//         });
//     }
// });

// Specific rate limit for config endpoint (very permissive in development)
const configLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: process.env.NODE_ENV === 'production' ? 1000 : 2000, // Augmented safely to avoid false blocks on page reloads
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too many requests',
            message: 'Has superado el límite de solicitudes para este endpoint.',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
        });
    }
});

// ============================================================================
// STRIPE WEBHOOK — Must be mounted BEFORE express.json() to preserve raw body
// Stripe signature verification requires the raw, unparsed request body.
// If express.json() runs first, it consumes the body and breaks verification.
// ============================================================================
const stripeWebhookRouter = require('./routes/stripe-webhook.routes');
app.use('/api/stripe', stripeWebhookRouter);

// TELEGRAM WEBHOOK — Custom body parser logic avoids global limits
const telegramRoutes = require('./routes/telegram.routes');
app.use('/api/telegram', telegramRoutes);

app.use(express.json({ limit: '10mb' }));

// ============================================================================
// SWAGGER API DOCUMENTATION
// ============================================================================
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger.config');
const { hideInternalRoutes } = require('./middleware/apiKeyAuth');

app.use('/api-docs', hideInternalRoutes, swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "BeZhas API Documentation",
    customfavIcon: "/favicon.png",
    swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        tryItOutEnabled: true
    }
}));

// ============================================================================
// PUBLIC DOWNLOADS (SDK & MCP Tarballs)
// ============================================================================
app.use('/api/downloads', express.static(path.join(__dirname, 'public/downloads'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.tgz')) {
            res.setHeader('Content-Type', 'application/gzip');
            res.setHeader('Content-Disposition', `attachment; filename="${path.split('/').pop() || path.split('\\').pop()}"`);
        }
    }
}));

// ============================================================================
// ADVANCED RATE LIMITERS INITIALIZATION
// ============================================================================

const advancedRateLimiter = new AdvancedRateLimiter({
    enabled: process.env.ENABLE_ADVANCED_RATE_LIMIT !== 'false'
});
console.log('✅ AdvancedRateLimiter created');

const messageRateLimiter = new MessageRateLimiter({
    enabled: process.env.ENABLE_MESSAGE_RATE_LIMIT !== 'false'
});
console.log('✅ MessageRateLimiter created');

// Apply advanced rate limiter to all API routes
app.use('/api', advancedRateLimiter.middleware());

logger.info('✅ Advanced Rate Limiters initialized');

// Middleware to wrap routes and catch errors
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Safe route wrapper - catches errors from route imports
const safeUseRoute = (path, ...middlewares) => {
    try {
        app.use(path, ...middlewares);
    } catch (error) {
        logger.error({ err: error, path }, `Failed to mount route: ${path}`);
        // Mount a fallback error route
        app.use(path, (req, res) => {
            res.status(503).json({
                error: 'Service temporarily unavailable',
                path,
                message: 'This service is currently unavailable'
            });
        });
    }
};

const questsLimiter = new AdvancedRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // Limit each IP to 60 requests per windowMs
    keyGenerator: (req) => {
        return req.user ? `quests_${req.user.id}` : `quests_${req.ip}`;
    },
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            error: 'Too many requests, please try again later.'
        });
    }
});

// ========================================
// API ROUTES (OPTIMIZED LOADING)
// ========================================
console.log('📦 Initializing route placeholders...');

const isTestEnv = process.env.NODE_ENV === 'test';

// Define routers that will be lazily loaded
const authRoutes = require('./routes/auth.routes');
const contactRoutes = require('./routes/contacts.routes');
const uploadsRoutes = require('./routes/uploads.routes');
const stakingRoutes = require('./routes/staking.routes');
const groupsRoutes = require('./routes/groups.routes');
const walletRoutes = require('./routes/wallet.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const rewardsRoutes = require('./routes/rewards.routes');
const profileRoutes = require('./routes/profile.routes');
const metricsRouter = require('./metrics');
const feedRoutes = require('./routes/feed.routes');
const treasuryRoutes = require('./routes/treasury.routes');
const logisticsRoutes = require('./routes/logistics.routes');
const controlPlaneRoutes = require('./routes/control-plane.routes');
const {
    createDeprecatedSubappRoute,
    getSubappRegistry
} = require('./control-plane/policy');

// Bridge runtime routes are intentionally not loaded in Hub Control Plane.

// Payment runtime routes are intentionally not loaded in Hub Control Plane.

console.log('📦 Loading notificationRoutes...');
const notificationRoutes = require('./routes/notification.routes');
console.log('📦 notificationRoutes loaded');
console.log('📦 Loading validationRoutes...');
const validationRoutes = require('./routes/validation.routes');
console.log('📦 validationRoutes loaded');

// BezCoin runtime routes are intentionally not loaded in Hub Control Plane.

// Fiat gateway runtime routes are intentionally not loaded in Hub Control Plane.

// Chat Routes
console.log('📦 Loading chatRoutes...');
const chatRoutes = require('./routes/chat.routes');
console.log('📦 chatRoutes loaded');

// AI Routes (mounted later at L1089 to avoid triple-mounting)
console.log('📦 Loading aiRoutes...');
const aiRoutes = require('./routes/ai.routes');
console.log('📦 aiRoutes loaded');

// Crypto payment runtime routes are intentionally not loaded in Hub Control Plane.

// Escrow Routes
console.log('📦 Loading escrowRoutes...');
const escrowRoutes = require('./routes/escrow.routes');
console.log('📦 escrowRoutes loaded');

// Users Routes
console.log('📦 Loading usersRoutes...');
const usersRoutes = require('./routes/users.routes');
console.log('📦 usersRoutes loaded');

// Posts Routes
console.log('📦 Loading postsRoutes...');
const postsRoutes = require('./routes/posts.routes');
console.log('📦 postsRoutes loaded');

console.log('📦 Loading uploadRoutes...');
let uploadRoutes;
try {
    uploadRoutes = require('./routes/upload.routes');
    console.log('📦 uploadRoutes loaded');
} catch (error) {
    console.error('❌ ERROR loading uploadRoutes:', error);
    // Crear fallback router vacío
    uploadRoutes = require('express').Router();
}

// Telemetry Routes (AI/ML System)
console.log('📦 Loading telemetryRoutes...');
let telemetryRoutes;
try {
    telemetryRoutes = require('./routes/telemetry.routes');
    console.log('📦 telemetryRoutes loaded');
} catch (error) {
    console.error('❌ ERROR loading telemetryRoutes:', error);
}

// Billing Routes
console.log('📦 Loading billingRoutes...');
const billingRoutes = require('./routes/billing.routes');
console.log('📦 billingRoutes loaded');

// Campaigns Routes
console.log('📦 Loading campaignsRoutes...');
const campaignsRoutes = require('./routes/campaigns.routes');
console.log('📦 campaignsRoutes loaded');

// Health Check Routes
console.log('📦 Loading healthRoutes...');
const healthRoutes = require('./routes/health.routes');
console.log('📦 healthRoutes loaded');

// OpenClaw AI Agent Routes
console.log('📦 Loading openclawRoutes...');
const openClawRoutes = require('./routes/openclaw.routes');
console.log('📦 openclawRoutes loaded');

// Public health check (no auth required)
app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes); // Add internal API health route

// Diagnostic Route (Semi-protected)
const diagnosticRoutes = require('./routes/diagnostic.routes');
app.use('/api/diagnostic', diagnosticRoutes);

// NOTE: Public config endpoint moved to line ~1141 (combined version with ABIs + rate limiter).
// The duplicate was removed to prevent Express route shadowing.

// ============================================================================
// SECURITY IMPLEMENTATION (Nonce & JWT)
// ============================================================================

// In-memory storage for nonces (simulated DB)
const usersDB = {};

// Middleware to verify wallet signature using Nonce
const verifyWalletSignature = async (req, res, next) => {
    const { walletAddress, signature } = req.body;

    if (!walletAddress || !signature) {
        return res.status(400).json({ error: 'Wallet address and signature required' });
    }

    try {
        // Retrieve the nonce associated with the address
        const nonce = usersDB[walletAddress.toLowerCase()];

        if (!nonce) {
            return res.status(401).json({ error: 'Nonce not found. Please request a new nonce.' });
        }

        // Verify the signature
        // The message signed by the user must be the nonce
        const message = `Sign this message to verify your identity: ${nonce}`;
        const recoveredAddress = ethers.verifyMessage(message, signature);

        if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
            return res.status(401).json({ error: 'Invalid signature' });
        }

        // Remove the nonce to prevent replay attacks
        delete usersDB[walletAddress.toLowerCase()];

        next();
    } catch (error) {
        console.error('Signature verification error:', error);
        res.status(500).json({ error: 'Verification failed' });
    }
};

// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    if (!process.env.JWT_SECRET) {
        console.error('FATAL: JWT_SECRET is not defined');
        return res.sendStatus(500);
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// ============================================================================
// GLOBAL STATS ENDPOINT - For GlobalStatsBar component
// ============================================================================
app.get('/api/stats/global', async (req, res) => {
    try {
        // Return ecosystem stats (could be fetched from blockchain/DB in production)
        const stats = {
            totalBurned: '2,345,678',
            burned24h: '12,450',
            realEstateTVL: '4,250,000',
            currentAPY: '24.5',
            commercialVolume: '890,000',
            treasuryBalance: '1,250,000',
            activeLPs: '1,234',
            totalUsers: 5000,
            totalTransactions: 125000
        };
        res.json(stats);
    } catch (error) {
        console.error('Error fetching global stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// ============================================================================
// TOKEN PRICE ENDPOINT - For TokenWidget fallback
// ============================================================================
app.get('/api/token/price', async (req, res) => {
    try {
        // BEZ Token on Polygon Mainnet
        const BEZ_CONTRACT = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';

        // Try DexScreener API first
        const axios = require('axios');
        try {
            const response = await axios.get(
                `https://api.dexscreener.com/latest/dex/tokens/${BEZ_CONTRACT}`,
                { timeout: 5000 }
            );

            if (response.data?.pairs?.length > 0) {
                const pair = response.data.pairs[0];
                return res.json({
                    success: true,
                    price: parseFloat(pair.priceUsd || 0),
                    priceChange24h: parseFloat(pair.priceChange?.h24 || 0),
                    volume24h: parseFloat(pair.volume?.h24 || 0),
                    liquidity: parseFloat(pair.liquidity?.usd || 0),
                    source: 'dexscreener',
                    contract: BEZ_CONTRACT,
                    chain: 'polygon'
                });
            }
        } catch (dexError) {
            console.log('DexScreener API failed, using fallback price');
        }

        // Fallback: Return a default/cached price
        res.json({
            success: true,
            price: 0.0001,
            priceChange24h: 0,
            volume24h: 0,
            liquidity: 0,
            source: 'fallback',
            contract: BEZ_CONTRACT,
            chain: 'polygon'
        });
    } catch (error) {
        console.error('Error fetching token price:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch token price' });
    }
});

// Endpoint to get a nonce for a wallet address
app.get('/api/auth/nonce/:address', (req, res) => {
    const { address } = req.params;
    const nonce = Math.floor(Math.random() * 1000000).toString();
    usersDB[address.toLowerCase()] = nonce;
    res.json({ nonce });
});

// Secure Login Endpoint (Overrides authRoutes if placed before)
app.post('/api/auth/login-wallet', verifyWalletSignature, async (req, res) => {
    // If we reach here, the signature is valid
    const { walletAddress } = req.body;

    try {
        // Find user by wallet address
        let user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });

        if (!user) {
            return res.status(404).json({ error: 'User not found. Please register first.' });
        }

        // Generate JWT
        if (!process.env.JWT_SECRET) {
            return res.status(503).json({ error: 'JWT_SECRET is not configured' });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

        res.json({
            message: 'Login successful',
            user: {
                id: user._id,
                username: user.username || `User_${walletAddress.slice(0, 6)}`,
                email: user.email,
                walletAddress: user.walletAddress,
                roles: user.roles,
                referralCode: user.affiliate?.referralCode
            },
            token
        });
    } catch (error) {
        console.error('Error in secure login-wallet:', error);
        res.status(500).json({ error: 'Server error during wallet login' });
    }
});

// Secure Email Endpoint
app.post('/api/email/send', authenticateToken, (req, res) => {
    // Only authenticated users can send emails
    const { to, subject, body } = req.body;
    // Implement email sending logic here
    console.log(`Sending email to ${to}: ${subject}`);
    res.json({ message: 'Email sent successfully' });
});

app.use('/api/auth', authRoutes);

// Two-Factor Authentication (2FA) routes - TOTP and WebAuthn/Passkeys
const twoFactorRoutes = require('./routes/2fa.routes');
app.use('/api/2fa', twoFactorRoutes);

// Avoid blocking Core/Admin startup if optional affiliate dependencies are unavailable.
if (!isTestEnv) {
    try {
        const affiliateRoutes = require('./routes/affiliate.routes');
        app.use('/api/affiliate', affiliateRoutes);
    } catch (error) {
        console.warn('⚠️ Affiliate routes disabled:', error.message);
    }
}
const adminRoutes = require('./routes/admin.routes');
const adminV1Routes = require('./routes/admin.v1.routes');
const adminPanelRoutes = require('./routes/admin-panel.routes');
const adminSettingsRoutes = require('./routes/admin.settings.routes');
const adminRegisterRoutes = require('./routes/adminRegister.routes');
const adminUsersRoutes = require('./routes/admin.users.routes');
const adminDependenciesRoutes = require('./routes/admin.dependencies.routes');
const { router: adminRateLimitRoutes, initializeRateLimiters } = require('./routes/adminRateLimit');
const adminAuthRoutes = require('./routes/admin.auth.routes');
const { verifyAdminToken: verifyCoreAdminToken } = require('./middleware/admin.middleware');
let rwaRoutes;
try {
    rwaRoutes = require('./routes/rwa.routes');
} catch (error) {
    console.warn('⚠️ RWA routes unavailable in Hub Control Plane:', error.message);
    rwaRoutes = express.Router().use((_req, res) => {
        res.status(503).json({
            error: 'rwa routes unavailable',
            message: 'RWA runtime routes must be served by the dedicated subapp/gateway.'
        });
    });
}
// logisticsRoutes is already declared at line 568
function optionalRuntimeRoutes(modulePath, label) {
    try {
        return require(modulePath);
    } catch (error) {
        console.warn(`⚠️ ${label} unavailable in Hub Control Plane:`, error.message);
        return express.Router().use((_req, res) => {
            res.status(503).json({
                error: `${label} unavailable`,
                message: `${label} runtime routes must be served by the dedicated service/subapp.`
            });
        });
    }
}

const webhookRoutes = optionalRuntimeRoutes('./routes/webhook.routes', 'webhook routes');
const automationRoutes = optionalRuntimeRoutes('./routes/automation.routes', 'automation routes');
const aiChatRoutes = optionalRuntimeRoutes('./routes/ai-chat.routes', 'ai chat routes');

// Initialize rate limiters for admin routes
initializeRateLimiters(advancedRateLimiter, messageRateLimiter);

app.use('/api/admin', adminAuthRoutes); // login/bootstrap/admin identity routes
app.use('/api/admin', verifyCoreAdminToken, adminRoutes);
app.use('/api/admin/v1', verifyCoreAdminToken, adminV1Routes);
app.use('/api/admin-panel', verifyCoreAdminToken, adminPanelRoutes);
app.use('/api/admin-register', verifyCoreAdminToken, adminRegisterRoutes);
app.use('/api/admin/settings', verifyCoreAdminToken, adminSettingsRoutes);
const globalSettingsRoutes = require('./routes/globalSettings.routes');
app.use('/api/admin/settings/global', verifyCoreAdminToken, globalSettingsRoutes);
app.use('/api/admin/users', verifyCoreAdminToken, adminUsersRoutes);
app.use('/api/admin/dependencies', verifyCoreAdminToken, adminDependenciesRoutes);
app.use('/api/admin/rate-limit', verifyCoreAdminToken, adminRateLimitRoutes);

// Middleware para rutas deprecadas y migradas a subapps
const deprecatedSubappRoute = (appName, url) => createDeprecatedSubappRoute(appName, { appName, url });

const SUBAPP_URLS = getSubappRegistry().reduce((acc, subapp) => {
    acc[subapp.key] = subapp.baseUrl;
    return acc;
}, {});

app.use('/api/control-plane', controlPlaneRoutes);
app.use('/api/rwa', deprecatedSubappRoute('rwa_operations', SUBAPP_URLS.capital));
app.use('/api/logistics', deprecatedSubappRoute('logistics_operations', SUBAPP_URLS.cargo));
app.use('/api/webhooks', webhookRoutes);
app.use('/api/automation', automationRoutes);
app.use('/api/ai', aiChatRoutes);
app.use('/api/admin/sdk', require('./routes/sdkAdmin.routes')); // SDK & AI Admin Management
// app.use('/api/plugins', require('./routes/pluginRoutes')); // Removed due to Prisma dependency missing in Prod
app.use('/api/mcp', require('./routes/mcp.routes')); // MCP Tools Integration
app.use('/api/automation', require('./routes/automation.routes')); // Automation Engine & Workflows
app.use('/api/contacts', contactRoutes);
app.use('/api/marketplace', deprecatedSubappRoute('marketplace_operations', SUBAPP_URLS.capital));
// NOTE: /api/diagnostic already mounted at L664 — removed duplicate
// app.use('/api/quests', questsLimiter, questsRoutes);
// app.use('/api/badges', questsLimiter, badgesRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/staking', deprecatedSubappRoute('staking_operations', SUBAPP_URLS.capital));
app.use('/api/farming', deprecatedSubappRoute('farming_operations', SUBAPP_URLS.capital));
app.use('/api/governance', deprecatedSubappRoute('governance_operations', SUBAPP_URLS.wallet));
app.use('/api/oracle', deprecatedSubappRoute('vision_operations', SUBAPP_URLS.vision));
app.use('/api/groups', groupsRoutes);
app.use('/api/wallet', deprecatedSubappRoute('wallet_operations', SUBAPP_URLS.wallet));
app.use('/api/notifications', notificationsRoutes);
app.use('/api/rewards', rewardsRoutes); // Changed: now uses generic limiter
app.use('/api/profile', profileRoutes);
app.use('/api/feed', feedRoutes);
if (telemetryRoutes) {
    app.use('/api/v1/telemetry', telemetryRoutes); // AI/ML telemetry endpoint
}
app.use('/api/treasury', verifyCoreAdminToken, treasuryRoutes);
app.use('/api/social', require('./routes/share.routes')); // Social share routes
// app.use('/api/social', require('./routes/social.routes')); // Social features - Temporarily disabled (missing middleware)
app.use('/api/dao', deprecatedSubappRoute('governance_operations', `${SUBAPP_URLS.wallet}/dao`)); // DAO governance routes
app.use('/api/defi', deprecatedSubappRoute('defi_vertical_operations', SUBAPP_URLS.capital)); // DeFi integration routes
app.use('/api/v1/bridge', deprecatedSubappRoute('bridge_operations', `${SUBAPP_URLS.wallet}/bridge`)); // Bridge API migrated
app.use('/api/v1/bridge/admin', deprecatedSubappRoute('bridge_operations', `${SUBAPP_URLS.wallet}/bridge`)); // Bridge admin migrated

// ============================================
// AI Gateway → MCP Intelligence Server
// ============================================
app.use('/api/ai-gateway', require('./routes/aiGateway.routes'));

// ============================================
// AI Autonomous Agents (AIOps Nivel 5)
// ============================================
const agentsRoutes = require('./routes/agents.routes');
app.use('/api/agents', agentsRoutes);
app.use('/api/openclaw', openClawRoutes);

// Bridge and cross-chain runtime moved to BeZhas Wallet.
app.use('/api/v2/bridge', deprecatedSubappRoute('bridge_operations', `${SUBAPP_URLS.wallet}/bridge`));
app.use('/api/v1/crosschain', deprecatedSubappRoute('bridge_operations', `${SUBAPP_URLS.wallet}/bridge`));

// Developer Console Routes (API Key Management)
const developerConsoleRoutes = require('./routes/developerConsole.routes');
app.use('/api/developer', developerConsoleRoutes);

// SDK & MCP Downloads (serves .tgz or redirects to npm registry)
safeUseRoute('/api/downloads', require('./routes/downloads.routes'));


// AI Risk Engine Routes (Revenue Stream Native) — mounted at dedicated subpath
const aiRiskEngineRoutes = require('./routes/aiRiskEngine.routes');
app.use('/api/ai/risk-engine', aiRiskEngineRoutes);

// Real Estate / RWA runtime moved to BZ Capital.
app.use('/api/realestate', deprecatedSubappRoute('rwa_operations', `${SUBAPP_URLS.capital}/rwa`));

// Crypto payment operations moved to BeZhas Pay Manager.
app.use('/api/crypto', deprecatedSubappRoute('crypto_checkout_operations', SUBAPP_URLS.pay));

// Payment operations moved to BeZhas Pay Manager. Billing stays in Hub.
app.use('/api/payment', deprecatedSubappRoute('payments_operations', SUBAPP_URLS.pay));
app.use('/api/payments', deprecatedSubappRoute('payments_operations', SUBAPP_URLS.pay)); // Alias for frontend compatibility
app.use('/api/notifications', notificationRoutes);

// ──────────────────────────────────────────────────────────────────────────────
// BEZPAY v2.0 — Sistema de pagos unificado (BezPayModal)
// Endpoints: /create, /webhook, /quote, /verify-tx, /bez-price, /plans
// ──────────────────────────────────────────────────────────────────────────────
try {
    console.log('ℹ️ BezPay v2.0 routes not mounted in Hub Control Plane');
} catch (e) {
    console.warn('⚠️ BezPay routes not loaded:', e.message);
}

// Fiat Gateway runtime moved to BeZhas Pay Manager.
app.use('/api/fiat', deprecatedSubappRoute('fiat_gateway_operations', SUBAPP_URLS.pay));
app.use('/api/validation', validationRoutes);

// Blockchain Integration Routes (Polygon Mainnet Contracts)
const blockchainRoutes = require('./routes/blockchain.routes');
app.use('/api/blockchain', blockchainRoutes);

// ============================================================================
// WEB3 CORE API ROUTES (Indexer, Account Abstraction, Cache, Storage, DID)
// ============================================================================
app.use('/api/web3', web3CoreRoutes);
console.log('✅ Web3 Core routes mounted at /api/web3');

// Posts and Upload Routes
app.use('/api/posts', postsRoutes);
app.use('/api/upload', uploadRoutes); // IPFS Upload enabled

// MoonPay runtime moved to BeZhas Pay Manager.
app.use('/api/moonpay', deprecatedSubappRoute('moonpay_operations', SUBAPP_URLS.pay));

// Automation Routes (AI-driven economy)
// automationRoutes were declared above
app.use('/api/automation', automationRoutes);

// NEW: VIP System Routes
const vipRoutes = require('./routes/vip.routes');
app.use('/api/vip', vipRoutes);

// NEW: Unified Subscription System (v2.0 - Tier-based Staking + AI)
const subscriptionRoutes = require('./routes/subscription.routes');
app.use('/api/subscription', subscriptionRoutes);

// NEW: BEZ-Coin with MoonPay Integration
app.use('/api/bezcoin', deprecatedSubappRoute('bezcoin_operations', SUBAPP_URLS.wallet));

// NEW: Clothing Rental System with AEGIS Integration
console.log('📦 Loading clothingRentalRoutes...');
const clothingRentalRoutes = require('./routes/clothingRental.routes');
app.use('/api/clothing-rental', clothingRentalRoutes);
console.log('📦 clothingRentalRoutes loaded');

// NEW: Vinted Marketplace Integration - DISABLED: Replaced by ClothingRental + Universal SDK
// const vintedRoutes = require('./routes/vinted.routes');
// app.use('/api/marketplace/vinted', vintedRoutes);

// Quality Escrow Routes (Quality Oracle System) — migrated to Vision Scan
app.use('/api/quality-escrow', deprecatedSubappRoute('quality_oracle_operations', SUBAPP_URLS.vision));

// Stripe Payment Routes (ENABLED - Live Keys Configured)
const stripeRoutes = require('./routes/stripe.routes');
app.use('/api/stripe', stripeRoutes);

// Security Routes (Day 6)
const securityRoutes = require('./routes/security.routes');
app.use('/api/security', securityRoutes);

// BezCoin runtime moved to BeZhas Wallet / BeZhas Pay Manager.
app.use('/api/escrow', escrowRoutes);

// Developer Portal Routes
const developerPortalRoutes = require('./routes/developer-portal.routes');
app.use('/developers', developerPortalRoutes);
app.use('/api/developer/revenue', optionalRuntimeRoutes('./routes/developer/revenue.routes', 'developer revenue routes'));

// Chat Routes
app.use('/api/chat', chatRoutes);

// AI Routes
app.use('/api/ai', aiRoutes);

// Local AI Routes (ML + Oracle + Personal AI) - DISABLED: Requires reimplementation with UnifiedAI
// const localAIRoutes = require('./routes/localAI.routes');
// app.use('/api/local-ai', localAIRoutes);

// Ad Rewards Routes (Watch-to-Earn)
const adRewardsRoutes = require('./routes/adRewards.routes');
app.use('/api/ad-rewards', adRewardsRoutes);

// Ad Center Routes (Campaigns & Billing)
// const campaignsRoutes = require('./routes/campaigns.routes'); // Already required above
// const billingRoutes = require('./routes/billing.routes'); // Already required above
const advertiserProfileRoutes = require('./routes/advertiserProfile.routes');
const adminAdsRoutes = require('./routes/adminAds.routes');
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/advertiser-profile', advertiserProfileRoutes);
app.use('/api/admin/ads', adminAdsRoutes);

// Users Routes
app.use('/api/users', usersRoutes);

// User subscription endpoint - GET /api/users/subscription
app.get('/api/users/subscription', authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        // Try to find user by ID
        const user = await User.findById(userId).catch(() => null);

        const subscription = user?.subscription || {
            plan: 'free',
            status: 'active',
            expiresAt: null,
            features: ['basic_access']
        };

        res.json(subscription);
    } catch (error) {
        console.error('Error fetching subscription:', error);
        res.json({
            plan: 'free',
            status: 'active',
            expiresAt: null,
            features: ['basic_access']
        });
    }
});

// Servir archivos estáticos de uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api', metricsRouter);

// Basic liveness endpoints (useful to verify port 3001 is serving)
app.get('/', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'bezhas-backend', port: PORT, time: new Date().toISOString() }));
});
app.get('/healthz', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
});

// Standard health alias
app.get('/api/health', (req, res) => {
    try {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, timestamp: new Date().toISOString() }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: error.message }));
    }
});

// Mock endpoint for active users (RightSidebar)
app.get('/api/users/active', (req, res) => {
    res.json([
        { id: 1, username: 'crypto_whale', avatar: '🐋', status: 'online', lastSeen: new Date() },
        { id: 2, username: 'blockchain_dev', avatar: '💻', status: 'online', lastSeen: new Date() },
        { id: 3, username: 'nft_collector', avatar: '🎨', status: 'online', lastSeen: new Date() },
        { id: 4, username: 'defi_master', avatar: '💰', status: 'online', lastSeen: new Date() }
    ]);
});

// Mock endpoint for trending topics (RightSidebar)
app.get('/api/trending', (req, res) => {
    res.json([
        { id: 1, topic: '#BeZhas', posts: 1234 },
        { id: 2, topic: '#Web3', posts: 892 },
        { id: 3, topic: '#NFT', posts: 654 },
        { id: 4, topic: '#DeFi', posts: 421 }
    ]);
});

// Gemini AI Setup (Optional for demo)
let model = null;
const geminiApiKey = process.env.GEMINI_API_KEY;
if (geminiApiKey && geminiApiKey.startsWith('AIza') && geminiApiKey.length > 30) { // Basic validation for Gemini keys
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    logger.info('Gemini AI initialized successfully');
} else {
    logger.warn('Running in demo mode - Gemini AI disabled');
}

// --- AUTOMATION ENDPOINTS ---
app.post('/api/automation/analyze-platform', express.json(), async (req, res) => {
    try {
        if (!ThirdPartyAnalyzer) {
            return res.status(503).json({ error: 'Automation analyzer disabled in test environment' });
        }
        const { platformData, platformName } = req.body;
        if (!platformData || !platformName) {
            return res.status(400).json({ error: 'Missing platformData or platformName' });
        }

        const result = await ThirdPartyAnalyzer.analyzeAndReport(platformData, platformName);
        res.json(result);
    } catch (error) {
        logger.error({ err: error }, 'Automation Analysis Failed');
        res.status(500).json({ error: 'Analysis failed' });
    }
});

// Duplicate diagnostic route removed
// ----------------------------

// Endpoint to get the current configuration combined with ABIs
app.get('/api/config', configLimiter, async (req, res) => {
    try {
        // Read the base config file
        let baseConfig = {};
        try {
            const data = await fs.readFile(configFilePath, 'utf8');
            baseConfig = JSON.parse(data);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                logger.warn({ err: error }, 'Error reading config.json, using defaults');
            }
            // If config.json doesn't exist or is invalid, we start with defaults
            baseConfig = {
                network: 'polygon',
                chainId: 137,
                apiUrl: 'http://localhost:3001'
            };
        }

        // Read contract addresses from contract-addresses.json
        let contractAddresses = {};
        try {
            const addressData = await fs.readFile(contractAddressesPath, 'utf8');
            contractAddresses = JSON.parse(addressData);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                logger.warn({ err: error }, 'Error reading contract-addresses.json');
            }
            // If contract-addresses.json doesn't exist, use addresses from baseConfig
            contractAddresses = baseConfig.contractAddresses || {};
        }

        // Read ABIs dynamically (don't let this fail the whole request)
        let abis = {};
        try {
            abis = await getAbis();
        } catch (error) {
            logger.warn({ err: error }, 'Error loading ABIs, continuing without them');
            abis = {};
        }

        // Combine and send
        const fullConfig = {
            ...baseConfig,
            contractAddresses: {
                ...contractAddresses,
                BezhasTokenAddress: process.env.BEZCOIN_CONTRACT_ADDRESS || contractAddresses.BezhasTokenAddress
            },
            abis: abis,
            timestamp: new Date().toISOString()
        };

        res.json(fullConfig);

    } catch (error) {
        logger.error({ err: error, reqId: req.id }, 'Error getting configuration');
        // Send a minimal valid config instead of 500
        res.json({
            network: 'polygon',
            chainId: 137,
            apiUrl: 'http://localhost:3001',
            contractAddresses: {},
            abis: {},
            error: 'Partial config - some data could not be loaded',
            timestamp: new Date().toISOString()
        });
    }
});

// Endpoint to update the configuration (PROTECTED)
app.post('/api/config',
    configLimiter,
    verifyCoreAdminToken, // Apply the admin authentication middleware
    [
        // Define validation rules for expected config fields
        body('contractAddresses.*').isEthereumAddress().withMessage('Invalid Ethereum address in contractAddresses'),
        body('network.chainId').isInt({ min: 1 }).withMessage('Invalid chainId'),
        body('network.name').isString().trim().escape(),
        // Add other expected fields here
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {

            const newConfig = req.body;

            // Ensure private keys are never processed from the request body
            if (newConfig.privateKey) {
                logger.warn({ reqId: req.id }, 'Attempt to send a private key to the config endpoint was blocked.');
                delete newConfig.privateKey;
            }

            await fs.writeFile(configFilePath, JSON.stringify(newConfig, null, 2));
            res.status(200).json({ message: 'Configuration updated successfully' });
        } catch (error) {
            logger.error({ err: error, reqId: req.id }, 'Error writing config file');
            res.status(500).json({ error: 'Error writing configuration' });
        }
    });

// Chat validation and sanitization rules
const chatValidationRules = () => {
    return [
        body('message', 'A non-empty message up to 1000 characters is required')
            .isString()
            .trim()
            .isLength({ min: 1, max: 1000 })
            .escape(), // Sanitize to prevent XSS
    ];
};

// Chat rate limiter
const chatLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // Increased from 10 to 20
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too many requests',
            message: 'Demasiadas solicitudes de chat, por favor intenta de nuevo más tarde.',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
        });
    }
});

// NOTA: Endpoint de chat movido a chat.routes.js
// El siguiente código está comentado para evitar conflictos de rutas
/*
// Endpoint for Gemini AI Chat
app.post('/api/chat', chatLimiter, chatValidationRules(), async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const { message: sanitizedMessage } = req.body;
 
        // Check if Gemini AI is available
        if (!model) {
            return res.json({
                reply: `Demo Mode: I received your message. Gemini AI is not configured. Please set up GEMINI_API_KEY to enable AI chat functionality.`
            });
        }
 
        const result = await model.generateContent(sanitizedMessage);
        const response = await result.response;
        const text = response.text();
 
        res.json({ reply: text });
 
    } catch (error) {
        logger.error({ err: error, reqId: req.id }, 'Error with Gemini API');
        res.status(500).json({ error: 'Failed to get response from Gemini AI' });
    }
});
*/

// Add WebSocket stats endpoint
app.get('/api/websocket/stats', (req, res) => {
    const stats = wsServer.getStats();
    res.json(stats);
});

// Add notification endpoints
app.post('/api/notifications/send',
    [
        body('address', 'A valid wallet address is required').isEthereumAddress(),
        body('notification', 'Notification object cannot be empty').isObject().notEmpty(),
        body('notification.title', 'Notification title is required').isString().trim().notEmpty().escape(),
        body('notification.message', 'Notification message is required').isString().trim().notEmpty().escape(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            const { address, notification } = req.body;

            const sent = wsServer.sendNotificationToUser(address, notification);
            res.json({ sent, message: sent ? 'Notification sent' : 'User not connected' });
        } catch (error) {
            logger.error({ err: error, reqId: req.id }, 'Error sending notification');
            res.status(500).json({ error: 'Failed to send notification' });
        }
    });

app.post('/api/social/broadcast',
    [
        body('type', 'Event type is required').isString().trim().notEmpty().escape(),
        body('data', 'Data object cannot be empty').isObject().notEmpty(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            const { type, data } = req.body;

            wsServer.sendSocialUpdate(type, data);
            res.json({ message: 'Broadcast sent' });
        } catch (error) {
            logger.error({ err: error, reqId: req.id }, 'Error broadcasting social update');
            res.status(500).json({ error: 'Failed to broadcast update' });
        }
    });

// Initialize Content Validation Services
if (process.env.NODE_ENV !== 'test') {
    // Start Blockchain Event Listener
    if (!process.env.DISABLE_BLOCKCHAIN_LISTENER && process.env.CONTENT_VALIDATOR_ADDRESS && process.env.CONTENT_VALIDATOR_ADDRESS !== '0x0000000000000000000000000000000000000000') {
        const blockchainListener = require('./services/blockchainListener.service');
        blockchainListener.startListening()
            .then(() => logger.info('✅ Blockchain event listener started'))
            .catch(err => logger.error({ err }, '❌ Failed to start blockchain listener'));
    } else {
        logger.info('⏭️ Blockchain listener disabled or contract not deployed');
    }

    // Start Validation Queue Worker
    if (!process.env.DISABLE_QUEUE_WORKER) {
        const { validationWorker } = require('./services/validationQueue.service');
        logger.info('✅ Validation queue worker started');
    } else {
        logger.info('⏭️ Queue worker disabled');
    }
}

// JSON 404 for API routes to avoid HTML responses that break frontends
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'Not Found', path: req.originalUrl });
});

// Global error handler: always return JSON
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    logger.error({ err, reqId: req.id }, 'Unhandled error');
    console.error('[FATAL ERROR]', err);

    // Guard: if headers already sent (response was already started), delegate to default handler
    if (res.headersSent) {
        return next(err);
    }

    try {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Server Error', message: err?.message || 'Unknown error' }));
    } catch (writeErr) {
        // Last resort: raw response
        console.error('[DOUBLE FAULT] Error handler also crashed:', writeErr);
        res.writeHead(500);
        res.end('{"error":"Internal Server Error"}');
    }
});

// Start server only if not in test mode
if (process.env.NODE_ENV !== 'test') {
    const PORT = process.env.PORT || 8080;
    server.listen(PORT, '0.0.0.0', async () => {
        logger.info(`Backend server running on http://0.0.0.0:${PORT}`);
        logger.info(`Also accessible at http://127.0.0.1:${PORT}`);
        logger.info(`Also accessible at http://localhost:${PORT}`);
        logger.info('WebSocket server ready for connections');

        // ===================================
        // WEB3 CORE SERVICES INITIALIZATION
        // ===================================
        try {
            if (web3Core) {
                await web3Core.initialize(server);
            }
            logger.info('✅ Web3 Core services initialized (Indexer, AA, Cache, WebSocket Hub, DID, Storage)');
        } catch (error) {
            logger.error({ err: error }, '⚠️ Web3 Core services initialization warning - continuing with limited functionality');
        }

        // ===================================
        // CRON JOBS DE AUTOMATIZACIÓN
        // ===================================

        if (DiagnosticService) {
            // Mantenimiento nocturno a las 3:00 AM todos los días
            cron.schedule('0 3 * * *', async () => {
                console.log('🌙 [CRON] Iniciando mantenimiento nocturno automático...');
                try {
                    await DiagnosticService.runNightlyMaintenance();
                    console.log('✅ [CRON] Mantenimiento completado exitosamente');
                } catch (error) {
                    console.error('❌ [CRON] Error en mantenimiento nocturno:', error);
                }
            });

            // Análisis de salud del sistema cada 6 horas
            cron.schedule('0 */6 * * *', async () => {
                console.log('🏥 [CRON] Verificando salud del sistema...');
                try {
                    await DiagnosticService.analyzeSystemHealth();
                    console.log('✅ [CRON] Análisis de salud completado');
                } catch (error) {
                    console.error('❌ [CRON] Error en análisis de salud:', error);
                }
            });
        }

        logger.info('✅ Diagnostic Agent & Automation Cron Jobs Scheduled');

        // ===================================
        // BLOCKCHAIN EVENT LISTENER
        // ===================================
        if (!process.env.DISABLE_BLOCKCHAIN_LISTENER && process.env.AUTOMATION_ENABLED === 'true') {
            try {
                const eventListener = require('./services/blockchain/eventListener');
                await eventListener.startListening();
                logger.info('✅ Blockchain Event Listener activo en Polygon Mainnet');
            } catch (error) {
                logger.error('❌ Error inicializando Blockchain Event Listener:', error);
            }
        } else {
            logger.info('⏭️ Blockchain Event Listener disabled (testing mode)');
        }

        // ===================================
        // AI ORACLE SERVICE
        // ===================================
        try {
            const { getOracle } = require('./services/oracle.service');
            const oracle = getOracle();
            logger.info('✅ AI Oracle Service initialized');

            // Opcional: Activar auto-procesamiento
            // oracle.startAutoProcessing();
        } catch (error) {
            logger.error('❌ Error inicializando AI Oracle:', error);
        }

        // ===================================
        // AUTOMATION ENGINE
        // ===================================
        try {
            const { getEngine } = require('./services/automationEngine.service');
            const automationEngine = getEngine();
            automationEngine.start();
            logger.info('✅ Automation Engine started');
        } catch (error) {
            logger.error('❌ Error inicializando Automation Engine:', error);
        }

        logger.info(`WebSocket server ready for connections`);

        // Initialize services
        try {
            // Connect to Redis if configured
            await redisService.getConnection();

            // Register health checks
            healthService.registerService('redis', async () => {
                return await redisService.healthCheck();
            });

            healthService.registerService('websocket', async () => {
                const stats = wsServer.getStats();
                return {
                    status: 'healthy',
                    connections: stats.totalConnections,
                    authenticatedClients: stats.authenticatedClients
                };
            });

            healthService.registerService('telemetry', async () => {
                const stats = telemetryService.getStats();
                return {
                    status: stats.isAutoFlushActive ? 'healthy' : 'degraded',
                    bufferSize: stats.bufferSize,
                    isProcessing: stats.isProcessing
                };
            });

            // Start periodic health checks (every 5 minutes)
            healthService.startPeriodicChecks(300000);

            // Start ad event simulation if enabled
            startAdEventSimulation();

            // 🚀 Initialize News Aggregator - DISABLED FOR FASTER STARTUP
            // try {
            //     const newsAggregator = require('./services/newsAggregator.service');
            //     logger.info('📰 Starting News Aggregator...');
            //     await newsAggregator.fetchNews();
            //     setInterval(async () => {
            //         try {
            //             await newsAggregator.fetchNews();
            //         } catch (err) {
            //             logger.error('Error in news aggregator interval:', err.message);
            //         }
            //     }, 30 * 60 * 1000);
            //     logger.info('✅ News Aggregator initialized successfully');
            // } catch (err) {
            //     logger.error('⚠️ News Aggregator failed to initialize:', err.message);
            // }

            // 🤖 Initialize Automation Engine - DISABLED FOR FASTER STARTUP
            // try {
            //     if (process.env.AUTOMATION_ENABLED !== 'false') {
            //         const orchestrator = require('./automation/controllers/AutomationOrchestrator');
            //         const halvingJob = require('./automation/jobs/halvingCheck.job');
            //         await orchestrator.start();
            //         halvingJob.start();
            //         logger.info('✅ Automation Engine initialized');
            //     } else {
            //         logger.warn('⚠️ Automation Engine disabled by environment variable');
            //     }
            // } catch (error) {
            //     logger.error({ error: error.message }, '❌ Error initializing Automation Engine');
            // }

            logger.info('✅ All services initialized successfully');

        } catch (error) {
            logger.error({ error: error.message }, '❌ Error initializing services');
        }
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
        logger.info({ signal }, 'Shutdown signal received');
        audit.admin('SERVER_SHUTDOWN', 'system', 'server', { signal, timestamp: new Date().toISOString() });

        // Stop accepting new connections
        server.close(() => {
            logger.info('HTTP server closed');
        });

        try {
            // Shutdown services gracefully
            await wsServer.shutdown();
            await telemetryService.shutdown();
            await redisService.disconnect();
            healthService.shutdown();

            // Shutdown Automation Engine
            try {
                const orchestrator = require('./automation/controllers/AutomationOrchestrator');
                const halvingJob = require('./automation/jobs/halvingCheck.job');
                orchestrator.stop();
                halvingJob.stop();
                logger.info('✅ Automation Engine stopped');
            } catch (error) {
                logger.error({ error: error.message }, 'Error stopping Automation Engine');
            }

            logger.info('✅ Graceful shutdown complete');
            process.exit(0);
        } catch (error) {
            logger.error({ error: error.message }, 'Error during shutdown');
            process.exit(1);
        }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = { app, server };
