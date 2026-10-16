import React from 'react'
import { fmtEur, fmtGridMw, fmtPct } from '../utils/units'

/** Hora actual en España (los períodos de OMIE van en hora de Madrid, no en la del navegador). */
const madridHour = () => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', hourCycle: 'h23' }).format(new Date()))

/** Curva del día → 24 precios horarios (promedia los cuartos de hora si vienen 96 períodos). */
export function hourlyPrices(curve = []) {
  if (!curve.length) return []
  const per = Math.max(1, Math.round(curve.length / 24))
  return Array.from({ length: 24 }, (_, h) => {
    const s = curve.slice(h * per, (h + 1) * per).map((c) => c.price_es).filter(Number.isFinite)
    return s.length ? s.reduce((a, b) => a + b, 0) / s.length : null
  })
}

const REC = { CHARGE_BATTERY: 'CARGAR', DISCHARGE_SELL: 'VENDER / DESCARGAR', HOLD: 'MANTENER' }

export default function MarketPanel({ omie, grid }) {
  const hours = omie ? hourlyPrices(omie.curve) : []
  // Mín/máx/media sobre los períodos publicados (no sobre las medias horarias, que suavizan los extremos).
  const valid = omie ? (omie.curve || []).map((c) => c.price_es).filter(Number.isFinite) : []
  const min = valid.length ? Math.min(...valid) : null
  const max = valid.length ? Math.max(...valid) : null
  const avg = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null
  const now = madridHour()
  const span = max !== null && min !== null && max !== min ? max - min : 1

  return (
    <section className="card" data-testid="market-panel" style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 28 }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: 18, fontWeight: 700 }}>Mercado OMIE (mercado diario)</h3>
          <span style={{ fontSize: 10, fontWeight: 700, color: omie && !omie.simulated ? 'var(--bez-secondary)' : '#f59e0b', fontFamily: 'monospace' }}>
            {omie ? (omie.simulated ? 'SIMULADO' : 'PRECIOS PUBLICADOS · OMIE') : 'SIN DATOS'}
          </span>
        </div>
        {omie ? (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '10px 0 4px' }}>
              <span style={{ fontSize: 34, fontWeight: 800, fontFamily: 'monospace' }}>{fmtEur(omie.price_eur_mwh)}</span>
              <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 6, background: 'rgba(0,240,255,0.1)', color: 'var(--bez-primary)' }}>
                {REC[omie.ai_recommendation] || omie.ai_recommendation}
              </span>
            </div>
            <p style={{ fontSize: 11, color: 'var(--bez-text-muted)' }}>
              Hoy: mín {fmtEur(min)} · media {fmtEur(avg)} · máx {fmtEur(max)} · +1 h {fmtEur(omie.predictions?.in_1h?.price)} · +6 h {fmtEur(omie.predictions?.in_6h?.price)}
            </p>
            <div role="img" aria-label="Precio horario de hoy" style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 70, marginTop: 14 }}>
              {hours.map((v, h) => (
                <div key={h} title={`${String(h).padStart(2, '0')}:00 · ${fmtEur(v)}`}
                  style={{ flex: 1, height: v === null ? 2 : `${8 + ((v - min) / span) * 92}%`, background: h === now ? 'var(--bez-primary)' : (v !== null && v < 0 ? '#4ade80' : 'rgba(255,255,255,0.22)'), borderRadius: 2 }} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--bez-text-muted)', marginTop: 4, fontFamily: 'monospace' }}>
              <span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>23h</span>
            </div>
          </>
        ) : <p style={{ fontSize: 12, color: 'var(--bez-text-muted)', marginTop: 12 }}>No se pudo leer el mercado. Reintentando cada minuto.</p>}
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: 18, fontWeight: 700 }}>Red eléctrica española (REE)</h3>
          <span style={{ fontSize: 10, fontWeight: 700, color: grid && !grid.simulated ? 'var(--bez-secondary)' : '#f59e0b', fontFamily: 'monospace' }}>
            {grid ? (grid.simulated ? 'SIMULADO' : 'DATOS REE') : 'SIN DATOS'}
          </span>
        </div>
        {grid ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '12px 0' }}>
              <Stat label="Demanda" val={fmtGridMw(grid.demand_mw)} />
              <Stat label="Renovables" val={fmtPct(grid.renewable_pct, 1)} />
              <Stat label="Frecuencia" val={grid.frequency_hz == null ? 'no publicada' : `${grid.frequency_hz} Hz`} />
              <Stat label="Balance" val={grid.grid_balance_mw == null ? 'no publicado' : `${grid.grid_balance_mw} MW`} />
            </div>
            {grid.mix && (
              <div>
                {Object.entries(grid.mix).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, marginBottom: 4 }}>
                    <span style={{ width: 62, color: 'var(--bez-text-muted)', textTransform: 'uppercase' }}>{k.replace('_pct', '')}</span>
                    <div style={{ flex: 1, height: 6, background: 'var(--bez-surface-3)', borderRadius: 3 }}><div style={{ width: `${Math.min(100, v)}%`, height: '100%', background: 'var(--bez-primary)', borderRadius: 3 }} /></div>
                    <span style={{ width: 40, textAlign: 'right', fontFamily: 'monospace' }}>{v}%</span>
                  </div>
                ))}
                {grid.mix_period && <p style={{ fontSize: 9, color: 'var(--bez-text-muted)', marginTop: 6 }}>Mix: {grid.mix_period}</p>}
              </div>
            )}
          </>
        ) : <p style={{ fontSize: 12, color: 'var(--bez-text-muted)', marginTop: 12 }}>No se pudo leer la red. Reintentando cada minuto.</p>}
      </div>
    </section>
  )
}

const Stat = ({ label, val }) => (
  <div className="stat-card">
    <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--bez-text-muted)', textTransform: 'uppercase' }}>{label}</p>
    <p style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace' }}>{val}</p>
  </div>
)
