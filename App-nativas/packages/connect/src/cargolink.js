// CargoLink module — wraps the logistics surface (/api/cargolink).
//
// Two integration styles, both mirroring api/routes/cargolink.js:
//
//   1. POS bridge  — link the client's existing POS/ERP order API, then `sync`
//      pulls new orders and turns each into a B-UID transaction. The 3rd-party
//      platform keeps selling in its own UI; BeZhas mirrors the orders.
//
//   2. Direct      — create/advance B-UID transactions yourself (tx.*), push
//      IoT telemetry (iot.*), and register a signed webhook to get status back.
//
// CargoLink auth is a role-scoped key (pos | customs | carrier | logistics |
// lastmile), passed as the bearer. Pass it per-call as `roleKey`, or set it once
// via withRoleKey(). Admin key-management endpoints need a platform-admin JWT.

const BASE = '/api/cargolink';

export class CargoLinkModule {
  /**
   * @param {import('./index.js').BeZhasConnect} client
   * @param {string} [roleKey] Default role-scoped key (overridable per call).
   */
  constructor(client, roleKey = null) {
    this.client = client;
    this.roleKey = roleKey;
  }

  /** Return a module bound to a specific role-scoped key. */
  withRoleKey(roleKey) {
    return new CargoLinkModule(this.client, roleKey);
  }

  _auth(roleKey) {
    return { bearer: roleKey || this.roleKey || undefined };
  }

  /** Service health + which on-chain contracts are configured. Public. */
  health() {
    return this.client.request('GET', `${BASE}/health`);
  }

  // ── POS bridge ────────────────────────────────────────────────────────────

  /**
   * Link (or update) the caller's external POS so CargoLink can pull its orders.
   * @param {object} p
   * @param {string} p.baseUrl              POS API base (http/https).
   * @param {string} [p.provider='generic'] e.g. square | toast | shopify | sap.
   * @param {string} [p.ordersPath='/orders']
   * @param {string} [p.apiKey]             Credential CargoLink uses to call the POS.
   * @param {string} [roleKey]              Must be a pos/admin role key.
   */
  linkPos(p = {}, roleKey) {
    return this.client.request('POST', `${BASE}/v1/pos/link`, {
      body: { baseUrl: p.baseUrl, provider: p.provider, ordersPath: p.ordersPath, apiKey: p.apiKey },
      ...this._auth(roleKey),
    });
  }

  /** Read the current POS link (api key returned masked). */
  getPosLink(roleKey) {
    return this.client.request('GET', `${BASE}/v1/pos/link`, this._auth(roleKey));
  }

  /** Pull new orders from the linked POS -> create one B-UID each (idempotent). */
  syncOrders(roleKey) {
    return this.client.request('POST', `${BASE}/v1/pos/sync`, this._auth(roleKey));
  }

  // ── B-UID transaction lifecycle ─────────────────────────────────────────────

  /**
   * Create a B-UID transaction directly (an order/sale enters the network).
   * @param {object} tx  { posRef, origin, destination, cargo, escrowAmountBez, ... }
   * @param {string} [roleKey]
   */
  createTx(tx = {}, roleKey) {
    return this.client.request('POST', `${BASE}/v1/tx`, { body: tx, ...this._auth(roleKey) });
  }

  /** List the caller's transactions (their platform feed). */
  listTx(query = {}, roleKey) {
    return this.client.request('GET', `${BASE}/v1/tx`, { query, ...this._auth(roleKey) });
  }

  /** Read one B-UID plus its validation history. */
  getTx(bUid, roleKey) {
    return this.client.request('GET', `${BASE}/v1/tx/${bUid}`, this._auth(roleKey));
  }

  /** A role-scoped actor validates and advances the B-UID to its next state. */
  advanceTx(bUid, body = {}, roleKey) {
    return this.client.request('POST', `${BASE}/v1/tx/${bUid}/advance`, {
      body,
      ...this._auth(roleKey),
    });
  }

  // ── IoT / hardware ──────────────────────────────────────────────────────────

  /** Register a device; the device key is returned ONCE. */
  registerDevice(body = {}, roleKey) {
    return this.client.request('POST', `${BASE}/v1/iot/devices`, { body, ...this._auth(roleKey) });
  }

  /** Push a telemetry batch (authenticate with the device key as roleKey). */
  ingestTelemetry(body = {}, deviceKey) {
    return this.client.request('POST', `${BASE}/v1/iot/telemetry`, {
      body,
      ...this._auth(deviceKey),
    });
  }

  /** Read a shipment's live hardware feed. */
  getTelemetry(query = {}, roleKey) {
    return this.client.request('GET', `${BASE}/v1/iot/telemetry`, { query, ...this._auth(roleKey) });
  }

  // ── Webhooks (status back to the 3rd-party platform) ────────────────────────

  /**
   * Register a callback URL to receive signed status updates for your B-UIDs.
   * Verify deliveries with `import { webhooks } from '@bezhas/connect'`.
   * @param {object} body  { url, events?, secret? }
   * @param {string} [roleKey]
   */
  registerWebhook(body = {}, roleKey) {
    return this.client.request('POST', `${BASE}/v1/webhooks/register`, {
      body,
      ...this._auth(roleKey),
    });
  }
}
