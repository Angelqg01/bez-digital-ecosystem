/**
 * Config centralizada de endpoints del Hub (Fase 2.2 — Conexión API-Hub).
 *
 * Fuente única para las URLs base de API / WebSocket / MCP. Resuelve el drift
 * histórico: distintos componentes asumían `/api`, `:3001`, `:3001/api` o
 * incluso `:5000` como default, y algunos hacían `${VITE_API_URL}/api/...`
 * arriesgando un doble `/api`.
 *
 * Convención (la misma que cloudbuild.yaml y docker-compose.yml):
 *   VITE_API_URL = RAÍZ del backend, SIN sufijo `/api`
 *     · prod:   https://bezhas-backend-…-uc.a.run.app
 *     · docker: http://localhost:3001
 *     · dev:    http://localhost:3001 (default de abajo)
 *
 * Uso:
 *   import { apiUrl, API_BASE, WS_URL, MCP_URL } from '@/config/api';
 *   fetch(apiUrl('/admin/users'))      // → <root>/api/admin/users
 *   fetch(apiUrl('admin/users'))       // idem (la barra inicial es opcional)
 *   fetch(`${API_BASE}/health`)        // API_BASE === <root>/api
 */

const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};

/** Raíz del backend, sin barra final y sin `/api`. */
export const API_ROOT = stripTrailingSlash(env.VITE_API_URL || 'http://localhost:3001');

/** Base de la API REST: raíz + `/api`. */
export const API_BASE = `${API_ROOT}/api`;

/** WebSocket del Hub. Default derivado de la raíz (http→ws, https→wss). */
export const WS_URL = stripTrailingSlash(env.VITE_WS_URL || API_ROOT.replace(/^http/, 'ws'));

/** Servidor MCP (bezhas-intelligence). */
export const MCP_URL = stripTrailingSlash(env.VITE_MCP_URL || 'http://localhost:8080');

/**
 * Construye una URL de la API normalizando el prefijo `/api`:
 * garantiza exactamente un `/api`, tolera barra inicial presente o ausente,
 * y es idempotente si el path ya viene con `/api`.
 * @param {string} path  p.ej. '/admin/users', 'admin/users' o '/api/admin/users'
 * @returns {string} URL absoluta lista para fetch
 */
export function apiUrl(path = '') {
    let p = String(path).trim();
    if (!p) return API_BASE;
    if (!p.startsWith('/')) p = `/${p}`;
    if (p === '/api' || p.startsWith('/api/')) return `${API_ROOT}${p}`; // ya trae /api
    return `${API_BASE}${p}`;
}

function stripTrailingSlash(s) {
    return String(s).replace(/\/+$/, '');
}

export default { API_ROOT, API_BASE, WS_URL, MCP_URL, apiUrl };
