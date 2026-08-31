'use strict';

const BaseAgent = require('../BaseAgent');
const gas = require('../../platform/gasOptimizer');

/**
 * GasOptimizerAgent — dice si conviene ejecutar una transacción ahora o
 * esperar a que baje el gas, comparando el precio real contra un umbral del
 * tenant (`thresholdGwei`), nunca inventado por el modelo.
 *
 * Cuánto está dispuesto a pagar el tenant por ir rápido es una decisión de
 * negocio, no una que un LLM deba tomar leyendo un número de gwei — por eso
 * sin `thresholdGwei` configurado el agente se niega a recomendar nada.
 */
class GasOptimizerAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'blockchain.gas-optimizer',
      name: 'Gas Optimizer',
      department: 'blockchain',
      modelTier: 'fast',
      capabilities: ['blockchain:gas'],
      systemPrompt: 'Recibes la recomendación de gas YA CALCULADA (ejecutar ahora o esperar). Redáctala en una frase, sin cambiar la recomendación.',
    });
  }

  async run(task) {
    const p = task.payload || {};
    const core = this.tools['bezhas-core'];

    let currentGwei = p.currentGwei;
    if (currentGwei == null && core) {
      const status = await core.execute('gasStatus');
      currentGwei = status.gasPriceGwei;
      if (status.simulated) {
        return { status: 'blocked', reason: 'bezhas-core no disponible: no se recomienda sobre un precio de gas simulado' };
      }
    }
    if (currentGwei == null) {
      return { status: 'blocked', reason: 'sin currentGwei (ni por payload ni por conector)' };
    }
    if (p.thresholdGwei == null) {
      return { status: 'blocked', reason: 'sin thresholdGwei configurado: cuánto pagar por ir rápido es una decisión de negocio, no se inventa' };
    }

    const result = gas.evaluate(currentGwei, p.thresholdGwei, p.historyGwei || []);
    const note = await this.think(
      `Recomendación ya calculada: ${result.recommendation === 'execute_now' ? 'ejecutar ahora' : 'esperar'} `
      + `(actual ${result.currentGwei} gwei, umbral ${result.thresholdGwei} gwei). Redáctalo en una frase.`,
      { useMemory: false, maxTokens: 100 },
    );

    return { status: 'ok', ...result, note };
  }
}

module.exports = GasOptimizerAgent;
