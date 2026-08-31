'use strict';

/**
 * Contrato del reintento automático — el que evita que un fallo de red le
 * cueste un email duplicado a un cliente real.
 *
 * La regla es asimétrica a propósito: dudar cuesta un reintento manual;
 * equivocarse cuesta un envío duplicado a un cliente. Por eso todo lo que no
 * consta explícitamente como lectura se trata como algo con efecto.
 */
const Orchestrator = require('../../src/core/Orchestrator');
const { hasSideEffect } = require('../../src/cognition/toolCatalog');
const { expect } = require('../world');

/** Decisión de reintento sin montar un orquestador entero. */
function decide({ sideEffectPerformed = false, attempts = 1, error = 'ECONNRESET' }, maxAttempts = 3) {
  const o = Object.create(Orchestrator.prototype);
  o.retry = { maxAttempts, baseDelayMs: 1, maxDelayMs: 10 };
  return o._shouldRetry({ sideEffectPerformed, attempts }, new Error(error));
}

module.exports = {
  suite: 'retry',
  description: 'reintentos que nunca duplican un efecto ya ocurrido',
  cases: [
    {
      name: 'fallo transitorio sin efectos previos → se reintenta',
      async check() {
        expect(decide({ error: 'ECONNRESET' }).retry === true, 'un corte de red debe reintentarse');
      },
    },
    {
      name: 'la tarea ya envió algo → NO se reintenta, aunque el error sea transitorio',
      async check() {
        const d = decide({ sideEffectPerformed: true, error: 'ECONNRESET' });
        expect(d.retry === false, 'reintentar duplicaría el envío');
        expect(/efectos externos/.test(d.reason), 'debe explicar por qué no se reintenta');
      },
    },
    {
      name: 'error de configuración → no se reintenta (daría el mismo resultado)',
      async check() {
        expect(decide({ error: 'sin departamento: ventas' }).retry === false, 'error permanente');
        expect(decide({ error: 'herramienta no disponible: crm' }).retry === false, 'error permanente');
      },
    },
    {
      name: 'cuota agotada → no se reintenta (no es mala suerte, es el plan)',
      async check() {
        expect(decide({ error: 'Cuota mensual agotada (500/500 llamadas).' }).retry === false,
          'reintentar no devuelve cuota');
      },
    },
    {
      name: 'presupuesto de reintentos acotado: no reintenta para siempre',
      async check() {
        expect(decide({ attempts: 2 }, 3).retry === true, 'aún queda presupuesto');
        expect(decide({ attempts: 3 }, 3).retry === false, 'alcanzado el tope, para');
      },
    },
    {
      name: 'las lecturas no cuentan como efecto; enviar, escribir y cobrar sí',
      async check() {
        for (const [tool, method] of [['crm', 'listLeads'], ['bezhas-core', 'treasuryStats'], ['fs', 'read'], ['vectordb', 'search']]) {
          expect(hasSideEffect(tool, method) === false, `${tool}.${method} es solo lectura`);
        }
        for (const [tool, method] of [['email', 'send'], ['crm', 'upsertLead'], ['blockchain', 'transfer'], ['automation', 'trigger'], ['fs', 'remove']]) {
          expect(hasSideEffect(tool, method) === true, `${tool}.${method} deja huella fuera`);
        }
      },
    },
    {
      name: 'lo no clasificado se asume con efecto (el fallo cae del lado seguro)',
      async check() {
        expect(hasSideEffect('conector-que-nadie-clasifico', 'hazAlgo') === true,
          'un conector nuevo sin clasificar no debe volverse reintentable por olvido');
        expect(hasSideEffect('email', 'metodoNuevo') === true,
          'un método nuevo de un conector con efectos tampoco');
      },
    },
  ],
};
