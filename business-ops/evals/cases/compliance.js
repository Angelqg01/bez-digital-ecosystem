'use strict';

/**
 * Contrato del cribado KYC/AML (src/compliance/screening.js) — la primera
 * línea de defensa antes de que un humano apruebe una dispersión de BEZ-Coin.
 */
const { screen, LARGE_AMOUNT_USD } = require('../../src/compliance/screening');
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
      name: 'sin wallet ni email → señales de datos incompletos',
      async check() {
        const r = screen({ amountUsd: 50, walletAddress: '', customerEmail: '', country: 'España' });
        expect(r.flags.some((f) => f.includes('wallet')), 'debe señalar falta de wallet');
        expect(r.flags.some((f) => f.includes('email')), 'debe señalar falta de email verificable');
      },
    },
  ],
};
