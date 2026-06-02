import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  MapPin, 
  Search, 
  Navigation, 
  Layers, 
  Filter, 
  Store,
  Star,
  ChevronRight,
  Zap,
  X
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const NodeMap = () => {
  const navigate = useNavigate()
  const [selectedVendor, setSelectedVendor] = useState(null)

  const vendors = [
    { id: 1, name: 'Huerta de Maria', type: 'Alimentación', rating: 4.9, x: 35, y: 45, img: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?q=80&w=200&auto=format&fit=crop' },
    { id: 2, name: 'Pan Artesano Paco', type: 'Panadería', rating: 4.7, x: 60, y: 30, img: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=200&auto=format&fit=crop' },
    { id: 3, name: 'EcoMuebles Cádiz', type: 'Hogar', rating: 4.5, x: 20, y: 70, img: 'https://images.unsplash.com/photo-1538688549894-f447883d3aee?q=80&w=200&auto=format&fit=crop' }
  ]

  return (
    <div className="flex flex-col h-full bg-[#10141a] overflow-hidden">
      
      {/* Map Header Overlay */}
      <div className="absolute top-6 left-6 right-6 z-50 pointer-events-none">
        <div className="flex gap-3 pointer-events-auto">
          <div className="flex-1 glass-panel rounded-2xl flex items-center px-4 py-3 gap-3 border-[#00e5ff]/20">
            <Search size={18} className="text-[#00e5ff]" />
            <input 
              type="text" 
              placeholder="Buscar en el Nodo..." 
              className="bg-transparent border-none focus:ring-0 text-sm text-white placeholder:text-white/20 w-full outline-none"
            />
          </div>
          <button className="p-3 glass-panel rounded-2xl border-[#00e5ff]/20 text-white">
            <Filter size={20} />
          </button>
        </div>
      </div>

      {/* Interactive Map Surface */}
      <div className="relative flex-1 bg-[#0c0c0c] overflow-hidden">
        {/* Grid Background */}
        <div className="absolute inset-0 opacity-10" style={{ 
          backgroundImage: 'linear-gradient(var(--bz-border) 1px, transparent 1px), linear-gradient(90deg, var(--bz-border) 1px, transparent 1px)', 
          backgroundSize: '40px 40px' 
        }}></div>

        {/* Mock Map Image / Vector */}
        <img 
          src="https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=1200&auto=format&fit=crop" 
          alt="Map" 
          className="w-full h-full object-cover opacity-30 grayscale contrast-125 brightness-50"
        />

        {/* Vendor Pins */}
        {vendors.map(vendor => (
          <motion.button
            key={vendor.id}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileHover={{ scale: 1.2 }}
            onClick={() => setSelectedVendor(vendor)}
            className="absolute z-20"
            style={{ top: `${vendor.y}%`, left: `${vendor.x}%`, transform: 'translate(-50%, -50%)' }}
          >
            <div className="relative">
              <div className="w-10 h-10 bg-[#181c22] rounded-full border-2 border-[#00e5ff] flex items-center justify-center overflow-hidden shadow-[0_0_20px_rgba(0,229,255,0.4)]">
                 <img src={vendor.img} alt={vendor.name} className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#79ff5b] rounded-full border-2 border-[#181c22] flex items-center justify-center">
                 <Zap size={8} fill="currentColor" className="text-[#002700]" />
              </div>
            </div>
          </motion.button>
        ))}

        {/* Map Controls */}
        <div className="absolute bottom-32 right-6 flex flex-col gap-3">
          <button className="p-3 bg-[#181c22] rounded-xl border border-white/10 text-white shadow-xl">
            <Navigation size={20} />
          </button>
          <button className="p-3 bg-[#181c22] rounded-xl border border-white/10 text-white shadow-xl">
            <Layers size={20} />
          </button>
        </div>
      </div>

      {/* Vendor Preview Card */}
      <AnimatePresence>
        {selectedVendor && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="absolute bottom-28 left-6 right-6 z-50"
          >
            <div className="glass-panel ghost-border rounded-3xl p-5 bg-[#181c22]/90 backdrop-blur-2xl">
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-4">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10">
                    <img src={selectedVendor.img} alt={selectedVendor.name} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h3 className="font-space font-bold text-lg text-white">{selectedVendor.name}</h3>
                    <p className="text-[10px] text-white/40 uppercase font-black tracking-widest">{selectedVendor.type}</p>
                    <div className="flex items-center gap-1 mt-1 text-[#f4ce00]">
                      <Star size={12} fill="currentColor" />
                      <span className="text-xs font-bold">{selectedVendor.rating}</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedVendor(null)}
                  className="p-1 text-white/20 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => navigate(`/vendor/${selectedVendor.id}`)}
                  className="flex-1 bg-[#00e5ff] text-[#00363d] py-3 rounded-xl font-extrabold text-[10px] uppercase flex items-center justify-center gap-2"
                >
                  Ver Catálogo
                  <ChevronRight size={14} />
                </button>
                <button 
                  onClick={() => navigate('/')}
                  className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
                >
                  <Store size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}

export default NodeMap
