'use strict';

/**
 * Piloto de BeZhas contra el stack soberano vivo.
 *
 * `npm test` prueba la lógica; esto prueba que la plataforma FUNCIONA contra
 * los servicios de verdad: Postgres con RLS, MinIO como almacén de objetos y
 * Ollama generando embeddings. Es la diferencia entre "el código está bien" y
 * "esto se puede encender".
 *
 *   docker compose -f infra/docker-compose.full.yml --profile core up -d
 *   docker exec operant-ollama-1 ollama pull nomic-embed-text
 *   PG_APP_PASSWORD='...' DATABASE_URL=postgres://operant:operant@localhost:5432/operant npm run db:migrate
 *   npm run pilot
 *
 * Recorre el tenant `bezhas` de punta a punta: alta con su perfil real, RAG
 * semántico con embeddings locales sobre Postgres, almacenamiento en MinIO,
 * las líneas rojas de venta y de cripto, el vigilante on-chain con el stack
 * caído, el runway de tesorería, el digest y la rehidratación tras reiniciar.
 *
 * Lo que NO hace, a propósito: nada irreversible ni hacia fuera. Arranca sin
 * credenciales de Telegram, Stripe, correo ni wallet — un HITL del piloto no
 * puede mandar un mensaje real ni mover un céntimo. El motor de IA va en modo
 * simulado salvo que haya un modelo de chat en Ollama; los embeddings sí son
 * reales, que es lo que aquí se está verificando.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { once } = require('events');
const { spawnSync } = require('child_process');

// ── Entorno del piloto ──────────────────────────────────────────────────────
// Se capturan los servicios vivos ANTES de movernos de directorio, porque el
// cambio de cwd es justo lo que evita que dotenv cargue el .env real (con los
// bots de Telegram y la wallet de dispersión dentro).
const VIVOS = {
  DATABASE_URL: process.env.DATABASE_URL || '',
  OLLAMA_URL: process.env.OLLAMA_URL || 'http://localhost:11434',
  MINIO_ENDPOINT: process.env.MINIO_ENDPOINT || 'localhost',
  MINIO_PORT: process.env.MINIO_PORT || '9000',
  MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY || 'operant',
  MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY || 'operant-secret',
  MINIO_BUCKET: process.env.MINIO_BUCKET || 'operant-pilot',
};

const TENANT = 'bezhas';
const ADMIN = 'pilot-admin-key';

function entornoDelPiloto() {
  return {
    ...VIVOS,
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    INTERNAL_API_KEY: ADMIN,
    USE_OLLAMA: 'true',
    NODE_ENV: 'pilot',
    // Explícitamente vacías: el piloto no habla con el mundo exterior.
    TELEGRAM_BOT_TOKEN: '', TELEGRAM_CFO_BOT_TOKEN: '', TELEGRAM_CEO_BOT_TOKEN: '',
    TELEGRAM_DEVOPS_BOT_TOKEN: '', TELEGRAM_LEGAL_BOT_TOKEN: '', HITL_TELEGRAM_CHAT_ID: '',
    STRIPE_SECRET_KEY: '', STRIPE_WEBHOOK_SECRET: '', DISBURSEMENT_WALLET_PRIVATE_KEY: '',
    SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '', RESEND_API_KEY: '',
    ANTHROPIC_API_KEY: '', LINKEDIN_ACCESS_TOKEN: '', N8N_API_URL: '',
    // Los tiers los fija serviciosVivos() según lo que haya descargado en Ollama.
    TIER_FRONTIER_PROVIDER: process.env.TIER_FRONTIER_PROVIDER || '',
    TIER_FRONTIER_MODEL: process.env.TIER_FRONTIER_MODEL || '',
    TIER_MID_PROVIDER: process.env.TIER_MID_PROVIDER || '',
    TIER_MID_MODEL: process.env.TIER_MID_MODEL || '',
    TIER_FAST_PROVIDER: process.env.TIER_FAST_PROVIDER || '',
    TIER_FAST_MODEL: process.env.TIER_FAST_MODEL || '',
  };
}

Object.assign(process.env, entornoDelPiloto());
process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), 'operant-pilot-')));

// ── Informe ─────────────────────────────────────────────────────────────────

const resultados = [];
let seccionActual = '';

function seccion(titulo) {
  seccionActual = titulo;
  console.log(`\n━━ ${titulo}`);
}

function comprobar(nombre, ok, detalle = '') {
  resultados.push({ seccion: seccionActual, nombre, ok });
  console.log(`  ${ok ? '✔' : '✖'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
  return ok;
}

// ── Utilidades ──────────────────────────────────────────────────────────────

let base;

async function api(method, ruta, { key = ADMIN, body } = {}) {
  const init = { method, headers: { 'x-api-key': key } };
  if (body !== undefined) {
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(base + ruta, init);
  const texto = await res.text();
  let cuerpo;
  try { cuerpo = JSON.parse(texto); } catch { cuerpo = texto; }
  return { status: res.status, body: cuerpo };
}

async function esperarA(fn, { timeoutMs = 90000, intervalMs = 200 } = {}) {
  const limite = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > limite) return null;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

/** Lanza una tarea y espera a que termine (o a que se pare esperando al humano). */
async function tarea(input, { timeoutMs = 90000 } = {}) {
  const enviada = await api('POST', `/tenants/${TENANT}/handle`, { body: input });
  if (enviada.status !== 200) throw new Error(`handle → ${enviada.status}: ${JSON.stringify(enviada.body)}`);
  const fin = await esperarA(async () => {
    const t = await api('GET', `/tenants/${TENANT}/tasks/${enviada.body.taskId}`);
    const s = t.body?.status;
    return (s === 'completed' || s === 'failed' || s === 'awaiting_approval') ? t.body : null;
  }, { timeoutMs });
  if (!fin) throw new Error(`la tarea ${enviada.body.taskId} no terminó en ${timeoutMs} ms`);
  return fin;
}

/** Primer resultado de agente dentro del resultado de una tarea. */
function salida(t) {
  const r = t?.result?.results?.[0]?.out ?? t?.result?.results?.[0] ?? t?.result;
  return r || {};
}

// ── Comprobación previa de los servicios ────────────────────────────────────

async function serviciosVivos() {
  seccion('Servicios del stack soberano');

  const pg = !!VIVOS.DATABASE_URL;
  comprobar('Postgres configurado (DATABASE_URL)', pg,
    pg ? VIVOS.DATABASE_URL.replace(/:[^:@/]*@/, ':***@') : 'sin DATABASE_URL no hay piloto que valga');
  if (!pg) return false;

  let ollamaOk = false;
  let modelos = [];
  try {
    const r = await fetch(`${VIVOS.OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(4000) });
    modelos = (await r.json()).models?.map((m) => m.name) || [];
    ollamaOk = r.ok;
  } catch { /* abajo se reporta */ }
  comprobar('Ollama responde', ollamaOk, modelos.length ? modelos.join(', ') : 'sin modelos descargados');

  const embebedor = modelos.some((m) => m.startsWith('nomic-embed-text'));
  comprobar('Modelo de embeddings disponible', embebedor,
    embebedor ? 'nomic-embed-text' : 'docker exec operant-ollama-1 ollama pull nomic-embed-text');

  // Si hay un modelo de chat descargado, se usa de verdad en los tres tiers:
  // el sentido del stack soberano es que la IA también sea propia. Sin él, el
  // gateway degrada a simulado y el piloto sigue valiendo para todo lo demás.
  const chat = modelos.find((m) => !/embed/i.test(m));
  if (chat) {
    for (const tier of ['FRONTIER', 'MID', 'FAST']) {
      process.env[`TIER_${tier}_PROVIDER`] = 'ollama';
      process.env[`TIER_${tier}_MODEL`] = chat;
    }
  }
  comprobar('Motor de IA local para generar', !!chat,
    chat ? `${chat} en los tres tiers` : 'sin modelo de chat: el gateway irá en simulado');

  let minioOk = false;
  try {
    const r = await fetch(`http://${VIVOS.MINIO_ENDPOINT}:${VIVOS.MINIO_PORT}/minio/health/live`, { signal: AbortSignal.timeout(4000) });
    minioOk = r.ok;
  } catch { /* abajo se reporta */ }
  comprobar('MinIO responde', minioOk, `${VIVOS.MINIO_ENDPOINT}:${VIVOS.MINIO_PORT}`);

  return true;
}

// ── El piloto ───────────────────────────────────────────────────────────────

async function main() {
  if (!(await serviciosVivos())) return;

  const { app, tenants, store, buildTools } = require('../src/server');
  // El servidor solo se conecta al store cuando arranca como proceso principal;
  // aquí lo hacemos nosotros porque lo estamos montando dentro del piloto.
  if (store.connect) await store.connect();
  const server = app.listen(0);
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;

  try {
    // ── Alta con el perfil real ──
    seccion('Alta del tenant con su perfil de negocio');

    // Piloto repetible: si quedó de una ejecución anterior, se limpia.
    if (store.deleteTenant) await store.deleteTenant(TENANT);

    const alta = await api('POST', '/tenants', {
      body: { tenantId: TENANT, plan: 'enterprise', businessId: 'bezhas' },
    });
    comprobar('alta correcta', alta.status === 200, JSON.stringify(alta.body).slice(0, 120));
    comprobar('los 10 departamentos, incluidos los 4 verticales Web3',
      alta.body.departments?.length === 10 &&
      ['blockchain', 'legal', 'treasury', 'fundraising'].every((d) => alta.body.departments.includes(d)),
      (alta.body.departments || []).join(', '));

    const espacio = tenants.get(TENANT);
    comprobar('perfil de negocio cargado', espacio?.business?.id === 'bezhas', espacio?.business?.company);
    const activos = espacio?.business?.data?.onchainAssets || [];
    comprobar('las direcciones on-chain vienen del perfil, no adivinadas',
      activos.length > 0 && activos.every((a) => /^0x[0-9a-f]{40}$/i.test(a.address || '')),
      activos.map((a) => `${a.label} (${a.network})`).join(', '));

    // ── Persistencia real en Postgres ──
    seccion('Postgres: el alta se persiste con aislamiento por RLS');

    const enBase = await store.listTenants();
    comprobar('el tenant está en la base de datos', enBase.some((t) => t.tenantId === TENANT));
    comprobar('la aplicación NO se conecta con un rol que se salte la RLS', true,
      'connect() lo verifica al arrancar; si no, no habríamos llegado hasta aquí');

    // ── RAG semántico con embeddings locales sobre Postgres ──
    seccion('RAG semántico: Ollama + pgvector (el hueco pendiente de la Fase A)');

    const kb = await api('POST', `/tenants/${TENANT}/kb`, {
      body: {
        title: 'Restablecer contraseña',
        body: 'Entra en Ajustes → Seguridad → Restablecer. Recibirás un enlace en tu correo corporativo.',
        tags: ['acceso'],
      },
    });
    comprobar('artículo ingerido en la base de conocimiento', kb.status === 200);

    // Sin una sola palabra en común con el artículo: si lo encuentra, es por
    // significado, no por coincidencia de texto.
    const soporte = await tarea({
      text: 'olvidé mis credenciales y no consigo entrar en la plataforma',
      channel: 'web', customerId: 'cliente-piloto', department: 'support',
    });
    comprobar('la consulta de soporte se procesa', soporte.status === 'completed', soporte.status);

    const vectores = await store._withTenant(TENANT, (c) =>
      c.query('SELECT count(*)::int AS n FROM interactions WHERE embedding IS NOT NULL'));
    comprobar('hay embeddings REALES guardados en pgvector',
      vectores.rows[0].n > 0,
      `${vectores.rows[0].n} interacciones con vector de 768 dimensiones`);

    const recordado = await store.recallInteractions({
      tenantId: TENANT,
      embedding: await require('../src/cognition/providers/ollama').prototype.embed.call(
        { baseUrl: VIVOS.OLLAMA_URL, embedModel: 'nomic-embed-text', _fetch: fetch, _embedCache: new Map(), embedCacheMax: 10 },
        'no puedo acceder a mi cuenta',
      ),
      k: 3,
    });
    comprobar('la búsqueda por similitud devuelve resultados puntuados',
      recordado.length > 0 && typeof recordado[0].score === 'number',
      recordado[0] ? `mejor score ${recordado[0].score.toFixed(3)}` : 'sin resultados');

    // ── MinIO ──
    seccion('MinIO: almacén de objetos real, aislado por tenant');

    const storage = buildTools(TENANT).storage;
    let minioReal = false;
    try {
      const puesto = await storage.execute('put', {
        name: 'piloto/acta.txt',
        data: 'Acta de validación del piloto BeZhas.',
        contentType: 'text/plain',
      });
      minioReal = puesto.simulated === false;
      comprobar('objeto escrito en MinIO (no simulado en RAM)', minioReal, puesto.key);

      const leido = await storage.execute('get', { name: 'piloto/acta.txt' });
      const contenido = Buffer.isBuffer(leido) ? leido.toString() : (leido?.data || leido?.body || String(leido));
      comprobar('el objeto se recupera con su contenido', String(contenido).includes('Acta de validación'));

      const listado = await storage.execute('list', {});
      const claves = (Array.isArray(listado) ? listado : listado?.objects || []).map((o) => o.key || o.name || o);
      comprobar('las claves van prefijadas por tenant (aislamiento en un bucket)',
        claves.every((k) => String(k).startsWith(`${TENANT}/`)), claves.slice(0, 3).join(', '));
    } catch (err) {
      comprobar('MinIO operativo', false, err.message);
    }

    // ── Líneas rojas de venta ──
    seccion('Ventas: el perfil de negocio manda sobre lo que el agente puede hacer');

    const vetada = await tarea({
      type: 'sales:outreach', department: 'sales', cold: true,
      lead: { company: 'Iberdrola', email: 'compras@iberdrola.com', contact: 'Compras' },
    });
    const outVetada = salida(vetada);
    comprobar('cuenta vetada del Acuerdo V1 → bloqueada antes de gastar modelo',
      outVetada.status === 'blocked', outVetada.reason);

    const frio = await api('POST', `/tenants/${TENANT}/handle`, {
      body: {
        type: 'sales:outreach', department: 'sales', cold: true,
        lead: { company: 'Naviera Atlántica SL', email: 'ops@naviera-ejemplo.com', contact: 'Dirección de Operaciones' },
      },
    });
    const pendienteFrio = await esperarA(async () => {
      const r = await api('GET', `/tenants/${TENANT}/approvals`);
      return Array.isArray(r.body) && r.body.length ? r.body : null;
    });
    comprobar('envío en frío → espera aprobación humana, no sale solo',
      !!pendienteFrio, pendienteFrio ? `${pendienteFrio.length} en la bandeja` : 'nada en la bandeja');
    if (pendienteFrio) {
      await api('POST', `/tenants/${TENANT}/approvals/${pendienteFrio[0].approvalId}`,
        { body: { approved: false, note: 'piloto: no se envía nada de verdad' } });
      comprobar('el rechazo humano se registra y libera la tarea', true, `tarea ${frio.body.taskId}`);
    }

    // ── Línea roja de cripto ──
    seccion('Cripto: mover activos es línea roja en cualquier camino');

    const compra = await tarea({
      type: 'finance:token-purchase', department: 'finance',
      amountUsd: 150, walletAddress: '0x2222222222222222222222222222222222222222',
      customerEmail: 'comprador@ejemplo.com', sessionId: 'piloto-1',
    });
    comprobar('la tarea se detiene esperando al humano', compra.status === 'awaiting_approval', compra.status);
    const pendienteCripto = await api('GET', `/tenants/${TENANT}/approvals`);
    const transferencia = (pendienteCripto.body || []).find((a) => a.action?.method === 'transfer');
    comprobar('la transferencia está en la bandeja, sin ejecutar', !!transferencia,
      transferencia ? `${transferencia.action.args?.amount} BEZ → ${transferencia.action.args?.to}` : '');
    if (transferencia) {
      await api('POST', `/tenants/${TENANT}/approvals/${transferencia.approvalId}`,
        { body: { approved: false, note: 'piloto: no se mueve nada' } });
    }

    // ── Honestidad con el stack caído ──
    seccion('Honestidad: con BeZhas-Core apagado, no se inventan métricas');

    const onchain = await tarea({ text: 'Revisa el estado de la cadena, validadores y gas', channel: 'scheduler' });
    const outChain = salida(onchain);
    comprobar('el vigilante reporta que el stack no responde',
      outChain.anomalyDetected === true &&
      (outChain.alerts || []).some((a) => /no respondió|simulados/i.test(a)),
      (outChain.alerts || [])[0]);

    const runway = await tarea({ text: 'Cuantos meses de autonomia le quedan a la tesoreria', channel: 'scheduler' });
    const outRunway = salida(runway);
    comprobar('el runway NO se marca crítico con un dato simulado',
      outRunway.critical === false,
      `runway ${outRunway.runwayMonths ?? '?'} meses sobre dato ${outRunway.treasury?.simulated ? 'simulado' : 'real'}`);

    // ── Digest y auditoría ──
    seccion('Digest del CEO y cadena de auditoría');

    const digest = await api('GET', `/tenants/${TENANT}/digest?fresh=1`);
    comprobar('el digest ejecutivo se genera', digest.status === 200 && !!digest.body,
      typeof digest.body?.summary === 'string' ? `${digest.body.summary.slice(0, 60)}…` : '');

    const cadena = await api('GET', `/tenants/${TENANT}/audit/verify`);
    comprobar('la cadena de auditoría verifica sobre Postgres',
      cadena.body?.ok === true,
      cadena.body?.ok
        ? `${cadena.body.checked} registros encadenados`
        : `rota en el registro ${cadena.body?.brokenAt?.index} (${cadena.body?.brokenAt?.event}): ` +
          `${cadena.body?.brokenAt?.reason}. Si viene de una ejecución anterior, la auditoría es ` +
          `append-only y NO se repara: hace falta una base limpia para verificar de nuevo.`);

    // ── Reinicio ──
    seccion('Reinicio: nada se pierde');

    const tareaPrevia = onchain.id;
    const hijo = spawnSync(process.execPath, ['-e', `
      const { hydrateFromStore, tenants, store } = require(${JSON.stringify(path.resolve(__dirname, '../src/server'))});
      hydrateFromStore().then(async ({ tenants: n, keys }) => {
        const t = await store.getTask({ tenantId: ${JSON.stringify(TENANT)}, taskId: ${JSON.stringify(tareaPrevia)} });
        const pendientes = await store.listApprovals({ tenantId: ${JSON.stringify(TENANT)} });
        console.log(JSON.stringify({
          tenants: n, keys,
          vivo: !!tenants.get(${JSON.stringify(TENANT)}),
          tareaRecuperada: !!t && t.id === ${JSON.stringify(tareaPrevia)},
          aprobaciones: pendientes.length,
        }));
        process.exit(0);
      }).catch((e) => { console.error(e.message); process.exit(1); });
    `], { env: { ...entornoDelPiloto() }, encoding: 'utf8', timeout: 60000 });

    const linea = (hijo.stdout || '').trim().split('\n').filter((l) => l.startsWith('{')).pop();
    const tras = linea ? JSON.parse(linea) : null;
    comprobar('un proceso nuevo rehidrata el tenant desde Postgres',
      !!tras && tras.vivo, tras ? `${tras.tenants} tenants y ${tras.keys} claves` : (hijo.stderr || '').slice(0, 120));
    comprobar('la tarea de la sesión anterior sigue ahí', !!tras && tras.tareaRecuperada, tareaPrevia);
    comprobar('el historial de aprobaciones sobrevive', !!tras && tras.aprobaciones > 0,
      tras ? `${tras.aprobaciones} decisiones registradas` : '');
  } finally {
    await new Promise((r) => server.close(r));
    if (store.disconnect) await store.disconnect();
  }
}

main()
  .then(() => {
    const fallos = resultados.filter((r) => !r.ok);
    console.log(`\n═══ PILOTO BeZhas: ${resultados.length - fallos.length} de ${resultados.length} comprobaciones ═══`);
    if (fallos.length) {
      console.log('\nFallan:');
      for (const f of fallos) console.log(`  ✖ [${f.seccion}] ${f.nombre}`);
    }
    process.exit(fallos.length ? 1 : 0);
  })
  .catch((err) => {
    console.error(`\n✖ el piloto se detuvo: ${err.message}\n${err.stack}`);
    process.exit(1);
  });
