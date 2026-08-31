'use strict';

/**
 * world — constructor del entorno de evals.
 *
 * Por defecto ModelGateway simulado (determinista). Con EVALS_LIVE=1 y
 * ANTHROPIC_API_KEY, el gateway usa el modelo real: los contratos de las
 * suites no cambian, cambia quién decide.
 */
const ModelGateway = require('../src/cognition/ModelGateway');

function makeGateway() {
  const providers = {};
  if (process.env.EVALS_LIVE === '1' && process.env.ANTHROPIC_API_KEY) {
    const Anthropic = require('@anthropic-ai/sdk');
    providers.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return new ModelGateway({ providers });
}

function isLive() {
  return process.env.EVALS_LIVE === '1' && !!process.env.ANTHROPIC_API_KEY;
}

/** assert mínimo con mensajes útiles en el reporte. */
function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

module.exports = { makeGateway, isLive, expect };
