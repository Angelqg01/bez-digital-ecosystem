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
  } catch (_) { }
  return config;
});

// Response interceptor: global error handling optimized for development
http.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || '';

    // Silently handle 404s - backend may not be running in development
    if (status === 404) {
      // Don't log 404s to console - they're expected when backend is off
      return Promise.reject(error);
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
      // Only clear JWT for explicit auth endpoints, NOT for admin API calls
      // (admin routes use wallet-based auth; clearing JWT causes cascade failures)
      const isAuthEndpoint = url.includes('/auth/') || url.includes('/login') || url.includes('/verify-token');
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
