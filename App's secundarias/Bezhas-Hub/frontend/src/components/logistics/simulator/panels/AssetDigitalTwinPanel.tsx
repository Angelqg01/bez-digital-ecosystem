import React from 'react';
import { DraggableWindow } from './DraggableWindow';
import { CargoConfig } from '../engine/cargos';
import { Telemetry } from '../engine/types';

interface AssetDigitalTwinPanelProps {
  bUid: string;
  isOpen: boolean;
  onClose: () => void;
  isRunning: boolean;
  isFinished: boolean;
  telemetry?: Telemetry;
  selectedCargo: CargoConfig;
  isBreached: boolean;
  containerRef?: React.RefObject<HTMLElement>;
}

export const AssetDigitalTwinPanel: React.FC<AssetDigitalTwinPanelProps> = ({
  bUid, isOpen, onClose, isRunning, isFinished, telemetry, selectedCargo, isBreached, containerRef,
}) => {
  let tempVal = selectedCargo.optimalTemp;
  let shockVal = 0;
  if (telemetry) {
    tempVal = parseFloat(telemetry.temp);
    shockVal = parseFloat(telemetry.shock);
  }

  const maxShock = parseFloat(selectedCargo.shockTolerance.replace(/[^0-9.]/g, '')) || 1.5;
  const hasShockWarning = shockVal >= maxShock;

  let hasTempWarning = isBreached;
  if (!hasTempWarning && telemetry) {
    if (selectedCargo.isCryo) {
      hasTempWarning = tempVal > selectedCargo.criticalLimit;
    } else if (selectedCargo.id === 'wine') {
      hasTempWarning = tempVal > selectedCargo.criticalLimit || tempVal < 10.0;
    } else {
      hasTempWarning = tempVal > selectedCargo.criticalLimit;
    }
  }

  const hasRisk = isRunning && (hasShockWarning || hasTempWarning);
  const isCurrentlyBreached = hasTempWarning || (isFinished && isBreached);

  let complianceScore = 100.0;
  if (isRunning) complianceScore = 99.8;
  if (hasRisk || isCurrentlyBreached) {
    complianceScore = hasShockWarning && hasTempWarning ? 62.4 : 78.5;
  }
  const complianceScoreStr = isFinished && !isBreached ? '100.0%' : `${complianceScore.toFixed(1)}%`;

  return (
    <DraggableWindow
      title="Asset Digital Twin"
      isOpen={isOpen}
      onClose={onClose}
      theme={isCurrentlyBreached ? 'amber' : 'emerald'}
      defaultPosition={{ x: 300, y: 90 }}
      width={320}
      maxHeight={460}
      containerRef={containerRef}
    >
      <div className="flex flex-col gap-3 font-mono text-[10px] text-zinc-300 relative animate-fadeIn">
        {isCurrentlyBreached && (
          <div className="bg-amber-950/90 border border-amber-500/50 p-2 rounded shadow-[0_0_15px_rgba(217,119,6,0.3)] animate-pulse flex flex-col gap-1">
            <div className="flex justify-between items-center text-amber-500 font-bold tracking-widest text-[9px]">
              <span>PREDICTIVE RISK INTELLIGENCE</span>
              <span>⚠️ ALERT</span>
            </div>
            <div className="bg-black/40 p-1.5 rounded text-amber-200">
              {hasShockWarning && <div>• Impacto elevado detectado: {telemetry?.shock} (Máx {selectedCargo.shockTolerance})</div>}
              <div>• Rotura de límite térmico: {telemetry?.temp} (Límite: {selectedCargo.criticalLimit}°C)</div>
              <div className="text-amber-500/80 mt-1 italic">Validación del oráculo requerida para la siguiente transición de estado.</div>
            </div>
          </div>
        )}

        <div className={`h-28 w-full border ${isCurrentlyBreached ? 'border-amber-900/50 shadow-[0_0_15px_rgba(217,119,6,0.2)]' : 'border-emerald-900/50'} bg-black/40 rounded flex items-center justify-center relative overflow-hidden shrink-0`}>
          <div className={`w-16 h-16 border-2 ${isCurrentlyBreached ? 'border-amber-500/30' : 'border-emerald-500/30'} rounded animate-[spin_10s_linear_infinite] absolute mix-blend-screen`} style={{ transform: 'rotateX(60deg) rotateY(45deg)' }}></div>
          <div className={`w-12 h-12 border ${isCurrentlyBreached ? 'border-amber-500/50' : 'border-emerald-500/50'} rounded animate-[spin_8s_linear_infinite_reverse] absolute mix-blend-screen`} style={{ transform: 'rotateX(40deg) rotateY(30deg)' }}></div>
          <span className={`${isCurrentlyBreached ? 'text-amber-500/50' : 'text-emerald-500/50'} font-bold tracking-[0.2em] z-10 drop-shadow-md text-[9px]`}>RWA_MESH_LOADED</span>
        </div>

        <div className="flex flex-col gap-2 flex-1">
          <div className="bg-emerald-950/20 border border-emerald-900/30 p-2 rounded flex justify-between items-center">
            <span className="text-emerald-600">B-UID</span>
            <span className="text-emerald-400 font-bold">{bUid}</span>
          </div>

          <div className="bg-emerald-950/20 border border-emerald-900/30 p-2 rounded flex flex-col gap-1">
            <span className="text-emerald-600 border-b border-emerald-900/50 pb-1 mb-1">PROPIEDADES FÍSICAS (RWA)</span>
            <div className="flex justify-between items-center bg-black/40 px-2 py-1 rounded"><span className="text-zinc-500">Producto</span><span className="text-zinc-300">{selectedCargo.name}</span></div>
            <div className="flex justify-between items-center bg-black/40 px-2 py-1 rounded"><span className="text-zinc-500">Peso Bruto</span><span className="text-zinc-300">{selectedCargo.weight}</span></div>
            <div className="flex justify-between items-center bg-black/40 px-2 py-1 rounded"><span className="text-zinc-500">Volumen Neto</span><span className="text-zinc-300">{selectedCargo.volume}</span></div>
            <div className="flex justify-between items-center bg-black/40 px-2 py-1 rounded"><span className="text-zinc-500">Origen</span><span className="text-zinc-300">{selectedCargo.broker}</span></div>
          </div>

          <div className="bg-emerald-950/20 border border-emerald-900/30 p-2 rounded flex flex-col gap-1">
            <span className="text-emerald-600 border-b border-emerald-900/50 pb-1 mb-1">CLASIFICACIÓN LOGÍSTICA</span>
            <div className="flex justify-between items-center bg-black/40 px-2 py-1 rounded"><span className="text-zinc-500">Tipo de Carga</span><span className="text-amber-400 font-bold">{selectedCargo.typeLabel}</span></div>
            <div className="flex justify-between items-center bg-black/40 px-2 py-1 rounded"><span className="text-zinc-500">Rango de Temp.</span><span className="text-emerald-400">{selectedCargo.tempRange}</span></div>
            <div className="flex justify-between items-center bg-black/40 px-2 py-1 rounded"><span className="text-zinc-500">Tolerancia Shock</span><span className="text-zinc-300">{selectedCargo.shockTolerance}</span></div>
          </div>

          <div className="bg-emerald-950/20 border border-emerald-900/30 p-2 rounded flex flex-col gap-1">
            <div className="flex justify-between items-center mb-1">
              <span className="text-emerald-600 pb-1 flex-1 mr-2">COMPLIANCE SCORE</span>
              <span className={`text-[11px] font-bold ${isFinished && !isBreached ? 'text-emerald-400' : isCurrentlyBreached ? 'text-red-400 animate-pulse' : isRunning ? 'text-amber-400 animate-pulse' : 'text-zinc-500'}`}>
                {complianceScoreStr}
              </span>
            </div>
            <div className="w-full bg-black/60 h-1.5 rounded-full overflow-hidden border border-white/5 relative">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${isFinished && !isBreached ? 'bg-emerald-500' : isCurrentlyBreached ? 'bg-red-500 animate-pulse' : isRunning ? 'bg-amber-500 animate-pulse' : 'bg-zinc-600'}`}
                style={{ width: isRunning || isFinished ? `${complianceScore}%` : '100%' }}
              ></div>
            </div>
            <div className="text-[8px] text-zinc-500 mt-1 flex justify-between">
              <span>Telemetry: <span className={isCurrentlyBreached ? 'text-red-500 font-bold' : 'text-emerald-500/70'}>{isCurrentlyBreached ? 'BREACHED' : 'VERIFIED'}</span></span>
              <span>Oracle Sync: <span className={isRunning ? 'text-amber-500/70' : 'text-emerald-500/70'}>{isRunning ? 'SYNCING' : 'OK'}</span></span>
            </div>
          </div>

          <div className="bg-emerald-950/20 border border-emerald-900/30 p-2 rounded flex justify-between items-center">
            <span className="text-emerald-600">STATE</span>
            <span className={isFinished ? 'text-emerald-500' : isRunning ? 'text-amber-400' : 'text-zinc-500'}>
              {isFinished ? 'DELIVERED' : isRunning ? 'IN-TRANSIT' : 'IDLE'}
            </span>
          </div>
        </div>
      </div>
    </DraggableWindow>
  );
};
