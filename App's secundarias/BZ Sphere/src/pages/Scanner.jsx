import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Maximize, 
  X, 
  Zap, 
  CheckCircle2, 
  ShieldCheck, 
  RefreshCw,
  Camera,
  QrCode
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const Scanner = () => {
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState(null) // null, 'success', 'error'
  const navigate = useNavigate()

  const handleScan = () => {
    setScanning(true)
    // Simulate QR code detection and contract call
    setTimeout(() => {
      setScanning(false)
      setResult('success')
    }, 3000)
  }

  return (
    <div className="flex flex-col h-full bg-black text-white p-6 pt-24 overflow-hidden">
      
      {/* Viewport Header */}
      <header className="flex justify-between items-center mb-12">
        <div>
          <h1 className="font-space font-extrabold text-2xl tracking-tighter">Release Scanner</h1>
          <p className="text-[10px] text-[#00e5ff] font-bold uppercase tracking-widest">Protocolo BeZhas-Escrow v1.0</p>
        </div>
        <button 
          onClick={() => navigate(-1)}
          className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-all"
        >
          <X size={20} />
        </button>
      </header>

      {/* Camera Viewport Simulation */}
      <div className="relative flex-1 rounded-[40px] border-2 border-white/10 overflow-hidden bg-[#0a0a0a] mb-12">
        {/* Scanning Animation */}
        <AnimatePresence>
          {scanning && (
            <motion.div 
              initial={{ top: 0 }}
              animate={{ top: '100%' }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="absolute left-0 right-0 h-1 bg-[#00e5ff] shadow-[0_0_20px_#00e5ff] z-10"
            />
          )}
        </AnimatePresence>

        {/* Viewport Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
           {!scanning && !result && (
             <div className="text-center opacity-40">
                <Camera size={64} className="mx-auto mb-4" />
                <p className="text-xs font-bold uppercase tracking-widest">Apunta al código QR del cliente</p>
             </div>
           )}

           {scanning && (
             <div className="text-center">
                <div className="w-48 h-48 border-2 border-[#00e5ff] border-dashed rounded-3xl mb-8 flex items-center justify-center">
                   <QrCode size={80} className="text-[#00e5ff] animate-pulse" />
                </div>
                <p className="text-sm font-bold text-[#00e5ff] glow-text">Analizando Firma Digital...</p>
             </div>
           )}

           {result === 'success' && (
             <motion.div 
               initial={{ scale: 0.8, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               className="text-center px-8"
             >
                <div className="w-24 h-24 bg-[#79ff5b20] rounded-full flex items-center justify-center mx-auto mb-6">
                   <ShieldCheck size={48} className="text-[#79ff5b]" />
                </div>
                <h2 className="font-space font-bold text-2xl text-[#79ff5b] mb-2">¡Fondos Liberados!</h2>
                <p className="text-white/60 text-sm mb-8 leading-relaxed">
                  La transacción #8821 ha sido completada con éxito. Los créditos se han transferido a tu bóveda.
                </p>
                <button 
                  onClick={() => navigate('/vault')}
                  className="w-full bg-[#79ff5b] text-[#002700] py-4 rounded-2xl font-extrabold text-xs uppercase"
                >
                  Ver Bóveda
                </button>
             </motion.div>
           )}
        </div>

        {/* Corner Markers */}
        <div className="absolute top-10 left-10 w-8 h-8 border-t-4 border-l-4 border-white/20 rounded-tl-lg" />
        <div className="absolute top-10 right-10 w-8 h-8 border-t-4 border-r-4 border-white/20 rounded-tr-lg" />
        <div className="absolute bottom-10 left-10 w-8 h-8 border-b-4 border-l-4 border-white/20 rounded-bl-lg" />
        <div className="absolute bottom-10 right-10 w-8 h-8 border-b-4 border-r-4 border-white/20 rounded-br-lg" />
      </div>

      {/* Control Panel */}
      <div className="flex gap-4 mb-12">
        <button 
          onClick={handleScan}
          disabled={scanning || result}
          className={`flex-1 py-5 rounded-3xl font-extrabold text-xs uppercase flex items-center justify-center gap-3 transition-all ${scanning ? 'bg-white/5 text-white/40' : 'bg-[#00e5ff] text-[#00363d]'}`}
        >
          {scanning ? <RefreshCw size={18} className="animate-spin" /> : <Maximize size={18} />}
          {scanning ? 'Sincronizando...' : 'Iniciar Escaneo'}
        </button>
      </div>

      {/* Ledger Info */}
      <div className="glass-panel rounded-2xl p-4 flex items-center gap-4 border-white/5">
        <div className="p-2 bg-white/5 rounded-lg">
          <Zap size={16} className="text-[#f4ce00]" />
        </div>
        <div>
          <p className="text-[10px] text-white/40 uppercase font-black">Estado del Oráculo</p>
          <p className="text-xs font-bold text-white">Antigravity L2: Conexión Estable</p>
        </div>
      </div>

    </div>
  )
}

export default Scanner
