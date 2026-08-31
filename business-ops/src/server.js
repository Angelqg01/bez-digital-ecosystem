'use strict';

require('dotenv').config();

// Del .env del monorepo se hereda SOLO lo que de verdad hay que compartir con
// la API de BeZhas. Nada más.
//
// Heredarlo entero era tentador y estaba mal: arrastraba también su
// DATABASE_URL —el rol dueño, que se salta la Row-Level Security— y con él
// business-ops se quedaba sin aislamiento entre tenants. Los tests lo
// destaparon: uno borra DATABASE_URL a propósito para forzar store en memoria,
// y el respaldo se lo devolvía por detrás apuntando a la base de BeZhas.
//
// JWT_SECRET sí se comparte, y a propósito: el puente de auth tiene que
// verificar con EL MISMO secreto que firma la API. Una copia se desincroniza.
(() => {
  const COMPARTIDAS = ['JWT_SECRET'];
  const raiz = require('path').resolve(__dirname, '../../.env');
  if (!require('fs').existsSync(raiz)) return;
  const heredado = require('dotenv').parse(require('fs').readFileSync(raiz));
  for (const clave of COMPARTIDAS) {
    if (process.env[clave] === undefined && heredado[clave] !== undefined) {
      process.env[clave] = heredado[clave];
    }
  }
})();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const TenantManager = require('./core/TenantManager');
const ModelGateway = require('./cognition/ModelGateway');
const createStore = require('./platform/createStore');
const CostTracker = require('./platform/CostTracker');
const UsageMeter = require('./platform/UsageMeter');
const SupportMetrics = require('./platform/SupportMetrics');
const Telemetry = require('./platform/Telemetry');
const OtlpExporter = require('./platform/OtlpExporter');
const LangfuseExporter = require('./platform/LangfuseExporter');
const HealthWatchdog = require('./platform/HealthWatchdog');
const ApiKeyRegistry = require('./platform/ApiKeyRegistry');
const RateLimiter = require('./platform/RateLimiter');
const Billing = require('./platform/Billing');
const Scheduler = require('./platform/Scheduler');
const HitlNotifier = require('./platform/HitlNotifier');
const { signup } = require('./platform/onboarding');
const { buildDashboard } = require('./platform/dashboard');
const { streamTenantEvents } = require('./platform/sse');
const path = require('path');
const EmailConnector = require('./connectors/EmailConnector');
const TwentyCRM = require('./connectors/TwentyCRM');
const StorageConnector = require('./connectors/StorageConnector');
const FileSystemConnector = require('./connectors/FileSystemConnector');
const VectorDB = require('./connectors/VectorDB');
const StripeConnector = require('./connectors/StripeConnector');
const LinkedInConnector = require('./connectors/LinkedInConnector');
const MCPConnector = require('./connectors/MCPConnector');
const intake = require('./platform/leadIntake');
const csat = require('./platform/csat');
const sentimentCalibration = require('./platform/sentimentCalibration');
const macros = require('./platform/macros');
const pricing = require('./platform/priceCatalog');
const expenseCategories = require('./platform/expenseCategories');
const socialQueue = require('./platform/socialQueue');
const BlockchainConnector = require('./connectors/BlockchainConnector');
const BeZhasCoreConnector = require('./connectors/BeZhasCoreConnector');
const RuntimeToolsConnector = require('./connectors/RuntimeToolsConnector');
const SystemMonitor = require('./connectors/SystemMonitor');
const CalendarConnector = require('./connectors/CalendarConnector');
const AutomationConnector = require('./connectors/AutomationConnector');
const WebChannel = require('./channels/WebChannel');
const TelegramChannel = require('./channels/TelegramChannel');
const WhatsAppChannel = require('./channels/WhatsAppChannel');
const EmailChannel = require('./channels/EmailChannel');
const { createTransports } = require('./channels/transports');
const plans = require('../config/plans.json');

// Canales de entrada/salida. Sin credenciales → modo simulado (ver transports.js).
const transports = createTransports(process.env);
const channels = {
  web: new WebChannel({ apiKey: process.env.INTERNAL_API_KEY }),
  telegram: new TelegramChannel({ send: transports.telegram, secret: process.env.TELEGRAM_WEBHOOK_SECRET }),
  whatsapp: new WhatsAppChannel({ send: transports.whatsapp, verifyToken: process.env.WHATSAPP_VERIFY_TOKEN }),
  email: new EmailChannel({ send: transports.email }),
};

// ── Model Gateway — motor híbrido por tier ──
// frontier (decisiones críticas) → Claude · mid/fast (volumen) → Ollama local.
// Sin claves/servidor de cada proveedor, el tier cae a modo simulado.
const providers = {};
if (process.env.ANTHROPIC_API_KEY) {
  const Anthropic = require('@anthropic-ai/sdk');
  providers.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}
if (process.env.OLLAMA_URL || process.env.USE_OLLAMA === 'true') {
  const OllamaProvider = require('./cognition/providers/ollama');
  providers.ollama = new OllamaProvider({ baseUrl: process.env.OLLAMA_URL });
}
// Mapa de tiers híbrido (configurable por env para cambiar de motor sin tocar agentes).
const tierMap = {
  frontier: { provider: process.env.TIER_FRONTIER_PROVIDER || 'anthropic', model: process.env.TIER_FRONTIER_MODEL || 'claude-opus-4-8' },
  mid:      { provider: process.env.TIER_MID_PROVIDER || (providers.ollama ? 'ollama' : 'anthropic'), model: process.env.TIER_MID_MODEL || (providers.ollama ? 'qwen2.5:14b' : 'claude-sonnet-4-6') },
  fast:     { provider: process.env.TIER_FAST_PROVIDER || (providers.ollama ? 'ollama' : 'anthropic'), model: process.env.TIER_FAST_MODEL || (providers.ollama ? 'qwen2.5:7b' : 'claude-haiku-4-5') },
};
// El store se crea aquí (antes que los trackers) porque uso y coste persisten.
// Prioridad: DATABASE_URL (Postgres) → SQLITE_PATH (base de datos interna
// embebida; por defecto data/operant.db) → memoria (SQLITE_PATH=memory).
const sqlitePath = process.env.SQLITE_PATH === 'memory'
  ? null
  : (process.env.SQLITE_PATH || path.join(__dirname, '../data/operant.db'));
const store = createStore({ databaseUrl: process.env.DATABASE_URL, sqlitePath });

const costTracker = new CostTracker({ store });
const usageMeter = new UsageMeter({ store });
const telemetry = new Telemetry();
// Empuje de métricas a un colector OTel (SigNoz/Grafana/Collector). Sin
// OTEL_EXPORTER_OTLP_ENDPOINT no arranca: /metrics (Prometheus) sigue estando
// para quien prefiera scrapear en vez de recibir.
const otlp = new OtlpExporter({ telemetry });
// Traza cada llamada al modelo (prompt, respuesta, tokens, tenant, agente) en
// Langfuse self-hosted. Sin LANGFUSE_PUBLIC_KEY/SECRET_KEY/BASE_URL no hace nada.
const langfuse = new LangfuseExporter({});
const modelGateway = new ModelGateway({
  providers,
  tierMap,
  // En el SaaS una tarea nunca muere porque el proveedor de IA falle:
  // degrada a respuesta simulada marcada (fallback:true) y sigue el flujo.
  fallbackToSimulated: true,
  onUsage: (u) => {
    costTracker.record(u);
    telemetry.recordModel(u);
    langfuse.recordModel(u);
    if (u.meta?.tenantId) usageMeter.record(u.meta.tenantId);
  },
});

// ── Tenant Manager ──
const supportMetrics = new SupportMetrics();
const apiKeys = new ApiKeyRegistry({ store });
const rateLimiter = new RateLimiter();
const billing = new Billing({ plans });
const hitlNotifier = HitlNotifier.fromEnv(process.env); // enruta por departamento a su bot
// RAG semántico si hay Ollama: el embedder local alimenta la KnowledgeBase.
const embedder = providers.ollama ? (text) => providers.ollama.embed(text) : null;
const tenants = new TenantManager({
  modelGateway, store, usageMeter, metrics: supportMetrics, telemetry, hitlNotifier, plans, embedder,
  // 0 = sin timeout/escalado (comportamiento anterior). Ver .env.example.
  hitlTimeoutMs: Number(process.env.HITL_TIMEOUT_MS || 0),
  hitlEscalateAfterMs: Number(process.env.HITL_ESCALATE_AFTER_MS || 0),
});
// Vigilante de salud: convierte las métricas en avisos accionables (tasa de
// error, dead-letter sin revisar, cuota al límite, motor IA degradado a
// simulado). No pasa por la cola del tenant: no le gasta cuota del plan.
const watchdog = new HealthWatchdog({ tenants, telemetry, usageMeter, notifier: hitlNotifier });
// Agentes proactivos: trabajos recurrentes por tenant (persistidos, ver Scheduler).
// La acción 'digest' genera el Digest del CEO sin que nadie lo pida.
const { buildDigest, lastDigest } = require('./platform/digest');
const digestDeps = { tenants, usageMeter, costTracker, supportMetrics, billing, plans, modelGateway, store };
const scheduler = new Scheduler({
  tenants, store,
  actions: {
    digest: (tenantId) => buildDigest(digestDeps, tenantId),
    // Sin este trabajo el embudo solo corría si alguien pulsaba el botón: los
    // leads del formulario público se quedaban en cola indefinidamente.
    funnel: async (tenantId) => {
      const space = tenants.get(tenantId);
      if (!space?.funnel) return { skipped: 'sin departamento de Ventas' };
      const { summary } = await space.funnel.run();
      return summary;
    },
    learn: async (tenantId) => {
      const space = tenants.get(tenantId);
      if (space?.learning) return space.learning.learnAll(space.orchestrator.agentIds());
    },
    // El optimizador se consulta a menudo y actúa poco. `readiness()` es una
    // cuenta en memoria: preguntar cada 15 min no cuesta nada, y así el ciclo
    // caro salta en cuanto hay evidencia en vez de esperar al día siguiente.
    optimize: async (tenantId) => {
      const space = tenants.get(tenantId);
      if (!space?.optimizer) return { skipped: 'sin optimizador' };
      return space.optimizer.cycle();
    },
  },
});

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

/**
 * Trabajos proactivos por defecto de un tenant.
 *
 * Los genéricos (digest, aprendizaje) los tiene todo el mundo. Los de
 * vigilancia dependen del departamento contratado: no tiene sentido monitorizar
 * la cadena en un tenant sin departamento 'blockchain' — gastaría cuota del
 * plan en una tarea que no puede atender nadie.
 *
 * Idempotente: `addJob` hace upsert por id y conserva `lastRunAt`, así que
 * volver a llamarla (p. ej. al rehidratar) no dispara ejecuciones en cascada.
 */
async function registerDefaultJobs(tenantId, departments = []) {
  const has = (d) => departments.includes(d);

  await scheduler.addJob(tenantId, {
    id: 'digest-diario',
    description: 'Digest ejecutivo diario para el dueño del negocio',
    everyMs: DIA,
    action: 'digest',
  });

  // Cierra el bucle de mejora continua: sin este trabajo, el LearningEngine
  // solo corría si alguien pulsaba el botón del panel.
  await scheduler.addJob(tenantId, {
    id: 'aprendizaje-diario',
    description: 'Destila los playbooks de cada agente desde su memoria episódica',
    everyMs: DIA,
    action: 'learn',
  });

  // Optimización del propio sistema. Cada 15 min NO significa reconfigurar cada
  // 15 min: el trabajo pregunta si hay evidencia suficiente y casi siempre se
  // va sin hacer nada. Lo que compra esa frecuencia es el caso urgente — una
  // regla de enrutado rota se detecta en minutos, no al día siguiente.
  await scheduler.addJob(tenantId, {
    id: 'optimizacion-sistema',
    description: 'Ajusta enrutado, modelo por departamento y autonomía cuando la evidencia lo justifica',
    everyMs: 15 * 60 * 1000,
    action: 'optimize',
  });

  if (has('blockchain')) {
    await scheduler.addJob(tenantId, {
      id: 'onchain-monitor',
      description: 'Vigila cadena, validadores, tesorería y gas; alerta si algo se sale de rango',
      everyMs: 30 * 60 * 1000,
      input: { text: 'Revisa el estado de la cadena, validadores y gas', channel: 'scheduler' },
    });
  }

  if (has('sales')) {
    await scheduler.addJob(tenantId, {
      id: 'captacion-embudo',
      description: 'Procesa los leads del formulario público: puntúa, elige ángulo y prepara el outreach (el envío sigue pasando por HITL)',
      everyMs: 30 * 60 * 1000,
      action: 'funnel',
    });
  }

  if (has('marketing')) {
    // Sin este trabajo, `SocialSchedulerAgent` existía pero no lo llamaba
    // nadie: los posts programados se quedaban en la cola para siempre.
    // Cada 15 min basta — un ciclo sin nada pendiente no gasta modelo (el
    // agente no llama a think() en su camino por defecto), solo mira la cola.
    await scheduler.addJob(tenantId, {
      id: 'publicar-programado',
      description: 'Publica lo programado cuya aprobación siga vigente; congela todo si el freno está puesto',
      everyMs: 15 * 60 * 1000,
      input: { type: 'marketing:publish-due', department: 'marketing', channel: 'scheduler' },
    });
  }

  if (has('treasury')) {
    await scheduler.addJob(tenantId, {
      id: 'treasury-runway',
      description: 'Calcula el runway del Treasury DAO y avisa si se acerca al umbral crítico',
      everyMs: DIA,
      input: { text: 'Cuantos meses de autonomia le quedan a la tesoreria', channel: 'scheduler' },
    });
  }
}

/**
 * Sonda del canal de correo. La configuración es de entorno (no por tenant),
 * así que basta una instancia para saber si la plataforma puede enviar.
 *
 * Existe porque "configurado" y "operativo" no son lo mismo: con SMTP_HOST
 * apuntando a un servidor que no está levantado, el conector se declaraba
 * operativo y el problema solo salía a la luz cuando un envío ya aprobado por
 * un humano moría en la cola de fallos. Ver EmailConnector.verify().
 */
const emailProbe = new EmailConnector({ tenantId: 'plataforma' });

/**
 * Comprueba que los modelos locales que apuntan los tiers están descargados.
 *
 * Un tier que apunta a un modelo inexistente no falla al arrancar: falla en la
 * primera llamada, con un 404 de Ollama, y el gateway degrada a simulado. El
 * resultado es una plataforma que responde con texto inventado marcado en un
 * log que nadie mira, después de que alguien haya cambiado el modelo en la
 * configuración creyendo que ya estaba activo. Mejor decirlo al arrancar, con
 * el `ollama pull` exacto que falta.
 */
async function checkLocalModels() {
  if (!providers.ollama) return { ok: true, skipped: 'sin motor local' };
  const url = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '');
  let disponibles = [];
  try {
    const r = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(5000) });
    disponibles = (await r.json()).models?.map((m) => m.name) || [];
  } catch (err) {
    console.warn(`⚠ [modelo] Ollama no responde en ${url}: ${err.message}. Los tiers locales irán en simulado.`);
    return { ok: false, detail: `Ollama no responde en ${url}` };
  }

  // Ollama admite 'qwen2.5:7b' y lo lista como 'qwen2.5:7b'; los que no llevan
  // etiqueta se listan con ':latest'.
  const tiene = (m) => disponibles.some((d) => d === m || d === `${m}:latest` || d.replace(/:latest$/, '') === m);
  const faltan = [...new Set(
    Object.entries(tierMap)
      .filter(([, t]) => t.provider === 'ollama' && t.model && !tiene(t.model))
      .map(([tier, t]) => `${tier} → ${t.model}`)
  )];

  if (faltan.length) {
    const modelos = [...new Set(faltan.map((f) => f.split('→ ')[1]))];
    console.warn(
      `\n⚠ [modelo] TIERS SIN MODELO DESCARGADO: ${faltan.join(', ')}\n` +
      `  Esos tiers responderán en SIMULADO (texto de relleno, no del modelo).\n` +
      modelos.map((m) => `  docker exec operant-ollama-1 ollama pull ${m}`).join('\n') + '\n'
    );
    return { ok: false, detail: `sin descargar: ${faltan.join(', ')}` };
  }
  console.log(`[modelo] tiers locales listos: ${Object.entries(tierMap).map(([k, t]) => `${k}=${t.model}`).join(' · ')}`);
  return { ok: true };
}

/** Comprueba el canal de correo y lo deja dicho en el arranque. */
async function checkEmailChannel() {
  const estado = await emailProbe.verify({ force: true });
  const d = emailProbe.describe();
  if (d.mode === 'simulado') {
    console.log('[email] sin configurar → modo simulado (no se enviará ningún correo)');
  } else if (estado.ok) {
    console.log(`[email] canal ${d.mode} operativo (${d.target}, remitente ${d.from})`);
  } else {
    console.warn(
      `\n⚠ [email] CANAL DEGRADADO — ${estado.detail}\n` +
      `  Configurado como ${d.mode} hacia ${d.target}, pero no responde.\n` +
      `  Los envíos aprobados NO saldrán: se devolverán como no enviados con el motivo.\n` +
      `  Se reintenta la comprobación sola; en cuanto el servidor responda, el canal se recupera.\n`
    );
  }
  return estado;
}

/** Conectores por tenant (aislados). Única fábrica para alta y rehidratación. */
function buildTools(tenantId) {
  return {
    email: new EmailConnector({ tenantId }),
    crm: new TwentyCRM({ tenantId }),
    storage: new StorageConnector({ tenantId }),
    fs: new FileSystemConnector({ tenantId }),
    vectordb: new VectorDB({ tenantId, config: { embedder, store } }),
    stripe: new StripeConnector({ tenantId }),
    blockchain: new BlockchainConnector({ tenantId }),
    'bezhas-core': new BeZhasCoreConnector({ tenantId }),
    // Herramientas del runtime de BeZhas (validadores, puente L1<->L2, gas).
    // Entra como un conector más: el `method` es el nombre de la tool. Cada
    // invocación pasa por PolicyEngine/RedLines de este tenant ANTES de salir,
    // y por los permisos del runtime DESPUÉS — dos preguntas distintas.
    runtime: new RuntimeToolsConnector({ tenantId }),
    sysmon: new SystemMonitor({ tenantId }),
    calendar: new CalendarConnector({ tenantId }),
    automation: new AutomationConnector({ tenantId }),
    linkedin: new LinkedInConnector({ tenantId }),
    // Servidor MCP HTTP público de Microsoft Learn — solo lectura de docs de MS/Azure.
    // Útil para agentes técnicos (Engineering/Blockchain Ops) que consultan referencias.
    'microsoft-learn': new MCPConnector({
      tenantId,
      config: {
        name: 'microsoft-learn',
        url: 'https://learn.microsoft.com/api/mcp',
        policyCategory: 'external_read',
      },
    }),
  };
}

/**
 * Rehidratación al arrancar: reconstruye los tenants (y sus claves de API)
 * que quedaron persistidos en el store. Con InMemoryStore no hay nada que
 * cargar y el arranque es idéntico al de antes.
 */
async function hydrateFromStore() {
  if (typeof store.connect === 'function') await store.connect();
  const restoredKeys = await apiKeys.hydrate();
  if (typeof store.listTenants !== 'function') return { tenants: 0, keys: restoredKeys };
  const saved = await store.listTenants();
  for (const t of saved) {
    const planDef = plans[t.plan] || {};
    await tenants.provision({ tenantId: t.tenantId, plan: t.plan, departments: t.departments, businessId: t.businessId, tools: buildTools(t.tenantId) });
    rateLimiter.setLimit(t.tenantId, planDef.maxRequestsPerMinute);
    await billing.subscribe(t.tenantId, t.plan);
  }
  // Contadores de uso y coste del periodo: sin esto, un reinicio "regalaría"
  // cuota y perdería el gasto acumulado que factura Billing.
  const ids = saved.map((t) => t.tenantId);
  await usageMeter.hydrate(ids);
  await costTracker.hydrate(ids);
  await scheduler.hydrate(ids); // la agenda proactiva también sobrevive

  // Reconcilia la agenda por defecto: un tenant dado de alta antes de que
  // existieran estos trabajos (o que contrató un departamento nuevo después)
  // los recibe al arrancar. addJob es upsert por id y conserva lastRunAt, así
  // que esto no re-dispara nada de lo que ya estaba programado.
  for (const t of saved) {
    try {
      await registerDefaultJobs(t.tenantId, t.departments || []);
    } catch (err) {
      console.warn(`[scheduler:${t.tenantId}] no se pudo reconciliar la agenda: ${err.message}`);
    }
  }
  return { tenants: saved.length, keys: restoredKeys };
}

// ── API ──
const app = express();
app.use(cors());
// verify: guarda el body crudo — lo necesita el webhook de Stripe para
// comprobar la firma (Stripe-Signature) antes de confiar en el evento.
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.static(path.join(__dirname, '../public'))); // panel de control en /panel.html

/**
 * Autenticación por clave de API. La clave admin (INTERNAL_API_KEY) accede a
 * todo; la clave de un tenant solo a sus propios recursos (ver scopeToTenant).
 */
function auth(req, res, next) {
  const key = req.headers['x-api-key'];
  if (process.env.INTERNAL_API_KEY && key === process.env.INTERNAL_API_KEY) {
    req.isAdmin = true;
    return next();
  }
  const tenantId = apiKeys.resolve(key);
  if (tenantId) {
    req.authTenant = tenantId;
    return next();
  }

  // Puente con BeZhas: una sesión ya iniciada en la plataforma vale aquí, sin
  // repartir una segunda credencial al usuario. La clave de API se mantiene
  // para integraciones máquina-a-máquina, que no tienen sesión.
  const bezhas = resolveBezhasJwt(req);
  if (bezhas) {
    req.authTenant = bezhas.tenantId;
    req.bezhasUser = bezhas.user;      // trazabilidad: quién pidió, en la auditoría
    return next();
  }

  res.status(401).json({ error: 'no autorizado' });
}

/**
 * Verifica un JWT emitido por la API de BeZhas y lo traduce a un tenant.
 *
 * Tres cosas que NO hace, a propósito:
 *  - No concede `isAdmin`. Administrar la plataforma sigue exigiendo la clave
 *    interna; si un JWT bastara, cualquier usuario de BeZhas gobernaría los
 *    tenants de todos los clientes.
 *  - No lee el tenant del token. El tenant lo fija el despliegue, así que un
 *    token manipulado no puede reclamar otro.
 *  - No funciona sin JWT_SECRET. Nada de secreto de desarrollo por defecto:
 *    sin secreto, esta vía queda cerrada y solo vale la clave de API.
 */
function resolveBezhasJwt(req) {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;

  try {
    // `algorithms` fijado: sin él la librería acepta cualquier algoritmo
    // compatible con la clave y se abre la puerta a la confusión de algoritmo.
    const user = jwt.verify(token, secret, { algorithms: ['HS256'] });
    const tenantId = process.env.BEZHAS_TENANT_ID || 'bezhas';
    if (!tenants.get(tenantId)) return null;      // tenant no aprovisionado aún
    return { tenantId, user };
  } catch {
    return null;                                   // token inválido o caducado
  }
}

/** Restringe al tenant dueño de la clave (salvo admin). */
function scopeToTenant(req, res, next) {
  if (req.isAdmin) return next();
  if (req.authTenant !== req.params.tenantId) return res.status(403).json({ error: 'tenant no autorizado' });
  next();
}

/** Limita la tasa de peticiones del tenant (por minuto, según plan). */
function rateLimit(req, res, next) {
  const id = req.authTenant || req.params.tenantId || 'global';
  const r = rateLimiter.consume(id);
  if (!r.allowed) {
    res.set('Retry-After', Math.ceil(r.retryAfterMs / 1000));
    return res.status(429).json({ error: 'rate limit', code: 'rate_limited', retryAfterMs: r.retryAfterMs });
  }
  next();
}

// ── Puente con el Gateway de BeZhas ───────────────────────────────────────────
// OPERANT se vende como SubApp del ecosistema: el cliente paga su suscripción a
// BeZhas, que comprueba plan, entitlements y cuota y solo entonces llama aquí
// con la clave interna. Estas rutas no hacen control de acceso por tenant a
// propósito — confían en quien ya lo hizo — y por eso están detrás de
// INTERNAL_API_KEY. Sin esa clave definida, el puente queda cerrado del todo.
if (process.env.INTERNAL_API_KEY) {
  const { createBridgeRouter } = require('./bridge/router');
  app.use('/bridge', createBridgeRouter({
    tenants, apiKeys, plans, rateLimiter, billing, store,
    costTracker, usageMeter, buildTools, registerDefaultJobs,
  }));
  console.log('[bridge] puente BeZhas montado en /bridge');
} else {
  console.log('[bridge] puente BeZhas DESACTIVADO (falta INTERNAL_API_KEY)');
}

// Salud
app.get('/', (req, res) => res.json({ status: 'online', product: 'OPERANT', tenants: tenants.list().length }));

// Liveness/readiness: comprueba dependencias (store) sin tocar el flujo.
app.get('/healthz', async (req, res) => {
  const checks = { store: 'unknown', model: providers.anthropic ? 'live' : (providers.ollama ? 'ollama' : 'simulado') };
  try {
    if (store.connect) await store.connect();
    checks.store = 'ok';
  } catch (err) { checks.store = `error: ${err.message}`; }

  // Correo: un canal configurado que no responde no puede aparecer como sano.
  // Usa la comprobación cacheada, así que sondear /healthz no abre una conexión
  // SMTP en cada llamada.
  const correo = await emailProbe.verify();
  const email = emailProbe.describe();
  checks.email = email.mode === 'simulado'
    ? 'simulado'
    : (correo.ok ? `ok (${email.mode})` : `degradado: ${correo.detail}`);

  const ok = checks.store === 'ok' && !emailProbe.degraded;
  res.status(ok ? 200 : 503).json({
    status: ok ? 'healthy' : 'degraded',
    store: store.constructor.name,
    checks,
    email,
    tenants: tenants.list().length,
  });
});

// Métricas en formato Prometheus (scrapeable). Protegido con INTERNAL_API_KEY
// si se define METRICS_TOKEN; abierto en local para facilitar el desarrollo.
app.get('/metrics', (req, res) => {
  const token = process.env.METRICS_TOKEN;
  if (token && req.query.token !== token && req.headers['x-api-key'] !== token) return res.status(401).end();
  res.set('Content-Type', 'text/plain; version=0.0.4').send(telemetry.prometheus());
});

// Alta self-service: crea el tenant y devuelve su clave de API (una vez).
// Público; protégelo con SIGNUP_SECRET si lo defines.
app.post('/signup', async (req, res) => {
  if (process.env.SIGNUP_SECRET && req.headers['x-signup-secret'] !== process.env.SIGNUP_SECRET) {
    return res.status(401).json({ error: 'no autorizado' });
  }
  try {
    const { tenantId, plan, departments, businessId } = req.body;
    const result = await signup({ tenants, apiKeys, plans, rateLimiter, billing }, { tenantId, plan, departments, businessId, tools: buildTools(tenantId) });
    await registerDefaultJobs(result.tenantId, result.departments);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(err.code === 'bad_request' ? 400 : 500).json({ error: err.message });
  }
});

// Alta por el operador (admin). Mismo flujo que /signup.
app.post('/tenants', auth, async (req, res) => {
  if (!req.isAdmin) return res.status(403).json({ error: 'solo admin' });
  try {
    const { tenantId, plan, departments, businessId } = req.body;
    const result = await signup({ tenants, apiKeys, plans, rateLimiter, billing }, { tenantId, plan, departments, businessId, tools: buildTools(tenantId) });
    await registerDefaultJobs(result.tenantId, result.departments);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(err.code === 'bad_request' ? 400 : 500).json({ error: err.message });
  }
});

// Entrada de una solicitud de cliente final
app.post('/tenants/:tenantId/handle', auth, scopeToTenant, rateLimit, async (req, res) => {
  try {
    const taskId = await tenants.handle(req.params.tenantId, req.body);
    res.json({ ok: true, taskId });
  } catch (err) {
    const status = err.code === 'quota_exceeded' ? 429 : 400;
    res.status(status).json({ error: err.message, code: err.code });
  }
});

// Trazas recientes por tarea del tenant (latencia y estado).
app.get('/tenants/:tenantId/traces', auth, scopeToTenant, (req, res) => {
  if (!tenants.get(req.params.tenantId)) return res.status(404).json({ error: 'tenant no encontrado' });
  res.json({ tenantId: req.params.tenantId, traces: telemetry.traces(req.params.tenantId, 25), telemetry: telemetry.snapshot() });
});

// Consultar estado de una tarea
app.get('/tenants/:tenantId/tasks/:taskId', auth, scopeToTenant, async (req, res) => {
  const space = tenants.get(req.params.tenantId);
  if (!space) return res.status(404).json({ error: 'tenant no encontrado' });
  // findTask (no getTask): busca también en el Store si la tarea ya salió de
  // la ventana caliente de RAM.
  const task = await space.orchestrator.findTask(req.params.taskId);
  res.json(task || { error: 'tarea no encontrada' });
});

// Reintentar una tarea interrumpida (por un reinicio) o fallida.
app.post('/tenants/:tenantId/tasks/:taskId/retry', auth, scopeToTenant, rateLimit, async (req, res) => {
  const space = tenants.get(req.params.tenantId);
  if (!space) return res.status(404).json({ error: 'tenant no encontrado' });
  try {
    const taskId = await space.orchestrator.retryTask(req.params.taskId);
    res.json({ ok: true, taskId, retryOf: req.params.taskId });
  } catch (err) {
    const status = err.code === 'quota_exceeded' ? 429 : 400;
    res.status(status).json({ error: err.message });
  }
});

// HITL — listar pendientes y resolver
app.get('/tenants/:tenantId/approvals', auth, scopeToTenant, (req, res) => {
  const space = tenants.get(req.params.tenantId);
  res.json(space ? space.hitl.listPending(req.params.tenantId) : []);
});
/**
 * Espejo de aprobaciones de otro plano. Lo usa la API de BeZhas para que sus
 * aprobaciones SCADA se vean aquí, en una sola bandeja y una sola auditoría.
 *
 * Autentica por el puente de JWT de la Fase 1: la API firma con el secreto
 * compartido y esta ruta lo verifica como cualquier otra sesión. No hace falta
 * repartir una credencial nueva entre servicios.
 */
app.post('/tenants/:tenantId/hitl/mirror', auth, scopeToTenant, (req, res) => {
  const space = tenants.get(req.params.tenantId);
  if (!space) return res.status(404).json({ error: 'tenant no encontrado' });

  const { approvalId, action, status, reason, origin, approvedBy, agentId } = req.body || {};
  if (!approvalId || !action) {
    return res.status(400).json({ error: 'approvalId y action son obligatorios' });
  }

  const out = space.hitl.mirror({
    approvalId, tenantId: req.params.tenantId, agentId: agentId || origin || 'externo',
    action, reason: reason || null, status: status || 'pending',
    origin: origin || 'externo', approvedBy: approvedBy || null,
  });
  res.json({ ok: !!out, ...(out || {}) });
});

app.post('/tenants/:tenantId/approvals/:approvalId', auth, scopeToTenant, (req, res) => {
  const space = tenants.get(req.params.tenantId);
  if (!space) return res.status(404).json({ error: 'tenant no encontrado' });
  const ok = space.hitl.resolve(req.params.approvalId, req.body.approved === true, req.body.note);
  res.json({ ok });
});

// Canal de entrada síncrono (widget web, etc.): normaliza → procesa → responde.
// Nota: los webhooks de proveedores NO llevan nuestra x-api-key; se validan con
// el secreto/firma de cada proveedor vía channel.verify().
app.all('/channels/:channel/:tenantId/inbound', async (req, res) => {
  const channel = channels[req.params.channel];
  if (!channel) return res.status(404).json({ error: `canal no soportado: ${req.params.channel}` });

  // Handshake de verificación (WhatsApp/Meta usa GET hub.challenge).
  if (req.method === 'GET') {
    if (typeof channel.handleVerification === 'function') return channel.handleVerification(req, res);
    return res.status(405).end();
  }
  if (!channel.verify(req)) return res.status(401).json({ error: 'verificación del webhook fallida' });

  // Procesamiento de decisiones HITL vía botones inline de Telegram
  if (req.params.channel === 'telegram' && req.body?.callback_query) {
    const cb = req.body.callback_query;
    const data = cb.data || ''; // "approve_appr_123" o "reject_appr_123"
    const space = tenants.get(req.params.tenantId);
    if (!space) return res.status(404).json({ error: 'tenant no encontrado' });

    let approved = false;
    let approvalId = '';
    if (data.startsWith('approve_')) {
      approved = true;
      approvalId = data.slice(8);
    } else if (data.startsWith('reject_')) {
      approved = false;
      approvalId = data.slice(7);
    }

    if (approvalId) {
      // Se consulta el bot ANTES de resolver (resolve() borra el pendiente):
      // cada aprobación puede vivir en un bot distinto (CEO/CFO/CMO/DevOps/Legal)
      // y hay que contestar el callback con el MISMO bot que lo envió.
      const pending = space.hitl.peek(approvalId);
      const ok = space.hitl.resolve(approvalId, approved, 'Decisión vía Telegram Bot');

      const token = (pending && hitlNotifier.routeFor(pending)?.token) || process.env.TELEGRAM_BOT_TOKEN;
      if (token) {
        try {
          // Si ya se cerró sola (timeout) o ya la decidieron por otro canal,
          // no mentimos diciendo que ESTE clic la decidió.
          const expired = pending?.alreadyResolved;
          await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callback_query_id: cb.id,
              text: expired
                ? `Ya no está activa (${pending.status === 'timeout' ? 'tiempo agotado' : 'ya decidida'}) ⏰`
                : (approved ? 'Acción Aprobada ✅' : 'Acción Rechazada ❌')
            })
          });

          const currentText = cb.message?.text || '';
          const newText = expired
            ? `${currentText}\n\n⏰ Esta aprobación ya se cerró antes de este clic (${pending.status === 'timeout' ? 'tiempo agotado' : 'decisión previa'}). Tu voto (${approved ? 'aprobar' : 'rechazar'}) quedó registrado como tardío.`
            : `${currentText}\n\nDecisión: ${approved ? 'APROBADA ✅' : 'RECHAZADA ❌'} por operador.`;
          await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: cb.message.chat.id,
              message_id: cb.message.message_id,
              text: newText
            })
          });
        } catch (err) {
          console.warn(`[telegram:callback] error actualizando Telegram: ${err.message}`);
        }
      }
      return res.json({ ok, callbackProcessed: true });
    }
  }

  const rl = rateLimiter.consume(req.params.tenantId);
  if (!rl.allowed) {
    res.set('Retry-After', Math.ceil(rl.retryAfterMs / 1000));
    return res.status(429).json({ error: 'rate limit', code: 'rate_limited' });
  }

  try {
    const input = channel.parseInbound(req.body);
    const task = await tenants.handleAndWait(req.params.tenantId, input, { timeoutMs: 30000 });

    if (typeof channel.deliver === 'function') {
      // Canal asíncrono: la respuesta se envía por la API del proveedor.
      const delivery = await channel.deliver({ tenantId: req.params.tenantId, input, task });
      return res.json({ ok: true, escalated: task.result?.outcome === 'escalated', delivery });
    }
    // Canal síncrono (web): la respuesta va en el propio HTTP.
    res.json(channel.formatOutbound(task));
  } catch (err) {
    const status = err.code === 'quota_exceeded' ? 429 : 400;
    res.status(status).json({ error: err.message, code: err.code });
  }
});

// ── Webhook de Stripe ──
// Un pago confirmado con wallet Polygon adjunta (custom_field 'wallet_polygon'
// en el Payment Link) dispara la preparación de una transferencia de BEZ-Coin.
// La transferencia NUNCA se ejecuta aquí: TokenDisbursementAgent la enruta por
// RedLines (crypto_asset_movement) → siempre espera aprobación humana (HITL).
function verifyStripeSignature(rawBody, header, secret) {
  if (!rawBody || !header || !secret) return false;
  const parts = Object.fromEntries(String(header).split(',').map((p) => p.split('=')));
  if (!parts.t || !parts.v1) return false;
  const expected = require('crypto').createHmac('sha256', secret).update(`${parts.t}.${rawBody}`).digest('hex');
  try {
    return require('crypto').timingSafeEqual(Buffer.from(parts.v1, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false; // longitud distinta u otro formato inesperado → firma inválida
  }
}

app.post('/webhooks/stripe/:tenantId', async (req, res) => {
  const ok = verifyStripeSignature(req.rawBody?.toString('utf8'), req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  if (!ok) return res.status(401).json({ error: 'firma de Stripe inválida' });

  const event = req.body || {};
  if (event.type !== 'checkout.session.completed') return res.json({ ok: true, ignored: event.type });

  const session = event.data?.object || {};
  const amountUsd = (session.amount_total || 0) / 100;
  const customerEmail = session.customer_details?.email || session.customer_email || null;
  // Los 4 Payment Links reales ya llevan este campo, con dos keys distintas
  // según cuándo se creó cada uno ('walletaddresstosendbezcoin' / 'wallettosendthebezcoin').
  const walletField = (session.custom_fields || []).find((f) => /wallet/i.test(f.key || ''));
  const walletAddress = walletField?.text?.value || null;

  try {
    if (!tenants.get(req.params.tenantId)) return res.status(404).json({ error: 'tenant no encontrado' });

    if (walletAddress) {
      const taskId = await tenants.handle(req.params.tenantId, {
        type: 'finance:token-purchase', department: 'finance',
        amountUsd, walletAddress, customerEmail, sessionId: session.id,
      });
      return res.json({ ok: true, taskId });
    }
    // Suscripción sin wallet adjunta: Stripe ya gestiona el cobro recurrente,
    // aquí solo se deja constancia en auditoría (nada autónomo que aprobar).
    return res.json({ ok: true, recorded: true, amountUsd, customerEmail });
  } catch (err) {
    console.error(`[stripe:webhook:${req.params.tenantId}] ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// ── Captación de leads ──
//
// `/intake/:tenantId` es el ÚNICO endpoint que escribe sin API key: lo llama el
// formulario público de la web del tenant. Por eso todas las defensas (honeypot,
// throttle por IP, consentimiento RGPD, techo de cola) viven en `leadIntake` y
// se aplican antes de tocar el store. Aquí solo se encola: puntuar, redactar y
// enviar lo hace `LeadFunnel` bajo el orquestador, con cuota, auditoría y HITL.
const intakeThrottle = new intake.IpThrottle({
  max: Number(process.env.INTAKE_MAX_PER_MINUTE || 5),
  windowMs: 60_000,
});

app.post('/intake/:tenantId', async (req, res) => {
  const { tenantId } = req.params;
  if (!tenants.get(tenantId)) return res.status(404).json({ error: 'tenant no encontrado' });

  // `trust proxy` no está activo: con un balanceador delante, usar el primer
  // salto de X-Forwarded-For. Sin él, req.ip es la IP real.
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || 'desconocida';
  const rl = intakeThrottle.consume(ip);
  if (!rl.allowed) {
    res.set('Retry-After', Math.ceil(rl.retryAfterMs / 1000));
    return res.status(429).json({ error: 'demasiados envíos', code: 'rate_limited' });
  }

  try {
    const lead = intake.validate(req.body || {});
    const result = await intake.enqueue({ store, tenantId, lead });
    // Respuesta deliberadamente igual para nuevo y duplicado: quien envía el
    // formulario no tiene por qué saber si ya estaba en la lista.
    return res.status(202).json({ ok: true, received: true, duplicate: result.duplicate });
  } catch (err) {
    if (err instanceof intake.IntakeError) {
      // Honeypot y too_fast responden 200 para no darle señal al bot.
      if (err.status === 200) return res.json({ ok: true, received: true });
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    console.error(`[intake:${tenantId}] ${err.message}`);
    return res.status(500).json({ error: 'error interno' });
  }
});

// Webhook de resultados: lo llama el proveedor de correo (aperturas, respuestas)
// o el CRM (reunión agendada, contrato cerrado). Cada evento reentrena los pesos
// que usa PitchMatcher en el siguiente ciclo del funnel.
app.post('/webhooks/leads/:tenantId', async (req, res) => {
  const space = tenants.get(req.params.tenantId);
  if (!space) return res.status(404).json({ error: 'tenant no encontrado' });

  const secret = process.env.LEADS_WEBHOOK_SECRET;
  // Sin secreto configurado el endpoint queda cerrado: un webhook de resultados
  // abierto deja que cualquiera envenene el aprendizaje del funnel.
  if (!secret) return res.status(503).json({ error: 'LEADS_WEBHOOK_SECRET no configurado' });
  const ok = intake.verifySignature(req.rawBody?.toString('utf8'), req.headers['x-signature'], secret);
  if (!ok) return res.status(401).json({ error: 'firma inválida' });

  const { leadKey, source, segment, subApp, outcome } = req.body || {};
  try {
    await space.outcomes.record({ leadKey, source, segment, subApp, outcome });
    return res.json({ ok: true, recorded: outcome });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * Procesa la cola de captación: puntúa cada lead, elige el ángulo y prepara el
 * outreach. El envío en frío sigue pasando por HITL uno a uno — esto NO manda
 * correos, los deja preparados para que un humano decida.
 *
 * Es el eslabón que faltaba: el formulario público llenaba `intake:queue` y no
 * la vaciaba nadie.
 */
app.post('/tenants/:tenantId/funnel/run', auth, scopeToTenant, rateLimit, async (req, res) => {
  const space = tenants.get(req.params.tenantId);
  if (!space) return res.status(404).json({ error: 'tenant no encontrado' });
  if (!space.funnel) return res.status(400).json({ error: 'el tenant no tiene departamento de Ventas' });
  try {
    const { summary, processed } = await space.funnel.run(req.body?.icp || {});
    res.json({ ok: true, summary, processed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Estado del embudo: qué ha aprendido y qué fuentes rinden mejor.
app.get('/tenants/:tenantId/funnel', auth, scopeToTenant, async (req, res) => {
  const space = tenants.get(req.params.tenantId);
  if (!space) return res.status(404).json({ error: 'tenant no encontrado' });
  const queue = store.getFact
    ? ((await store.getFact({ tenantId: req.params.tenantId, key: 'intake:queue' })) || [])
    : [];
  res.json({
    tenantId: req.params.tenantId,
    pendingIntake: queue.length,
    learning: space.outcomes.snapshot(),
  });
});

// Ingesta de artículos en la base de conocimiento del tenant (RAG de Soporte).
app.post('/tenants/:tenantId/kb', auth, scopeToTenant, async (req, res) => {
  const space = tenants.get(req.params.tenantId);
  if (!space) return res.status(404).json({ error: 'tenant no encontrado' });
  const { id, title, body, tags } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'title y body requeridos' });
  const articleId = await space.knowledgeBase.ingest({ id, title, body, tags });
  res.json({ ok: true, articleId, count: space.knowledgeBase.size });
});

// KPIs de Soporte por tenant. Combina las señales INTERNAS (resolución,
// escalado, latencia) con el CSAT, que es la única que viene del cliente.
app.get('/tenants/:tenantId/support/metrics', auth, scopeToTenant, async (req, res) => {
  if (!tenants.get(req.params.tenantId)) return res.status(404).json({ error: 'tenant no encontrado' });
  res.json({
    tenantId: req.params.tenantId,
    support: supportMetrics.report(req.params.tenantId),
    csat: await csat.report({ store, tenantId: req.params.tenantId }),
    // ¿Acierta el detector de enfado? Se contrasta contra el CSAT del mismo
    // ticket, que es la única verdad de campo disponible.
    sentimentCalibration: await sentimentCalibration.report({ store, tenantId: req.params.tenantId }),
  });
});

// ── Cola de publicaciones programadas ──
app.get('/tenants/:tenantId/marketing/queue', auth, scopeToTenant, async (req, res) => {
  if (!tenants.get(req.params.tenantId)) return res.status(404).json({ error: 'tenant no encontrado' });
  const [posts, hold] = await Promise.all([
    socialQueue.list({ store, tenantId: req.params.tenantId }),
    socialQueue.getHold({ store, tenantId: req.params.tenantId }),
  ]);
  res.json({ tenantId: req.params.tenantId, hold, count: posts.length, posts });
});

app.put('/tenants/:tenantId/marketing/queue', auth, scopeToTenant, async (req, res) => {
  if (!tenants.get(req.params.tenantId)) return res.status(404).json({ error: 'tenant no encontrado' });
  try {
    const post = await socialQueue.enqueue({ store, tenantId: req.params.tenantId, post: req.body || {} });
    res.json({ ok: true, post });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message, code: err.code });
  }
});

app.post('/tenants/:tenantId/marketing/queue/:id/approve', auth, scopeToTenant, async (req, res) => {
  if (!tenants.get(req.params.tenantId)) return res.status(404).json({ error: 'tenant no encontrado' });
  try {
    const post = await socialQueue.approve({ store, tenantId: req.params.tenantId, id: req.params.id });
    res.json({ ok: true, post, note: `La aprobación caduca en ${socialQueue.APPROVAL_TTL_MS / 3_600_000} h.` });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message, code: err.code });
  }
});

app.delete('/tenants/:tenantId/marketing/queue/:id', auth, scopeToTenant, async (req, res) => {
  if (!tenants.get(req.params.tenantId)) return res.status(404).json({ error: 'tenant no encontrado' });
  try {
    res.json({ ok: true, post: await socialQueue.cancel({ store, tenantId: req.params.tenantId, id: req.params.id }) });
  } catch (err) {
    res.status(err.status || 404).json({ error: err.message, code: err.code });
  }
});

/**
 * Freno de mano de publicación. Pensado para un incidente: una llamada y deja
 * de salir TODO lo programado, sin revisar la cola post a post. Que sea un
 * único endpoint es el punto — durante un incendio nadie edita una lista.
 */
app.put('/tenants/:tenantId/marketing/hold', auth, scopeToTenant, async (req, res) => {
  if (!tenants.get(req.params.tenantId)) return res.status(404).json({ error: 'tenant no encontrado' });
  const hold = await socialQueue.setHold({
    store, tenantId: req.params.tenantId,
    active: req.body?.active !== false,
    reason: req.body?.reason,
  });
  res.json({ ok: true, hold });
});

// ── Catálogo de precios: la única fuente de importes de las propuestas ──
// Sin catálogo, ProposalGenerator se niega a generar en vez de inventar precios.
app.get('/tenants/:tenantId/sales/catalog', auth, scopeToTenant, async (req, res) => {
  if (!tenants.get(req.params.tenantId)) return res.status(404).json({ error: 'tenant no encontrado' });
  const items = await pricing.list({ store, tenantId: req.params.tenantId });
  res.json({ tenantId: req.params.tenantId, count: items.length, items });
});

app.put('/tenants/:tenantId/sales/catalog', auth, scopeToTenant, async (req, res) => {
  if (!tenants.get(req.params.tenantId)) return res.status(404).json({ error: 'tenant no encontrado' });
  try {
    const item = await pricing.upsert({ store, tenantId: req.params.tenantId, item: req.body || {} });
    res.json({ ok: true, item });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message, code: err.code });
  }
});

app.delete('/tenants/:tenantId/sales/catalog/:sku', auth, scopeToTenant, async (req, res) => {
  if (!tenants.get(req.params.tenantId)) return res.status(404).json({ error: 'tenant no encontrado' });
  const r = await pricing.remove({ store, tenantId: req.params.tenantId, sku: req.params.sku });
  if (!r.removed) return res.status(404).json({ error: 'SKU no encontrado' });
  res.json({ ok: true });
});

// ── Plan contable: la única fuente de categorías del categorizador de gastos ──
// Sin categorías cargadas, ExpenseCategorizer se niega a inventar una.
app.get('/tenants/:tenantId/finance/expense-categories', auth, scopeToTenant, async (req, res) => {
  if (!tenants.get(req.params.tenantId)) return res.status(404).json({ error: 'tenant no encontrado' });
  const items = await expenseCategories.list({ store, tenantId: req.params.tenantId });
  res.json({ tenantId: req.params.tenantId, count: items.length, items });
});

app.put('/tenants/:tenantId/finance/expense-categories', auth, scopeToTenant, async (req, res) => {
  if (!tenants.get(req.params.tenantId)) return res.status(404).json({ error: 'tenant no encontrado' });
  try {
    const item = await expenseCategories.upsert({ store, tenantId: req.params.tenantId, category: req.body || {} });
    res.json({ ok: true, item });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message, code: err.code });
  }
});

app.delete('/tenants/:tenantId/finance/expense-categories/:id', auth, scopeToTenant, async (req, res) => {
  if (!tenants.get(req.params.tenantId)) return res.status(404).json({ error: 'tenant no encontrado' });
  const r = await expenseCategories.remove({ store, tenantId: req.params.tenantId, id: req.params.id });
  if (!r.removed) return res.status(404).json({ error: 'categoría no encontrada' });
  res.json({ ok: true });
});

// ── Macros: respuestas guardadas que el MacroSuggester propone al escalar ──
app.get('/tenants/:tenantId/support/macros', auth, scopeToTenant, async (req, res) => {
  if (!tenants.get(req.params.tenantId)) return res.status(404).json({ error: 'tenant no encontrado' });
  const all = await macros.list({ store, tenantId: req.params.tenantId });
  res.json({ tenantId: req.params.tenantId, count: all.length, macros: all });
});

app.put('/tenants/:tenantId/support/macros', auth, scopeToTenant, async (req, res) => {
  if (!tenants.get(req.params.tenantId)) return res.status(404).json({ error: 'tenant no encontrado' });
  try {
    const saved = await macros.save({ store, tenantId: req.params.tenantId, macro: req.body || {} });
    res.json({ ok: true, macro: saved });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message, code: err.code });
  }
});

app.delete('/tenants/:tenantId/support/macros/:id', auth, scopeToTenant, async (req, res) => {
  if (!tenants.get(req.params.tenantId)) return res.status(404).json({ error: 'tenant no encontrado' });
  const r = await macros.remove({ store, tenantId: req.params.tenantId, id: req.params.id });
  if (!r.removed) return res.status(404).json({ error: 'macro no encontrada' });
  res.json({ ok: true });
});

// El humano marca que usó la macro: así se sabe cuáles sirven de verdad y
// cuáles solo ocupan sitio en la lista.
app.post('/tenants/:tenantId/support/macros/:id/used', auth, scopeToTenant, async (req, res) => {
  if (!tenants.get(req.params.tenantId)) return res.status(404).json({ error: 'tenant no encontrado' });
  const r = await macros.markUsed({ store, tenantId: req.params.tenantId, id: req.params.id });
  if (!r.ok) return res.status(404).json({ error: 'macro no encontrada' });
  res.json({ ok: true, uses: r.uses });
});

// ── CSAT: encuesta de satisfacción del cliente final ──
//
// Emitir el enlace requiere API key (lo pide el tenant al cerrar un ticket);
// responderlo NO, porque quien responde es el cliente final desde su correo.
// La autorización de la respuesta la da el token firmado, no una cabecera.
app.post('/tenants/:tenantId/support/csat/issue', auth, scopeToTenant, rateLimit, async (req, res) => {
  if (!tenants.get(req.params.tenantId)) return res.status(404).json({ error: 'tenant no encontrado' });
  const { taskId } = req.body || {};
  try {
    const token = csat.issueToken({
      tenantId: req.params.tenantId, taskId, secret: process.env.CSAT_SECRET,
    });
    await csat.markIssued({ store, tenantId: req.params.tenantId });
    const base = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
    res.json({ ok: true, token, surveyUrl: `${base}/csat/${token}` });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message, code: err.code });
  }
});

const csatThrottle = new intake.IpThrottle({
  max: Number(process.env.CSAT_MAX_PER_MINUTE || 10),
  windowMs: 60_000,
});

app.post('/csat/:token', async (req, res) => {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || 'desconocida';
  const rl = csatThrottle.consume(ip);
  if (!rl.allowed) {
    res.set('Retry-After', Math.ceil(rl.retryAfterMs / 1000));
    return res.status(429).json({ error: 'demasiados envíos', code: 'rate_limited' });
  }

  try {
    const { tenantId, taskId } = csat.verifyToken(req.params.token, { secret: process.env.CSAT_SECRET });
    const space = tenants.get(tenantId);
    if (!space) return res.status(404).json({ error: 'tenant no encontrado' });

    const { rating, comment } = csat.validateResponse(req.body || {});
    await csat.recordResponse({ store, tenantId, taskId, rating, comment });

    // Una valoración baja es una señal que alguien debe mirar hoy, no en el
    // informe de fin de mes: va al bus y de ahí al bot del departamento.
    if (rating <= 2) {
      space.bus?.emit('support:csat_detractor', { tenantId, taskId, rating, comment });
    }
    res.json({ ok: true, thanks: true });
  } catch (err) {
    if (err instanceof csat.CsatError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    console.error(`[csat] ${err.message}`);
    res.status(500).json({ error: 'error interno' });
  }
});

// Editor de políticas del tenant: endurecer categorías (nunca relajar líneas rojas).
/**
 * Recarga el perfil de negocio del tenant desde config/business/<id>.json.
 *
 * El perfil se persiste como fact la primera vez y a partir de ahí GANA sobre
 * el fichero (para poder editarlo en caliente sin tocar el repositorio). El
 * efecto secundario era que editar el JSON no cambiaba nada en un tenant ya
 * creado: la configuración parecía aplicada y los agentes seguían con la
 * versión vieja, sin que nada avisara.
 *
 * Se muta `business.data` en vez de crear otra instancia porque los 60 agentes
 * comparten esa misma referencia: así el cambio les llega a todos sin
 * reaprovisionar el tenant ni reiniciar la plataforma.
 */
app.post('/tenants/:tenantId/business/reload', auth, async (req, res) => {
  if (!req.isAdmin) return res.status(403).json({ error: 'solo admin' });
  const space = tenants.get(req.params.tenantId);
  if (!space) return res.status(404).json({ error: 'tenant no encontrado' });

  const businessId = req.body?.businessId || space.cfg.businessId || space.business?.id;
  if (!businessId) return res.status(400).json({ error: 'el tenant no tiene perfil de negocio asociado' });

  const BusinessProfile = require('./platform/BusinessProfile');
  const fresco = BusinessProfile.fromFile(businessId);
  if (!fresco) return res.status(404).json({ error: `no existe config/business/${businessId}.json` });

  if (space.business) space.business.data = fresco.toJSON();
  else space.business = fresco;
  if (store.setFact) {
    await store.setFact({ tenantId: req.params.tenantId, key: 'business:profile', value: fresco.toJSON() });
  }
  space.audit?.log({ tenantId: req.params.tenantId, event: 'business:profile_reloaded', businessId });

  res.json({
    ok: true, businessId,
    secciones: Object.keys(fresco.toJSON()).length,
    buzones: fresco.mailboxes(),
  });
});

app.get('/tenants/:tenantId/policies', auth, scopeToTenant, (req, res) => {
  const space = tenants.get(req.params.tenantId);
  if (!space) return res.status(404).json({ error: 'tenant no encontrado' });
  res.json({ tenantId: req.params.tenantId, overrides: space.guardrails.getOverrides(), reglas: require('./guardrails/PolicyEngine').RULES });
});

app.put('/tenants/:tenantId/policies/:category', auth, scopeToTenant, (req, res) => {
  const space = tenants.get(req.params.tenantId);
  if (!space) return res.status(404).json({ error: 'tenant no encontrado' });
  try {
    const actor = req.isAdmin ? 'admin' : req.authTenant;
    const overrides = space.guardrails.setOverride(req.params.category, req.body.rule, actor);
    res.json({ ok: true, overrides });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/tenants/:tenantId/policies/:category', auth, scopeToTenant, (req, res) => {
  const space = tenants.get(req.params.tenantId);
  if (!space) return res.status(404).json({ error: 'tenant no encontrado' });
  const actor = req.isAdmin ? 'admin' : req.authTenant;
  res.json({ ok: true, overrides: space.guardrails.removeOverride(req.params.category, actor) });
});

// Verificación de integridad del audit log encadenado (due diligence / compliance):
// recalcula la cadena de hashes y señala si algo se alteró. No cambia nada, solo lee.
app.get('/tenants/:tenantId/audit/verify', auth, scopeToTenant, async (req, res) => {
  const space = tenants.get(req.params.tenantId);
  if (!space) return res.status(404).json({ error: 'tenant no encontrado' });
  res.json(await space.audit.verifyChain());
});

// Escuadrón de Ventas: "autonomy dial" — cuánto delega el tenant en el agente
// (ver src/platform/SalesAutonomy.js). Nunca afecta a las líneas rojas.
app.get('/tenants/:tenantId/sales/autonomy', auth, scopeToTenant, (req, res) => {
  const space = tenants.get(req.params.tenantId);
  if (!space) return res.status(404).json({ error: 'tenant no encontrado' });
  res.json(space.salesAutonomy.describe());
});
app.put('/tenants/:tenantId/sales/autonomy', auth, scopeToTenant, (req, res) => {
  const space = tenants.get(req.params.tenantId);
  if (!space) return res.status(404).json({ error: 'tenant no encontrado' });
  try {
    const actor = req.isAdmin ? 'admin' : req.authTenant;
    res.json(space.salesAutonomy.set(req.body.level, actor));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Escuadrón de Ventas: lista dinámica de "no contactar" a nivel de empresa/deal
// (ver src/platform/DoNotContactList.js) — distinta de los excludedAccounts
// fijos del perfil de negocio: esta la gestiona el tenant en caliente.
app.get('/tenants/:tenantId/sales/do-not-contact', auth, scopeToTenant, (req, res) => {
  const space = tenants.get(req.params.tenantId);
  if (!space) return res.status(404).json({ error: 'tenant no encontrado' });
  res.json(space.doNotContact.list());
});
app.post('/tenants/:tenantId/sales/do-not-contact', auth, scopeToTenant, (req, res) => {
  const space = tenants.get(req.params.tenantId);
  if (!space) return res.status(404).json({ error: 'tenant no encontrado' });
  try {
    const actor = req.isAdmin ? 'admin' : req.authTenant;
    const entry = space.doNotContact.add({ ...req.body, actor });
    res.json({ ok: true, entry });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.delete('/tenants/:tenantId/sales/do-not-contact/:key', auth, scopeToTenant, (req, res) => {
  const space = tenants.get(req.params.tenantId);
  if (!space) return res.status(404).json({ error: 'tenant no encontrado' });
  const removed = space.doNotContact.remove(req.params.key);
  if (!removed) return res.status(404).json({ error: 'no estaba en la lista' });
  res.json({ ok: true });
});

// Configura el chat de Telegram por departamento que recibe las aprobaciones HITL (admin).
app.put('/hitl/telegram', auth, (req, res) => {
  if (!req.isAdmin) return res.status(403).json({ error: 'solo admin' });
  const { department, chatId } = req.body;
  if (!department) return res.status(400).json({ error: 'department requerido' });
  hitlNotifier.setChat(department, chatId);
  res.json({ ok: true, department, chatId: chatId || null });
});

// Digest del CEO: el último persistido, o ?fresh=1 para regenerarlo ahora.
app.get('/tenants/:tenantId/digest', auth, scopeToTenant, async (req, res) => {
  if (!tenants.get(req.params.tenantId)) return res.status(404).json({ error: 'tenant no encontrado' });
  try {
    const digest = req.query.fresh === '1'
      ? await buildDigest(digestDeps, req.params.tenantId)
      : (await lastDigest(store, req.params.tenantId)) || await buildDigest(digestDeps, req.params.tenantId);
    res.json({ tenantId: req.params.tenantId, digest });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Aprendizaje: playbooks destilados por agente (o dispara un ciclo con ?run=1).
app.get('/tenants/:tenantId/playbooks', auth, scopeToTenant, async (req, res) => {
  const space = tenants.get(req.params.tenantId);
  if (!space) return res.status(404).json({ error: 'tenant no encontrado' });
  if (req.query.run === '1') await space.learning.learnAll(space.orchestrator.agentIds());
  const ids = space.orchestrator.agentIds();
  const playbooks = {};
  for (const id of ids) {
    const pb = await space.learning.getPlaybook(id);
    if (pb) playbooks[id] = pb;
  }
  res.json({ tenantId: req.params.tenantId, playbooks });
});

app.post('/tenants/:tenantId/learn', auth, scopeToTenant, async (req, res) => {
  const space = tenants.get(req.params.tenantId);
  if (!space) return res.status(404).json({ error: 'tenant no encontrado' });
  const result = await space.learning.learnAll(space.orchestrator.agentIds());
  res.json({ tenantId: req.params.tenantId, ...result });
});

// ── Agentes proactivos: trabajos recurrentes del tenant ──
app.get('/tenants/:tenantId/schedules', auth, scopeToTenant, (req, res) => {
  if (!tenants.get(req.params.tenantId)) return res.status(404).json({ error: 'tenant no encontrado' });
  res.json({ tenantId: req.params.tenantId, jobs: scheduler.listJobs(req.params.tenantId) });
});

// Crea/actualiza un trabajo: { id?, description?, every: '30m'|'2h'|'1d'|ms, text, department? }
app.put('/tenants/:tenantId/schedules', auth, scopeToTenant, async (req, res) => {
  if (!tenants.get(req.params.tenantId)) return res.status(404).json({ error: 'tenant no encontrado' });
  try {
    const { id, description, every, text, channel } = req.body;
    const job = await scheduler.addJob(req.params.tenantId, {
      id, description,
      everyMs: Scheduler.parseEvery(every),
      input: { text, channel },
    });
    res.json({ ok: true, job });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/tenants/:tenantId/schedules/:jobId', auth, scopeToTenant, async (req, res) => {
  const removed = await scheduler.removeJob(req.params.tenantId, req.params.jobId);
  res.json({ ok: removed });
});

// Stream de eventos en tiempo real (SSE) para el panel.
// EventSource no envía cabeceras → la clave va por query (?key=).
app.get('/tenants/:tenantId/events', (req, res) => {
  const key = req.query.key;
  const isAdmin = process.env.INTERNAL_API_KEY && key === process.env.INTERNAL_API_KEY;
  const authTenant = isAdmin ? null : apiKeys.resolve(key);
  if (!isAdmin && authTenant !== req.params.tenantId) return res.status(401).end();

  const space = tenants.get(req.params.tenantId);
  if (!space) return res.status(404).end();

  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  if (res.flushHeaders) res.flushHeaders();
  res.write(': ok\n\n');

  const cleanup = streamTenantEvents(space.bus, (frame) => res.write(frame));
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { clearInterval(heartbeat); cleanup(); });
});

// Panel: todo el estado del tenant en una sola llamada.
// ── Optimizador del sistema ───────────────────────────────────────────────────
// Estado: qué ha visto desde el último ciclo, si ya hay bastante y qué cambió.
app.get('/tenants/:tenantId/optimizer', auth, scopeToTenant, (req, res) => {
  const space = tenants.get(req.params.tenantId);
  if (!space?.optimizer) return res.status(404).json({ error: 'tenant sin optimizador' });
  res.json(space.optimizer.snapshot());
});

// Fuerza un ciclo saltándose el umbral de evidencia (no el sentido común: si no
// hay nada que mirar, devuelve un ciclo sin propuestas). Útil tras un despliegue
// o para enseñar el mecanismo en una demo.
app.post('/tenants/:tenantId/optimizer/run', auth, scopeToTenant, rateLimit, async (req, res) => {
  const space = tenants.get(req.params.tenantId);
  if (!space?.optimizer) return res.status(404).json({ error: 'tenant sin optimizador' });
  try {
    res.json(await space.optimizer.cycle({ force: req.body?.force === true }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/tenants/:tenantId/dashboard', auth, scopeToTenant, (req, res) => {
  const data = buildDashboard({ tenants, usageMeter, costTracker, supportMetrics, billing, plans }, req.params.tenantId);
  if (!data) return res.status(404).json({ error: 'tenant no encontrado' });
  res.json(data);
});

// Previsualización de factura del periodo (cuota del plan + excedente de uso).
app.get('/tenants/:tenantId/billing/invoice', auth, scopeToTenant, (req, res) => {
  if (!tenants.get(req.params.tenantId)) return res.status(404).json({ error: 'tenant no encontrado' });
  const invoice = billing.invoicePreview(req.params.tenantId, {
    callsUsed: usageMeter.used(req.params.tenantId),
    modelCostUsd: costTracker.usageFor(req.params.tenantId).costUsd,
  });
  res.json(invoice);
});

// Consumo y coste por tenant (con el límite de llamadas del plan).
app.get('/tenants/:tenantId/usage', auth, scopeToTenant, (req, res) => {
  const space = tenants.get(req.params.tenantId);
  if (!space) return res.status(404).json({ error: 'tenant no encontrado' });
  const plan = plans[space.cfg.plan] || {};
  res.json({
    tenantId: req.params.tenantId,
    plan: space.cfg.plan,
    cost: costTracker.usageFor(req.params.tenantId),
    agentCalls: usageMeter.check(req.params.tenantId),   // { used, limit, remaining, allowed }
    limits: { maxAgentCallsMonth: plan.maxAgentCallsMonth, maxConcurrentTasks: plan.maxConcurrentTasks },
  });
});

// Alertas de salud activas del tenant (lo que el watchdog ya avisó por Telegram).
app.get('/tenants/:tenantId/alerts', auth, scopeToTenant, (req, res) => {
  if (!tenants.get(req.params.tenantId)) return res.status(404).json({ error: 'tenant no encontrado' });
  res.json({ tenantId: req.params.tenantId, alerts: watchdog.active(req.params.tenantId) });
});

// Estado del exportador OTLP (admin): si está activo, a dónde y si falla.
app.get('/observability/otlp', auth, (req, res) => {
  if (!req.isAdmin) return res.status(403).json({ error: 'solo admin' });
  res.json(otlp.status());
});

// Estado del exportador Langfuse (admin): activo, cola pendiente, último error.
app.get('/observability/langfuse', auth, (req, res) => {
  if (!req.isAdmin) return res.status(403).json({ error: 'solo admin' });
  res.json(langfuse.status());
});

const PORT = process.env.PORT || 4000;
if (require.main === module) {
  hydrateFromStore()
    .then(({ tenants: nTenants, keys: nKeys }) => {
      if (nTenants) console.log(`[store] rehidratados ${nTenants} tenants y ${nKeys} claves de API`);
      scheduler.start(); // los agentes proactivos empiezan a trabajar
      watchdog.start();  // vigilancia de salud → avisos por Telegram
      checkEmailChannel().catch((err) => console.warn(`[email] no se pudo comprobar el canal: ${err.message}`));
      checkLocalModels().catch((err) => console.warn(`[modelo] no se pudo comprobar: ${err.message}`));
      if (otlp.start()) console.log(`[otlp] exportando métricas a ${otlp.endpoint} cada ${otlp.intervalMs / 1000}s`);
      if (langfuse.start()) console.log(`[langfuse] exportando trazas a ${langfuse.baseUrl} cada ${langfuse.intervalMs / 1000}s`);
      // El banner nombra el motor REAL. Decía "SIMULADO" siempre que no hubiera
      // clave de Anthropic, aunque estuviera corriendo contra Ollama en local:
      // el arranque contradecía a /healthz y hacía dudar de si la IA funcionaba.
      const motor = providers.anthropic ? 'Anthropic' : (providers.ollama ? `Ollama (${tierMap.fast.model})` : 'SIMULADO');
      app.listen(PORT, () => console.log(`OPERANT API → http://localhost:${PORT} (motor ${motor} · store ${store.constructor.name})`));
    })
    .catch((err) => {
      console.error(`[store] rehidratación fallida: ${err.message}`);
      process.exit(1);
    });
}

module.exports = { app, checkLocalModels, tenants, modelGateway, store, costTracker, usageMeter, telemetry, apiKeys, rateLimiter, scheduler, watchdog, otlp, langfuse, buildTools, hydrateFromStore, emailProbe, checkEmailChannel };
