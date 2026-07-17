// Tipos del Simulador Logístico 360° BeZhas
// Flujo continuo: Fábrica de Origen -> Zona Franca -> Tránsito Internacional -> Destino -> Distribuidor Final

export type ActiveNode = 'rwa' | 'contract' | 'mcp' | 'oraculo' | null;

export type Phase = 'origin' | 'transit' | 'destination';

export type TransitMode = 'sea' | 'air';

export type VehicleType = 'camion' | 'buque' | 'avion' | 'none';

export interface Validator {
  name: string;
  did: string;
  icon: string; // emoji
}

export interface StepMetrics {
  km: number;   // km acumulados
  co2: number;  // kg CO2 acumulados
  fuel: number; // litros acumulados
}

export interface Telemetry {
  temp: string;
  humidity: string;
  shock: string;
  status: string;
}

export interface SimulationStep {
  id: number;
  phase: Phase;
  locationIndex: number;
  vehicle: VehicleType;
  timeMs: number;
  activeNodes: ActiveNode[];
  status: {
    rwa: string;
    contract: string;
    mcp: string;
    oraculo: string;
  };
  msg: string;
  bc: string;
  bUidStage: string;
  actor: string;
  escrow: string;
  validator: Validator;
  metrics: StepMetrics;
  telemetry?: Telemetry;
  validations: string[];
}

export interface LocationNode {
  name: string;
  type: 'factory' | 'warehouse' | 'customs' | 'gate' | 'port' | 'airport' | 'customer';
  position: [number, number, number];
}

// Identificador unificado con el ciclo de vida B-UID de BZ CargoLink
export const B_UID = 'TC-2847-CAD-ZFC-2026';
export const ESCROW_COLLATERAL_BEZ = 10000;
export const TARIFF_BEZ = 450;
export const PAYOUT_BEZ = 9550;

// Layout 3D: cluster Zona Franca Origen (izquierda) -> mar/aire (centro) -> cluster destino (derecha)
export const LOCATIONS: LocationNode[] = [
  { name: 'Fábrica · Origen',        type: 'factory',   position: [-23, 0, -6] },  // 0
  { name: 'Embalaje RFID',           type: 'warehouse', position: [-19, 0, -2] },  // 1
  { name: 'Acceso Zona Franca',      type: 'gate',      position: [-15, 0, 2] },   // 2
  { name: 'Almacén ZF (Dep. Franco)',type: 'warehouse', position: [-12, 0, -2] },  // 3
  { name: 'Validación Aduanera',     type: 'customs',   position: [-9, 0, 2] },    // 4
  { name: 'Inspección Física',       type: 'customs',   position: [-6, 0, -2] },   // 5
  { name: 'Muelle de Origen',         type: 'port',      position: [-3, 0, 3] },    // 6
  { name: 'Puerto Destino',          type: 'port',      position: [10, 0, 3] },    // 7
  { name: 'Aduana Destino',          type: 'customs',   position: [14, 0, 0] },    // 8
  { name: 'Almacén Despacho',        type: 'warehouse', position: [17, 0, -3] },   // 9
  { name: 'Distribuidor Final',      type: 'customer',  position: [21, 0, -6] },   // 10
  { name: 'Aeropuerto de Origen',     type: 'airport',   position: [-3, 0, -7] },   // 11
  { name: 'Aeropuerto Destino',      type: 'airport',   position: [10, 0, -7] },   // 12
];
