/**
 * PortsMap — real interactive world map of the principal container ports.
 *
 * Leaflet is loaded from CDN at runtime (no bundler dependency — important while
 * the workspace pnpm install is fragile). Dark CARTO tiles match the CargoLink
 * theme; each port is a glowing marker whose popup shows the official address and
 * a Google Maps deep-link. If the CDN/tiles are unreachable (offline), it falls
 * back to a styled port directory so the data is always usable.
 */
import React, { useEffect, useRef, useState } from 'react'
import { PORTS } from '../data/ports'

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'

function loadLeaflet() {
  return new Promise((resolve, reject) => {
    if (window.L) return resolve(window.L)
    if (!document.querySelector(`link[data-leaflet]`)) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'; link.href = LEAFLET_CSS; link.dataset.leaflet = '1'
      document.head.appendChild(link)
    }
    let script = document.querySelector('script[data-leaflet]')
    if (!script) {
      script = document.createElement('script')
      script.src = LEAFLET_JS; script.async = true; script.dataset.leaflet = '1'
      document.body.appendChild(script)
    }
    const timeout = setTimeout(() => reject(new Error('Leaflet load timeout')), 8000)
    script.addEventListener('load', () => { clearTimeout(timeout); window.L ? resolve(window.L) : reject(new Error('Leaflet missing')) })
    script.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('Leaflet load error')) })
    if (window.L) { clearTimeout(timeout); resolve(window.L) }
  })
}

export default function PortsMap() {
  const elRef = useRef(null)
  const mapRef = useRef(null)
  const [status, setStatus] = useState('loading') // loading | ready | error

  useEffect(() => {
    let cancelled = false
    loadLeaflet()
      .then((L) => {
        if (cancelled || !elRef.current || mapRef.current) return
        const map = L.map(elRef.current, { worldCopyJump: true, attributionControl: true, scrollWheelZoom: false })
        mapRef.current = map
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '© OpenStreetMap · © CARTO', subdomains: 'abcd', maxZoom: 19,
        }).addTo(map)

        const markers = PORTS.map((p) => {
          const accent = p.home ? '#2ff801' : '#00f0ff'
          const m = L.circleMarker([p.lat, p.lng], {
            radius: p.home ? 9 : 7, color: accent, weight: 2, fillColor: accent, fillOpacity: 0.55,
          }).addTo(map)
          m.bindPopup(
            `<div style="font-family:system-ui;min-width:210px">
               <strong style="color:#0a7d6b">${p.name}</strong>
               <span style="color:#888;font-size:11px"> · ${p.country}</span><br/>
               <span style="font-size:12px">${p.address}</span><br/>
               <a href="${p.maps}" target="_blank" rel="noopener" style="font-size:12px;color:#0a84ff">Ver en Google Maps ↗</a>
             </div>`
          )
          if (p.home) m.bindTooltip('HQ · Algeciras', { permanent: false, direction: 'top' })
          return m
        })
        map.fitBounds(L.featureGroup(markers).getBounds().pad(0.15))
        setStatus('ready')
        // Tiles may still fail to fetch even after the script loads (offline).
        setTimeout(() => { try { map.invalidateSize() } catch { /* noop */ } }, 200)
      })
      .catch(() => { if (!cancelled) setStatus('error') })

    return () => {
      cancelled = true
      if (mapRef.current) { try { mapRef.current.remove() } catch { /* noop */ } mapRef.current = null }
    }
  }, [])

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0a0e14' }}>
      <div ref={elRef} style={{ position: 'absolute', inset: 0, opacity: status === 'ready' ? 1 : 0, transition: 'opacity .4s' }} />

      {status === 'loading' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00f0ff', fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>
          CARGANDO RED GLOBAL DE PUERTOS…
        </div>
      )}

      {status === 'error' && (
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: 14 }}>
          <p style={{ fontSize: 10, color: '#00f0ff', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
            Red global de puertos · directorio (mapa offline)
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            {PORTS.map((p) => (
              <a key={p.id} href={p.maps} target="_blank" rel="noopener noreferrer"
                style={{ display: 'block', textDecoration: 'none', padding: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${p.home ? 'rgba(47,248,1,0.4)' : 'var(--bz-border)'}`, borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: p.home ? '#2ff801' : '#fff' }}>{p.name}</span>
                  <span style={{ fontSize: 9, color: 'var(--bz-text-muted)', textTransform: 'uppercase' }}>{p.country}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--bz-text-muted)', marginTop: 3 }}>{p.address}</div>
                <div style={{ fontSize: 10, color: '#0a84ff', marginTop: 4 }}>Ver en Google Maps ↗</div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
