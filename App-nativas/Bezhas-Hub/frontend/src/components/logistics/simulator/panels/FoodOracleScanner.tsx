import React, { useState, useEffect } from 'react';
import { DraggableWindow } from './DraggableWindow';
import { CargoConfig } from '../engine/cargos';
import { Scan, Activity, Cpu } from 'lucide-react';

interface FoodOracleScannerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCargo: CargoConfig;
  isBreached: boolean;
  containerRef?: React.RefObject<HTMLElement>;
}

interface ScanResult {
  volume: string;
  biomass: string;
  water: string;
  dryMatter: string;
  moldRisk: string;
  moldProb: string;
  findings: string;
  coordinates: { x: number; y: number; severity: 'high' | 'medium' | 'low' }[];
}

export const FoodOracleScanner: React.FC<FoodOracleScannerProps> = ({ isOpen, onClose, selectedCargo, isBreached, containerRef }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  useEffect(() => {
    setScanResult(null);
    setScanProgress(0);
    setIsScanning(false);
  }, [selectedCargo]);

  const handleScan = () => {
    if (isScanning) return;
    setIsScanning(true);
    setScanProgress(0);
    setScanResult(null);

    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsScanning(false);
          const moldProbability = isBreached ? 84.5 : 0.1;
          const waterContent = selectedCargo.id === 'wine' ? '88%' : selectedCargo.id === 'tuna' ? '68%' : '84%';
          const dryMatter = selectedCargo.id === 'wine' ? '12%' : selectedCargo.id === 'tuna' ? '32%' : '16%';
          setScanResult({
            volume: selectedCargo.volume,
            biomass: (parseFloat(selectedCargo.weight.replace(/[^0-9.]/g, '')) * 0.95).toFixed(0) + ' kg',
            water: waterContent,
            dryMatter,
            moldRisk: isBreached ? 'CRÍTICO' : 'EXCELENTE',
            moldProb: `${moldProbability}%`,
            findings: isBreached
              ? 'Excursión térmica de larga duración detectada. Desarrollo de microorganismos compatible con proliferación fúngica activa.'
              : 'Ausencia de colonias fúngicas activas. Estabilidad bioquímica verificada.',
            coordinates: Array.from({ length: 8 }).map(() => ({
              x: Math.floor(Math.random() * 100),
              y: Math.floor(Math.random() * 100),
              severity: isBreached ? (Math.random() > 0.4 ? 'high' : 'medium') : 'low',
            })),
          });
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  return (
    <DraggableWindow
      title="BeZhas Food Oracle"
      isOpen={isOpen}
      onClose={onClose}
      theme={isBreached ? 'amber' : 'cyan'}
      defaultPosition={{ x: 620, y: 180 }}
      width={340}
      maxHeight={430}
      containerRef={containerRef}
    >
      <div className="flex flex-col gap-3 font-mono text-[10px] text-zinc-300 relative pr-1">
        <div className="bg-zinc-900/60 border border-zinc-800 p-2.5 rounded flex flex-col gap-1.5 shadow-sm">
          <div className="flex justify-between items-center text-cyan-400 font-bold tracking-wider text-[9px]">
            <span>ORÁCULO BIOQUÍMICO INTEGRADOR</span>
            <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-1 rounded text-[8px]">v2.1</span>
          </div>
          <p className="text-zinc-400 text-[9px] leading-relaxed">
            Módulo IoT + IA que analiza biomasa, volumen neto y perfiles bioquímicos del activo agroalimentario en origen, tránsito y destino.
          </p>
        </div>

        <button
          onClick={handleScan}
          disabled={isScanning}
          className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded text-[10px] font-bold uppercase tracking-widest transition-all
            ${isScanning
              ? 'bg-cyan-950 text-cyan-400 border border-cyan-500/30 cursor-not-allowed'
              : 'bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/50 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]'}`}
        >
          <Scan size={12} className={isScanning ? 'animate-spin' : ''} />
          {isScanning ? `Escaneando: ${scanProgress}%` : 'Ejecutar Escaneo IoT BeZhas'}
        </button>

        {isScanning && (
          <div className="h-28 bg-black border border-cyan-900/40 rounded flex flex-col items-center justify-center relative overflow-hidden">
            <div
              className="absolute left-0 w-full h-0.5 bg-cyan-400 shadow-[0_0_10px_#22d3ee] z-10"
              style={{ top: `${scanProgress}%`, transition: 'top 0.2s linear' }}
            />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#022329_1px,transparent_1px),linear-gradient(to_bottom,#022329_1px,transparent_1px)] bg-[size:10px_10px] opacity-40"></div>
            <Activity className="text-cyan-500/50 animate-pulse" size={24} />
            <span className="text-cyan-400/80 mt-2 tracking-[0.3em] font-bold text-[8px] uppercase animate-pulse">Analizando Espectro Lumínico...</span>
          </div>
        )}

        {!isScanning && scanResult && (
          <div className="flex flex-col gap-2.5 animate-fadeIn">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-black/50 border border-zinc-800 p-2 rounded">
                <span className="text-zinc-500 block text-[8px]">VOLUMETRÍA LIDAR</span>
                <span className="text-cyan-400 font-bold">{scanResult.volume}</span>
              </div>
              <div className="bg-black/50 border border-zinc-800 p-2 rounded">
                <span className="text-zinc-500 block text-[8px]">BIOMASA CALCULADA</span>
                <span className="text-cyan-400 font-bold">{scanResult.biomass}</span>
              </div>
            </div>

            <div className="bg-black/40 border border-zinc-800/80 p-2 rounded flex flex-col gap-1.5">
              <span className="text-cyan-500 font-bold text-[9px] border-b border-zinc-800 pb-1 flex items-center gap-1">
                <Cpu size={10} /> COMPOSICIÓN QUÍMICA DE LA CARGA
              </span>
              <div className="flex justify-between"><span className="text-zinc-400">Humedad Natural</span><span className="text-zinc-200">{scanResult.water}</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Materia Seca</span><span className="text-zinc-200">{scanResult.dryMatter}</span></div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Calidad Fitosanitaria</span>
                <span className={`font-bold ${isBreached ? 'text-red-400' : 'text-emerald-400'}`}>{scanResult.moldRisk}</span>
              </div>
            </div>

            <div className="bg-black/60 border border-zinc-800 p-2 rounded flex flex-col gap-2">
              <div className="flex justify-between items-center border-b border-zinc-800 pb-1.5">
                <span className="text-cyan-500 font-bold text-[8px] uppercase tracking-wider">Mapeo de Patógenos (Visión IA)</span>
                <span className={`text-[8px] font-bold ${isBreached ? 'text-red-400 animate-pulse bg-red-950/40 px-1 rounded border border-red-500/20' : 'text-emerald-400'}`}>
                  Spore Prob: {scanResult.moldProb}
                </span>
              </div>
              <div className="h-24 bg-zinc-950 border border-zinc-900 rounded flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#111_1px,transparent_1px),linear-gradient(to_bottom,#111_1px,transparent_1px)] bg-[size:12px_12px] opacity-60"></div>
                <div className={`w-12 h-12 rounded-full border border-dashed flex items-center justify-center text-[18px]
                  ${isBreached ? 'border-red-500/30 bg-red-500/5 animate-pulse' : 'border-emerald-500/20 bg-emerald-500/5'}`}>
                  {selectedCargo.icon}
                </div>
                {scanResult.coordinates.map((pt, i) => (
                  <div
                    key={i}
                    className={`absolute w-1.5 h-1.5 rounded-full transition-all duration-300
                      ${pt.severity === 'high'
                        ? 'bg-red-500 border border-red-300 shadow-[0_0_8px_red] animate-ping'
                        : pt.severity === 'medium'
                          ? 'bg-amber-500 border border-amber-300 animate-pulse'
                          : 'bg-emerald-500/40'}`}
                    style={{ left: `${15 + pt.x * 0.7}%`, top: `${15 + pt.y * 0.7}%` }}
                    title={`Colonia detectada: Nivel ${pt.severity}`}
                  />
                ))}
              </div>
              <p className={`text-[8px] leading-relaxed italic border-t border-zinc-900 pt-1.5 ${isBreached ? 'text-red-300' : 'text-zinc-500'}`}>
                {scanResult.findings}
              </p>
            </div>
          </div>
        )}

        {!isScanning && !scanResult && (
          <div className="flex-1 border border-dashed border-zinc-800 rounded flex flex-col items-center justify-center p-6 text-center text-zinc-500">
            <Scan size={20} className="text-zinc-600 mb-2" />
            <p className="text-[9px] uppercase tracking-wider mb-1 font-bold">Sin Datos de Oráculo</p>
            <p className="text-[8px] text-zinc-600 leading-normal">
              Inicia el escáner volumétrico para interrogar masa, volumen e integridad enzimática de la carga mediante visión por computadora BeZhas.
            </p>
          </div>
        )}

        <div className="mt-auto border-t border-zinc-800/60 pt-2 flex justify-between text-[7px] text-zinc-600 uppercase">
          <span>Identificador: {selectedCargo.id.toUpperCase()}</span>
          <span>Sincronización: Activa</span>
        </div>
      </div>
    </DraggableWindow>
  );
};
