import { SimulationStep, TransitMode } from '../types';
import { VALIDATORS } from '../validators';

// FASE B — TRÁNSITO INTERNACIONAL (punto de inyección del breach de cadena de frío)
export const buildTransitSteps = (mode: TransitMode): SimulationStep[] => [
  mode === 'sea'
    ? {
        id: 11,
        phase: 'transit',
        locationIndex: 7,
        vehicle: 'buque',
        timeMs: 4500,
        activeNodes: ['oraculo', 'contract'],
        status: { rwa: 'TRÁNSITO MARÍTIMO', contract: 'e-BL Active', mcp: 'Marine Fleet Sync', oraculo: 'Sat IoT Link' },
        msg: 'Tránsito Marítimo (Naviera): El buque portacontenedores cruza la ruta transoceánica. El oráculo marítimo transmite por satélite el estado térmico del contenedor refrigerado en tiempo real para evitar disputas por rotura de frío, y la póliza paramétrica vigila desvíos de ruta y retrasos.',
        bc: 'SAT ORACLE: TEMP+HUM+GPS @60s | Cargo Fingerprint Anchor: 0x7c4e...a1 | e-BL DCSA Active',
        bUidStage: 'IN_TRANSIT',
        actor: 'naviera',
        escrow: 'LOCKED',
        validator: VALIDATORS.naviera,
        metrics: { km: 1886, co2: 1420, fuel: 610 },
        telemetry: { temp: '4.2°C', humidity: '82%', shock: '0.5g', status: 'Cold-chain ACTIVE' },
        validations: [
          '[NAVIERA] Transmisión satelital activa de humedad, temperatura y vibraciones (IoT).',
          '[ORÁCULO] Cada lectura térmica anclada al ledger para trazabilidad forense.',
          '[SMART CONTRACT] Seguro paramétrico monitorizando desvíos de ruta y retrasos.',
        ],
      }
    : {
        id: 11,
        phase: 'transit',
        locationIndex: 12,
        vehicle: 'avion',
        timeMs: 4500,
        activeNodes: ['oraculo', 'contract'],
        status: { rwa: 'TRÁNSITO AÉREO', contract: 'e-AWB Active', mcp: 'Air Traffic Sync', oraculo: 'Aero IoT Link' },
        msg: 'Tránsito Aéreo (Aerolínea): La aeronave de carga despega en ruta transoceánica. El oráculo de BeZhas enlaza datos en tiempo real de radar aeronáutico y telemetría IoT vía satélite, registrando altitud, presión barométrica y temperatura del contenedor en el ledger inmutable de L2.',
        bc: 'WEBHOOK: ON_FLIGHT_DEPARTED | FlightRef: BZ-AIR-747 | eAWB Hash: 0xF1FA...A2',
        bUidStage: 'IN_TRANSIT',
        actor: 'aerolinea',
        escrow: 'LOCKED',
        validator: VALIDATORS.aerolinea,
        metrics: { km: 1136, co2: 980, fuel: 420 },
        telemetry: { temp: '2.1°C', humidity: '70%', shock: '0.3g', status: 'Airborne' },
        validations: [
          '[AEROLÍNEA] Salida aérea certificada e inyectada por oráculo de radar aeronáutico en la L2.',
          '[ORÁCULO] Monitoreo satelital de humedad, temperatura y diferencial de presión barométrica.',
          '[TOKENIZACIÓN] Póliza de seguro paramétrico aérea activa vinculada a desvíos de altitud.',
        ],
      },
];
