// Qué llamada REAL de la API de BeZhas corresponde a cada etapa del simulador.
//
// El relato de las 16 etapas es didáctico; esta tabla es lo que un integrador
// ejecutaría de verdad contra /api/cargolink (api/routes/cargolink.js) y qué
// contrato ancla el resultado (api/services/cargoLinkOnChain.js). Todo lo que
// aparece aquí existe hoy en el código. Lo que todavía no existe se marca
// como tal (BON, más abajo) en vez de presentarse como hecho.

export type CargoRole = 'pos' | 'logistics' | 'customs' | 'carrier' | 'lastmile' | 'device';

export type BezProduct =
  | 'CargoLink'
  | 'BEZ-Pay Escrow'
  | 'Edge Node'
  | 'Telemetry Anchor'
  | 'Aduanas'
  | 'Tránsito multipaís'
  | 'Dispute Oracle'
  | 'Webhooks'
  | 'MCP';

export interface SdkCall {
  method: 'GET' | 'POST';
  path: string;           // relativo a /api/cargolink
  role: CargoRole;        // api-key de rol que exige la API
  body?: Record<string, unknown>;
  contract?: string;      // contrato que ancla (BeZhas L2 testnet, chainId 2708)
  fn?: string;
  webhook?: string;       // evento que reciben los suscriptores
  products: BezProduct[];
  note?: string;
  /** Llamadas que la API exige ANTES de ésta (p. ej. avanzar a IN_TRANSIT antes de anclar la telemetría). */
  before?: SdkCall[];
  /** Motivo por el que el Sandbox no puede ejecutarla con las claves de prueba (se muestra tal cual). */
  skipInSandbox?: string;
}

const BUID = ':bUid';

export const SDK_BY_STEP: Record<number, SdkCall> = {
  1: {
    method: 'POST', path: '/v1/tx', role: 'pos',
    body: { posRef: 'POS-9001', cargo: { value: 18500, weight: 900, items: [{ x: 6, y: 1.2, weight: 900 }] }, escrowAmountBez: 10000 },
    contract: 'SupplyTracker + DeliveryEscrow', fn: 'createShipment · createEscrow',
    products: ['CargoLink', 'BEZ-Pay Escrow'],
    note: 'Alta del B-UID. El escrow queda LOCKED hasta la entrega.',
  },
  2: {
    method: 'POST', path: '/v1/iot/devices', role: 'pos',
    body: { deviceId: 'EDGE-8842', type: 'multi', bUid: BUID },
    products: ['Edge Node'],
    note: 'Registra el Edge Node y devuelve su device key; su telemetría llega firmada (anti-spoofing).',
  },
  3: {
    method: 'POST', path: '/v1/iot/telemetry', role: 'device',
    body: { bUid: BUID, temperature: 5.2, humidity: 84, shock: 0.4, lat: 36.13, lng: -5.45, recordedAt: '<ISO>' },
    products: ['Edge Node', 'Telemetry Anchor'],
    note: 'Lecturas firmadas por el dispositivo; las geocercas (POST /v1/geofences) vigilan el corredor.',
  },
  4: {
    method: 'POST', path: `/v1/tx/${BUID}/advance`, role: 'logistics',
    body: { to: 'GATE_IN', payload: { warehouseCode: 'ZF-CAD-01', quantityKg: 900, gateRef: 'G2' } },
    contract: 'WarehouseManager', fn: 'receiveLot', webhook: 'ON_GATE_IN',
    products: ['CargoLink', 'Webhooks'],
  },
  5: {
    method: 'POST', path: `/v1/tx/${BUID}/custody`, role: 'logistics',
    body: { toActor: 'BZ-DEPOSITO-ZF', toRole: 'logistics', reason: 'HANDOVER', location: 'ZF-CAD-01' },
    contract: 'WarehouseManager', fn: 'transferLot',
    products: ['CargoLink'],
    note: 'Cambio de custodia (TX006): la cadena se encadena sola, sólo se cede lo que se tiene.',
  },
  6: {
    method: 'POST', path: '/v1/customs/dispatch', role: 'customs',
    body: { bUid: BUID, manifestId: 'MAN-1', declaredValue: 18500, hsCode: '0810' },
    contract: 'CustomsClearanceOracle', fn: 'requestClearance · approveClearanceByOfficer', webhook: 'ON_CUSTOMS_CLEARED',
    products: ['Aduanas', 'Webhooks'],
    note: 'Canal de riesgo calculado por BeZhas; el levante oficial lo da la aduana.',
  },
  7: {
    method: 'POST', path: `/v1/tx/${BUID}/inspection`, role: 'customs',
    body: { kind: 'SCAN', outcome: 'PASSED', findings: 'Precintos íntegros' },
    contract: 'CustomsClearanceOracle', fn: 'preClearanceValidation',
    products: ['Aduanas'],
    note: 'Inspección (TX010): no cambia la etapa del envío.',
  },
  8: {
    method: 'POST', path: '/v1/shipping/stowage', role: 'carrier',
    body: { bUid: BUID, items: [{ x: 6, y: 1.2, weight: 900 }] },
    contract: 'SupplyTracker', fn: 'recordCheckpoint(PORT)', webhook: 'ON_STOWAGE_COMPLETE',
    products: ['CargoLink', 'Webhooks'],
    note: 'Centro de gravedad calculado a partir de los bultos.',
  },
  9: {
    method: 'POST', path: `/v1/tx/${BUID}/advance`, role: 'logistics',
    body: { to: 'GATE_OUT', payload: { carrierRef: 'TRK-4821-CAD', quantityKg: 900, gateRef: 'G5' } },
    contract: 'WarehouseManager', fn: 'consumeLot', webhook: 'ON_GATE_OUT',
    products: ['CargoLink', 'Webhooks'],
  },
  10: {
    method: 'POST', path: `/v1/tx/${BUID}/advance`, role: 'carrier',
    body: { to: 'DEPARTED', payload: { vessel: 'MSC AURORA', voyage: 'AE7-118' } },
    contract: 'SupplyTracker', fn: 'markInTransit', webhook: 'ON_VESSEL_DEPARTURE',
    products: ['CargoLink', 'Webhooks'],
  },
  11: {
    method: 'POST', path: `/v1/iot/anchor/${BUID}`, role: 'logistics',
    contract: 'TelemetryAnchor', fn: 'anchorBatch',
    products: ['Telemetry Anchor'],
    before: [{
      method: 'POST', path: `/v1/tx/${BUID}/advance`, role: 'logistics',
      body: { to: 'IN_TRANSIT', payload: { routeId: 'RT-ES-NL-01', carrier: 'MSC' } },
      contract: 'SupplyTracker', fn: 'markInTransit', webhook: 'ON_IN_TRANSIT', products: ['CargoLink', 'Webhooks'],
    }],
    note: 'Raíz Merkle del lote de lecturas; cualquier lectura se prueba con GET /v1/iot/proof.',
  },
  12: {
    method: 'POST', path: `/v1/tx/${BUID}/eta`, role: 'carrier',
    body: { changeType: 'ETA_CHANGE', newEta: '<ISO>', newPort: 'NLRTM', reason: 'PORT_CONGESTION' },
    products: ['CargoLink'],
    note: 'Cambio de ETA/ruta (TX011) sin perder la integridad del histórico.',
  },
  13: {
    method: 'POST', path: `/v1/tx/${BUID}/transit/clear`, role: 'customs',
    body: { country: 'ES', outcome: 'CLEARED', reference: 'MRN-26ES0001' },
    contract: 'TrackingToCustomsGateway', fn: 'completeCountryClearance',
    products: ['Tránsito multipaís', 'Aduanas'],
    before: [{
      method: 'POST', path: `/v1/tx/${BUID}/transit`, role: 'customs',
      body: { cargoValue: 18500, hsCode: '0810', countries: ['ES', 'NL'] },
      contract: 'TrackingToCustomsGateway', fn: 'createIntegratedShipment', products: ['Tránsito multipaís'],
    }],
  },
  14: {
    method: 'GET', path: `/v1/logistics/route?bUid=${BUID}`, role: 'logistics',
    products: ['CargoLink', 'MCP'],
    note: 'Estado, ETA, retrasos y tránsito: lo mismo que consultan los agentes por MCP.',
  },
  15: {
    method: 'POST', path: `/v1/tx/${BUID}/custody`, role: 'logistics',
    body: { toActor: 'BZ-FLOTA-UM', toRole: 'lastmile', reason: 'HANDOVER' },
    products: ['CargoLink'],
    skipInSandbox: 'Sólo el custodio actual puede ceder la custodia (tras la etapa 5 es BZ-DEPOSITO-ZF): hace falta su propia clave.',
  },
  16: {
    method: 'POST', path: `/v1/tx/${BUID}/advance`, role: 'lastmile',
    body: { to: 'DELIVERED', payload: { signatureHash: '0x…sha256 de la firma del receptor…', receivedBy: 'Distribuidor Final' } },
    contract: 'SupplyTracker + DeliveryEscrow', fn: 'confirmDelivery · validateAndRelease', webhook: 'ON_DELIVERY_PROOF',
    products: ['CargoLink', 'BEZ-Pay Escrow', 'Webhooks'],
    note: 'La entrega libera el escrow al vendedor.',
  },
};

// Con la cadena de frío rota: la API no tiene una incidencia «TEMPERATURE_BREACH»
// (los tipos de /incidents son CARGO_DAMAGE, THEFT, DELAY…). La rotura entra por la
// telemetría: una lectura fuera del rango del dispositivo (por defecto 2–8 °C) la
// gradúa el Dispute Oracle (cargoDisputeOracle) y, si es moderada o crítica, el
// escrow pasa a DISPUTED. Se consulta con GET /v1/disputes.
export const SDK_BREACH: SdkCall = {
  method: 'POST', path: '/v1/iot/telemetry', role: 'device',
  body: { bUid: BUID, temperature: 22.8, humidity: 95, recordedAt: '<ISO>' },
  products: ['Edge Node', 'Dispute Oracle', 'BEZ-Pay Escrow'],
  note: 'Lectura fuera de rango (22,8 °C, rango 2–8 °C): el Dispute Oracle abre una disputa (HOLD_ESCROW) y el escrow pasa a DISPUTED. Ver GET /v1/disputes; se resuelve con POST /v1/disputes/:id/resolve.',
}

export const L2_TESTNET_CHAIN_ID = 2708;

export function sdkCallFor(stepId: number, breached: boolean): SdkCall | undefined {
  if (breached && stepId >= 11 && stepId <= 16) return SDK_BREACH;
  return SDK_BY_STEP[stepId];
}

export function toCurl(call: SdkCall, bUid: string): string {
  const path = call.path.replace(BUID, bUid);
  const body = call.body ? JSON.stringify(call.body).replace(/":bUid"/g, `"${bUid}"`) : null;
  const header = call.role === 'device'
    ? 'x-device-key: $DEVICE_KEY'
    : `x-api-key: $${call.role.toUpperCase()}_KEY`;
  return [
    `curl -X ${call.method} https://api.bezhas.com/api/cargolink${path} \\`,
    `  -H "${header}"${body ? ' \\' : ''}`,
    ...(body ? [`  -H "Content-Type: application/json" \\`, `  -d '${body}'`] : []),
  ].join('\n');
}
