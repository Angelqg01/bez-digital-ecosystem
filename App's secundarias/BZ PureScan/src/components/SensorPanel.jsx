import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Bluetooth,
  FileText,
  Info,
  Loader,
  Radio,
  RotateCcw,
  ScanLine,
  Snowflake,
  Sparkles,
  Trash2,
  Wind,
  X,
} from 'lucide-react'
import {
  SENSOR_CATEGORIES,
  sensorSupport,
  readMultispectral,
  readColdChain,
  readEthylene,
  readNfcSeal,
} from '../services/sensorHub'

const ICONS = {
  optical: Sparkles,
  cold_chain: Snowflake,
  chemical: Wind,
  provenance: ScanLine,
}

const TRANSPORT_ICON = {
  BLE: Bluetooth,
  'LoRaWAN / API': Radio,
  NFC: Radio,
}

/**
 * Hoja deslizante con las 4 categorías de sensores IoT. Cada tarjeta
 * dispara la lectura real (Web Bluetooth / Web NFC / gateway) y guarda
 * la telemetría en el estado del Scanner.
 */
// Coacciona los campos editables a números para la lectura de cadena de frío
const coerceContract = (contract) => ({
  idealMaxC: contract?.idealMaxC === '' ? 6 : Number(contract?.idealMaxC ?? 6),
  tripHours: contract?.tripHours === '' ? 12 : Number(contract?.tripHours ?? 12),
})

const SensorPanel = ({
  readings,
  onReading,
  objectType,
  contract,
  onContractChange,
  onClearExample,
  onLoadExample,
  buid,
  onClose,
}) => {
  const [busy, setBusy] = useState(null)
  const [errors, setErrors] = useState({})
  const [noteDismissed, setNoteDismissed] = useState(false)
  const support = sensorSupport()

  const runReader = async (categoryId) => {
    setBusy(categoryId)
    setErrors((prev) => ({ ...prev, [categoryId]: null }))
    try {
      let result
      if (categoryId === 'optical') result = await readMultispectral(objectType)
      else if (categoryId === 'cold_chain') result = await readColdChain(coerceContract(contract))
      else if (categoryId === 'chemical') result = await readEthylene(buid)
      else if (categoryId === 'provenance') result = await readNfcSeal(buid)
      onReading(categoryId, result)
    } catch (err) {
      setErrors((prev) => ({ ...prev, [categoryId]: err.message || 'Error de lectura' }))
    } finally {
      setBusy(null)
    }
  }

  const setField = (key, value) => onContractChange({ ...contract, [key]: value, isExample: false })

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm"
    >
      {/* No se cierra al tocar el fondo: así el panel no se pierde mientras se
          empareja un dispositivo (p. ej. al volver del selector Bluetooth del
          navegador). Solo se cierra con la X o con "Aplicar". */}
      <motion.div
        initial={{ y: 120 }}
        animate={{ y: 0 }}
        exit={{ y: 120 }}
        className="max-h-[86vh] w-full overflow-y-auto rounded-t-3xl border border-bz-ghost-border bg-gradient-to-b from-bz-surface to-bz-bg p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-label-md font-bold text-bz-primary">CAPA IoT</p>
            <h2 className="text-xl font-bold">Sensores de campo</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-bz-surface" aria-label="Cerrar">
            <X size={22} />
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2 text-label-sm">
          <SupportChip ok={support.bluetooth} label="Web Bluetooth" />
          <SupportChip ok={support.nfc} label="Web NFC" />
          <SupportChip ok={support.gateway} label="Gateway API" />
        </div>

        {/* Nota flotante de compatibilidad */}
        {!noteDismissed && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 flex items-start gap-3 rounded-xl border border-bz-primary/30 bg-bz-primary/10 p-3"
          >
            <Info size={18} className="mt-0.5 shrink-0 text-bz-primary" />
            <p className="flex-1 text-body-sm text-bz-text">
              Para que funcione correctamente la app necesita tener un navegador con Web Bluetooth/Web NFC
              (Chrome/Edge; NFC solo Android), próximamente en iOS.
            </p>
            <button
              onClick={() => setNoteDismissed(true)}
              className="rounded-md p-1 text-bz-text-muted hover:bg-black/20"
              aria-label="Cerrar aviso"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}

        <ContractEditor
          contract={contract}
          onSetField={setField}
          onClearExample={onClearExample}
          onLoadExample={onLoadExample}
        />

        <p className="mb-2 text-label-sm font-bold uppercase text-bz-text-muted">Conectar dispositivos</p>
        <div className="space-y-3">
          {Object.values(SENSOR_CATEGORIES).map((cat) => (
            <SensorCard
              key={cat.id}
              cat={cat}
              reading={readings[cat.id]}
              isBusy={busy === cat.id}
              error={errors[cat.id]}
              onConnect={() => runReader(cat.id)}
            />
          ))}
        </div>

        <button onClick={onClose} className="btn btn-primary mt-5 w-full">
          Aplicar lecturas al escaneo
        </button>
      </motion.div>
    </motion.div>
  )
}

// Etiqueta del botón de conexión según el transporte del sensor
const CONNECT_LABEL = {
  BLE: 'Emparejar BLE',
  'LoRaWAN / API': 'Consultar gateway',
  NFC: 'Escanear NFC',
}

// Pista mostrada mientras se conecta (qué debe hacer el usuario)
const CONNECT_HINT = {
  BLE: 'Selecciona tu etiqueta o sensor en el cuadro de Bluetooth del navegador.',
  'LoRaWAN / API': 'Consultando el gateway del lote…',
  NFC: 'Acerca el móvil al sello NFC del producto.',
}

/**
 * Tarjeta de un sensor con flujo de conexión EXPLÍCITO:
 * sin conectar → conectando → conectado (dispositivo real o modo demo).
 */
const SensorCard = ({ cat, reading, isBusy, error, onConnect }) => {
  const Icon = ICONS[cat.id]
  const TransportIcon = TRANSPORT_ICON[cat.transport] || Bluetooth
  const connected = Boolean(reading)

  const status = isBusy
    ? { dot: 'bg-bz-amber animate-pulse', text: 'Conectando…', tone: 'text-bz-amber' }
    : error
      ? { dot: 'bg-red-400', text: 'Error', tone: 'text-red-400' }
      : connected
        ? { dot: 'bg-bz-neon', text: 'Conectado', tone: 'text-bz-neon' }
        : { dot: 'bg-bz-text-muted', text: 'Sin conectar', tone: 'text-bz-text-muted' }

  return (
    <div
      className={`rounded-2xl border p-4 transition ${
        connected ? 'border-bz-neon/40 bg-bz-neon/5' : 'border-bz-ghost-border bg-black/20'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`rounded-xl p-2 ${connected ? 'bg-bz-neon/15 text-bz-neon' : 'bg-bz-surface text-bz-primary'}`}>
          <Icon size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-bold">{cat.label}</p>
            <span className="flex items-center gap-1 rounded-full bg-bz-surface px-2 py-0.5 text-[10px] font-bold uppercase text-bz-text-muted">
              <TransportIcon size={10} />
              {cat.transport}
            </span>
          </div>
          <p className="mt-1 text-body-sm text-bz-text-muted">{cat.description}</p>
        </div>
      </div>

      {/* Fila de estado de conexión + acción */}
      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-bz-ghost-border bg-black/20 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${status.dot}`} />
          <div className="min-w-0">
            <p className={`text-label-sm font-bold ${status.tone}`}>{status.text}</p>
            {connected && (
              <p className="truncate text-[10px] text-bz-text-muted">{reading.device}</p>
            )}
          </div>
        </div>
        <button
          onClick={onConnect}
          disabled={isBusy}
          className={`btn shrink-0 gap-1 px-3 py-2 text-xs ${connected ? 'btn-secondary' : 'btn-primary'}`}
        >
          {isBusy ? (
            <Loader size={14} className="animate-spin" />
          ) : connected ? (
            <RotateCcw size={14} />
          ) : (
            <TransportIcon size={14} />
          )}
          {isBusy ? 'Conectando' : connected ? 'Reconectar' : CONNECT_LABEL[cat.transport] || 'Conectar'}
        </button>
      </div>

      {isBusy && <p className="mt-2 text-[11px] text-bz-text-muted">{CONNECT_HINT[cat.transport]}</p>}
      {reading && <SensorReadout reading={reading} />}
      {error && <p className="mt-2 text-body-sm text-red-400">{error}</p>}
    </div>
  )
}

const CONTRACT_FIELDS = [
  { key: 'idealMaxC', label: 'Temp. ideal máx.', suffix: '°C' },
  { key: 'criticalHours', label: 'Horas críticas', suffix: 'h' },
  { key: 'orderValueBEZ', label: 'Valor pedido', suffix: 'BEZ' },
  { key: 'riderStakeBEZ', label: 'Fianza repartidor', suffix: 'BEZ' },
]

// Contrato de ejemplo editable → alimenta al Oráculo. El usuario puede editar
// los valores o borrar el ejemplo para introducir los de su propio escrow.
const ContractEditor = ({ contract, onSetField, onClearExample, onLoadExample }) => {
  const isExample = contract?.isExample
  const isEmpty = CONTRACT_FIELDS.every(({ key }) => contract?.[key] === '' || contract?.[key] === undefined)

  return (
    <div className="mb-4 rounded-2xl border border-bz-ghost-border bg-black/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-bz-primary" />
          <p className="font-bold">Contrato del lote</p>
          {isExample && (
            <span className="rounded-full bg-bz-amber/15 px-2 py-0.5 text-[10px] font-black uppercase text-bz-amber">
              Ejemplo demo
            </span>
          )}
        </div>
        {isEmpty ? (
          <button onClick={onLoadExample} className="btn btn-secondary px-2.5 py-1.5 text-[11px]" title="Cargar ejemplo">
            <RotateCcw size={12} />
            Cargar ejemplo
          </button>
        ) : (
          <button onClick={onClearExample} className="btn btn-secondary px-2.5 py-1.5 text-[11px]" title="Borrar ejemplo">
            <Trash2 size={12} />
            Borrar ejemplo
          </button>
        )}
      </div>

      {isExample && (
        <p className="mb-3 text-[11px] text-bz-text-muted">
          Estos valores son un ejemplo para aprender a usar la app. Edítalos o bórralos e introduce los de tu escrow real.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        {CONTRACT_FIELDS.map(({ key, label, suffix }) => (
          <label key={key} className="flex flex-col gap-1">
            <span className="text-[10px] uppercase text-bz-text-muted">{label}</span>
            <div className="flex items-center gap-1 rounded-lg border border-bz-ghost-border bg-bz-surface px-2 py-1.5">
              <input
                type="number"
                inputMode="decimal"
                value={contract?.[key] ?? ''}
                onChange={(event) => onSetField(key, event.target.value)}
                placeholder="—"
                className="w-full bg-transparent text-sm font-bold text-bz-text outline-none"
              />
              <span className="text-[10px] font-bold text-bz-text-muted">{suffix}</span>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}

const SupportChip = ({ ok, label }) => (
  <span
    className={`rounded-full border px-2.5 py-1 font-bold ${
      ok ? 'border-bz-neon/40 bg-bz-neon/10 text-bz-neon' : 'border-bz-ghost-border bg-black/20 text-bz-text-muted'
    }`}
  >
    {ok ? '● ' : '○ '}
    {label}
  </span>
)

const SensorReadout = ({ reading }) => {
  const r = reading.readings || {}
  const chips = []

  if (reading.category === 'optical') {
    if (r.brix != null) chips.push(['Brix', `${r.brix} °Bx`])
    if (r.dryMatter != null) chips.push(['Materia seca', `${r.dryMatter}%`])
    if (r.ripenessIndex != null) chips.push(['Madurez', `${r.ripenessIndex}/10`])
    if (r.tempC != null) chips.push(['Temp', `${r.tempC}°C`])
    if (r.humidity != null) chips.push(['Humedad', `${r.humidity}%`])
  } else if (reading.category === 'cold_chain') {
    if (r.tempC != null) chips.push(['Temp actual', `${r.tempC}°C`])
    if (r.humidity != null) chips.push(['Humedad', `${r.humidity}%`])
    chips.push(['Umbral', `${r.idealMaxC}°C`])
    if (reading.breach?.detected) {
      chips.push(['Alerta', `${reading.breach.maxTempC}°C sobre umbral`])
    }
  } else if (reading.category === 'chemical') {
    if (r.ppm != null) chips.push(['Etileno', `${r.ppm} ppm`])
    if (r.level) chips.push(['Nivel', r.level])
    if (r.co2Pct != null) chips.push(['CO₂', `${r.co2Pct}%`])
  } else if (reading.category === 'provenance') {
    chips.push(['Prueba origen', r.proofOfOrigin ? 'VÁLIDA' : 'FALLIDA'], ['Sello', r.intact ? 'Íntegro' : 'Manipulado'])
    if (r.buid) chips.push(['B-UID', r.buid])
  }

  return (
    <div className="mt-3">
      {reading.category === 'cold_chain' && reading.timeline?.length > 1 && (
        <TripSparkline timeline={reading.timeline} threshold={r.idealMaxC} />
      )}
      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {chips.map(([label, value]) => (
            <span
              key={label}
              className="rounded-lg bg-bz-surface px-2.5 py-1 text-[11px] font-bold text-bz-text"
            >
              <span className="text-bz-text-muted">{label}: </span>
              {value}
            </span>
          ))}
        </div>
      )}
      <p className="mt-2 flex items-center gap-1 text-[10px] uppercase text-bz-text-muted">
        ◆ {reading.device}
      </p>
      {reading.note && (
        <p className="mt-1 text-[10px] text-bz-text-muted">{reading.note}</p>
      )}
    </div>
  )
}

// Mini-gráfico SVG de la curva de temperatura del viaje
const TripSparkline = ({ timeline, threshold }) => {
  const width = 260
  const height = 48
  const temps = timeline.map((p) => p.tempC)
  const min = Math.min(...temps, threshold) - 1
  const max = Math.max(...temps, threshold) + 1
  const span = max - min || 1
  const x = (i) => (i / (timeline.length - 1)) * width
  const y = (t) => height - ((t - min) / span) * height
  const path = timeline.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.tempC).toFixed(1)}`).join(' ')
  const thresholdY = y(threshold).toFixed(1)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-12 w-full rounded-lg bg-black/30" preserveAspectRatio="none">
      <line x1="0" y1={thresholdY} x2={width} y2={thresholdY} stroke="#f87171" strokeWidth="1" strokeDasharray="4 3" opacity="0.7" />
      <path d={path} fill="none" stroke="#2b8cee" strokeWidth="2" strokeLinejoin="round" />
      {timeline.map((p, i) => (
        <circle
          key={i}
          cx={x(i)}
          cy={y(p.tempC)}
          r={p.tempC > threshold ? 2.6 : 1.6}
          fill={p.tempC > threshold ? '#f87171' : '#39ff14'}
        />
      ))}
    </svg>
  )
}

export default SensorPanel
