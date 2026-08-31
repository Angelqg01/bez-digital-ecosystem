'use strict';

/**
 * humanHandoff — detecta que el cliente quiere hablar con una persona.
 *
 * Existe porque una regla en el prompt es una sugerencia, no una garantía. El
 * perfil de negocio dice "si el cliente pregunta con quién habla, dile que le
 * pasas con una persona y deriva a un humano", y el modelo lo cumplió a
 * medias: escribió que "un agente humano responderá" y devolvió
 * `escalate: false`. Prometer un traspaso que no ocurre es peor que no
 * prometerlo — el cliente se queda esperando a alguien que nunca fue avisado.
 *
 * Así que la decisión no se le deja al modelo: es una función pura sobre el
 * texto, determinista y probable exhaustivamente. Con un modelo local pequeño
 * esto no es un detalle, es la diferencia entre cumplir la promesa y no.
 *
 * Deliberadamente conservador: ante la duda, escala. Escalar de más cuesta un
 * minuto de una persona; escalar de menos deja a un cliente hablando solo con
 * una máquina después de haber pedido explícitamente que no.
 */

/** Pide hablar con una persona, de forma directa o indirecta. */
const PIDE_HUMANO = [
  /\bhablar (?:con|contigo)?\s*(?:una|un)?\s*(?:persona|humano|agente|comercial|responsable)\b/i,
  // Formas de "pasar" en tú y en usted: me pasas, pásame, páseme, pasadme,
  // puede pasarme… El trato de usted es lo normal en el B2B español, y
  // dejarlo fuera sería no derivar justo al cliente más formal.
  /\b(?:me\s+pas[ao]s?|p[áa]s(?:a|e|ad)me|pued[ae]s?\s+pasarme|quiero\s+hablar)\b[^.?!]{0,30}\b(?:persona|humano|agente|alguien|responsable|comercial)\b/i,
  /\b(?:atienda|atender|hable)\s+(?:me\s+)?(?:una|un)\s+(?:persona|humano)\b/i,
  /\bquiero\s+(?:una|un)\s+(?:persona|humano)\b/i,
];

/** Pregunta si al otro lado hay una máquina. */
const PREGUNTA_IDENTIDAD = [
  /\b(?:eres|es|estoy hablando con|hablo con)\b[^.?!]{0,25}\b(?:un\s+)?(?:bot|robot|ia\b|inteligencia artificial|chatbot|m[áa]quina|automatizad[oa])/i,
  /\b(?:eres|sois)\s+(?:una\s+)?persona(?:\s+real)?\b/i,
  /\b(?:con qui[ée]n (?:estoy )?hablo?|qui[ée]n me (?:est[áa] )?atiende)\b/i,
  /\b(?:esto|este chat|el mensaje) es (?:un )?autom[áa]tico\b/i,
];

/**
 * @param {string} text - lo que ha escrito el cliente
 * @returns {{handoff: boolean, reason: string|null}}
 */
function detect(text = '') {
  const t = String(text || '');
  if (!t.trim()) return { handoff: false, reason: null };

  if (PIDE_HUMANO.some((re) => re.test(t))) {
    return { handoff: true, reason: 'el cliente pide hablar con una persona' };
  }
  if (PREGUNTA_IDENTIDAD.some((re) => re.test(t))) {
    return { handoff: true, reason: 'el cliente pregunta con quién habla' };
  }
  return { handoff: false, reason: null };
}

module.exports = { detect, PIDE_HUMANO, PREGUNTA_IDENTIDAD };
