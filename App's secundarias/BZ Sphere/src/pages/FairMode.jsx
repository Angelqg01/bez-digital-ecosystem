import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Zap, 
  QrCode, 
  WifiOff, 
  CreditCard, 
  ArrowRight,
  ShieldCheck,
  Package,
  Globe,
  MapPin
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const FairMode = () => {
  const navigate = useNavigate()
  const [activeStep, setActiveStep] = useState('selection') // selection, scanning, paying, success

  return (
    <div className="flex flex-col h-full bg-[#10141a] p-6 pt-24 pb-32 overflow-hidden">
      
      {/* Dynamic Header */}
      <header className="mb-12">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="font-space font-extrabold text-3xl text-white">Modo Feria</h1>
            <p className="text-[#f4ce00] text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              <Zap size={12} fill="currentColor" /> Transacciones de Alta Velocidad
            </p>
          </div>
          <div className="flex items-center gap-2 bg-[#79ff5b10] border border-[#79ff5b]/20 px-3 py-1 rounded-full">
            <Globe size={12} className="text-[#79ff5b]" />
            <span className="text-[9px] font-bold text-[#79ff5b] uppercase">Global Sync</span>
          </div>
        </div>
      </header>

      {activeStep === 'selection' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 flex-1"
        >
          <div className="glass-panel ghost-border rounded-3xl p-8 text-center bg-white/5">
             <div className="w-20 h-20 bg-[#00e5ff10] rounded-full flex items-center justify-center mx-auto mb-6">
                <QrCode size={40} className="text-[#00e5ff]" />
             </div>
             <h3 className="font-space font-bold text-xl text-white mb-2">Escaneo Rápido</h3>
             <p className="text-white/40 text-xs mb-8">Paga instantáneamente escaneando el código del puesto o producto.</p>
             <button 
               onClick={() => setActiveStep('scanning')}
               className="w-full bg-[#00e5ff] text-[#00363d] py-5 rounded-2xl font-extrabold text-xs uppercase shadow-[0_10px_20px_rgba(0,229,255,0.2)]"
             >
               Abrir Escáner Feria
             </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="glass-panel rounded-2xl p-6 border-white/5 flex flex-col gap-4">
                <WifiOff size={24} className="text-white/40" />
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest leading-tight">Sync Offline Activo</span>
             </div>
             <div className="glass-panel rounded-2xl p-6 border-white/5 flex flex-col gap-4">
                <CreditCard size={24} className="text-[#f4ce00]" />
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest leading-tight">One-Tap Pay</span>
             </div>
          </div>
        </motion.div>
      )}

      {activeStep === 'scanning' && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex-1 flex flex-col"
        >
           <div className="relative flex-1 rounded-[40px] border-2 border-[#00e5ff]/40 overflow-hidden bg-black flex items-center justify-center">
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--bz-primary-glow)_0%,_transparent_70%)]" />
              <motion.div 
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-64 h-64 border-2 border-white/10 rounded-3xl flex items-center justify-center relative"
              >
                 <QrCode size={120} className="text-white/20" />
                 {/* Corner Frames */}
                 <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#00e5ff] rounded-tl-lg" />
                 <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#00e5ff] rounded-tr-lg" />
                 <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#00e5ff] rounded-bl-lg" />
                 <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#00e5ff] rounded-tr-lg" />
              </motion.div>
              
              <div className="absolute bottom-12 text-center">
                 <p className="text-xs font-bold text-[#00e5ff] uppercase tracking-widest mb-4">Escaneando Puesto...</p>
                 <button 
                  onClick={() => setActiveStep('paying')}
                  className="px-6 py-2 bg-white/10 rounded-full text-[10px] font-black uppercase text-white/60"
                 >
                   Simular Detección
                 </button>
              </div>
           </div>
        </motion.div>
      )}

      {activeStep === 'paying' && (
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="space-y-6"
        >
          <div className="glass-panel rounded-3xl p-8 border-l-4 border-[#f4ce00]">
             <div className="flex justify-between items-start mb-6">
                <div>
                   <h3 className="font-space font-bold text-xl text-white">Stand #24: Quesos Artesanos</h3>
                   <p className="text-[10px] text-white/40 uppercase font-black">Mercado Central de Cádiz</p>
                </div>
                <Package size={24} className="text-[#f4ce00]" />
             </div>
             <div className="flex items-baseline gap-2 mb-8">
                <span className="text-4xl font-extrabold font-space text-white">14,50</span>
                <span className="text-sm font-bold text-white/40">Créditos Locales</span>
             </div>
             <button 
               onClick={() => setActiveStep('success')}
               className="w-full bg-[#f4ce00] text-[#221b00] py-5 rounded-2xl font-extrabold text-xs uppercase flex items-center justify-center gap-3"
             >
               Pagar ahora <ArrowRight size={18} />
             </button>
          </div>
        </motion.div>
      )}

      {activeStep === 'success' && (
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center py-12"
        >
           <div className="w-24 h-24 bg-[#79ff5b20] rounded-full flex items-center justify-center mx-auto mb-8">
              <ShieldCheck size={48} className="text-[#79ff5b]" />
           </div>
           <h2 className="font-space font-extrabold text-3xl text-white mb-4">¡Pago Completado!</h2>
           <p className="text-white/60 text-sm mb-12">La transacción ha sido grabada en la Antigravity L2 y sincronizada con el Nodo.</p>
           
           <div className="space-y-4">
              <button 
                onClick={() => navigate('/vault')}
                className="w-full py-4 border border-white/10 rounded-xl font-bold text-xs uppercase text-white/60"
              >
                Ver Mi Bóveda
              </button>
              <button 
                onClick={() => setActiveStep('selection')}
                className="w-full py-4 text-[#00e5ff] font-black text-xs uppercase"
              >
                Nueva Compra Feria
              </button>
           </div>
        </motion.div>
      )}

    </div>
  )
}

export default FairMode
