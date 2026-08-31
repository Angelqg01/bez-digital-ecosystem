import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ShoppingBag, 
  CheckCircle2, 
  ShieldCheck, 
  X, 
  Fingerprint,
  Zap,
  Clock,
  QrCode as QrIcon
} from 'lucide-react'
import DeliveryQR from './DeliveryQR'

const InChatTransactionWidget = ({ product, price, seller, onConfirm }) => {
  const [showConfirm, setShowConfirm] = useState(false)
  const [status, setStatus] = useState('idle') // idle, locking, locked
  const [showQR, setShowQR] = useState(false)

  const handleBuy = () => {
    setShowConfirm(true)
  }

  const handleFinalConfirm = () => {
    setStatus('locking')
    setTimeout(() => {
      setStatus('locked')
      setShowConfirm(false)
      if (onConfirm) onConfirm()
    }, 2000)
  }

  return (
    <div className="mt-4">
      <div className="glass-panel ghost-border rounded-xl p-4 max-w-sm relative overflow-hidden">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-[#00e5ff15] rounded-lg">
            <ShoppingBag size={18} className="text-[#00e5ff]" />
          </div>
          <div>
            <h4 className="font-space font-bold text-sm text-white">Smart Offer</h4>
            <p className="text-[10px] text-white/40 uppercase tracking-widest">Nexus Escrow v1.0</p>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex justify-between items-center bg-black/20 p-2 rounded-lg">
            <span className="text-[10px] text-white/40 uppercase font-bold">Item</span>
            <span className="text-xs font-bold text-white">{product}</span>
          </div>
          <div className="flex justify-between items-center bg-black/20 p-2 rounded-lg">
            <span className="text-[10px] text-white/40 uppercase font-bold">Price</span>
            <div className="flex items-center gap-1">
              <Zap size={12} className="text-[#f4ce00]" />
              <span className="text-sm font-bold text-[#f4ce00]">{price} Créditos</span>
            </div>
          </div>
          <div className="flex justify-between items-center bg-black/20 p-2 rounded-lg">
            <span className="text-[10px] text-white/40 uppercase font-bold">Status</span>
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${status === 'locked' ? 'bg-[#00e5ff]' : 'bg-[#f4ce00] animate-pulse'}`} />
              <span className={`text-[10px] font-bold uppercase tracking-wider ${status === 'locked' ? 'text-[#00e5ff]' : 'text-[#f4ce00]'}`}>
                {status === 'locked' ? 'Funds Locked' : 'Pending'}
              </span>
            </div>
          </div>
        </div>

        {status === 'idle' ? (
          <button 
            className="btn-buy w-full justify-center"
            onClick={handleBuy}
          >
            Comprar ahora
          </button>
        ) : (
          <button 
            className="flex items-center justify-between w-full text-[11px] text-white/60 bg-[#00e5ff10] p-3 rounded-lg border border-[#00e5ff]/20 hover:bg-[#00e5ff20] transition-all"
            onClick={() => setShowQR(true)}
          >
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-[#00e5ff]" />
              <span className="font-bold text-[#00e5ff]">Funds Locked</span>
            </div>
            <div className="flex items-center gap-1 font-black text-[9px] uppercase">
              Ver QR <QrIcon size={14} />
            </div>
          </button>
        )}
      </div>

      {/* Delivery QR Modal */}
      <AnimatePresence>
        {showQR && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowQR(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200]"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="fixed inset-0 flex items-center justify-center p-6 z-[201] pointer-events-none"
            >
              <div className="w-full max-w-sm pointer-events-auto">
                <div className="flex justify-end mb-4">
                  <button 
                    className="p-2 bg-white/5 rounded-full text-white/40 hover:text-white"
                    onClick={() => setShowQR(false)}
                  >
                    <X size={20} />
                  </button>
                </div>
                <DeliveryQR txId="TX-8821" amount={price} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Confirmation Bottom Sheet */}
      <AnimatePresence>
        {showConfirm && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirm(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 max-w-[500px] mx-auto bg-[#181c22] rounded-t-3xl border-t border-[#00e5ff]/20 p-8 z-[101] shadow-[0_-20px_50px_rgba(0,0,0,0.5)]"
            >
              <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-8" />
              <h3 className="font-space font-extrabold text-2xl mb-2">Confirmar Transacción</h3>
              <p className="text-white/60 text-sm mb-8">
                Se bloquearán <b>{price} Créditos</b> en el contrato inteligente HyperlocalEscrow. 
                Los fondos solo se liberarán cuando escanees el QR de entrega.
              </p>

              <div className="bg-black/20 rounded-2xl p-6 border border-white/5 mb-8 text-center">
                 <p className="text-[10px] text-white/40 uppercase tracking-widest mb-2">Biometric Verification</p>
                 <div className="w-16 h-16 rounded-full bg-[#00e5ff10] border border-[#00e5ff]/20 flex items-center justify-center mx-auto mb-4">
                    <Fingerprint size={32} className="text-[#00e5ff]" />
                 </div>
                 <p className="text-sm font-bold">Use TouchID / FaceID</p>
              </div>

              <div className="flex gap-4">
                <button 
                  className="flex-1 py-4 bg-white/5 border border-white/10 rounded-xl font-bold uppercase text-xs"
                  onClick={() => setShowConfirm(false)}
                >
                  Cancelar
                </button>
                <button 
                  className="flex-1 py-4 bg-[#00e5ff] text-[#00363d] rounded-xl font-extrabold uppercase text-xs shadow-[0_0_20px_rgba(0,229,255,0.3)]"
                  onClick={handleFinalConfirm}
                >
                  Confirmar Pago
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

export default InChatTransactionWidget
