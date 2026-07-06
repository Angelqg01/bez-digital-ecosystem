import { useCallback, useEffect, useRef, useState } from 'react'
import { cargoLinkApi, LIFECYCLE_STAGES } from '../services/cargoLinkApi'
import { useAuth } from '../context/AuthProvider'

function authKey() {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem('bezhas_access_token') || localStorage.getItem('bezhas-jwt')
}

export function useTransactions({ status, pollMs = 30_000 } = {}) {
  const { token } = useAuth()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const timerRef = useRef(null)

  const load = useCallback(async () => {
    const key = authKey()
    if (!key) { setLoading(false); return }
    try {
      const data = await cargoLinkApi.listTransactions(key, { status })
      setTransactions(data.transactions || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    load()
    if (pollMs > 0) {
      timerRef.current = setInterval(load, pollMs)
      return () => clearInterval(timerRef.current)
    }
  }, [load, pollMs])

  const refresh = useCallback(() => { setLoading(true); load() }, [load])

  return { transactions, loading, error, refresh }
}

export function useTransaction(bUid) {
  const { token } = useAuth()
  const [transaction, setTransaction] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!bUid) { setLoading(false); return }
    const key = authKey()
    if (!key) { setLoading(false); return }
    try {
      const data = await cargoLinkApi.getTransaction(key, bUid)
      setTransaction(data.transaction || data)
      setHistory(data.history || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [bUid])

  useEffect(() => { load() }, [load])

  const advance = useCallback(async (payload) => {
    const key = authKey()
    if (!key) throw new Error('No auth token')
    const res = await cargoLinkApi.advanceTransaction(key, bUid, payload)
    await load()
    return res
  }, [bUid, load])

  return { transaction, history, loading, error, refresh: load, advance }
}

export function stageIndex(status) {
  const idx = LIFECYCLE_STAGES.indexOf(status)
  return idx === -1 ? 0 : idx
}

export function stageProgress(status) {
  return Math.round((stageIndex(status) / (LIFECYCLE_STAGES.length - 1)) * 100)
}
