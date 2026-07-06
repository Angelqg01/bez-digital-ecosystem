import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Fingerprint,
  Camera,
  ShieldCheck,
  RefreshCw,
  Binary,
} from 'lucide-react'
import { useTransactions } from '../hooks/useTransaction'
import { cargoGateway } from '../services/cargoGateway'
import PermissionPrime from '../components/PermissionPrime'

function authKey() {
  return localStorage.getItem('bezhas_access_token') || localStorage.getItem('bezhas-jwt')
}

const hashBytes = async (arrayBuffer) => {
  const digest = await crypto.subtle.digest('SHA-256', arrayBuffer)
  return '0x' + Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

const CargoFingerprint = () => {
  const navigate = useNavigate()
  const { transactions, loading: txLoading } = useTransactions()
  const [selected, setSelected] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [computeNotice, setComputeNotice] = useState('')
  const [showPrime, setShowPrime] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [fingerprintHash, setFingerprintHash] = useState(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const tx = transactions.find(t => t.b_uid === selected)

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraActive(false)
  }

  useEffect(() => () => stopCamera(), [])

  const handleCaptureClick = () => {
    if (!selected) { setError('Selecciona un B-UID'); return }
    setError('')
    setShowPrime(true)
  }

  const handleCameraGranted = (stream) => {
    setShowPrime(false)
    streamRef.current = stream
    setCameraActive(true)
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      videoRef.current.play().catch(() => {})
    }
  }

  const handleCameraDenied = () => {
    setShowPrime(false)
    setError('Sin acceso a la cámara. Puedes usar "Computar SIFT" con la imagen de referencia.')
  }

  const captureAndAnchor = async () => {
    if (!videoRef.current || !cameraActive) return
    setAnalyzing(true)
    setError('')
    try {
      const video = videoRef.current
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9))
      const hash = await hashBytes(await blob.arrayBuffer())
      setFingerprintHash(hash)
      stopCamera()

      const response = await cargoGateway.auditFingerprint({
        bUid: selected,
        capture: 'live-camera-frame',
        model: 'SIFT_MSE',
        payloadHash: hash,
      }, authKey())
      setResult(response)
      setComputeNotice(`Hash ${hash.slice(0, 18)}... anclado. La imagen no salió del dispositivo.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setAnalyzing(false)
    }
  }

  const computeFromReference = async () => {
    if (!selected) { setError('Selecciona un B-UID'); return }
    setAnalyzing(true)
    setError('')
    try {
      const response = await cargoGateway.auditFingerprint({
        bUid: selected,
        capture: 'golden-image-reference-frame',
        model: 'SIFT_MSE',
      }, authKey())
      setResult(response)
      setComputeNotice('Vector SIFT calculado desde imagen de referencia y registrado como evento de auditoría.')
    } catch (err) {
      setError(err.message)
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <PermissionPrime
        tool="camera"
        open={showPrime}
        onGranted={handleCameraGranted}
        onCancel={() => setShowPrime(false)}
        onDenied={handleCameraDenied}
      />

      <header style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--bz-primary)', marginBottom: 8 }}>
          <Fingerprint size={16} />
          <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2 }}>Integrity Module v2.4</span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Space Grotesk' }}>Cargo Fingerprint</h1>
        <p style={{ fontSize: 12, color: 'var(--bz-text-muted)', marginTop: 4 }}>
          Captura un fotograma, calcula SHA-256 en dispositivo, ancla el hash como auditoría del B-UID.
        </p>
      </header>

      {/* B-UID selector */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: 'var(--bz-text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
          Selecciona B-UID para auditar
        </label>
        {txLoading ? (
          <p style={{ fontSize: 12, color: 'var(--bz-text-muted)' }}>Cargando...</p>
        ) : transactions.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--bz-text-muted)' }}>No hay B-UIDs disponibles.</p>
        ) : (
          <select
            value={selected}
            onChange={e => { setSelected(e.target.value); setResult(null); setError(''); setComputeNotice(''); setFingerprintHash(null) }}
            style={{
              width: '100%', padding: '10px 12px', background: '#090d16',
              border: '1px solid var(--bz-border)', borderRadius: 10, color: '#fff', fontSize: 13,
            }}
          >
            <option value="">— Elige un B-UID —</option>
            {transactions.map(t => (
              <option key={t.b_uid} value={t.b_uid}>
                {t.b_uid} · {t.status} {t.cargo?.type ? `· ${t.cargo.type}` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Scanner Viewport */}
      <div className="card" style={{ padding: 0, position: 'relative', overflow: 'hidden', height: 350, marginBottom: 24 }}>
        {cameraActive ? (
          <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: '#0e0e0e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: 'var(--bz-text-muted)' }}>
              <Camera size={48} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
              <p style={{ fontSize: 12 }}>Pulsa "Capture Frame" para activar la cámara</p>
            </div>
          </div>
        )}
        {analyzing && (
          <>
            <motion.div
              initial={{ top: 0 }}
              animate={{ top: '100%' }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'var(--bz-primary)', boxShadow: '0 0 15px var(--bz-primary)', zIndex: 10 }}
            />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: 'rgba(0,0,0,0.7)', padding: '16px 24px', borderRadius: 4, border: '1px solid var(--bz-primary)', textAlign: 'center' }}>
                <RefreshCw className="animate-spin" size={24} color="var(--bz-primary)" style={{ margin: '0 auto 8px' }} />
                <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--bz-primary)', textTransform: 'uppercase' }}>Computing SHA-256...</p>
              </div>
            </div>
          </>
        )}
        {result && !cameraActive && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(121,255,91,0.1)', border: '4px solid var(--bz-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
              <ShieldCheck size={80} color="var(--bz-secondary)" />
            </motion.div>
          </div>
        )}
      </div>

      {/* Hash display */}
      {fingerprintHash && (
        <div className="card" style={{ padding: 12, marginBottom: 20 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--bz-text-muted)', textTransform: 'uppercase' }}>SHA-256 del fotograma</span>
          <code style={{ display: 'block', marginTop: 4, fontSize: 11, color: 'var(--bz-primary)', wordBreak: 'break-all', fontFamily: 'monospace' }}>
            {fingerprintHash}
          </code>
        </div>
      )}

      {error && <p style={{ color: '#ef4444', fontSize: 11, marginBottom: 16 }}>{error}</p>}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        {cameraActive ? (
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={captureAndAnchor} disabled={analyzing}>
            <Camera size={20} />
            {analyzing ? 'ANCLANDO...' : 'CAPTURAR Y ANCLAR'}
          </button>
        ) : (
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCaptureClick} disabled={analyzing || !selected}>
            <Camera size={20} />
            {analyzing ? 'ANALYZING...' : 'CAPTURE FRAME'}
          </button>
        )}
        <button
          className="btn"
          style={{ background: 'var(--bz-surface-container)', border: '1px solid var(--bz-border)', flex: 1 }}
          onClick={computeFromReference}
          disabled={analyzing || !selected}
        >
          <Binary size={20} />
          {analyzing ? 'COMPUTING...' : 'COMPUTE SIFT'}
        </button>
      </div>

      {computeNotice && <p style={{ color: 'var(--bz-secondary)', fontSize: 11, marginBottom: 12 }}>{computeNotice}</p>}

      {result && selected && (
        <button
          className="btn"
          style={{ width: '100%', border: '1px solid var(--bz-border)', padding: 14 }}
          onClick={() => navigate(`/tx/${selected}`)}
        >
          Ver detalle del B-UID →
        </button>
      )}
    </div>
  )
}

export default CargoFingerprint
