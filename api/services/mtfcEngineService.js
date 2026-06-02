'use strict';

const DEFAULT_BEZ_PER_1K_OPS = Number(process.env.MTFC_BEZ_PER_1K_OPS || 0.02);
const DEFAULT_MAX_BATCH = Number(process.env.MTFC_MAX_BATCH || 1000);

function sanitizeTension(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 1;
  return number;
}

function sanitizePositive(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return number;
}

function sanitizeTau(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return number;
}

function evaluateUnifiedLona(input = {}) {
  const fidelityMax = sanitizePositive(input.fidelidadMax ?? input.fidelityMax, 1);
  const staticTension = sanitizeTension(input.tensionEstatica ?? input.staticTension);
  const dynamicTension = sanitizeTension(input.tensionDinamica ?? input.dynamicTension);
  const tauBase = sanitizeTau(input.tauBase ?? 1);
  const radicando = fidelityMax - staticTension - dynamicTension;

  if (!Number.isFinite(radicando) || radicando <= 0) {
    return {
      radicando,
      tiempoPropio: 0,
      colapso: true,
      sanitized: {
        fidelityMax,
        staticTension,
        dynamicTension,
        tauBase
      }
    };
  }

  return {
    radicando,
    tiempoPropio: tauBase * Math.sqrt(radicando),
    colapso: false,
    sanitized: {
      fidelityMax,
      staticTension,
      dynamicTension,
      tauBase
    }
  };
}

function evaluateBatch(samples = []) {
  if (!Array.isArray(samples)) {
    throw new Error('samples must be an array');
  }
  if (samples.length > DEFAULT_MAX_BATCH) {
    throw new Error(`batch exceeds maximum size of ${DEFAULT_MAX_BATCH}`);
  }

  const results = samples.map((sample, index) => ({
    index,
    ...evaluateUnifiedLona(sample)
  }));

  const collapses = results.filter((result) => result.colapso).length;
  const stable = results.length - collapses;
  const averageTiempoPropio = stable > 0
    ? results
        .filter((result) => !result.colapso)
        .reduce((sum, result) => sum + result.tiempoPropio, 0) / stable
    : 0;

  return {
    results,
    summary: {
      total: results.length,
      stable,
      collapses,
      collapseRate: results.length > 0 ? collapses / results.length : 0,
      averageTiempoPropio
    }
  };
}

function estimateComputeCharge({ operations = 1, priority = 'standard' } = {}) {
  const safeOperations = Math.max(1, Math.ceil(Number(operations) || 1));
  const priorityMultiplier = priority === 'realtime' ? 3 : priority === 'bulk' ? 0.6 : 1;
  const chargedBez = Math.ceil((safeOperations / 1000) * DEFAULT_BEZ_PER_1K_OPS * priorityMultiplier * 10000) / 10000;

  return {
    feature: 'MTFC_ENGINE',
    operations: safeOperations,
    priority,
    bezPer1kOps: DEFAULT_BEZ_PER_1K_OPS,
    priorityMultiplier,
    chargedBez,
    billingUsage: {
      model: 'mtfc-core-v1.1',
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        minutes: 0,
        operations: safeOperations
      }
    }
  };
}

function getManifest() {
  return {
    name: 'M-TFC Core',
    version: '1.1.0',
    engine: 'mtfc_core::evaluar_lona_unificada',
    nativeRuntime: 'Rust/Tokio',
    apiRuntime: 'Node.js compatibility adapter',
    blockchainRole: 'payments-certification-provenance',
    billingFeature: 'MTFC_ENGINE',
    endpoints: [
      'GET /api/mtfc/manifest',
      'POST /api/mtfc/evaluate',
      'POST /api/mtfc/batch',
      'POST /api/mtfc/estimate'
    ],
    outputSchema: {
      radicando: 'number',
      tiempoPropio: 'number',
      colapso: 'boolean'
    }
  };
}

module.exports = {
  evaluateUnifiedLona,
  evaluateBatch,
  estimateComputeCharge,
  getManifest
};
