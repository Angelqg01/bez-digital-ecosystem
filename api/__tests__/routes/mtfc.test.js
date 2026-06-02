const mtfc = require('../../services/mtfcEngineService');

describe('mtfcEngineService', () => {
  test('evaluates stable unified lona states', () => {
    const result = mtfc.evaluateUnifiedLona({
      fidelidadMax: 1,
      tensionEstatica: 0.2,
      tensionDinamica: 0.3,
      tauBase: 10
    });

    expect(result.colapso).toBe(false);
    expect(result.radicando).toBeCloseTo(0.5);
    expect(result.tiempoPropio).toBeGreaterThan(7);
  });

  test('intercepts collapse and sanitizes corrupt telemetry', () => {
    const result = mtfc.evaluateUnifiedLona({
      fidelityMax: Number.NaN,
      staticTension: Number.POSITIVE_INFINITY,
      dynamicTension: -1,
      tauBase: Number.NaN
    });

    expect(result.colapso).toBe(true);
    expect(result.tiempoPropio).toBe(0);
    expect(result.sanitized.staticTension).toBe(1);
    expect(result.sanitized.dynamicTension).toBe(1);
  });

  test('summarizes batch evaluations', () => {
    const batch = mtfc.evaluateBatch([
      { fidelidadMax: 1, tensionEstatica: 0.1, tensionDinamica: 0.2, tauBase: 1 },
      { fidelidadMax: 1, tensionEstatica: 0.8, tensionDinamica: 0.8, tauBase: 1 }
    ]);

    expect(batch.summary.total).toBe(2);
    expect(batch.summary.stable).toBe(1);
    expect(batch.summary.collapses).toBe(1);
  });

  test('estimates BEZ charge for M-TFC compute jobs', () => {
    const estimate = mtfc.estimateComputeCharge({ operations: 1000, priority: 'realtime' });

    expect(estimate.feature).toBe('MTFC_ENGINE');
    expect(estimate.chargedBez).toBeGreaterThan(0);
    expect(estimate.billingUsage.usage.operations).toBe(1000);
  });
});
