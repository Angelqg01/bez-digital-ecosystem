import React, { useState, useEffect, useRef } from 'react';
import { Ship, Cpu, FileCheck, Box, ShieldCheck, AlertTriangle, ArrowRight, Zap, Database } from 'lucide-react';

export default function BeZhasLogisticsSimulator() {
  const [mode, setMode] = useState('manual'); // 'manual' | 'autonomous'
  const[step, setStep] = useState(0);
  const [logs, setLogs] = useState([]);
  const logsEndRef = useRef(null);

  // Auto-scroll para la consola de logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  },[logs]);

  // Motor de simulación
  useEffect(() => {
    let timer;
    if (mode === 'manual') {
      setStep(0);
      setLogs([
        "[08:00] 🚢 Buque carguero arribado al puerto.",
        "[08:15] ❌ Esperando inspector humano de aduanas...",
        "[11:30] ⚠️ Error: Manifiesto físico ilegible. Retraso documentario.",
        "[14:00] ⏳ Procesando contenedor MAEU1234567 manualmente.",
        "[16:45] ❌ Discrepancia en temperatura reportada vs registrada.",
        "[18:00] 🔒 Contenedor retenido en cuarentena. Costos de estadía aumentan."
      ]);
    } else if (mode === 'autonomous') {
      setLogs(["[SYS] Iniciando BeZhas Enterprise SDK v2.0.0..."]);
      setStep(1);
      
      const sequence =[
        { s: 1, delay: 1000, log: "[SDK] Conexión establecida con ToolBEZ BaaS. Fee Delegation ACTIVO." },
        { s: 2, delay: 2500, log: "[IoT] bezhas.oracle.recordIoTData({ id: 'MAEU1234567', temp: -18.5, status: 'OK' })" },
        { s: 2, delay: 3500, log: "[MCP] Aegis AI analizando manifiesto aduanero digital..." },
        { s: 3, delay: 5000, log: "[MCP] ✅ Análisis de documentos completado. 0% sesgo detectado. Validación aprobada." },
        { s: 3, delay: 6500, log: "[Web3] Ejecutando Multi-Task Transaction (MTT) para 50 contenedores..." },
        { s: 4, delay: 8000, log: "[Tokenomics] Contrato LogisticsContainer validado. Utility: 150 BEZ." },
        { s: 4, delay: 9000, log: "[Tokenomics] 🔥 0.3 BEZ quemados (Deflación 0.2%). Oráculo QuickSwap sincronizado." },
        { s: 5, delay: 10500, log: "[API] bezhas.logistics.updateShipmentStatus({ status: 'CLEARED' })" },
        { s: 5, delay: 11500, log: "[SYS] 🚀 Aduana liberada autónomamente. Tiempo total: 2.3 segundos." }
      ];

      sequence.forEach(({ s, delay, log }) => {
        timer = setTimeout(() => {
          setStep(s);
          setLogs(prev => [...prev, log]);
        }, delay);
      });
    }
    return () => clearTimeout(timer);
  }, [mode]);

  const steps =[
    { id: 1, title: "Ingesta IoT", icon: <Database className="w-6 h-6" /> },
    { id: 2, title: "Análisis IA (MCP)", icon: <Cpu className="w-6 h-6" /> },
    { id: 3, title: "Validación Web3", icon: <ShieldCheck className="w-6 h-6" /> },
    { id: 4, title: "Token Utility", icon: <Zap className="w-6 h-6" /> },
    { id: 5, title: "Despacho", icon: <Ship className="w-6 h-6" /> },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto p-6 bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 text-slate-200 font-sans">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 border-b border-slate-700 pb-6">
        <div>
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
            BeZhas Logistics & Customs Automation
          </h2>
          <p className="text-slate-400 mt-2">SDK Enterprise / Protocolo MCP / Validación Web3</p>
        </div>
        
        <div className="flex mt-6 md:mt-0 bg-slate-800 p-1 rounded-xl">
          <button 
            onClick={() => setMode('manual')}
            className={`px-6 py-3 rounded-lg flex items-center gap-2 transition-all font-medium ${mode === 'manual' ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <AlertTriangle className="w-5 h-5" />
            Gestión Manual (Humana)
          </button>
          <button 
            onClick={() => setMode('autonomous')}
            className={`px-6 py-3 rounded-lg flex items-center gap-2 transition-all font-medium ${mode === 'autonomous' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Zap className="w-5 h-5" />
            BeZhas SDK (Autónomo)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Visual Pipeline */}
        <div className="lg:col-span-2 space-y-8">
          {/* Status Badge */}
          <div className="flex items-center justify-between p-6 bg-slate-800/50 rounded-xl border border-slate-700">
            <div className="flex items-center gap-4">
              <Box className="w-12 h-12 text-blue-400" />
              <div>
                <h3 className="text-xl font-bold">Contenedor: MAEU1234567</h3>
                <p className="text-slate-400">Origen: Shanghai | Destino: Barcelona</p>
              </div>
            </div>
            {mode === 'manual' ? (
              <span className="px-4 py-2 bg-red-500/20 text-red-400 rounded-full font-bold border border-red-500/30">RETENIDO (Sesgo Humano)</span>
            ) : (
              <span className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-full font-bold border border-emerald-500/30 flex items-center gap-2">
                <FileCheck className="w-5 h-5" /> VALIDADO VÍA SMART CONTRACT
              </span>
            )}
          </div>

          {/* Stepper Animation (Only visible in autonomous mode) */}
          <div className={`transition-opacity duration-500 ${mode === 'autonomous' ? 'opacity-100' : 'opacity-30 grayscale'}`}>
            <h4 className="text-sm font-semibold text-slate-400 mb-6 uppercase tracking-wider">Flujo de Automatización BeZhas</h4>
            <div className="flex justify-between relative">
              {/* Connecting Line */}
              <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-700 -translate-y-1/2 z-0">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-1000 ease-out"
                  style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}
                ></div>
              </div>
              
              {/* Steps */}
              {steps.map((s) => (
                <div key={s.id} className="relative z-10 flex flex-col items-center gap-3">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center border-4 transition-all duration-500 ${step >= s.id ? 'bg-slate-900 border-emerald-400 text-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.4)]' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                    {s.icon}
                  </div>
                  <span className={`font-semibold text-sm ${step >= s.id ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {s.title}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Value Proposition Cards */}
          {mode === 'autonomous' && (
            <div className="grid grid-cols-2 gap-4 mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="p-5 bg-gradient-to-br from-indigo-900/40 to-slate-900 border border-indigo-500/30 rounded-xl">
                <h4 className="text-indigo-400 font-bold mb-2">Utilidad BEZ-Coin</h4>
                <p className="text-sm text-slate-300">El token es usado como validador de intercambio y pago de fees de aduana. 0.2% quemado automáticamente deflacionando la red.</p>
              </div>
              <div className="p-5 bg-gradient-to-br from-blue-900/40 to-slate-900 border border-blue-500/30 rounded-xl">
                <h4 className="text-blue-400 font-bold mb-2">Multi-Task Transact (MTT)</h4>
                <p className="text-sm text-slate-300">Agrupa más de 50 contenedores en un solo batch de verificación, ahorrando gas pagado por el Fee Delegation del Enterprise ToolBEZ.</p>
              </div>
            </div>
          )}
        </div>

        {/* Console Terminal */}
        <div className="bg-[#0D1117] rounded-xl border border-slate-700 font-mono text-sm overflow-hidden flex flex-col h-[500px] shadow-2xl">
          <div className="bg-slate-800 px-4 py-2 border-b border-slate-700 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <span className="ml-2 text-slate-400 text-xs">BeZhas_SDK_Runtime.log</span>
          </div>
          <div className="p-4 overflow-y-auto flex-1 space-y-2 text-slate-300">
            {logs.map((log, index) => (
              <div 
                key={index} 
                className={`animate-in fade-in slide-in-from-left-2 ${
                  log.includes('❌') || log.includes('⚠️') ? 'text-red-400' : 
                  log.includes('✅') || log.includes('🚀') ? 'text-emerald-400' : 
                  log.includes('[Tokenomics]') ? 'text-yellow-400' : 
                  log.includes('[MCP]') ? 'text-purple-400' : 'text-blue-300'
                }`}
              >
                {log}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}