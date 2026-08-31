'use strict';

/**
 * candidateRedaction — quita del texto de un candidato lo que un modelo no
 * necesita para evaluar competencia, y que sí puede usar como proxy de
 * discriminación sin que nadie lo note.
 *
 * El riesgo real: un CV screener que recibe "Nombre: Fatima Al-Rashid, 52
 * años, Marruecos" junto con la experiencia está dándole al modelo material
 * de sobra para que el nombre, la edad o el origen influyan en el veredicto
 * — sesgo que ni el propio modelo puede explicar si se le pregunta, porque no
 * hay forma de auditar una correlación implícita. Es el mismo motivo por el
 * que un CV en papel bien gestionado se cribaba antes sin foto ni nombre.
 *
 * Encaja con el marco (RGPD art. 22 y el AI Act de la UE clasifican la
 * contratación como decisión automatizada de alto riesgo): la evaluación de
 * aptitud debe poder demostrarse basada en competencias, no en datos que la
 * ley prohíbe usar como criterio.
 *
 * Determinista y auditable a propósito: se anota SIEMPRE qué se quitó (nunca
 * se elimina en silencio), porque si se impugna una decisión hay que poder
 * enseñar exactamente qué vio y qué no vio el modelo.
 */

/** Campos que nunca deben llegar al modelo de evaluación. */
const PROTECTED_FIELDS = ['name', 'fullName', 'firstName', 'lastName', 'photo', 'photoUrl', 'birthDate', 'dob', 'age', 'gender', 'nationality', 'maritalStatus', 'address'];

/**
 * Patrones en texto libre (CV pegado) que delatan edad, género o estado civil.
 *
 * El de edad lleva un lookahead negativo a propósito: "10 años" es la edad de
 * alguien, pero "10 años de experiencia" es justo la señal que el cribador
 * SÍ necesita ver. Sin distinguirlos, redactar por edad borraba la
 * experiencia — el dato más importante del CV — en vez de un dato protegido.
 */
const TEXT_PATTERNS = [
  { id: 'age', re: /\b(\d{1,2})\s*años(?!\s+(?:de\s+experiencia|trabajando|en\s+el\s+sector|en\s+la\s+industria|de\s+trayectoria|de\s+carrera))\b/gi },
  { id: 'dob', re: /\b\d{1,2}[\/\-.]\d{1,2}[\/\-.](19|20)\d{2}\b/g },
  { id: 'marital_status', re: /\b(casad[oa]|solter[oa]|divorciad[oa]|viud[oa])\b/gi },
  { id: 'gender_pronoun', re: /\b(él mismo|ella misma)\b/gi },
];

/**
 * Redacta un candidato antes de pasarlo al modelo de evaluación.
 * @param {object} candidate - datos crudos del candidato
 * @returns {{ safeCandidate: object, redactedText: string, removed: string[] }}
 */
function redact(candidate = {}) {
  const removed = [];
  const safeCandidate = {};

  for (const [key, value] of Object.entries(candidate)) {
    if (PROTECTED_FIELDS.includes(key)) {
      if (value != null && value !== '') removed.push(key);
      continue;   // se omite del objeto seguro
    }
    safeCandidate[key] = value;
  }

  // El texto libre (CV pegado, resumen) puede llevar la misma información
  // camuflada dentro; los campos estructurados no cubren ese caso.
  let text = String(safeCandidate.resumeText || safeCandidate.text || '');
  for (const { id, re } of TEXT_PATTERNS) {
    if (re.test(text)) {
      removed.push(`text:${id}`);
      text = text.replace(re, '[dato omitido]');
    }
    re.lastIndex = 0;
  }
  if (safeCandidate.resumeText != null) safeCandidate.resumeText = text;
  if (safeCandidate.text != null) safeCandidate.text = text;

  return { safeCandidate, redactedText: text, removed: [...new Set(removed)] };
}

module.exports = { redact, PROTECTED_FIELDS, TEXT_PATTERNS };
