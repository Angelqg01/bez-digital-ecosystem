'use strict';
const BaseAgent = require('../BaseAgent');
const { screen } = require('../../compliance/screening');

/**
 * ComplianceCheckAgent — cribado KYC/AML de una operación (compra de BEZ-Coin
 * u otra transferencia) antes de que un humano decida en HITL. Solo evalúa
 * y narra el riesgo: nunca aprueba, bloquea ni ejecuta nada por su cuenta.
 */
class ComplianceCheckAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'blockchain.compliance-check',
      name: 'Compliance Check',
      department: 'blockchain',
      modelTier: 'fast',
      capabilities: ['blockchain:compliance-check'],
      systemPrompt:
        'Eres el analista de cumplimiento (KYC/AML) de BeZhas. Evalúas el riesgo de una operación con datos objetivos, ' +
        'sin exagerar ni restar importancia. Nunca apruebas ni rechazas: solo informas al humano que decide.',
    });
  }

  async run(task) {
    const { amountUsd, walletAddress, customerEmail, country } = task.payload || {};
    const result = screen({ amountUsd, walletAddress, customerEmail, country });

    const narrative = await this.think(
      `Evalúa en 2-3 frases el riesgo de cumplimiento de esta operación de compra de BEZ-Coin. ` +
      `Importe: $${amountUsd || 0}. País declarado: ${country || 'no informado'}. ` +
      `Wallet destino: ${walletAddress || 'no informada'}. Nivel de riesgo calculado: ${result.riskLevel}. ` +
      `Señales: ${result.flags.join('; ') || 'ninguna'}.`,
      { useMemory: false, maxTokens: 300 },
    );

    return { ...result, narrative, status: 'ok' };
  }
}
module.exports = ComplianceCheckAgent;
