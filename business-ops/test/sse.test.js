'use strict';

/**
 * Tests del stream SSE: formato de frame, resumen del payload y que la
 * suscripción al bus se cancela limpiamente.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { formatSse, summarize, streamTenantEvents } = require('../src/platform/sse');
const EventBus = require('../src/core/EventBus');

test('formatSse produce un frame SSE válido', () => {
  assert.equal(formatSse('task:completed', { id: 't1' }), 'event: task:completed\ndata: {"id":"t1"}\n\n');
});

test('summarize recorta el payload por tipo de evento', () => {
  assert.deepEqual(
    summarize('task:completed', { id: 't1', status: 'completed', department: 'support', type: 'x', result: { big: 1 } }),
    { id: 't1', status: 'completed', department: 'support', type: 'x' },
  );
  assert.deepEqual(summarize('hitl:pending', { approvalId: 'a1', agentId: 'g', reason: 'r', action: {} }), { approvalId: 'a1', agentId: 'g', reason: 'r' });
});

test('streamTenantEvents escribe frames y la cancelación corta la suscripción', () => {
  const bus = new EventBus('acme');
  const frames = [];
  const cleanup = streamTenantEvents(bus, (f) => frames.push(f));

  bus.emit('task:completed', { id: 't1', status: 'completed' });
  bus.emit('hitl:pending', { approvalId: 'a1' });
  assert.equal(frames.length, 2);
  assert.match(frames[0], /^event: task:completed/);

  cleanup();
  bus.emit('task:completed', { id: 't2' });
  assert.equal(frames.length, 2, 'tras cleanup no llegan más frames');
});
