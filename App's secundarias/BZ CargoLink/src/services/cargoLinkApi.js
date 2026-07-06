/**
 * cargoLinkApi — client for the B-UID lifecycle + POS connector endpoints.
 *
 * These talk to the real Core API (api/routes/cargolink.js): role-scoped keys,
 * the B-UID transaction object, its lifecycle, and the POS link. Distinct from
 * cargoGateway.js (the older stateless operation/billing endpoints).
 */

const normalizeBaseUrl = url => url.replace(/\/$/, '')

const API_URL = import.meta.env.VITE_CARGOLINK_API_URL
  || (import.meta.env.VITE_API_URL ? `${normalizeBaseUrl(import.meta.env.VITE_API_URL)}/cargolink` : 'http://localhost:3001/api/cargolink')

async function call(method, path, { apiKey, body, query } = {}) {
  const url = new URL(`${normalizeBaseUrl(API_URL)}${path}`)
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
    })
  }
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: method === 'GET' ? undefined : JSON.stringify(body || {}),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `CargoLink API ${res.status}`)
  return data
}

// Admin (platform JWT) call — operator/key management. Reads the JWT stored by
// the wallet/fiat login so requireRole('admin') resolves on the backend.
function adminJwt() {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem('bezhas_access_token') || localStorage.getItem('bezhas-jwt')
}

// Roles a CargoLink actor key can hold (the B-UID lifecycle actors).
export const KEY_ROLES = ['pos', 'customs', 'carrier', 'logistics', 'lastmile', 'admin']

export const cargoLinkAdmin = {
  listKeys: () => call('GET', '/admin/keys', { apiKey: adminJwt() }),
  issueKey: (body) => call('POST', '/admin/keys', { apiKey: adminJwt(), body }),
  revokeKey: (id) => call('DELETE', `/admin/keys/${encodeURIComponent(id)}`, { apiKey: adminJwt() }),
}

export const cargoLinkApi = {
  // Lifecycle
  listTransactions: (apiKey, query) => call('GET', '/v1/tx', { apiKey, query }),
  getTransaction: (apiKey, bUid) => call('GET', `/v1/tx/${encodeURIComponent(bUid)}`, { apiKey }),
  createTransaction: (apiKey, body) => call('POST', '/v1/tx', { apiKey, body }),
  advanceTransaction: (apiKey, bUid, body) => call('POST', `/v1/tx/${encodeURIComponent(bUid)}/advance`, { apiKey, body }),
  issueKey: (body) => call('POST', '/v1/keys', { body }),
  // POS connector
  getPosLink: (apiKey) => call('GET', '/v1/pos/link', { apiKey }),
  linkPos: (apiKey, body) => call('POST', '/v1/pos/link', { apiKey, body }),
  syncPos: (apiKey) => call('POST', '/v1/pos/sync', { apiKey }),
  // IoT / hardware
  registerDevice: (apiKey, body) => call('POST', '/v1/iot/devices', { apiKey, body }),
  ingestTelemetry: (deviceKey, body) => call('POST', '/v1/iot/telemetry', { apiKey: deviceKey, body }),
  getTelemetry: (apiKey, query) => call('GET', '/v1/iot/telemetry', { apiKey, query }),
}

// Lifecycle stages in order — used by the UI to render progress.
export const LIFECYCLE_STAGES = [
  'CREATED', 'CUSTOMS_CLEARED', 'STOWED', 'DEPARTED', 'IN_TRANSIT', 'DELIVERED',
]

export default cargoLinkApi
