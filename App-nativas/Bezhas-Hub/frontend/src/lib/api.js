// Centralized API helper (fetch-based) and resilient app config loader
// Uses Vite proxy in dev: base is '' so calls to `/api/*` are proxied to backend
function normalizeBase(url) {
  const raw = url || '';
  if (!raw) return '';
  const trimmed = raw.trim();
  if (trimmed === '/api' || trimmed === 'api') return '';
  return trimmed.replace(/\/+$/, '');
}

export const API_BASE = normalizeBase(import.meta.env.VITE_API_URL || '');

// Optional thin wrappers (kept for compatibility if used elsewhere)
export async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { 'Accept': 'application/json' } });
  return res;
}

export async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res;
}

// In-flight promise to dedupe concurrent calls and reduce 429s
let inflightConfigPromise = null;
// Cache the config for the session
let cachedConfig = null;
const CONFIG_CACHE_DURATION = 60 * 60 * 1000; // 1 hour
let configCacheTimestamp = 0;

/**
 * Fetches the application configuration from the backend.
 * Proxied path: /api/config
 * - Dedupe concurrent requests
 * - Cache config for 1 hour
 * - Retry on 429/5xx with exponential backoff
 */
export const fetchConfig = async () => {
  // Return cached config if still valid
  if (cachedConfig && Date.now() - configCacheTimestamp < CONFIG_CACHE_DURATION) {
    console.log('Returning cached config');
    return cachedConfig;
  }

  // Return in-flight promise if one exists
  if (inflightConfigPromise) {
    console.log('Returning in-flight config promise');
    return inflightConfigPromise;
  }

  const maxRetries = 3;
  const baseDelay = 1000; // Increased from 500ms

  inflightConfigPromise = (async () => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

        const response = await fetch(`${API_BASE}/api/config`, {
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const config = await response.json();

        // Cache the successful result
        cachedConfig = config;
        configCacheTimestamp = Date.now();

        return config;
      } catch (error) {
        // Handle network errors gracefully - silently fall back to defaults
        if (error.name === 'AbortError' || error.message.includes('Failed to fetch')) {
          if (attempt === maxRetries - 1) {
            // Return default config silently - backend not running is expected during dev
            return {
              chainId: "137",
              contractAddresses: {},
              abis: {}
            };
          }
        }

        const status = Number(String(error.message).match(/status:\s*(\d+)/)?.[1]);
        const canRetry = [429, 502, 503, 504].includes(status);

        if (!canRetry || attempt === maxRetries - 1) {
          // Silently use defaults - no need to warn user
          return {
            chainId: "137",
            contractAddresses: {},
            abis: {}
          };
        }

        // Exponential backoff only for retryable errors
        await new Promise((r) => setTimeout(r, baseDelay * (2 ** attempt)));
      }
    }
  })();

  try {
    const res = await inflightConfigPromise;
    return res;
  } finally {
    // Reset so subsequent calls can refetch later if needed
    inflightConfigPromise = null;
  }
};
