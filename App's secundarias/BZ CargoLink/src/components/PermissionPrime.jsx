/**
 * PermissionPrime — UI de "priming" ÉTICO previa al prompt nativo del navegador.
 *
 * Se muestra ANTES de solicitar la herramienta del cliente (cámara/GPS) para que
 * el usuario decida informado: qué herramienta, para qué y qué pasa con el dato.
 * Solo tras pulsar "Permitir" se dispara el prompt nativo (request()).
 *
 * Props:
 *   tool       — clave de CLIENT_TOOLS ('camera' | 'geolocation')
 *   open       — boolean, controla visibilidad
 *   onGranted  — (resource) => void   recurso devuelto por request() (MediaStream / Position)
 *   onCancel   — () => void           el usuario eligió "Ahora no"
 *   onDenied   — (error) => void      el navegador/usuario denegó en el prompt nativo
 */

import React, { useState } from 'react'
import { ShieldCheck, Camera, MapPin, X } from 'lucide-react'
import { useClientPermission } from '../hooks/useClientPermission'

const ICONS = { camera: Camera, geolocation: MapPin }

const PermissionPrime = ({ tool, open, onGranted, onCancel, onDenied }) => {
  const perm = useClientPermission(tool)
  const [requesting, setRequesting] = useState(false)
  const Icon = ICONS[tool] || ShieldCheck

  if (!open) return null

  const handleAllow = async () => {
    setRequesting(true)
    try {
      const resource = await perm.request()   // dispara el prompt nativo del navegador
      onGranted?.(resource)
    } catch (err) {
      onDenied?.(err)
    } finally {
      setRequesting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Permiso de ${perm.label}`}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', padding: 20 }}
    >
      <div className="card" style={{ maxWidth: 420, width: '100%', margin: 0, border: '1px solid var(--bz-primary)', position: 'relative' }}>
        <button
          onClick={onCancel}
          aria-label="Cerrar"
          style={{ position: 'absolute', top: 12, right: 12, background: 'transparent', border: 'none', color: 'var(--bz-text-muted)', cursor: 'pointer' }}
        >
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: 'rgba(0,240,255,0.1)', border: '1px solid var(--bz-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bz-primary)' }}>
            <Icon size={22} />
          </div>
          <div>
            <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--bz-primary)' }}>Permiso de {perm.label}</p>
            <h3 style={{ fontSize: 16, fontWeight: 800, fontFamily: 'Space Grotesk' }}>Solo cuando lo necesitas</h3>
          </div>
        </div>

        <p style={{ fontSize: 13, color: 'var(--bz-text)', marginBottom: 12, lineHeight: 1.5 }}>
          {perm.purpose}
        </p>

        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'var(--bz-surface-container)', border: '1px solid var(--bz-border)', borderRadius: 6, padding: 12, marginBottom: 20 }}>
          <ShieldCheck size={16} color="var(--bz-secondary)" style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 11, color: 'var(--bz-text-muted)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--bz-secondary)' }}>Tus datos:</strong> {perm.dataHandling}
          </p>
        </div>

        {perm.isDenied ? (
          <>
            <p style={{ fontSize: 11, color: 'var(--bz-error)', marginBottom: 12 }}>
              El permiso está bloqueado en tu navegador. Actívalo desde el icono del candado en la barra de direcciones para usar esta función.
            </p>
            <button className="btn" style={{ width: '100%', background: 'var(--bz-surface-container)', border: '1px solid var(--bz-border)' }} onClick={onCancel}>
              Continuar sin {perm.label.toLowerCase()}
            </button>
          </>
        ) : (
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              className="btn"
              style={{ flex: 1, background: 'var(--bz-surface-container)', border: '1px solid var(--bz-border)' }}
              onClick={onCancel}
              disabled={requesting}
            >
              Ahora no
            </button>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={handleAllow}
              disabled={requesting}
            >
              {requesting ? 'Solicitando…' : `Permitir ${perm.label.toLowerCase()}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default PermissionPrime
