/**
 * @deprecated Since Fase 2 — use useBilling() for balance/plans/history
 * and useTransactions() for B-UID data. This wrapper only exists for
 * backward compatibility with components that still read platformState.
 *
 * When VITE_ALLOW_LOCAL_FALLBACK=true (dev only), it falls back to the
 * old localStorage bezhasPlatform. In production, it returns empty defaults.
 */
import { useEffect, useState } from 'react'
import { bezhasPlatform } from '../services/bezhasPlatform'

const ALLOW_FALLBACK = import.meta.env.DEV && import.meta.env.VITE_ALLOW_LOCAL_FALLBACK === 'true'

const EMPTY_STATE = {
  apiKey: '',
  planId: 'starter',
  freeQuotaDate: '',
  freeQuotaRemaining: 0,
  bezBalance: 0,
  gasBalance: 0,
  webhookUrl: '',
  webhookEvents: [],
  enabledSectors: ['cargo'],
  ledger: [],
  apiUsage: [],
  blocks: [],
}

export function usePlatformState() {
  const [platformState, setPlatformState] = useState(() => {
    if (!ALLOW_FALLBACK) return EMPTY_STATE
    return bezhasPlatform.getState()
  })

  useEffect(() => {
    if (!ALLOW_FALLBACK) return

    const onUpdate = event => {
      setPlatformState(event.detail || bezhasPlatform.getState())
    }

    window.addEventListener('bezhas-platform-updated', onUpdate)
    return () => window.removeEventListener('bezhas-platform-updated', onUpdate)
  }, [])

  const refresh = () => {
    if (!ALLOW_FALLBACK) return
    setPlatformState(bezhasPlatform.getState())
  }

  return { platformState, refresh }
}
