'use strict';

/**
 * Cadencia de seguimiento por segmento.
 *
 * Viene de absorber `sales-agency`, que distinguia el ritmo por sector mientras
 * aqui habia una sola cadencia global. Lo que se protege: que el calendario del
 * perfil (dias desde el primer contacto) se traduzca bien a esperas entre
 * pasos, y que un perfil mal escrito no rompa la secuencia — vuelve al valor
 * por defecto en vez de dejar de enviar.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cadenceFor, DEFAULT_STEPS_DAYS } = require('../src/platform/followUpPolicy');

const perfil = require('../config/business/bezhas.json');

test('traduce dias-desde-el-inicio a esperas entre pasos', () => {
  // [0, 4, 9, 16, 25] son 4 seguimientos, esperando 4, 5, 7 y 9 dias.
  assert.deepEqual(cadenceFor('logistica', perfil), [4, 5, 7, 9]);
});

test('el perfil real de BeZhas define cadencia para sus segmentos nucleo', () => {
  for (const seg of ['logistica', 'puerto', 'agro']) {
    assert.deepEqual(cadenceFor(seg, perfil), [4, 5, 7, 9], `falta cadencia de ${seg}`);
  }
});

test('un segmento sin cadencia propia cae en la del perfil', () => {
  assert.deepEqual(cadenceFor('sector_inventado', perfil), [3, 7, 14]);
});

test('sin perfil, la cadencia por defecto del modulo', () => {
  assert.deepEqual(cadenceFor('logistica', null), DEFAULT_STEPS_DAYS);
});

test('un calendario mal escrito no detiene la secuencia: vuelve al defecto', () => {
  assert.deepEqual(cadenceFor('x', { followUpCadence: { x: [0] } }), DEFAULT_STEPS_DAYS);
  assert.deepEqual(cadenceFor('x', { followUpCadence: { x: [10, 4] } }), DEFAULT_STEPS_DAYS, 'dias hacia atras');
  assert.deepEqual(cadenceFor('x', { followUpCadence: { x: [0, 'tres'] } }), DEFAULT_STEPS_DAYS);
  assert.deepEqual(cadenceFor('x', { followUpCadence: { x: [0, 0] } }), DEFAULT_STEPS_DAYS, 'dos pasos el mismo dia');
});

test('los angulos portados no llevan jerga cripto ni precio en frio', () => {
  // La secuencia 'crypto' de sales-agency incumplia coldCopyRules y NO se porto.
  const prohibido = /BEZ-Coin|token|blockchain|cripto|crypto|preventa|listing|\$[0-9]/i;
  for (const [seg, pasos] of Object.entries(perfil.sequenceAngles)) {
    if (seg.startsWith('_')) continue;
    pasos.forEach((p, i) => {
      assert.ok(!prohibido.test(p), `${seg}[${i}] incumple las reglas de contacto en frio: ${p}`);
    });
  }
});
