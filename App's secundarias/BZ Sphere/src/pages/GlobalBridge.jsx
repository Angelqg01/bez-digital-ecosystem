import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Globe, 
  ArrowLeftRight, 
  ShieldCheck, 
  Activity, 
  MapPin,
  TrendingUp,
  Zap,
  ArrowRight
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const GlobalBridge = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('active')

  return (
    <div className="flex flex-col h-full bg-[#10141a] p-6 pt-24 pb-32 overflow-y-auto">
      
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 text-[#00e5ff] mb-2">
          <Globe size={20} />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Inter-Node Protocol v2.0</span>
        </div>
        <h1 className="font-space font-extrabold text-3xl text-white">Global Bridge</h1>
        <p className="text-white/40 text-sm mt-2">Conectando comercios locales con mercados mundiales.</p>
      </header>

      {/* Network Stats Card */}
      <div className="glass-panel ghost-border rounded-3xl p-6 mb-8 border-[#00e5ff]/20">
        <div className="grid grid-cols-2 gap-8">
           <div>
              <p className="text-[9px] text-white/40 uppercase font-black mb-1">Nodos Conectados</p>
              <div className="flex items-baseline gap-2">
                 <span className="text-2xl font-extrabold font-space text-white">1,420</span>
                 <Activity size={14} className="text-[#79ff5b] animate-pulse" />
              </div>
           </div>
           <div>
              <p className="text-[9px] text-white/40 uppercase font-black mb-1">Volumen 24h</p>
              <div className="flex items-baseline gap-2">
                 <span className="text-2xl font-extrabold font-space text-white">125k</span>
                 <span className="text-[10px] font-bold text-[#f4ce00]">BEZ</span>
              </div>
           </div>
        </div>
      </div>

      {/* Bridge Routes */}
      <section className="mb-8">
        <div className="flex justify-between items-center mb-6">
           <h3 className="font-space font-bold text-lg text-white">Rutas de Comercio Activas</h3>
           <button className="text-[10px] font-black text-[#00e5ff] uppercase">Explorar Nodos</button>
        </div>

        <div className="space-y-4">
           <BridgeRoute 
             from="Nodo Cádiz Centro" 
             to="Nodo Madrid Sol" 
             item="Aceite de Oliva" 
             eta="48h" 
             status="En Tránsito"
           />
           <BridgeRoute 
             from="Nodo Valencia Port" 
             to="Nodo Cádiz Centro" 
             item="Arroz Variado" 
             eta="24h" 
             status="Validando"
           />
           <BridgeRoute 
             from="Nodo Lisboa Tejo" 
             to="Nodo Sevilla Triana" 
             item="Bacalao Curado" 
             eta="12h" 
             status="Escrow Locked"
           />
        </div>
      </section>

      {/* Action: Open New Route */}
      <button className="w-full bg-[#00e5ff] text-[#00363d] py-5 rounded-2xl font-extrabold text-xs uppercase flex items-center justify-center gap-3 shadow-[0_10px_20px_rgba(0,229,255,0.2)]">
        <ArrowLeftRight size={18} />
        Establecer Puente de Comercio
      </button>

    </div>
  )
}

const BridgeRoute = ({ from, to, item, eta, status }) => (
  <div className="glass-panel rounded-2xl p-4 border-white/5">
    <div className="flex justify-between items-start mb-4">
       <div>
          <h4 className="text-xs font-bold text-white mb-1">{item}</h4>
          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${status === 'En Tránsito' ? 'bg-[#79ff5b20] text-[#79ff5b]' : 'bg-[#00e5ff10] text-[#00e5ff]'}`}>
            {status}
          </span>
       </div>
       <div className="text-right">
          <p className="text-[10px] text-white/40 font-bold uppercase">ETA</p>
          <p className="text-sm font-space font-bold text-white">{eta}</p>
       </div>
    </div>
    
    <div className="flex items-center gap-3 bg-black/20 p-3 rounded-xl">
       <div className="flex-1">
          <p className="text-[8px] text-white/40 uppercase font-black">Origen</p>
          <p className="text-[10px] font-bold text-white truncate">{from}</p>
       </div>
       <ArrowRight size={14} className="text-white/20" />
       <div className="flex-1 text-right">
          <p className="text-[8px] text-white/40 uppercase font-black">Destino</p>
          <p className="text-[10px] font-bold text-white truncate">{to}</p>
       </div>
    </div>
  </div>
)

export default GlobalBridge
