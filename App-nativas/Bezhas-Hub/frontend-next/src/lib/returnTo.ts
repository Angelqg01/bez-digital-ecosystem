// Misma regla que api/lib/returnTo.js: sólo se vuelve a apps propias (https en bezhas.com o sus subdominios;
// en desarrollo, localhost). Cualquier otra cosa se descarta para que un enlace no sirva de redirección abierta.
export function safeReturnTo(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 1000) return null;
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.username || u.password) return null;
  const h = u.hostname.toLowerCase();
  if (u.protocol === 'https:' && (h === 'bezhas.com' || h.endsWith('.bezhas.com'))) return u.toString();
  if (u.protocol === 'http:' && (h === 'localhost' || h === '127.0.0.1') && process.env.NODE_ENV !== 'production') return u.toString();
  return null;
}

/** Nombre corto de la app de destino para los botones («energy.bezhas.com»). */
export function appLabel(url: string | null): string | null {
  if (!url) return null;
  try { return new URL(url).hostname; } catch { return null; }
}
