'use strict';

/**
 * draftGuard — revisa un borrador de respuesta ANTES de ponérselo delante a
 * una persona para que lo envíe.
 *
 * El riesgo concreto: un modelo redactando una respuesta a un cliente enfadado
 * escribe con toda naturalidad "ha sido un error nuestro, le reembolsaremos el
 * importe y lo tendrá resuelto en 24 horas". Suena bien y es exactamente lo que
 * no debe salir: admite culpa, promete dinero y fija un plazo. Si el ticket
 * lleva una amenaza legal, ese texto es una prueba en contra; y en cualquier
 * caso compromete a la empresa a algo que quien pulsa "enviar" quizá no puede
 * cumplir.
 *
 * Se revisa la SALIDA en vez de confiar en el prompt: pedirle al modelo que no
 * prometa nada funciona casi siempre, y "casi siempre" no sirve cuando el fallo
 * es irreversible. Esto es determinista y se puede auditar.
 *
 * No censura ni reescribe: MARCA. La decisión sigue siendo de la persona, que
 * es justo el punto de todo el flujo HITL.
 */

/** Normaliza para comparar: minúsculas, sin tildes. */
function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

const RISKS = [
  {
    id: 'admision_de_culpa',
    label: 'Admite responsabilidad de la empresa',
    why: 'En un caso con amenaza legal, reconocer culpa por escrito se usa como prueba.',
    terms: [
      'ha sido culpa nuestra', 'es culpa nuestra', 'fue culpa nuestra',
      'ha sido un error nuestro', 'es un error nuestro', 'nuestro fallo',
      'asumimos la responsabilidad', 'reconocemos que hemos', 'reconocemos el error',
      'hemos incumplido', 'no hemos cumplido', 'nos hemos equivocado',
      'our fault', 'we were wrong', 'we failed to', 'we take responsibility',
    ],
  },
  {
    id: 'compromiso_economico',
    label: 'Promete dinero o compensación',
    why: 'Compromete un gasto que quien envía puede no tener autorizado.',
    terms: [
      'le reembolsaremos', 'te reembolsaremos', 'le devolveremos el importe',
      'le compensaremos', 'te compensaremos', 'sin coste alguno', 'sin ningun coste',
      'le abonaremos', 'le haremos un descuento', 'le devolvemos el dinero',
      'we will refund', 'we will compensate', 'free of charge', 'at no cost',
    ],
  },
  {
    id: 'plazo_vinculante',
    label: 'Fija un plazo concreto',
    why: 'Un plazo por escrito que luego se incumple agrava la queja original.',
    terms: [
      'en 24 horas', 'en 48 horas', 'en menos de 24', 'antes de manana',
      'lo tendra resuelto hoy', 'quedara resuelto hoy', 'estara resuelto manana',
      'dentro de 24 horas', 'en un plazo de 24',
      'within 24 hours', 'within 48 hours', 'by tomorrow', 'resolved today',
    ],
  },
  {
    id: 'garantia_absoluta',
    label: 'Garantiza que no volverá a pasar',
    why: 'Es una promesa que nadie puede sostener y crea expectativa de incumplimiento.',
    terms: [
      'no volvera a ocurrir', 'no volvera a pasar', 'le garantizamos que no',
      'nunca mas ocurrira', 'garantizamos que no volvera',
      'will never happen again', 'we guarantee this will not',
    ],
  },
];

/**
 * Revisa un borrador.
 * @returns {{safe: boolean, findings: Array<{id,label,why,match}>}}
 */
function review(draft) {
  const norm = normalize(draft);
  const findings = [];
  for (const risk of RISKS) {
    const hit = risk.terms.find((t) => norm.includes(t));
    if (hit) findings.push({ id: risk.id, label: risk.label, why: risk.why, match: hit });
  }
  return { safe: findings.length === 0, findings };
}

/**
 * Plantilla de acuse SIN contenido sustantivo.
 *
 * Se usa cuando el ticket trae amenaza legal: ahí NO se genera una respuesta
 * de fondo. Contestar al fondo de una reclamación legal sin que lo vea alguien
 * de Legal es precisamente el error que este flujo quiere evitar, y un acuse
 * de recibo neutro no cierra ninguna puerta.
 */
function acknowledgementTemplate({ contact = null } = {}) {
  const saludo = contact ? `Hola ${contact}:` : 'Hola:';
  return [
    saludo,
    '',
    'Hemos recibido su mensaje y lo estamos revisando internamente.',
    'Le responderemos con detalle una vez completada esa revisión.',
    '',
    'Gracias por su paciencia.',
  ].join('\n');
}

module.exports = { review, acknowledgementTemplate, normalize, RISKS };
