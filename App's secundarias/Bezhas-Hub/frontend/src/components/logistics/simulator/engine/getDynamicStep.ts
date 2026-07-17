import { SimulationStep } from './types';
import { CargoConfig } from './cargos';
import { BREACH_FROM_INDEX } from './flows';

// Motor dinámico: adapta cada paso base a la carga seleccionada y al estado de breach.
// El breach (rotura de cadena de frío) solo afecta desde la fase de tránsito en adelante.
export const getDynamicStep = (
  baseStep: SimulationStep,
  cargo: CargoConfig,
  stepIndex: number,
  isBreached: boolean
): SimulationStep => {
  const hasTelemetry = !!baseStep.telemetry;
  const breachActive = isBreached && stepIndex >= BREACH_FROM_INDEX;

  let temp = baseStep.telemetry?.temp;
  let humidity = baseStep.telemetry?.humidity;
  let statusText = baseStep.telemetry?.status;
  let stepMsg = baseStep.msg;
  let stepBc = baseStep.bc;
  const stepStatus = { ...baseStep.status };
  let validations = [...baseStep.validations];
  let escrowStatus = baseStep.escrow;

  // 1. Telemetría dinámica según carga y breach
  if (hasTelemetry) {
    if (breachActive) {
      if (cargo.isCryo) {
        temp = '10.4°C';
      } else if (cargo.id === 'wine') {
        temp = '28.5°C';
      } else {
        temp = '22.8°C';
      }
      humidity = '95%';
      statusText = '🚨 ALERTA: EXCURSIÓN TÉRMICA CRÍTICA';
      stepStatus.oraculo = '⚠️ ANOMALÍA';
      stepStatus.contract = '🛑 DEPÓSITO DETENIDO';
    } else {
      // Fases refrigeradas: desde el transporte a ZF (índice 2) en adelante
      const isRefrigeratedPhase = stepIndex >= 2;
      if (isRefrigeratedPhase) {
        temp = `${cargo.optimalTemp.toFixed(1)}°C`;
        humidity = `${cargo.optimalHum}%`;
        statusText = cargo.statusText;
      }
    }
  }

  // 2. Sustituciones de texto según la carga
  stepMsg = stepMsg
    .replace('lote físico agroalimentario', `lote de ${cargo.name}`)
    .replace('arándanos', cargo.name.split(' ')[0].toLowerCase());

  validations = validations.map((v) =>
    v
      .replace('arándanos', cargo.name.split(' ')[0].toLowerCase())
      .replace('temperatura idónea 5.5°C', `temperatura idónea ${cargo.optimalTemp}°C`)
      .replace('Correcta (4.0°C)', `Correcta (${cargo.optimalTemp.toFixed(1)}°C)`)
      .replace('Correcta (1.8°C)', `Correcta (${cargo.optimalTemp.toFixed(1)}°C)`)
  );

  // 3. Escrow y contrato en caso de breach
  if (breachActive) {
    if (baseStep.bUidStage === 'DELIVERED') {
      stepMsg = `Distribuidor Final: Se constata la Prueba de Entrega (PoD) con incidencias graves. El oráculo detectó una rotura severa de la cadena de frío tras salir de la Zona Franca de Origen (temperatura máxima registrada: ${temp}). El Smart Contract de Escrow detiene la liquidación final, congela los fondos de garantía automáticamente y activa un protocolo de disputa L2 contra el transportista.`;
      stepBc = 'TX L2: 0x9c4e...81fd | Payout HALTED | Escrow: FROZEN (Dispute Active) | Alert: BEZ-ERR-501';
      escrowStatus = 'HALTED (DISPUTE)';
      validations = [
        '[SMART CONTRACT] 🛑 Pago congelado automáticamente en Escrow L2 por fallo de telemetría de cadena de frío.',
        '[ORÁCULO] Informe forense de excursión térmica inyectado en el Pasaporte Digital de Producto (DPP).',
        '[LEDGER] Alerta de disputa distribuida a los nodos validadores para arbitraje multifirma.',
      ];
    } else {
      validations.push(
        `[ALERTA SMART CONTRACT] ⚠️ Temperatura fuera de rango crítico de seguridad (${temp} > ${cargo.criticalLimit}°C).`
      );
    }
  }

  return {
    ...baseStep,
    msg: stepMsg,
    bc: stepBc,
    status: stepStatus,
    escrow: escrowStatus,
    telemetry: hasTelemetry
      ? {
          temp: temp!,
          humidity: humidity!,
          shock: baseStep.telemetry!.shock,
          status: statusText!,
        }
      : undefined,
    validations,
  };
};
