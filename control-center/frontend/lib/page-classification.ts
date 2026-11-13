/**
 * Sello de clasificación de las páginas del Control Center — BORRADOR (2026-11-13).
 *
 * Es la MISMA clasificación que la del Hub
 * (App-nativas/Bezhas-Hub/frontend/src/config/pageClassification.js): mismos
 * niveles, mismos colores y el mismo criterio. Cada página lleva el nivel mínimo
 * de suscripción que la incluiría. POR AHORA ES SÓLO ETIQUETA: no bloquea nada.
 *
 * Niveles (api/config/plans.js): starter · creator_pro · business · enterprise_vip,
 * más PÚBLICO (sin cuenta) y SUPERADMIN (equipo BeZhas).
 *
 * Criterio: lo que sirve para entrar y entender el producto es público; lo
 * personal y de uso básico, Starter; operar una vertical o necesitar volumen,
 * Creator Pro o Business; gobernanza y red de validadores, Enterprise VIP; lo
 * que administra la plataforma, SuperAdmin.
 *
 * Una página que está en los dos productos (p. ej. /bridge, /docs) debe llevar el
 * mismo nivel en ambos: un test lo comprueba. Otro falla si se crea una página
 * sin clasificarla.
 */

export const SHOW_CLASSIFICATION_STAMPS = true;

export type LevelId = 'publico' | 'starter' | 'creator_pro' | 'business' | 'enterprise_vip' | 'superadmin';

export interface Level { id: LevelId; rank: number; label: string; color: string }

export const LEVELS: Record<LevelId, Level> = {
    publico:        { id: 'publico',        rank: 0, label: 'Público',        color: '#64748b' },
    starter:        { id: 'starter',        rank: 1, label: 'Starter',        color: '#0d9488' },
    creator_pro:    { id: 'creator_pro',    rank: 2, label: 'Creator Pro',    color: '#2563eb' },
    business:       { id: 'business',       rank: 3, label: 'Business',       color: '#7c3aed' },
    enterprise_vip: { id: 'enterprise_vip', rank: 4, label: 'Enterprise VIP', color: '#d97706' },
    superadmin:     { id: 'superadmin',     rank: 5, label: 'SuperAdmin',     color: '#dc2626' },
};

export interface Stamp { level: Level; nota: string | null }

// [ruta, nivel, nota]. Admiten [param] (Next), :param y /* al final.
export const PAGE_CLASSIFICATION: ReadonlyArray<readonly [string, LevelId, string?]> = [
    // ── Públicas: web comercial, documentación y entrada ──
    ['/', 'publico', 'Portada'],
    ['/solutions', 'publico'],
    ['/commerce', 'publico'],
    ['/enterprise', 'publico'],
    ['/payments', 'publico'],
    ['/financial', 'publico'],
    ['/bridges', 'publico', 'Información de bridges'],
    ['/network', 'publico', 'Estado público de la red'],
    ['/token', 'publico', 'BEZ-Coin'],
    ['/token/buy', 'publico', 'Comprar BEZ'],
    ['/precios', 'publico', 'Planes y precios'],
    ['/developers', 'publico', 'Portal de desarrolladores'],
    ['/mcp', 'publico', 'BeZhas MCP'],
    ['/learn', 'publico'],
    ['/docs', 'publico'],
    ['/docs/[slug]', 'publico'],
    ['/rpc', 'publico', 'Endpoints RPC y nodos'],
    ['/validators', 'publico', 'Información de validadores'],
    ['/support', 'publico'],
    ['/privacy', 'publico'],
    ['/demo', 'publico', 'Demo de sólo lectura para clientes'],
    ['/login', 'publico'],
    ['/register', 'publico'],

    // ── Starter: cuenta y uso básico ──
    ['/client-dashboard', 'starter', 'Portal del cliente'],
    ['/onboarding', 'starter'],
    ['/dashboard', 'starter'],
    ['/dashboard/profile', 'starter'],
    ['/dashboard/settings', 'starter'],
    ['/dashboard/notifications', 'starter'],
    ['/dashboard/credits', 'starter', 'Saldo prepago de la API'],
    ['/dashboard/wallet', 'starter'],
    ['/dashboard/transactions', 'starter'],
    ['/dashboard/nfts', 'starter'],
    ['/dashboard/qr', 'starter'],
    ['/dashboard/gamification', 'starter'],
    ['/dashboard/market', 'starter'],

    // ── Creator Pro: operar una vertical, gas y datos ──
    ['/logistics', 'creator_pro', 'Logística'],
    ['/dashboard/documents', 'creator_pro'],
    ['/dashboard/channels', 'creator_pro'],
    ['/dashboard/sectors', 'creator_pro'],
    ['/dashboard/sectors/[sector]', 'creator_pro'],
    ['/dashboard/gas', 'creator_pro', 'Gas Tank: el gas subvencionado empieza en Creator Pro'],
    ['/dashboard/analytics', 'creator_pro'],
    ['/dashboard/ai-agent', 'creator_pro'],
    ['/dashboard/ai-logs', 'creator_pro'],
    ['/dashboard/bridge', 'creator_pro', 'Igual que /bridge del Hub'],
    ['/dashboard/farming', 'creator_pro', 'Igual que /farming del Hub'],

    // ── Business: ERP, agentes, auditoría y volumen ──
    ['/onboarding/erp-webhook', 'business', 'Conectores ERP: incluidos desde Business'],
    ['/dashboard/agents', 'business'],
    ['/dashboard/runtime', 'business', 'Runtime de agentes'],
    ['/dashboard/contracts', 'business'],
    ['/dashboard/parity', 'business', 'Auditoría de paridad'],
    ['/dashboard/blockchain', 'business', 'Explorador de la L2'],
    ['/dashboard/aegis', 'business', 'Aegis AI'],

    // ── Enterprise VIP: red de validadores e instituciones ──
    ['/dashboard/validators', 'enterprise_vip'],
    ['/dashboard/validators/register', 'enterprise_vip'],
    ['/dashboard/validators/[address]', 'enterprise_vip'],
    ['/onboarding/validator-cli', 'enterprise_vip'],

    // ── SuperAdmin: administra la plataforma ──
    ['/monitor', 'superadmin', 'War Room: monitorización interna'],
    ['/dashboard/sequencer', 'superadmin', 'Secuenciador de la L2'],
    ['/admin/login', 'superadmin', 'Entrada del equipo BeZhas'],
    ['/admin/recover', 'superadmin'],
    ['/admin/profile', 'superadmin'],
    ['/admin/*', 'superadmin'],
];

const escapar = (s: string) => s.replace(/[.*+?^${}()|\\]/g, '\\$&');

function aRegExp(patron: string): RegExp {
    if (patron === '/') return /^\/$/;
    const comodin = patron.endsWith('/*');
    const base = comodin ? patron.slice(0, -2) : patron;
    const fuente = base
        .split('/')
        .map((seg) => (/^(\[.+\]|:.+)$/.test(seg) ? '[^/]+' : escapar(seg)))
        .join('/');
    return new RegExp(`^${fuente}${comodin ? '(?:/.*)?' : ''}$`);
}

const FILAS = PAGE_CLASSIFICATION.map(([patron, nivel, nota]) => ({ re: aRegExp(patron), nivel, nota }));

/** Sello de una ruta. null si no está clasificada. */
export function classifyPath(pathname: string | null | undefined): Stamp | null {
    const ruta = String(pathname || '/').split(/[?#]/)[0].replace(/(.)\/+$/, '$1');
    for (const f of FILAS) {
        if (f.re.test(ruta)) return { level: LEVELS[f.nivel], nota: f.nota ?? null };
    }
    return null;
}
