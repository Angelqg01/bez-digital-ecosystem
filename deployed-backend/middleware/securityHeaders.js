/**
 * ============================================================================
 * SECURITY HEADERS MIDDLEWARE
 * ============================================================================
 * 
 * Configuración avanzada de headers de seguridad:
 * - Content Security Policy (CSP)
 * - HTTP Strict Transport Security (HSTS)
 * - X-Frame-Options (Clickjacking protection)
 * - X-Content-Type-Options (MIME sniffing protection)
 * - X-XSS-Protection
 * - Referrer-Policy
 * - Permissions-Policy
 */

const helmet = require('helmet');

/**
 * Configuración de Content Security Policy
 */
const CSP_CONFIG = {
    directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
            "'self'",
            "'unsafe-inline'", // Necesario para React (idealmente usar nonce)
            "https://cdn.jsdelivr.net",
            "https://unpkg.com",
            "https://www.google-analytics.com",
            "https://www.googletagmanager.com"
        ],
        styleSrc: [
            "'self'",
            "'unsafe-inline'", // Necesario para styled-components
            "https://fonts.googleapis.com"
        ],
        fontSrc: [
            "'self'",
            "https://fonts.gstatic.com",
            "data:"
        ],
        imgSrc: [
            "'self'",
            "data:",
            "https:",
            "blob:",
            "https://ipfs.io",
            "https://gateway.pinata.cloud"
        ],
        connectSrc: [
            "'self'",
            "https://api.bezhas.com",
            "wss://api.bezhas.com",
            "https://mainnet.infura.io",
            "https://polygon-rpc.com",
            "https://api.stripe.com",
            "https://api.moonpay.com"
        ],
        frameSrc: [
            "'self'",
            "https://js.stripe.com",
            "https://buy.moonpay.com"
        ],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'", "https:", "blob:"],
        workerSrc: ["'self'", "blob:"],
        childSrc: ["'self'", "blob:"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"], // Prevenir clickjacking
        baseUri: ["'self'"],
        manifestSrc: ["'self'"],
        upgradeInsecureRequests: []
    },
    reportUri: '/api/security/csp-report'
};

/**
 * Configuración de HSTS
 */
const HSTS_CONFIG = {
    maxAge: 31536000, // 1 año
    includeSubDomains: true,
    preload: true
};

/**
 * Configuración de Permissions-Policy (anteriormente Feature-Policy)
 */
const PERMISSIONS_POLICY = {
    camera: ['none'],
    microphone: ['none'],
    geolocation: ['self'],
    payment: ['self'],
    usb: ['none'],
    magnetometer: ['none'],
    gyroscope: ['none'],
    accelerometer: ['none']
};

/**
 * Middleware de seguridad principal
 */
function securityHeaders() {
    return helmet({
        // Content Security Policy
        contentSecurityPolicy: CSP_CONFIG,

        // HTTP Strict Transport Security
        strictTransportSecurity: HSTS_CONFIG,

        // X-Frame-Options: DENY (prevenir clickjacking)
        frameguard: {
            action: 'deny'
        },

        // X-Content-Type-Options: nosniff (prevenir MIME sniffing)
        noSniff: true,

        // X-XSS-Protection: 1; mode=block
        xssFilter: true,

        // Referrer-Policy: strict-origin-when-cross-origin
        referrerPolicy: {
            policy: 'strict-origin-when-cross-origin'
        },

        // Permissions-Policy
        permittedCrossDomainPolicies: {
            permittedPolicies: 'none'
        },

        // DNS Prefetch Control
        dnsPrefetchControl: {
            allow: false
        },

        // Expect-CT (Certificate Transparency)
        expectCt: {
            maxAge: 86400,
            enforce: true
        },

        // Hide X-Powered-By
        hidePoweredBy: true,

        // IE No Open
        ieNoOpen: true,

        // HSTS
        hsts: HSTS_CONFIG,

        // Cross-Origin Policies
        crossOriginEmbedderPolicy: false, // Deshabilitado para compatibilidad
        crossOriginOpenerPolicy: { policy: 'same-origin' },
        crossOriginResourcePolicy: { policy: 'same-origin' }
    });
}

/**
 * Headers adicionales personalizados
 */
function additionalSecurityHeaders(req, res, next) {
    // Permissions-Policy
    const permissionsPolicy = Object.entries(PERMISSIONS_POLICY)
        .map(([feature, allowlist]) => `${feature}=(${allowlist.join(' ')})`)
        .join(', ');
    res.setHeader('Permissions-Policy', permissionsPolicy);

    // Cache-Control para contenido sensible
    if (req.path.includes('/api/')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }

    // Server header (ocultar versión)
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');

    // Cross-Origin-Opener-Policy
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

    // Cross-Origin-Resource-Policy
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

    // X-Permitted-Cross-Domain-Policies
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

    next();
}

/**
 * CSP Report Endpoint
 */
function cspReportHandler(req, res) {
    const report = req.body['csp-report'] || req.body;

    console.warn('CSP Violation:', {
        documentUri: report['document-uri'],
        violatedDirective: report['violated-directive'],
        blockedUri: report['blocked-uri'],
        sourceFile: report['source-file'],
        lineNumber: report['line-number'],
        columnNumber: report['column-number']
    });

    // En producción, enviar a sistema de logging
    // await logService.logCSPViolation(report);

    res.status(204).end();
}

/**
 * Configuración de CORS segura
 */
function secureCORS(allowedOrigins = []) {
    return (req, res, next) => {
        const origin = req.headers.origin;

        // Lista blanca de orígenes permitidos
        const defaultAllowed = [
            'https://bezhas.com',
            'https://www.bezhas.com',
            'https://app.bezhas.com',
            'http://localhost:3000',
            'http://localhost:5173'
        ];

        const allowed = [...defaultAllowed, ...allowedOrigins];

        if (origin && allowed.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
            res.setHeader('Access-Control-Max-Age', '86400'); // 24 horas
        }

        // Handle preflight
        if (req.method === 'OPTIONS') {
            return res.status(204).end();
        }

        next();
    };
}

/**
 * Rate limiting para CSP reports (prevenir DoS)
 */
const cspReportLimiter = new Map();

function rateLimitCSPReports(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const limit = 10; // 10 reports por minuto
    const window = 60000; // 1 minuto

    const reports = cspReportLimiter.get(ip) || [];
    const recentReports = reports.filter(timestamp => now - timestamp < window);

    if (recentReports.length >= limit) {
        return res.status(429).json({ error: 'Too many CSP reports' });
    }

    recentReports.push(now);
    cspReportLimiter.set(ip, recentReports);

    next();
}

/**
 * Verificar si el navegador soporta headers modernos
 */
function browserSupportsModernSecurity(req) {
    const userAgent = req.headers['user-agent'] || '';

    // Lista simple de navegadores modernos
    const modernBrowsers = [
        /Chrome\/([0-9]+)/.test(userAgent) && parseInt(userAgent.match(/Chrome\/([0-9]+)/)[1]) >= 90,
        /Firefox\/([0-9]+)/.test(userAgent) && parseInt(userAgent.match(/Firefox\/([0-9]+)/)[1]) >= 85,
        /Safari\/([0-9]+)/.test(userAgent) && parseInt(userAgent.match(/Safari\/([0-9]+)/)[1]) >= 14,
        /Edge\/([0-9]+)/.test(userAgent) && parseInt(userAgent.match(/Edge\/([0-9]+)/)[1]) >= 90
    ];

    return modernBrowsers.some(supported => supported);
}

/**
 * Headers condicionales basados en navegador
 */
function conditionalSecurityHeaders(req, res, next) {
    if (browserSupportsModernSecurity(req)) {
        // Headers modernos solo para navegadores que los soportan
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    }

    next();
}

/**
 * Obtener configuración actual de seguridad
 */
function getSecurityConfig() {
    return {
        csp: CSP_CONFIG,
        hsts: HSTS_CONFIG,
        permissionsPolicy: PERMISSIONS_POLICY,
        features: {
            helmet: true,
            csp: true,
            hsts: true,
            frameProtection: true,
            xssProtection: true,
            corsRestriction: true
        }
    };
}

module.exports = {
    securityHeaders,
    additionalSecurityHeaders,
    secureCORS,
    cspReportHandler,
    rateLimitCSPReports,
    conditionalSecurityHeaders,
    getSecurityConfig,

    // Exports de configuración
    CSP_CONFIG,
    HSTS_CONFIG,
    PERMISSIONS_POLICY
};
