'use strict';

/**
 * AutomationConnector (n8n) — Fase B.6 del stack soberano.
 *
 * Se prueban tres cosas:
 *  1. El modo simulado (sin N8N_API_URL) sigue el contrato del resto del stack.
 *  2. El cableado real con un `fetch` inyectado: URL, cabecera propia de n8n y
 *     el tenantId viajando en el cuerpo (aislamiento multi-tenant).
 *  3. Lo importante de verdad: disparar un workflow NO esquiva el PolicyEngine,
 *     y leer se puede separar de ejecutar.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const AutomationConnector = require('../src/connectors/AutomationConnector');
const PolicyEngine = require('../src/guardrails/PolicyEngine');
const { categoryForToolCall, buildToolDefinitions } = require('../src/cognition/toolCatalog');

function fakeFetch(routes) {
  const calls = [];
  const fn = async (url, opts = {}) => {
    calls.push({ url, method: opts.method, body: opts.body, headers: opts.headers });
    for (const [match, resp] of routes) {
      if (url.includes(match)) return { ok: true, status: 200, json: async () => resp };
    }
    return { ok: false, status: 404, json: async () => ({ message: 'no route' }) };
  };
  fn.calls = calls;
  return fn;
}

// ── Modo simulado (desarrollo sin contenedor) ───────────────────────
test('automation simulado sin N8N_API_URL: dispara y se puede consultar', async () => {
  const a = new AutomationConnector({ tenantId: 't1' });
  assert.equal(a.simulated, true);

  const exec = await a.execute('trigger', { workflow: 'lead-creado', payload: { leadId: 7 } });
  assert.equal(exec.simulated, true);
  assert.equal(exec.workflow, 'lead-creado');
  assert.equal(exec.tenantId, 't1');

  const found = await a.execute('getExecution', { id: exec.id });
  assert.equal(found.id, exec.id);
  assert.deepEqual(found.payload, { leadId: 7 });
});

test('automation: métodos y argumentos obligatorios fallan claro', async () => {
  const a = new AutomationConnector({ tenantId: 't1' });
  await assert.rejects(() => a.execute('noExiste'), /método desconocido/);
  await assert.rejects(() => a.execute('trigger', {}), /falta "workflow"/);
  await assert.rejects(() => a.execute('run', {}), /falta "workflowId"/);
});

// ── Cableado real (fetch inyectado, sin servicio vivo) ──────────────
test('automation real: trigger llama al webhook con el tenantId en el cuerpo', async () => {
  const fetchFn = fakeFetch([['/webhook/lead-creado', { ok: true, received: 1 }]]);
  const a = new AutomationConnector({
    tenantId: 'acme',
    config: { apiUrl: 'http://n8n.local', apiKey: 'k1', fetch: fetchFn },
  });
  assert.equal(a.simulated, false);

  const r = await a.trigger({ workflow: 'lead-creado', payload: { leadId: 7 } });
  assert.equal(r.status, 'triggered');

  const call = fetchFn.calls[0];
  assert.equal(call.url, 'http://n8n.local/webhook/lead-creado');
  assert.equal(call.method, 'POST');
  // El aislamiento no depende de que el workflow se acuerde: lo inyecta el conector.
  assert.match(call.body, /"tenantId":"acme"/);
  assert.match(call.body, /"leadId":7/);
});

test('automation real: listWorkflows usa la cabecera propia de n8n (no Bearer)', async () => {
  const fetchFn = fakeFetch([['/api/v1/workflows', {
    data: [{ id: 'w1', name: 'Lead → CRM', active: true, extra: 'ignorado' }],
  }]]);
  const a = new AutomationConnector({
    tenantId: 'acme',
    config: { apiUrl: 'http://n8n.local', apiKey: 'k1', fetch: fetchFn },
  });

  const list = await a.listWorkflows();
  assert.deepEqual(list, [{ id: 'w1', name: 'Lead → CRM', active: true }]);
  assert.equal(fetchFn.calls[0].headers['X-N8N-API-KEY'], 'k1');
  assert.equal(fetchFn.calls[0].headers.Authorization, undefined);
});

test('automation real: un webhook caído propaga el status HTTP', async () => {
  const fetchFn = fakeFetch([]); // todo 404
  const a = new AutomationConnector({
    tenantId: 'acme',
    config: { apiUrl: 'http://n8n.local', apiKey: 'k1', fetch: fetchFn },
  });
  await assert.rejects(() => a.trigger({ workflow: 'nope' }), (err) => {
    assert.equal(err.status, 404);
    return true;
  });
});

test('automation: el webhook puede vivir en otro host que la API', async () => {
  const fetchFn = fakeFetch([['tunel.example', { ok: true }]]);
  const a = new AutomationConnector({
    tenantId: 'acme',
    config: { apiUrl: 'http://n8n.local', webhookUrl: 'https://tunel.example', apiKey: 'k1', fetch: fetchFn },
  });
  await a.trigger({ workflow: 'x' });
  assert.equal(fetchFn.calls[0].url, 'https://tunel.example/webhook/x');
});

// ── Guardrails: lo que de verdad importa ───────────────────────────
test('automation: ejecutar y leer llevan categorías distintas', () => {
  assert.equal(categoryForToolCall('automation', 'trigger').category, 'automation');
  assert.equal(categoryForToolCall('automation', 'run').category, 'automation');
  assert.equal(categoryForToolCall('automation', 'listWorkflows').category, 'automation_read');
  assert.equal(categoryForToolCall('automation', 'getExecution').category, 'automation_read');
});

test('automation: el tenant puede endurecer disparar sin bloquear consultar', () => {
  const pe = new PolicyEngine({ tenantId: 't1', plan: 'pro' });
  pe.setOverride('automation', 'always_approve');

  const disparar = pe.evaluate({ agentId: 'a', action: categoryForToolCall('automation', 'trigger') });
  assert.equal(disparar.requiresApproval, true, 'disparar un workflow debe poder exigir aprobación');

  const consultar = pe.evaluate({ agentId: 'a', action: categoryForToolCall('automation', 'listWorkflows') });
  assert.equal(consultar.allowed, true, 'consultar workflows no queda bloqueado por endurecer la ejecución');
});

test('automation: se puede bloquear del todo', () => {
  const pe = new PolicyEngine({ tenantId: 't1', plan: 'starter' });
  pe.setOverride('automation', 'block');
  const v = pe.evaluate({ agentId: 'a', action: categoryForToolCall('automation', 'run') });
  assert.equal(v.allowed, false);
  assert.equal(v.requiresApproval, false);
});

test('automation: el modelo ve el conector en el catálogo de herramientas', async () => {
  const defs = await buildToolDefinitions({ automation: new AutomationConnector({ tenantId: 't1' }) });
  assert.equal(defs.length, 1);
  assert.equal(defs[0].name, 'automation');
  assert.deepEqual(
    defs[0].input_schema.properties.method.enum.sort(),
    ['getExecution', 'listWorkflows', 'run', 'trigger'],
  );
  // El modelo debe leer que disparar no es inocuo.
  assert.match(defs[0].description, /aprobación humana/);
});
