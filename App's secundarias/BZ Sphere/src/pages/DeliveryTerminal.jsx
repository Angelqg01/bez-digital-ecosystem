import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Truck, 
  Package, 
  MapPin, 
  QrCode, 
  Zap, 
  Clock,
  ArrowRight,
  ShieldCheck,
  Navigation,
  Box
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const DeliveryTerminal = () => {
  const navigate = useNavigate()
  const [activeDelivery, setActiveDelivery] = useState({
    id: 'BZ-LOG-ES-2024-88A',
    status: 'In Route',
    origin: 'Huerta de Maria',
    destination: 'Calle Real 45, Cádiz',
    items: ['Caja Naranjas x2', 'Mermelada x1'],
    courier: 'Juan_Delivery',
    eta: '12 min'
  })

  return (
    <div className="flex flex-col h-full bg-[#10141a] p-6 pt-24 pb-32 overflow-y-auto">
      
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 text-[#00e5ff] mb-2">
          <Truck size={20} />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Última Milla BeZhas</span>
        </div>
        <h1 className="font-space font-extrabold text-3xl text-white">Logística</h1>
        <p className="text-white/40 text-sm mt-2">Seguimiento en tiempo real conectado a CargoLink.</p>
      </header>

      {/* CargoLink Bridge Status */}
      <div className="glass-panel ghost-border border-[#00e5ff]/20 rounded-3xl p-5 mb-8 flex items-center gap-4 bg-[#00e5ff5]">
         <div className="w-12 h-12 bg-[#00e5ff10] rounded-2xl flex items-center justify-center text-[#00e5ff]">
            <ShieldCheck size={24} />
         </div>
         <div>
            <p className="text-[9px] text-white/40 uppercase font-black">Sync CargoLink</p>
            <h3 className="text-sm font-bold text-white">Integridad de Carga Verificada</h3>
         </div>
      </div>

      {/* Active Delivery Map Preview (Simplified) */}
      <div className="relative h-48 bg-[#0c0c0c] rounded-[32px] border border-white/5 overflow-hidden mb-8">
         <img src="https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=800&auto=format&fit=crop" className="w-full h-full object-cover opacity-20 grayscale" alt="Map" />
         <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
               <div className="w-8 h-8 bg-[#00e5ff] rounded-full flex items-center justify-center shadow-[0_0_20px_#00e5ff]">
                  <Truck size={16} className="text-[#00363d]" />
               </div>
               <motion.div 
                 animate={{ scale: [1, 2, 1], opacity: [0.5, 0, 0.5] }}
                 transition={{ duration: 2, repeat: Infinity }}
                 className="absolute inset-0 bg-[#00e5ff] rounded-full"
               />
            </div>
         </div>
         <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
            <Clock size={12} className="text-[#f4ce00]" />
            <span className="text-[10px] font-bold text-white">{activeDelivery.eta} para entrega</span>
         </div>
      </div>

      {/* Delivery Details */}
      <section className="space-y-4">
        <div className="glass-panel rounded-3xl p-6 border-white/5">
           <div className="flex justify-between items-start mb-6">
              <div>
                 <span className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">Envío ID</span>
                 <h4 className="text-sm font-bold text-white font-space uppercase tracking-tighter">{activeDelivery.id}</h4>
              </div>
              <div className="bg-[#79ff5b10] px-3 py-1 rounded-full border border-[#79ff5b]/20">
                 <span className="text-[10px] font-bold text-[#79ff5b] uppercase">{activeDelivery.status}</span>
              </div>
           </div>

           <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40"><MapPin size={14} /></div>
                 <div>
                    <p className="text-[8px] text-white/20 uppercase font-black">Origen</p>
                    <p className="text-xs font-bold text-white">{activeDelivery.origin}</p>
                 </div>
              </div>
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40"><Navigation size={14} /></div>
                 <div>
                    <p className="text-[8px] text-white/20 uppercase font-black">Destino</p>
                    <p className="text-xs font-bold text-white">{activeDelivery.destination}</p>
                 </div>
              </div>
           </div>

           <div className="border-t border-white/5 pt-6">
              <p className="text-[9px] text-white/40 uppercase font-black mb-3">Artículos en Pallet</p>
              <div className="flex flex-wrap gap-2">
                 {activeDelivery.items.map((item, idx) => (
                   <span key={idx} className="bg-white/5 px-3 py-1 rounded-lg text-[10px] font-bold text-white/60 border border-white/5">{item}</span>
                 ))}
              </div>
           </div>
        </div>

        <button 
          onClick={() => navigate('/scanner')}
          className="w-full bg-[#00e5ff] text-[#00363d] py-5 rounded-2xl font-extrabold text-xs uppercase flex items-center justify-center gap-3"
        >
          <QrCode size={18} />
          Escanear para Confirmar Recepción
        </button>
      </section>

    </div>
  )
}

export default DeliveryTerminal
