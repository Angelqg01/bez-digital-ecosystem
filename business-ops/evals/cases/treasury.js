'use strict';

/**
 * Contrato del cálculo de runway (src/agents/treasury/runwayMath.js) — puro,
 * sin IA. Si esto falla, el aviso de "tesorería crítica" no es de fiar.
 */
const { calcRunway, isCritical, CRITICAL_RUNWAY_MONTHS } = require('../../src/agents/treasury/runwayMath');
const { expect } = require('../world');

module.exports = {
  suite: 'treasury',
  description: 'cálculo de runway del Treasury DAO',
  cases: [
    {
      name: 'balance/gasto mensual → runway correcto en meses',
      async check() {
        expect(calcRunway(10000, 2000) === 5, 'runway debe ser 5 meses');
      },
    },
    {
      name: 'gasto mensual 0 o ausente → runway desconocido (null), no división por cero',
      async check() {
        expect(calcRunway(10000, 0) === null, 'runway debe ser null con burn 0');
        expect(calcRunway(10000, undefined) === null, 'runway debe ser null con burn ausente');
      },
    },
    {
      name: `runway por debajo de ${CRITICAL_RUNWAY_MONTHS} meses con dato real → crítico`,
      async check() {
        expect(isCritical(2, false) === true, 'runway bajo con dato real debe ser crítico');
      },
    },
    {
      name: 'runway bajo pero con dato SIMULADO (stack caído) → no marca crítico (dato no fiable)',
      async check() {
        expect(isCritical(1, true) === false, 'un dato simulado no debe disparar una alerta real de tesorería');
      },
    },
    {
      name: 'runway saludable → no crítico',
      async check() {
        expect(isCritical(12, false) === false, 'runway saludable no debe marcar crítico');
      },
    },
  ],
};
