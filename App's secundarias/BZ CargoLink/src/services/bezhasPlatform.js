const STORAGE_KEY = 'bezhas-cargolink-platform-v1'

const PLANS = {
  freemium: {
    id: 'freemium',
    name: 'Freemium API',
    monthlyPrice: 0,
    dailyCalls: 100,
    webhookLimit: 1,
    enabledSectors: ['cargo'],
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 9.99,
    dailyCalls: 500,
    webhookLimit: 3,
    enabledSectors: ['cargo', 'wallet', 'gas'],
  },
  business: {
    id: 'business',
    name: 'Business',
    monthlyPrice: 49.99,
    dailyCalls: 10000,
    webhookLimit: 25,
    enabledSectors: ['cargo', 'wallet', 'gas', 'edge', 'vision', 'capital', 'prestige'],
  },
}

const ENDPOINT_COSTS = {
  '/v1/customs/dispatch': 5,
  '/v1/shipping/stowage': 2,
  '/v1/logistics/route': 0.25,
  '/v1/logistics/active-route': 0.25,
  '/v1/audit/fingerprint': 3,
  '/v1/wallet/balance': 0,
  '/v1/gas/recharge': 1,
}

const ENDPOINT_SECTORS = {
  '/v1/customs/dispatch': 'cargo',
  '/v1/shipping/stowage': 'cargo',
  '/v1/logistics/route': 'cargo',
  '/v1/logistics/active-route': 'cargo',
  '/v1/audit/fingerprint': 'cargo',
}

const BLOCKCHAIN_EVENTS = {
  '/v1/customs/dispatch': 'CustomsCleared',
  '/v1/shipping/stowage': 'StowageValidated',
  '/v1/logistics/route': 'RouteTelemetryRead',
  '/v1/logistics/active-route': 'RouteTelemetryRead',
  '/v1/audit/fingerprint': 'FingerprintAnchored',
}

const todayKey = () => new Date().toISOString().slice(0, 10)

const createHash = (prefix = '0xBZ') => {
  const bytes = new Uint32Array(4)
  crypto.getRandomValues(bytes)
  return `${prefix}${Array.from(bytes).map(v => v.toString(16).padStart(8, '0')).join('')}`
}

const createApiKey = () => `bzk_live_${createHash('').slice(0, 32)}`

const defaultState = () => ({
  apiKey: createApiKey(),
  planId: 'freemium',
  freeQuotaDate: todayKey(),
  freeQuotaRemaining: PLANS.freemium.dailyCalls,
  bezBalance: 250,
  gasBalance: 80,
  webhookUrl: '',
  webhookEvents: ['ON_CUSTOMS_CLEARED', 'ON_DELIVERY_PROOF'],
  enabledSectors: PLANS.freemium.enabledSectors,
  ledger: [
    {
      id: crypto.randomUUID(),
      type: 'CREDIT_GRANTED',
      amount: 250,
      status: 'CONFIRMED',
      createdAt: new Date().toISOString(),
      txHash: createHash(),
      note: 'Initial CargoLink activation credit',
    },
  ],
  apiUsage: [],
  blocks: [],
})

const normalizeState = state => {
  const plan = PLANS[state.planId] || PLANS.freemium
  const next = {
    ...defaultState(),
    ...state,
    enabledSectors: plan.enabledSectors,
  }

  if (next.freeQuotaDate !== todayKey()) {
    next.freeQuotaDate = todayKey()
    next.freeQuotaRemaining = plan.dailyCalls
  }

  return next
}

const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return normalizeState(raw ? JSON.parse(raw) : defaultState())
  } catch {
    return defaultState()
  }
}

const saveState = state => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  window.dispatchEvent(new CustomEvent('bezhas-platform-updated', { detail: state }))
  return state
}

const appendLedger = (state, entry) => ({
  ...state,
  ledger: [
    {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      status: 'CONFIRMED',
      ...entry,
    },
    ...state.ledger,
  ].slice(0, 50),
})

const anchorBlock = (state, endpoint, payload, debitMode, debitAmount) => {
  const event = BLOCKCHAIN_EVENTS[endpoint] || 'ApiUsageAnchored'
  const block = {
    id: crypto.randomUUID(),
    txHash: createHash(),
    event,
    endpoint,
    payloadHash: createHash('0xPAY'),
    debitMode,
    debitAmount,
    createdAt: new Date().toISOString(),
    chain: 'BeZhas L2',
    blockNumber: 880000 + state.blocks.length + 1,
    payloadPreview: payload,
  }

  return {
    block,
    state: {
      ...state,
      blocks: [block, ...state.blocks].slice(0, 50),
    },
  }
}

const debitUsage = (state, endpoint) => {
  const cost = ENDPOINT_COSTS[endpoint] ?? 1
  const plan = PLANS[state.planId] || PLANS.freemium

  if (state.freeQuotaRemaining > 0) {
    return {
      state: {
        ...state,
        freeQuotaRemaining: state.freeQuotaRemaining - 1,
      },
      debitMode: 'FREEMIUM',
      debitAmount: 0,
      cost,
      plan,
    }
  }

  if (state.bezBalance < cost) {
    throw new Error(`Insufficient BEZ-Coin credits. Required ${cost} BEZ.`)
  }

  return {
    state: {
      ...state,
      bezBalance: Number((state.bezBalance - cost).toFixed(4)),
    },
    debitMode: 'BEZ_CREDIT',
    debitAmount: cost,
    cost,
    plan,
  }
}

const assertAccess = (state, endpoint, apiKey) => {
  if (apiKey && apiKey !== state.apiKey) {
    throw new Error('Invalid API key')
  }

  const sector = ENDPOINT_SECTORS[endpoint] || 'cargo'
  if (!state.enabledSectors.includes(sector)) {
    throw new Error(`Sector "${sector}" is not enabled for current plan`)
  }
}

const notifyWebhooks = (state, block) => {
  if (!state.webhookUrl) return []

  return state.webhookEvents.map(eventName => ({
    id: crypto.randomUUID(),
    url: state.webhookUrl,
    event: eventName,
    status: 'QUEUED',
    txHash: block.txHash,
  }))
}

export const bezhasPlatform = {
  plans: PLANS,
  endpointCosts: ENDPOINT_COSTS,

  getState() {
    return loadState()
  },

  reset() {
    return saveState(defaultState())
  },

  rotateApiKey() {
    const state = loadState()
    return saveState({ ...state, apiKey: createApiKey() })
  },

  registerWebhook(url, events = []) {
    if (!url || !/^https?:\/\//i.test(url)) {
      throw new Error('Webhook URL must start with http:// or https://')
    }

    const state = loadState()
    const plan = PLANS[state.planId] || PLANS.freemium
    const selectedEvents = events.length ? events : state.webhookEvents
    if (selectedEvents.length > plan.webhookLimit) {
      throw new Error(`Current plan allows ${plan.webhookLimit} webhook event(s)`)
    }

    return saveState({
      ...state,
      webhookUrl: url,
      webhookEvents: selectedEvents,
    })
  },

  buyBezCredits(amount) {
    const credits = Number(amount)
    if (!Number.isFinite(credits) || credits <= 0) {
      throw new Error('BEZ amount must be greater than zero')
    }

    let state = loadState()
    const txHash = createHash()
    state = appendLedger(
      {
        ...state,
        bezBalance: Number((state.bezBalance + credits).toFixed(4)),
      },
      {
        type: 'BEZ_COIN_PURCHASE',
        amount: credits,
        txHash,
        note: `Purchased ${credits} BEZ-Coin credits`,
      }
    )
    return saveState(state)
  },

  rechargeGas(amount) {
    const credits = Number(amount)
    if (!Number.isFinite(credits) || credits <= 0) {
      throw new Error('Gas amount must be greater than zero')
    }

    let state = loadState()
    state = appendLedger(
      {
        ...state,
        gasBalance: Number((state.gasBalance + credits).toFixed(4)),
      },
      {
        type: 'GAS_RECHARGE',
        amount: credits,
        txHash: createHash(),
        note: 'Gas Tank recharge for L2 transaction fees',
      }
    )
    return saveState(state)
  },

  subscribe(planId) {
    const plan = PLANS[planId]
    if (!plan) throw new Error('Unknown subscription plan')

    let state = loadState()
    state = appendLedger(
      {
        ...state,
        planId,
        enabledSectors: plan.enabledSectors,
        freeQuotaDate: todayKey(),
        freeQuotaRemaining: plan.dailyCalls,
      },
      {
        type: 'PLAN_ACTIVATED',
        amount: plan.monthlyPrice,
        txHash: createHash(),
        note: `${plan.name} enabled with ${plan.dailyCalls} API calls/day`,
      }
    )
    return saveState(state)
  },

  validateContract(address) {
    if (!/^0x[a-fA-F0-9]{4,}/.test(address || '')) {
      throw new Error('Invalid L2 contract address')
    }

    let state = loadState()
    const { block, state: anchored } = anchorBlock(state, 'contract.validate', { address }, 'FREEMIUM', 0)
    state = appendLedger(anchored, {
      type: 'CONTRACT_VALIDATED',
      amount: 0,
      txHash: block.txHash,
      note: `Contract ${address} validated on BeZhas L2`,
    })
    return saveState(state)
  },

  stakeBez(amount) {
    const credits = Number(amount)
    let state = loadState()
    if (!Number.isFinite(credits) || credits <= 0) throw new Error('Stake amount must be greater than zero')
    if (state.bezBalance < credits) throw new Error('Insufficient BEZ-Coin balance')

    state = appendLedger(
      {
        ...state,
        bezBalance: Number((state.bezBalance - credits).toFixed(4)),
      },
      {
        type: 'BEZ_STAKED',
        amount: credits,
        txHash: createHash(),
        note: 'BEZ staked into CargoLink validator pool',
      }
    )
    return saveState(state)
  },

  callApi({ method = 'POST', endpoint, payload = {}, apiKey } = {}) {
    let state = loadState()
    assertAccess(state, endpoint, apiKey)

    const debit = debitUsage(state, endpoint)
    const { block, state: anchored } = anchorBlock(debit.state, endpoint, payload, debit.debitMode, debit.debitAmount)
    const usage = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      method,
      endpoint,
      cost: debit.cost,
      debitMode: debit.debitMode,
      debitAmount: debit.debitAmount,
      txHash: block.txHash,
      status: '200_OK',
    }

    state = appendLedger(
      {
        ...anchored,
        apiUsage: [usage, ...anchored.apiUsage].slice(0, 100),
      },
      {
        type: 'API_USAGE',
        amount: debit.debitAmount,
        txHash: block.txHash,
        note: `${method} ${endpoint} via ${debit.debitMode}`,
      }
    )

    const webhookDeliveries = notifyWebhooks(state, block)
    state = saveState(state)

    return {
      ok: true,
      status: 200,
      endpoint,
      result: buildEndpointResult(endpoint, payload, block),
      billing: {
        mode: debit.debitMode,
        chargedBez: debit.debitAmount,
        freeQuotaRemaining: state.freeQuotaRemaining,
        bezBalance: state.bezBalance,
      },
      blockchain: block,
      webhookDeliveries,
    }
  },
}

const buildEndpointResult = (endpoint, payload, block) => {
  switch (endpoint) {
    case '/v1/audit/fingerprint':
      return {
        bUid: payload.bUid || 'BZ-LOG-ES-17148',
        fingerprintHash: block.payloadHash,
        integrity: 'VERIFIED',
        mseDeviation: 4.2,
        escrowState: 'FUNDS_LOCKED',
      }
    case '/v1/shipping/stowage':
      return {
        bUid: payload.bUid || 'BZ-LOG-ES-17148',
        cog: payload.cog,
        status: payload.cog?.x > 55 ? 'WARNING' : 'VERIFIED',
        dNftState: 'STOWAGE_SYNCED',
      }
    case '/v1/customs/dispatch':
      return {
        authorization: `BZ-ASY-${String(block.blockNumber).slice(-6)}`,
        lane: 'GREEN_LANE',
        standard: 'UBL_2_1',
        oracle: 'CHAINLINK_FUNCTIONS',
      }
    case '/v1/logistics/route':
    case '/v1/logistics/active-route':
      return {
        routeId: payload.routeId || 'TRX-9921-X',
        status: 'IN_TRANSIT',
        progress: 82,
        etaMinutes: 11,
      }
    default:
      return {
        accepted: true,
        payloadHash: block.payloadHash,
      }
  }
}

export const createCargoLinkSdk = apiKey => ({
  auditFingerprint: payload => bezhasPlatform.callApi({ method: 'POST', endpoint: '/v1/audit/fingerprint', payload, apiKey }),
  validateStowage: payload => bezhasPlatform.callApi({ method: 'POST', endpoint: '/v1/shipping/stowage', payload, apiKey }),
  dispatchCustoms: payload => bezhasPlatform.callApi({ method: 'POST', endpoint: '/v1/customs/dispatch', payload, apiKey }),
  getActiveRoute: payload => bezhasPlatform.callApi({ method: 'GET', endpoint: '/v1/logistics/route', payload, apiKey }),
})
