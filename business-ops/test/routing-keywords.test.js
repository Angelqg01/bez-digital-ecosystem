'use strict';

/**
 * Enrutado por palabras clave del Orchestrator.
 *
 * Bug real que motiva estos tests: la clave `ens ` (Esquema Nacional de
 * Seguridad) se comparaba por subcadena y casaba dentro de "tok**ens** del".
 * En BeZhas —una empresa de tokens— eso mandaba a **Legal** prácticamente
 * cualquier mensaje de soporte que mencionara tokens. Y como el tenant puede
 * no tener Legal contratado, el ticket moría con "sin departamento" en vez de
 * atenderse.
 *
 * Se prueba el enrutado real, no solo el comparador, porque lo que rompía era
 * la combinación (tabla de reglas + comparador), no cada pieza por separado.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const Orchestrator = require('../src/core/Orchestrator');

const route = (text) => new Orchestrator({ tenantId: 't' })._classify({ text });

// ── El bug concreto ──────────────────────────────────────────────────────

test('un mensaje sobre tokens NO se va a Legal por la clave "ens"', async () => {
  for (const t of [
    '¿Cómo consulto mi consumo de tokens del mes?',
    'No me llegan los tokens de acceso',
    'Necesito ayuda con los tokens de la API',
  ]) {
    const r = await route(t);
    assert.notEqual(r.department, 'legal', `mal enrutado: "${t}"`);
  }
});

test('el ENS de verdad sí llega a Legal', async () => {
  assert.equal((await route('¿Cumplís el ENS para el sector público?')).department, 'legal');
  assert.equal((await route('Necesitamos el esquema nacional de seguridad')).department, 'legal');
  assert.equal((await route('Consulta sobre RGPD')).department, 'legal');
});

// ── Morfología española (lo que rompería un límite de palabra estricto) ──

test('las formas flexionadas siguen enrutando bien', async () => {
  assert.equal((await route('tengo un problema con la facturación')).department, 'support', 'problema gana por orden de reglas');
  assert.equal((await route('consulta sobre facturación mensual')).department, 'finance');
  assert.equal((await route('mis facturas no aparecen')).department, 'finance');
  assert.equal((await route('los pagos me fallan')).department, 'finance');
});

// ── El comparador ────────────────────────────────────────────────────────

test('palabra suelta: exige principio de palabra, permite sufijo', () => {
  assert.equal(Orchestrator.matchesKeyword('mis tokens del mes', 'ens'), false);
  assert.equal(Orchestrator.matchesKeyword('cumplimos el ens', 'ens'), true);
  assert.equal(Orchestrator.matchesKeyword('soy un impostor', 'post'), false);
  assert.equal(Orchestrator.matchesKeyword('publicar un post', 'post'), true);
  assert.equal(Orchestrator.matchesKeyword('facturación', 'factura'), true, 'el sufijo debe permitirse');
});

test('frases: subcadena, para tolerar plurales', () => {
  assert.equal(Orchestrator.matchesKeyword('revisar contratos nuevos', 'revisar contrato'), true);
  assert.equal(Orchestrator.matchesKeyword('el precio del gas está alto', 'precio del gas'), true);
});

test('no casa con acentos pegados ni rompe con caracteres especiales', () => {
  assert.equal(Orchestrator.matchesKeyword('añoens', 'ens'), false, 'pegado a una letra acentuada no cuenta');
  assert.doesNotThrow(() => Orchestrator.matchesKeyword('texto', 'veri*factu'));
  assert.equal(Orchestrator.matchesKeyword('', 'ens'), false);
  assert.equal(Orchestrator.matchesKeyword('algo', ''), false);
});

// ── Que el resto del enrutado siga igual ─────────────────────────────────

test('el enrutado de siempre no cambia', async () => {
  const esperado = [
    ['quiero una demo y el precio', 'sales'],
    ['esto no funciona, ayuda', 'support'],
    ['estado de la cadena y validadores', 'blockchain'],
    ['runway de tesorería', 'treasury'],
    ['precio del token bez-coin', 'treasury'],
    ['somos un family office interesado', 'fundraising'],
    ['campaña de marketing en redes', 'marketing'],
    ['tenemos una vacante y varios cv', 'hr'],
    ['inventario y proveedores', 'operations'],
  ];
  for (const [texto, dep] of esperado) {
    assert.equal((await route(texto)).department, dep, `"${texto}" debía ir a ${dep}`);
  }
});

test('sin coincidencias cae en soporte', async () => {
  assert.equal((await route('buenos días')).department, 'support');
});
