import { matchPath } from 'react-router-dom';

/**
 * Sello de clasificación de las páginas del Hub — BORRADOR (2026-11-13).
 *
 * Cada página lleva un sello con el nivel mínimo de suscripción que la
 * incluiría. POR AHORA ES SÓLO ETIQUETA: no bloquea el acceso. Sirve para
 * revisar y corregir la clasificación antes de aplicar las guardas.
 *
 * Los niveles son los de api/config/plans.js:
 *   starter         150 acciones de IA, API y SDK por consumo, Hub y Wallet
 *   creator_pro     1.500 acciones, 25 % de gas, SubApps activables
 *   business        15.000 acciones, conectores ERP, 50 % de gas
 *   enterprise_vip  IA sin límite, 100 % de gas, instituciones y holdings
 * más dos que no son un plan: PÚBLICO (sin cuenta) y SUPERADMIN (equipo BeZhas).
 *
 * Criterio: lo que sirve para entrar y entender el producto es público; lo
 * personal y de uso básico es Starter; lo que opera una vertical o necesita
 * volumen sube a Creator Pro o Business; gobernanza y banca institucional a
 * Enterprise VIP; todo lo que administra la plataforma, SuperAdmin.
 *
 * Para cambiar una página basta editar su fila. Un test falla si se añade una
 * ruta a App.jsx sin clasificarla.
 */

export const SHOW_CLASSIFICATION_STAMPS = true;

export const LEVELS = {
  publico:        { id: 'publico',        rank: 0, label: 'Público',        color: '#64748b' },
  starter:        { id: 'starter',        rank: 1, label: 'Starter',        color: '#0d9488' },
  creator_pro:    { id: 'creator_pro',    rank: 2, label: 'Creator Pro',    color: '#2563eb' },
  business:       { id: 'business',       rank: 3, label: 'Business',       color: '#7c3aed' },
  enterprise_vip: { id: 'enterprise_vip', rank: 4, label: 'Enterprise VIP', color: '#d97706' },
  superadmin:     { id: 'superadmin',     rank: 5, label: 'SuperAdmin',     color: '#dc2626' },
};

// [ruta, nivel, nota]. Las rutas admiten :parámetros y /* al final.
export const PAGE_CLASSIFICATION = [
  // ── Públicas: entrar, entender y comprar ──
  ['/', 'publico', 'Portada'],
  ['/home', 'publico', 'Home institucional'],
  ['/portal', 'publico', 'Portal de servicios'],
  ['/landing-commercial', 'publico', 'Landing comercial'],
  ['/landing-legacy', 'publico', 'Landing antigua'],
  ['/light-home', 'publico', 'Demo del sistema de diseño claro'],
  ['/about', 'publico'],
  ['/whitepaper', 'publico'],
  ['/magazine', 'publico'],
  ['/master', 'publico', 'Guía «Cómo dominar BeZhas Hub»'],
  ['/docs', 'publico'],
  ['/docs/:docId', 'publico'],
  ['/client-guides', 'publico', 'Guías de integración'],
  ['/developers/docs', 'publico', 'Portal de documentación de la API'],
  ['/be-vip', 'publico', 'Planes y suscripción'],
  ['/vip', 'publico', 'Alias de /be-vip'],
  ['/vip/success', 'publico', 'Retorno del pago del plan'],
  ['/buy-tokens', 'publico', 'Comprar BEZ'],
  ['/login', 'publico'],
  ['/register', 'publico'],
  ['/auth', 'publico'],
  ['/auth/github/callback', 'publico'],
  ['/auth/linkedin/callback', 'publico'],

  // ── Starter: cuenta y uso básico ──
  ['/feed', 'starter', 'Feed social'],
  ['/home-feed', 'starter', 'Alias del feed'],
  ['/feed-old', 'starter', 'Feed antiguo'],
  ['/profile', 'starter'],
  ['/profile/edit', 'starter'],
  ['/profile/:address', 'starter'],
  ['/settings', 'starter'],
  ['/notifications', 'starter'],
  ['/contacts/sync', 'starter'],
  ['/create', 'starter', 'Centro de creación'],
  ['/pay', 'starter', 'BeZhas Pay'],
  ['/bez-pay', 'starter', 'Alias de /pay'],
  ['/chat', 'starter'],
  ['/ai-chat', 'starter', 'Chat de IA: gasta las 150 acciones del plan'],
  ['/metrics', 'starter', 'Estado de la red'],
  ['/developer-console', 'starter', 'Claves API y SDK por consumo'],
  ['/developers', 'starter', 'Alias de la consola de desarrollo'],
  ['/rewards', 'starter', 'Redirige al perfil'],
  ['/social', 'starter', 'Redirige a /home'],

  // ── Creator Pro: operar una vertical, publicidad y datos ──
  ['/rwa', 'creator_pro', 'Inmobiliaria y RWA'],
  ['/real-estate', 'creator_pro'],
  ['/logistics', 'creator_pro', 'Logística (demo)'],
  ['/oracle', 'creator_pro', 'Data Oracle y workflows'],
  ['/local-ai', 'creator_pro', 'IA local (demo)'],
  ['/ad-center', 'creator_pro'],
  ['/ad-center/*', 'creator_pro', 'Centro de anuncios'],
  ['/ads', 'creator_pro', 'Redirige al centro de anuncios'],
  ['/defi', 'creator_pro', 'Migrada a BZ Capital'],
  ['/defi-hub', 'creator_pro', 'Redirige a /defi'],
  ['/staking', 'creator_pro', 'Migrada a BZ Capital'],
  ['/farming', 'creator_pro', 'Migrada a BZ Capital'],
  ['/liquidity', 'creator_pro', 'Migrada a BZ Capital'],
  ['/bridge', 'creator_pro', 'Migrada a BEZ Wallet'],

  // ── Business: gestión de organización, cumplimiento y datos a escala ──
  ['/business-dashboard', 'business', 'Organización y sedes'],
  ['/compliance', 'business'],
  ['/ml-dashboard', 'business', 'Machine learning'],

  // ── Enterprise VIP: gobernanza e instituciones ──
  ['/governance', 'enterprise_vip', 'Migrada a BEZ Wallet'],
  ['/dao-page', 'enterprise_vip', 'Migrada a BEZ Wallet'],
  ['/dao', 'enterprise_vip'],
  ['/dao/*', 'enterprise_vip', 'Fondos sectoriales de la DAO'],

  // ── SuperAdmin: administra la plataforma ──
  ['/superpanel', 'superadmin'],
  ['/admin-login', 'superadmin', 'Entrada del equipo BeZhas'],
  ['/admin', 'superadmin'],
  ['/admin/*', 'superadmin', 'Panel de administración'],
];

// Las apps nativas del sidebar no son rutas del Hub: se clasifican por su etiqueta.
export const NATIVE_APP_CLASSIFICATION = {
  'CargoLink · Logística': ['creator_pro', 'App nativa'],
  'Energy · VPP': ['business', 'App nativa'],
  'Vision Scan': ['business', 'App nativa (prototipo)'],
  'PureScan · Compliance': ['business', 'App nativa'],
  'Prestige · Club B2B': ['enterprise_vip', 'App nativa (prototipo)'],
  'Genesis · ERP': ['enterprise_vip', 'App nativa (prototipo)'],
  'Capital · DeFi': ['creator_pro', 'App nativa'],
  'Wallet & Gobernanza': ['starter', 'App nativa: Hub y Wallet van incluidos'],
  'Gas Tank': ['creator_pro', 'App nativa: el gas subvencionado empieza en Creator Pro'],
};

const resultado = (nivel, nota) => ({ level: LEVELS[nivel], nota: nota || null });

/** Sello de una ruta del Hub. null si no está clasificada. */
export function classifyPath(pathname) {
  const ruta = String(pathname || '/').split(/[?#]/)[0].replace(/(.)\/+$/, '$1');
  for (const [patron, nivel, nota] of PAGE_CLASSIFICATION) {
    if (matchPath({ path: patron, end: !patron.endsWith('/*') }, ruta)) return resultado(nivel, nota);
  }
  return null;
}

/** Sello de un elemento del sidebar: ruta interna o app nativa. */
export function classifyItem(item) {
  if (!item) return null;
  const nativa = NATIVE_APP_CLASSIFICATION[item.label];
  if (nativa) return resultado(nativa[0], nativa[1]);
  if (typeof item.path === 'string' && item.path.startsWith('/')) return classifyPath(item.path);
  return null;
}
