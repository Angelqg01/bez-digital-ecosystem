import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { RefreshCcw, HandCoins, ArrowRightLeft, ShieldCheck } from 'lucide-react'

const SecondaryMarket = () => {
  const [selling, setSelling] = useState(false)
  const [sold, setSold] = useState(false)

  const handleSell = () => {
    setSelling(true)
    setTimeout(() => {
      setSelling(false)
      setSold(true)
    }, 3000)
  }

  return (
    <div style={{ padding: 20 }}>
      <header style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Space Grotesk' }}>Resale & Transfer</h2>
        <p style={{ fontSize: 12, color: 'var(--bz-text-muted)', marginTop: 4 }}>
          Mercado secundario oficial. Las transferencias ejecutan royalties automáticos vía EIP-2981.
        </p>
      </header>

      {/* Item to sell */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ width: 80, height: 80, background: '#111', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=150&q=80" alt="Watch" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, mixBlendMode: 'luminosity' }} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--bz-primary)', letterSpacing: 1 }}>ROLEX</span>
            <h3 style={{ fontSize: 14, fontWeight: 900, marginTop: 2 }}>Cosmograph Daytona</h3>
            <p style={{ fontSize: 10, color: 'var(--bz-text-muted)', fontFamily: 'monospace', marginTop: 4 }}>B-UID: BZ-LUX-ROX-26-9A8B7C</p>
          </div>
        </div>
      </div>

      {/* Sale Form */}
      {!sold ? (
        <div className="card" style={{ marginBottom: 24, background: '#0e0e0e' }}>
          <h3 style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', marginBottom: 16 }}>Configurar Reventa</h3>
          
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 10, color: 'var(--bz-text-muted)', marginBottom: 8, display: 'block' }}>Precio de Venta (USDC)</label>
            <input type="text" value="32,500.00" readOnly style={{ width: '100%', background: 'transparent', border: '1px solid var(--bz-border)', color: 'var(--bz-text)', padding: 12, fontSize: 16, fontWeight: 800, borderRadius: 8 }} />
          </div>

          <div style={{ background: '#151515', padding: 12, borderRadius: 8, border: '1px solid rgba(0,240,255,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 11 }}>
              <span style={{ color: 'var(--bz-text-muted)' }}>Monto para ti (Vendedor)</span>
              <span style={{ fontWeight: 800 }}>$30,875.00</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: 'var(--bz-primary)' }}>Royalties Marca (5%) EIP-2981</span>
              <span style={{ fontWeight: 800, color: 'var(--bz-primary)' }}>$1,625.00</span>
            </div>
          </div>
        </div>
      ) : (
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card" style={{ textAlign: 'center', borderColor: 'var(--bz-secondary)', background: 'rgba(47, 248, 1, 0.05)', padding: 32, marginBottom: 24 }}>
          <ShieldCheck size={48} color="var(--bz-secondary)" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--bz-secondary)' }}>TRANSFERENCIA COMPLETADA</h3>
          <p style={{ fontSize: 12, color: 'var(--bz-text-muted)', marginTop: 8 }}>
            Smart Contract ejecutado. Royalties enviados a la tesorería de ROLEX automáticamente.
          </p>
        </motion.div>
      )}

      {/* Action */}
      {!sold && (
        <button 
          className="btn btn-primary" 
          style={{ width: '100%', padding: 20 }}
          onClick={handleSell}
          disabled={selling}
        >
          {selling ? (
             <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
               <RefreshCcw size={18} className="animate-spin" />
               EJECUTANDO SPLIT...
             </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <HandCoins size={18} />
              CONFIRMAR LISTADO & SPLIT
            </div>
          )}
        </button>
      )}
    </div>
  )
}

export default SecondaryMarket
