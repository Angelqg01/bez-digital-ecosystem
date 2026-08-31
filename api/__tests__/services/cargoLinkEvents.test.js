'use strict';

/**
 * Inspección aduanera (TX010) y cambio de ETA/ruta (TX011).
 *
 * El caso que motiva las pruebas de ruta es real: MSC cambió la rotación de su
 * servicio EMUSA en julio de 2025 sustituyendo Algeciras por Málaga. El
 * análisis de Algeciras lo señala como prueba explícita — la red debe
 * representar el cambio sin perder la integridad histórica del envío.
 */

const { riskFromLane, chainStatusFor, INSPECTION_KINDS, CHANGE_TYPES } =
  require('../../services/cargoLinkEvents');

describe('cargoLinkEvents — riesgo derivado del carril aduanero', () => {
  it('traduce el carril al riesgo que consume preClearanceValidation', () => {
    // Los cortes coinciden con los del contrato: <30 pre-valida, >70 escala.
    expect(riskFromLane('GREEN_LANE')).toBeLessThan(30);
    expect(riskFromLane('RED_LANE')).toBeGreaterThan(70);
    // El naranja cae a propósito en la banda intermedia: ni se despacha solo
    // ni se escala solo, queda a criterio del oficial.
    const orange = riskFromLane('ORANGE_LANE');
    expect(orange).toBeGreaterThanOrEqual(30);
    expect(orange).toBeLessThanOrEqual(70);
  });

  it('sin carril declarado no presume nada: cae en la banda intermedia', () => {
    const sinCarril = riskFromLane(null);
    expect(sinCarril).toBeGreaterThanOrEqual(30);
    expect(sinCarril).toBeLessThanOrEqual(70);
  });
});

describe('cargoLinkEvents — estado on-chain de la inspección', () => {
  it('el resultado del oficial manda sobre el riesgo calculado', () => {
    // Un oficial puede aprobar un envío de riesgo alto: su firma pesa más que
    // el score, que es sólo una recomendación.
    expect(chainStatusFor(85, 'PASSED')).toBe('APPROVED');
    expect(chainStatusFor(10, 'REJECTED')).toBe('REJECTED');
  });

  it('una retención deja el envío escalado o pendiente, nunca resuelto', () => {
    expect(chainStatusFor(85, 'HELD')).toBe('ESCALATED');
    expect(chainStatusFor(10, 'HELD')).toBe('PRE_VALIDATED');
    expect(chainStatusFor(50, 'HELD')).toBe('PENDING');
    // Lo que NO puede pasar es que un HELD se lea como despachado.
    for (const risk of [0, 29, 30, 50, 70, 71, 100]) {
      expect(chainStatusFor(risk, 'HELD')).not.toBe('APPROVED');
    }
  });
});

describe('cargoLinkEvents — vocabulario cerrado', () => {
  it('cubre los tipos de cambio que exige el análisis de Algeciras', () => {
    // El documento nombra ROUTE_CHANGE, ETA_CHANGE, PORT_CHANGE y
    // CARGO_REROUTED entre los eventos de excepción que la red debe soportar.
    for (const t of ['ETA_CHANGE', 'ROUTE_CHANGE', 'PORT_CHANGE', 'CARGO_REROUTED']) {
      expect(CHANGE_TYPES.has(t)).toBe(true);
    }
  });

  it('las inspecciones cubren aduana, seguridad, fitosanitario y escáner', () => {
    for (const k of ['CUSTOMS', 'SECURITY', 'PHYTO', 'SCAN']) {
      expect(INSPECTION_KINDS.has(k)).toBe(true);
    }
  });
});
