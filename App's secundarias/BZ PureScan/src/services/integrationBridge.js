import { createCargoLinkSdk } from '../../../BZ CargoLink/src/services/bezhasPlatform.js'

const RWA_STORAGE_KEY = 'bezhas-rwa-twin-bridge-v1'
const DEFAULT_CARGOLINK_API_KEY = import.meta.env.VITE_CARGOLINK_API_KEY || null
const CARGOLINK_API_URL = import.meta.env.VITE_CARGOLINK_API_URL || null
const RWA_API_URL = import.meta.env.VITE_RWA_API_URL || null

const toHex = (buffer) => Array.from(new Uint8Array(buffer))
  .map((byte) => byte.toString(16).padStart(2, '0'))
  .join('')

const sha256 = async (value) => {
  const bytes = typeof value === 'string'
    ? new TextEncoder().encode(value)
    : value
  return `0x${toHex(await crypto.subtle.digest('SHA-256', bytes))}`
}

const hashBlob = async (blob) => sha256(await blob.arrayBuffer())

const loadRwaLedger = () => {
  try {
    return JSON.parse(localStorage.getItem(RWA_STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

const saveRwaLedger = (entry) => {
  const ledger = [entry, ...loadRwaLedger()].slice(0, 100)
  localStorage.setItem(RWA_STORAGE_KEY, JSON.stringify(ledger))
  window.dispatchEvent(new CustomEvent('bezhas-rwa-twin-updated', { detail: entry }))
  return entry
}

const resolveBuid = ({ evidence, edge, objectType }) => {
  const batchId = edge?.id || evidence?.evidence_id || Date.now()
  const sector = objectType === 'property' ? 'RWA' : objectType === 'animal' ? 'LIV' : objectType === 'food' ? 'FOOD' : 'OBJ'
  return `BZ-${sector}-${String(batchId).replace(/[^a-zA-Z0-9]/g, '').slice(-10).toUpperCase()}`
}

const resolveCargoStatus = (comparison) => {
  if (comparison.riskLevel === 'HIGH') return 'DISPUTE_REQUIRED'
  if (comparison.riskLevel === 'MEDIUM' || comparison.qualityGate === 'REVIEW') return 'HOLD_FOR_INSPECTION'
  return 'VERIFIED'
}

const buildCargoPayload = ({ bUid, objectType, evidence, comparison, hashes, gemini }) => ({
  bUid,
  source: 'BZ PureScan',
  captureMode: evidence.capture_mode,
  objectType,
  cargoStatus: resolveCargoStatus(comparison),
  visualFingerprint: hashes.visualFingerprint,
  beforeHash: hashes.beforeHash,
  afterHash: hashes.afterHash,
  evidenceId: evidence.evidence_id,
  evidence: {
    before: evidence.media.before,
    after: evidence.media.after,
    comparison,
    mediaType: evidence.capture_mode,
  },
  model: 'PureScan_COMPARE_SHA256_MSE',
  semanticRisk: gemini?.analysis?.risk_level || comparison.riskLevel,
  qualityAssessment: gemini?.analysis?.quality_assessment || comparison.qualityGate,
})

const buildRwaPayload = ({ bUid, objectType, evidence, comparison, hashes, gemini }) => {
  const twinId = objectType === 'property'
    ? `TWIN-REAL-${hashes.visualFingerprint.slice(2, 12).toUpperCase()}`
    : `TWIN-${objectType.toUpperCase()}-${hashes.visualFingerprint.slice(2, 12).toUpperCase()}`

  return {
    twinId,
    assetId: `ASSET-${bUid}`,
    bUid,
    source: 'BZ PureScan',
    objectType,
    damageDetected: comparison.riskLevel !== 'LOW' || comparison.qualityGate === 'REVIEW',
    damageScore: Number((100 - comparison.stabilityScore).toFixed(1)),
    stabilityScore: comparison.stabilityScore,
    visualFingerprint: hashes.visualFingerprint,
    beforeHash: hashes.beforeHash,
    afterHash: hashes.afterHash,
    metadata: {
      standard: objectType === 'property' ? 'RWA_DIGITAL_TWIN_V1' : 'BZ_DIGITAL_TWIN_EVIDENCE_V1',
      evidenceId: evidence.evidence_id,
      captureMode: evidence.capture_mode,
      capturedAt: evidence.captured_at,
      media: evidence.media,
      comparison,
      semantic: gemini?.analysis || null,
      tokenizationHint: objectType === 'property' ? 'ERC-3643_READY' : 'DPP_NFT_READY',
    },
  }
}

const postJson = async (url, payload) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  return response.json()
}

const syncCargoLink = async (payload) => {
  if (CARGOLINK_API_URL) {
    return postJson(`${CARGOLINK_API_URL.replace(/\/$/, '')}/v1/audit/fingerprint`, payload)
  }

  const sdk = createCargoLinkSdk(DEFAULT_CARGOLINK_API_KEY || undefined)
  return sdk.auditFingerprint(payload)
}

const syncRwa = async (payload) => {
  if (RWA_API_URL) {
    return postJson(`${RWA_API_URL.replace(/\/$/, '')}/v1/twins/evidence`, payload)
  }

  return saveRwaLedger({
    ok: true,
    status: 'LOCAL_TWIN_LEDGER',
    txHash: await sha256(JSON.stringify(payload)),
    createdAt: new Date().toISOString(),
    payload,
  })
}

export const syncIntegrationBridge = async ({
  objectType,
  captures,
  evidence,
  comparison,
  edge,
  gemini,
}) => {
  const [beforeHash, afterHash] = await Promise.all([
    hashBlob(captures.before.blob),
    hashBlob(captures.after.blob),
  ])

  const visualFingerprint = await sha256(JSON.stringify({
    beforeHash,
    afterHash,
    comparison,
    evidenceId: evidence.evidence_id,
  }))

  const hashes = { beforeHash, afterHash, visualFingerprint }
  const bUid = resolveBuid({ evidence, edge, objectType })
  const cargoPayload = buildCargoPayload({ bUid, objectType, evidence, comparison, hashes, gemini })
  const rwaPayload = buildRwaPayload({ bUid, objectType, evidence, comparison, hashes, gemini })

  const [cargoLink, rwa] = await Promise.allSettled([
    syncCargoLink(cargoPayload),
    syncRwa(rwaPayload),
  ])

  return {
    bUid,
    hashes,
    cargoLink: cargoLink.status === 'fulfilled'
      ? { ok: true, payload: cargoPayload, response: cargoLink.value }
      : { ok: false, payload: cargoPayload, error: cargoLink.reason?.message || 'CargoLink sync failed' },
    rwa: rwa.status === 'fulfilled'
      ? { ok: true, payload: rwaPayload, response: rwa.value }
      : { ok: false, payload: rwaPayload, error: rwa.reason?.message || 'RWA sync failed' },
  }
}

export const getRwaTwinLedger = loadRwaLedger
