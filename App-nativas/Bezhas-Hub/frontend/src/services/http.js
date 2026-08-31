import axios from 'axios';

// Normalize API base to avoid duplicate "/api" when callers use absolute paths starting with "/api"
function normalizeBase(url) {
  const raw = url || '';
  if (!raw) return '';
  const trimmed = raw.trim();
  // If base is exactly "/api" or "api", prefer empty base and rely on absolute "/api/*" paths
  if (trimmed === '/api' || trimmed === 'api') return '';
  // Remove trailing slash
  return trimmed.replace(/\/+$/, '');
}

const API_URL = normalizeBase(import.meta.env.VITE_API_URL || window.__API_URL__ || '');

const http = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: false
});

// Request interceptor: attach JWT and wallet address if present
http.interceptors.request.use((config) => {
  try {
    config.headers = config.headers || {};
    const token = localStorage.getItem('bezhas-jwt');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    // Attach wallet address for admin API routes (wallet-based auth)
    if (!config.headers['x-wallet-address']) {
      const walletAddr = localStorage.getItem('adminWalletAddress')
        || localStorage.getItem('wallet_address');
      if (walletAddr) {
        config.headers['x-wallet-address'] = walletAddr;
      }
    }
    // Multi-tenant: scope cada llamada a la organización/sede seleccionada.
    // Punto ÚNICO de inyección (lo lee el middleware tenancy del backend).
    if (!config.headers['X-Org-Id']) {
      const orgId = localStorage.getItem('bezhas-org-id');
      if (orgId) config.headers['X-Org-Id'] = orgId;
    }
    if (!config.headers['X-Site-Id']) {
      const siteId = localStorage.getItem('bezhas-site-id');
      if (siteId) config.headers['X-Site-Id'] = siteId;
    }
  } catch (_) { }
  return config;
});

// Renovación de sesión ante un 401.
// El TTL del access token bajó de 30 días a 24h al unificarlo con el resto del
// ecosistema (ver backend/config/authSecrets.js). Para que eso no obligue a
// re-loguearse cada día, el primer 401 de una petición normal intenta renovar
// contra /api/auth/renew y reintenta la original una sola vez. Una única
// promesa compartida evita que N peticiones en paralelo disparen N renovaciones.
let renewalInFlight = null;

function renewSession() {
  if (!renewalInFlight) {
    renewalInFlight = http
      .post('/api/auth/renew', {}, { __skipRenew: true })
      .then((res) => {
        const token = res?.data?.token;
        if (!token) throw new Error('renew sin token');
        localStorage.setItem('bezhas-jwt', token);
        return token;
      })
      .finally(() => { renewalInFlight = null; });
  }
  return renewalInFlight;
}

// Response interceptor: global error handling optimized for development
http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || '';
    const config = error?.config;

    // Silently handle 404s - backend may not be running in development
    if (status === 404) {
      // Don't log 404s to console - they're expected when backend is off
      return Promise.reject(error);
    }

    // Un token caducado se renueva y se reintenta, en vez de tirar la sesión.
    // Se excluyen las rutas de auth para no entrar en bucle: si el propio
    // /renew devuelve 401, el token ya no es recuperable y toca re-login.
    const isAuthEndpoint = url.includes('/auth/') || url.includes('/login') || url.includes('/verify-token');
    if (status === 401 && config && !config.__skipRenew && !config.__retried && !isAuthEndpoint
      && localStorage.getItem('bezhas-jwt')) {
      try {
        const token = await renewSession();
        config.__retried = true;
        config.headers = { ...(config.headers || {}), Authorization: `Bearer ${token}` };
        return http(config);
      } catch (_) {
        try { localStorage.removeItem('bezhas-jwt'); } catch (__) { }
      }
    }

    // Handle 401 Unauthorized silently
    if (status === 401) {
      // Only log once in development, not repeatedly
      if (import.meta.env.DEV && !window.__auth_401_logged) {
        console.warn('⚠️ Backend requiere autenticación. Inicia sesión en el panel admin.');
        window.__auth_401_logged = true;
        // Reset flag after 5 seconds
        setTimeout(() => { window.__auth_401_logged = false; }, 5000);
      }
      // Only clear JWT for explicit auth endpoints, NOT for admin API calls.
      if (isAuthEndpoint) {
        try {
          localStorage.removeItem('bezhas-jwt');
        } catch (_) { }
      }
    }

    return Promise.reject(error);
  }
);

export default http;
