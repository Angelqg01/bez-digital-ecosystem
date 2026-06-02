import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Star, 
  MessageSquare, 
  ShieldCheck, 
  X, 
  Send,
  Zap,
  Award
} from 'lucide-react'

const ReviewModal = ({ txId, vendorName, onComplete }) => {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = () => {
    if (rating === 0) return
    setSubmitting(true)
    // Simulate Blockchain commitment
    setTimeout(() => {
      setSubmitting(false)
      onComplete({ rating, comment, txId })
    }, 2000)
  }

  return (
    <div className="glass-panel ghost-border rounded-[40px] p-8 max-w-sm bg-[#181c22]/95 backdrop-blur-2xl border-[#79ff5b]/20 relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#79ff5b]/5 blur-3xl rounded-full" />
      
      <header className="text-center mb-8">
        <div className="w-16 h-16 bg-[#79ff5b10] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[#79ff5b]/20">
          <Award size={32} className="text-[#79ff5b]" />
        </div>
        <h2 className="font-space font-extrabold text-2xl text-white">Transacción Exitosa</h2>
        <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold mt-1">Ref: {txId}</p>
      </header>

      <div className="text-center mb-8">
        <p className="text-sm text-white/60 mb-6">
          ¿Cómo fue tu experiencia con <b>{vendorName}</b>? Tu valoración será grabada de forma inmutable en el Ledger de BeZhas.
        </p>
        
        {/* Star Rating */}
        <div className="flex justify-center gap-3">
          {[1, 2, 3, 4, 5].map((star) => (
            <motion.button
              key={star}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(0)}
              className="focus:outline-none"
            >
              <Star 
                size={32} 
                fill={(hover || rating) >= star ? '#f4ce00' : 'none'} 
                className={(hover || rating) >= star ? 'text-[#f4ce00]' : 'text-white/20'} 
                strokeWidth={2}
              />
            </motion.button>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <label className="block text-[10px] font-black uppercase text-white/40 tracking-widest mb-2">Comentario (Opcional)</label>
        <textarea 
          className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-[#79ff5b]/50 transition-all resize-none h-24"
          placeholder="Ej. Excelente calidad de las naranjas..."
          value={comment}
          onChange={e => setComment(e.target.value)}
        />
      </div>

      <button 
        onClick={handleSubmit}
        disabled={rating === 0 || submitting}
        className={`w-full py-5 rounded-2xl font-extrabold text-xs uppercase flex items-center justify-center gap-3 transition-all ${rating > 0 ? 'bg-[#79ff5b] text-[#002700] shadow-[0_10px_20px_rgba(121,255,91,0.2)]' : 'bg-white/5 text-white/20'}`}
      >
        {submitting ? (
          <>
            <Zap size={18} className="animate-pulse" />
            Grabando en Blockchain...
          </>
        ) : (
          <>
            <ShieldCheck size={18} />
            Publicar Reseña Inmutable
          </>
        )}
      </button>

      <div className="mt-6 flex items-center justify-center gap-2">
        <ShieldCheck size={12} className="text-[#00e5ff]" />
        <span className="text-[8px] font-bold text-[#00e5ff] uppercase tracking-tighter">Powered by BeZhas Escrow Oracle</span>
      </div>
    </div>
  )
}

export default ReviewModal
