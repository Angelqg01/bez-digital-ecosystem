import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Zap, 
  Sun, 
  Battery, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Activity,
  History,
  ShieldCheck,
  TrendingUp,
  Cpu
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const EnergyModule = () => {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col h-full bg-[#10141a] p-6 pt-24 pb-32 overflow-y-auto">
      
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 text-[#f4ce00] mb-2">
          <Cpu size={20} />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">BeZhas Energy 4.0 Nexus</span>
        </div>
        <h1 className="font-space font-extrabold text-3xl text-white">Energía</h1>
        <p className="text-white/40 text-sm mt-2">Monitorea y comercializa el excedente de tu Nodo.</p>
      </header>

      {/* Real-time Grid Status */}
      <div className="glass-panel ghost-border border-[#f4ce00]/20 rounded-3xl p-8 mb-8 relative overflow-hidden bg-[#f4ce002]">
        <div className="relative z-10 flex flex-col items-center">
           <div className="w-48 h-48 relative flex items-center justify-center mb-6">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 rounded-full border-4 border-dashed border-[#f4ce00]/20"
              />
              <div className="text-center">
                 <p className="text-[10px] text-white/40 font-black uppercase mb-1">Producción Nodo</p>
                 <h2 className="text-4xl font-extrabold font-space text-white">42.5</h2>
                 <p className="text-[10px] text-[#f4ce00] font-bold">kWh / hr</p>
              </div>
              {/* Pulse Effect */}
              <motion.div 
                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.1, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 bg-[#f4ce00] rounded-full blur-3xl -z-10"
              />
           </div>

           <div className="grid grid-cols-2 gap-8 w-full">
              <div className="text-center border-r border-white/5">
                 <p className="text-[9px] text-white/40 uppercase font-black mb-1">Consumo</p>
                 <p className="text-lg font-bold text-white">28.2 <span className="text-[10px] text-white/40">kWh</span></p>
              </div>
              <div className="text-center">
                 <p className="text-[9px] text-white/40 uppercase font-black mb-1">Excedente</p>
                 <p className="text-lg font-bold text-[#79ff5b]">+14.3 <span className="text-[10px] text-[#79ff5b]/40">kWh</span></p>
              </div>
           </div>
        </div>
      </div>

      {/* Energy Trading Market */}
      <section className="mb-8">
        <div className="flex justify-between items-center mb-6">
           <h3 className="font-space font-bold text-lg text-white">Mercado de Energía</h3>
           <div className="flex items-center gap-2 text-[#79ff5b] text-[10px] font-black uppercase tracking-widest">
              <TrendingUp size={12} /> Alta Demanda
           </div>
        </div>

        <div className="space-y-4">
           <EnergyTradeItem 
             title="Fábrica de Conservas #4" 
             type="Venta" 
             amount="10 kWh" 
             price="2.50" 
             status="Completado" 
           />
           <EnergyTradeItem 
             title="Nodo Cádiz Puerto" 
             type="Venta" 
             amount="4 kWh" 
             price="1.10" 
             status="En Proceso" 
           />
           <EnergyTradeItem 
             title="Batería Comunitaria B-01" 
             type="Almacenaje" 
             amount="22 kWh" 
             price="0.00" 
             status="Cargando" 
           />
        </div>
      </section>

      {/* Optimization Tips */}
      <div className="glass-panel rounded-3xl p-6 border-[#79ff5b]/20 bg-[#79ff5b5]">
         <div className="flex items-center gap-4 mb-4">
            <Sun size={24} className="text-[#f4ce00]" />
            <h3 className="font-space font-bold text-sm text-white uppercase tracking-widest">Consejo del Oráculo</h3>
         </div>
         <p className="text-xs text-white/60 mb-6 leading-relaxed">
            Se prevé un aumento de irradicación solar en 2h. Recomendamos programar la carga de baterías V2G ahora para maximizar el excedente vendible.
         </p>
         <button className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl font-extrabold text-[10px] uppercase text-white hover:bg-white/10 transition-all">
            Programar Optimización IA
         </button>
      </div>

    </div>
  )
}

const EnergyTradeItem = ({ title, type, amount, price, status }) => (
  <div className="glass-panel rounded-2xl p-4 flex items-center justify-between border-white/5">
    <div className="flex items-center gap-4">
       <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${type === 'Venta' ? 'bg-[#79ff5b10] text-[#79ff5b]' : 'bg-[#00e5ff10] text-[#00e5ff]'}`}>
          {type === 'Venta' ? <ArrowUpRight size={20} /> : <Battery size={20} />}
       </div>
       <div>
          <h4 className="text-sm font-bold text-white">{title}</h4>
          <p className="text-[10px] text-white/40 font-bold uppercase">{type} • {amount}</p>
       </div>
    </div>
    <div className="text-right">
       <p className="text-sm font-bold text-white">{price > 0 ? `${price} €` : '--'}</p>
       <span className="text-[8px] text-white/20 font-black uppercase tracking-tighter">{status}</span>
    </div>
  </div>
)

export default EnergyModule
