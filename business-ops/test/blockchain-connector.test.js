'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const BlockchainConnector = require('../src/connectors/BlockchainConnector');

const TO = '0x' + '1'.repeat(40);

test('BlockchainConnector: pide una intención a BeZhas, no firma nada', async () => {
  const llamadas = [];
  const fetchImpl = async (url, opts) => {
    llamadas.push({ url, opts, body: JSON.parse(opts.body) });
    return { ok: true, json: async () => ({ intencion: { id: 'i-1', estado: 'awaiting_approval', decision: 'REQUIRE_APPROVAL', aprobacionesRequeridas: 2, motivos: [{ code: 'CUSTODIED_FUNDS' }] } }) };
  };
  const c = new BlockchainConnector({
    tenantId: 'acme',
    config: { apiUrl: 'http://api:3001', agentKey: 'bzag_x', fetchImpl, privateKey: '0x' + 'a'.repeat(64) },
  });
  const r = await c.transfer({ to: TO, amount: 10, reference: 'cs_test_1', counterparty: { legalName: 'Ana Pérez', country: 'ES' } });

  assert.equal(r.sent, false, 'nunca se da por enviado');
  assert.equal(r.status, 'awaiting_approval');
  assert.equal(llamadas[0].url, 'http://api:3001/api/gateway/v1/tx/intents');
  assert.equal(llamadas[0].opts.headers['x-api-key'], 'bzag_x');
  assert.deepEqual(llamadas[0].body.source, { type: 'bezhas_treasury' });
  assert.equal(llamadas[0].body.counterparty.country, 'ES');

  // Reintentar la misma tarea = misma clave: la API devuelve la misma intención.
  await c.transfer({ to: TO, amount: 10, reference: 'cs_test_1' });
  assert.equal(llamadas[1].body.idempotencyKey, llamadas[0].body.idempotencyKey);
  assert.match(llamadas[0].body.idempotencyKey, /^[A-Za-z0-9_-]{8,80}$/);
});

test('BlockchainConnector: si la API deniega, la tarea falla con el código', async () => {
  const c = new BlockchainConnector({
    tenantId: 'acme',
    config: { apiUrl: 'http://api:3001', agentKey: 'bzag_x', fetchImpl: async () => ({ ok: false, status: 403, json: async () => ({ code: 'LOCKDOWN', error: 'bloqueado' }) }) },
  });
  await assert.rejects(c.transfer({ to: TO, amount: 1 }), /LOCKDOWN/);
});
