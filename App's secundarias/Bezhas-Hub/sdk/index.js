/**
 * ============================================================================
 * @bezhas/sdk — Cliente oficial del BeZhas Hub para integraciones externas
 * ============================================================================
 *
 * SDK cliente (instituciones, holdings, partners) generado a partir del
 * contrato OpenAPI del Hub (`backend/openapi.json`). Zero dependencias:
 * usa `fetch` nativo (Node 18+ y navegadores).
 *
 * Los métodos se generan desde el manifest ENDPOINTS, que se mantiene
 * sincronizado con el contrato mediante el test
 * `backend/tests/sdk-contract-sync.test.js` (CI): si el contrato cambia
 * y el SDK no, el test falla.
 *
 * @example
 * const { BezhasHubClient } = require('@bezhas/sdk');
 *
 * const hub = new BezhasHubClient({ apiKey: process.env.BEZHAS_API_KEY });
 *
 * await hub.health.get();                                   // estado del Hub
 * await hub.web3.indexerEvents({ query: { contractName: 'BezhasToken', limit: 10 } });
 * await hub.escrow.create({ body: { clientWallet: '0x…', collateralAmount: '…' } });
 */

'use strict';

/**
 * Manifest de endpoints — espejo 1:1 del contrato OpenAPI público del Hub.
 * Clave: `namespace.metodo` → { method, path } con plantillas `{param}`.
 * NO añadir aquí endpoints que no estén en backend/openapi.json (el test de
 * sincronía lo impide) ni rutas admin/internas.
 */
const ENDPOINTS = {
    // ── Health ──────────────────────────────────────────────────────────────
    'health.get': { method: 'GET', path: '/health' },
    'health.live': { method: 'GET', path: '/health/live' },
    'health.ready': { method: 'GET', path: '/health/ready' },

    // ── Quality Oracle / Escrow ─────────────────────────────────────────────
    'escrow.create': { method: 'POST', path: '/escrow/create' },
    'escrow.get': { method: 'GET', path: '/escrow/{serviceId}' },
    'escrow.finalize': { method: 'POST', path: '/escrow/{serviceId}/finalize' },
    'escrow.dispute': { method: 'POST', path: '/escrow/{serviceId}/dispute' },
    'escrow.stats': { method: 'GET', path: '/escrow/stats' },

    // ── Developer Portal ────────────────────────────────────────────────────
    'developers.register': { method: 'GET', path: '/developers/register' },
    'developers.keys': { method: 'GET', path: '/developers/keys' },
    'developers.generate': { method: 'POST', path: '/developers/generate' },
    'developers.playground': { method: 'GET', path: '/developers/playground' },

    // ── Clothing Rental (vertical con evaluación AEGIS) ─────────────────────
    'clothingRental.create': { method: 'POST', path: '/clothing-rental' },
    'clothingRental.byCustomer': { method: 'GET', path: '/clothing-rental/customer/{walletAddress}' },
    'clothingRental.byMerchant': { method: 'GET', path: '/clothing-rental/merchant/{walletAddress}' },
    'clothingRental.get': { method: 'GET', path: '/clothing-rental/{rentalId}' },
    'clothingRental.initiateAegis': { method: 'POST', path: '/clothing-rental/{rentalId}/aegis/initiate' },
    'clothingRental.aegisStatus': { method: 'GET', path: '/clothing-rental/{rentalId}/aegis/status' },
    'clothingRental.merchantDecision': { method: 'POST', path: '/clothing-rental/{rentalId}/merchant-decision' },
    'clothingRental.recordPayment': { method: 'POST', path: '/clothing-rental/{rentalId}/payment' },
    'clothingRental.processReturn': { method: 'POST', path: '/clothing-rental/{rentalId}/return' },
    'clothingRental.addReview': { method: 'POST', path: '/clothing-rental/{rentalId}/review' },
    'clothingRental.pendingAegis': { method: 'GET', path: '/clothing-rental/pending-aegis' },
    'clothingRental.stats': { method: 'GET', path: '/clothing-rental/stats' },
    'clothingRental.categories': { method: 'GET', path: '/clothing-rental/categories' },

    // ── Web3 Core (solo lectura — indexer, cola, estado) ────────────────────
    'web3.health': { method: 'GET', path: '/web3/health' },
    'web3.status': { method: 'GET', path: '/web3/status' },
    'web3.indexerStats': { method: 'GET', path: '/web3/indexer/stats' },
    'web3.indexerEvents': { method: 'GET', path: '/web3/indexer/events' },
    'web3.queueStats': { method: 'GET', path: '/web3/queue/stats' },
};

const DEFAULT_BASE_URL = 'https://api.bez.digital/api';

class BezhasHubError extends Error {
    constructor(message, { status, body, path } = {}) {
        super(message);
        this.name = 'BezhasHubError';
        this.status = status;
        this.body = body;
        this.path = path;
    }
}

class BezhasHubClient {
    /**
     * @param {object} opts
     * @param {string} [opts.baseUrl] Base del API (por defecto producción).
     * @param {string} [opts.apiKey]  API Key del Developer Portal (header X-API-Key).
     * @param {string} [opts.jwt]     JWT opcional (Authorization: Bearer …).
     * @param {number} [opts.timeoutMs] Timeout por petición (por defecto 30000).
     * @param {Function} [opts.fetch] Implementación fetch alternativa (tests/polyfills).
     */
    constructor({ baseUrl = DEFAULT_BASE_URL, apiKey, jwt, timeoutMs = 30000, fetch: fetchImpl } = {}) {
        this.baseUrl = baseUrl.replace(/\/+$/, '');
        this.apiKey = apiKey;
        this.jwt = jwt;
        this.timeoutMs = timeoutMs;
        this._fetch = fetchImpl || globalThis.fetch;
        if (typeof this._fetch !== 'function') {
            throw new Error('fetch no disponible: usa Node 18+ o pasa { fetch } en las opciones.');
        }
        this._buildNamespaces();
    }

    /** Construye hub.<namespace>.<metodo>() desde el manifest ENDPOINTS. */
    _buildNamespaces() {
        for (const [key, def] of Object.entries(ENDPOINTS)) {
            const [ns, method] = key.split('.');
            if (!this[ns]) this[ns] = {};
            const pathParams = [...def.path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
            this[ns][method] = (...args) => {
                const opts = (args.length > pathParams.length && typeof args[pathParams.length] === 'object')
                    ? args[pathParams.length]
                    : {};
                let path = def.path;
                pathParams.forEach((p, i) => {
                    if (args[i] === undefined || args[i] === null) {
                        throw new Error(`Falta el parámetro de ruta "${p}" para ${key}()`);
                    }
                    path = path.replace(`{${p}}`, encodeURIComponent(String(args[i])));
                });
                return this.request(def.method, path, opts);
            };
        }
    }

    /**
     * Petición HTTP de bajo nivel contra el Hub.
     * @param {string} method  Verbo HTTP.
     * @param {string} path    Ruta relativa a baseUrl (p.ej. '/health').
     * @param {object} [opts]  { query, body, headers }
     */
    async request(method, path, { query, body, headers } = {}) {
        const url = new URL(this.baseUrl + path);
        if (query) {
            for (const [k, v] of Object.entries(query)) {
                if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
            }
        }
        const h = { Accept: 'application/json', ...headers };
        if (this.apiKey) h['X-API-Key'] = this.apiKey;
        if (this.jwt) h.Authorization = `Bearer ${this.jwt}`;
        if (body !== undefined) h['Content-Type'] = 'application/json';

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        let res;
        try {
            res = await this._fetch(url.toString(), {
                method,
                headers: h,
                body: body !== undefined ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });
        } catch (err) {
            throw new BezhasHubError(
                err.name === 'AbortError' ? `Timeout tras ${this.timeoutMs}ms: ${method} ${path}` : `Fallo de red: ${err.message}`,
                { path }
            );
        } finally {
            clearTimeout(timer);
        }

        const text = await res.text();
        let json;
        try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }

        if (!res.ok) {
            throw new BezhasHubError(
                json?.error || json?.message || `HTTP ${res.status} en ${method} ${path}`,
                { status: res.status, body: json, path }
            );
        }
        return json;
    }
}

module.exports = { BezhasHubClient, BezhasHubError, ENDPOINTS, DEFAULT_BASE_URL };
