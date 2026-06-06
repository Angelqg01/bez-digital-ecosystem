import React, { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Fingerprint,
  Camera,
  ShieldCheck,
  RefreshCw,
  Binary
} from 'lucide-react'
import { usePlatformState } from '../hooks/usePlatformState'
import { cargoGateway } from '../services/cargoGateway'
import { blockchainStatusText } from '../utils/blockchainDisplay'
import PermissionPrime from '../components/PermissionPrime'

// SHA-256 de los bytes de la imagen capturada. La imagen cruda NUNCA sale del
// dispositivo: solo este hash se ancla en BeZhas L2 (minimización de datos).
const hashBytes = async (arrayBuffer) => {
  const digest = await crypto.subtle.digest('SHA-256', arrayBuffer)
  return '0x' + Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

const CargoFingerprint = () => {
  const { platformState } = usePlatformState()
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [computeNotice, setComputeNotice] = useState('')
  const [showPrime, setShowPrime] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraActive(false)
  }

  // Liberar la cámara al desmontar (no dejar el dispositivo activo).
  useEffect(() => () => stopCamera(), [])

  // Just-in-time: el priming se abre solo cuando el usuario pulsa "Capturar".
  const handleCaptureClick = () => {
    setError('')
    setShowPrime(true)
  }

  // El usuario aceptó el priming y el navegador concedió la cámara.
  const handleCameraGranted = (stream) => {
    setShowPrime(false)
    streamRef.current = stream
    setCameraActive(true)
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      videoRef.current.play().catch(() => {})
    }
  }

  // Degradación elegante: sin cámara, ofrecemos el cómputo SIFT desde la imagen
  // de referencia (alternativa manual), sin volver a insistir.
  const handleCameraDenied = () => {
    setShowPrime(false)
    setError('Sin acceso a la cámara. Puedes usar “Computar SIFT” con la imagen de referencia.')
  }

  // Captura el frame, calcula el hash REAL y lo envía al Core API.
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
      const fingerprintHash = await hashBytes(await blob.arrayBuffer())
      stopCamera() // liberamos la cámara en cuanto tenemos el hash

      const response = await cargoGateway.auditFingerprint({
        bUid: 'BZ-LOG-ES-17148',
        shipmentId: 'TRX-9921-X',
        capture: 'live-camera-frame',
        model: 'SIFT_MSE',
        payloadHash: fingerprintHash,
      }, platformState.apiKey)
      setResult(response)
      setComputeNotice('Hash del fotograma anclado en BeZhas L2. La imagen no salió del dispositivo.')
    } catch (err) {
      setError(err.message)
    } finally {
      setAnalyzing(false)
    }
  }

  // Alternativa sin cámara: cómputo SIFT desde la imagen de referencia.
  const computeFromReference = async () => {
    setAnalyzing(true)
    setError('')
    try {
      await new Promise(resolve => setTimeout(resolve, 600))
      const response = await cargoGateway.auditFingerprint({
        bUid: 'BZ-LOG-ES-17148',
        shipmentId: 'TRX-9921-X',
        capture: 'golden-image-reference-frame',
        model: 'SIFT_MSE',
      }, platformState.apiKey)
      setResult(response)
      setComputeNotice('Vector SIFT calculado desde imagen de referencia y anclado en BeZhas L2.')
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

      <header style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--bz-primary)', marginBottom: 8 }}>
          <Fingerprint size={16} />
          <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2 }}>Integrity Module v2.4</span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Space Grotesk' }}>Cargo Fingerprint</h1>
        <p style={{ fontSize: 12, color: 'var(--bz-text-muted)', marginTop: 4 }}>
          Validation of the "Golden Image" against current state.
        </p>
      </header>

      {/* Scanner Viewport */}
      <div className="card" style={{ padding: 0, position: 'relative', overflow: 'hidden', height: 400, marginBottom: 24 }}>
        {cameraActive ? (
          <video
            ref={videoRef}
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <img
            src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=800&auto=format&fit=crop"
            alt="Pallet"
            style={{ width: '100%', height: '100%', objectFit: 'cover', filter: analyzing ? 'brightness(0.5) contrast(1.2)' : 'none' }}
          />
        )}

        {analyzing && (
          <>
            <motion.div
              initial={{ top: 0 }}
              animate={{ top: '100%' }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'var(--bz-primary)', boxShadow: '0 0 15px var(--bz-primary)', zIndex: 10 }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
               <div style={{ background: 'rgba(0,0,0,0.7)', padding: '16px 24px', borderRadius: 4, border: '1px solid var(--bz-primary)', textAlign: 'center' }}>
                  <RefreshCw className="animate-spin" size={24} color="var(--bz-primary)" style={{ margin: '0 auto 8px' }} />
                  <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--bz-primary)', textTransform: 'uppercase' }}>Extracting SIFT Features...</p>
               </div>
            </div>
          </>
        )}

        {result && !cameraActive && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(121, 255, 91, 0.1)', border: '4px solid var(--bz-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                <ShieldCheck size={80} color="var(--bz-secondary)" />
             </motion.div>
          </div>
        )}
      </div>

      {/* Analysis Details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
        <div className="card" style={{ margin: 0 }}>
          <p style={{ fontSize: 10, color: 'var(--bz-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>MSE Deviation</p>
          <h4 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Space Grotesk' }}>{result ? `${result.result.mseDeviation}%` : '--'}</h4>
          <span style={{ fontSize: 10, color: result ? 'var(--bz-secondary)' : 'var(--bz-text-muted)' }}>Threshold: 15%</span>
        </div>
        <div className="card" style={{ margin: 0 }}>
          <p style={{ fontSize: 10, color: 'var(--bz-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Smart Contract</p>
          <h4 style={{ fontSize: 14, fontWeight: 800, color: result ? 'var(--bz-secondary)' : 'var(--bz-primary)' }}>{result ? result.result.escrowState : 'READY'}</h4>
          <span style={{ fontSize: 9, fontFamily: 'monospace' }}>{result ? blockchainStatusText(result.blockchain) : 'READY_FOR_CORE_API'}</span>
        </div>
      </div>
      {error && <p style={{ color: 'var(--bz-error)', fontSize: 11, marginBottom: 16 }}>{error}</p>}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12 }}>
        {cameraActive ? (
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={captureAndAnchor} disabled={analyzing}>
            <Camera size={20} />
            {analyzing ? 'ANCLANDO...' : 'CAPTURAR Y ANCLAR'}
          </button>
        ) : (
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCaptureClick} disabled={analyzing}>
            <Camera size={20} />
            {analyzing ? 'ANALYZING...' : 'CAPTURE FRAME'}
          </button>
        )}
        <button
          className="btn"
          style={{ background: 'var(--bz-surface-container)', border: '1px solid var(--bz-border)', flex: 1 }}
          onClick={computeFromReference}
          disabled={analyzing}
        >
          <Binary size={20} />
          {analyzing ? 'COMPUTING...' : 'COMPUTE SIFT'}
        </button>
      </div>
      {computeNotice && <p style={{ color: 'var(--bz-secondary)', fontSize: 11, marginTop: 12 }}>{computeNotice}</p>}

      {/* Audit Log */}
      <div style={{ marginTop: 32 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 16, textTransform: 'uppercase' }}>Verification Log</h3>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <LogItem label="IPFS Retrieval" status="SUCCESS" detail="bafybeig...q6y" />
          <LogItem label="Gemini Vision" status={result ? 'PASSED' : 'PENDING'} detail="Analysis: No structural damage detected." />
          <LogItem label="B-UID Validation" status="VERIFIED" detail="BZ-LOG-ES-17148...88" />
      <LogItem
        label="BeZhas L2 Anchor"
        status={result ? 'CONFIRMED' : 'PENDING'}
        detail={result ? `${result.blockchain.event} ${blockchainStatusText(result.blockchain)} ${result.billing.mode} ${result.realBlockchain?.ok ? 'REAL' : result.source.toUpperCase()}` : 'Waiting for scan'}
      />
        </div>
      </div>
    </div>
  )
}

const LogItem = ({ label, status, detail }) => (
  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bz-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div>
      <p style={{ fontSize: 12, fontWeight: 700 }}>{label}</p>
      <p style={{ fontSize: 10, color: 'var(--bz-text-muted)', fontFamily: 'monospace' }}>{detail}</p>
    </div>
    <span style={{ fontSize: 10, fontWeight: 900, color: status === 'SUCCESS' || status === 'VERIFIED' || status === 'PASSED' ? 'var(--bz-secondary)' : 'var(--bz-primary)' }}>{status}</span>
  </div>
)

export default CargoFingerprint
