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
    finance: 'Pagos y compra de BEZ',
    ecosystem: 'Apps del ecosistema',
    apps: 'Herramientas',
    account: 'Cuenta y planes',
    docs: 'Documentos',
});

/**
 * Destinos = rutas REALES del frontend oficial (www.bezhas.com, `frontend/`, Vite). Las apps secundarias
 * (BZ Capital, BeZhas Wallet, Edge Nodes…) cuelgan de `/dashboard/*` en el mismo dominio y son los mismos
 * enlaces que ofrece el selector de apps (AppSwitcher): `external: true` = navegación completa, fuera del router de la SPA.
 *
 * kind: 'navigate' (abre una ruta) | 'docs' (panel con los documentos del cliente) | 'plans' (panel de planes).
 * sensitive: la ventana pide confirmación y recuerda que el chat no ejecuta operaciones ni pide claves.
 * requires: { plans?: [...] , roles?: [...] } — vacío = cualquier usuario con sesión.
 * keywords: términos (sin tildes, minúsculas) que activan la sugerencia a partir del mensaje del usuario.
 */
const CATALOG = Object.freeze([
    // ── Activos y tokenización (SPA) ──
    { id: 'tokenize_asset', category: 'assets', kind: 'navigate', href: '/rwa', sensitive: true,
      title: 'Tokenizar un activo', description: 'Convierte un inmueble o bien real en un activo tokenizado (simulación, aprobación y firma segura).',
      keywords: ['tokenizar', 'tokenizacion', 'tokenize', 'tokenization', 'activo real', 'inmueble', 'real asset'] },
    { id: 'rwa_explore', category: 'assets', kind: 'navigate', href: '/rwa', sensitive: false,
      title: 'Explorar activos RWA', description: 'Consulta y gestiona activos del mundo real tokenizados.',
      keywords: ['rwa', 'activos reales', 'real world', 'invertir', 'inversion'] },
    { id: 'real_estate', category: 'assets', kind: 'navigate', href: '/real-estate', sensitive: false,
      title: 'Inmobiliario tokenizado', description: 'Explora el simulador inmobiliario.',
      keywords: ['inmobiliario', 'real estate', 'propiedad', 'vivienda'] },
    // ── Pagos y compra de BEZ (SPA) ──
    { id: 'buy_bez', category: 'finance', kind: 'navigate', href: '/buy-tokens', sensitive: true,
      title: 'Comprar BEZ', description: 'Compra BEZ con tarjeta, cripto o MoonPay.',
      keywords: ['comprar bez', 'comprar tokens', 'buy bez', 'buy tokens', 'moonpay', 'tarjeta', 'stripe', 'adquirir'] },
    { id: 'bezpay', category: 'finance', kind: 'navigate', href: '/pay', sensitive: true,
      title: 'BeZhas Pay', description: 'Pagos y cobros con BezPay.',
      keywords: ['pagar', 'pago', 'pagos', 'bezpay', 'payment', 'cobrar', 'cobros'] },
    // ── Apps del ecosistema (secundarias, mismo dominio) ──
    { id: 'staking', category: 'ecosystem', kind: 'navigate', href: '/dashboard/farming', external: true, sensitive: true,
      title: 'Staking de BEZ (BZ Capital)', description: 'Deposita BEZ en staking y acumula recompensas en BZ Capital.',
      keywords: ['staking', 'stake', 'recompensas', 'apy', 'rewards', 'bz capital'] },
    { id: 'farming', category: 'ecosystem', kind: 'navigate', href: '/dashboard/farming', external: true, sensitive: true,
      title: 'Yield farming (BZ Capital)', description: 'Aporta liquidez y obtén rendimiento.',
      keywords: ['farming', 'yield', 'liquidez', 'liquidity', 'defi'] },
    { id: 'wallet', category: 'ecosystem', kind: 'navigate', href: '/dashboard/wallet', external: true, sensitive: false,
      title: 'BeZhas Wallet', description: 'Saldos, pagos y gobernanza.',
      keywords: ['wallet', 'cartera', 'saldo', 'balance', 'billetera'] },
    { id: 'bridge', category: 'ecosystem', kind: 'navigate', href: '/dashboard/wallet', external: true, sensitive: true,
      title: 'Bridge cross-chain (Wallet)', description: 'Mueve BEZ entre Polygon, Arbitrum y zkSync desde BeZhas Wallet.',
      keywords: ['bridge', 'puente', 'cross-chain', 'crosschain', 'arbitrum', 'zksync', 'cadena'] },
    { id: 'dao', category: 'ecosystem', kind: 'navigate', href: '/dashboard/wallet', external: true, sensitive: false,
      title: 'Gobernanza DAO (Wallet)', description: 'Vota propuestas desde BeZhas Wallet.',
      keywords: ['dao', 'gobernanza', 'governance', 'votar', 'propuesta', 'vote'] },
    { id: 'gas_tank', category: 'ecosystem', kind: 'navigate', href: '/dashboard/gas', external: true, sensitive: false,
      title: 'Gas Tank', description: 'Gestión de gas fee.',
      keywords: ['gas', 'gas fee', 'comision de red', 'gas tank'] },
    { id: 'edge_nodes', category: 'ecosystem', kind: 'navigate', href: '/dashboard/validators', external: true, sensitive: false,
      title: 'Edge Nodes', description: 'DePIN, nodos y recursos.',
      keywords: ['edge', 'nodo', 'nodos', 'node', 'depin', 'validador', 'validators'] },
    { id: 'vision_scan', category: 'ecosystem', kind: 'navigate', href: '/dashboard/qr', external: true, sensitive: false,
      title: 'Vision Scan / PureScan', description: 'IA, escaneo, certificación y auditoría.',
      keywords: ['escaneo', 'scan', 'qr', 'certificacion', 'auditoria', 'purescan'] },
    { id: 'prestige', category: 'ecosystem', kind: 'navigate', href: '/dashboard/nfts', external: true, sensitive: false,
      title: 'BZ Prestige (NFTs)', description: 'Lujo DPP, NFTs y royalties.',
      keywords: ['nft', 'nfts', 'prestige', 'royalties', 'lujo', 'luxury'] },
    { id: 'cargo_link', category: 'ecosystem', kind: 'navigate', href: '/dashboard/sectors', external: true, sensitive: false,
      title: 'BZ CargoLink', description: 'Logística y manifiestos.',
      keywords: ['cargo', 'carga', 'manifiesto', 'envio', 'envios', 'shipment'] },
    { id: 'energy', category: 'ecosystem', kind: 'navigate', href: '/enterprise', external: true, sensitive: false,
      title: 'BEZ Energy', description: 'Energía tokenizada y soluciones enterprise.',
      keywords: ['energia', 'energy', 'enterprise', 'empresa'] },
    { id: 'sphere', category: 'ecosystem', kind: 'navigate', href: '/solutions', external: true, sensitive: false,
      title: 'BZ Sphere', description: 'Mapa operativo global y soluciones.',
      keywords: ['sphere', 'mapa', 'soluciones', 'solutions'] },
    { id: 'hub', category: 'ecosystem', kind: 'navigate', href: '/dashboard', external: true, sensitive: false,
      title: 'BeZhas Hub', description: 'SSO y consola central de todas las apps.',
      keywords: ['hub', 'consola central', 'dashboard', 'panel', 'sso'] },
    // ── Herramientas (SPA) ──
    { id: 'developer_console', category: 'apps', kind: 'navigate', href: '/developer-console', sensitive: false,
      title: 'Consola de desarrollador', description: 'API keys, SDK y automatizaciones.',
      keywords: ['api', 'sdk', 'desarrollador', 'developer', 'api key', 'webhook', 'automatizacion', 'integracion'] },
    { id: 'business_dashboard', category: 'apps', kind: 'navigate', href: '/business-dashboard', sensitive: false,
      title: 'Panel de empresa', description: 'Métricas y gestión para negocios.',
      keywords: ['negocio', 'business', 'empresa', 'analitica', 'metricas'] },
    { id: 'logistics', category: 'apps', kind: 'navigate', href: '/logistics', sensitive: false,
      title: 'Logística', description: 'Demo de logística y seguimiento.',
      keywords: ['logistica', 'logistics', 'supply chain', 'cadena de suministro'] },
    { id: 'ad_center', category: 'apps', kind: 'navigate', href: '/ad-center', sensitive: false,
      title: 'Ad Center', description: 'Crea y gestiona campañas publicitarias.',
      keywords: ['anuncio', 'anuncios', 'publicidad', 'campana', 'campanas', 'ads', 'advertising'] },
    { id: 'oracle', category: 'apps', kind: 'navigate', href: '/oracle', sensitive: false,
      title: 'Data Oracle', description: 'Datos verificados para contratos y apps.',
      keywords: ['oraculo', 'oracle', 'datos verificados'] },
    { id: 'magazine', category: 'apps', kind: 'navigate', href: '/magazine', sensitive: false,
      title: 'Magazine', description: 'Artículos y novedades.',
      keywords: ['magazine', 'revista', 'articulos', 'noticias', 'news'] },
    { id: 'feed', category: 'apps', kind: 'navigate', href: '/home', sensitive: false,
      title: 'Feed social', description: 'Publicaciones y comunidad.',
      keywords: ['feed', 'social', 'comunidad', 'community', 'publicar'] },
    // ── Cuenta y planes (SPA) ──
    { id: 'subscribe_plans', category: 'account', kind: 'plans', href: '/vip', sensitive: true,
      title: 'Suscribirme a un plan', description: 'Compara Starter, Creator, Business y Enterprise.',
      keywords: ['plan', 'planes', 'suscripcion', 'suscribirme', 'suscribir', 'subscription', 'subscribe', 'upgrade', 'precio', 'precios', 'pricing', 'vip'] },
    { id: 'settings', category: 'account', kind: 'navigate', href: '/settings', sensitive: false,
      title: 'Ajustes de cuenta', description: 'Seguridad, 2FA y preferencias.',
      keywords: ['ajustes', 'configuracion', 'settings', '2fa', 'seguridad', 'contrasena', 'password'] },
    { id: 'profile', category: 'account', kind: 'navigate', href: '/profile', sensitive: false,
      title: 'Mi perfil', description: 'Perfil, balance y estadísticas.',
      keywords: ['perfil', 'profile', 'mi cuenta'] },
    // ── Documentos (SPA) ──
    { id: 'exclusive_docs', category: 'docs', kind: 'docs', href: '/docs', sensitive: false,
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
