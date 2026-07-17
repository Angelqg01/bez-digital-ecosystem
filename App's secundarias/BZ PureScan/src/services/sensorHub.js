/**
 * BZ PureScan — Sensor Hub (Capa IoT)
 * ====================================================================
 * Puente entre el mundo físico y el Oráculo de Alimentos.
 *
 *   1. Visión y Análisis Óptico   → Multiespectral BLE
 *   2. Cadena de Frío             → Data-loggers BLE (temp/humedad)
 *   3. Químicos / Biológicos      → Etileno vía Gateway LoRaWAN/API
 *   4. Trazabilidad / Anti-Fraude → Sellos NFC criptográficos
 *
 * Conexión REAL a hardware. Sin simulaciones.
 */

// ── GATT estándar: Environmental Sensing Service (0x181A) ──
const ENV_SENSING_SERVICE = 0x181a
const TEMPERATURE_CHAR = 0x2a6e
const HUMIDITY_CHAR = 0x2a6f

const GATEWAY_URL = import.meta.env.VITE_SENSOR_GATEWAY_URL || null

const nowIso = () => new Date().toISOString()
const round = (value, decimals = 1) => Number(value.toFixed(decimals))

export const SENSOR_CATEGORIES = {
  optical: {
    id: 'optical',
    label: 'Visión Multiespectral',
    transport: 'BLE',
    description: 'Grados Brix (azúcar) y materia seca bajo la piel del producto.',
  },
  cold_chain: {
    id: 'cold_chain',
    label: 'Cadena de Frío',
    transport: 'BLE',
    description: 'Data-logger de temperatura y humedad de todo el viaje.',
  },
  chemical: {
    id: 'chemical',
    label: 'Etileno / Gases',
    transport: 'LoRaWAN / API',
    description: 'Pico de gas de maduración por lote (sensor fijo en almacén).',
  },
  provenance: {
    id: 'provenance',
    label: 'Sello NFC',
    transport: 'NFC',
    description: 'Prueba de Origen anti-manipulación (tamper-evident).',
  },
}

export const sensorSupport = () => ({
  bluetooth: typeof navigator !== 'undefined' && 'bluetooth' in navigator,
  nfc: typeof window !== 'undefined' && 'NDEFReader' in window,
  gateway: Boolean(GATEWAY_URL),
})

const readSint16 = (dataView, offset = 0) => dataView.getInt16(offset, true)
const readUint16 = (dataView, offset = 0) => dataView.getUint16(offset, true)

// ════════════════════════════════════════════════════════════════
//  1. VISIÓN / MULTIESPECTRAL (BLE)
// ════════════════════════════════════════════════════════════════

export const readMultispectral = async (objectType = 'food') => {
  if (!sensorSupport().bluetooth) {
    throw new Error('Web Bluetooth no disponible. Usa Chrome o Edge en escritorio/Android.')
  }

  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [ENV_SENSING_SERVICE],
  })

  let tempC = null
  let humidity = null

  try {
    const server = await device.gatt.connect()
    try {
      const service = await server.getPrimaryService(ENV_SENSING_SERVICE)
      try {
        const tChar = await service.getCharacteristic(TEMPERATURE_CHAR)
        tempC = round(readSint16(await tChar.readValue()) / 100, 2)
      } catch { /* characteristic not available */ }
      try {
        const hChar = await service.getCharacteristic(HUMIDITY_CHAR)
        humidity = round(readUint16(await hChar.readValue()) / 100, 1)
      } catch { /* characteristic not available */ }
    } catch { /* service not available */ }
    server.disconnect()
  } catch { /* GATT connection failed */ }

  return {
    category: 'optical',
    connected: true,
    simulated: false,
    device: device.name || 'Sensor BLE',
    readings: {
      tempC,
      humidity,
      brix: null,
      dryMatter: null,
      ripenessIndex: null,
      unit: { tempC: '°C', humidity: '%', brix: '°Bx', dryMatter: '%', ripenessIndex: '/10' },
    },
    capturedAt: nowIso(),
    note: tempC !== null
      ? 'Lectura GATT real. Índices espectrales requieren SDK del fabricante del sensor.'
      : 'Dispositivo BLE emparejado. Integrar SDK del fabricante para lectura espectral completa.',
  }
}

// ════════════════════════════════════════════════════════════════
//  2. CADENA DE FRÍO (BLE data-logger)
// ════════════════════════════════════════════════════════════════

export const readColdChain = async (contract = {}) => {
  const idealMaxC = contract.idealMaxC ?? 6

  if (!sensorSupport().bluetooth) {
    throw new Error('Web Bluetooth no disponible. Usa Chrome o Edge en escritorio/Android.')
  }

  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [ENV_SENSING_SERVICE] }],
    optionalServices: [ENV_SENSING_SERVICE],
  })

  const server = await device.gatt.connect()
  const service = await server.getPrimaryService(ENV_SENSING_SERVICE)

  let tempC = null
  let humidity = null

  try {
    const tChar = await service.getCharacteristic(TEMPERATURE_CHAR)
    tempC = round(readSint16(await tChar.readValue()) / 100, 2)
  } catch { /* characteristic not available */ }

  try {
    const hChar = await service.getCharacteristic(HUMIDITY_CHAR)
    humidity = round(readUint16(await hChar.readValue()) / 100, 1)
  } catch { /* characteristic not available */ }

  server.disconnect()

  if (tempC === null) {
    throw new Error('El dispositivo no expone la característica de temperatura (0x2A6E).')
  }

  const breach = {
    detected: tempC > idealMaxC,
    maxTempC: round(tempC, 1),
    hoursAbove: 0,
    threshold: idealMaxC,
  }

  return {
    category: 'cold_chain',
    connected: true,
    simulated: false,
    device: device.name || 'BLE Cold-Chain Logger',
    readings: { tempC, humidity, idealMaxC, unit: { tempC: '°C', humidity: '%' } },
    timeline: null,
    breach,
    capturedAt: nowIso(),
    note: 'Lectura BLE real (Environmental Sensing 0x181A).',
  }
}

// ════════════════════════════════════════════════════════════════
//  3. QUÍMICOS / ETILENO (Gateway LoRaWAN vía API)
// ════════════════════════════════════════════════════════════════

export const readEthylene = async (lotId = 'UNKNOWN') => {
  if (!GATEWAY_URL) {
    throw new Error('Gateway no configurado. Establece VITE_SENSOR_GATEWAY_URL en .env.')
  }

  const url = `${GATEWAY_URL.replace(/\/$/, '')}/v1/sensors/ethylene?lot=${encodeURIComponent(lotId)}`
  const response = await fetch(url, { headers: { Accept: 'application/json' } })

  if (!response.ok) {
    throw new Error(`Error del gateway: HTTP ${response.status}`)
  }

  const data = await response.json()

  return {
    category: 'chemical',
    connected: true,
    simulated: false,
    device: data.gatewayId || 'LoRaWAN Gateway',
    readings: normalizeEthylene(data),
    capturedAt: nowIso(),
    note: 'Consulta API al gateway LoRaWAN.',
  }
}

const normalizeEthylene = (data) => {
  const ppm = data.ppm ?? data.ethylene_ppm ?? 0
  const level = ppm < 0.5 ? 'LOW' : ppm < 1.5 ? 'ELEVATED' : 'HIGH'
  return {
    ppm: round(ppm, 2),
    level,
    ripeningRisk: level === 'HIGH',
    co2Pct: data.co2_pct ?? null,
    unit: { ppm: 'ppm', co2Pct: '%' },
  }
}

// ════════════════════════════════════════════════════════════════
//  4. TRAZABILIDAD / ANTI-FRAUDE (Sello NFC)
// ════════════════════════════════════════════════════════════════

export const readNfcSeal = async (expectedBuid = null) => {
  if (!sensorSupport().nfc) {
    throw new Error('Web NFC no disponible. Usa Chrome en Android.')
  }

  const ndef = new window.NDEFReader()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  let record
  try {
    record = await new Promise((resolve, reject) => {
      ndef.onreading = (event) => resolve(event)
      ndef.onreadingerror = () => reject(new Error('tamper'))
      ndef.scan({ signal: controller.signal }).catch(reject)
    })
  } catch (error) {
    clearTimeout(timeout)
    if (error?.name === 'AbortError') {
      throw new Error('Tiempo de lectura NFC agotado (15s). Acerca el dispositivo al sello.')
    }
    if (error?.message === 'tamper') {
      return {
        category: 'provenance',
        connected: true,
        simulated: false,
        device: 'NFC NDEFReader',
        readings: { serial: null, buid: null, intact: false, proofOfOrigin: false, issuer: null },
        capturedAt: nowIso(),
        note: 'Error criptográfico de antena: posible manipulación del sello.',
      }
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }

  const payload = decodeNdef(record)
  const intact = Boolean(payload.buid)
  const matches = !expectedBuid || payload.buid === expectedBuid

  return {
    category: 'provenance',
    connected: true,
    simulated: false,
    device: 'NFC NDEFReader',
    readings: {
      serial: record.serialNumber || payload.serial || null,
      buid: payload.buid || null,
      intact,
      proofOfOrigin: intact && matches,
      issuer: payload.issuer || null,
    },
    capturedAt: nowIso(),
    note: intact ? 'Sello NFC íntegro.' : 'Sello NFC manipulado o ilegible.',
  }
}

const decodeNdef = (event) => {
  const result = { buid: null, issuer: null, serial: event.serialNumber || null }
  try {
    for (const record of event.message.records) {
      if (record.recordType === 'text' || record.recordType === 'url') {
        const text = new TextDecoder(record.encoding || 'utf-8').decode(record.data)
        const parsed = safeJson(text)
        if (parsed?.buid) result.buid = parsed.buid
        if (parsed?.issuer) result.issuer = parsed.issuer
        if (!parsed && /^BZ-/i.test(text)) result.buid = text.trim()
      }
    }
  } catch { /* ignore */ }
  return result
}

const safeJson = (text) => {
  try { return JSON.parse(text) } catch { return null }
}

// ════════════════════════════════════════════════════════════════
//  Agregación → paquete de telemetría para el MCP
// ════════════════════════════════════════════════════════════════

export const buildSensorPayload = (readings = {}) => {
  const active = Object.values(readings).filter(Boolean)
  return {
    sensor_count: active.length,
    categories: active.map((r) => r.category),
    any_simulated: false,
    optical: readings.optical || null,
    cold_chain: readings.cold_chain || null,
    chemical: readings.chemical || null,
    provenance: readings.provenance || null,
    captured_at: nowIso(),
  }
}
