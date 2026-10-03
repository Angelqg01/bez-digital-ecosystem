/**
 * Catálogo de acciones del chat (enlaces directos a las funciones de la plataforma).
 *
 * Reglas de seguridad:
 *  - Los destinos (`href`) viven SOLO aquí, en servidor. Ni el modelo, ni los documentos
 *    recuperados, ni el cliente pueden introducir un destino nuevo.
 *  - Las sugerencias se calculan a partir del mensaje del propio usuario, nunca del texto que
 *    genera el modelo ni de los documentos (así un documento envenenado no puede mostrar botones).
 *  - Acceso por rol/plan evaluado en servidor al listar y de nuevo al abrir.
 *  - Todos los destinos son rutas internas; se validan con `isSafePath` (sin esquemas, sin `//`).
 *  - Ninguna acción ejecuta transacciones: solo abre la pantalla donde el usuario firma él mismo.
 */

// Planes de pago reconocidos. Lista cerrada: un valor inesperado (p. ej. "[object Object]") NO cuenta como de pago.
const PAID_PLANS = Object.freeze(['creator', 'business', 'enterprise', 'pro', 'vip']);
const isPaidPlan = (plan) => PAID_PLANS.includes(String(plan || '').toLowerCase());

const CATEGORIES = Object.freeze({
    assets: 'Activos y tokenización',
    finance: 'Finanzas y pagos',
    apps: 'Aplicaciones',
    account: 'Cuenta y planes',
    docs: 'Documentos',
});

/**
 * kind: 'navigate' (abre una ruta) | 'docs' (panel con los documentos del cliente) | 'plans' (panel de planes).
 * sensitive: la ventana pide confirmación y recuerda que el chat no ejecuta operaciones ni pide claves.
 * requires: { plans?: [...] , roles?: [...] } — vacío = cualquier usuario con sesión.
 * keywords: términos (sin tildes, minúsculas) que activan la sugerencia a partir del mensaje del usuario.
 */
const CATALOG = Object.freeze([
    { id: 'tokenize_asset', category: 'assets', kind: 'navigate', href: '/rwa', sensitive: true,
      title: 'Tokenizar un activo', description: 'Convierte un inmueble o bien real en un activo tokenizado (simulación, aprobación y firma segura).',
      keywords: ['tokenizar', 'tokenizacion', 'tokenize', 'tokenization', 'activo real', 'inmueble', 'real asset'] },
    { id: 'rwa_explore', category: 'assets', kind: 'navigate', href: '/rwa', sensitive: false,
      title: 'Explorar activos RWA', description: 'Consulta y gestiona activos del mundo real tokenizados.',
      keywords: ['rwa', 'activos reales', 'real world', 'invertir', 'inversion'] },
    { id: 'marketplace', category: 'assets', kind: 'navigate', href: '/marketplace', sensitive: false,
      title: 'Marketplace', description: 'Compra y vende con escrow en el marketplace.',
      keywords: ['marketplace', 'mercado', 'comprar', 'vender', 'nft', 'escrow'] },
    { id: 'staking', category: 'finance', kind: 'navigate', href: '/staking', sensitive: true,
      title: 'Hacer staking de BEZ', description: 'Deposita BEZ en el pool de staking y acumula recompensas.',
      keywords: ['staking', 'stake', 'recompensas', 'apy', 'rewards'] },
    { id: 'farming', category: 'finance', kind: 'navigate', href: '/farming', sensitive: true,
      title: 'Yield farming', description: 'Aporta liquidez y obtén rendimiento.',
      keywords: ['farming', 'yield', 'liquidez', 'liquidity', 'pool'] },
    { id: 'bridge', category: 'finance', kind: 'navigate', href: '/bridge', sensitive: true,
      title: 'Bridge cross-chain', description: 'Mueve BEZ entre Polygon, Arbitrum y zkSync.',
      keywords: ['bridge', 'puente', 'cross-chain', 'crosschain', 'arbitrum', 'zksync', 'cadena'] },
    { id: 'buy_bez', category: 'finance', kind: 'navigate', href: '/bezpay', sensitive: true,
      title: 'Comprar BEZ / pagos', description: 'Paga con tarjeta, cripto o MoonPay.',
      keywords: ['comprar bez', 'pagar', 'pago', 'pagos', 'bezpay', 'tarjeta', 'stripe', 'moonpay', 'buy', 'payment'] },
    { id: 'wallet', category: 'finance', kind: 'navigate', href: '/wallet', sensitive: false,
      title: 'Mi wallet', description: 'Saldos, movimientos y conexión de wallet.',
      keywords: ['wallet', 'cartera', 'saldo', 'balance', 'billetera'] },
    { id: 'dao', category: 'apps', kind: 'navigate', href: '/dao', sensitive: false,
      title: 'Gobernanza DAO', description: 'Vota propuestas y consulta la tesorería.',
      keywords: ['dao', 'gobernanza', 'governance', 'votar', 'propuesta', 'vote'] },
    { id: 'tokenomics', category: 'apps', kind: 'navigate', href: '/tokenomics', sensitive: false,
      title: 'Tokenomics', description: 'Suministro, distribución y utilidad de BEZ.',
      keywords: ['tokenomics', 'suministro', 'supply', 'distribucion', 'emision'] },
    { id: 'developer_console', category: 'apps', kind: 'navigate', href: '/developer-console', sensitive: false,
      title: 'Consola de desarrollador', description: 'API keys, SDK y automatizaciones.',
      keywords: ['api', 'sdk', 'desarrollador', 'developer', 'api key', 'webhook', 'automatizacion', 'integracion'] },
    { id: 'edge_node', category: 'apps', kind: 'navigate', href: '/edge-node', sensitive: false,
      title: 'Edge Node', description: 'Nodos de borde y su estado.',
      keywords: ['edge', 'nodo', 'node'] },
    { id: 'magazine', category: 'apps', kind: 'navigate', href: '/magazine', sensitive: false,
      title: 'Magazine', description: 'Artículos y novedades.',
      keywords: ['magazine', 'revista', 'articulos', 'noticias', 'news'] },
    { id: 'feed', category: 'apps', kind: 'navigate', href: '/feed', sensitive: false,
      title: 'Feed social', description: 'Publicaciones y comunidad.',
      keywords: ['feed', 'social', 'comunidad', 'community', 'publicar'] },
    { id: 'subscribe_plans', category: 'account', kind: 'plans', href: '/settings#plan', sensitive: true,
      title: 'Suscribirme a un plan', description: 'Compara Starter, Creator, Business y Enterprise.',
      keywords: ['plan', 'planes', 'suscripcion', 'suscribirme', 'suscribir', 'subscription', 'subscribe', 'upgrade', 'precio', 'precios', 'pricing', 'vip'] },
    { id: 'settings', category: 'account', kind: 'navigate', href: '/settings', sensitive: false,
      title: 'Ajustes de cuenta', description: 'Seguridad, 2FA y preferencias.',
      keywords: ['ajustes', 'configuracion', 'settings', '2fa', 'seguridad', 'contrasena', 'password'] },
    { id: 'exclusive_docs', category: 'docs', kind: 'docs', href: '/developer-console', sensitive: false,
      title: 'Documentos exclusivos', description: 'Consulta y pregunta sobre los documentos de tu plan y de tu organización.',
      requires: { plans: PAID_PLANS },
      keywords: ['documento', 'documentos', 'docs', 'exclusivo', 'exclusivos', 'manual', 'guia', 'informe', 'document', 'whitepaper'] },
]);

const BY_ID = new Map(CATALOG.map((a) => [a.id, a]));

// Prefijos de ruta permitidos = rutas del catálogo (la fuente de verdad de los destinos).
const ALLOWED_PATHS = Object.freeze([...new Set(CATALOG.map((a) => a.href.split(/[?#]/)[0]))]);

/**
 * ¿Es una ruta interna segura? Rechaza esquemas (javascript:, data:, https:), rutas relativas a protocolo
 * (`//host`), barras invertidas, caracteres de control, codificaciones sospechosas y longitud excesiva.
 * Con `restrictToCatalog` además exige que sea una ruta del catálogo (o una subruta suya).
 */
function isSafePath(href, { restrictToCatalog = true } = {}) {
    if (typeof href !== 'string' || href.length === 0 || href.length > 200) return false;
    if (!/^\/[A-Za-z0-9\-._~/?#=&%]*$/.test(href)) return false;
    if (href.startsWith('//') || href.includes('\\') || href.includes('..')) return false;
    if (/%(2f|5c|00|0d|0a|2e)/i.test(href)) return false; // /, \, NUL, CR, LF y punto codificados
    if (!restrictToCatalog) return true;
    const path = href.split(/[?#]/)[0];
    return ALLOWED_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

const normalize = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Estado de acceso de un principal a una acción: { allowed, reason } (reason: 'plan' | 'role'). */
function access(principal, action) {
    const req = action.requires;
    if (!req) return { allowed: true };
    const roles = (principal && principal.roles) || [];
    if (roles.includes('ADMIN') || roles.includes('SUPER_ADMIN')) return { allowed: true };
    if (req.roles && !req.roles.some((r) => roles.includes(r))) return { allowed: false, reason: 'role' };
    if (req.plans && !req.plans.includes(String((principal && principal.plan) || '').toLowerCase())) return { allowed: false, reason: 'plan' };
    return { allowed: true };
}

/** Proyección pública (lo que viaja al cliente). Nunca incluye keywords. El href se entrega solo si está permitido. */
function view(principal, action) {
    const { allowed, reason } = access(principal, action);
    return {
        id: action.id, category: action.category, categoryLabel: CATEGORIES[action.category],
        kind: action.kind, title: action.title, description: action.description, sensitive: !!action.sensitive,
        locked: !allowed, lockReason: allowed ? undefined : reason,
        upgradeActionId: !allowed && reason === 'plan' ? 'subscribe_plans' : undefined,
    };
}

function listActions(principal) {
    if (!principal) return [];
    return CATALOG.map((a) => view(principal, a));
}

/**
 * Sugiere acciones a partir del mensaje del usuario. Puntúa por coincidencia de palabras clave
 * (frases > palabras sueltas) y devuelve las `limit` mejores. Texto de entrada acotado.
 */
function suggestActions(principal, text, { limit = 3 } = {}) {
    if (!principal || typeof text !== 'string') return [];
    const haystack = ` ${normalize(text.slice(0, 2000)).replace(/[^a-z0-9+\- ]/g, ' ')} `;
    const scored = [];
    for (const a of CATALOG) {
        let score = 0;
        for (const kw of a.keywords) {
            const k = normalize(kw);
            if (haystack.includes(` ${k} `) || (k.length >= 5 && haystack.includes(` ${k}`))) score += k.includes(' ') ? 3 : 1;
        }
        if (score > 0) scored.push({ a, score });
    }
    scored.sort((x, y) => y.score - x.score);
    return scored.slice(0, Math.max(0, Math.min(limit, 5))).map(({ a }) => view(principal, a));
}

/**
 * Resuelve una acción para abrirla: valida id, acceso y destino. Lanza {status} si no procede.
 * Devuelve { id, kind, href, sensitive }.
 */
function resolveAction(principal, id) {
    if (!principal) throw Object.assign(new Error('Sesión inválida'), { status: 401 });
    if (typeof id !== 'string' || !/^[a-z_]{2,40}$/.test(id) || !BY_ID.has(id)) throw Object.assign(new Error('Acción no encontrada'), { status: 404 });
    const action = BY_ID.get(id);
    const { allowed, reason } = access(principal, action);
    if (!allowed) {
        const err = Object.assign(new Error(reason === 'plan' ? 'Esta función requiere un plan de pago' : 'No tienes permiso para esta función'), { status: 403, reason });
        if (reason === 'plan') err.upgradeActionId = 'subscribe_plans';
        throw err;
    }
    if (!isSafePath(action.href)) throw Object.assign(new Error('Destino no permitido'), { status: 500 }); // salvaguarda interna
    return { id: action.id, kind: action.kind, href: action.href, sensitive: !!action.sensitive };
}

module.exports = { CATALOG, CATEGORIES, PAID_PLANS, ALLOWED_PATHS, isPaidPlan, isSafePath, listActions, suggestActions, resolveAction };
