/**
 * PermissionPrime — UI de "priming" ÉTICO previa al prompt nativo del navegador.
 *
 * Se muestra ANTES de solicitar la herramienta del cliente (cámara/GPS) para que
 * el usuario decida informado: qué herramienta, para qué y qué pasa con el dato.
 * Solo tras pulsar "Permitir" se dispara el prompt nativo (request()).
 *
 * Gating por suscripción (requiredTiers): si se pasa esta prop, el modal
 * primero comprueba el plan del usuario (useSubscriptionTier). Si no alcanza,
 * se muestra un aviso de "requiere plan X" y el navegador NUNCA llega a
 * preguntar por el permiso — así una cuenta gratuita no "quema" el permiso
 * del dispositivo por una función a la que no tiene derecho.
 *
 * Props:
 *   tool          — clave de CLIENT_TOOLS ('camera' | 'geolocation')
 *   open          — boolean, controla visibilidad
 *   onGranted     — (resource) => void   recurso devuelto por request() (MediaStream / Position)
 *   onCancel      — () => void           el usuario eligió "Ahora no" / no tiene el plan
 *   onDenied      — (error) => void      el navegador/usuario denegó en el prompt nativo
 *   requiredTiers — string[] opcional. Si se omite, no hay gating (compatible con uso previo).
 *   onAllow       — () => Promise<resource> opcional. Si se pasa, sustituye a
 *                   perm.request() (útil cuando la SubApp necesita su propio
 *                   getUserMedia con opciones extra, p. ej. selector de
 *                   cámara — ver BZ PureScan). Sin esta prop, se usa el
 *                   request() genérico del hook.
 */

import React, { useState } from 'react'
import { useClientPermission } from './useClientPermission'
import { useSubscriptionTier } from './useSubscriptionTier'

// Iconos SVG inline (sin lucide-react): los ficheros en _shared/ viven fuera
// del node_modules de cada SubApp — cualquier dependencia npm aquí rompe el
// build de Vite al no poder resolverse (ver bezhas-wallet-auth.js, que sigue
// el mismo principio de "cero dependencias" por esta misma razón).
const svgProps = (size) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' })

const ShieldCheckIcon = ({ size = 16, color }) => (
  <svg {...svgProps(size)} style={{ color }}>
    <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
)
const CameraIcon = ({ size = 22, color }) => (
  <svg {...svgProps(size)} style={{ color }}>
    <path d="M3 8h3l2-2h8l2 2h3v11H3z" />
    <circle cx="12" cy="13.5" r="3.5" />
  </svg>
)
const MapPinIcon = ({ size = 22, color }) => (
  <svg {...svgProps(size)} style={{ color }}>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
)
const XIcon = ({ size = 18, color }) => (
  <svg {...svgProps(size)} style={{ color }}>
    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
  </svg>
)
const LockIcon = ({ size = 22, color }) => (
  <svg {...svgProps(size)} style={{ color }}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
)

const ICONS = { camera: CameraIcon, geolocation: MapPinIcon }
const TIER_LABELS = { free: 'Gratuito', starter: 'Starter', professional: 'Profesional', enterprise: 'Enterprise' }

const PermissionPrime = ({ tool, open, onGranted, onCancel, onDenied, requiredTiers = null, onAllow = null }) => {
  const perm = useClientPermission(tool)
  const sub = useSubscriptionTier()
  const [requesting, setRequesting] = useState(false)
  const Icon = ICONS[tool] || ShieldCheckIcon

  if (!open) return null

  const gated = Array.isArray(requiredTiers) && requiredTiers.length > 0
  const tierOk = !gated || sub.hasTier(requiredTiers)

  const handleAllow = async () => {
    setRequesting(true)
    try {
      const resource = onAllow ? await onAllow() : await perm.request()   // dispara el prompt nativo del navegador
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
          <XIcon size={18} />
        </button>

        {gated && sub.loading ? (
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: 'var(--bz-text-muted)' }}>Comprobando tu plan…</p>
          </div>
        ) : gated && !tierOk ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 8, background: 'rgba(255,180,0,0.1)', border: '1px solid #ffb400', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffb400' }}>
                <LockIcon size={22} />
              </div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: '#ffb400' }}>Función de plan superior</p>
                <h3 style={{ fontSize: 16, fontWeight: 800, fontFamily: 'Space Grotesk' }}>Requiere suscripción</h3>
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--bz-text)', marginBottom: 20, lineHeight: 1.5 }}>
              Usar {perm.label.toLowerCase()} en esta función requiere el plan {requiredTiers.map(t => TIER_LABELS[t] || t).join(' o ')}.
              Tu plan actual es <strong>{TIER_LABELS[sub.tier] || sub.tier}</strong>. No se ha solicitado ningún permiso a tu navegador.
            </p>
            <button className="btn" style={{ width: '100%', background: 'var(--bz-surface-container)', border: '1px solid var(--bz-border)' }} onClick={onCancel}>
              Entendido
            </button>
          </>
        ) : (
          <>
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
              <span style={{ flexShrink: 0, marginTop: 2 }}><ShieldCheckIcon size={16} color="var(--bz-secondary)" /></span>
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
          </>
        )}
      </div>
    </div>
  )
}

export default PermissionPrime
