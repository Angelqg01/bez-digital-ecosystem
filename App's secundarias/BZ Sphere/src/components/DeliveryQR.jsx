import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  QrCode, 
  RefreshCw, 
  ShieldCheck, 
  Clock,
  ArrowRight
} from 'lucide-react'

const DeliveryQR = ({ txId, amount, onComplete }) => {
  const [timeLeft, setTimeLeft] = useState(300) // 5 minutes
  const [status, setStatus] = useState('active') // active, expired, used

  useEffect(() => {
    if (timeLeft > 0 && status === 'active') {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
      return () => clearTimeout(timer)
    } else if (timeLeft === 0) {
      setStatus('expired')
    }
  }, [timeLeft, status])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  return (
    <div className="flex flex-col items-center">
      <div className="glass-panel ghost-border rounded-3xl p-8 mb-6 relative overflow-hidden bg-white/5">
        <div className="absolute top-0 left-0 w-full h-1 bg-[#00e5ff20]">
           <motion.div 
             initial={{ width: '100%' }}
             animate={{ width: `${(timeLeft / 300) * 100}%` }}
             className="h-full bg-[#00e5ff]"
           />
        </div>

        {/* QR Simulation */}
        <div className="bg-white p-6 rounded-2xl mb-6 shadow-[0_0_40px_rgba(0,229,255,0.2)]">
          <div className="relative">
            <QrCode size={180} color="#10141a" />
            {status === 'expired' && (
              <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4">
                <RefreshCw size={32} className="text-[#10141a] mb-2" />
                <p className="text-[10px] font-black text-[#10141a] uppercase">Code Expired</p>
              </div>
            )}
          </div>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock size={14} className="text-[#00e5ff]" />
            <span className="font-space font-bold text-xl tracking-wider text-white">
              {formatTime(timeLeft)}
            </span>
          </div>
          <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-bold">Expires in</p>
        </div>
      </div>

      <div className="card w-full max-w-sm border-l-4 border-[#79ff5b] bg-[#79ff5b05]">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-[#79ff5b20] rounded-lg">
            <ShieldCheck size={20} className="text-[#79ff5b]" />
          </div>
          <div>
            <h4 className="font-space font-bold text-sm text-white">Prueba de Entrega</h4>
            <p className="text-xs text-white/60 leading-relaxed mt-1">
              Muestra este código al repartidor. Al escanearlo, los <b>{amount} Créditos</b> se liberarán automáticamente.
            </p>
          </div>
        </div>
      </div>

      <button 
        className="mt-8 text-[11px] font-bold text-white/40 uppercase flex items-center gap-2 hover:text-white transition-colors"
        onClick={() => setStatus('active')}
      >
        <RefreshCw size={14} />
        Regenerar Código Seguro
      </button>
    </div>
  )
}

export default DeliveryQR
