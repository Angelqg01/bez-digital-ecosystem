import { useEffect, useState } from 'react'
import { bezhasPlatform } from '../services/bezhasPlatform'

export function usePlatformState() {
  const [platformState, setPlatformState] = useState(() => bezhasPlatform.getState())

  useEffect(() => {
    const onUpdate = event => {
      setPlatformState(event.detail || bezhasPlatform.getState())
    }

    window.addEventListener('bezhas-platform-updated', onUpdate)
    return () => window.removeEventListener('bezhas-platform-updated', onUpdate)
  }, [])

  const refresh = () => setPlatformState(bezhasPlatform.getState())

  return { platformState, refresh }
}
