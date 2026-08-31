/**
 * useBilling — reads real balance, history, and credit packages from the
 * api-gateway billing endpoints + wallet/me. Embeds the 4 canonical Hub
 * plans so the UI never falls back to the old localStorage PLANS object.
 *
 * When the billing API is unreachable (dev without backend), every field
 * gracefully returns null/[] so the UI can show "—" instead of crashing.
 */
import { useState, useEffect, useCallback } from 'react'

const normalize = url => (url || '').replace(/\/$/, '')

const BASE_API = normalize(import.meta.env.VITE_API_URL) || 'http://localhost:3001/api'
const BILLING_URL = normalize(import.meta.env.VITE_BILLING_API_URL) || `${BASE_API}/billing`
const WALLET_URL = normalize(import.meta.env.VITE_WALLET_API_URL) || `${BASE_API}/wallet`

function authHeaders() {
  const token =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('bezhas_access_token') || localStorage.getItem('bezhas-jwt')
      : null
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: authHeaders() })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

// Canonical plans — mirror of Bezhas-Hub/backend/config/plans.js (4 tiers).
export const PLANS = [
  {
    id: 'starter', name: 'Starter', profile: 'Autónomos / Startups',
    priceEUR: 0, aiActions: 150, gasSubsidy: 0, apy: 12.5,
    badge: null,
  },
  {
    id: 'creator_pro', name: 'Creator Pro', profile: 'Pymes / Creadores',
    priceEUR: 99, aiActions: 1500, gasSubsidy: 25, apy: 18.75,
    badge: 'POPULAR',
  },
  {
    id: 'business', name: 'Business', profile: 'Empresas en Crecimiento',
    priceEUR: 499, aiActions: 15000, gasSubsidy: 50, apy: 25,
    badge: null,
  },
  {
    id: 'enterprise_vip', name: 'Enterprise VIP', profile: 'Holdings / Instituciones',
    priceEUR: 2499, aiActions: null, gasSubsidy: 100, apy: 31.25,
    badge: 'WHITE LABEL',
  },
]

export function useBilling({ pollMs = 60_000 } = {}) {
  const [balance, setBalance] = useState(null)
  const [history, setHistory] = useState([])
  const [packages, setPackages] = useState([])
  const [wallet, setWallet] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const results = await Promise.allSettled([
        fetchJson(`${BILLING_URL}/balance`),
        fetchJson(`${BILLING_URL}/history`),
        fetchJson(`${BILLING_URL}/packages`),
        fetchJson(`${WALLET_URL}/me`),
      ])

      if (results[0].status === 'fulfilled') setBalance(results[0].value)
      if (results[1].status === 'fulfilled') {
        const d = results[1].value
        setHistory(d.history || d.entries || d.transactions || [])
      }
      if (results[2].status === 'fulfilled') setPackages(results[2].value.packages || [])
      if (results[3].status === 'fulfilled') setWallet(results[3].value)

      const allFailed = results.every(r => r.status === 'rejected')
      if (allFailed) setError('Billing API no disponible')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    if (!pollMs) return
    const id = setInterval(refresh, pollMs)
    return () => clearInterval(id)
  }, [refresh, pollMs])

  const bezBalance = balance?.balance ?? balance?.formatted ?? wallet?.balance?.formatted ?? null
  const safeWallet = wallet?.safeWallet ?? null

  return {
    bezBalance,
    safeWallet,
    history,
    packages,
    plans: PLANS,
    loading,
    error,
    refresh,
  }
}
