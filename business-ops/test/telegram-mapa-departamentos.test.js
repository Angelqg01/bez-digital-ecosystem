'use strict';

/**
 * El mapa departamento -> bot de Telegram.
 *
 * Lo que se protege: que NINGÚN departamento se quede sin bot propio. Antes
 * solo seis de los diez estaban asignados, y sales, support, hr y fundraising
 * caían al de reserva — sus avisos llegaban al bot del CEO mezclados con los
 * demás, que es justo lo que el reparto por departamento existe para evitar.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const HitlNotifier = require('../src/platform/HitlNotifier');

const DEPARTAMENTOS = Object.keys(require('../config/departments.json'));

// Entorno de prueba: un token distinguible por bot.
const ENV = {
  TELEGRAM_BOT_TOKEN: 'tok-general',
  TELEGRAM_TOKEN_DIRECTOR: 'tok-ceo',
  TELEGRAM_TOKEN_FINANCE: 'tok-cfo',
  TELEGRAM_TOKEN_MARKETING: 'tok-cmo',
  TELEGRAM_TOKEN_DEVOPS: 'tok-devops',
  TELEGRAM_TOKEN_LEGAL: 'tok-legal',
  HITL_TELEGRAM_CHAT_ID: '999',
};

const rutas = () => HitlNotifier.fromEnv(ENV).routes;

test('los diez departamentos tienen bot asignado, ninguno en reserva', () => {
  const r = rutas();
  const huerfanos = DEPARTAMENTOS.filter((d) => !r[d]);
  assert.deepEqual(huerfanos, [], `sin bot propio: ${huerfanos.join(', ')}`);
});

test('cada departamento va al bot que le corresponde por nombre', () => {
  const r = rutas();
  const esperado = {
    finance: 'tok-cfo', treasury: 'tok-cfo',
    marketing: 'tok-cmo',
    blockchain: 'tok-devops', operations: 'tok-devops',
    legal: 'tok-legal', hr: 'tok-legal',
    fundraising: 'tok-ceo',
    sales: 'tok-general', support: 'tok-general',
  };
  for (const [dep, tok] of Object.entries(esperado)) {
    assert.equal(r[dep].token, tok, `${dep} deberia ir a ${tok}`);
  }
});

test('los seis bots se usan: ninguno queda declarado y sin trabajo', () => {
  const usados = new Set(Object.values(rutas()).map((x) => x.token));
  assert.equal(usados.size, 6, `bots en uso: ${[...usados].join(', ')}`);
});

test('todos tienen destino; sin él el aviso no saldria', () => {
  for (const [dep, r] of Object.entries(rutas())) {
    assert.ok(r.chatId, `${dep} sin chat de destino`);
  }
});

test('el chat propio del departamento manda sobre el de reserva', () => {
  const r = HitlNotifier.fromEnv({ ...ENV, TELEGRAM_CHAT_CFO: '-100555' }).routes;
  assert.equal(r.finance.chatId, '-100555', 'finanzas deberia usar su grupo');
  assert.equal(r.treasury.chatId, '-100555', 'tesoreria comparte el del CFO');
  assert.equal(r.marketing.chatId, '999', 'marketing sigue en la reserva');
});
