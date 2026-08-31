import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Fingerprint, 
  ShieldCheck, 
  QrCode, 
  Search, 
  MapPin, 
  FileCheck,
  Zap,
  ChevronRight,
  Leaf,
  Award
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const IdentityModule = () => {
  const navigate = useNavigate()
  const [scanning, setScanning] = useState(false)
  const [productData, setProductData] = useState(null)

  const simulateScan = () => {
    setScanning(true)
    setTimeout(() => {
      setScanning(false)
      setProductData({
        id: 'BZ-DID-NAR-8821-44',
        name: 'Naranjas Navelina Extra',
        origin: 'Huerta de Maria, Cádiz',
        harvestDate: '04 May 2026',
        quality: 'Premium (PureScan AA+)',
        carbonFootprint: '-120g CO2/kg',
        verifiedBy: 'PureScan Oracle v2.1'
      })
    }, 2500)
  }

  return (
    <div className="flex flex-col h-full bg-[#10141a] p-6 pt-24 pb-32 overflow-y-auto">
      
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 text-[#00e5ff] mb-2">
          <Fingerprint size={20} />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Identidad Digital BeZhas (DID)</span>
        </div>
        <h1 className="font-space font-extrabold text-3xl text-white">Certificación</h1>
        <p className="text-white/40 text-sm mt-2">Verifica el origen y calidad real de tus productos.</p>
      </header>

      {!productData && !scanning && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-8">
           <div className="w-32 h-32 bg-[#00e5ff10] rounded-full flex items-center justify-center border-2 border-[#00e5ff]/20 relative">
              <QrCode size={64} className="text-[#00e5ff]" />
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 rounded-full border-4 border-dashed border-[#00e5ff]/30"
              />
           </div>
           <div className="text-center">
              <h3 className="font-space font-bold text-xl text-white mb-2">Escanear Producto</h3>
              <p className="text-white/40 text-xs px-12">Usa la cámara para leer el DID del producto y conectarte con PureScan.</p>
           </div>
           <button 
             onClick={simulateScan}
             className="w-full bg-[#00e5ff] text-[#00363d] py-5 rounded-2xl font-extrabold text-xs uppercase shadow-[0_10px_20px_rgba(0,229,255,0.2)]"
           >
             Activar PureScan DID
           </button>
        </div>
      )}

      {scanning && (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
           <div className="w-48 h-48 bg-black rounded-3xl border-2 border-[#00e5ff] border-dashed flex items-center justify-center mb-8 relative overflow-hidden">
              <motion.div 
                animate={{ top: ['0%', '100%', '0%'] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute left-0 right-0 h-1 bg-[#00e5ff] shadow-[0_0_15px_#00e5ff] z-10"
              />
              <Search size={64} className="text-white/10" />
           </div>
           <p className="text-[#00e5ff] font-bold uppercase tracking-widest text-sm animate-pulse">Sincronizando con PureScan...</p>
        </div>
      )}

      {productData && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-6"
        >
          {/* Certificate Header */}
          <div className="glass-panel ghost-border border-[#79ff5b]/20 rounded-[40px] p-8 text-center bg-[#79ff5b5]">
             <div className="w-16 h-16 bg-[#79ff5b10] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[#79ff5b]/20 text-[#79ff5b]">
                <ShieldCheck size={32} />
             </div>
             <h2 className="font-space font-extrabold text-2xl text-white">Certificado de Origen</h2>
             <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.3em] mt-1">ID: {productData.id}</p>
          </div>

          {/* Details List */}
          <div className="glass-panel rounded-3xl p-6 border-white/5 space-y-6">
             <DetailRow icon={<Award className="text-[#f4ce00]" />} label="Producto" value={productData.name} />
             <DetailRow icon={<MapPin className="text-[#ffb4ab]" />} label="Origen Nodo" value={productData.origin} />
             <DetailRow icon={<Zap className="text-[#00e5ff]" />} label="Calidad Certificada" value={productData.quality} />
             <DetailRow icon={<Leaf className="text-[#79ff5b]" />} label="Huella H2O/CO2" value={productData.carbonFootprint} />
             <DetailRow icon={<FileCheck className="text-white/40" />} label="Oráculo" value={productData.verifiedBy} />
          </div>

          <button 
            onClick={() => setProductData(null)}
            className="w-full py-4 text-white/40 font-black text-[10px] uppercase tracking-widest"
          >
            Escanear Otro Producto
          </button>
        </motion.div>
      )}

    </div>
  )
}

const DetailRow = ({ icon, label, value }) => (
  <div className="flex items-center gap-4">
    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center shrink-0">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
       <p className="text-[8px] text-white/20 uppercase font-black">{label}</p>
       <p className="text-xs font-bold text-white truncate">{value}</p>
    </div>
  </div>
)

export default IdentityModule
