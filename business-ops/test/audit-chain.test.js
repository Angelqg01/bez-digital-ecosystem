'use strict';

/**
 * AuditLog encadenado por hash: cada registro enlaza con el anterior, así que
 * alterar cualquier campo de cualquier registro pasado se puede detectar con
 * verifyChain(). Sin esto, un "append-only" en la base de datos solo protege
 * contra la propia app — no contra alguien con acceso directo a las filas.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const AuditLog = require('../src/guardrails/AuditLog');
const InMemoryStore = require('../src/platform/InMemoryStore');

test('cada registro enlaza con el hash del anterior, empezando en génesis', () => {
  const audit = new AuditLog({ tenantId: 'acme' });
  const r1 = audit.log({ event: 'a' });
  const r2 = audit.log({ event: 'b' });

  assert.equal(r1.prevHash, AuditLog.GENESIS);
  assert.equal(r2.prevHash, r1.hash);
  assert.notEqual(r1.hash, r2.hash);
  assert.match(r1.hash, /^[0-9a-f]{64}$/);
});

test('verifyChain: una cadena intacta pasa', async () => {
  const audit = new AuditLog({ tenantId: 'acme' });
  audit.log({ event: 'a' });
  audit.log({ event: 'b' });
  audit.log({ event: 'c' });

  const v = await audit.verifyChain();
  assert.equal(v.ok, true);
  assert.equal(v.checked, 3);
});

test('verifyChain: detecta un campo alterado en un registro pasado', async () => {
  const audit = new AuditLog({ tenantId: 'acme' });
  audit.log({ event: 'a' });
  audit.log({ event: 'b' });
  audit.log({ event: 'c' });

  // Alteración directa del buffer (simula acceso directo a la fila en la BD).
  audit._buffer[1].note = 'inyectado a mano';

  const v = await audit.verifyChain();
  assert.equal(v.ok, false);
  assert.equal(v.brokenAt.index, 1, 'debe señalar exactamente el registro alterado');
});

test('verifyChain: detecta un registro insertado/eliminado (rompe el prevHash del siguiente)', async () => {
  const audit = new AuditLog({ tenantId: 'acme' });
  audit.log({ event: 'a' });
  audit.log({ event: 'b' });
  audit.log({ event: 'c' });

  audit._buffer.splice(1, 1); // borra el registro del medio

  const v = await audit.verifyChain();
  assert.equal(v.ok, false, 'el hueco rompe el enlace prevHash → hash anterior');
});

test('hydrate: continúa la cadena tras un "reinicio" (nueva instancia, mismo store)', async () => {
  const store = new InMemoryStore();
  const before = new AuditLog({ tenantId: 'acme', store });
  const r1 = before.log({ event: 'a' });
  const r2 = before.log({ event: 'b' });

  // "Reinicio": instancia nueva, sin memoria previa, pero con el mismo store.
  const after = new AuditLog({ tenantId: 'acme', store });
  const n = await after.hydrate();
  assert.equal(n, 2, 'debe encontrar los 2 registros previos');

  const r3 = after.log({ event: 'c' });
  assert.equal(r3.prevHash, r2.hash, 'el 3er registro debe enlazar con el 2º de ANTES del reinicio, no con génesis');

  const v = await after.verifyChain(); // relee todo el historial vía store.auditFor
  assert.equal(v.ok, true);
  assert.equal(v.checked, 3);
});

test('sin hydrate tras un reinicio, la cadena se reinicia a génesis (documentado, no roto)', () => {
  const store = new InMemoryStore();
  const before = new AuditLog({ tenantId: 'acme', store });
  before.log({ event: 'a' });

  const after = new AuditLog({ tenantId: 'acme', store }); // sin hydrate()
  const r = after.log({ event: 'b' });
  assert.equal(r.prevHash, AuditLog.GENESIS, 'sin hydrate, no puede saber cuál era el último hash');
});

test('sin store, funciona en memoria (verifyChain usa el buffer)', async () => {
  const audit = new AuditLog({ tenantId: 'acme' }); // sin store
  audit.log({ event: 'a' });
  const v = await audit.verifyChain();
  assert.equal(v.ok, true);
});

test('tenantId por defecto del registro puede ser sobrescrito por el propio entry (comportamiento heredado)', () => {
  const audit = new AuditLog({ tenantId: 'acme' });
  const r = audit.log({ tenantId: 'otro', event: 'x' });
  assert.equal(r.tenantId, 'otro');
});
