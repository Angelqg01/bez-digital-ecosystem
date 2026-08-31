'use strict';

const BaseAgent = require('../BaseAgent');
const lexicon = require('../../platform/sentimentLexicon');
const calibration = require('../../platform/sentimentCalibration');

/**
 * SentimentAgent — mide el estado emocional del cliente MIENTRAS el ticket
 * está vivo, que es cuando todavía se puede hacer algo.
 *
 * Por qué no basta con el CSAT (`platform/csat.js`): el CSAT llega después de
 * cerrar y solo lo contesta una minoría. Es la verdad, pero es tarde y parcial.
 * Esta señal llega con el primer mensaje y cubre el 100 % de los tickets.
 *
 * **Híbrido y asimétrico.** El léxico determinista fija un SUELO de gravedad y
 * el modelo solo puede subirlo:
 *   - Si el modelo está degradado a simulado (proveedor caído), una amenaza
 *     legal se sigue detectando: es justo cuando más caro sale no verla.
 *   - Un modelo que "se relaja" no puede rebajar una baja o una amenaza legal
 *     ya detectadas por texto explícito.
 * El modelo aporta lo que el léxico no ve: ironía, frustración educada y
 * contexto ("entiendo que estéis liados, pero llevo un mes esperando").
 *
 * Salida pensada para decidir, no para adornar: gravedad, señales concretas y
 * la evidencia textual que las disparó (auditable por una persona).
 */

/** Gravedad a partir de la cual se avisa a una persona de inmediato. */
const ALERT_FROM = 'high';

class SentimentAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'support.sentiment',
      name: 'Sentiment',
      department: 'support',
      modelTier: 'fast',           // alto volumen: un mensaje por ticket
      capabilities: ['support:sentiment'],
      systemPrompt:
        'Analizas el estado emocional de un cliente en un mensaje de soporte. ' +
        'Respondes SOLO con una línea con este formato exacto:\n' +
        'GRAVEDAD=<none|elevated|high|critical>; RESUMEN=<una frase breve>\n' +
        'Sube la gravedad si detectas ironía, frustración contenida, agotamiento ' +
        'o una amenaza implícita que no esté escrita de forma literal.',
    });
    this.alertFrom = ctx.sentimentAlertFrom || ALERT_FROM;
  }

  async run(task) {
    const text = task.payload?.text || task.payload?.message || '';
    if (!String(text).trim()) {
      return {
        polarity: 0, label: 'neutral', severity: 'none',
        signals: [], evidence: {}, summary: 'Sin texto que analizar.',
        modelUsed: false, status: 'ok',
      };
    }

    // 1. Capa determinista: suelo de gravedad, siempre disponible.
    const base = lexicon.analyze(text);

    // 2. Capa de modelo: solo puede AGRAVAR. Si falla, seguimos con el suelo:
    //    quedarnos sin análisis por un timeout sería peor que un análisis
    //    parcial, sobre todo si el mensaje traía una amenaza explícita.
    let severity = base.minSeverity;
    let summary = null;
    let modelUsed = false;

    try {
      const out = await this.think(
        `Mensaje del cliente (canal ${task.payload?.channel || 'web'}):\n"${String(text).slice(0, 2000)}"\n\n` +
        `Análisis literal previo: polaridad ${base.polarity}, señales [${base.signals.join(', ') || 'ninguna'}].`,
        { useMemory: false, maxTokens: 150 },
      );
      const parsed = SentimentAgent.parseModelOutput(out);
      if (parsed.severity) {
        // Asimetría deliberada: el modelo agrava, nunca rebaja.
        severity = lexicon.maxSeverity(base.minSeverity, parsed.severity);
        modelUsed = true;
      }
      summary = parsed.summary || null;
    } catch (err) {
      // El sentimiento es una señal de apoyo: que falle no puede tumbar el ticket.
      console.warn(`[sentiment:${this.tenantId}] modelo no disponible (${err.message}); uso solo el léxico`);
    }

    const result = {
      polarity: base.polarity,
      label: base.label,
      severity,
      signals: base.signals,
      evidence: base.evidence,
      summary: summary || SentimentAgent.fallbackSummary(base),
      requiresHuman: this._atLeastAlert(severity),
      modelUsed,
      status: 'ok',
    };

    // 3. Deja constancia de la predicción para poder contrastarla luego con el
    //    CSAT del mismo ticket. Sin esto, el agente nunca sería verificable.
    if (task.id && this.store) {
      await calibration.recordPrediction({
        store: this.store, tenantId: this.tenantId,
        taskId: task.id, severity, signals: base.signals,
      }).catch(() => { /* calibrar es opcional; nunca puede romper el ticket */ });
    }

    // 4. Aviso proactivo. Solo lo grave: si esto suena en cada ticket, deja de
    //    mirarse y entonces ya no protege de nada.
    if (result.requiresHuman) {
      this.bus?.emit('support:sentiment_alert', {
        tenantId: this.tenantId,
        taskId: task.id || null,
        severity,
        label: base.label,
        signals: base.signals,
        evidence: base.evidence,
        summary: result.summary,
        excerpt: String(text).slice(0, 200),
      });
    }

    return result;
  }

  _atLeastAlert(severity) {
    return lexicon.maxSeverity(severity, this.alertFrom) === severity;
  }

  /** Extrae `GRAVEDAD=` y `RESUMEN=` de la salida del modelo (tolerante). */
  static parseModelOutput(text) {
    const raw = String(text || '');
    const sev = raw.match(/GRAVEDAD\s*=\s*(none|elevated|high|critical)/i);
    const sum = raw.match(/RESUMEN\s*=\s*(.+)/i);
    return {
      severity: sev ? sev[1].toLowerCase() : null,
      summary: sum ? sum[1].trim().replace(/\s+/g, ' ').slice(0, 300) : null,
    };
  }

  /** Resumen legible cuando el modelo no contestó (o vino degradado). */
  static fallbackSummary(base) {
    if (base.signals.length) {
      const nombres = {
        churn_intent: 'intención de darse de baja',
        legal_threat: 'amenaza legal',
        reputational_threat: 'amenaza de reseña pública',
        repeat_contact: 'contacto reiterado sin respuesta',
      };
      return `Detectado: ${base.signals.map((s) => nombres[s] || s).join(', ')}.`;
    }
    const etiquetas = {
      furious: 'Cliente muy enfadado.',
      negative: 'Cliente descontento.',
      neutral: 'Tono neutro.',
      positive: 'Cliente satisfecho.',
    };
    return etiquetas[base.label] || 'Sin señal destacable.';
  }
}

SentimentAgent.ALERT_FROM = ALERT_FROM;
module.exports = SentimentAgent;
