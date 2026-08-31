'use strict';
const BaseAgent = require('../BaseAgent');
const redaction = require('../../platform/candidateRedaction');

/**
 * RecruiterScreenAgent — realiza la criba inicial de candidatos evaluando su CV
 * frente a los requisitos del puesto. Si se requiere una decisión de empleo,
 * la acción pasa por guardrails de línea roja (HITL).
 *
 * El nombre del candidato NUNCA llega al modelo (`platform/candidateRedaction.js`):
 * antes se interpolaba directo en el prompt ("Nombre: Fatima Al-Rashid"), dándole
 * al modelo el proxy de discriminación más directo que existe para una decisión
 * de contratación. La decisión de empleo (si la hay) sigue identificando al
 * candidato con su nombre real — eso lo ve y lo decide un humano, no el modelo.
 */
class RecruiterScreenAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'hr.recruiter-screen',
      name: 'Recruiter Screen',
      department: 'hr',
      modelTier: 'fast',
      capabilities: ['hr:screen'],
      systemPrompt: 'Eres un reclutador experto y objetivo. Analizas currículums y perfiles de candidatos comparándolos con los requisitos de la vacante, proporcionando fortalezas, debilidades y una puntuación cualitativa.',
    });
  }

  async run(task) {
    const { candidate = {}, jobProfile = 'Desarrollador Software' } = task.payload || {};
    let resumeText = candidate.resumeText || '';

    if (candidate.pdfPath && this.tools.fs) {
      try {
        resumeText = await this.tools.fs.execute('read', { path: candidate.pdfPath });
      } catch (err) {
        resumeText = `Error leyendo PDF: ${err.message}`;
      }
    }

    const { safeCandidate, removed } = redaction.redact({ ...candidate, resumeText });

    const evaluation = await this.think(
      `Evalúa este currículum/perfil de candidato (sin datos personales) para el puesto de "${jobProfile}".\n\n` +
      `DETALLES/CV:\n${safeCandidate.resumeText || JSON.stringify(safeCandidate)}\n\n` +
      `Instrucciones: Analiza detalladamente la experiencia. Asigna un score de coincidencia (0-100) y una calificación cualitativa (Excelente, Fuerte, Medio, Bajo).`,
      { useMemory: false }
    );

    let decisionResult = null;
    if (task.payload?.decision) {
      decisionResult = await this.act({
        category: 'employment',
        method: task.payload.decision,
        args: { candidateName: candidate.name, jobProfile }
      });
    }

    return {
      evaluation,
      redactedFields: removed,
      decision: decisionResult,
      status: 'ok',
    };
  }
}

module.exports = RecruiterScreenAgent;
