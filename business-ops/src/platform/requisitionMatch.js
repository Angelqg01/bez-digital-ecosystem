'use strict';

/**
 * requisitionMatch — puntúa un candidato contra los requisitos REALES del
 * puesto, no contra la impresión general que le cause al modelo.
 *
 * Mismo motivo que en `priceCatalog`/`expenseCategories`: si el ajuste al
 * puesto lo decide un modelo desde cero, el mismo CV puede sacar notas
 * distintas según el día, y "por qué le puse 72 y no 85" no tiene respuesta
 * auditable. Aquí el componente objetivo (qué habilidades pide el puesto,
 * cuáles tiene el candidato, si cumple la experiencia mínima) se calcula
 * aparte y el modelo solo redacta la valoración cualitativa alrededor de un
 * número que ya existe.
 *
 * Función pura sobre texto: no decide "contratar o no" —esa sigue siendo la
 * línea roja `employment_decision`, evaluada aparte—; solo calcula qué tan
 * bien encaja el perfil con lo que el puesto pide.
 */

function tokens(s) {
  return new Set(
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .match(/[a-z0-9+.#]+/g)?.filter((w) => w.length > 1) || []
  );
}

/**
 * @param {{requiredSkills?: string[], niceToHaveSkills?: string[], minYears?: number}} requisition
 * @param {{resumeText?: string, text?: string, years?: number}} candidate
 * @returns {{score:number, matchedRequired:string[], missingRequired:string[], matchedNiceToHave:string[], meetsMinYears:boolean|null}}
 */
function score(requisition = {}, candidate = {}) {
  const required = (requisition.requiredSkills || []).map((s) => String(s).toLowerCase().trim()).filter(Boolean);
  const niceToHave = (requisition.niceToHaveSkills || []).map((s) => String(s).toLowerCase().trim()).filter(Boolean);
  const text = tokens(candidate.resumeText || candidate.text || '');

  // Una skill puede ser una frase ("node.js"); se busca como subcadena de
  // palabras normalizadas, no solo como token exacto, para tolerar variantes.
  const textoPlano = ' ' + [...text].join(' ') + ' ';
  const contains = (skill) => text.has(skill) || textoPlano.includes(` ${skill} `) || String(candidate.resumeText || candidate.text || '').toLowerCase().includes(skill);

  const matchedRequired = required.filter(contains);
  const missingRequired = required.filter((s) => !contains(s));
  const matchedNiceToHave = niceToHave.filter(contains);

  let meetsMinYears = null;
  if (requisition.minYears != null) {
    const years = Number(candidate.years);
    meetsMinYears = Number.isFinite(years) ? years >= requisition.minYears : null;
  }

  // Reparto: requisitos obligatorios pesan más que los deseables, y no
  // cumplir la experiencia mínima penaliza pero no anula (algunos puestos sí
  // aceptan compensar con más habilidades de las pedidas).
  let s = 0;
  if (required.length) s += 0.6 * (matchedRequired.length / required.length);
  else s += 0.3;   // sin requisitos obligatorios definidos, no se penaliza de más
  if (niceToHave.length) s += 0.2 * (matchedNiceToHave.length / niceToHave.length);
  if (meetsMinYears === true) s += 0.2;
  else if (meetsMinYears === false) s += 0;
  else if (requisition.minYears == null) s += 0.2;   // sin mínimo exigido, no se penaliza

  return {
    score: Number(Math.min(1, s).toFixed(3)),
    matchedRequired,
    missingRequired,
    matchedNiceToHave,
    meetsMinYears,
  };
}

module.exports = { score, tokens };
