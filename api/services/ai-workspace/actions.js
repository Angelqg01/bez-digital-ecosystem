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

// Planes de pago reconocidos (ids de config/plans.js). Lista cerrada: un valor inesperado NO cuenta como de pago.
const PAID_PLANS = Object.freeze(['creator_pro', 'business', 'enterprise_vip']);
const isPaidPlan = (plan) => PAID_PLANS.includes(String(plan || '').toLowerCase());

const CATEGORIES = Object.freeze({
    finance: 'Pagos y compra de BEZ',
    ecosystem: 'Apps del ecosistema',
    apps: 'Herramientas',
    account: 'Cuenta y planes',
    docs: 'Documentos',
});

/**
 * Destinos = rutas REALES del control center (www.bezhas.com, `control-center/frontend`, Next.js).
 *
 * kind: 'navigate' (abre una ruta) | 'docs' (panel con los documentos del cliente) | 'plans' (panel de planes).
 * sensitive: la ventana pide confirmación y recuerda que el chat no ejecuta operaciones ni pide claves.
 * requires: { plans?: [...] , roles?: [...] } — vacío = cualquier usuario con sesión.
 * keywords: términos (sin tildes, minúsculas) que activan la sugerencia a partir del mensaje del usuario.
 */
const CATALOG = Object.freeze([
    // ── Pagos y compra de BEZ ──
    { id: 'buy_bez', category: 'finance', kind: 'navigate', href: '/token/buy', sensitive: true,
      title: 'Comprar BEZ', description: 'Compra BEZ con tarjeta o transferencia SEPA.',
      keywords: ['comprar bez', 'comprar tokens', 'buy bez', 'buy tokens', 'tarjeta', 'stripe', 'adquirir', 'transferencia', 'compro bez', 'compra bez', 'quiero bez'] },
    { id: 'token_info', category: 'finance', kind: 'navigate', href: '/token', sensitive: false,
      title: 'BEZ-Coin', description: 'Precio, contrato y mercado del token BEZ.',
      keywords: ['bez', 'token', 'bez-coin', 'bezcoin', 'contrato', 'precio bez'] },
    { id: 'payments', category: 'finance', kind: 'navigate', href: '/payments', sensitive: true,
      title: 'Pagos', description: 'Métodos de pago y cobros de la plataforma.',
      keywords: ['pagar', 'pago', 'pagos', 'bezpay', 'payment', 'cobrar', 'cobros', 'factura', 'nomina', 'nominas', 'salarios', 'pagar nominas', 'transferencia', 'sepa', 'cobro', 'clientes', 'tarjeta', 'cobrar a clientes', 'proveedores'] },
    // ── Apps del ecosistema ──
    { id: 'staking', category: 'ecosystem', kind: 'navigate', href: '/dashboard/farming', sensitive: true,
      title: 'Staking y farming', description: 'Deposita BEZ y acumula recompensas.',
      keywords: ['staking', 'stake', 'recompensas', 'apy', 'rewards', 'farming', 'yield', 'liquidez', 'defi'] },
    { id: 'wallet', category: 'ecosystem', kind: 'navigate', href: '/dashboard/wallet', sensitive: false,
      title: 'Wallet', description: 'Saldos y movimientos.',
      keywords: ['wallet', 'cartera', 'saldo', 'balance', 'billetera'] },
    { id: 'bridge', category: 'ecosystem', kind: 'navigate', href: '/dashboard/bridge', sensitive: true,
      title: 'Bridge', description: 'Mueve activos entre redes.',
      keywords: ['bridge', 'puente', 'cross-chain', 'crosschain', 'cadena'] },
    { id: 'gas_tank', category: 'ecosystem', kind: 'navigate', href: '/dashboard/gas', sensitive: false,
      title: 'Gas', description: 'Gestión del gas de las operaciones.',
      keywords: ['gas', 'gas fee', 'comision de red', 'gas tank'] },
    { id: 'edge_nodes', category: 'ecosystem', kind: 'navigate', href: '/dashboard/validators', sensitive: false,
      title: 'Edge Nodes y validadores', description: 'Nodos, validadores y su estado.',
      keywords: ['edge', 'nodo', 'nodos', 'node', 'depin', 'validador', 'validadores', 'validators'] },
    { id: 'vision_scan', category: 'ecosystem', kind: 'navigate', href: '/dashboard/qr', sensitive: false,
      title: 'Escaneo y certificación', description: 'QR, escaneo y certificación.',
      keywords: ['escaneo', 'scan', 'qr', 'certificacion', 'auditoria', 'purescan'] },
    { id: 'nfts', category: 'ecosystem', kind: 'navigate', href: '/dashboard/nfts', sensitive: false,
      title: 'NFTs', description: 'NFTs, pasaportes de producto y royalties.',
      keywords: ['nft', 'nfts', 'prestige', 'royalties', 'lujo', 'luxury', 'tokenizar', 'tokenizacion', 'activo real', 'rwa'] },
    { id: 'sectors', category: 'ecosystem', kind: 'navigate', href: '/dashboard/sectors', sensitive: false,
      title: 'Sectores y logística', description: 'Logística, manifiestos y sectores.',
      keywords: ['cargo', 'carga', 'manifiesto', 'envio', 'envios', 'shipment', 'sector', 'sectores'] },
    { id: 'enterprise', category: 'ecosystem', kind: 'navigate', href: '/enterprise', sensitive: false,
      title: 'Soluciones enterprise', description: 'BeZhas para empresas e instituciones.',
      keywords: ['energia', 'energy', 'enterprise', 'empresa', 'institucion', 'erp', 'sap', 'tokeniz', 'tokenizar', 'tokenizacion', 'activos', 'activo', 'rwa', 'contabilidad', 'nomina', 'nominas'] },
    { id: 'dashboard', category: 'ecosystem', kind: 'navigate', href: '/dashboard', sensitive: false,
      title: 'Panel', description: 'Consola central de la plataforma.',
      keywords: ['hub', 'consola central', 'dashboard', 'panel'] },
    // ── Herramientas ──
    { id: 'developers', category: 'apps', kind: 'navigate', href: '/developers', sensitive: false,
      title: 'Desarrolladores', description: 'API keys, SDK y webhooks.',
      keywords: ['api', 'sdk', 'desarrollador', 'developer', 'api key', 'webhook', 'automatizacion', 'integracion', 'erp', 'integrar', 'software contable'] },
    { id: 'mcp', category: 'apps', kind: 'navigate', href: '/mcp', sensitive: false,
      title: 'Conectar una IA (MCP)', description: 'Conecta Claude, ChatGPT, Gemini u otros a BeZhas.',
      keywords: ['mcp', 'claude', 'chatgpt', 'gemini', 'codex', 'antigravity', 'conectar ia', 'agente', 'erp', 'integrar', 'integracion'] },
    { id: 'onboarding', category: 'apps', kind: 'navigate', href: '/onboarding', sensitive: false,
      title: 'Alta y configuración', description: 'Wallet, Edge Node y conexión del ERP.',
      keywords: ['alta', 'onboarding', 'empezar', 'configurar', 'registrar empresa', 'conectar erp', 'kyb', 'verificar empresa', 'verificacion empresa', 'alta empresa', 'dar de alta'] },
    { id: 'logistics', category: 'apps', kind: 'navigate', href: '/logistics', sensitive: false,
      title: 'Logística', description: 'Seguimiento y trazabilidad.',
      keywords: ['logistica', 'logistics', 'supply chain', 'cadena de suministro', 'trazabilidad'] },
    { id: 'agents', category: 'apps', kind: 'navigate', href: '/dashboard/agents', sensitive: false,
      title: 'Agentes de IA', description: 'Agentes y automatizaciones.',
      keywords: ['agente', 'agentes', 'automatizar', 'bot'] },
    // ── Cuenta y planes ──
    { id: 'subscribe_plans', category: 'account', kind: 'plans', href: '/payments', sensitive: true,
      title: 'Suscribirme a un plan', description: 'Compara Starter, Creator Pro, Business y Enterprise VIP.',
      keywords: ['plan', 'planes', 'suscripcion', 'suscribirme', 'suscribir', 'subscription', 'subscribe', 'upgrade', 'precio', 'precios', 'pricing', 'vip'] },
    { id: 'settings', category: 'account', kind: 'navigate', href: '/dashboard/settings', sensitive: false,
      title: 'Ajustes de cuenta', description: 'Seguridad, 2FA y preferencias.',
      keywords: ['ajustes', 'configuracion', 'settings', '2fa', 'seguridad', 'contrasena', 'password'] },
    { id: 'profile', category: 'account', kind: 'navigate', href: '/dashboard/profile', sensitive: false,
      title: 'Mi perfil', description: 'Perfil y estadísticas.',
      keywords: ['perfil', 'profile', 'mi cuenta'] },
    { id: 'support', category: 'account', kind: 'navigate', href: '/support', sensitive: false,
      title: 'Soporte', description: 'Contacta con el equipo de BeZhas.',
      keywords: ['soporte', 'ayuda', 'support', 'contacto', 'incidencia'] },
    // ── Documentos ──
    { id: 'exclusive_docs', category: 'docs', kind: 'docs', href: '/dashboard/documents', sensitive: false,
      title: 'Documentos exclusivos', description: 'Consulta y pregunta sobre los documentos de tu plan y de tu organización.',
      requires: { plans: PAID_PLANS },
      keywords: ['documento', 'documentos', 'docs', 'exclusivo', 'exclusivos', 'manual', 'guia', 'informe', 'document', 'whitepaper', 'documentacion'] },
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
        kind: action.kind, title: action.title, description: action.description, sensitive: !!action.sensitive, external: !!action.external,
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
const { tokenize: tokenizar } = require('../knowledge/bm25');

function suggestActions(principal, text, { limit = 3 } = {}) {
    if (!principal || typeof text !== 'string') return [];
    const haystack = ` ${normalize(text.slice(0, 2000)).replace(/[^a-z0-9+\- ]/g, ' ')} `;
    // Además de la palabra literal se compara por RAÍZ (misma que usa la búsqueda): «cobro» ↔ «cobros», «tokenizo» ↔ «tokenizar».
    const raices = new Set(tokenizar(text.slice(0, 2000)));
    const scored = [];
    for (const a of CATALOG) {
        let score = 0;
        for (const kw of a.keywords) {
            const k = normalize(kw);
            const kr = tokenizar(kw);
            const porPalabra = haystack.includes(` ${k} `) || (k.length >= 5 && haystack.includes(` ${k}`));
            const porRaiz = kr.length > 0 && kr.every((t) => raices.has(t));
            if (porPalabra || porRaiz) score += k.includes(' ') ? 3 : 1;
        }
        if (score > 0) scored.push({ a, score });
    }
    scored.sort((x, y) => y.score - x.score);
    return scored.slice(0, Math.max(0, Math.min(limit, 5))).map(({ a }) => view(principal, a));
}

/**
 * Resuelve una acción para abrirla: valida id, acceso y destino. Lanza {status} si no procede.
 * Devuelve { id, kind, href, sensitive, external }.
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
    return { id: action.id, kind: action.kind, href: action.href, sensitive: !!action.sensitive, external: !!action.external };
}

module.exports = { CATALOG, CATEGORIES, PAID_PLANS, ALLOWED_PATHS, isPaidPlan, isSafePath, listActions, suggestActions, resolveAction };
