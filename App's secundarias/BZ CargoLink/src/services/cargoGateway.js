import { bezhasPlatform } from './bezhasPlatform'

const normalizeBaseUrl = url => url.replace(/\/$/, '')

const API_URL = import.meta.env.VITE_CARGOLINK_API_URL
  || (import.meta.env.VITE_API_URL ? `${normalizeBaseUrl(import.meta.env.VITE_API_URL)}/cargolink` : 'http://localhost:3001/api/cargolink')
const ENABLE_REAL_BLOCKCHAIN = import.meta.env.VITE_ENABLE_REAL_BLOCKCHAIN === 'true'
const ALLOW_LOCAL_FALLBACK = import.meta.env.DEV && import.meta.env.VITE_ALLOW_LOCAL_FALLBACK === 'true'

const toHex = buffer => Array.from(new Uint8Array(buffer))
  .map(byte => byte.toString(16).padStart(2, '0'))
  .join('')

export const sha256 = async value => {
  const data = typeof value === 'string'
    ? new TextEncoder().encode(value)
    : new TextEncoder().encode(JSON.stringify(value))
  return `0x${toHex(await crypto.subtle.digest('SHA-256', data))}`
}

const remoteCall = async ({ method, endpoint, payload, apiKey }) => {
  const isGet = method === 'GET'
  const url = new URL(`${normalizeBaseUrl(API_URL)}${endpoint}`)
  if (isGet) {
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
    })
  }

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: isGet ? undefined : JSON.stringify(payload || {}),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`CargoLink API ${response.status}: ${detail || response.statusText}`)
  }

  return response.json()
}

const localCall = ({ method, endpoint, payload, apiKey }) =>
  bezhasPlatform.callApi({ method, endpoint, payload, apiKey })

const tryRealBlockchain = async ({ endpoint, payload, hash }) => {
  if (!ENABLE_REAL_BLOCKCHAIN) {
    return { ok: false, mode: 'disabled', reason: 'VITE_ENABLE_REAL_BLOCKCHAIN is not true' }
  }

  try {
    const { cargoBlockchain } = await import('./blockchainService.js')

    if (endpoint === '/v1/customs/dispatch') {
      const tx = await cargoBlockchain.requestClearance(
        payload.shipmentId || payload.manifestId || payload.bUid,
        { documentHash: hash },
      )
      return { ok: true, mode: 'real', txHash: tx.hash, contract: 'CustomsClearanceOracle' }
    }

    if (endpoint === '/v1/shipping/stowage' || endpoint === '/v1/audit/fingerprint') {
      const tx = await cargoBlockchain.anchorFingerprint({
        shipmentId: payload.shipmentId || payload.manifestId || payload.bUid,
        location: payload.location || 'BZ CargoLink',
        hash,
      })
      return { ok: true, mode: 'real', txHash: tx.hash, contract: 'SupplyTracker' }
    }

    return { ok: false, mode: 'unsupported', reason: `No blockchain mapper for ${endpoint}` }
  } catch (error) {
    return { ok: false, mode: 'fallback', reason: error.message }
  }
}

export const callCargoGateway = async ({ method = 'POST', endpoint, payload = {}, apiKey } = {}) => {
  const payloadHash = payload.payloadHash || payload.visualFingerprint || payload.fingerprintHash || await sha256(payload)
  let source = 'remote'
  let response

  try {
    response = await remoteCall({ method, endpoint, payload: { ...payload, payloadHash }, apiKey })
  } catch (error) {
    if (!ALLOW_LOCAL_FALLBACK) {
      throw new Error(`CargoLink Core API no disponible en ${API_URL}: ${error.message}`)
    }
    console.warn('[CargoGateway] Remote API unavailable, using explicit dev fallback:', error.message)
    response = localCall({ method, endpoint, payload: { ...payload, payloadHash }, apiKey })
    source = 'local-dev-fallback'
  }

  const realBlockchain = await tryRealBlockchain({ endpoint, payload, hash: payloadHash })

  return {
    ...response,
    source,
    payloadHash,
    realBlockchain,
    bridge: {
      app: 'BZ CargoLink',
      endpoint,
      payloadHash,
      source,
      realBlockchain,
      createdAt: new Date().toISOString(),
    },
  }
}

export const cargoGateway = {
  getActiveRoute: (payload, apiKey) =>
    callCargoGateway({ method: 'GET', endpoint: '/v1/logistics/route', payload, apiKey }),
  auditFingerprint: (payload, apiKey) =>
    callCargoGateway({ method: 'POST', endpoint: '/v1/audit/fingerprint', payload, apiKey }),
  validateStowage: (payload, apiKey) =>
    callCargoGateway({ method: 'POST', endpoint: '/v1/shipping/stowage', payload, apiKey }),
  dispatchCustoms: (payload, apiKey) =>
    callCargoGateway({ method: 'POST', endpoint: '/v1/customs/dispatch', payload, apiKey }),
  registerWebhook: (payload, apiKey) =>
    callCargoGateway({ method: 'POST', endpoint: '/v1/webhooks/register', payload, apiKey }),
}

export default cargoGateway
