'use strict';

/**
 * "Te paso con una persona" tiene que ser verdad.
 *
 * El perfil de negocio le dice al agente que se presente como asesor y que
 * derive a un humano en cuanto el cliente pregunte con quién habla o pida
 * hablar con alguien. Comprobado en vivo, el modelo local cumplía la primera
 * mitad (escribía "un agente humano responderá") y no la segunda
 * (`escalate: false`): el cliente se quedaba esperando a quien nunca fue
 * avisado. Por eso la decisión es determinista y no del modelo.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { detect } = require('../src/platform/humanHandoff');

test('Pedir una persona siempre deriva', () => {
  const frases = [
    'Quiero hablar con una persona',
    '¿Me pasas con un agente?',
    'Prefiero que me atienda una persona, por favor',
    'Páseme con un responsable',          // usted: lo normal en B2B español
    '¿Puede pasarme con un comercial?',
    'quiero hablar con alguien del equipo comercial',
  ];
  for (const f of frases) {
    assert.equal(detect(f).handoff, true, `debería derivar: "${f}"`);
  }
});

test('Preguntar con quién se habla también deriva', () => {
  const frases = [
    '¿Estoy hablando con una persona o con un bot?',
    '¿eres un bot?',
    '¿Eres una IA?',
    'Perdona, ¿eres una persona real?',
    '¿Con quién hablo?',
    '¿Esto es automático?',
  ];
  for (const f of frases) {
    assert.equal(detect(f).handoff, true, `debería derivar: "${f}"`);
  }
});

test('El motivo dice cuál de los dos casos es', () => {
  assert.match(detect('quiero hablar con una persona').reason, /pide hablar con una persona/);
  assert.match(detect('¿eres un bot?').reason, /pregunta con quién habla/);
});

test('Una consulta normal no dispara el traspaso', () => {
  const frases = [
    'No consigo entrar en la plataforma, olvidé mis credenciales',
    'Necesito la factura de marzo',
    '¿Cuánto cuesta el piloto de 14 días?',
    'La entrega llegó con la cadena de frío rota y quiero reclamar',
    'Somos una persona jurídica con sede en Vigo',   // "persona" sin pedir humano
    '',
  ];
  for (const f of frases) {
    assert.equal(detect(f).handoff, false, `no debería derivar: "${f}"`);
  }
});
