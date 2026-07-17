import React, { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, PlayCircle } from 'lucide-react'

/**
 * GuidedTour — reproductor del recorrido animado "Cómo usar BZ CargoLink".
 *
 * La animación vive en public/como-usar.html (archivo autónomo que los usuarios
 * también pueden abrir directamente). Aquí se muestra dentro de un modal iframe.
 *
 * Se abre:
 *   - al emitir el evento window 'cargolink:start-tour' (botón del header / Configuración)
 *   - automáticamente la primera vez que el usuario entra (localStorage flag)
 */
const SEEN_KEY = 'cargolink_tour_seen_v1'
const TOUR_SRC = '/como-usar.html'

export default function GuidedTour() {
  const [open, setOpen] = useState(false)

  const show = useCallback(() => setOpen(true), [])
  const close = useCallback(() => {
    setOpen(false)
    try { localStorage.setItem(SEEN_KEY, '1') } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    const handler = () => show()
    window.addEventListener('cargolink:start-tour', handler)
    // Auto-mostrar en la primera visita (tras un pequeño retardo para no competir con el login).
    let t
    try {
      if (!localStorage.getItem(SEEN_KEY)) t = setTimeout(show, 1200)
    } catch { /* ignore */ }
    return () => { window.removeEventListener('cargolink:start-tour', handler); clearTimeout(t) }
  }, [show])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') close() }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
          style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(4,6,12,0.82)', backdropFilter: 'blur(10px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
        >
          <motion.div
            initial={{ y: 24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 24, stiffness: 260 }}
            onClick={e => e.stopPropagation()}
            style={{ width: 'min(1000px, 100%)', maxHeight: '92vh', position: 'relative', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <PlayCircle size={18} color="#00F0FF" />
              <span style={{ fontSize: 13, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, color: '#fff' }}>
                Cómo usar BZ CargoLink
              </span>
              <a
                href={TOUR_SRC}
                target="_blank"
                rel="noopener noreferrer"
                style={{ marginLeft: 'auto', fontSize: 11, color: '#9aa4a6', textDecoration: 'none', border: '1px solid #2a2a30', borderRadius: 8, padding: '5px 10px' }}
              >
                Abrir en pestaña ↗
              </a>
              <button
                onClick={close}
                aria-label="Cerrar recorrido"
                style={{ background: '#1b1b21', border: '1px solid #2a2a30', borderRadius: 8, color: '#fff', width: 32, height: 32, display: 'grid', placeItems: 'center', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ flex: 1, borderRadius: 18, overflow: 'hidden', border: '1px solid #2a2a30', boxShadow: '0 30px 90px rgba(0,0,0,0.6)', background: '#0A0A0C' }}>
              <iframe
                title="Recorrido BZ CargoLink"
                src={TOUR_SRC}
                style={{ width: '100%', height: 'min(640px, 82vh)', border: 'none', display: 'block' }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Botón reutilizable que lanza el recorrido. */
export function TourButton({ compact = false }) {
  const start = () => window.dispatchEvent(new CustomEvent('cargolink:start-tour'))
  if (compact) {
    return (
      <button
        onClick={start}
        title="Cómo usar la app"
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bz-surface-container)', border: '1px solid var(--bz-border)', borderRadius: 6, color: 'var(--bz-text)', padding: '6px 12px', cursor: 'pointer' }}
      >
        <PlayCircle size={16} color="var(--bz-primary)" />
        <span style={{ fontSize: 10, fontWeight: 800 }}>CÓMO USAR</span>
      </button>
    )
  }
  return (
    <button onClick={start} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <PlayCircle size={16} /> Cómo usar la app
    </button>
  )
}
