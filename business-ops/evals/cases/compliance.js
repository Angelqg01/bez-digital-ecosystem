'use strict';

/**
 * Contrato del cribado KYC/AML (src/compliance/screening.js) — la primera
 * línea de defensa antes de que un humano apruebe una dispersión de BEZ-Coin.
 */
const { screen, LARGE_AMOUNT_USD, LARGE_AMOUNT_B2B_USD } = require('../../src/compliance/screening');
const { expect } = require('../world');

module.exports = {
  suite: 'compliance',
  description: 'cribado KYC/AML antes de una compra de BEZ-Coin',
  cases: [
    {
      name: 'operación normal, importe bajo, país sin riesgo → riesgo bajo, sin señales',
      async check() {
        const r = screen({ amountUsd: 100, walletAddress: '0xabc', customerEmail: 'c@x.com', country: 'España' });
        expect(r.riskLevel === 'bajo' && r.flags.length === 0, 'no debería marcar señales');
        expect(!r.requiresEnhancedReview, 'no debería requerir revisión reforzada');
      },
    },
    {
      name: `importe >= $${LARGE_AMOUNT_USD} → riesgo medio, señal de importe elevado`,
      async check() {
        const r = screen({ amountUsd: LARGE_AMOUNT_USD, walletAddress: '0xabc', customerEmail: 'c@x.com', country: 'España' });
        expect(r.riskLevel === 'medio', 'importe elevado debe subir el riesgo a medio');
        expect(r.flags.some((f) => f.includes('Importe elevado')), 'debe explicar la señal de importe');
      },
    },
    {
      name: 'país declarado de la lista de alto riesgo → riesgo alto, sin importar el importe',
      async check() {
        const r = screen({ amountUsd: 50, walletAddress: '0xabc', customerEmail: 'c@x.com', country: 'Irán' });
        expect(r.riskLevel === 'alto', 'país sancionado debe ser riesgo alto');
        expect(r.requiresEnhancedReview, 'riesgo alto siempre requiere revisión reforzada');
      },
    },
    {
      name: 'Rusia, Bielorrusia, Myanmar y Afganistán (con o sin tildes) → riesgo alto',
      async check() {
        for (const country of ['Rusia', 'Russia', 'Bielorrusia', 'Belarus', 'Myanmar', 'Birmania', 'Afganistán', 'Afghanistan']) {
          const r = screen({ amountUsd: 50, walletAddress: '0xabc', customerEmail: 'c@x.com', country });
          expect(r.riskLevel === 'alto', `${country} debe ser riesgo alto, salió ${r.riskLevel}`);
        }
      },
    },
    {
      name: 'el país se compara por palabra completa: "Miranda" no es "Irán"',
      async check() {
        const r = screen({ amountUsd: 50, walletAddress: '0xabc', customerEmail: 'c@x.com', country: 'Miranda de Ebro, España' });
        expect(r.riskLevel === 'bajo', 'un falso positivo por subcadena bloquearía operaciones legítimas');
      },
    },
    {
      name: `pago B2B de ${LARGE_AMOUNT_B2B_USD - 1}$ a país sin riesgo → bajo (no ruido); desde ${LARGE_AMOUNT_B2B_USD}$ → medio`,
      async check() {
        const base = { walletAddress: 'iban', customerEmail: 'ops@x.com', country: 'España', segment: 'b2b' };
        expect(screen({ ...base, amountUsd: LARGE_AMOUNT_B2B_USD - 1 }).riskLevel === 'bajo', 'un flete normal no debe marcarse');
        expect(screen({ ...base, amountUsd: LARGE_AMOUNT_B2B_USD }).riskLevel === 'medio', 'un importe muy alto sí debe revisarse');
      },
    },
    {
      name: 'segmento B2B: el país de alto riesgo sigue siendo alto aunque el importe sea pequeño',
      async check() {
        const r = screen({ amountUsd: 10, walletAddress: 'iban', customerEmail: 'ops@x.com', country: 'Rusia', segment: 'b2b' });
        expect(r.riskLevel === 'alto', 'el segmento no relaja la lista de países');
      },
    },
    {
      name: 'sin wallet ni email → señales de datos incompletos',
      async check() {
        const r = screen({ amountUsd: 50, walletAddress: '', customerEmail: '', country: 'España' });
        expect(r.flags.some((f) => f.includes('wallet')), 'debe señalar falta de wallet');
        expect(r.flags.some((f) => f.includes('email')), 'debe señalar falta de email verificable');
      },
    },
  ],
};
