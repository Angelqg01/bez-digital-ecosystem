'use strict';

/**
 * screening — reglas de cribado KYC/AML básicas para compras de BEZ-Coin.
 * No sustituye asesoría legal; es la primera línea de defensa antes de que
 * un humano revise la aprobación HITL de la transferencia.
 */
const HIGH_RISK_TERMS = ['iran', 'irán', 'north korea', 'corea del norte', 'cuba', 'syria', 'siria', 'sudan', 'sudán', 'venezuela'];
const LARGE_AMOUNT_USD = 5000;

function screen({ amountUsd = 0, country = '', walletAddress = '', customerEmail = '' } = {}) {
  const flags = [];
  const amount = Number(amountUsd) || 0;
  if (amount >= LARGE_AMOUNT_USD) {
    flags.push(`Importe elevado (>= $${LARGE_AMOUNT_USD}): revisión reforzada recomendada.`);
  }
  const c = String(country).toLowerCase();
  const sanctioned = HIGH_RISK_TERMS.some((k) => c.includes(k));
  if (sanctioned) flags.push(`País declarado de alto riesgo/sancionado: ${country}`);
  if (!walletAddress) flags.push('Sin wallet de destino: no se puede verificar el receptor.');
  if (!customerEmail) flags.push('Sin email de contacto verificable.');

  const riskLevel = sanctioned ? 'alto' : (flags.length ? 'medio' : 'bajo');
  return { riskLevel, flags, requiresEnhancedReview: riskLevel !== 'bajo' };
}

module.exports = { screen, HIGH_RISK_TERMS, LARGE_AMOUNT_USD };
