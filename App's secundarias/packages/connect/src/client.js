// client.js — the browser-safe core: BeZhasConnect + BeZhasApiError.
//
// Split out of index.js so it can be imported in the browser (the embed widget)
// WITHOUT pulling webhooks.js, which depends on node:crypto and would break the
// browser module graph. index.js re-exports everything here, so the public
// package API (`import BeZhasConnect from '@bezhas/connect'`) is unchanged.

import { PayModule } from './pay.js';
import { CargoLinkModule } from './cargolink.js';
import { ServiceModule } from './service.js';
import { listCapabilities } from './registry.js';
import { SubscriptionModule, Entitlements } from './subscription.js';

const DEFAULT_BASE_URL = 'https://api.bez.digital';

/** Coerce an Entitlements | API payload | id[] into an Entitlements instance. */
function toEntitlements(value) {
  if (value instanceof Entitlements) return value;
  if (Array.isArray(value)) return new Entitlements(value);
  return Entitlements.fromApi(value);
}

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
  constructor(opts = {}) {
    this.apiKey = opts.apiKey || null;
    this.userToken = opts.userToken || null;
    this.baseUrl = (opts.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeoutMs = opts.timeoutMs ?? 15000;
    this._fetch = opts.fetch || globalThis.fetch;

    if (typeof this._fetch !== 'function') {
      throw new Error('No fetch available. Pass { fetch } or run on Node >= 18.');
    }

    // Typed convenience namespaces (hand-written ergonomics for the two flagship
    // SubApps). They and the generic service() below both route through request()
    // and share the same registry paths — pick whichever reads better.
    this.pay = new PayModule(this);
    this.cargolink = new CargoLinkModule(this);
    this.subscription = new SubscriptionModule(this);

    // Optional entitlements — when set, service() enforces that the target
    // SubApp was activated on the subscription. Accept a ready Entitlements, a
    // raw API payload, or an array of subapp ids. null = no gating (default).
    this._entitlements = opts.entitlements ? toEntitlements(opts.entitlements) : null;
  }

  /**
   * Apply entitlements so every subsequent service() call is gated to the
   * SubApps the subscription activated. Pass an Entitlements, an API payload,
   * or an array of subapp ids. Pass null to disable gating.
   * @returns {this}
   */
  setEntitlements(value) {
    this._entitlements = value == null ? null : toEntitlements(value);
    return this;
  }

  /** Current entitlements (or null if gating is off). */
  getEntitlements() {
    return this._entitlements;
  }

  /**
   * Generic accessor for ANY registered SubApp — the uniform integration surface.
   *
   *   bezhas.service('energy').call('assets');
   *   bezhas.service('cargolink', { roleKey }).call('getTx', { bUid: 'B-1' });
   *
   * Adding a SubApp to the ecosystem = a descriptor in registry.js; no new client
   * code. This is what the embeddable widget / MCP server / ERP adapter call.
   * @param {string} name  pay | cargolink | energy | ...
   * @param {{ roleKey?: string }} [opts]
   * @returns {ServiceModule}
   */
  service(name, opts = {}) {
    return new ServiceModule(this, name, opts);
  }

  /**
   * Discover every SubApp + action this SDK can invoke (no secrets). Powers docs,
   * the "what can I call?" panel, and capability negotiation with a host platform.
   */
  capabilities() {
    return listCapabilities();
  }

  /**
   * Low-level request used by every module. Returns the parsed JSON body.
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

export default BeZhasConnect;
