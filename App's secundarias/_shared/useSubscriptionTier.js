/**
 * useSubscriptionTier — resuelve el plan de suscripción activo del usuario
 * (GET /api/ai-billing/subscription) para que las SubApps puedan decidir si
 * ofrecen una función "de pago" (p. ej. pedir cámara/GPS con la explicación
 * detallada) antes de mostrar nada al usuario.
 *
 * Regla del producto: la solicitud DETALLADA de un permiso de cliente
 * (cámara/geolocalización) solo se muestra si el usuario:
 *   1. Está autenticado (hay sesión wallet/SIWE), Y
 *   2. Tiene un plan de suscripción admitido para esa función.
 * Sin sesión o sin plan admitido → no se pide el permiso en absoluto (la
 * SubApp debe mostrar un aviso de "requiere plan X", nunca el prompt nativo).
 *
 * Dependency-free (fetch + localStorage), igual que bezhas-wallet-auth.js.
 */
import { useEffect, useState } from 'react';
import { getAuthHeaders, getSession } from './bezhas-wallet-auth.js';

function envApiBase() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return (
        import.meta.env.VITE_AUTH_API ||
        import.meta.env.VITE_HUB_API ||
        import.meta.env.VITE_API_URL ||
        'https://api.bez.digital'
      );
    }
  } catch { /* not a module env */ }
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NEXT_PUBLIC_AUTH_API || process.env.NEXT_PUBLIC_API_URL || 'https://api.bez.digital';
  }
  return 'https://api.bez.digital';
}

// Orden de menor a mayor — usado por hasTier() para comparaciones "al menos X".
export const TIER_ORDER = ['free', 'starter', 'professional', 'enterprise'];

/**
 * @returns {{ tier: string, loading: boolean, error: string|null, hasTier: (required: string[]) => boolean, refresh: () => void }}
 */
export function useSubscriptionTier({ apiBase = envApiBase() } = {}) {
  const [tier, setTier] = useState('free'); // por defecto el más restrictivo, nunca el más permisivo
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    const session = getSession();

    // Sin sesión → no hay nada que consultar; se queda en 'free' (lo más
    // restrictivo). Nunca asumimos un plan de pago sin poder verificarlo.
    if (!session) {
      setTier('free');
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`${apiBase}/api/ai-billing/subscription`, {
      headers: getAuthHeaders(),
      credentials: 'include',
      signal: AbortSignal.timeout(8000),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`subscription ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        setTier(data?.tier && TIER_ORDER.includes(data.tier) ? data.tier : 'free');
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        // Backend de billing no desplegado / caído: degradamos a 'free'
        // (lo más restrictivo) en vez de asumir acceso — nunca al revés.
        console.warn('[useSubscriptionTier] no se pudo resolver el plan, asumiendo "free":', err.message);
        setTier('free');
        setError(err.message);
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [apiBase, nonce]);

  const hasTier = (required = []) => required.includes(tier);

  return { tier, loading, error, hasTier, refresh: () => setNonce((n) => n + 1) };
}

export default useSubscriptionTier;
