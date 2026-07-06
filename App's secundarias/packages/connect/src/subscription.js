// subscription.js — the bridge between a client's SUBSCRIPTION and what the SDK
// / API / widget / WordPress plugin are actually allowed to call.
//
// A subscription grants ENTITLEMENTS: the set of SubApps the client activated
// (and pays for). Every integration surface checks the same entitlements, so a
// client who didn't activate "energy" gets a clear ENTITLEMENT_REQUIRED error
// instead of a confusing 403 deep in the gateway — and the WooCommerce plugin /
// embed widget can hide what isn't activated.
//
//   const bezhas = new BeZhasConnect({ apiKey });
//   await bezhas.subscription.sync();          // pull plan + active SubApps
//   bezhas.service('energy').call('assets');   // throws if energy not activated
//
// Core SubApps (Hub, Wallet) are always entitled. The plan tier affects PRICE
// (see Hub config/pricing.js), not access — access is simply "is this SubApp in
// your active set?".

/** SubApps included in every subscription at no extra cost. */
export const CORE_SUBAPPS = ['hub', 'wallet'];

/** Error thrown when a call targets a SubApp the subscription has not activated. */
export class BeZhasEntitlementError extends Error {
  constructor(subapp, active) {
    super(
      `SubApp "${subapp}" is not activated on this subscription. ` +
        `Active: ${[...active].join(', ') || '(none)'}. ` +
        `Activate it from your plan, or call subscription.activate("${subapp}").`,
    );
    this.name = 'BeZhasEntitlementError';
    this.code = 'ENTITLEMENT_REQUIRED';
    this.subapp = subapp;
  }
}

/**
 * Immutable-ish view of what a subscription allows. Construct from a backend
 * payload (fromApi) or locally (fromPlan) for offline gating in the widget/plugin.
 */
export class Entitlements {
  /** @param {Iterable<string>} subapps  SubApp ids the subscription grants. */
  constructor(subapps = []) {
    this.subapps = new Set([...CORE_SUBAPPS, ...subapps]);
  }

  /** True if the subscription may use this SubApp. */
  allows(subapp) {
    return this.subapps.has(subapp);
  }

  /** Sorted list (for display / discovery). */
  list() {
    return [...this.subapps].sort();
  }

  /** Build from the chosen add-ons of a plan (mirrors the activation calculator). */
  static fromPlan(_planId, chosenAddons = []) {
    return new Entitlements(chosenAddons);
  }

  /** Build from the backend /subscription payload ({ subapps: [...] } or { active: [...] }). */
  static fromApi(payload = {}) {
    const ids = payload.subapps || payload.active || payload.addons || [];
    return new Entitlements(ids);
  }
}

/**
 * client.subscription — manage the plan + which SubApps are active.
 * Wraps the gateway subscription endpoints (mirrored in registry.js → subscription).
 */
export class SubscriptionModule {
  /** @param {import('./client.js').BeZhasConnect} client */
  constructor(client) {
    this.client = client;
  }

  /** Current subscription: { plan, subapps, status, renewsAt, ... }. */
  get() {
    return this.client.request('GET', '/api/gateway/v1/subscription');
  }

  /**
   * Pull entitlements from the backend AND apply them to the client so every
   * subsequent service() call is gated. Returns the Entitlements built.
   */
  async sync() {
    const payload = await this.get();
    const ent = Entitlements.fromApi(payload);
    this.client.setEntitlements(ent);
    return ent;
  }

  /** Activate a SubApp on the subscription (adds it to the bill + entitlements). */
  activate(subapp) {
    if (!subapp) throw new TypeError('subscription.activate requires a subapp id.');
    return this.client.request('POST', '/api/gateway/v1/subscription/activate', {
      body: { subapp },
    });
  }

  /** Deactivate a SubApp (stops billing + access at the next cycle). */
  deactivate(subapp) {
    if (!subapp) throw new TypeError('subscription.deactivate requires a subapp id.');
    return this.client.request('POST', '/api/gateway/v1/subscription/deactivate', {
      body: { subapp },
    });
  }

  /**
   * Price a configuration without committing (server-side calc, mirrors the
   * Hub calculator). Safe to call before showing the customer a total.
   */
  quote({ planId, addons = [], annual = false } = {}) {
    return this.client.request('GET', '/api/gateway/v1/subscription/quote', {
      query: { plan: planId, addons: addons.join(','), annual: annual ? '1' : '0' },
    });
  }
}
