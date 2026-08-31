'use strict';

/**
 * El saludo del correo va al PROSPECTO, nunca a quien firma.
 *
 * Regresión de un fallo real: el prompt cerraba con `Firma:\n<firma>` y nada
 * más. La firma es lo último que lee el modelo y lleva el nombre del CEO muy
 * visible, así que los modelos pequeños encabezaban con «Estimado Sr.
 * Hernández» — el correo se lo mandaban al remitente. Un primer contacto en
 * frío dirigido a la persona equivocada quema el lead aunque pase por HITL.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const OutreachAgent = require('../src/agents/sales/OutreachAgent');

const FIRMA = 'Yoel A. Hernández\nCEO & Founder | BeZhas';

function agente() {
  const a = new OutreachAgent({ tenantId: 'bezhas' });
  a.business = {
    signature: FIRMA,
    segmentOf: () => 'naviera',
    isExcluded: () => false,
    coldCopyRules: [],
  };
  a.guardrails = { evaluate: () => ({ allowed: true }) };
  // El agente pide el conector de email para encolar el envío; aquí solo se
  // comprueba el PROMPT, así que basta con que exista y no haga nada.
  a.tools = { email: { execute: async () => ({ sent: false, simulated: true }) } };
  a.doNotContact = { isListed: () => null };
  a.prompts = [];
  a.think = async (p) => { a.prompts.push(p); return 'Asunto: prueba\n\nEstimada Marta,\n\nCuerpo.\n\n' + FIRMA; };
  return a;
}

test('el prompt etiqueta destinatario y remitente por separado', async () => {
  const a = agente();
  await a.run({ payload: { lead: { company: 'Naviera Sur', contact: 'Marta Ruiz', role: 'Operaciones', email: 'm@x.com' }, cold: true } });
  const p = a.prompts[0];
  assert.match(p, /DESTINATARIO/, 'sin etiqueta de destinatario');
  assert.match(p, /REMITENTE/, 'sin etiqueta de remitente');
  assert.match(p, /Marta Ruiz/, 'el prospecto no aparece');
});

test('avisa explicitamente de que quien firma no es el destinatario', async () => {
  const a = agente();
  await a.run({ payload: { lead: { company: 'Naviera Sur', contact: 'Marta Ruiz', email: 'm@x.com' }, cold: true } });
  const p = a.prompts[0];
  assert.match(p, /NUNCA es el destinatario/i);
  assert.match(p, /no a quien firma/i, 'falta el recordatorio final');
});

test('el destinatario se repite DESPUES de la firma', async () => {
  // Lo último que lee el modelo pesa más: si la firma va al final, gana ella.
  const a = agente();
  await a.run({ payload: { lead: { company: 'Naviera Sur', contact: 'Marta Ruiz', email: 'm@x.com' }, cold: true } });
  const p = a.prompts[0];
  assert.ok(p.lastIndexOf('Marta Ruiz') > p.indexOf(FIRMA), 'la firma queda la ultima: volveria el fallo');
});

test('sin nombre de contacto, describe el cargo y no cae en la firma', async () => {
  const a = agente();
  await a.run({ payload: { lead: { company: 'Naviera Sur', role: 'Operaciones', email: 'm@x.com' }, cold: true } });
  const p = a.prompts[0];
  assert.match(p, /el responsable de Operaciones de Naviera Sur/);
  assert.ok(p.lastIndexOf('Naviera Sur') > p.indexOf(FIRMA));
});
