'use strict';

/**
 * screening — reglas de cribado KYC/AML básicas para compras de BEZ-Coin y
 * pagos entre empresas. No sustituye asesoría legal ni una lista oficial de
 * sanciones; es la primera línea de defensa antes de que un humano revise la
 * aprobación HITL de la operación.
 *
 * Dos segmentos con umbral de importe distinto:
 *  - `retail` (por defecto): compra de BEZ-Coin; revisión reforzada desde 5.000 $.
 *  - `b2b`: pagos entre empresas (fletes, naviera, frío…); desde 100.000 $.
 *    Con el umbral retail, casi todos los pagos B2B salían "riesgo medio" y el
 *    revisor dejaba de mirarlos (simulación de un trimestre, docs/TEST-TRIMESTRE-LOGISTICA-DEFI.md).
 *
 * La lista de países es una base mínima: debe sustituirse/completarse con las
 * listas oficiales vigentes (UE, OFAC, ONU, GAFI) antes de operar con volumen real.
 */

// Sin tildes y en minúsculas: se compara tras normalizar el texto del país.
const HIGH_RISK_TERMS = [
  'iran', 'north korea', 'corea del norte', 'cuba', 'syria', 'siria', 'sudan', 'venezuela',
  'russia', 'rusia', 'belarus', 'bielorrusia',
  'myanmar', 'birmania', 'afghanistan', 'afganistan',
];
const LARGE_AMOUNT_USD = 5000;
const LARGE_AMOUNT_B2B_USD = 100000;

function normalize(text) {
  return String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

/** Coincide por palabra completa ("iran" no debe saltar con "Miranda"). */
function isHighRiskCountry(country) {
  const c = normalize(country);
  if (!c) return false;
  return HIGH_RISK_TERMS.some((term) => new RegExp(`(^|[^a-z])${term}([^a-z]|$)`).test(c));
}

function screen({ amountUsd = 0, country = '', walletAddress = '', customerEmail = '', segment = 'retail' } = {}) {
  const flags = [];
  const amount = Number(amountUsd) || 0;
  const threshold = segment === 'b2b' ? LARGE_AMOUNT_B2B_USD : LARGE_AMOUNT_USD;
  if (amount >= threshold) {
    flags.push(`Importe elevado (>= $${threshold}): revisión reforzada recomendada.`);
  }
  const sanctioned = isHighRiskCountry(country);
  if (sanctioned) flags.push(`País declarado de alto riesgo/sancionado: ${country}`);
  if (!walletAddress) flags.push('Sin wallet de destino: no se puede verificar el receptor.');
  if (!customerEmail) flags.push('Sin email de contacto verificable.');

  const riskLevel = sanctioned ? 'alto' : (flags.length ? 'medio' : 'bajo');
  return { riskLevel, flags, requiresEnhancedReview: riskLevel !== 'bajo' };
}

module.exports = { screen, isHighRiskCountry, HIGH_RISK_TERMS, LARGE_AMOUNT_USD, LARGE_AMOUNT_B2B_USD };
