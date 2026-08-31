/**
 * BZ PureScan — Oráculo de Disputas (Smart Settlement / MCP)
 * ====================================================================
 * Lógica paramétrica que ejecuta el Servidor MCP para "negociar por los
 * humanos". Cruza la telemetría de sensores + la comparación visual con
 * las condiciones del contrato y devuelve una PROPUESTA DE LIQUIDACIÓN
 * condicional en lugar de cancelar la venta a ciegas.
 *
 * Matriz de Tolerancia (severidad):
 *   Nivel 0 — OK          → libera 100 % del escrow al vendedor.
 *   Nivel 1 — Leve        → descuento automático (~10-15 %). Salva la venta.
 *   Nivel 2 — Moderado    → reembolso parcial fuerte + devolución compartida.
 *   Nivel 3 — Crítico     → cancela escrow, 100 % al comprador, quema RWA,
 *                           bloquea el lote y aplica slashing a la fianza del rider.
 *
 * El resultado alimenta BZ Sphere (chat), el HyperlocalEscrow.sol y el
 * Integration Bridge (cargoStatus).
 */

const round = (value, decimals = 1) => Number(value.toFixed(decimals))
const clampPct = (value) => Math.max(0, Math.min(100, value))

export const SEVERITY = {
  OK: { level: 0, label: 'Conforme', color: '#39ff14' },
  MINOR: { level: 1, label: 'Leve', color: '#facc15' },
  MODERATE: { level: 2, label: 'Moderado', color: '#fb923c' },
  CRITICAL: { level: 3, label: 'Crítico', color: '#f87171' },
}

/**
 * @param {Object} input
 * @param {Object} input.comparison  - salida de compareCaptures (visual)
 * @param {Object} input.sensors     - buildSensorPayload()
 * @param {Object} input.contract    - { idealMaxC, criticalHours, orderValueBEZ, riderStakeBEZ }
 * @param {string} input.objectType
 */
export const evaluateDispute = ({ comparison = {}, sensors = {}, contract = {}, objectType = 'food' } = {}) => {
  const idealMaxC = contract.idealMaxC ?? 6
  const criticalHours = contract.criticalHours ?? 5
  const orderValueBEZ = contract.orderValueBEZ ?? 10
  const riderStakeBEZ = contract.riderStakeBEZ ?? 0

  const reasons = []
  let damagePct = 0
  let criticalTrigger = null
  let logisticsFault = false // ¿la culpa es del transporte? → habilita slashing

  // ── Señal visual (siempre presente) ──
  const changeScore = comparison.changeScore ?? 0
  if (comparison.riskLevel === 'HIGH') {
    damagePct = Math.max(damagePct, 45)
    reasons.push(`Cambio visual alto (${changeScore}%): daño estético/estructural evidente.`)
  } else if (comparison.riskLevel === 'MEDIUM') {
    damagePct = Math.max(damagePct, 18)
    reasons.push(`Cambio visual moderado (${changeScore}%): revisar producto.`)
  }

  // ── Cadena de frío (BLE) ──
  const cold = sensors.cold_chain
  if (cold?.breach?.detected) {
    const { hoursAbove, maxTempC } = cold.breach
    logisticsFault = true
    if (hoursAbove >= criticalHours) {
      criticalTrigger = `Cadena de frío rota ${hoursAbove}h (> ${criticalHours}h límite). Riesgo sanitario.`
    } else {
      const coldDamage = clampPct(10 + hoursAbove * 6) // ~ severidad por horas
      damagePct = Math.max(damagePct, coldDamage)
      reasons.push(`Pico de ${maxTempC}°C durante ${hoursAbove}h sobre el umbral de ${idealMaxC}°C.`)
    }
  }

  // ── Etileno / gases ──
  const chem = sensors.chemical
  if (chem?.readings?.ripeningRisk) {
    damagePct = Math.max(damagePct, 22)
    reasons.push(`Pico de etileno (${chem.readings.ppm} ppm): sobre-maduración acelerada.`)
  }

  // ── Óptico / multiespectral (puede rebajar la severidad si el interior está bien) ──
  const optical = sensors.optical
  if (optical?.readings?.brix > 0) {
    if (optical.readings.ripenessIndex >= 9) {
      damagePct = Math.max(damagePct, 12)
      reasons.push(`Índice de madurez ${optical.readings.ripenessIndex}/10: consumir pronto.`)
    } else if (damagePct > 0 && damagePct < 30) {
      reasons.push(`Interior sano (${optical.readings.brix} °Bx): apto pese al defecto externo.`)
    }
  }

  // ── Prueba de Origen (NFC) — la manipulación es crítica por sí sola ──
  const prov = sensors.provenance
  if (prov && prov.readings && prov.readings.proofOfOrigin === false) {
    criticalTrigger = 'Sello NFC manipulado: falla la Prueba de Origen (posible fraude de lote).'
  }

  // ── Resolver severidad ──
  let severity
  if (criticalTrigger) {
    severity = SEVERITY.CRITICAL
    damagePct = 100
    reasons.unshift(criticalTrigger)
  } else if (damagePct >= 30) {
    severity = SEVERITY.MODERATE
  } else if (damagePct >= 8) {
    severity = SEVERITY.MINOR
  } else {
    severity = SEVERITY.OK
  }

  damagePct = round(clampPct(damagePct), 0)
  const settlement = buildSettlement({
    severity,
    damagePct,
    orderValueBEZ,
    riderStakeBEZ,
    logisticsFault,
  })

  return {
    severity: severity.level,
    severityLabel: severity.label,
    color: severity.color,
    damagePct,
    logisticsFault,
    reasons: reasons.length ? reasons : ['Todos los parámetros dentro de contrato.'],
    settlement,
    sphereMessage: buildSphereMessage(severity, damagePct, settlement),
    contract: { idealMaxC, criticalHours, orderValueBEZ, riderStakeBEZ },
    evaluatedAt: new Date().toISOString(),
  }
}

// Traduce la severidad en movimientos concretos de tokens BEZ
const buildSettlement = ({ severity, damagePct, orderValueBEZ, riderStakeBEZ, logisticsFault }) => {
  switch (severity.level) {
    case 3: {
      // Crítico → cancela escrow, 100 % al comprador, quema RWA, slashing rider
      const slashed = logisticsFault ? round(Math.min(riderStakeBEZ, orderValueBEZ), 2) : 0
      return {
        action: 'CANCEL_ESCROW',
        contractFn: 'executeLevel3Penalty()',
        refundToBuyerBEZ: round(orderValueBEZ, 2),
        payToSellerBEZ: logisticsFault ? slashed : 0, // se indemniza con la fianza del rider
        slashedFromRiderBEZ: slashed,
        burnRwaToken: true,
        blockLot: true,
        discountPct: 0,
        cargoStatus: 'DISPUTE_REQUIRED',
      }
    }
    case 2: {
      const discountPct = Math.min(damagePct, 50)
      const refund = round((orderValueBEZ * discountPct) / 100, 2)
      return {
        action: 'PARTIAL_REFUND',
        contractFn: 'renegotiate(uint256 discountBps)',
        refundToBuyerBEZ: refund,
        payToSellerBEZ: round(orderValueBEZ - refund, 2),
        slashedFromRiderBEZ: 0,
        burnRwaToken: false,
        blockLot: false,
        discountPct,
        sharedReturnOption: true,
        cargoStatus: 'HOLD_FOR_INSPECTION',
      }
    }
    case 1: {
      const discountPct = Math.min(damagePct, 15)
      const refund = round((orderValueBEZ * discountPct) / 100, 2)
      return {
        action: 'AUTO_DISCOUNT',
        contractFn: 'renegotiate(uint256 discountBps)',
        refundToBuyerBEZ: refund,
        payToSellerBEZ: round(orderValueBEZ - refund, 2),
        slashedFromRiderBEZ: 0,
        burnRwaToken: false,
        blockLot: false,
        discountPct,
        cargoStatus: 'VERIFIED',
      }
    }
    default:
      return {
        action: 'RELEASE_ESCROW',
        contractFn: 'releaseEscrow()',
        refundToBuyerBEZ: 0,
        payToSellerBEZ: round(orderValueBEZ, 2),
        slashedFromRiderBEZ: 0,
        burnRwaToken: false,
        blockLot: false,
        discountPct: 0,
        cargoStatus: 'VERIFIED',
      }
  }
}

// Mensaje automático que el bot publica en el chat de BZ Sphere
const buildSphereMessage = (severity, damagePct, settlement) => {
  switch (severity.level) {
    case 3:
      return {
        icon: '⛔',
        title: 'Fallo crítico detectado',
        body: `Riesgo sanitario / fraude. Escrow cancelado: reembolso íntegro de ${settlement.refundToBuyerBEZ} BEZ al comprador y lote bloqueado.`,
        buyerCta: 'Reembolso automático emitido',
        sellerCta: settlement.slashedFromRiderBEZ > 0
          ? `Indemnización de ${settlement.payToSellerBEZ} BEZ desde la fianza del repartidor`
          : 'Venta cancelada',
      }
    case 2:
      return {
        icon: '⚠️',
        title: 'Daño moderado detectado',
        body: `Pérdida de vida útil ~${damagePct}%. Propuesta: reembolso de ${settlement.refundToBuyerBEZ} BEZ (${settlement.discountPct}% dto.) o devolución con gastos compartidos.`,
        buyerCta: `Aceptar con ${settlement.discountPct}% dto. (pagar ${settlement.payToSellerBEZ} BEZ)`,
        sellerCta: 'Aceptar descuento y liberar venta',
      }
    case 1:
      return {
        icon: '🤖',
        title: 'Leve rotura de calidad detectada',
        body: `Propuesta de la IA: reducir el pago un ${settlement.discountPct}%. El producto es aprovechable.`,
        buyerCta: `Aceptar con ${settlement.discountPct}% dto. (pagar ${settlement.payToSellerBEZ} BEZ)`,
        sellerCta: 'Aceptar dto. y liberar venta',
      }
    default:
      return {
        icon: '✅',
        title: 'Entrega conforme',
        body: `Producto dentro de contrato. Se libera el pago íntegro de ${settlement.payToSellerBEZ} BEZ al vendedor.`,
        buyerCta: 'Confirmar recepción',
        sellerCta: 'Pago liberado',
      }
  }
}
