'use strict';

/**
 * dpiaChecklist — determina si un tratamiento de datos necesita una
 * Evaluación de Impacto (DPIA, RGPD art. 35) según criterios OBJETIVOS
 * (guía WP248 del antiguo Grupo de Trabajo del art. 29), no según la
 * impresión general de un modelo al leer la descripción de una SubApp.
 *
 * Los 9 criterios de WP248. Dos o más marcados → DPIA obligatoria (regla
 * publicada, no una opinión). Uno solo → recomendable. Ninguno → no parece
 * necesaria, pero SIEMPRE queda sujeta a revisión humana: este módulo nunca
 * "aprueba" una DPIA, solo dice si hace falta redactarla — el análisis de
 * riesgo real y las medidas de mitigación las valida el DPO.
 */

const CRITERIA = [
  { id: 'scoringOrEvaluation', label: 'Evaluación o scoring de personas (incl. elaboración de perfiles)' },
  { id: 'automatedDecisionMaking', label: 'Decisión automatizada con efecto legal o significativo' },
  { id: 'systematicMonitoring', label: 'Monitorización sistemática (incl. espacios de acceso público)' },
  { id: 'sensitiveData', label: 'Categorías especiales de datos o datos altamente personales' },
  { id: 'largeScale', label: 'Tratamiento a gran escala' },
  { id: 'datasetMatching', label: 'Cruce o combinación de conjuntos de datos' },
  { id: 'vulnerableSubjects', label: 'Titulares vulnerables (menores, empleados, pacientes...)' },
  { id: 'innovativeTech', label: 'Uso innovador de tecnología (incl. blockchain/IA)' },
  { id: 'preventsRightOrService', label: 'Impide ejercer un derecho o acceder a un servicio/contrato' },
];

/**
 * @param {object} flags - { [criterionId]: boolean }
 * @returns {{ matched: string[], count: number, verdict: 'mandatory'|'recommended'|'not_required', requiresDPOReview: true }}
 */
function evaluate(flags = {}) {
  const matched = CRITERIA.filter((c) => flags[c.id] === true);
  const count = matched.length;
  const verdict = count >= 2 ? 'mandatory' : count === 1 ? 'recommended' : 'not_required';
  return {
    matched: matched.map((c) => c.id),
    matchedLabels: matched.map((c) => c.label),
    count,
    verdict,
    // Siempre true, a propósito: ni "not_required" es un cierre automático,
    // solo dice que a priori no hace falta redactar el documento formal.
    requiresDPOReview: true,
  };
}

module.exports = { evaluate, CRITERIA };
