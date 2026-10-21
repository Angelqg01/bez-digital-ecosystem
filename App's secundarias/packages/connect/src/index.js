// @bezhas/connect — outward-facing integration SDK.
//
// This is the "extension API" surface that a THIRD-PARTY platform installs to
// embed BeZhas services (Pay, CargoLink) inside its own UI — the same way a
// VSCode extension lets you use a 3rd-party service without leaving the editor.
//
// It is deliberately:
//   - zero-dependency (uses the global fetch in Node 18+ and every browser)
//   - framework-agnostic (no React/ethers) so it drops into WooCommerce, a
//     Shopify backend, an SAP/ODOO connector, a Cloud Function, or the browser.
//
// Internal sub-apps should keep using @bezhas/platform-sdk (React hooks). This
// package is for everyone OUTSIDE the BeZhas ecosystem.

import { PayModule } from './pay.js';
import { CargoLinkModule } from './cargolink.js';

const DEFAULT_BASE_URL = 'https://api.bez.digital';

/** Error thrown for any non-2xx API response. Carries status + parsed body. */
export class BeZhasApiError extends Error {
  constructor(message, { status, body, endpoint } = {}) {
    super(message);
    this.name = 'BeZhasApiError';
    this.status = status ?? 0;
    this.body = body ?? null;
    this.endpoint = endpoint ?? null;
  }
}

/**
 * The client every integration starts from.
 *
 *   const bezhas = new BeZhasConnect({ apiKey: process.env.BEZHAS_API_KEY });
 *   const order  = await bezhas.pay.buy({ amountUSD: 49.9, paymentMethod: 'card' });
 *
 * Auth maps 1:1 to the gateway middleware:
 *   - apiKey      -> `x-api-key`        (server-to-server, scoped registered app)
 *   - userToken   -> `Authorization`   (cross-app SSO JWT, optional bonus context)
 * CargoLink role-scoped keys are passed per-call (they ARE the Authorization bearer).
 */
export class BeZhasConnect {
  /**
   * @param {object} opts
   * @param {string} [opts.apiKey]    Registered-app API key (gateway x-api-key).
   * @param {string} [opts.userToken] Optional SSO JWT for user context.
   * @param {string} [opts.baseUrl]   Override API host. Default https://api.bez.digital
   * @param {number} [opts.timeoutMs] Per-request timeout. Default 15000.
   * @param {typeof fetch} [opts.fetch] Inject a fetch impl (tests / older runtimes).
   */
  constructor(opts = {}) {
    this.apiKey = opts.apiKey || null;
    this.userToken = opts.userToken || null;
    this.baseUrl = (opts.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeoutMs = opts.timeoutMs ?? 15000;
    this._fetch = opts.fetch || globalThis.fetch;

    if (typeof this._fetch !== 'function') {
      throw new Error('No fetch available. Pass { fetch } or run on Node >= 18.');
    }

    // Service namespaces.
    this.pay = new PayModule(this);
    this.cargolink = new CargoLinkModule(this);
  }

  /**
   * Low-level request used by every module. Returns the parsed JSON body.
   * @param {string} method
   * @param {string} path  Absolute API path, e.g. '/api/gateway/v1/payments/buy'.
   * @param {object} [options]
   * @param {object} [options.query]   Query params (skips null/undefined).
   * @param {object} [options.body]    JSON body for POST/PUT.
   * @param {string} [options.bearer]  Per-call bearer token (CargoLink role key) — overrides userToken.
   * @param {Record<string,string>} [options.headers]
   */
  async request(method, path, options = {}) {
    const url = new URL(this.baseUrl + path);
    if (options.query) {
      for (const [k, v] of Object.entries(options.query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }

    const headers = { Accept: 'application/json', ...options.headers };
    if (this.apiKey) headers['x-api-key'] = this.apiKey;

    const bearer = options.bearer || this.userToken;
    if (bearer) headers['Authorization'] = `Bearer ${bearer}`;

    let payload;
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(options.body);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let res;
    try {
      res = await this._fetch(url.toString(), {
        method,
        headers,
        body: payload,
        signal: controller.signal,
      });
    } catch (err) {
      throw new BeZhasApiError(
        err.name === 'AbortError'
          ? `Request to ${path} timed out after ${this.timeoutMs}ms`
          : `Network error calling ${path}: ${err.message}`,
        { status: 0, endpoint: path },
      );
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { raw: text };
    }

    if (!res.ok) {
      const msg = body?.error || body?.message || `${res.status} ${res.statusText}`;
      throw new BeZhasApiError(`BeZhas API ${res.status}: ${msg}`, {
        status: res.status,
        body,
        endpoint: path,
      });
    }

    return body;
  }
}

export { PayModule } from './pay.js';
export { CargoLinkModule } from './cargolink.js';
export * as webhooks from './webhooks.js';

export default BeZhasConnect;
