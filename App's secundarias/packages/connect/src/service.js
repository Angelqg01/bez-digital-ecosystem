// ServiceModule — the uniform invocation surface over the Capability Registry.
//
// One generic module drives EVERY SubApp. Instead of a hand-written class per
// service, this reads the descriptor (registry.js) and turns a call into the
// exact backend request — substituting path params, splitting the rest into
// query (GET) or body (POST/PUT), enforcing required params, and applying the
// SubApp's auth mode.
//
//   const energy = bezhas.service('energy');
//   await energy.call('assets');
//   await energy.call('price', { zone: 'ES' });
//
//   const cargo = bezhas.service('cargolink', { roleKey });   // bind a role key once
//   await cargo.call('getTx', { bUid: 'B-123' });
//
// This is what makes "use any SubApp service inside a 3rd-party platform" a
// one-liner — and what the embeddable widget / MCP server / ERP adapter all
// sit on top of.

import { getSubAppDescriptor } from './registry.js';
import { BeZhasEntitlementError } from './subscription.js';

// SubApps that are infrastructure, not billable services — never gated by
// entitlements (you can always read your own subscription).
const UNGATED_SUBAPPS = new Set(['subscription']);

export class ServiceModule {
  /**
   * @param {import('./index.js').BeZhasConnect} client
   * @param {string} subapp  Registered SubApp name (pay | cargolink | energy | ...).
   * @param {object} [opts]
   * @param {string} [opts.roleKey] Default bearer for roleKey-auth SubApps (overridable per call).
   */
  constructor(client, subapp, opts = {}) {
    this.client = client;
    this.subapp = subapp;
    this.descriptor = getSubAppDescriptor(subapp);
    this.roleKey = opts.roleKey || null;
  }

  /** Return a new module for the same SubApp bound to a specific role key. */
  withRoleKey(roleKey) {
    return new ServiceModule(this.client, this.subapp, { roleKey });
  }

  /** The action names this SubApp exposes. */
  actions() {
    return Object.keys(this.descriptor.actions);
  }

  /**
   * Invoke a registered action.
   * @param {string} action  Action name from the descriptor.
   * @param {object} [params] Mixed params: path params + query/body fields.
   *                          Reserved keys: `roleKey` (bearer), `_query`/`_body`
   *                          (force placement), `headers`.
   * @returns {Promise<object>} Parsed JSON body (or throws BeZhasApiError).
   */
  call(action, params = {}) {
    const spec = this.descriptor.actions[action];
    if (!spec) {
      throw new Error(
        `Unknown action "${action}" on SubApp "${this.subapp}". ` +
          `Available: ${this.actions().join(', ')}.`,
      );
    }

    // Entitlement gate (opt-in): if the client carries entitlements, the target
    // SubApp must have been activated on the subscription. Fails fast, before
    // any network call. Infra SubApps (subscription) are never gated.
    const ent = this.client.getEntitlements?.();
    if (ent && !UNGATED_SUBAPPS.has(this.subapp) && !ent.allows(this.subapp)) {
      throw new BeZhasEntitlementError(this.subapp, ent.subapps);
    }

    // Pull reserved keys out before they leak into the request.
    const { roleKey, headers, _query, _body, ...rest } = params;

    // Required-param check (clear, early failure — no half-built network call).
    for (const req of spec.required || []) {
      if (rest[req] === undefined || rest[req] === null || rest[req] === '') {
        throw new TypeError(
          `Action "${this.subapp}.${action}" requires param "${req}".`,
        );
      }
    }

    // Substitute ":param" segments in the path, consuming those params.
    const consumed = new Set();
    const path = spec.path.replace(/:([A-Za-z0-9_]+)/g, (_m, key) => {
      if (rest[key] === undefined) {
        throw new TypeError(
          `Action "${this.subapp}.${action}" path needs param "${key}".`,
        );
      }
      consumed.add(key);
      return encodeURIComponent(String(rest[key]));
    });

    // Remaining params → query for GET/DELETE, body for POST/PUT.
    const remaining = {};
    for (const [k, v] of Object.entries(rest)) {
      if (!consumed.has(k)) remaining[k] = v;
    }
    const isWrite = spec.method === 'POST' || spec.method === 'PUT';

    const options = { headers };
    if (_query) options.query = _query;
    if (_body !== undefined) options.body = _body;
    if (isWrite && _body === undefined) options.body = remaining;
    if (!isWrite && !_query && Object.keys(remaining).length) options.query = remaining;

    // Auth: roleKey/bearer SubApps pass the key as the per-call bearer (device
    // key, role key or user JWT); apiKey SubApps rely on the client's
    // x-api-key; public actions send neither.
    const authMode = spec.auth || this.descriptor.auth;
    if (authMode === 'roleKey' || authMode === 'bearer') {
      options.bearer = roleKey || this.roleKey || undefined;
    }

    return this.client.request(spec.method, this.descriptor.baseUrl + path, options);
  }
}
