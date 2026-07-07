// Capability Registry — the "marketplace manifest" of BeZhas SubApp services.
//
// This is the keystone of the integration model: a third-party platform does NOT
// need a bespoke client class per SubApp. Each SubApp declares its callable
// actions here (method + path + required params + auth mode), and the generic
// ServiceModule (service.js) invokes any of them uniformly:
//
//     bezhas.service('pay').call('buy', { amountUSD: 49.9, paymentMethod: 'card' })
//     bezhas.service('cargolink').call('getTx', { bUid: 'B-123', roleKey })
//
// Adding a new SubApp to the whole ecosystem = adding a descriptor block here.
// No new code in the client, the SDK, or the 3rd-party's integration.
//
// Descriptor shape:
//   {
//     baseUrl: '/api/...',          // path prefix shared by the SubApp's actions
//     auth: 'apiKey'|'roleKey'|'public',  // default auth for the SubApp
//     label: 'Human name',          // shown in capabilities() discovery
//     actions: {
//       <name>: {
//         method: 'GET'|'POST'|'PUT'|'DELETE',
//         path: '/sub/:param/path',  // ':param' is substituted from call params
//         required: ['a','b'],        // params that must be present (throws if missing)
//         auth: '<override>',         // optional per-action auth override
//         description: '...'          // optional, for discovery
//       }
//     }
//   }
//
// Paths + params mirror the real backend routes (api/routes/*.js) exactly, so the
// registry is the single source of truth shared by Pay/CargoLink wrappers too.

export const REGISTRY = {
  // ── Pay — fiat/crypto on-ramp + BezPay transfers (api/routes/gateway.js) ──────
  pay: {
    baseUrl: '/api/gateway/v1',
    auth: 'apiKey',
    label: 'BeZhas Pay',
    actions: {
      buy: {
        method: 'POST', path: '/payments/buy',
        required: ['amountUSD', 'paymentMethod'],
        description: 'Initiate a BEZ purchase (card→Stripe URL, bank→IBAN, crypto/qr).',
      },
      sell: {
        method: 'POST', path: '/payments/sell',
        required: ['walletAddress', 'amountBEZ', 'receiveMethod'],
        description: 'Sell BEZ back to fiat/crypto.',
      },
      send: {
        method: 'POST', path: '/payments/send',
        required: ['sender', 'recipient', 'amount'],
        description: 'BezPay peer transfer in BEZ.',
      },
      getPayment: {
        method: 'GET', path: '/payments/:paymentId',
        required: ['paymentId'],
        description: 'Poll one order: status, settlement, on-chain instructions, expiry.',
      },
      history: {
        method: 'GET', path: '/payments/history/:address',
        required: ['address'],
        description: 'Payment history for a wallet (newest first).',
      },
      tokenomics: {
        method: 'GET', path: '/payments/tokenomics',
        description: 'Fee + tokenomics breakdown for an amount (no side effects).',
      },
      stripeLinks: {
        method: 'GET', path: '/payments/stripe-links',
        description: 'Available Stripe payment links (card use-cases).',
      },
      bankTransferDetails: {
        method: 'GET', path: '/payments/bank-transfer-details',
        description: 'SEPA/SWIFT beneficiary details.',
      },
      price: {
        method: 'GET', path: '/token/price',
        description: 'Live or cached BEZ price in USD.',
      },
    },
  },

  // ── CargoLink — logistics B-UID lifecycle + IoT (api/routes/cargolink.js) ─────
  cargolink: {
    baseUrl: '/api/cargolink',
    auth: 'roleKey',
    label: 'BZ CargoLink',
    actions: {
      health: { method: 'GET', path: '/health', auth: 'public', description: 'Service health + configured contracts.' },
      linkPos: { method: 'POST', path: '/v1/pos/link', required: ['baseUrl'], description: 'Link an external POS so CargoLink can pull its orders.' },
      getPosLink: { method: 'GET', path: '/v1/pos/link', description: 'Read the current POS link (key masked).' },
      syncOrders: { method: 'POST', path: '/v1/pos/sync', description: 'Pull new POS orders → one B-UID each (idempotent).' },
      createTx: { method: 'POST', path: '/v1/tx', description: 'Create a B-UID transaction directly.' },
      listTx: { method: 'GET', path: '/v1/tx', description: 'List the caller transactions (their feed).' },
      getTx: { method: 'GET', path: '/v1/tx/:bUid', required: ['bUid'], description: 'Read one B-UID + validation history.' },
      advanceTx: { method: 'POST', path: '/v1/tx/:bUid/advance', required: ['bUid'], description: 'Validate + advance a B-UID to its next state.' },
      registerDevice: { method: 'POST', path: '/v1/iot/devices', description: 'Register an IoT device (key returned once).' },
      ingestTelemetry: { method: 'POST', path: '/v1/iot/telemetry', description: 'Push a telemetry batch (auth with device key).' },
      getTelemetry: { method: 'GET', path: '/v1/iot/telemetry', description: 'Read a shipment live hardware feed.' },
      registerWebhook: { method: 'POST', path: '/v1/webhooks/register', description: 'Register a signed status-callback URL.' },
    },
  },

  // ── Subscription & entitlements — which SubApps the plan activates ───────────
  // Infra SubApp (never entitlement-gated): a client can always read/manage its
  // own subscription. Mirrors api/routes/gateway.js subscription endpoints.
  subscription: {
    baseUrl: '/api/gateway/v1',
    auth: 'apiKey',
    label: 'Suscripción & Entitlements',
    actions: {
      get: { method: 'GET', path: '/subscription', description: 'Plan actual + SubApps activas (entitlements).' },
      quote: { method: 'GET', path: '/subscription/quote', description: 'Cotiza plan+addons sin comprometer (mismo cálculo que la landing).' },
      activate: { method: 'POST', path: '/subscription/activate', required: ['subapp'], description: 'Activa una SubApp (añade a factura + entitlements).' },
      deactivate: { method: 'POST', path: '/subscription/deactivate', required: ['subapp'], description: 'Desactiva una SubApp al próximo ciclo.' },
    },
  },

  // ── Energy (VPP) — read-only surface today (api/routes/energy.js) ─────────────
  // Seeded so the generic path works for Energy the moment the backend confirms
  // these endpoints; extend `actions` as routes are verified.
  energy: {
    baseUrl: '/api/energy',
    auth: 'apiKey',
    label: 'BeZhas Energy (VPP)',
    actions: {
      assets: { method: 'GET', path: '/assets', description: 'List registered energy assets.' },
      price: { method: 'GET', path: '/price', description: 'Current spot/market price (OMIE feed).' },
      telemetry: { method: 'GET', path: '/telemetry', description: 'Live generation/consumption feed.' },
    },
  },
};

/**
 * Look up a SubApp descriptor. Throws a clear error listing the known SubApps if
 * the name is not registered — so a typo fails loudly at call time, not silently.
 * @param {string} name
 */
export function getSubAppDescriptor(name) {
  const d = REGISTRY[name];
  if (!d) {
    throw new Error(
      `Unknown BeZhas SubApp "${name}". Registered: ${Object.keys(REGISTRY).join(', ')}.`,
    );
  }
  return d;
}

/**
 * Flat, serializable view of every SubApp + action — for discovery / docs /
 * an embeddable "what can I call?" panel. No secrets, safe to expose.
 */
export function listCapabilities() {
  return Object.entries(REGISTRY).map(([subapp, d]) => ({
    subapp,
    label: d.label,
    auth: d.auth,
    actions: Object.entries(d.actions).map(([action, a]) => ({
      action,
      method: a.method,
      path: d.baseUrl + a.path,
      required: a.required || [],
      auth: a.auth || d.auth,
      description: a.description || '',
    })),
  }));
}
