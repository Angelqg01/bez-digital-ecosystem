'use strict';

const DepartmentManager = require('../DepartmentManager');
const humanHandoff = require('../../platform/humanHandoff');
const TriageAgent = require('./TriageAgent');
const KnowledgeBaseAgent = require('./KnowledgeBaseAgent');
const ResolverAgent = require('./ResolverAgent');
const EscalationAgent = require('./EscalationAgent');
const TicketTriageAgent = require('./TicketTriageAgent');
const SupportChatAgent = require('./SupportChatAgent');
const SentimentAgent = require('./SentimentAgent');
const MacroSuggesterAgent = require('./MacroSuggesterAgent');

/**
 * SupportManager — atención al cliente 24/7.
 *
 * Orquesta un pipeline (no un enrutado en paralelo): clasifica → busca en la
 * base de conocimiento → redacta y decide → escala al humano si hace falta.
 */
class SupportManager extends DepartmentManager {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'support.manager',
      name: 'Support Manager',
      department: 'support',
      modelTier: ctx.modelTier || 'mid',
      systemPrompt: 'Eres el director de Atención al Cliente. Resuelves o enrutas cada consulta y escalas al humano lo irreversible.',
    });

    const childCtx = { ...ctx, department: 'support' };
    this.registerSpecialist(new TriageAgent(childCtx));
    this.registerSpecialist(new KnowledgeBaseAgent(childCtx));
    this.registerSpecialist(new ResolverAgent(childCtx));
    this.registerSpecialist(new EscalationAgent(childCtx));
    this.registerSpecialist(new TicketTriageAgent(childCtx));
    this.registerSpecialist(new SupportChatAgent(childCtx));
    this.registerSpecialist(new SentimentAgent(childCtx));
    this.registerSpecialist(new MacroSuggesterAgent(childCtx));
  }

  async run(task) {
    // Triage y sentimiento solo dependen del texto de entrada: encadenarlos
    // duplicaba la latencia (dos llamadas al modelo en serie) sin motivo.
    const [triage, sentiment] = await Promise.all([
      this.getSpecialist('support.ticket-triage').run(task),
      this.getSpecialist('support.sentiment').run(task),
    ]);

    const chat = await this.getSpecialist('support.chat-agent').run(withPayload(task, { triage, sentiment }));

    // El sentimiento es motivo de escalado por sí mismo: un cliente que
    // amenaza con darse de baja o con un abogado necesita una persona aunque
    // el triage lo haya clasificado como consulta rutinaria y la KB tenga
    // respuesta. Ahí el problema ya no es la duda técnica.
    // Pedir una persona no se negocia con el modelo. El perfil de negocio
    // promete "te paso con alguien del equipo"; si esa promesa dependiera de
    // que un modelo pequeño decida escalar, el cliente se quedaría esperando a
    // quien nunca fue avisado. Ver platform/humanHandoff.js.
    const handoff = humanHandoff.detect(task.payload?.text || task.text || '');
    const escalate = handoff.handoff || triage.requiresEscalation || !chat.grounded || sentiment.requiresHuman;
    const resolution = {
      escalate,
      reply: chat.reply,
      reason: escalate
        ? `escala por: ${[
          handoff.reason,
          triage.requiresEscalation && 'urgente o crítico',
          !chat.grounded && 'sin base de conocimiento',
          sentiment.requiresHuman && `riesgo de cliente (${sentiment.severity}${sentiment.signals.length ? ': ' + sentiment.signals.join(', ') : ''})`,
        ].filter(Boolean).join(', ')}`
        : 'resuelto con la base de conocimiento',
      status: 'ok'
    };

    // Al escalar, la persona recibía solo un resumen y redactaba desde cero.
    // El resumen (para entender) y el borrador (para responder) son
    // independientes, así que se preparan a la vez.
    let escalation = null;
    let suggestion = null;
    if (escalate) {
      [escalation, suggestion] = await Promise.all([
        this.getSpecialist('support.escalation').run(withPayload(task, { triage, resolution, sentiment })),
        this.getSpecialist('support.macro-suggester').run(withPayload(task, { triage, sentiment, kbHits: chat.hits })),
      ]);
    }

    const outcome = escalate ? 'escalated' : 'ok';
    const summary = `support: ${triage.category}/${triage.priority}`
      + `${sentiment.severity !== 'none' ? `/${sentiment.severity}` : ''}`
      + ` → ${escalate ? 'escalado' : 'resuelto'}`;
    await this.remember({ task: 'support:ticket', summary, outcome });

    return { 
      department: 'support', 
      triage: {
        category: triage.category,
        priority: triage.priority,
        sentiment: triage.sentiment,
        note: triage.note,
        status: triage.status
      }, 
      kb: {
        grounded: chat.grounded,
        hits: chat.hits
      },
      sentiment: {
        label: sentiment.label,
        polarity: sentiment.polarity,
        severity: sentiment.severity,
        signals: sentiment.signals,
        summary: sentiment.summary,
      },
      resolution,
      escalation,
      // Borrador para el humano. `null` si no se escaló: sugerir una respuesta
      // a un ticket que se resolvió solo no le sirve a nadie.
      suggestion,
      summary,
      outcome
    };
  }
}

/** Devuelve una copia de la tarea con campos extra en el payload. */
function withPayload(task, extra) {
  return { ...task, payload: { ...task.payload, ...extra } };
}

module.exports = SupportManager;
