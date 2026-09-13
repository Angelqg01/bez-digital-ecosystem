/**
 * ============================================================================
 * BEZHAS WATCHDOG — middleware del backend
 * ============================================================================
 *
 * Réplica en JavaScript del vigilante del servidor MCP, para la superficie
 * HTTP del backend (/api/mcp/*, /api/developer/*). Mismo criterio en los dos
 * lados: un atacante no debe encontrar una puerta más floja cambiando de
 * puerto.
 *
 * Se apoya en los mismos catálogos que packages/mcp-server/src/security.
 */

const crypto = require('crypto');

// ─── Catálogos ───────────────────────────────────────────────────────────────

const INJECTION_PATTERNS = [
    { id: 'INJ_IGNORE_INSTRUCTIONS', severity: 'critical', regex: /\b(ignor[ae]|olvida|descarta|disregard|forget|override)\b[^.\n]{0,40}\b(instruc\w*|prompt|reglas?|rules?|system|sistema|anterior\w*|previous|above)\b/i },
    { id: 'INJ_ROLE_OVERRIDE', severity: 'critical', regex: /\b(you are now|act as|actúa como|a partir de ahora eres|from now on you are|new instructions?|nuevas instrucciones|developer mode|modo desarrollador|jailbreak|DAN mode)\b/i },
    { id: 'INJ_SYSTEM_IMPERSONATION', severity: 'critical', regex: /(\[\s*(system|assistant|developer)\s*\]|<\s*\/?\s*(system|assistant|im_start|im_end)\s*>|^\s*(system|sistema)\s*:)/im },
    { id: 'INJ_EXFILTRATE_SECRETS', severity: 'critical', regex: /\b(reveal|show|print|dump|envía|manda|send|leak|exfiltra\w*|muestra|dime)\b[^.\n]{0,60}\b(api[_\s-]?key|secret|token|password|contraseña|private[_\s-]?key|clave privada|seed|mnemonic|env|environment|\.env|credential\w*|credencial\w*)\b/i },
    { id: 'INJ_TOOL_COERCION', severity: 'high', regex: /\b(call|invoke|ejecuta|llama a|usa la herramienta|use the tool|transfer|transfiere|withdraw|retira|refund|reembolsa|payout)\b[^.\n]{0,60}\b(tool|herramienta|all funds|todos los fondos|balance|wallet|saldo|stripe|treasury|tesorería)\b/i },
    { id: 'INJ_HIDDEN_CHANNEL', severity: 'high', regex: /[​-‏‪-‮⁠-⁯﻿]/ },
    { id: 'INJ_URL_EXFIL', severity: 'high', regex: /https?:\/\/[^\s"']*[?&](?:q|data|payload|token|key|secret|body)=[^\s"'&]{16,}/i },
];

const SECRET_PATTERNS = [
    { id: 'SEC_STRIPE_LIVE', severity: 'critical', regex: /\b(sk|rk)_live_[A-Za-z0-9]{16,}/g },
    { id: 'SEC_STRIPE_TEST', severity: 'high', regex: /\b(sk|rk)_test_[A-Za-z0-9]{16,}/g },
    { id: 'SEC_STRIPE_WEBHOOK', severity: 'critical', regex: /\bwhsec_[A-Za-z0-9]{16,}/g },
    { id: 'SEC_PRIVATE_KEY_HEX', severity: 'critical', regex: /\b0x[a-fA-F0-9]{64}\b/g },
    { id: 'SEC_PEM_BLOCK', severity: 'critical', regex: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g },
    { id: 'SEC_BEZHAS_API_KEY', severity: 'critical', regex: /\bbzh_(?:live|dev|pro|ent|test)_[A-Za-z0-9]{8,}/g },
    { id: 'SEC_JWT', severity: 'high', regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
    { id: 'SEC_GITHUB_TOKEN', severity: 'critical', regex: /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}/g },
    { id: 'SEC_AWS_KEY', severity: 'critical', regex: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
    { id: 'SEC_OPENAI_ANTHROPIC', severity: 'critical', regex: /\b(?:sk-ant-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{32,})/g },
    { id: 'SEC_DB_URI', severity: 'high', regex: /\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis):\/\/[^\s:@/]+:[^\s:@/]+@/g },
];

const FORBIDDEN_ENV_KEYS = [
    'RELAYER_PRIVATE_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'JWT_SECRET',
    'MONGODB_URI', 'ADMIN_TOKEN', 'GITHUB_TOKEN', 'FIRECRAWL_API_KEY',
    'TALLY_API_KEY', 'ALPACA_API_KEY', 'ALPACA_SECRET_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY',
];

const SEVERITY_RANK = { low: 1, medium: 2, high: 3, critical: 4 };

// ─── Escáner ─────────────────────────────────────────────────────────────────

function scanString(text, path, findings) {
    if (!text) return;
    const subject = text.length > 200000 ? text.slice(0, 200000) : text;
    const check = (patterns, kind) => {
        for (const p of patterns) {
            const re = new RegExp(p.regex.source, p.regex.flags.replace('g', ''));
            if (re.test(subject)) {
                findings.push({ patternId: p.id, kind, severity: p.severity, path });
            }
        }
    };
    check(INJECTION_PATTERNS, 'injection');
    check(SECRET_PATTERNS, 'secret');
}

function redactString(text) {
    let out = text;
    for (const p of SECRET_PATTERNS) {
        out = out.replace(new RegExp(p.regex.source, p.regex.flags), (m) => `[REDACTADO:${p.id}:${m.length}]`);
    }
    return out;
}

function walk(value, path, findings, depth) {
    if (depth > 12) return value;
    if (typeof value === 'string') {
        scanString(value, path, findings);
        return redactString(value);
    }
    if (Array.isArray(value)) return value.map((v, i) => walk(v, `${path}[${i}]`, findings, depth + 1));
    if (value && typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            scanString(k, `${path}.<clave>`, findings);
            out[k] = walk(v, path ? `${path}.${k}` : k, findings, depth + 1);
        }
        return out;
    }
    return value;
}

function scan(value) {
    const findings = [];
    const redacted = walk(value, '', findings, 0);
    let maxSeverity = null;
    for (const f of findings) {
        if (!maxSeverity || SEVERITY_RANK[f.severity] > SEVERITY_RANK[maxSeverity]) maxSeverity = f.severity;
    }
    return { findings, maxSeverity, redacted };
}

function scanEnvLeak(value) {
    const findings = [];
    let serialized = '';
    try { serialized = JSON.stringify(value) || ''; } catch { return findings; }
    if (!serialized) return findings;
    for (const key of FORBIDDEN_ENV_KEYS) {
        const secret = process.env[key];
        if (!secret || secret.length < 12) continue;
        if (serialized.includes(secret)) {
            findings.push({ patternId: `ENV_LEAK_${key}`, kind: 'secret', severity: 'critical', path: '<cuerpo>' });
        }
    }
    return findings;
}

// ─── Auditoría encadenada ────────────────────────────────────────────────────

const GENESIS = '0'.repeat(64);
const auditEntries = [];
let auditSeq = 0;
let auditPrev = GENESIS;
const MAX_AUDIT = 500;

function recordAudit({ route, subject, verdict, reason, findings }) {
    const base = {
        seq: ++auditSeq,
        ts: new Date().toISOString(),
        route,
        subject,
        verdict,
        reason,
        findings: (findings || []).map((f) => ({ patternId: f.patternId, kind: f.kind, severity: f.severity, path: f.path })),
        prevHash: auditPrev,
    };
    const hash = crypto.createHash('sha256').update(JSON.stringify(base)).digest('hex');
    const entry = { ...base, hash };
    auditPrev = hash;
    auditEntries.push(entry);
    if (auditEntries.length > MAX_AUDIT) auditEntries.shift();
    return entry;
}

function verifyChain() {
    let prev = auditEntries.length ? auditEntries[0].prevHash : GENESIS;
    for (const e of auditEntries) {
        const { hash, ...rest } = e;
        const recomputed = crypto.createHash('sha256').update(JSON.stringify(rest)).digest('hex');
        if (rest.prevHash !== prev || recomputed !== hash) return { valid: false, brokenAt: e.seq };
        prev = hash;
    }
    return { valid: true };
}

// ─── Política ────────────────────────────────────────────────────────────────

const policy = {
    get enforce() { return !/^(0|false|no|off)$/i.test(process.env.WATCHDOG_ENFORCE || 'true'); },
    get blockAtSeverity() {
        const raw = (process.env.WATCHDOG_BLOCK_AT || 'high').toLowerCase();
        return ['low', 'medium', 'high', 'critical'].includes(raw) ? raw : 'high';
    },
};

// ─── Middlewares ─────────────────────────────────────────────────────────────

function subjectOf(req) {
    const key = req.header('X-API-Key') || req.header('authorization') || '';
    return key ? `key:${String(key).slice(-8)}` : `ip:${req.ip}`;
}

/**
 * Inspecciona el cuerpo entrante. Bloquea si trae una inyección de prompt o
 * un secreto por encima del umbral configurado.
 */
function watchdogRequest(req, res, next) {
    if (!req.body || (typeof req.body === 'object' && !Object.keys(req.body).length)) return next();

    const { findings: scanFindings, maxSeverity } = scan(req.body);
    const findings = [...scanFindings, ...scanEnvLeak(req.body)];

    let worst = maxSeverity;
    for (const f of findings) {
        if (!worst || SEVERITY_RANK[f.severity] > SEVERITY_RANK[worst]) worst = f.severity;
    }

    if (worst && SEVERITY_RANK[worst] >= SEVERITY_RANK[policy.blockAtSeverity]) {
        const ids = [...new Set(findings.map((f) => f.patternId))].join(', ');
        const reason = `Contenido sospechoso en la petición (${ids}).`;
        recordAudit({ route: req.originalUrl, subject: subjectOf(req), verdict: 'block', reason, findings });

        if (policy.enforce) {
            return res.status(400).json({
                success: false,
                blockedBy: 'BeZhas Watchdog',
                error: 'Petición rechazada',
                reason,
                code: 'WATCHDOG_BLOCKED',
            });
        }
    } else if (findings.length) {
        recordAudit({ route: req.originalUrl, subject: subjectOf(req), verdict: 'redact', reason: 'Hallazgos por debajo del umbral.', findings });
    }

    next();
}

/**
 * Inspecciona la respuesta antes de enviarla. Impide que un secreto salga por
 * la API aunque una capa inferior lo haya incluido por error.
 */
function watchdogResponse(req, res, next) {
    const originalJson = res.json.bind(res);

    res.json = (body) => {
        const { findings: scanFindings, redacted } = scan(body);
        const findings = [...scanFindings, ...scanEnvLeak(body)];
        const secrets = findings.filter((f) => f.kind === 'secret');
        const critical = secrets.find((f) => f.severity === 'critical');

        if (critical) {
            const reason = `La respuesta contenía un secreto crítico (${critical.patternId}). Se ha retenido.`;
            recordAudit({ route: req.originalUrl, subject: subjectOf(req), verdict: 'block', reason, findings });
            if (policy.enforce) {
                return originalJson({
                    success: false,
                    blockedBy: 'BeZhas Watchdog',
                    error: 'Respuesta retenida',
                    reason,
                    code: 'WATCHDOG_BLOCKED_RESPONSE',
                });
            }
        }

        if (secrets.length) {
            recordAudit({ route: req.originalUrl, subject: subjectOf(req), verdict: 'redact', reason: 'Secretos redactados en la respuesta.', findings });
            return originalJson(redacted);
        }
        return originalJson(body);
    };

    next();
}

module.exports = {
    watchdogRequest,
    watchdogResponse,
    scan,
    recordAudit,
    verifyChain,
    getAudit: (limit = 50) => auditEntries.slice(-limit),
    auditStats: () => ({
        total: auditEntries.length,
        block: auditEntries.filter((e) => e.verdict === 'block').length,
        redact: auditEntries.filter((e) => e.verdict === 'redact').length,
    }),
    policy,
    INJECTION_PATTERNS,
    SECRET_PATTERNS,
};
