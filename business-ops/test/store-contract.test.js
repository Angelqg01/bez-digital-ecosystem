'use strict';

/**
 * Contrato del Store, verificado contra los TRES adaptadores.
 *
 * Por qué existe: PostgresStore implementaba 10 de los 21 métodos del contrato.
 * Como los llamantes se protegen con `typeof store.X === 'function'`, nada
 * fallaba — la plataforma simplemente dejaba de persistir tareas, aprobaciones,
 * tenants y claves de API en cuanto se configuraba DATABASE_URL, que es el
 * despliegue donde la durabilidad importa. Un método que falta debe romper una
 * prueba, no degradar el producto en silencio.
 *
 * La suite de superficie corre siempre. La de comportamiento corre contra
 * InMemory y SQLite siempre, y contra Postgres cuando hay DATABASE_URL:
 *
 *   docker compose -f infra/docker-compose.yml up -d
 *   DATABASE_URL=postgres://user:pass@localhost:5432/operant npm test
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const InMemoryStore = require('../src/platform/InMemoryStore');
const SqliteStore = require('../src/platform/SqliteStore');
const PostgresStore = require('../src/platform/PostgresStore');

// ── Superficie: los tres adaptadores exponen lo mismo ───────────────────────

function surface(Klass) {
  return Object.getOwnPropertyNames(Klass.prototype)
    .filter((n) => n !== 'constructor' && !n.startsWith('_'))
    .filter((n) => typeof Klass.prototype[n] === 'function')
    .sort();
}

test('Store: los tres adaptadores implementan el mismo contrato', () => {
  const inMemory = surface(InMemoryStore);
  const sqlite = surface(SqliteStore);
  const postgres = surface(PostgresStore);

  const missing = (ref, other) => ref.filter((m) => !other.includes(m));

  assert.deepEqual(missing(inMemory, sqlite), [], 'SqliteStore no implementa métodos del contrato');
  assert.deepEqual(missing(inMemory, postgres), [], 'PostgresStore no implementa métodos del contrato');
  assert.deepEqual(missing(sqlite, inMemory), [], 'InMemoryStore no implementa métodos del contrato');
  assert.deepEqual(missing(postgres, inMemory), [], 'InMemoryStore no implementa métodos del contrato');
});

// ── Comportamiento: la misma batería sobre cada adaptador ───────────────────

// pgvector fija la dimensión en la columna: los vectores de prueba usan la
// misma que el modelo real (nomic-embed-text) para que la batería valga igual
// en los tres adaptadores.
const DIMS = 768;
const oneHot = (axis) => Array.from({ length: DIMS }, (_, i) => (i === axis ? 1 : 0));

const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const tenantA = `ct-a-${suffix}`;
const tenantB = `ct-b-${suffix}`;

const ADAPTERS = [
  {
    name: 'InMemoryStore',
    make: async () => new InMemoryStore(),
  },
  {
    name: 'SqliteStore',
    make: async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'operant-contract-'));
      const store = new SqliteStore({ filePath: path.join(dir, 'contract.db') });
      await store.connect();
      return store;
    },
  },
  {
    name: 'PostgresStore',
    skip: process.env.DATABASE_URL ? false : 'requiere DATABASE_URL (npm run db:up && npm run db:migrate)',
    make: async () => {
      const store = new PostgresStore({ connectionString: process.env.DATABASE_URL });
      await store.connect();
      // Base compartida entre ejecuciones: se limpia lo de estos tenants.
      // audit_log no: es append-only y el rol de aplicación no puede borrarlo
      // (ver 004_app_role.sql). No hace falta — los tenants de prueba llevan un
      // sufijo único por ejecución, así que nada se solapa.
      for (const t of [tenantA, tenantB]) {
        await store._withTenant(t, async (c) => {
          for (const table of ['tasks', 'approvals', 'interactions', 'facts']) {
            await c.query(`DELETE FROM ${table} WHERE tenant_id = $1`, [t]);
          }
        });
        await store.deleteTenant(t);
      }
      return store;
    },
  },
];

for (const adapter of ADAPTERS) {
  const opts = adapter.skip ? { skip: adapter.skip } : {};
  const it = (name, fn) => test(`${adapter.name}: ${name}`, opts, fn);

  it('tenants: alta, actualización, listado y baja', async () => {
    const store = await adapter.make();

    await store.upsertTenant({ tenantId: tenantA, plan: 'pro', departments: ['sales', 'support'], businessId: 'bezhas' });
    await store.upsertTenant({ tenantId: tenantB, plan: 'starter', departments: ['sales'] });

    const list = await store.listTenants();
    const a = list.find((t) => t.tenantId === tenantA);
    assert.ok(a, 'el tenant dado de alta aparece en el listado');
    assert.equal(a.plan, 'pro');
    assert.deepEqual(a.departments, ['sales', 'support']);
    assert.equal(a.businessId, 'bezhas');

    // Un upsert sin businessId no debe borrar el que ya había.
    await store.upsertTenant({ tenantId: tenantA, plan: 'enterprise', departments: ['sales'] });
    const updated = (await store.listTenants()).find((t) => t.tenantId === tenantA);
    assert.equal(updated.plan, 'enterprise');
    assert.equal(updated.businessId, 'bezhas', 'el perfil de negocio sobrevive a un upsert parcial');

    await store.deleteTenant(tenantB);
    assert.equal((await store.listTenants()).some((t) => t.tenantId === tenantB), false);

    await store.disconnect();
  });

  it('claves de API: solo el hash, y la baja del tenant se la lleva', async () => {
    const store = await adapter.make();

    await store.upsertTenant({ tenantId: tenantA, plan: 'pro', departments: ['sales'] });
    await store.setApiKeyHash({ tenantId: tenantA, hash: 'hash-1' });
    await store.setApiKeyHash({ tenantId: tenantA, hash: 'hash-2' });   // rotación

    const keys = await store.listApiKeyHashes();
    const mine = keys.filter((k) => k.tenantId === tenantA);
    assert.equal(mine.length, 1, 'una clave viva por tenant');
    assert.equal(mine[0].hash, 'hash-2');

    await store.deleteTenant(tenantA);
    assert.equal((await store.listApiKeyHashes()).some((k) => k.tenantId === tenantA), false);

    await store.disconnect();
  });

  it('tareas: transición de estado, recuperación por id y aislamiento', async () => {
    const store = await adapter.make();
    const createdAt = new Date().toISOString();

    await store.upsertTask({
      id: 't1', tenantId: tenantA, type: 'request', department: 'sales',
      payload: { text: 'quiero una demo' }, status: 'queued', createdAt,
    });
    await store.upsertTask({
      id: 't2', tenantId: tenantB, type: 'request', department: 'support',
      payload: { text: 'de otro tenant' }, status: 'queued', createdAt,
    });

    // La misma tarea avanza de estado sin perder lo que traía.
    await store.upsertTask({
      id: 't1', tenantId: tenantA, status: 'completed', result: { reply: 'listo' }, createdAt,
    });

    const t1 = await store.getTask({ tenantId: tenantA, taskId: 't1' });
    assert.equal(t1.status, 'completed');
    assert.deepEqual(t1.result, { reply: 'listo' });
    assert.deepEqual(t1.payload, { text: 'quiero una demo' }, 'el payload original no se pierde al actualizar');
    assert.equal(t1.department, 'sales');

    assert.equal(await store.getTask({ tenantId: tenantB, taskId: 't1' }), null,
      'un tenant no puede leer la tarea de otro ni conociendo su id');

    const listed = await store.listTasks({ tenantId: tenantA, limit: 10 });
    assert.equal(listed.length, 1);
    assert.equal(listed[0].id, 't1');

    assert.equal((await store.listTasks({ tenantId: tenantA, statuses: ['queued'], limit: 10 })).length, 0);
    assert.equal((await store.listTasks({ tenantId: tenantA, statuses: ['completed'], limit: 10 })).length, 1);

    // Una tarea guardada sin fecha la recibe del store: el historial del panel
    // se ordena por ella y un null dejaría el orden indefinido.
    await store.upsertTask({ id: 'sin-fecha', tenantId: tenantA, status: 'queued', payload: {} });
    const sinFecha = await store.getTask({ tenantId: tenantA, taskId: 'sin-fecha' });
    assert.ok(sinFecha.createdAt, 'createdAt nunca queda vacío');

    await store.disconnect();
  });

  it('tareas: el listado devuelve las más recientes primero', async () => {
    const store = await adapter.make();
    for (let n = 1; n <= 3; n++) {
      await store.upsertTask({
        id: `ord-${n}`, tenantId: tenantA, status: 'queued', payload: {},
        createdAt: new Date(Date.UTC(2026, 0, n)).toISOString(),
      });
    }
    const list = await store.listTasks({ tenantId: tenantA, limit: 10 });
    assert.deepEqual(list.map((t) => t.id), ['ord-3', 'ord-2', 'ord-1']);

    await store.disconnect();
  });

  it('aprobaciones HITL: la pendiente se rehidrata y la decidida sale de la bandeja', async () => {
    const store = await adapter.make();

    await store.upsertApproval({
      approvalId: 'ap1', tenantId: tenantA, agentId: 'sales.outreach',
      action: { connector: 'email', method: 'send', args: { to: 'x@y.z' } },
      reason: 'envío en frío', status: 'pending',
    });
    await store.upsertApproval({
      approvalId: 'ap2', tenantId: tenantA, agentId: 'finance.invoice',
      action: { connector: 'stripe', method: 'charge' }, reason: 'cobro', status: 'pending',
    });
    await store.upsertApproval({
      approvalId: 'ap3', tenantId: tenantB, agentId: 'sales.outreach',
      action: {}, reason: 'de otro tenant', status: 'pending',
    });

    const pending = await store.listApprovals({ tenantId: tenantA, status: 'pending' });
    assert.equal(pending.length, 2, 'solo las del tenant, y solo las pendientes');
    const ap1 = pending.find((a) => a.approvalId === 'ap1');
    assert.equal(ap1.agentId, 'sales.outreach');
    assert.equal(ap1.reason, 'envío en frío');
    assert.deepEqual(ap1.action, { connector: 'email', method: 'send', args: { to: 'x@y.z' } },
      'la acción a ejecutar sobrevive entera: sin ella, un sí humano tras un reinicio no sabría qué hacer');

    // Decisión humana: deja de estar pendiente pero no desaparece.
    await store.upsertApproval({
      approvalId: 'ap1', tenantId: tenantA, agentId: 'sales.outreach',
      action: { connector: 'email', method: 'send' }, reason: 'envío en frío',
      status: 'approved', note: 'ok por Telegram', resolvedAt: new Date().toISOString(),
    });

    assert.equal((await store.listApprovals({ tenantId: tenantA, status: 'pending' })).length, 1);
    const all = await store.listApprovals({ tenantId: tenantA });
    assert.equal(all.length, 2);
    const decided = all.find((a) => a.approvalId === 'ap1');
    assert.equal(decided.status, 'approved');
    assert.equal(decided.note, 'ok por Telegram');
    assert.ok(decided.resolvedAt, 'queda constancia de cuándo se decidió');

    await store.disconnect();
  });

  it('hechos: sobrescritura y aislamiento entre tenants', async () => {
    const store = await adapter.make();

    await store.setFact({ tenantId: tenantA, key: 'icp', value: { sector: 'retail' } });
    await store.setFact({ tenantId: tenantA, key: 'icp', value: { sector: 'logística' } });
    await store.setFact({ tenantId: tenantB, key: 'icp', value: { sector: 'otro' } });

    assert.deepEqual(await store.getFact({ tenantId: tenantA, key: 'icp' }), { sector: 'logística' });
    assert.deepEqual(await store.getFact({ tenantId: tenantB, key: 'icp' }), { sector: 'otro' });
    assert.equal(await store.getFact({ tenantId: tenantA, key: 'no-existe' }), null);

    await store.disconnect();
  });

  it('memoria episódica: cronológica, filtrada por agente y aislada', async () => {
    const store = await adapter.make();

    await store.saveInteraction({ tenantId: tenantA, agentId: 'ag1', summary: 'caso 1', outcome: 'ok' });
    await store.saveInteraction({ tenantId: tenantA, agentId: 'ag1', summary: 'caso 2', outcome: 'ok' });
    await store.saveInteraction({ tenantId: tenantA, agentId: 'ag2', summary: 'otro agente', outcome: 'ok' });
    await store.saveInteraction({ tenantId: tenantB, agentId: 'ag1', summary: 'otro tenant', outcome: 'ok' });

    const recent = await store.recallInteractions({ tenantId: tenantA, agentId: 'ag1', k: 5 });
    assert.equal(recent.length, 2);
    assert.equal(recent[0].summary, 'caso 2', 'lo más reciente primero');
    assert.equal(recent[1].summary, 'caso 1');

    const todos = await store.recallInteractions({ tenantId: tenantA, k: 10 });
    assert.equal(todos.length, 3, 'sin agentId, todo lo del tenant');
    assert.equal(todos.every((i) => i.summary !== 'otro tenant'), true, 'nunca lo de otro tenant');

    assert.equal((await store.recallInteractions({ tenantId: tenantA, agentId: 'ag1', k: 1 })).length, 1, 'respeta k');

    await store.disconnect();
  });

  it('memoria semántica: el más parecido gana al más reciente', async () => {
    const store = await adapter.make();

    await store.saveInteraction({
      tenantId: tenantA, agentId: 'ag1', summary: 'soporte técnico básico',
      outcome: 'ok', embedding: oneHot(1),
    });
    await store.saveInteraction({
      tenantId: tenantA, agentId: 'ag1', summary: 'reunión de ventas con deal',
      outcome: 'won', embedding: oneHot(0),
    });

    const hits = await store.recallInteractions({ tenantId: tenantA, agentId: 'ag1', embedding: oneHot(1), k: 2 });
    assert.equal(hits.length, 2);
    assert.equal(hits[0].summary, 'soporte técnico básico',
      'el caso semánticamente cercano se impone al más nuevo');
    assert.ok(hits[0].score > 0.9, `score de similitud esperado > 0.9, fue ${hits[0].score}`);
    assert.ok(hits[0].score >= hits[1].score, 'ordenado por similitud descendente');

    await store.disconnect();
  });

  it('memoria semántica: sin vectores guardados cae a lo cronológico, no a vacío', async () => {
    const store = await adapter.make();

    await store.saveInteraction({ tenantId: tenantA, agentId: 'ag1', summary: 'sin vector', outcome: 'ok' });

    const hits = await store.recallInteractions({ tenantId: tenantA, agentId: 'ag1', embedding: oneHot(0), k: 5 });
    assert.equal(hits.length, 1, 'una consulta semántica sobre memoria sin embeddings no debe volver vacía');
    assert.equal(hits[0].summary, 'sin vector');

    await store.disconnect();
  });

  it('auditoría: append-only, en orden y por tenant', async () => {
    const store = await adapter.make();

    await store.appendAudit({ tenantId: tenantA, event: 'task:queued', taskId: 't1' });
    await store.appendAudit({ tenantId: tenantA, event: 'hitl:requested', approvalId: 'ap1' });
    await store.appendAudit({ tenantId: tenantB, event: 'task:queued', taskId: 't9' });

    const log = await store.auditFor(tenantA);
    assert.equal(log.length, 2);
    assert.equal(log[0].event, 'task:queued', 'el orden de inserción se conserva: la cadena de hashes depende de él');
    assert.equal(log[0].taskId, 't1', 'los campos extra del registro viajan enteros');
    assert.equal(log[1].event, 'hitl:requested');
    assert.equal(log[1].approvalId, 'ap1');

    assert.equal((await store.auditFor(tenantB)).length, 1);

    await store.disconnect();
  });

  it('auditoría: el orden se conserva aunque quien escribe no espere', async () => {
    const store = await adapter.make();

    // Así es como escribe AuditLog de verdad: dispara y sigue, sin esperar
    // (`store.appendAudit(record).catch(...)`). Con un pool de conexiones, dos
    // inserciones concurrentes pueden confirmarse en orden distinto al que se
    // emitieron — y como cada registro lleva el hash del anterior, la cadena
    // aparecería ROTA siendo correcta. Falsa alarma en la única pieza cuyo
    // valor es que un auditor pueda fiarse de ella.
    // Tenant propio: la auditoría es append-only y no se puede limpiar entre
    // pruebas, así que este caso necesita un log virgen para leer el orden.
    const tenantSeq = `${tenantA}-seq`;
    const N = 25;
    const disparadas = [];
    for (let i = 0; i < N; i++) {
      disparadas.push(store.appendAudit({ tenantId: tenantSeq, event: 'seq', orden: i }));
    }
    await Promise.all(disparadas);

    const log = await store.auditFor(tenantSeq);
    assert.deepEqual(
      log.map((r) => r.orden),
      Array.from({ length: N }, (_, i) => i),
      'los registros se leen en el mismo orden en que se emitieron'
    );

    await store.disconnect();
  });
}

// ── Postgres: lo que solo se puede comprobar contra la base real ────────────

const pgOnly = ADAPTERS.find((a) => a.name === 'PostgresStore');
const pgOpts = pgOnly.skip ? { skip: pgOnly.skip } : {};

/**
 * Las pruebas de arriba filtran por tenant en el WHERE, así que pasarían
 * igual sin RLS. Estas no: consultan SIN filtro y comprueban que quien aísla
 * es Postgres. Importa porque la aplicación se conecta con el rol dueño de las
 * tablas, y Postgres exime al dueño de sus propias políticas salvo que se use
 * FORCE ROW LEVEL SECURITY — sin ese FORCE, la RLS del esquema era decorativa.
 */
test('PostgresStore: la RLS aísla aunque la consulta no filtre por tenant', pgOpts, async () => {
  const store = await pgOnly.make();

  await store.upsertTask({ id: 'rls-a', tenantId: tenantA, status: 'queued', payload: { secreto: 'de A' } });
  await store.upsertTask({ id: 'rls-b', tenantId: tenantB, status: 'queued', payload: { secreto: 'de B' } });
  await store.setFact({ tenantId: tenantA, key: 'k', value: { de: 'A' } });
  await store.setFact({ tenantId: tenantB, key: 'k', value: { de: 'B' } });

  const visto = await store._withTenant(tenantA, async (c) => ({
    tasks: (await c.query('SELECT id FROM tasks')).rows.map((r) => r.id),
    facts: (await c.query('SELECT tenant_id FROM facts')).rows.map((r) => r.tenant_id),
  }));

  assert.deepEqual(visto.tasks, ['rls-a'], 'en el contexto de A, un SELECT sin WHERE no ve las tareas de B');
  assert.deepEqual(visto.facts, [tenantA], 'lo mismo para los hechos');

  // Escribir en nombre de otro tenant tampoco: la política se aplica al INSERT.
  await assert.rejects(
    () => store._withTenant(tenantA, (c) =>
      c.query('INSERT INTO tasks (id, tenant_id, status) VALUES ($1, $2, $3)', ['rls-x', tenantB, 'queued'])),
    /row-level security/i,
    'un tenant no puede insertar filas a nombre de otro'
  );

  await store.disconnect();
});

test('PostgresStore: sin contexto de tenant no se ve nada (falla cerrado)', pgOpts, async () => {
  const store = await pgOnly.make();
  await store.upsertTask({ id: 'sin-ctx', tenantId: tenantA, status: 'queued', payload: {} });

  // Consulta directa por el pool, sin pasar por _withTenant: app.tenant_id no
  // está fijado, current_setting devuelve NULL y la política no deja ver nada.
  // El modo de fallo por olvidarse del contexto es "cero filas", no "todas".
  const { rows } = await store.pool.query('SELECT id FROM tasks');
  assert.deepEqual(rows, [], 'sin app.tenant_id fijado no se devuelve ninguna fila');

  await store.disconnect();
});

test('PostgresStore: no arranca si la dimensión de embeddings no cuadra con el esquema', pgOpts, async () => {
  const store = new PostgresStore({ connectionString: process.env.DATABASE_URL, embeddingDims: 1536 });
  await assert.rejects(
    () => store.connect(),
    (err) => {
      assert.match(err.message, /vector\(768\)/, 'dice qué hay en el esquema');
      assert.match(err.message, /1536/, 'dice qué esperaba el modelo');
      assert.match(err.message, /ALTER TABLE/, 'dice cómo arreglarlo');
      return true;
    },
    'un desajuste de dimensión debe impedir el arranque, no reventar en la primera escritura de memoria'
  );
  await store.disconnect();
});

test('PostgresStore: un embedding de otra dimensión no se lleva por delante el recuerdo', pgOpts, async () => {
  const store = await pgOnly.make();

  await store.saveInteraction({
    tenantId: tenantA, agentId: 'ag1', summary: 'vector de tamaño equivocado',
    outcome: 'ok', embedding: [1, 0, 0],
  });

  const hits = await store.recallInteractions({ tenantId: tenantA, agentId: 'ag1', k: 5 });
  assert.equal(hits.length, 1, 'la interacción se guarda sin vector en vez de perderse');
  assert.equal(hits[0].summary, 'vector de tamaño equivocado');

  await store.disconnect();
});
