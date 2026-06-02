import React, { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Eye,
  Image as ImageIcon,
  Loader,
  RefreshCw,
  Scale,
  ScanSearch,
  Send,
  ShieldAlert,
  Sparkles,
  Upload,
  Video,
  X,
} from 'lucide-react'
import { runEdgeInference, analyzeWithGemini, syncToBlockchain } from '../api'
import {
  buildEvidencePayload,
  captureVideoFrame,
  compareCaptures,
  fileToCapture,
  videoFileToCaptures,
} from '../utils/visualEvidence'
import { syncIntegrationBridge } from '../services/integrationBridge'

const OBJECT_TYPES = [
  { id: 'food', label: 'Comida' },
  { id: 'object', label: 'Objeto' },
  { id: 'property', label: 'Inmueble' },
  { id: 'animal', label: 'Animal' },
]

const PHASE_LABELS = {
  idle: 'Camara lista',
  capture: 'Captura evidencia',
  compare: 'Comparando antes/despues',
  edge: 'Edge AI visual',
  gemini: 'Razonamiento semantico',
  integrations: 'Sincronizando SubApps',
  blockchain: 'Anclando evidencia',
  done: 'Evidencia verificada',
  error: 'Requiere revision',
}

const emptyCaptures = { before: null, after: null }

const Scanner = () => {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const fileInputRef = useRef(null)

  const [devices, setDevices] = useState([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [activeSlot, setActiveSlot] = useState('before')
  const [objectType, setObjectType] = useState('food')
  const [captures, setCaptures] = useState(emptyCaptures)
  const [scanning, setScanning] = useState(false)
  const [phase, setPhase] = useState('idle')
  const [results, setResults] = useState(null)
  const [showDetections, setShowDetections] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  const [uploadingMedia, setUploadingMedia] = useState(false)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setCameraReady(false)
  }, [])

  const loadDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return

    const mediaDevices = await navigator.mediaDevices.enumerateDevices()
    const videoDevices = mediaDevices.filter((device) => device.kind === 'videoinput')
    setDevices(videoDevices)

    if (!selectedDeviceId && videoDevices[0]?.deviceId) {
      const environmentCamera = videoDevices.find((device) => /back|rear|environment|trasera/i.test(device.label))
      setSelectedDeviceId(environmentCamera?.deviceId || videoDevices[0].deviceId)
    }
  }, [selectedDeviceId])

  const startCamera = useCallback(async (deviceId = selectedDeviceId) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Este navegador no permite acceso directo a camara. Usa subida de imagen.')
      return
    }

    stopCamera()
    setCameraError(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          facingMode: deviceId ? undefined : { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      setCameraReady(true)
      await loadDevices()
    } catch (err) {
      setCameraReady(false)
      setCameraError(err.name === 'NotAllowedError'
        ? 'Permiso de camara denegado. Activalo en el navegador o sube imagenes.'
        : 'No se pudo iniciar la camara. Prueba otra camara o usa subida de imagen.')
    }
  }, [loadDevices, selectedDeviceId, stopCamera])

  useEffect(() => {
    startCamera()
    return stopCamera
  }, [])

  useEffect(() => {
    if (selectedDeviceId) startCamera(selectedDeviceId)
  }, [selectedDeviceId])

  const saveCapture = useCallback((slot, capture) => {
    setCaptures((current) => ({ ...current, [slot]: capture }))
    setResults(null)
    setShowResults(false)
    setShowDetections(false)
    setPhase('capture')
    setActiveSlot(slot === 'before' ? 'after' : 'before')
  }, [])

  const handleCapture = async () => {
    try {
      setError(null)
      const capture = await captureVideoFrame(videoRef.current)
      saveCapture(activeSlot, capture)
    } catch (err) {
      setError(err.message || 'No se pudo capturar desde la camara.')
    }
  }

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      setError(null)
      setUploadingMedia(true)

      if (file.type.startsWith('video/')) {
        const videoCaptures = await videoFileToCaptures(file)
        setCaptures(videoCaptures)
        setResults(null)
        setShowResults(false)
        setShowDetections(false)
        setPhase('capture')
        setActiveSlot('after')
        return
      }

      if (file.type.startsWith('image/')) {
        const capture = await fileToCapture(file)
        saveCapture(activeSlot, capture)
        return
      }

      throw new Error('Formato no soportado. Usa imagen o video.')
    } catch (err) {
      setError(err.message || 'No se pudo procesar el archivo.')
    } finally {
      setUploadingMedia(false)
    }
  }

  const handleStartScan = async () => {
    if (!captures.before || !captures.after) {
      setError('Captura o sube una imagen ANTES y otra DESPUES para comparar evidencia.')
      return
    }

    setScanning(true)
    setError(null)
    setProgress(0)

    try {
      setPhase('compare')
      setProgress(15)
      const comparison = await compareCaptures(captures.before, captures.after)

      setPhase('edge')
      setProgress(35)
      const edgeData = await runEdgeInference(captures.after.blob)
      setShowDetections(true)

      const evidence = buildEvidencePayload({
        objectType,
        before: captures.before,
        after: captures.after,
        comparison,
        edge: edgeData,
      })

      setResults({ edge: edgeData, evidence, comparison, captures })

      setPhase('gemini')
      setProgress(60)
      const geminiData = await analyzeWithGemini({
        ...edgeData,
        evidence,
        object_type: objectType,
        analysis_goal: 'before_after_visual_comparison',
      })

      setResults((prev) => ({ ...prev, gemini: geminiData }))

      setPhase('integrations')
      setProgress(72)
      const integrations = await syncIntegrationBridge({
        objectType,
        captures,
        evidence,
        comparison,
        edge: edgeData,
        gemini: geminiData,
      })

      setResults((prev) => ({ ...prev, integrations }))

      setPhase('blockchain')
      setProgress(82)
      const tx = await syncToBlockchain({
        ...geminiData,
        evidence,
        comparison,
        integrations,
      })

      setResults((prev) => ({ ...prev, tx }))
      setPhase('done')
      setProgress(100)
      setShowResults(true)
    } catch (err) {
      console.error('Scan error:', err)
      setError(err.message || 'Scan failed. Please try again.')
      setPhase('error')
    } finally {
      setScanning(false)
    }
  }

  const handleRetry = () => {
    setCaptures(emptyCaptures)
    setResults(null)
    setShowDetections(false)
    setShowResults(false)
    setPhase('idle')
    setError(null)
    setProgress(0)
    setActiveSlot('before')
  }

  const selectedTypeLabel = OBJECT_TYPES.find((type) => type.id === objectType)?.label || 'Evidencia'
  const hasBothCaptures = captures.before && captures.after

  return (
    <div className="scanner-viewport">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        muted
        autoPlay
      />

      {!cameraReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_top,#24303d,#070e1a)] px-6 text-center">
          <div>
            <Video size={44} className="mx-auto mb-4 text-bz-primary" />
            <p className="font-bold">Camara no activa</p>
            <p className="mt-2 text-body-sm text-bz-text-muted">
              {cameraError || 'Puedes iniciar camara o subir dos imagenes para comparar.'}
            </p>
            <button onClick={() => startCamera()} className="btn btn-primary mt-4">
              Activar camara
            </button>
          </div>
        </div>
      )}

      <div className="ar-overlay" />
      {scanning && <div className="scan-line" />}

      <AnimatePresence>
        {showDetections && results?.edge?.detections && (
          <>
            {results.edge.detections.map((detection, idx) => (
              <motion.div
                key={`${detection.label}-${idx}`}
                className="detection-box"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                style={{
                  top: `${detection.box[1]}px`,
                  left: `${detection.box[0]}px`,
                  width: `${detection.box[2]}px`,
                  height: `${detection.box[3]}px`,
                  borderColor: detection.confidence > 0.9 ? '#39ff14' : '#2b8cee',
                }}
              >
                <div className="detection-label">
                  {detection.label} [{(detection.confidence * 100).toFixed(1)}%]
                </div>
              </motion.div>
            ))}
          </>
        )}
      </AnimatePresence>

      <div className="scanner-top-panel absolute left-0 right-0 top-0 z-30 p-4">
        <div className="glass-panel p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-label-sm uppercase tracking-wider text-bz-text-muted">Modo evidencia</p>
              <p className="font-bold">{selectedTypeLabel} antes/despues</p>
            </div>
            <button
              className="btn btn-secondary px-3 py-2 text-xs"
              onClick={() => fileInputRef.current?.click()}
              disabled={scanning || uploadingMedia}
            >
              <Upload size={16} />
              {uploadingMedia ? 'Leyendo' : 'Subir'}
            </button>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2">
            {OBJECT_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => setObjectType(type.id)}
                className={`rounded-lg border px-2 py-2 text-xs font-bold transition ${
                  objectType === type.id
                    ? 'border-bz-neon bg-bz-neon/10 text-bz-neon'
                    : 'border-bz-ghost-border bg-black/20 text-bz-text-muted'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>

          {devices.length > 1 && (
            <select
              value={selectedDeviceId}
              onChange={(event) => setSelectedDeviceId(event.target.value)}
              className="input-field mt-3 h-10 text-sm"
              disabled={scanning}
              aria-label="Seleccionar camara"
            >
              {devices.map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camara ${index + 1}`}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFileUpload}
        disabled={scanning || uploadingMedia}
      />

      <div className="scanner-bottom-panel absolute bottom-0 left-0 right-0 z-40 p-4">
        <div className="mb-4 grid grid-cols-3 gap-3">
          <MetricCard
            label="Cambio"
            val={results?.comparison ? `${results.comparison.changeScore}%` : '--'}
            icon={<ScanSearch size={14} />}
            active={phase === 'compare'}
            color={results?.comparison?.riskLevel === 'HIGH' ? '#f87171' : undefined}
          />
          <MetricCard
            label="Biomasa"
            val={results?.edge?.metrics?.biomass ? `${results.edge.metrics.biomass}kg` : '--'}
            icon={<Scale size={14} />}
            active={phase === 'edge'}
          />
          <MetricCard
            label="Calidad"
            val={results?.gemini?.analysis?.freshness_index ? `${results.gemini.analysis.freshness_index}/10` : '--'}
            icon={<ShieldAlert size={14} />}
            color={phase === 'done' ? '#39ff14' : undefined}
            active={phase === 'gemini' || phase === 'done'}
          />
        </div>

        <div className="card glass bg-black/55">
          <CaptureStrip
            captures={captures}
            activeSlot={activeSlot}
            onSlotChange={setActiveSlot}
          />

          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-label-md font-bold">{PHASE_LABELS[phase]}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${scanning ? 'animate-pulse bg-bz-neon' : 'bg-bz-text-muted'}`} />
                <span className="truncate text-label-sm font-bold uppercase text-bz-text-muted">
                  {captures.before?.sourceType === 'video'
                    ? `Video ${captures.before.duration}s listo`
                    : hasBothCaptures ? 'Comparativa lista' : `Pendiente: ${captures.before ? 'despues' : 'antes'}`}
                </span>
              </div>
            </div>

            {phase === 'done' && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="rounded-full bg-bz-neon/10 px-3 py-1.5 text-label-sm font-black text-bz-neon"
              >
                DPP
              </motion.div>
            )}
          </div>

          {scanning && (
            <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-bz-surface">
              <motion.div
                className="h-full bg-gradient-to-r from-bz-primary to-bz-neon"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          )}

          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              className="btn btn-icon bg-bz-surface hover:bg-bz-surface-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={scanning || uploadingMedia}
              title="Subir imagen o video"
            >
              {uploadingMedia ? <Loader size={20} className="animate-spin" /> : <ImageIcon size={20} />}
            </button>

            <button
              className="btn btn-icon-lg btn-primary"
              onClick={hasBothCaptures ? handleStartScan : handleCapture}
              disabled={scanning || uploadingMedia || (!cameraReady && !hasBothCaptures)}
              style={{
                background: phase === 'done' ? '#39ff14' : '#2b8cee',
                boxShadow: `0 8px 32px ${phase === 'done' ? 'rgba(57, 255, 20, 0.3)' : 'rgba(43, 140, 238, 0.3)'}`,
              }}
              aria-label={hasBothCaptures ? 'Analizar comparativa' : `Capturar ${activeSlot}`}
            >
              {scanning ? (
                <Loader size={32} className="animate-spin" />
              ) : phase === 'done' ? (
                <CheckCircle2 size={32} color="black" />
              ) : hasBothCaptures ? (
                <Sparkles size={32} />
              ) : (
                <Camera size={32} />
              )}
            </button>

            <button
              className="btn btn-icon bg-bz-surface hover:bg-bz-surface-2"
              onClick={handleRetry}
              disabled={scanning}
              title="Reiniciar"
            >
              <RefreshCw size={20} />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showResults && results && (
          <ResultsModal
            results={results}
            objectType={selectedTypeLabel}
            onClose={() => setShowResults(false)}
            onRetry={handleRetry}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <ErrorPanel error={error} onClose={() => setError(null)} onRetry={handleRetry} />
        )}
      </AnimatePresence>
    </div>
  )
}

const CaptureStrip = ({ captures, activeSlot, onSlotChange }) => (
  <div className="grid grid-cols-2 gap-3">
    {['before', 'after'].map((slot) => {
      const capture = captures[slot]
      const active = activeSlot === slot

      return (
        <button
          key={slot}
          onClick={() => onSlotChange(slot)}
          className={`capture-tile ${active ? 'capture-tile-active' : ''}`}
          type="button"
        >
          {capture ? (
            <img src={capture.dataUrl} alt={slot === 'before' ? 'Captura antes' : 'Captura despues'} />
          ) : (
            <div className="flex h-full items-center justify-center text-bz-text-muted">
              <Camera size={22} />
            </div>
          )}
          <span>
            {slot === 'before' ? 'Antes' : 'Despues'}
            {capture?.sourceType === 'video' && capture.frameTime !== undefined ? ` ${capture.frameTime}s` : ''}
          </span>
        </button>
      )
    })}
  </div>
)

const MetricCard = ({ label, val, icon, color, active }) => (
  <motion.div
    className="metric-card"
    animate={{ borderColor: active ? '#39ff14' : 'rgba(64, 71, 82, 0.15)' }}
  >
    <div className="mb-1 flex items-center gap-2 text-bz-text-muted">
      {icon}
      <span className="text-label-sm font-bold uppercase">{label}</span>
    </div>
    <p style={{ color: color || 'white' }} className="text-lg font-bold">{val}</p>
  </motion.div>
)

const ResultsModal = ({ results, objectType, onClose, onRetry }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    onClick={onClose}
    className="absolute inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm"
  >
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      exit={{ y: 100 }}
      onClick={(event) => event.stopPropagation()}
      className="max-h-[84vh] w-full overflow-y-auto rounded-t-3xl border border-bz-ghost-border bg-gradient-to-b from-bz-surface to-bz-bg p-6"
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="mb-1 text-label-md font-bold text-bz-neon">EVIDENCIA VERIFICADA</p>
          <h2 className="text-2xl font-bold">{objectType}</h2>
        </div>
        <button onClick={onClose} className="rounded-lg p-2 hover:bg-bz-surface">
          <X size={24} />
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <img className="h-32 w-full rounded-lg object-cover" src={results.captures.before.dataUrl} alt="Antes" />
        <img className="h-32 w-full rounded-lg object-cover" src={results.captures.after.dataUrl} alt="Despues" />
      </div>

      {results.captures.before.sourceType === 'video' && (
        <div className="mb-6 rounded-lg border border-bz-ghost-border bg-black/30 p-4">
          <p className="mb-2 text-label-sm font-bold text-bz-text-muted">VIDEO EVIDENCE</p>
          <div className="grid grid-cols-2 gap-3 text-body-sm">
            <ResultItem label="Archivo" value={results.captures.before.sourceName || 'Video'} />
            <ResultItem label="Duracion" value={`${results.captures.before.duration}s`} />
            <ResultItem label="Frame antes" value={`${results.captures.before.frameTime}s`} />
            <ResultItem label="Frame despues" value={`${results.captures.after.frameTime}s`} />
          </div>
        </div>
      )}

      <div className="mb-6 rounded-lg border border-bz-neon/30 bg-gradient-to-r from-bz-neon/20 to-bz-primary/20 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="mb-1 text-label-sm text-bz-text-muted">COMPARATIVA</p>
            <p className="text-2xl font-bold text-bz-neon">{results.comparison.qualityGate}</p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold text-bz-neon">{results.comparison.stabilityScore}</p>
            <p className="text-label-sm text-bz-text-muted">estabilidad</p>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <ResultItem label="Cambio visual" value={`${results.comparison.changeScore}%`} />
        <ResultItem label="Riesgo" value={results.comparison.riskLevel} />
        <ResultItem label="Nitidez antes" value={`${results.comparison.beforeSharpness}%`} />
        <ResultItem label="Nitidez despues" value={`${results.comparison.afterSharpness}%`} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <ResultItem label="Batch ID" value={results.gemini?.analysis?.batch_id || results.edge?.id} />
        <ResultItem label="Calidad IA" value={results.gemini?.analysis?.quality_assessment || 'PENDING'} />
        <ResultItem label="Biomasa" value={`${results.edge?.metrics?.biomass || 0}kg`} />
        <ResultItem label="Temperatura" value={results.edge?.metrics?.temperature || '--'} />
      </div>

      {results.integrations && (
        <div className="mb-6 rounded-lg border border-bz-primary/20 bg-bz-primary/10 p-4">
          <p className="mb-3 text-label-sm font-bold text-bz-primary">INTEGRATION BRIDGE</p>
          <div className="space-y-3 text-body-sm">
            <BridgeRow
              label="B-UID"
              value={results.integrations.bUid}
              status="LINKED"
            />
            <BridgeRow
              label="CargoLink"
              value={results.integrations.cargoLink.ok
                ? results.integrations.cargoLink.response?.blockchain?.event || 'FingerprintAnchored'
                : results.integrations.cargoLink.error}
              status={results.integrations.cargoLink.ok ? 'SYNCED' : 'FAILED'}
            />
            <BridgeRow
              label="RWA Twin"
              value={results.integrations.rwa.ok
                ? results.integrations.rwa.payload.twinId
                : results.integrations.rwa.error}
              status={results.integrations.rwa.ok ? 'SYNCED' : 'FAILED'}
            />
            <BridgeRow
              label="Fingerprint"
              value={`${results.integrations.hashes.visualFingerprint.slice(0, 18)}...`}
              status="SHA-256"
            />
          </div>
        </div>
      )}

      {results.tx?.transaction && (
        <div className="mb-6 rounded-lg border border-bz-primary/20 bg-bz-primary/10 p-4">
          <p className="mb-2 text-label-sm font-bold text-bz-primary">CONFIRMACION BLOCKCHAIN</p>
          <div className="space-y-2 text-body-sm">
            <div className="flex justify-between gap-3">
              <span className="text-bz-text-muted">TX Hash:</span>
              <span className="truncate font-mono text-xs text-bz-primary">{results.tx.transaction.hash}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-bz-text-muted">Block:</span>
              <span className="font-bold">{results.tx.transaction.block}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-bz-text-muted">DPP ID:</span>
              <span className="font-bold text-bz-neon">{results.tx.transaction.token_id}</span>
            </div>
          </div>
        </div>
      )}

      {results.gemini?.analysis?.recommendation && (
        <div className="mb-6 rounded-lg border border-bz-border bg-bz-surface p-4">
          <p className="mb-2 text-label-sm font-bold text-bz-text-muted">RECOMENDACION</p>
          <p className="text-body-md text-bz-text">{results.gemini.analysis.recommendation}</p>
        </div>
      )}

      <div className="space-y-2">
        <button className="btn btn-primary w-full gap-2">
          <Send size={18} />
          Compartir evidencia
        </button>
        <button className="btn btn-secondary w-full gap-2">
          <Eye size={18} />
          Ver en blockchain
        </button>
        <button onClick={onRetry} className="btn btn-secondary w-full">
          Nueva comparativa
        </button>
      </div>
    </motion.div>
  </motion.div>
)

const ErrorPanel = ({ error, onClose, onRetry }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="absolute inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm"
  >
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      exit={{ y: 100 }}
      className="w-full border-t border-red-500/50 bg-gradient-to-r from-red-900/20 to-red-800/20 p-4"
    >
      <div className="flex items-start gap-3">
        <AlertCircle size={24} className="mt-1 flex-shrink-0 text-red-400" />
        <div className="flex-1">
          <p className="font-bold text-red-400">Revision requerida</p>
          <p className="text-sm text-red-300/80">{error}</p>
        </div>
        <button onClick={onClose} className="p-1">
          <X size={20} />
        </button>
      </div>
      <button onClick={onRetry} className="btn btn-primary mt-3 w-full">
        Reiniciar evidencia
      </button>
    </motion.div>
  </motion.div>
)

const BridgeRow = ({ label, value, status }) => (
  <div className="flex items-center justify-between gap-3">
    <div className="min-w-0">
      <p className="text-bz-text-muted">{label}</p>
      <p className="truncate font-mono text-xs text-bz-text">{value}</p>
    </div>
    <span className={`text-label-sm font-black ${status === 'FAILED' ? 'text-red-400' : 'text-bz-neon'}`}>
      {status}
    </span>
  </div>
)

const ResultItem = ({ label, value }) => (
  <div className="rounded-lg bg-bz-surface p-3">
    <p className="mb-1 text-label-sm text-bz-text-muted">{label}</p>
    <p className="truncate font-bold text-bz-text">{value}</p>
  </div>
)

export default Scanner
