import React from 'react'
import { motion } from 'framer-motion'
import { 
  Store, 
  Star, 
  MapPin, 
  Clock, 
  ShoppingBag, 
  MessageCircle,
  Share2,
  ChevronLeft,
  ArrowRight,
  ShieldCheck,
  Zap
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const VendorProfile = () => {
  const navigate = useNavigate()

  const products = [
    { id: 1, name: 'Caja Naranjas (10kg)', price: 5.00, img: 'https://images.unsplash.com/photo-1557800636-894a64c1696f?q=80&w=400&auto=format&fit=crop' },
    { id: 2, name: 'Zumo Natural (1L)', price: 2.50, img: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?q=80&w=400&auto=format&fit=crop' },
    { id: 3, name: 'Mermelada Artesana', price: 3.20, img: 'https://images.unsplash.com/photo-1547514701-42782101795e?q=80&w=400&auto=format&fit=crop' },
    { id: 4, name: 'Cesta Temporada', price: 12.00, img: 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=400&auto=format&fit=crop' }
  ]

  return (
    <div className="flex flex-col h-full bg-[#10141a]">
      
      {/* Hero Section */}
      <div className="relative h-64 overflow-hidden">
        <img 
          src="https://images.unsplash.com/photo-1488459711615-228239793f73?q=80&w=800&auto=format&fit=crop" 
          alt="Cover" 
          className="w-full h-full object-cover opacity-40 grayscale"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#10141a] to-transparent" />
        
        <button 
          onClick={() => navigate('/')}
          className="absolute top-6 left-6 p-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-white"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="absolute bottom-0 left-0 p-6 flex items-end gap-6">
          <div className="w-24 h-24 rounded-3xl bg-[#181c22] border-2 border-[#00e5ff]/30 p-1">
            <div className="w-full h-full rounded-2xl overflow-hidden">
               <img src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?q=80&w=200&auto=format&fit=crop" className="w-full h-full object-cover" alt="Profile" />
            </div>
          </div>
          <div className="pb-2">
            <h1 className="font-space font-extrabold text-2xl text-white">Huerta de Maria</h1>
            <div className="flex items-center gap-4 mt-1">
              <div className="flex items-center gap-1 text-[#f4ce00]">
                <Star size={14} fill="currentColor" />
                <span className="text-xs font-bold">4.9</span>
              </div>
              <div className="flex items-center gap-1 text-white/40">
                <MapPin size={12} />
                <span className="text-[10px] font-bold uppercase">Cádiz Centro</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info & Actions */}
      <div className="p-6">
        <div className="flex gap-4 mb-8">
           <button className="flex-1 bg-[#00e5ff] text-[#00363d] py-3 rounded-xl font-extrabold text-xs uppercase shadow-[0_10px_20px_rgba(0,229,255,0.2)] flex items-center justify-center gap-2">
             <MessageCircle size={16} />
             Pedir por Chat
           </button>
           <button className="p-3 bg-white/5 border border-white/10 rounded-xl text-white">
             <Share2 size={20} />
           </button>
        </div>

        {/* Vendor Bio */}
        <div className="glass-panel rounded-2xl p-4 mb-8">
          <p className="text-xs text-white/60 leading-relaxed">
            Cultivamos con amor en el corazón de la provincia. Productos de temporada, 
            libres de pesticidas y con entrega directa en 24h. Aceptamos BEZ y Créditos Locales.
          </p>
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/5">
             <div className="flex items-center gap-2">
               <ShieldCheck size={14} className="text-[#79ff5b]" />
               <span className="text-[9px] font-black uppercase text-[#79ff5b]">Verificado</span>
             </div>
             <div className="flex items-center gap-2 text-white/40">
               <Clock size={14} />
               <span className="text-[9px] font-bold">Abre a las 09:00</span>
             </div>
          </div>
        </div>

        {/* Product Catalog */}
        <div className="mb-8">
           <div className="flex justify-between items-center mb-6">
              <h3 className="font-space font-bold text-lg text-white">Catálogo Km 0</h3>
              <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">{products.length} Productos</span>
           </div>

           <div className="grid grid-cols-2 gap-4">
              {products.map(product => (
                <div key={product.id} className="glass-panel ghost-border rounded-2xl overflow-hidden flex flex-col">
                   <div className="h-32 relative">
                      <img src={product.img} alt={product.name} className="w-full h-full object-cover" />
                      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10 flex items-center gap-1">
                        <Zap size={10} className="text-[#f4ce00]" />
                        <span className="text-[10px] font-bold text-[#f4ce00]">{product.price} €</span>
                      </div>
                   </div>
                   <div className="p-3 flex-1 flex flex-col">
                      <h4 className="text-[11px] font-bold text-white mb-3 line-clamp-1">{product.name}</h4>
                      <button 
                        onClick={() => navigate('/')}
                        className="mt-auto w-full py-2 bg-white/5 border border-white/10 rounded-lg text-[9px] font-black uppercase tracking-tighter hover:bg-[#00e5ff10] hover:text-[#00e5ff] transition-all flex items-center justify-center gap-2"
                      >
                        Añadir al Chat
                        <ArrowRight size={12} />
                      </button>
                   </div>
                </div>
              ))}
           </div>
        </div>

        {/* Vendor Stats */}
        <div className="grid grid-cols-3 gap-4 mb-12">
           <div className="text-center">
              <p className="text-xl font-bold text-white">124</p>
              <p className="text-[8px] text-white/40 uppercase font-black tracking-widest">Ventas</p>
           </div>
           <div className="text-center">
              <p className="text-xl font-bold text-white">12</p>
              <p className="text-[8px] text-white/40 uppercase font-black tracking-widest">Nodos</p>
           </div>
           <div className="text-center">
              <p className="text-xl font-bold text-white">2.5k</p>
              <p className="text-[8px] text-white/40 uppercase font-black tracking-widest">BEZ Vol.</p>
           </div>
        </div>

      </div>
    </div>
  )
}

export default VendorProfile
