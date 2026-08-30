// BeZhas API Client — typed fetch wrapper with auth support
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface ApiOptions extends RequestInit {
    token?: string;
    quiet?: boolean;
}

class ApiError extends Error {
    status: number;
    data: unknown;
    constructor(message: string, status: number, data?: unknown) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
    }
}

async function request<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const { token, quiet: _quiet, ...fetchOptions } = options;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let res: Response;
    try {
        // `credentials: 'include'` es lo que hace que la cookie HttpOnly de sesión
        // admin (bezhas_admin_token, puesta por /admin-auth/login) viaje hasta la
        // API. Sin esto el navegador no la manda —la API está en otro puerto/
        // subdominio— y el panel se quedaba sin ninguna credencial utilizable:
        // el login nunca devuelve el token en el body, justo para no guardarlo
        // en localStorage al alcance de cualquier XSS.
        res = await fetch(`${API_BASE}${endpoint}`, { credentials: 'include', ...fetchOptions, headers });
    } catch {
        throw new ApiError('API no disponible', 0);
    }

    if (!res.ok) {
        const data = await res.json().catch(() => null);
        const method = fetchOptions.method || 'GET';
        const message = data?.error || data?.message || res.statusText;
        throw new ApiError(`${message} (${method} ${endpoint})`, res.status, data);
    }

    if (res.status === 204) return null as T;
    return res.json();
}

// ── Public API methods ──────────────────────────────────────────
export const api = {
    get: <T>(url: string, opts?: ApiOptions) => request<T>(url, { ...opts, method: 'GET' }),
    post: <T>(url: string, body: unknown, opts?: ApiOptions) =>
        request<T>(url, { ...opts, method: 'POST', body: JSON.stringify(body) }),
    put: <T>(url: string, body: unknown, opts?: ApiOptions) =>
        request<T>(url, { ...opts, method: 'PUT', body: JSON.stringify(body) }),
    patch: <T>(url: string, body: unknown, opts?: ApiOptions) =>
        request<T>(url, { ...opts, method: 'PATCH', body: JSON.stringify(body) }),
    del: <T>(url: string, opts?: ApiOptions) => request<T>(url, { ...opts, method: 'DELETE' }),
};

// SWR fetcher — auto-includes auth token when available
export const fetcher = <T>(url: string): Promise<T> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('bezhas_token') : null;
    return request<T>(url, token ? { token } : {});
};

export { ApiError };
export default api;
