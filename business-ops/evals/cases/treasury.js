'use strict';

/**
 * Contrato del cálculo de runway (src/agents/treasury/runwayMath.js) — puro,
 * sin IA. Si esto falla, el aviso de "tesorería crítica" no es de fiar.
 */
const { calcRunway, isCritical, CRITICAL_RUNWAY_MONTHS, valueHoldings, calcRunwayFromHoldings } = require('../../src/agents/treasury/runwayMath');
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
    {
      name: 'multi-divisa: AED y EUR se valoran con su tipo de cambio, no como USD',
      async check() {
        const v = valueHoldings(
          [{ asset: 'USD', kind: 'fiat', amount: 1000 }, { asset: 'EUR', kind: 'fiat', amount: 1000 }, { asset: 'AED', kind: 'fiat', amount: 1000 }],
          { fx: { EUR: 1.1, AED: 0.2723 } });
        expect(v.totalUsd === Math.round(1000 + 1100 + 272.3), `total incorrecto: ${v.totalUsd}`);
      },
    },
    {
      name: 'depeg: USDC al 0,96 baja el valor y el runway (el número único en USD no lo veía)',
      async check() {
        const h = [{ asset: 'USDC', kind: 'stable', amount: 1000000 }];
        const ok = calcRunwayFromHoldings(h, 100000, { pegs: { USDC: 1 } });
        const depeg = calcRunwayFromHoldings(h, 100000, { pegs: { USDC: 0.96 } });
        expect(ok.runwayMonths === 10 && depeg.runwayMonths === 9.6, `runway ${ok.runwayMonths} → ${depeg.runwayMonths}`);
      },
    },
    {
      name: 'estrés: un shock hipotético del 4 % a las stablecoins reduce el runway sin tocar el fiat',
      async check() {
        const h = [{ asset: 'USDC', kind: 'stable', amount: 500000 }, { asset: 'USD', kind: 'fiat', amount: 500000 }];
        const r = calcRunwayFromHoldings(h, 100000, {}, { stableShock: 0.04 });
        expect(r.runwayMonths === 10 && r.stressedRunwayMonths === 9.8, `esperaba 10 → 9.8, obtuvo ${r.runwayMonths} → ${r.stressedRunwayMonths}`);
      },
    },
    {
      name: 'una posición sin precio no se inventa: se excluye y se avisa',
      async check() {
        const v = valueHoldings([{ asset: 'BEZ', kind: 'volatile', amount: 1e6 }, { asset: 'USD', kind: 'fiat', amount: 100 }], {});
        expect(v.totalUsd === 100 && v.warnings.some((w) => w.includes('BEZ')), 'BEZ sin precio no debe sumar ni callarse');
      },
    },
    {
      name: 'concentración: >40 % en una sola stablecoin genera aviso',
      async check() {
        const v = valueHoldings([{ asset: 'USDT', kind: 'stable', amount: 700 }, { asset: 'USD', kind: 'fiat', amount: 300 }], {});
        expect(v.warnings.some((w) => w.includes('USDT')), 'debe avisar de la concentración en USDT');
      },
    },
  ],
};
