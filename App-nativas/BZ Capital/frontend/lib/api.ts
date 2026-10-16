/**
 * Cliente de la API de BeZhas para DeFi.
 *
 * Las pantallas piden rutas cortas (`/api/staking/positions/…`) que antes servía
 * un backend propio (../backend) que nunca llegó a desplegarse: en producción
 * capital.bezhas.com llamaba a api.bezhas.com/api/token/info y todo daba 404.
 * Esas rutas viven en el Gateway (`/api/gateway/v1/…`), que acepta el mismo JWT
 * que emite el login de la API core, así que aquí se traducen y se firman con
 * la sesión del SSOProvider.
 */

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://api.bezhas.com')
    .replace(/\/+$/, '')
    .replace(/\/api$/, '');

const GATEWAY = '/api/gateway/v1';

// El backend antiguo exponía el SSO como /api/auth/*; en el Gateway es /sso/*.
const ALIAS: Record<string, string> = {
    '/api/auth/login': `${GATEWAY}/sso/login`,
    '/api/auth/refresh': `${GATEWAY}/sso/refresh`,
    '/api/auth/logout': `${GATEWAY}/sso/logout`,
    '/api/auth/me': `${GATEWAY}/sso/me`,
};

export function gatewayUrl(path: string): string {
    const [ruta, qs] = path.split('?');
    const destino = ALIAS[ruta] ?? (ruta.startsWith('/api/') ? `${GATEWAY}${ruta.slice(4)}` : ruta);
    return `${API_BASE}${destino}${qs ? `?${qs}` : ''}`;
}

/** JWT de la sesión. Los `demo-…` del login de wallet sin API no los firma nadie: no se envían. */
export function sessionToken(): string | null {
    if (typeof window === 'undefined') return null;
    const t = localStorage.getItem('bezhas-jwt') || localStorage.getItem('bez_token');
    return t && !t.startsWith('demo-') ? t : null;
}

/**
 * Wallet de la sesión. Primero la del JWT: es la única que el Gateway deja
 * consultar (requireAddressAccess); el usuario guardado puede traer la EOA de
 * alta mientras el token ya lleva la Safe.
 */
export function sessionAddress(): string | null {
    if (typeof window === 'undefined') return null;
    const t = sessionToken();
    if (t) {
        try {
            const b64 = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
            const claims = JSON.parse(atob(b64));
            const addr = claims.address || claims.wallet_address || claims.primary_wallet_address;
            if (typeof addr === 'string' && /^0x[0-9a-fA-F]{40}$/.test(addr)) return addr;
        } catch { /* no es un JWT */ }
    }
    try {
        const u = JSON.parse(localStorage.getItem('bezhas-user') || 'null');
        if (u?.walletAddress) return u.walletAddress;
    } catch { /* usuario corrupto */ }
    return localStorage.getItem('bez_wallet') || null;
}

export class ApiError extends Error {
    constructor(message: string, public status: number) { super(message); }
}

export async function apiFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
    const token = sessionToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...((options?.headers as Record<string, string>) || {}),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(gatewayUrl(path), { ...options, headers });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = res.status === 401
            ? 'Inicia sesión para ver estos datos.'
            : err.error || err.message || `Error de la API (${res.status})`;
        throw new ApiError(msg, res.status);
    }
    return res.json();
}
