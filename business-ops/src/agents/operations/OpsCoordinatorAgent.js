'use strict';

const BaseAgent = require('../BaseAgent');

/**
 * Ops Coordinator — atiende solicitudes operativas generales y coordina.
 *
 * Piloto de tool-use: usa el bucle agéntico (thinkAndAct), así que el modelo
 * puede consultar métricas del sistema (sysmon), agenda (calendar) y archivos
 * (fs/storage) él solo. Cada invocación pasa por PolicyEngine/HITL; en modo
 * simulado el modelo no pide herramientas y responde texto, como antes.
 */
class OpsCoordinatorAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'operations.coordinator',
      name: 'Ops Coordinator',
      department: 'operations',
      modelTier: 'mid',
      capabilities: ['operations:request'],
      systemPrompt: 'Coordinas operaciones: priorizas, propones el siguiente paso y señalas bloqueos. ' +
        'Práctico y concreto. Si la solicitud requiere datos reales (métricas, agenda, archivos), ' +
        'usa las herramientas disponibles en vez de suponer.',
    });
  }

  async run(task) {
    const out = await this.thinkAndAct(`Solicitud operativa: "${task.payload?.text || ''}"`, {
      only: ['sysmon', 'calendar', 'fs', 'storage'],
      maxTurns: 4,
    });
    return { answer: out.text, actions: out.actions, status: 'ok' };
  }
}

module.exports = OpsCoordinatorAgent;
