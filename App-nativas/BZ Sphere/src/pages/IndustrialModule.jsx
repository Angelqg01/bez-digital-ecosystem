import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Factory, 
  Cpu, 
  Zap, 
  Settings, 
  Activity, 
  Package, 
  Gauge, 
  ArrowUpRight,
  ShieldCheck,
  Power,
  TrendingUp
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const IndustrialModule = () => {
  const navigate = useNavigate()
  const [activeMachine, setActiveMachine] = useState(null)

  const machines = [
    { id: 'M-01', name: 'Procesadora de Conservas', status: 'Running', energy: '12.5 kWh', output: '450 units/hr', health: 98 },
    { id: 'M-02', name: 'Extractor de Aceite Cold-Press', status: 'Idle', energy: '0.2 kWh', output: '0 units/hr', health: 100 },
    { id: 'M-03', name: 'Envasadora Bio-Plástico', status: 'Warning', energy: '8.4 kWh', output: '120 units/hr', health: 75 }
  ]

  return (
    <div className="flex flex-col h-full bg-[#10141a] p-6 pt-24 pb-32 overflow-y-auto">
      
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 text-[#79ff5b] mb-2">
          <Factory size={20} />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">BeZhas Industrial 4.0 Node</span>
        </div>
        <h1 className="font-space font-extrabold text-3xl text-white">Producción</h1>
        <p className="text-white/40 text-sm mt-2">Gestión de manufactura local impulsada por excedente energético.</p>
      </header>

      {/* Energy Injection Status */}
      <div className="glass-panel ghost-border border-[#79ff5b]/20 rounded-3xl p-6 mb-8 flex items-center justify-between bg-[#79ff5b2]">
         <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#79ff5b10] rounded-2xl flex items-center justify-center text-[#79ff5b]">
               <Zap size={24} className="animate-pulse" />
            </div>
            <div>
               <p className="text-[9px] text-white/40 uppercase font-black">Inyección BeZhas Energy</p>
               <h3 className="text-lg font-bold text-white">21.4 kWh Activos</h3>
            </div>
         </div>
         <div className="text-right">
            <p className="text-[9px] text-[#79ff5b] font-bold uppercase">Costo Optimizada</p>
            <p className="text-xs font-space font-bold text-white">0.08 BEZ / kWh</p>
         </div>
      </div>

      {/* Factory Floor Stats */}
      <div className="grid grid-cols-2 gap-4 mb-8">
         <div className="glass-panel rounded-2xl p-5 border-white/5">
            <Activity size={20} className="text-[#00e5ff] mb-2" />
            <p className="text-[9px] text-white/40 uppercase font-black">OEE Global</p>
            <p className="text-xl font-bold text-white">92.4%</p>
         </div>
         <div className="glass-panel rounded-2xl p-5 border-white/5">
            <Package size={20} className="text-[#f4ce00] mb-2" />
            <p className="text-[9px] text-white/40 uppercase font-black">Lotes Pendientes</p>
            <p className="text-xl font-bold text-white">14</p>
         </div>
      </div>

      {/* Machine Monitor */}
      <section className="mb-8">
        <h3 className="font-space font-bold text-lg text-white mb-6">Líneas de Producción</h3>
        <div className="space-y-4">
           {machines.map(machine => (
             <div 
               key={machine.id} 
               onClick={() => setActiveMachine(machine)}
               className="glass-panel rounded-2xl p-4 border-white/5 hover:border-[#79ff5b]/40 transition-all cursor-pointer"
             >
                <div className="flex justify-between items-start mb-4">
                   <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${machine.status === 'Running' ? 'bg-[#79ff5b] shadow-[0_0_8px_#79ff5b]' : machine.status === 'Idle' ? 'bg-white/20' : 'bg-[#ffb4ab]'}`} />
                      <h4 className="text-sm font-bold text-white">{machine.name}</h4>
                   </div>
                   <span className="text-[9px] font-black text-white/30 uppercase">{machine.id}</span>
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                   <div className="bg-black/20 p-2 rounded-xl text-center">
                      <p className="text-[8px] text-white/20 uppercase font-black">Energía</p>
                      <p className="text-[10px] font-bold text-white">{machine.energy}</p>
                   </div>
                   <div className="bg-black/20 p-2 rounded-xl text-center">
                      <p className="text-[8px] text-white/20 uppercase font-black">Salida</p>
                      <p className="text-[10px] font-bold text-white">{machine.output}</p>
                   </div>
                   <div className="bg-black/20 p-2 rounded-xl text-center">
                      <p className="text-[8px] text-white/20 uppercase font-black">Salud</p>
                      <p className={`text-[10px] font-bold ${machine.health > 90 ? 'text-[#79ff5b]' : 'text-[#ffb4ab]'}`}>{machine.health}%</p>
                   </div>
                </div>
             </div>
           ))}
        </div>
      </section>

      {/* Smart Contract Logic Bridge */}
      <div className="glass-panel rounded-3xl p-6 border-[#00e5ff]/20 bg-[#00e5ff5]">
         <div className="flex items-center gap-4 mb-4">
            <ShieldCheck size={24} className="text-[#00e5ff]" />
            <h3 className="font-space font-bold text-sm text-white uppercase tracking-widest">Liquidación Automática</h3>
         </div>
         <p className="text-xs text-white/60 mb-6 leading-relaxed">
            Los consumos de energía se liquidan cada 100 bloques directamente al Tesoro del Nodo mediante Smart Contracts.
         </p>
         <div className="flex justify-between items-center bg-black/20 px-4 py-3 rounded-xl border border-white/5">
            <span className="text-[10px] font-bold text-white/40 uppercase">Pendiente Liquidar</span>
            <span className="text-sm font-bold text-[#f4ce00]">12.40 BEZ</span>
         </div>
      </div>

    </div>
  )
}

export default IndustrialModule
