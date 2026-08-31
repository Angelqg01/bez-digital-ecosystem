import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Gavel, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Info,
  Clock,
  Zap,
  UserCheck
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const ArbitrationPanel = () => {
  const navigate = useNavigate()
  const [voted, setVoted] = useState(false)

  const disputes = [
    { 
      id: '#8842', 
      item: 'Caja Naranjas (10kg)', 
      buyer: 'User_Cádiz_88', 
      seller: 'Huerta_Maria', 
      amount: '5.00 €',
      reason: 'El producto llegó golpeado y no apto para consumo.',
      evidence: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?q=80&w=400&auto=format&fit=crop'
    }
  ]

  return (
    <div className="flex flex-col h-full bg-[#10141a] p-6 pt-24 pb-32 overflow-y-auto">
      
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 text-[#ffb4ab] mb-2">
          <Gavel size={20} />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Corte de Nodo BeZhas</span>
        </div>
        <h1 className="font-space font-extrabold text-3xl text-white">Arbitraje</h1>
        <p className="text-white/40 text-sm mt-2">Resolución de disputas mediante consenso vecinal.</p>
      </header>

      {/* Juror Stats */}
      <div className="glass-panel ghost-border border-[#ffb4ab]/20 rounded-3xl p-6 mb-8 flex items-center gap-6">
        <div className="w-16 h-16 bg-[#ffb4ab10] rounded-2xl flex items-center justify-center border border-[#ffb4ab]/20 text-[#ffb4ab]">
           <UserCheck size={32} />
        </div>
        <div>
           <p className="text-[9px] text-white/40 uppercase font-black">Tu Rol</p>
           <h3 className="text-xl font-bold text-white">Jurado Verificado</h3>
           <p className="text-[10px] text-[#79ff5b] font-bold">+50 BEZ Recompensa</p>
        </div>
      </div>

      {/* Open Disputes */}
      <section className="space-y-6">
        <h3 className="font-space font-bold text-lg text-white">Casos Pendientes</h3>
        
        {disputes.map(case_ => (
          <div key={case_.id} className="glass-panel rounded-3xl p-6 border-white/5 overflow-hidden relative">
            <div className="flex justify-between items-center mb-6">
               <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Caso {case_.id}</span>
               <div className="flex items-center gap-2 text-[#f4ce00]">
                  <Clock size={12} />
                  <span className="text-[10px] font-bold">12h restantes</span>
               </div>
            </div>

            <div className="mb-6">
               <h4 className="font-bold text-white mb-2">{case_.item}</h4>
               <p className="text-xs text-white/60 mb-4">{case_.reason}</p>
               <div className="w-full h-40 rounded-2xl overflow-hidden border border-white/10 mb-4">
                  <img src={case_.evidence} alt="Evidence" className="w-full h-full object-cover" />
               </div>
               <div className="grid grid-cols-2 gap-4 text-[10px] font-bold uppercase tracking-widest">
                  <div className="p-3 bg-black/20 rounded-xl">Comprador: {case_.buyer}</div>
                  <div className="p-3 bg-black/20 rounded-xl text-right">Vendedor: {case_.seller}</div>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <button 
                disabled={voted}
                onClick={() => setVoted(true)}
                className={`flex items-center justify-center gap-2 py-4 rounded-2xl font-extrabold text-[10px] uppercase transition-all ${voted ? 'bg-white/5 text-white/20' : 'bg-[#79ff5b] text-[#002700]'}`}
               >
                 <CheckCircle2 size={16} /> Favor Vendedor
               </button>
               <button 
                disabled={voted}
                onClick={() => setVoted(true)}
                className={`flex items-center justify-center gap-2 py-4 rounded-2xl font-extrabold text-[10px] uppercase transition-all ${voted ? 'bg-white/5 text-white/20' : 'bg-[#ffb4ab] text-[#330000]'}`}
               >
                 <XCircle size={16} /> Favor Comprador
               </button>
            </div>

            {voted && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-[#10141a]/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center"
              >
                 <Zap size={32} className="text-[#00e5ff] mb-4" />
                 <h4 className="font-space font-bold text-lg text-white">Voto Registrado</h4>
                 <p className="text-white/40 text-xs mt-2">Tu decisión ha sido grabada en la Antigravity L2. Recibirás tus créditos al cierre del bloque.</p>
              </motion.div>
            )}
          </div>
        ))}
      </section>

    </div>
  )
}

export default ArbitrationPanel
