'use strict';

/**
 * Persistencia del estado de plataforma que antes vivía solo en RAM:
 * KnowledgeBase (artículos), UsageMeter (cuota consumida) y CostTracker
 * (gasto acumulado). Todos persisten como facts del tenant y se rehidratan
 * tras un "reinicio" (nueva instancia sobre el mismo fichero SQLite).
 * Incluye el piloto de tool-use: OpsCoordinatorAgent con thinkAndAct.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SqliteStore = require('../src/platform/SqliteStore');
const KnowledgeBase = require('../src/platform/KnowledgeBase');
const UsageMeter = require('../src/platform/UsageMeter');
const CostTracker = require('../src/platform/CostTracker');
const ModelGateway = require('../src/cognition/ModelGateway');
const PolicyEngine = require('../src/guardrails/PolicyEngine');
const OpsCoordinatorAgent = require('../src/agents/operations/OpsCoordinatorAgent');

function tempDb(name) {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'operant-')), `${name}.db`);
}

test('KnowledgeBase: los artículos sobreviven a un reinicio y siguen buscables', async () => {
  const file = tempDb('kb');
  const store1 = new SqliteStore({ filePath: file });
  await store1.connect();

  const kb1 = new KnowledgeBase({ tenantId: 'acme', store: store1 });
  await kb1.ingest({ title: 'Restablecer contraseña', body: 'Ve a Ajustes > Seguridad para restablecer la contraseña.', tags: ['cuenta'] });
  await kb1.ingest({ title: 'Horario de soporte', body: 'Atendemos de 9 a 18 CET.', tags: ['sla'] });
  await store1.disconnect(); // ← "apagón"

  const store2 = new SqliteStore({ filePath: file });
  await store2.connect();
  const kb2 = new KnowledgeBase({ tenantId: 'acme', store: store2 });
  assert.equal(kb2.size, 0, 'antes de hidratar está vacía');
  const n = await kb2.hydrate();
  assert.equal(n, 2);

  const hits = await kb2.search('cómo restablezco mi contraseña');
  assert.ok(hits.length >= 1);
  assert.equal(hits[0].title, 'Restablecer contraseña');
  await store2.disconnect();
});

test('KnowledgeBase: aislamiento por tenant también persistida', async () => {
  const store = new SqliteStore({ filePath: tempDb('kb-iso') });
  await store.connect();
  await new KnowledgeBase({ tenantId: 'acme', store }).ingest({ title: 'Solo de acme', body: 'privado' });

  const beta = new KnowledgeBase({ tenantId: 'beta', store });
  await beta.hydrate();
  assert.equal(beta.size, 0, 'beta no ve los artículos de acme');
  await store.disconnect();
});

test('UsageMeter: la cuota consumida sobrevive al reinicio (no se regala cuota)', async () => {
  const file = tempDb('usage');
  const store1 = new SqliteStore({ filePath: file });
  await store1.connect();

  const meter1 = new UsageMeter({ store: store1 });
  meter1.setLimit('acme', 100);
  meter1.record('acme');
  meter1.record('acme');
  meter1.record('acme');
  await new Promise((r) => setImmediate(r)); // asienta la persistencia best-effort
  assert.equal(meter1.used('acme'), 3);
  await store1.disconnect();

  const store2 = new SqliteStore({ filePath: file });
  await store2.connect();
  const meter2 = new UsageMeter({ store: store2 });
  assert.equal(meter2.used('acme'), 0, 'antes de hidratar no sabe nada');
  await meter2.hydrate(['acme']);
  assert.equal(meter2.used('acme'), 3, 'tras el reinicio la cuota consumida se conserva');
  meter2.setLimit('acme', 4);
  meter2.record('acme');
  assert.equal(meter2.check('acme').allowed, false, 'el límite se aplica sobre el total real');
  await store2.disconnect();
});

test('CostTracker: el gasto acumulado sobrevive al reinicio', async () => {
  const file = tempDb('cost');
  const store1 = new SqliteStore({ filePath: file });
  await store1.connect();

  const cost1 = new CostTracker({ store: store1 });
  cost1.record({ model: 'claude-haiku-4-5', usage: { inputTokens: 1e6, outputTokens: 1e6 }, meta: { tenantId: 'acme' } });
  await new Promise((r) => setImmediate(r));
  assert.equal(cost1.usageFor('acme').costUsd, 6, '1M in ($1) + 1M out ($5)');
  await store1.disconnect();

  const store2 = new SqliteStore({ filePath: file });
  await store2.connect();
  const cost2 = new CostTracker({ store: store2 });
  await cost2.hydrate(['acme']);
  const acc = cost2.usageFor('acme');
  assert.equal(acc.costUsd, 6);
  assert.equal(acc.calls, 1);
  await store2.disconnect();
});

// ── Piloto de tool-use: OpsCoordinatorAgent ─────────────────────────

test('OpsCoordinator usa sysmon vía tool-use y responde con datos reales', async () => {
  const responses = [
    { // el modelo pide las métricas
      content: [{ type: 'tool_use', id: 't1', name: 'sysmon', input: { method: 'getSystemMetrics', args: {} } }],
      stop_reason: 'tool_use',
      usage: { input_tokens: 5, output_tokens: 5 },
    },
    { // y con ellas responde
      content: [{ type: 'text', text: 'El disco está al 85%: hay que ampliar almacenamiento.' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 5, output_tokens: 5 },
    },
  ];
  let i = 0;
  const provider = { messages: { create: async () => responses[Math.min(i++, responses.length - 1)] } };

  const sysmon = {
    name: 'sysmon',
    executed: 0,
    async execute(method) { this.executed++; return { diskUsagePct: 85, ramUsagePct: 40, method }; },
  };

  const agent = new OpsCoordinatorAgent({
    tenantId: 'acme',
    model: new ModelGateway({ providers: { anthropic: provider } }),
    guardrails: new PolicyEngine({ tenantId: 'acme' }),
    tools: { sysmon },
  });

  const out = await agent.run({ payload: { text: '¿Cómo está el servidor?' } });
  assert.equal(sysmon.executed, 1, 'el modelo invocó el conector de verdad');
  assert.match(out.answer, /85%/);
  assert.deepEqual(out.actions, [{ tool: 'sysmon', method: 'getSystemMetrics', status: 'executed' }]);
});

test('OpsCoordinator en modo simulado degrada a texto (comportamiento previo)', async () => {
  const agent = new OpsCoordinatorAgent({
    tenantId: 'acme',
    model: new ModelGateway({ providers: {} }), // simulado
    guardrails: new PolicyEngine({ tenantId: 'acme' }),
    tools: {},
  });
  const out = await agent.run({ payload: { text: 'prioriza las tareas' } });
  assert.match(out.answer, /SIMULADO/);
  assert.equal(out.status, 'ok');
});
