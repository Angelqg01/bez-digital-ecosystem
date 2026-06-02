import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  BarChart3, 
  TrendingUp, 
  PieChart as PieIcon, 
  Wallet, 
  ArrowUpRight, 
  Zap,
  Target,
  ShieldCheck,
  Calendar
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const InvestorDashboard = () => {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col h-full bg-[#10141a] p-6 pt-24 pb-32 overflow-y-auto">
      
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 text-[#f4ce00] mb-2">
          <Target size={20} />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Nodo Capital Management</span>
        </div>
        <h1 className="font-space font-extrabold text-3xl text-white">Inversor</h1>
        <p className="text-white/40 text-sm mt-2">Gestiona tu cartera de micro-créditos vecinales.</p>
      </header>

      {/* Portfolio Overview */}
      <div className="glass-panel ghost-border border-[#f4ce00]/20 rounded-3xl p-8 mb-8 relative overflow-hidden bg-[#f4ce005]">
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
             <div>
                <p className="text-[9px] text-white/40 uppercase font-black">Valor Total de Cartera</p>
                <h2 className="text-4xl font-extrabold font-space text-white tracking-tighter">5.420,50 €</h2>
             </div>
             <div className="bg-[#79ff5b10] px-3 py-1 rounded-full border border-[#79ff5b]/20 flex items-center gap-2">
                <TrendingUp size={12} className="text-[#79ff5b]" />
                <span className="text-[10px] font-bold text-[#79ff5b]">+12.5%</span>
             </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <div className="p-4 bg-black/20 rounded-2xl border border-white/5">
                <p className="text-[8px] text-white/20 uppercase font-black mb-1">Intereses Cobrados</p>
                <p className="text-lg font-bold text-[#79ff5b]">+342 €</p>
             </div>
             <div className="p-4 bg-black/20 rounded-2xl border border-white/5 text-right">
                <p className="text-[8px] text-white/20 uppercase font-black mb-1">En Riesgo (C/D)</p>
                <p className="text-lg font-bold text-[#ffb4ab]">0,00 €</p>
             </div>
          </div>
        </div>
        
        {/* Background Accent */}
        <div className="absolute top-0 right-0 p-8 opacity-5">
           <BarChart3 size={120} />
        </div>
      </div>

      {/* Asset Distribution */}
      <section className="mb-8">
        <h3 className="font-space font-bold text-lg text-white mb-6 flex items-center gap-3">
          <PieIcon size={18} className="text-[#00e5ff]" /> Distribución de Activos
        </h3>
        <div className="space-y-4">
           <AssetItem name="Producción Agrícola" weight="45%" color="#79ff5b" />
           <AssetItem name="Energía Comunitaria" weight="30%" color="#f4ce00" />
           <AssetItem name="Manufactura Artesana" weight="15%" color="#00e5ff" />
           <AssetItem name="Logística Última Milla" weight="10%" color="#ffb4ab" />
        </div>
      </section>

      {/* Recent Earnings */}
      <section className="mb-8">
         <div className="flex justify-between items-center mb-6">
            <h3 className="font-space font-bold text-lg text-white">Ingresos Pasivos</h3>
            <button className="text-[10px] font-black text-[#00e5ff] uppercase">Ver Calendario</button>
         </div>
         
         <div className="space-y-4">
            <div className="glass-panel rounded-2xl p-4 flex items-center justify-between border-white/5">
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#79ff5b10] flex items-center justify-center text-[#79ff5b]">
                     <Zap size={20} />
                  </div>
                  <div>
                     <h4 className="text-sm font-bold text-white">Retorno: Invernadero Maria</h4>
                     <p className="text-[10px] text-white/40 font-bold uppercase">Pago Mensual #3/12</p>
                  </div>
               </div>
               <div className="text-right">
                  <p className="text-sm font-bold text-[#79ff5b]">+42.50 €</p>
                  <p className="text-[8px] text-white/20 font-black uppercase">Confirmado</p>
               </div>
            </div>
         </div>
      </section>

      {/* Global Node Diversification */}
      <div className="glass-panel rounded-3xl p-6 border-[#00e5ff]/20 bg-[#00e5ff5]">
         <div className="flex items-center gap-4 mb-4">
            <ShieldCheck size={24} className="text-[#00e5ff]" />
            <h3 className="font-space font-bold text-sm text-white uppercase tracking-widest">Protección por Nodo</h3>
         </div>
         <p className="text-xs text-white/60 mb-6 leading-relaxed">
            Tu cartera está diversificada en 4 nodos regionales, reduciendo el riesgo de caída de demanda local en un 75%.
         </p>
         <button className="w-full py-4 bg-[#00e5ff] text-[#00363d] rounded-2xl font-extrabold text-[10px] uppercase">
            Expandir a Nodo Lisboa
         </button>
      </div>

    </div>
  )
}

const AssetItem = ({ name, weight, color }) => (
  <div className="flex items-center gap-4">
    <div className="flex-1">
      <div className="flex justify-between text-[10px] font-bold text-white mb-2 uppercase tracking-tighter">
        <span>{name}</span>
        <span>{weight}</span>
      </div>
      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: weight }}
          className="h-full"
          style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
        />
      </div>
    </div>
  </div>
)

export default InvestorDashboard
