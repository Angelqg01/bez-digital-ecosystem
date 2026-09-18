'use strict';
const BaseAgent = require('../BaseAgent');
const { screen } = require('../../compliance/screening');

/**
 * TokenDisbursementAgent — convierte un pago de Stripe ya confirmado en la
 * cantidad correspondiente de BEZ-Coin y solicita su envío.
 *
 * Antes de pedir la transferencia, corre el cribado KYC/AML (screening.js —
 * el mismo que usa blockchain.compliance-check) y adjunta las señales al
 * humano que aprueba: importe elevado, país de riesgo, datos incompletos.
 *
 * NUNCA transfiere por su cuenta: `blockchain.transfer` es categoría
 * `crypto_transfer`, que cruza la línea roja `crypto_asset_movement` en
 * RedLines.js → siempre pasa por HITL (aprobación humana vía Telegram/panel)
 * antes de ejecutarse de verdad.
 */
class TokenDisbursementAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'finance.token-disbursement',
      name: 'Token Disbursement Agent',
      department: 'finance',
      modelTier: 'fast',
      capabilities: ['finance:token-purchase'],
      systemPrompt:
        'Calculas cuántos BEZ-Coin corresponden a un pago ya confirmado por Stripe, al precio semilla vigente, ' +
        'y preparas la transferencia para aprobación humana. Nunca confirmas ni ejecutas el envío por tu cuenta.',
    });
  }

  async run(task) {
    const { amountUsd, walletAddress, customerEmail, sessionId, seedPriceUsd } = task.payload || {};

    if (!walletAddress) {
      return {
        status: 'blocked',
        reason: 'Sin wallet Polygon del comprador: no se puede preparar la transferencia.',
        customerEmail, sessionId,
      };
    }
    if (!amountUsd || Number(amountUsd) <= 0) {
      return { status: 'blocked', reason: 'Importe de pago inválido o ausente.', customerEmail, sessionId };
    }

    // El precio sale de la configuración, NUNCA del payload de la tarea: lo que
    // llega en el payload lo escribe quien encola la tarea (un webhook, otro
    // agente), y un precio diez veces menor son diez veces más tokens. Si el
    // payload trae uno distinto se avisa al humano que aprueba, pero no se usa.
    const price = Number(process.env.BEZ_SEED_PRICE_USD || 0.0075);
    const tokens = Math.floor((Number(amountUsd) / price) * 1e6) / 1e6; // 6 decimales de precisión

    const compliance = screen({ amountUsd, walletAddress, customerEmail, country: task.payload?.country });
    if (seedPriceUsd !== undefined && Number(seedPriceUsd) !== price) {
      compliance.flags.push(`El payload proponía un precio de ${seedPriceUsd} USD; se ignora y se usa ${price} USD.`);
    }
    const { customerName, country } = task.payload || {};

    // Siempre cruza la línea roja crypto_asset_movement → espera al humano.
    const transfer = await this.act({
      category: 'crypto_transfer',
      tool: 'blockchain',
      method: 'transfer',
      args: {
        to: walletAddress,
        amount: tokens,
        reference: sessionId || undefined,
        // Travel rule: sin nombre y país del comprador, BeZhas deniega la
        // intención (TRAVEL_RULE_DATA_MISSING) y el humano lo ve en la bandeja.
        counterparty: customerName && /^[A-Z]{2}$/.test(String(country || '')) ? { legalName: customerName, country } : undefined,
      },
      flags: compliance.flags,
      meta: { customerEmail, sessionId, amountUsd, seedPriceUsd: price, complianceRisk: compliance.riskLevel },
    });

    return { tokens, walletAddress, amountUsd, seedPriceUsd: price, customerEmail, sessionId, compliance, transfer, status: 'ok' };
  }
}
module.exports = TokenDisbursementAgent;
