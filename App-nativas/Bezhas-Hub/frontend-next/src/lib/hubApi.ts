// Cliente mínimo de la API de BeZhas para el flujo de cuenta del Hub (registro, confirmación, plan).
export const API = (process.env.NEXT_PUBLIC_HUB_API_URL || process.env.NEXT_PUBLIC_CHAT_API_URL || 'https://api.bezhas.com').replace(/\/+$/, '');

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; token?: string | null } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method: opts.method || (opts.body ? 'POST' : 'GET'),
      headers: { 'Content-Type': 'application/json', ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError('No hemos podido conectar con BeZhas. Revisa tu conexión e inténtalo de nuevo.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const first = Array.isArray(data?.errors) ? data.errors[0]?.msg : undefined;
    throw new ApiError(data?.error || first || 'Algo ha fallado. Inténtalo de nuevo.', res.status, data?.code);
  }
  return data as T;
}
