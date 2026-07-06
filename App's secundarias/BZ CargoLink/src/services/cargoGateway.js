/**
 * cargoGateway — read-only / stateless endpoint wrapper.
 *
 * Used by CargoFingerprint (audit), DeveloperIntegration (endpoint tester),
 * and the embedded SDK.  Delegates to the same Core API base URL as
 * cargoLinkApi; no local fallback, no bezhasPlatform dependency.
 */

const normalizeBaseUrl = url => url.replace(/\/$/, '')

const API_URL = import.meta.env.VITE_CARGOLINK_API_URL
  || (import.meta.env.VITE_API_URL ? `${normalizeBaseUrl(import.meta.env.VITE_API_URL)}/cargolink` : 'http://localhost:3001/api/cargolink')

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

export const callCargoGateway = async ({ method = 'POST', endpoint, payload = {}, apiKey } = {}) => {
  const payloadHash = payload.payloadHash || await sha256(payload)
  const response = await remoteCall({ method, endpoint, payload: { ...payload, payloadHash }, apiKey })

  return {
    ...response,
    source: 'remote',
    payloadHash,
    bridge: {
      app: 'BZ CargoLink',
      endpoint,
      payloadHash,
      source: 'remote',
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
