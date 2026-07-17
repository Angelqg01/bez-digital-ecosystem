import React, { useState, useEffect, useRef } from 'react';
import { Ship, Cpu, FileCheck, Box, ShieldCheck, AlertTriangle, Zap, Database, X } from 'lucide-react';

interface ManualVsAutonomousProps {
  onClose: () => void;
}

// Modo intro "¿Por qué BeZhas?": comparativa gestión manual vs SDK autónomo
// (conservado del simulador anterior como argumento de venta)
export const ManualVsAutonomous: React.FC<ManualVsAutonomousProps> = ({ onClose }) => {
  const [mode, setMode] = useState<'manual' | 'autonomous'>('manual');
  const [step, setStep] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (mode === 'manual') {
      setStep(0);
      setLogs([
        '[08:00] 🚢 Buque carguero arribado al puerto.',
        '[08:15] ❌ Esperando inspector humano de aduanas...',
        '[11:30] ⚠️ Error: Manifiesto físico ilegible. Retraso documentario.',
        '[14:00] ⏳ Procesando contenedor MAEU1234567 manualmente.',
        '[16:45] ❌ Discrepancia en temperatura reportada vs registrada.',
        '[18:00] 🔒 Contenedor retenido en cuarentena. Costos de estadía aumentan.',
      ]);
    } else {
      setLogs(['[SYS] Iniciando BeZhas Enterprise SDK v2.0.0...']);
      setStep(1);
      const sequence = [
        { s: 1, delay: 1000, log: '[SDK] Conexión establecida con ToolBEZ BaaS. Fee Delegation ACTIVO.' },
        { s: 2, delay: 2500, log: "[IoT] bezhas.oracle.recordIoTData({ id: 'MAEU1234567', temp: -18.5, status: 'OK' })" },
        { s: 2, delay: 3500, log: '[MCP] Aegis AI analizando manifiesto aduanero digital...' },
        { s: 3, delay: 5000, log: '[MCP] ✅ Análisis de documentos completado. Validación aprobada.' },
        { s: 3, delay: 6500, log: '[Web3] Ejecutando Multi-Task Transaction (MTT) para 50 contenedores...' },
        { s: 4, delay: 8000, log: '[Tokenomics] Contrato LogisticsContainer validado. Utility: 150 BEZ.' },
        { s: 4, delay: 9000, log: '[Tokenomics] 🔥 0.3 BEZ quemados (Deflación 0.2%). Oráculo DEX sincronizado.' },
        { s: 5, delay: 10500, log: "[API] bezhas.logistics.updateShipmentStatus({ status: 'CLEARED' })" },
        { s: 5, delay: 11500, log: '[SYS] 🚀 Aduana liberada autónomamente. Tiempo total: 2.3 segundos.' },
      ];
      sequence.forEach(({ s, delay, log }) => {
        timers.push(setTimeout(() => {
          setStep(s);
          setLogs((prev) => [...prev, log]);
        }, delay));
      });
    }
    return () => timers.forEach(clearTimeout);
  }, [mode]);

  const steps = [
    { id: 1, title: 'Ingesta IoT', icon: <Database className="w-5 h-5" /> },
    { id: 2, title: 'Análisis IA (MCP)', icon: <Cpu className="w-5 h-5" /> },
    { id: 3, title: 'Validación Web3', icon: <ShieldCheck className="w-5 h-5" /> },
    { id: 4, title: 'Token Utility', icon: <Zap className="w-5 h-5" /> },
    { id: 5, title: 'Despacho', icon: <Ship className="w-5 h-5" /> },
  ];

  return (
    <div className="w-full p-6 bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 text-slate-200">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 border-b border-slate-700 pb-5">
        <div>
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-blue-400">
            ¿Por qué BeZhas? Manual vs Autónomo
          </h2>
          <p className="text-slate-400 mt-1 text-sm">El coste real de la gestión aduanera humana frente al SDK Enterprise</p>
        </div>
        <div className="flex items-center gap-3 mt-4 md:mt-0">
          <div className="flex bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setMode('manual')}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all text-sm font-medium ${mode === 'manual' ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <AlertTriangle className="w-4 h-4" /> Gestión Manual
            </button>
            <button
              onClick={() => setMode('autonomous')}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all text-sm font-medium ${mode === 'autonomous' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Zap className="w-4 h-4" /> BeZhas SDK
            </button>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors" title="Ir a la simulación 360">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-slate-700">
            <div className="flex items-center gap-4">
              <Box className="w-10 h-10 text-teal-400" />
              <div>
                <h3 className="text-lg font-bold">Contenedor: MAEU1234567</h3>
                <p className="text-slate-400 text-sm">Origen: Zona Franca | Destino: Distribuidor Final</p>
              </div>
            </div>
            {mode === 'manual' ? (
              <span className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-full font-bold border border-red-500/30 text-xs">RETENIDO (Sesgo Humano)</span>
            ) : (
              <span className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-full font-bold border border-emerald-500/30 flex items-center gap-2 text-xs">
                <FileCheck className="w-4 h-4" /> VALIDADO VÍA SMART CONTRACT
              </span>
            )}
          </div>

          <div className={`transition-opacity duration-500 ${mode === 'autonomous' ? 'opacity-100' : 'opacity-30 grayscale'}`}>
            <h4 className="text-xs font-semibold text-slate-400 mb-5 uppercase tracking-wider">Flujo de Automatización BeZhas</h4>
            <div className="flex justify-between relative">
              <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-700 -translate-y-1/2 z-0">
                <div
                  className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-1000 ease-out"
                  style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}
                ></div>
              </div>
              {steps.map((s) => (
                <div key={s.id} className="relative z-10 flex flex-col items-center gap-2">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center border-4 transition-all duration-500 ${step >= s.id ? 'bg-slate-900 border-emerald-400 text-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.4)]' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                    {s.icon}
                  </div>
                  <span className={`font-semibold text-xs ${step >= s.id ? 'text-emerald-400' : 'text-slate-500'}`}>{s.title}</span>
                </div>
              ))}
            </div>
          </div>

          {mode === 'autonomous' && (
            <div className="grid grid-cols-2 gap-4 mt-6 animate-fadeIn">
              <div className="p-4 bg-gradient-to-br from-teal-900/40 to-slate-900 border border-teal-500/30 rounded-xl">
                <h4 className="text-teal-400 font-bold mb-1 text-sm">Utilidad BEZ-Coin</h4>
                <p className="text-xs text-slate-300">El token valida el intercambio y paga los fees de aduana. 0.2% quemado automáticamente deflacionando la red.</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-blue-900/40 to-slate-900 border border-blue-500/30 rounded-xl">
                <h4 className="text-blue-400 font-bold mb-1 text-sm">Multi-Task Transact (MTT)</h4>
                <p className="text-xs text-slate-300">Agrupa 50+ contenedores en un solo batch de verificación, con gas cubierto por Fee Delegation del Enterprise ToolBEZ.</p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-[#0D1117] rounded-xl border border-slate-700 font-mono text-xs overflow-hidden flex flex-col h-[380px] shadow-2xl">
          <div className="bg-slate-800 px-4 py-2 border-b border-slate-700 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
            </div>
            <span className="ml-2 text-slate-400 text-[10px]">BeZhas_SDK_Runtime.log</span>
          </div>
          <div className="p-4 overflow-y-auto flex-1 space-y-2 text-slate-300 custom-scrollbar">
            {logs.map((log, index) => (
              <div
                key={index}
                className={`animate-fadeIn ${log.includes('❌') || log.includes('⚠️') ? 'text-red-400' :
                  log.includes('✅') || log.includes('🚀') ? 'text-emerald-400' :
                    log.includes('[Tokenomics]') ? 'text-yellow-400' :
                      log.includes('[MCP]') ? 'text-purple-400' : 'text-blue-300'}`}
              >
                {log}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-center">
        <button
          onClick={onClose}
          className="px-6 py-3 bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 text-white font-bold rounded-xl uppercase tracking-wider text-xs transition-all shadow-lg hover:shadow-teal-500/30"
        >
          Ver la simulación 360° completa (Origen → Distribuidor) →
        </button>
      </div>
    </div>
  );
};
