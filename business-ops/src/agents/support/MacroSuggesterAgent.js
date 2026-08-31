'use strict';

const BaseAgent = require('../BaseAgent');
const macros = require('../../platform/macros');
const draftGuard = require('../../platform/draftGuard');

/**
 * MacroSuggesterAgent — le da al humano una respuesta lista para enviar cuando
 * un ticket se escala.
 *
 * Hasta ahora, al escalar, la persona recibía un resumen del caso
 * (`EscalationAgent`) y tenía que redactar desde cero. Esto le pone delante un
 * borrador, y el tiempo de respuesta es justo lo que mide el cliente.
 *
 * Orden de preferencia, de más seguro a menos:
 *
 *   1. **Amenaza legal → acuse de recibo, y punto.** No se redacta respuesta de
 *      fondo. Contestar al fondo de una reclamación legal sin que lo vea Legal
 *      es el error caro; un acuse neutro no cierra ninguna puerta.
 *   2. **Macro guardada que encaje.** Texto que el equipo ya aprobó: dice
 *      siempre lo mismo y no puede inventarse una política inexistente.
 *   3. **Borrador generado**, solo si hay base de conocimiento. Sin ella, el
 *      modelo rellenaría huecos inventando, que en soporte es peor que callar.
 *
 * Todo lo generado pasa por `draftGuard`, que marca (no censura) promesas de
 * dinero, admisiones de culpa, plazos y garantías absolutas. Se revisa la
 * SALIDA porque pedirlo en el prompt funciona "casi siempre", y eso no basta
 * cuando quien pulsa enviar no puede deshacerlo.
 *
 * Este agente NUNCA envía: devuelve un borrador. El envío es del humano.
 */
class MacroSuggesterAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'support.macro-suggester',
      name: 'Macro Suggester',
      department: 'support',
      modelTier: 'mid',
      capabilities: ['support:suggest-reply'],
      systemPrompt:
        'Redactas un borrador de respuesta de soporte para que lo revise y envíe una persona. ' +
        'Reglas: apóyate SOLO en el conocimiento aportado; si falta información, dilo en vez de ' +
        'inventarla. No admitas culpa de la empresa, no prometas reembolsos ni compensaciones, ' +
        'no des plazos concretos y no garantices que algo no volverá a pasar. ' +
        'Tono profesional y cercano, en el idioma del cliente. Devuelve solo el texto del mensaje.',
    });
  }

  async run(task) {
    const p = task.payload || {};
    const text = p.text || '';
    const sentiment = p.sentiment || {};
    const triage = p.triage || {};
    const signals = sentiment.signals || [];
    const contact = p.contactName || null;

    // 1. Amenaza legal: acuse de recibo y a Legal. Sin modelo de por medio.
    if (signals.includes('legal_threat')) {
      return {
        source: 'legal_hold',
        draft: draftGuard.acknowledgementTemplate({ contact }),
        macro: null,
        grounded: true,
        warnings: [],
        requiresLegalReview: true,
        note: 'El cliente menciona acciones legales. Solo se propone un acuse de recibo: '
          + 'la respuesta de fondo debe redactarla o validarla Legal.',
        status: 'ok',
      };
    }

    const ctx = { text, category: triage.category || null, signals };

    // 2. Macro guardada que encaje.
    const guardadas = this.store ? await macros.list({ store: this.store, tenantId: this.tenantId }) : [];
    const match = macros.bestMatch(guardadas, ctx);
    if (match) {
      return {
        source: 'macro',
        draft: match.macro.body,
        macro: { id: match.macro.id, title: match.macro.title, score: match.score },
        grounded: true,      // ya la aprobó una persona
        warnings: [],
        requiresLegalReview: false,
        note: `Macro "${match.macro.title}" (encaje ${match.score}).`,
        status: 'ok',
      };
    }

    // 3. Borrador generado — solo con base de conocimiento.
    const hits = p.kbHits || [];
    if (!hits.length) {
      return {
        source: 'none',
        draft: null,
        macro: null,
        grounded: false,
        warnings: [],
        requiresLegalReview: false,
        note: 'Sin macro que encaje ni artículos de conocimiento: no se propone borrador '
          + 'para no inventar una respuesta. Conviene redactarla a mano y guardarla como macro.',
        status: 'ok',
      };
    }

    const conocimiento = hits.map((h, i) => `[${i + 1}] ${h.title}: ${h.snippet || ''}`).join('\n');
    let draft;
    try {
      draft = await this.think(
        `Consulta del cliente: "${String(text).slice(0, 1500)}"\n\n`
        + `Estado emocional detectado: ${sentiment.label || 'neutro'} (gravedad ${sentiment.severity || 'none'}).\n`
        + `${signals.length ? `Señales: ${signals.join(', ')}.\n` : ''}`
        + `\nCONOCIMIENTO DISPONIBLE:\n${conocimiento}\n\n`
        + `Redacta el borrador de respuesta${contact ? ` para ${contact}` : ''}.`,
        { useMemory: false, maxTokens: 500 },
      );
    } catch (err) {
      // Sugerir es una ayuda: si falla, el humano sigue teniendo el resumen
      // del EscalationAgent. Romper el ticket por esto sería absurdo.
      return {
        source: 'none', draft: null, macro: null, grounded: false, warnings: [],
        requiresLegalReview: false,
        note: `No se pudo generar el borrador (${err.message}).`,
        status: 'ok',
      };
    }

    // 4. Revisión del borrador generado.
    const revision = draftGuard.review(draft);

    return {
      source: 'generated',
      draft,
      macro: null,
      grounded: true,
      warnings: revision.findings,
      requiresLegalReview: false,
      note: revision.safe
        ? 'Borrador generado a partir de la base de conocimiento. Revísalo antes de enviar.'
        : `Borrador con ${revision.findings.length} punto(s) a revisar antes de enviar: `
          + revision.findings.map((f) => f.label.toLowerCase()).join('; ') + '.',
      status: 'ok',
    };
  }
}

module.exports = MacroSuggesterAgent;
