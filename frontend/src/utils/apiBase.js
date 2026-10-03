/**
 * Base del backend sin sufijo `/api` (VITE_API_URL puede venir con o sin él) y constructor de URLs.
 * Vacío = mismo origen (nginx/Vite proxy reenvían `/api/*`).
 */
export const API_BASE = String(import.meta.env.VITE_API_URL || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api$/, '');

/** apiUrl('/api/ai-workspace/chat') → URL absoluta o relativa al origen, sin duplicar `/api`. */
export const apiUrl = (path) => `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
