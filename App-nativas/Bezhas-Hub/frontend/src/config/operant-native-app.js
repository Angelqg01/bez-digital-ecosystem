// operant-native-app.js — OPERANT (gestión empresarial autónoma) dentro de los
// planes de suscripción.
//
// ESPEJO DE CARA AL CLIENTE de `api/config/operant-services.js`, que es la
// fuente canónica. Aquí vive SOLO lo que el cliente puede ver: departamentos,
// cuotas, autonomía, anclaje y precio por tarea.
//
// Lo que NO entra aquí, y no debe entrar nunca: coste real de Claude, coste de
// cómputo y margen bruto por plan. Eso es dimensionado interno y vive en
// `docs/OPERANT_NATIVE_APP.md`. Un precio se publica; una estructura de márgenes no.
//
// Si cambian las cuotas en el backend, hay que tocar este archivo también. El
// endpoint público `GET /api/operant/catalog` devuelve lo mismo, así que una
// divergencia se detecta comparando contra él.

/** Los 10 departamentos, con lo que hace cada uno. */
export const OPERANT_DEPARTMENTS = [
  { id: 'sales', label: 'Ventas', tier: 'frontier', icon: '💼',
    blurb: 'Prospección, scoring de leads, outreach, negociación y propuestas.' },
  { id: 'support', label: 'Soporte', tier: 'mid', icon: '🎧',
    blurb: 'Triaje de tickets, base de conocimiento, resolución y CSAT.' },
  { id: 'marketing', label: 'Marketing', tier: 'frontier', icon: '📣',
    blurb: 'Contenido, copy, SEO, cola social con aprobación y tests A/B.' },
  { id: 'finance', label: 'Finanzas', tier: 'mid', icon: '💶', hitl: true,
    blurb: 'Facturación, cobros, previsión de tesorería, conciliación y pago en $BEZ.' },
  { id: 'hr', label: 'RRHH', tier: 'mid', icon: '👥', hitl: true,
    blurb: 'Cribado de CV con redacción de datos personales, entrevistas y onboarding.' },
  { id: 'operations', label: 'Operaciones', tier: 'mid', icon: '⚙️',
    blurb: 'Proyectos, compras, reposición de inventario e informes.' },
  { id: 'legal', label: 'Legal / Compliance', tier: 'mid', icon: '⚖️', hitl: true,
    blurb: 'Contratos, MiCA/DAC8/GDPR, DPIA y screening de sanciones.' },
  { id: 'blockchain', label: 'Blockchain Ops', tier: 'mid', icon: '🔗', hitl: true,
    blurb: 'Monitor on-chain, optimizador de gas y vigilancia de slashing.' },
  { id: 'treasury', label: 'Tesorería', tier: 'mid', icon: '🏦', hitl: true,
    blurb: 'Runway, tokenomics, vesting y gestión de liquidez.' },
  { id: 'fundraising', label: 'Fundraising', tier: 'frontier', icon: '🚀', hitl: true,
    blurb: 'Scoring de inversores, outreach a fondos, cap table y data room.' },
];

/**
 * Alias de los ids de tier que usa la página /be-vip ('creator', 'enterprise')
 * hacia los ids canónicos de config/plans.js. Existen porque BeVIP.jsx nació
 * con su propia tabla; mientras no se unifiquen, este mapa evita que la sección
 * de OPERANT quede en blanco en dos de los cuatro planes.
 */
const PLAN_ALIASES = { creator: 'creator_pro', enterprise: 'enterprise_vip' };

/** Precio por tarea de cara al cliente (coste + margen ya aplicado). */
export const OPERANT_TASK_PRICE_EUR = { frontier: 0.1969, mid: 0.1271 };
export const EUR_PER_CREDIT = 0.001;

/**
 * Precio mensual del módulo, por plan. Va por plan porque lo que entrega va por
 * plan: la cuota de tareas. El razonamiento completo (suelo de coste, techo de
 * valor y márgenes a distintos niveles de consumo) está en `config/pricing.js`,
 * que es de donde salen estos números — aquí se re-exportan para que la ficha
 * de OPERANT en /be-vip no tenga que importar toda la calculadora.
 */
export const OPERANT_MODULE_PRICE_EUR = {
  starter: 0,              // pago por uso puro: no hay cuota que cobrar
  creator_pro: 39,
  business: 249,
  enterprise_vip: 1199,
};

/**
 * Lo que costaría comprar la cuota del plan suelta, a pago por uso. Es el techo
 * de la ventana de precio y, de cara al cliente, la cifra que demuestra que
 * activar el módulo sale a cuenta.
 */
export function paygValueOf(planId) {
  const plan = getOperantPlan(planId);
  if (!plan || !plan.includedTasks) return 0;
  const frontier = Math.min(plan.frontierCap ?? plan.includedTasks, plan.includedTasks);
  const mid = plan.includedTasks - frontier;
  return Number((frontier * OPERANT_TASK_PRICE_EUR.frontier + mid * OPERANT_TASK_PRICE_EUR.mid).toFixed(2));
}

/** Ahorro (%) de activar el módulo frente a comprar la misma cuota suelta. */
export function savingsVsPayg(planId) {
  const payg = paygValueOf(planId);
  const precio = modulePriceOf(planId);
  if (!payg || precio == null) return null;
  return Math.round((1 - precio / payg) * 100);
}

export function modulePriceOf(planId) {
  const id = PLAN_ALIASES[planId] || planId;
  return OPERANT_MODULE_PRICE_EUR[id] ?? null;
}

export const AUTONOMY_LABELS = {
  draft: 'Borrador',
  assisted: 'Asistida',
  autonomous: 'Autónoma',
  governed: 'Gobernada por DAO',
};

export const AUTONOMY_BLURBS = {
  draft: 'Los agentes preparan, nunca envían: todo espera tu visto bueno.',
  assisted: 'Envían lo de riesgo bajo; el resto pasa por ti.',
  autonomous: 'Actúan salvo línea roja (activos, datos personales, compromiso legal).',
  governed: 'Autónoma, y las políticas de los agentes se votan en BeZhasDAO.',
};

export const ANCHOR_LABELS = {
  none: 'Sin anclaje on-chain',
  weekly: 'Anclaje semanal',
  daily: 'Anclaje diario',
  continuous: 'Anclaje continuo',
};

/** Qué desbloquea cada plan. Claves = ids de `config/plans.js`. */
export const OPERANT_BY_PLAN = {
  starter: {
    departments: ['sales', 'support'],
    includedTasks: 0,          // 0 = pago por uso puro
    frontierCap: null,
    maxConcurrent: 1,
    rpm: 60,
    autonomy: 'draft',
    anchor: 'none',
    retentionDays: 30,
    onchain: ['auditChainLocal'],
  },
  creator_pro: {
    departments: ['sales', 'support', 'marketing', 'finance'],
    includedTasks: 300,
    frontierCap: 100,
    maxConcurrent: 3,
    rpm: 300,
    autonomy: 'assisted',
    anchor: 'weekly',
    retentionDays: 180,
    onchain: ['auditChainLocal', 'auditAnchor', 'bezRewards'],
  },
  business: {
    departments: ['sales', 'support', 'marketing', 'finance', 'hr', 'operations', 'legal', 'blockchain'],
    includedTasks: 2000,
    frontierCap: 600,
    maxConcurrent: 8,
    rpm: 1200,
    autonomy: 'autonomous',
    anchor: 'daily',
    retentionDays: 730,
    onchain: ['auditChainLocal', 'auditAnchor', 'bezRewards', 'bezSettlement', 'nftCertificates', 'onchainHitl'],
  },
  enterprise_vip: {
    departments: OPERANT_DEPARTMENTS.map((d) => d.id),
    includedTasks: 9000,
    frontierCap: 3000,
    maxConcurrent: 25,
    rpm: 6000,
    autonomy: 'governed',
    anchor: 'continuous',
    retentionDays: 2555,
    onchain: ['auditChainLocal', 'auditAnchor', 'bezRewards', 'bezSettlement',
              'nftCertificates', 'onchainHitl', 'daoPolicies', 'dedicatedEdgeNode'],
  },
};

/** Capacidades on-chain, explicadas para quien las va a contratar. */
export const ONCHAIN_FEATURE_LABELS = {
  auditChainLocal: 'Auditoría encadenada por hash: alterar un registro rompe la cadena y se ve.',
  auditAnchor: 'La raíz de tu auditoría anclada en BeZhas L2: prueba con fecha ante una due diligence.',
  bezRewards: 'El consumo de OPERANT acumula staking en $BEZ al APY de tu plan.',
  bezSettlement: 'Paga proveedores en $BEZ desde la wallet de dispersión (siempre con aprobación humana).',
  nftCertificates: 'Entregables y cierres de auditoría emitidos como NFT verificable.',
  onchainHitl: 'Quién aprobó qué y cuándo, firmado y registrado on-chain.',
  daoPolicies: 'Las reglas de los agentes se cambian por votación en BeZhasDAO.',
  dedicatedEdgeNode: 'Edge Node dedicado: inferencia y datos en tu propia infraestructura.',
};

/**
 * Separador de miles español. Se hace a mano y no con `toLocaleString('es-ES')`
 * porque un Node compilado con small-icu ignora el locale y devuelve "2000"
 * en vez de "2.000" — y el mismo componente se renderiza en servidor y cliente,
 * así que la discrepancia además provocaría un error de hidratación.
 */
const miles = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export function getOperantPlan(planId) {
  const id = PLAN_ALIASES[planId] || planId;
  return OPERANT_BY_PLAN[id] || null;
}

export function getDepartment(id) {
  return OPERANT_DEPARTMENTS.find((d) => d.id === id) || null;
}

/** Departamentos de un plan, ya resueltos a objetos. */
export function departmentsOf(planId) {
  const plan = getOperantPlan(planId);
  if (!plan) return [];
  return plan.departments.map(getDepartment).filter(Boolean);
}

/**
 * Línea de resumen para la tarjeta del plan. Starter no tiene cuota: decir
 * "0 tareas" se leería como "no lo incluye", cuando lo que pasa es que se paga
 * por uso desde la primera.
 */
export function operantSummary(planId) {
  const plan = getOperantPlan(planId);
  if (!plan) return null;
  const deps = plan.departments.length;
  const tareas = plan.includedTasks === 0
    ? 'pago por uso'
    : `${miles(plan.includedTasks)} tareas/mes`;
  return `OPERANT: ${deps} departamento${deps === 1 ? '' : 's'} de agentes IA · ${tareas}`;
}

export default OPERANT_BY_PLAN;
