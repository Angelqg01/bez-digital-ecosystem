/**
 * Beacon fire-and-forget hacia el Brain Console (obsidian-mcp).
 * Cada request autenticada de la API alimenta el mapa de nodos en vivo:
 * qué actor (agente/tenant/usuario API) usa qué función y cuánto BEZ mueve.
 * Nunca bloquea ni rompe la request: si el Brain está caído, se descarta.
 */
const BRAIN_URL = process.env.OBSIDIAN_MCP_URL || 'http://obsidian-mcp:4007';
const ENABLED = process.env.BRAIN_TELEMETRY !== '0';

// Colapsa IDs en la ruta para no explotar la cardinalidad del grafo
function normalizeRoute(method, route) {
    const clean = String(route || '/')
        .replace(/\/[0-9a-fx]{6,}/gi, '/:id')
        .replace(/\/\d+/g, '/:n');
    return `${method} ${clean}`;
}

// Mapea prefijos de ruta al nodo destino del mapa de plataforma
function targetForRoute(route) {
    const r = String(route || '');
    if (r.startsWith('/api/payments') || r.startsWith('/api/gateway')) return 'BeZhas-Pay';
    if (r.startsWith('/api/blockchain') || r.startsWith('/api/contract')) return 'Smart-Contracts';
    if (r.startsWith('/api/l2') || r.startsWith('/api/tx')) return 'BEZCoinV2-L2';
    if (r.startsWith('/api/energy') || r.startsWith('/api/vpp')) return 'BZ-Energy';
    if (r.startsWith('/api/wallet')) return 'BEZ-Wallet';
    if (r.startsWith('/api/agents') || r.startsWith('/api/ai')) return 'Agent-Runtime';
    return 'API-Backend';
}

function actorFor(req) {
    return (
        req.get?.('x-bezhas-agent') ||
        req.apiKey?.tenantSlug ||
        req.tenant?.slug ||
        req.user?.id ||
        req.get?.('x-api-client') ||
        'api-client'
    );
}

function sendBeacon(req, res) {
    if (!ENABLED) return;
    try {
        const route = req.route?.path || req.path;
        const event = {
            source: String(actorFor(req)).slice(0, 80),
            target: targetForRoute(route),
            fn: normalizeRoute(req.method, route).slice(0, 160),
            tokens: Number(res.getHeader?.('x-ai-tokens')) || 0,
            bez: Number(res.getHeader?.('x-bez-amount')) || 0,
        };
        // fire-and-forget; el AbortController evita fugas de sockets
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 1500);
        fetch(`${BRAIN_URL}/telemetry/usage`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(event),
            signal: controller.signal,
        }).catch(() => {}).finally(() => clearTimeout(timer));
    } catch {
        // telemetría es best-effort: jamás afecta a la request
    }
}

/** Middleware Express: engancha el beacon al finalizar cada respuesta autenticada. */
function brainTelemetryMiddleware(req, res, next) {
    if (req.path === '/api/metrics' || req.path === '/api/health') return next();
    res.on('finish', () => {
        if (res.statusCode < 500) sendBeacon(req, res);
    });
    next();
}

module.exports = { brainTelemetryMiddleware, sendBeacon };
