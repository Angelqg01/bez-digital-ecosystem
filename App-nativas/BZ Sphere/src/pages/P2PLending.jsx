import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Coins, 
  TrendingUp, 
  ShieldCheck, 
  Users, 
  ArrowUpRight, 
  Plus,
  Zap,
  Clock,
  PieChart
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const P2PLending = () => {
  const navigate = useNavigate()
  const [showRequest, setShowRequest] = useState(false)

  const loans = [
    { 
      id: 1, 
      owner: 'Maria_Ventas', 
      title: 'Nuevo Invernadero Solar', 
      target: 2500, 
      raised: 1850, 
      interest: '5%', 
      risk: 'A+',
      img: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?q=80&w=200&auto=format&fit=crop'
    },
    { 
      id: 2, 
      owner: 'Pan_Paco', 
      title: 'Horno de Biomasa', 
      target: 1200, 
      raised: 400, 
      interest: '7%', 
      risk: 'B',
      img: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?q=80&w=200&auto=format&fit=crop'
    }
  ]

  return (
    <div className="flex flex-col h-full bg-[#10141a] p-6 pt-24 pb-32 overflow-y-auto">
      
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 text-[#79ff5b] mb-2">
          <Coins size={20} />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Finanzas Vecinales P2P</span>
        </div>
        <h1 className="font-space font-extrabold text-3xl text-white">Préstamos</h1>
        <p className="text-white/40 text-sm mt-2">Invierte en tu barrio. Financia el crecimiento local.</p>
      </header>

      {/* Credit Score Card */}
      <div className="glass-panel ghost-border border-[#79ff5b]/20 rounded-3xl p-6 mb-8 flex justify-between items-center bg-[#79ff5b5]">
        <div>
           <p className="text-[9px] text-white/40 uppercase font-black">Tu Credit Score</p>
           <h3 className="text-3xl font-extrabold font-space text-white tracking-tighter">842</h3>
           <p className="text-[10px] text-[#79ff5b] font-bold">Nivel: Confianza Total</p>
        </div>
        <div className="w-16 h-16 rounded-full border-4 border-[#79ff5b] border-t-transparent flex items-center justify-center rotate-45">
           <Zap size={24} className="text-[#79ff5b] -rotate-45" />
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-4 mb-12">
        <div className="glass-panel rounded-2xl p-4 border-white/5">
           <p className="text-[9px] text-white/40 uppercase font-black">Inversión Activa</p>
           <p className="text-xl font-bold text-white">450 €</p>
        </div>
        <div className="glass-panel rounded-2xl p-4 border-white/5">
           <p className="text-[9px] text-white/40 uppercase font-black">Interés Generado</p>
           <p className="text-xl font-bold text-[#79ff5b]">+12.4 €</p>
        </div>
      </div>

      {/* Active Requests */}
      <section className="space-y-6">
        <div className="flex justify-between items-center">
           <h3 className="font-space font-bold text-lg text-white">Oportunidades</h3>
           <button onClick={() => setShowRequest(true)} className="flex items-center gap-2 text-[10px] font-black text-[#00e5ff] uppercase">
              <Plus size={14} /> Solicitar Crédito
           </button>
        </div>

        {loans.map(loan => (
          <div key={loan.id} className="glass-panel rounded-3xl p-5 border-white/5 hover:bg-white/5 transition-all cursor-pointer">
             <div className="flex gap-4 mb-6">
                <img src={loan.img} className="w-20 h-20 rounded-2xl object-cover" alt="Business" />
                <div className="flex-1">
                   <div className="flex justify-between items-start">
                      <h4 className="text-sm font-bold text-white">{loan.title}</h4>
                      <span className="text-[9px] font-black text-[#79ff5b] bg-[#79ff5b10] px-2 py-0.5 rounded border border-[#79ff5b20]">{loan.risk}</span>
                   </div>
                   <p className="text-[10px] text-white/40 font-bold mb-3">{loan.owner}</p>
                   <div className="flex justify-between items-center text-[10px] text-white/60">
                      <span>{loan.raised} € / {loan.target} €</span>
                      <span className="font-space font-bold text-white">{loan.interest} APR</span>
                   </div>
                </div>
             </div>
             
             {/* Progress Bar */}
             <div className="w-full h-1.5 bg-black/40 rounded-full mb-6 overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(loan.raised / loan.target) * 100}%` }}
                  className="h-full bg-[#00e5ff] shadow-[0_0_10px_#00e5ff]"
                />
             </div>

             <button className="w-full py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase text-white hover:bg-[#79ff5b] hover:text-[#002700] transition-all">
                Participar en la Financiación
             </button>
          </div>
        ))}
      </section>

      {/* Floating Action Modal (Simplified) */}
      <AnimatePresence>
        {showRequest && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-xl p-8 flex flex-col justify-center"
          >
             <button onClick={() => setShowRequest(false)} className="absolute top-8 right-8 text-white/40"><Plus size={32} className="rotate-45" /></button>
             <h2 className="font-space font-extrabold text-3xl text-white mb-2">Solicitar Micro-Crédito</h2>
             <p className="text-white/40 text-sm mb-12">Usa tu reputación en el Nodo como aval.</p>
             
             <div className="space-y-6 mb-12">
                <div>
                   <label className="block text-[10px] font-black text-white/40 uppercase mb-2">Monto Necesario (€)</label>
                   <input type="number" className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-space text-xl outline-none focus:border-[#00e5ff]" placeholder="500.00" />
                </div>
                <div>
                   <label className="block text-[10px] font-black text-white/40 uppercase mb-2">Propósito</label>
                   <textarea className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white text-sm outline-none focus:border-[#00e5ff] h-32" placeholder="Describe brevemente en qué invertirás los créditos..." />
                </div>
             </div>

             <button className="w-full bg-[#79ff5b] text-[#002700] py-5 rounded-2xl font-extrabold text-xs uppercase">
                Enviar a Revisión de Nodo
             </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}

export default P2PLending
