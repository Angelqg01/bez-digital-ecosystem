'use strict';

/**
 * Tests del editor de políticas del tenant: endurecer categorías y la garantía
 * de que las líneas rojas no se pueden relajar.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const PolicyEngine = require('../src/guardrails/PolicyEngine');
const AuditLog = require('../src/guardrails/AuditLog');

test('setOverride: bloquea una categoría', () => {
  const pe = new PolicyEngine({ tenantId: 'acme' });
  pe.setOverride('outbound', 'block');
  const v = pe.evaluate({ action: { category: 'outbound', recipientCount: 1 } });
  assert.equal(v.allowed, false);
  assert.equal(v.requiresApproval, false, 'bloqueada, ni siquiera con aprobación');
});

test('setOverride: exige aprobación para una categoría', () => {
  const pe = new PolicyEngine({ tenantId: 'acme' });
  pe.setOverride('note', 'always_approve');
  const v = pe.evaluate({ action: { category: 'note' } });
  assert.equal(v.requiresApproval, true);
});

test('regla inválida (intento de relajar) se rechaza', () => {
  const pe = new PolicyEngine({ tenantId: 'acme' });
  assert.throws(() => pe.setOverride('payment', 'allow'), /regla inválida/);
  assert.throws(() => pe.setOverride('payment', 'permitir'), /regla inválida/);
});

test('las líneas rojas se evalúan ANTES y no se pueden relajar', () => {
  const pe = new PolicyEngine({ tenantId: 'acme' });
  // Aunque el tenant no ponga nada, mover dinero siempre exige aprobación.
  const v = pe.evaluate({ action: { category: 'payment', method: 'send' } });
  assert.equal(v.requiresApproval, true);
  assert.match(v.reason, /Línea roja/);
});

test('getOverrides / removeOverride', () => {
  const pe = new PolicyEngine({ tenantId: 'acme' });
  pe.setOverride('outbound', 'block');
  assert.deepEqual(pe.getOverrides(), { outbound: 'block' });
  pe.removeOverride('outbound');
  assert.deepEqual(pe.getOverrides(), {});
  // Sin override, una acción normal vuelve a permitirse.
  assert.equal(pe.evaluate({ action: { category: 'outbound', recipientCount: 1 } }).allowed, true);
});

test('evaluate() audita CADA decisión, no solo las que llegan a HITL', () => {
  const audit = new AuditLog({ tenantId: 'acme' });
  const pe = new PolicyEngine({ tenantId: 'acme', audit });

  pe.evaluate({ agentId: 'sales.crm', action: { category: 'note' } }); // allowed
  pe.setOverride('outbound', 'block');
  pe.evaluate({ agentId: 'sales.hunter', action: { category: 'outbound', recipientCount: 1 } }); // blocked
  pe.evaluate({ agentId: 'finance.ar-chaser', action: { category: 'payment', method: 'send' } }); // requires_approval

  const decisions = audit.query({ event: 'policy:decision' });
  assert.equal(decisions.length, 3);
  assert.equal(decisions[0].decision, 'allowed');
  assert.equal(decisions[0].rule, null);

  assert.equal(decisions[1].decision, 'blocked');
  assert.equal(decisions[1].rule, 'override:outbound:block');
  assert.equal(decisions[1].agentId, 'sales.hunter');

  assert.equal(decisions[2].decision, 'requires_approval');
  assert.equal(decisions[2].rule, 'redline:money_movement');
});

test('un "blocked" queda con rastro auditado (antes desaparecía sin dejar registro)', () => {
  const audit = new AuditLog({ tenantId: 'acme' });
  const pe = new PolicyEngine({ tenantId: 'acme', audit });
  pe.setOverride('outbound', 'block');

  const v = pe.evaluate({ agentId: 'sales.hunter', action: { category: 'outbound', recipientCount: 1 } });
  assert.equal(v.allowed, false);
  assert.equal(v.requiresApproval, false);

  const [decision] = audit.query({ event: 'policy:decision', decision: 'blocked' });
  assert.ok(decision, 'debe existir un registro de auditoría del bloqueo');
});

test('setOverride/removeOverride auditan quién cambió la política y el valor anterior', () => {
  const audit = new AuditLog({ tenantId: 'acme' });
  const pe = new PolicyEngine({ tenantId: 'acme', audit });

  pe.setOverride('outbound', 'block', 'admin');
  pe.setOverride('outbound', 'always_approve', 'acme'); // el propio tenant lo relaja a "solo aprobar"
  pe.removeOverride('outbound', 'admin');

  const events = audit.query({});
  const sets = events.filter((e) => e.event === 'policy:override_set');
  const removed = events.filter((e) => e.event === 'policy:override_removed');

  assert.equal(sets.length, 2);
  assert.equal(sets[0].actor, 'admin');
  assert.equal(sets[0].previous, null);
  assert.equal(sets[1].actor, 'acme');
  assert.equal(sets[1].previous, 'block', 'debe registrar el valor anterior, no solo el nuevo');

  assert.equal(removed.length, 1);
  assert.equal(removed[0].actor, 'admin');
  assert.equal(removed[0].previous, 'always_approve');
});

test('removeOverride sin override previo no genera ruido en el audit log', () => {
  const audit = new AuditLog({ tenantId: 'acme' });
  const pe = new PolicyEngine({ tenantId: 'acme', audit });
  pe.removeOverride('categoria-inexistente', 'admin');
  assert.equal(audit.query({ event: 'policy:override_removed' }).length, 0);
});

test('sin audit configurado, evaluate() y los overrides funcionan igual (compatibilidad hacia atrás)', () => {
  const pe = new PolicyEngine({ tenantId: 'acme' }); // sin audit, como todos los tests de arriba
  assert.doesNotThrow(() => {
    pe.setOverride('outbound', 'block');
    pe.evaluate({ action: { category: 'outbound', recipientCount: 1 } });
    pe.removeOverride('outbound');
  });
});
