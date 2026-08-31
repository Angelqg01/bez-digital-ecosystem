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

  // ── Energy (VPP) — api/routes/energy.js (JWT bearer) ─────────────────────────
  energy: {
    baseUrl: '/api/energy',
    auth: 'bearer',
    label: 'BeZhas Energy (VPP)',
    actions: {
      telemetry: { method: 'GET', path: '/telemetry', description: 'Live node telemetry feed.' },
      nodes: { method: 'GET', path: '/nodes', description: 'Registered energy nodes.' },
      omie: { method: 'GET', path: '/market/omie', description: 'OMIE spot market price feed.' },
      alerts: { method: 'GET', path: '/alerts', description: 'Aegis anomaly alerts for the VPP.' },
      arbitrageStatus: { method: 'GET', path: '/arbitrage/status', description: 'Battery arbitrage agent status.' },
      arbitragePnl: { method: 'GET', path: '/arbitrage/pnl', description: 'Arbitrage running P&L.' },
    },
  },

  // ── Wallet — balances + history via the gateway (api/routes/gateway.js) ──────
  wallet: {
    baseUrl: '/api/gateway/v1',
    auth: 'apiKey',
    label: 'BEZ Wallet',
    actions: {
      balance: { method: 'GET', path: '/wallet/balance/:address', required: ['address'], description: 'Native + BEZ balance of a wallet.' },
      me: { method: 'GET', path: '/wallet/me', description: 'Primary wallet of the authenticated session.' },
      history: { method: 'GET', path: '/wallet/history/:address', required: ['address'], description: 'Transaction history of a wallet.' },
    },
  },

  // ── Capital — DeFi: staking, farming, DAO, DEX, treasury, bridge (gateway) ───
  capital: {
    baseUrl: '/api/gateway/v1',
    auth: 'apiKey',
    label: 'BZ Capital (DeFi)',
    actions: {
      stakingPositions: { method: 'GET', path: '/staking/positions/:address', required: ['address'], description: 'Staking positions of a wallet.' },
      stake: { method: 'POST', path: '/staking/stake', required: ['amount'], description: 'Stake BEZ (returns unsigned tx).' },
      unstake: { method: 'POST', path: '/staking/unstake', required: ['amount'], description: 'Unstake BEZ.' },
      farmingPositions: { method: 'GET', path: '/farming/positions/:address', required: ['address'], description: 'LP farming positions.' },
      farmingDeposit: { method: 'POST', path: '/farming/deposit', required: ['amount'], description: 'Deposit LP tokens into a farm.' },
      proposals: { method: 'GET', path: '/governance/proposals', description: 'DAO proposals.' },
      vote: { method: 'POST', path: '/governance/vote', required: ['proposalId', 'support'], description: 'Cast a DAO vote.' },
      dexPool: { method: 'GET', path: '/dex/pool', description: 'Native BEZ/USDC pool state.' },
      dexQuote: { method: 'GET', path: '/dex/quote', description: 'Swap quote from the native DEX.' },
      dexSwap: { method: 'POST', path: '/dex/swap', required: ['amountIn'], description: 'Swap on the native DEX (unsigned tx).' },
      treasury: { method: 'GET', path: '/treasury/overview', description: 'DAO treasury overview.' },
      bridgeTransfers: { method: 'GET', path: '/bridge/transfers/:address', required: ['address'], description: 'Cross-chain bridge transfers of a wallet.' },
      bridgeInitiate: { method: 'POST', path: '/bridge/initiate', required: ['amount', 'targetChain'], description: 'Start a cross-chain transfer.' },
    },
  },

  // ── Gas — sponsorship/relayer status (api/routes/gas.js) ─────────────────────
  gas: {
    baseUrl: '/api/gas',
    auth: 'bearer',
    label: 'BeZhas Gas',
    actions: {
      status: { method: 'GET', path: '/status', auth: 'public', description: 'Gas tank / relayer status.' },
      balances: { method: 'GET', path: '/balances', description: 'Sponsored gas balances (admin/enterprise JWT).' },
    },
  },

  // ── Genesis — validators & network genesis (api/routes/validators.js) ────────
  genesis: {
    baseUrl: '/api/validators',
    auth: 'public',
    label: 'BZ Genesis (Validators)',
    actions: {
      list: { method: 'GET', path: '/', description: 'Registered validators.' },
      tiers: { method: 'GET', path: '/tiers', description: 'Validator tier definitions.' },
      stats: { method: 'GET', path: '/stats', description: 'Network validator stats.' },
      validator: { method: 'GET', path: '/:address', required: ['address'], description: 'One validator profile.' },
      rewards: { method: 'GET', path: '/:address/rewards', required: ['address'], description: 'Validator reward history.' },
    },
  },

  // ── Hub — public platform surface ─────────────────────────────────────────────
  hub: {
    baseUrl: '/api',
    auth: 'public',
    label: 'BeZhas Hub',
    actions: {
      networkStats: { method: 'GET', path: '/gateway/v1/network/stats', description: 'Public network stats (landing).' },
      marketStats: { method: 'GET', path: '/market/stats', description: 'Market stats.' },
    },
  },

  // ── SubApps served from their own deployments ────────────────────────────────
  // Registered so `service('<name>')` resolves and discovery lists the full
  // ecosystem; callable actions land here when the gateway proxies them (their
  // APIs currently run on the SubApp's own subdomain).
  vision: { baseUrl: '/api/vision', auth: 'apiKey', label: 'BeZhas Vision', external: 'https://vision.bez.digital', actions: {} },
  purescan: { baseUrl: '/api/purescan', auth: 'apiKey', label: 'BZ PureScan', external: 'https://purescan.bez.digital', actions: {} },
  // ── OPERANT — gestión empresarial autónoma (api/routes/operant.js) ──────────
  // Los agentes corren en el runtime de OPERANT, pero el contrato es el del
  // Gateway: api-key de la app, entitlements del plan y consumo facturado.
  operant: {
    baseUrl: '/api/operant',
    auth: 'apiKey',
    label: 'OPERANT — Gestión Empresarial Autónoma',
    actions: {
      catalog: { method: 'GET', path: '/catalog', auth: 'public', description: 'Departamentos, capacidades por plan y tarifas.' },
      health: { method: 'GET', path: '/health', auth: 'public', description: 'Estado del runtime de agentes.' },
      entitlements: { method: 'GET', path: '/entitlements', description: 'Qué desbloquea el plan de esta app (no gateado: sirve el upsell).' },
      departments: { method: 'GET', path: '/departments', description: 'Departamentos disponibles + precio por tarea.' },
      provision: { method: 'POST', path: '/tenants/provision', description: 'Alta/reconfiguración del tenant con los límites del plan.' },
      tenant: { method: 'GET', path: '/tenants/me', description: 'Configuración del tenant de esta app.' },
      run: { method: 'POST', path: '/tasks', required: ['department', 'input'], description: 'Lanza una tarea a un departamento.' },
      getTask: { method: 'GET', path: '/tasks/:taskId', required: ['taskId'], description: 'Estado, salida y coste de una tarea.' },
      approvals: { method: 'GET', path: '/approvals', description: 'Cola de aprobaciones humanas (HITL).' },
      resolveApproval: { method: 'POST', path: '/approvals/:approvalId', required: ['approvalId', 'decision'], description: 'Aprueba o rechaza una acción retenida.' },
      usage: { method: 'GET', path: '/usage', description: 'Cuota, overage y coste del ciclo en curso.' },
      anchorAudit: { method: 'POST', path: '/audit/anchor', description: 'Ancla en L2 la raíz merkle del tramo de auditoría pendiente.' },
      verifyAudit: { method: 'GET', path: '/audit/verify', description: 'Integridad de la cadena de auditoría + anclas on-chain.' },
      auditProof: { method: 'GET', path: '/audit/proof/:auditHash', required: ['auditHash'], description: 'Prueba de inclusión de un registro contra su ancla.' },
    },
  },

  sphere: { baseUrl: '/api/sphere', auth: 'apiKey', label: 'BZ Sphere', external: 'https://sphere.bez.digital', actions: {} },
  prestige: { baseUrl: '/api/prestige', auth: 'apiKey', label: 'BZ Prestige', external: 'https://prestige.bez.digital', actions: {} },
  edge: { baseUrl: '/api/edge', auth: 'apiKey', label: 'BeZhas Edge', external: 'https://edge.bez.digital', actions: {} },
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
    external: d.external || undefined,
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
