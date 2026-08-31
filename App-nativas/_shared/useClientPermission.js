/**
 * useClientPermission — Solicitud ÉTICA de permisos de herramientas del cliente.
 *
 * Principios (GDPR art. 5 — minimización + limitación de finalidad):
 *   1. JUST-IN-TIME: el permiso solo se solicita cuando el usuario activa la
 *      función que lo necesita, nunca al arrancar la app.
 *   2. PRIMING: el componente que use este hook debe mostrar SU PROPIA
 *      explicación (qué, para qué, qué pasa con el dato) ANTES de llamar a
 *      request(), de modo que el prompt nativo solo aparezca tras un "sí"
 *      informado del usuario. Así no se "quema" el permiso del navegador.
 *   3. ESTADO REAL: leemos el estado con navigator.permissions.query() en vez
 *      de re-solicitar a ciegas. Si ya está 'denied', no insistimos.
 *   4. SIN DARK PATTERNS: una sola solicitud por gesto del usuario.
 *   5. SUSCRIPCIÓN: la SubApp que llama a este hook decide, vía
 *      useSubscriptionTier(), si el usuario tiene el plan requerido ANTES de
 *      montar el priming — este hook no sabe nada de planes de pago.
 *
 * Estados expuestos: 'unknown' | 'prompt' | 'granted' | 'denied' | 'unsupported'
 *
 * Uso:
 *   const cam = useClientPermission('camera')
 *   // 1. el componente muestra el priming propio …
 *   // 2. al confirmar el usuario:
 *   const stream = await cam.request()  // dispara el prompt nativo
 *
 * Compartido entre SubApps (BZ CargoLink, BZ PureScan, …) — un solo sitio
 * donde vive la lógica de permisos evita que cada app la reimplemente
 * distinto (que es justo lo que pasaba antes: PureScan pedía cámara sin
 * ningún aviso previo mientras CargoLink sí lo hacía bien).
 */

import { useCallback, useEffect, useState } from 'react'

// Cada herramienta declara su finalidad y cómo se trata el dato capturado.
// Esto NO es decorativo: es el texto de transparencia que el componente debe
// mostrar en el priming (contrato de datos visible para el usuario).
export const CLIENT_TOOLS = {
  camera: {
    label: 'Cámara',
    purpose: 'Capturar un fotograma para generar evidencia/huella de integridad (hash SHA-256 / SIFT).',
    dataHandling: 'La imagen NO sale del dispositivo salvo que la subas explícitamente. Solo el hash resultante se ancla en BeZhas L2.',
    permissionName: 'camera',
  },
  geolocation: {
    label: 'Ubicación',
    purpose: 'Mostrar la ruta de última milla en tiempo real y validar el punto de entrega.',
    dataHandling: 'La posición se usa en sesión para tracking; no se almacena el historial sin tu consentimiento.',
    permissionName: 'geolocation',
  },
}

async function queryState(permissionName) {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) return 'unknown'
  try {
    const status = await navigator.permissions.query({ name: permissionName })
    return status.state // 'granted' | 'denied' | 'prompt'
  } catch {
    // Algunos navegadores no soportan query() para 'camera'; degradamos a 'unknown'.
    return 'unknown'
  }
}

export function useClientPermission(tool) {
  const config = CLIENT_TOOLS[tool]
  const [state, setState] = useState('unknown')

  useEffect(() => {
    if (!config) return
    let active = true
    queryState(config.permissionName).then(s => { if (active) setState(s) })
    return () => { active = false }
  }, [config])

  // request(): SOLO debe llamarse tras el priming + gesto explícito del usuario.
  // Devuelve el recurso (MediaStream / GeolocationPosition) o lanza un error
  // que el componente traduce a una degradación elegante.
  const request = useCallback(async () => {
    if (!config) throw new Error(`Herramienta de cliente desconocida: ${tool}`)

    if (tool === 'camera') {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState('unsupported')
        throw new Error('La cámara no está disponible en este dispositivo/navegador.')
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        setState('granted')
        return stream
      } catch (err) {
        setState(err?.name === 'NotAllowedError' ? 'denied' : 'unsupported')
        throw err
      }
    }

    if (tool === 'geolocation') {
      if (!navigator.geolocation) {
        setState('unsupported')
        throw new Error('La geolocalización no está disponible en este dispositivo/navegador.')
      }
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          pos => { setState('granted'); resolve(pos) },
          err => {
            setState(err.code === err.PERMISSION_DENIED ? 'denied' : 'unsupported')
            reject(err)
          },
          { enableHighAccuracy: true, timeout: 10000 },
        )
      })
    }

    throw new Error(`No hay flujo de solicitud para ${tool}`)
  }, [config, tool])

  return {
    ...config,
    state,                       // 'unknown' | 'prompt' | 'granted' | 'denied' | 'unsupported'
    isDenied: state === 'denied',
    isGranted: state === 'granted',
    request,
  }
}

export default useClientPermission
