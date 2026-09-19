/**
 * BeZhas Blockchain — Payment Webhooks v3 (Production-Grade)
 * ─────────────────────────────────────────────────────────────
 * CORRECCIONES v3 sobre la versión anterior (ya optimizada):
 *
 *  [SEC-1]  HMAC timing-safe  → crypto.timingSafeEqual() (antes: !== string)
 *  [SEC-2]  /bank falla loud  → rechaza pagos no-USD hasta tener FX real
 *  [PERF-1] Singleton chain   → Provider/Wallet/Contract instanciados una vez
 *  [PERF-2] decimals cacheado → 1 RPC call total, nunca más
 *  [PERF-3] Nonce manager     → cola serializada evita nonce collision en concurrencia
 *  [REL-1]  tx.wait() timeout → Promise.race() a 3 min, no cuelga forever
 *  [REL-2]  EIP-1559 gas      → getFeeData() dinámico en lugar de gasLimit fijo solo
 *  [REL-3]  Retry queue       → cola PERSISTENTE en Postgres con backoff exponencial
 *                               (services/webhookRetryQueue.js, migración 034).
 *                               Antes era un array del proceso: cada redespliegue
 *                               de Cloud Run perdía los pagos cobrados sin entregar.
 *  [LED-1]  Libro mayor       → los cobros de Stripe entran en payment_transactions,
 *                               lo que permite marcar fallidos y reembolsar (antes
 *                               eran dos TODO sin tabla donde escribir).
 *  [MEM-1]  TTL idempotency   → Map con timestamp + limpieza cada hora (antes: Set infinito)
 *  [CFG-1]  MINT_GAS_LIMIT    → parseado con try/catch (antes: BigInt() en module scope)
 *  [CFG-2]  contractAddress   → validado con ethers.isAddress() antes de instanciar
 *  [LOG-1]  Logger estructurado → pino-compatible con nivel, módulo, timestamp
 */

'use strict';

const express = require('express');
const router = express.Router();
// Perezoso a propósito. Construir el cliente aquí arriba con
// `require('stripe')(process.env.STRIPE_SECRET_KEY)` hacía que TODA la API
// muriese al importar si faltaba la clave —"Neither apiKey nor
// config.authenticator provided"—, aunque el resto de la plataforma no tenga
// nada que ver con los pagos. Ahora falta la clave => falla el webhook de
// Stripe, y solo ese.
let _stripe = null;
function getStripe() {
  if (_stripe) return _stripe;
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe no configurado: falta STRIPE_SECRET_KEY');
  }
  _stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  return _stripe;
}
const { ethers } = require('ethers');
const crypto = require('crypto');
const fxService = require('../services/fxService');
const { query } = require('../db/pool');
const { getPlan } = require('../config/plans');
const { centimosUsdABezWei, precioUsd } = require('../config/bez-price');
const retryQueue = require('../services/webhookRetryQueue');
const ledger = require('../services/providerPaymentLedger');
const { refundPayment, SettlementError } = require('../services/paymentSettlement');

// ═══════════════════════════════════════════════
// LOGGER ESTRUCTURADO [LOG-1]
// Drop-in compatible con pino / winston.
// En producción: npm install pino y reemplazar esta clase.
// ═══════════════════════════════════════════════
const LOG_LEVEL_RANK = { debug: 0, info: 1, warn: 2, error: 3 };
const CURRENT_LEVEL = LOG_LEVEL_RANK[process.env.LOG_LEVEL] ?? 1;

const log = {
  _emit(level, module, msg, meta = {}) {
    if (LOG_LEVEL_RANK[level] < CURRENT_LEVEL) return;
    const entry = {
      ts: new Date().toISOString(),
      level,
      module,
      msg,
      ...meta,
    };
    // pino writes JSON lines; winston writes structured objects.
    // This mirrors that pattern so swapping is a 1-line change.
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    fn(JSON.stringify(entry));
  },
  debug: (mod, msg, meta) => log._emit('debug', mod, msg, meta),
  info: (mod, msg, meta) => log._emit('info', mod, msg, meta),
  warn: (mod, msg, meta) => log._emit('warn', mod, msg, meta),
  error: (mod, msg, meta) => log._emit('error', mod, msg, meta),
};

// ═══════════════════════════════════════════════
// CONFIG [CFG-1] — parseo seguro de todos los valores
// ═══════════════════════════════════════════════
function parseMintGasLimit() {
  try {
    const raw = process.env.MINT_GAS_LIMIT || '200000';
    const n = BigInt(raw);
    if (n <= 0n) throw new Error('Must be positive');
    return n;
  } catch (e) {
    log.warn('Config', 'Invalid MINT_GAS_LIMIT, using default 200000', { error: e.message });
    return 200000n;
  }
}

const CONFIG = Object.freeze({
  // BEZ-Coin v1: vive SÓLO en Polygon (0xEcBa…11A8). En BSC no hay contrato BEZ.
  bezContractAddress: process.env.BEZ_TOKEN_ADDRESS ?? '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
  treasuryPk: process.env.BEZ_TREASURY_PK || process.env.ADMIN_PK || '',
  rpcUrl: process.env.RPC_URL || 'https://rpc-amoy.polygon.technology',
  // FX: EUR→USD for European-region settlements. Explicit & configurable — never
  // a silent 1:1. Replace with a live oracle feed when available.
  eurUsdRate: parseFloat(process.env.EUR_USD_RATE || '1.08'),
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  bankWebhookSecret: process.env.BANK_WEBHOOK_SECRET ?? '',
  mintGasLimit: parseMintGasLimit(),
  // Timeout for tx.wait() in ms — default 3 minutes [REL-1]
  txWaitTimeoutMs: parseInt(process.env.TX_WAIT_TIMEOUT_MS || '180000', 10),
  // Retry queue: max attempts, base delay ms [REL-3]
  retryMaxAttempts: parseInt(process.env.RETRY_MAX_ATTEMPTS || '5', 10),
  retryBaseDelayMs: parseInt(process.env.RETRY_BASE_DELAY_MS || '2000', 10),
  // TTL for processed-events cache in ms — default 48h [MEM-1]
  idempotencyTtlMs: parseInt(process.env.IDEMPOTENCY_TTL_MS || String(48 * 60 * 60 * 1000), 10),
});

// ── Validate required config at startup ──────
function validateConfig() {
  const checks = [
    ['bezContractAddress', CONFIG.bezContractAddress, () => ethers.isAddress(CONFIG.bezContractAddress)],
    // La clave de minteo sólo se valida si la vía antigua está encendida a propósito.
    ...(process.env.LEGACY_HOT_MINT_ENABLED === 'true'
      ? [['treasuryPk', CONFIG.treasuryPk, () => CONFIG.treasuryPk.startsWith('0x') && CONFIG.treasuryPk.length === 66]]
      : []),
    ['stripeWebhookSecret', CONFIG.stripeWebhookSecret, () => CONFIG.stripeWebhookSecret.startsWith('whsec_')],
  ];

  for (const [name, value, validate] of checks) {
    if (!value || !validate()) {
      log.error('Config', `Invalid or missing: ${name}`, { value: value ? '[SET_BUT_INVALID]' : '[MISSING]' });
    }
  }

  if (!CONFIG.bankWebhookSecret) {
    log.warn('Config', 'BANK_WEBHOOK_SECRET not set — /bank endpoint rechazará todas las peticiones (503)');
  }
}
validateConfig();

// ABI mínimo — sólo funciones realmente usadas
const BEZ_MINIMAL_ABI = [
  'function mint(address to, uint256 amount) external',
  'function decimals() view returns (uint8)',
];

// ═══════════════════════════════════════════════
// SINGLETON BLOCKCHAIN LAYER [PERF-1]
// Provider, Wallet y Contract se instancian UNA sola vez
// y se reutilizan en todas las llamadas.
// ═══════════════════════════════════════════════
let _provider = null;
let _wallet = null;
let _contract = null;

function getBlockchainSingletons() {
  if (_contract) return { provider: _provider, wallet: _wallet, contract: _contract };

  if (!ethers.isAddress(CONFIG.bezContractAddress)) {  // [CFG-2]
    throw new Error(`BEZ_TOKEN_ADDRESS is not a valid Ethereum address: "${CONFIG.bezContractAddress}"`);
  }
  if (!CONFIG.treasuryPk) {
    throw new Error('BEZ_TREASURY_PK / ADMIN_PK is not set');
  }

  _provider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);
  _wallet = new ethers.Wallet(CONFIG.treasuryPk, _provider);
  _contract = new ethers.Contract(CONFIG.bezContractAddress, BEZ_MINIMAL_ABI, _wallet);

  log.info('Chain', 'Blockchain singletons initialised', {
    address: CONFIG.bezContractAddress,
    rpc: CONFIG.rpcUrl,
    wallet: _wallet.address,
  });

  return { provider: _provider, wallet: _wallet, contract: _contract };
}

// ═══════════════════════════════════════════════
// DECIMALS CACHE [PERF-2]
// ERC-20 decimals NUNCA cambian. 1 RPC call total en la vida del proceso.
// ═══════════════════════════════════════════════
let _cachedDecimals = null;

async function getDecimals() {
  if (_cachedDecimals !== null) return _cachedDecimals;
  const { contract } = getBlockchainSingletons();
  _cachedDecimals = Number(await contract.decimals());
  log.info('Chain', 'Decimals cached', { decimals: _cachedDecimals });
  return _cachedDecimals;
}

// ═══════════════════════════════════════════════
// NONCE MANAGER [PERF-3]
// Serializa todos los mints en una cola FIFO.
// Evita nonce collision cuando varios webhooks llegan en paralelo.
// ═══════════════════════════════════════════════
const NonceManager = (() => {
  let _queue = Promise.resolve();
  let _nonce = null;          // null = not yet fetched

  /**
   * Encola una operación de minting. La cola garantiza ejecución secuencial.
   * @param {function} mintFn - async () => any
   */
  function enqueue(mintFn) {
    _queue = _queue.then(mintFn).catch((err) => {
      // Reset nonce on error so next TX re-fetches from chain
      _nonce = null;
      throw err;
    });
    return _queue;
  }

  /**
   * Obtiene el próximo nonce. Primer call = fetch de chain. Luego: incremento local.
   */
  async function nextNonce(wallet) {
    if (_nonce === null) {
      _nonce = await wallet.getNonce('pending');
      log.debug('Nonce', 'Fetched from chain', { nonce: _nonce });
    }
    const n = _nonce;
    _nonce++;
    return n;
  }

  /**
   * Fuerza re-fetch del nonce (llamar tras error de TX con código NONCE_EXPIRED).
   */
  function resetNonce() { _nonce = null; }

  return { enqueue, nextNonce, resetNonce };
})();

// ═══════════════════════════════════════════════
// TTL-BASED IDEMPOTENCY [MEM-1]
// Map<eventId, { ts: timestamp }> con limpieza periódica.
// Evita que el Set crezca indefinidamente en servidores de larga vida.
// ═══════════════════════════════════════════════
const processedEvents = new Map();

// Limpieza horaria — elimina entradas más antiguas que TTL
const _cleanupTimer = setInterval(() => {
  const cutoff = Date.now() - CONFIG.idempotencyTtlMs;
  let removed = 0;
  for (const [id, { ts }] of processedEvents) {
    if (ts < cutoff) { processedEvents.delete(id); removed++; }
  }
  if (removed > 0) {
    log.debug('Idempotency', 'Cleaned expired entries', { removed, remaining: processedEvents.size });
  }
}, 60 * 60 * 1000);

// Permite que el proceso termine limpiamente sin bloquear el event loop
_cleanupTimer.unref();

// ═══════════════════════════════════════════════
// RETRY QUEUE [REL-3]
// Cola en memoria con backoff exponencial.
// En producción: reemplazar con BullMQ + Redis para persistencia.
//   npm install bullmq ioredis
//   const { Queue } = require('bullmq');
//   const mintQueue = new Queue('bez-mint', { connection: redisClient });
//   mintQueue.add('mint', payload, { attempts: 5, backoff: { type: 'exponential', delay: 2000 } });
// ═══════════════════════════════════════════════
const RetryQueue = (() => {
  // La cola vive ahora en Postgres (services/webhookRetryQueue.js, migración 034).
  // Antes era un array de este proceso: cada redespliegue de Cloud Run perdía en
  // silencio los pagos ya cobrados a los que faltaba entregar el BEZ.
  //
  // Se conserva esta fachada para no cambiar los puntos de llamada, que siguen
  // haciendo `RetryQueue.enqueue(wallet, cents, eventId)`.
  retryQueue.registerHandler('mint', async ({ walletAddress, amountUsdCents, eventId }) => {
    const result = await _executeMint(walletAddress, amountUsdCents, eventId);
    await recordMintInLedger({ walletAddress, amountUsdCents, eventId, result });
    return result;
  });

  // La cola de memoria se procesaba sola al encolar. La persistente necesita que
  // alguien mire la tabla, así que el tick arranca aquí: sin esto los trabajos
  // quedarían guardados y nadie los reintentaría nunca. El temporizador está
  // unref'd, de modo que no mantiene vivo el proceso por sí solo.
  retryQueue.start();

  function enqueue(walletAddress, amountUsdCents, eventId, lastError = null) {
    return retryQueue
      .enqueue({ kind: 'mint', eventId, walletAddress, amountUsdCents, lastError })
      .then((job) => {
        log.info('RetryQueue', 'Job persisted', { eventId, jobId: job && job.id });
        return job;
      })
      .catch((err) => {
        // Si ni siquiera se puede encolar, hay que gritarlo: es un pago cobrado
        // que se queda sin entregar y sin registro de reintento.
        log.error('RetryQueue', 'No se pudo persistir el reintento', {
          eventId, wallet: walletAddress, error: err.message,
        });
        return null;
      });
  }

  return { enqueue, processDueJobs: retryQueue.processDueJobs, start: retryQueue.start };
})();

/**
 * Deja constancia del minteo en payment_transactions. Un fallo aquí no puede
 * tumbar el webhook: el BEZ ya está en la cadena y Stripe reintentaría el evento
 * entero, así que se registra el problema y se sigue.
 */
async function recordMintInLedger({ walletAddress, amountUsdCents, eventId, result, chargeId = null }) {
  try {
    await ledger.recordCompletedPurchase({
      provider: 'stripe',
      eventId,
      chargeId,
      walletAddress,
      amountUsd: (Number(amountUsdCents) / 100).toFixed(2),
      amountBez: result && result.bezDisplay ? result.bezDisplay : null,
      txHash: result && result.txHash ? result.txHash : null,
    });
  } catch (err) {
    log.error('Ledger', 'No se pudo registrar la compra en payment_transactions', {
      eventId, error: err.message,
    });
  }
}

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════

// European/SEPA IBAN country prefixes settle in EUR; the rest of the world in USD.
const EUROPEAN_IBAN_PREFIXES = new Set([
  'AD', 'AT', 'BE', 'BG', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GB',
  'GR', 'HR', 'HU', 'IE', 'IS', 'IT', 'LI', 'LT', 'LU', 'LV', 'MC', 'MT', 'NL', 'NO',
  'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'SM',
]);

/** Currency a region accepts, derived from the IBAN country code. */
function regionCurrencyForIban(iban) {
  const cc = String(iban || '').trim().slice(0, 2).toUpperCase();
  return EUROPEAN_IBAN_PREFIXES.has(cc) ? 'EUR' : 'USD';
}

/**
 * Convert a settled amount (minor units of its own currency) to USD cents — the
 * unit the mint prices BEZ against. EUR uses the supplied EUR→USD rate (resolved
 * live from the ECB by the caller). Returns null for an unsupported currency.
 */
function toUsdCents(amountCents, currency, eurUsdRate) {
  if (currency === 'USD') return amountCents;
  if (currency === 'EUR') return Math.round(amountCents * eurUsdRate);
  return null;
}

/**
 * Convierte USD cents → BEZ wei usando aritmética de enteros. [sin cambio]
 */
function usdCentsToBezWei(amountUsdCents, decimals) {
  // Precio único en micro-USD (config/bez-price.js). Antes: BEZ_PRICE_USD_CENTS
  // entero con 7 por defecto, o sea 0,07 USD en vez de 0,0075.
  return centimosUsdABezWei(amountUsdCents, process.env, decimals);
}

/**
 * tx.wait() con timeout configurable. [REL-1]
 * Evita que el handler cuelgue indefinidamente en redes congestionadas.
 */
function waitWithTimeout(tx, timeoutMs) {
  const waitPromise = tx.wait();
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`tx.wait() timed out after ${timeoutMs}ms for ${tx.hash}`)), timeoutMs)
  );
  return Promise.race([waitPromise, timeoutPromise]);
}

/**
 * Obtiene gas EIP-1559 dinámico del nodo. [REL-2]
 * Polygon soporta EIP-1559; usar gasLimit solo puede resultar en TX stuck.
 */
async function getGasParams(provider) {
  try {
    const feeData = await provider.getFeeData();
    return {
      gasLimit: CONFIG.mintGasLimit,
      maxFeePerGas: feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    };
  } catch (err) {
    log.warn('Gas', 'getFeeData failed, falling back to gasLimit only', { error: err.message });
    return { gasLimit: CONFIG.mintGasLimit };
  }
}

/**
 * Timing-safe HMAC comparison. [SEC-1]
 * Evita timing attacks donde medir el tiempo de comparación revela bytes del secreto.
 */
function verifyHmac(body, incomingSignature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest();

  const incoming = Buffer.from(incomingSignature || '', 'hex');

  // Lengths must match for timingSafeEqual; short-circuit here is safe
  // because the lengths are public information (hex of sha256 = always 64 chars)
  if (incoming.length !== expected.length) return false;

  return crypto.timingSafeEqual(incoming, expected);
}

// ═══════════════════════════════════════════════
// CORE MINT LOGIC — internal, llamado por mintBezTokens() vía NonceManager
// ═══════════════════════════════════════════════
async function _executeMint(walletAddress, amountUsdCents, eventId) {
  const { provider, wallet, contract } = getBlockchainSingletons();

  const decimals = await getDecimals();          // cached after first call
  const amountWei = usdCentsToBezWei(amountUsdCents, decimals);

  if (amountWei === 0n) {
    throw new Error(`Calculated 0 BEZ for ${amountUsdCents} cents. Check BEZ_PRICE_USD (currently ${precioUsd()} USD).`);
  }

  const bezDisplay = ethers.formatUnits(amountWei, decimals);
  const gasParams = await getGasParams(provider);    // EIP-1559 [REL-2]
  const nonce = await NonceManager.nextNonce(wallet); // [PERF-3]

  log.info('Mint', 'Sending TX', {
    eventId, walletAddress, bezDisplay,
    nonce,
    gasLimit: gasParams.gasLimit.toString(),
    maxFee: gasParams.maxFeePerGas?.toString(),
  });

  let tx;
  try {
    tx = await contract.mint(walletAddress, amountWei, { ...gasParams, nonce });
  } catch (err) {
    // Nonce-related errors: reset so next TX fetches fresh from chain
    if (err.code === 'NONCE_EXPIRED' || err.code === 'REPLACEMENT_UNDERPRICED') {
      NonceManager.resetNonce();
    }
    throw err;
  }

  log.info('Mint', 'TX sent, waiting for confirmation', { txHash: tx.hash });

  const receipt = await waitWithTimeout(tx, CONFIG.txWaitTimeoutMs); // [REL-1]

  log.info('Mint', 'TX confirmed', {
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
    eventId,
  });

  // Mark as processed AFTER on-chain confirmation
  processedEvents.set(eventId, { ts: Date.now(), txHash: tx.hash });

  return { txHash: tx.hash, blockNumber: receipt.blockNumber, bezDisplay };
}

/**
 * Public entry point — wraps _executeMint in the NonceManager queue.
 * Validates address and idempotency BEFORE entering the queue.
 */
async function mintBezTokens(walletAddress, amountUsdCents, eventId) {
  // Vía antigua: acuñar BEZ con una clave privada en este proceso, en el mismo
  // instante del cobro. Apagada por defecto. Las entregas van por la capa de
  // seguridad (intención desde tesorería, dos aprobaciones, tx-signer aislado)
  // vía services/cardSettlementWorker. Los reintentos que quedaran en la cola
  // fallan aquí y se concilian a mano en vez de acuñar a ciegas.
  if (process.env.LEGACY_HOT_MINT_ENABLED !== 'true') {
    const e = new Error('HOT_MINT_DISABLED: la entrega de BEZ va por la capa de seguridad transaccional');
    e.code = 'HOT_MINT_DISABLED';
    throw e;
  }
  if (!ethers.isAddress(walletAddress)) {
    throw new Error(`Invalid Ethereum address: "${walletAddress}"`);
  }

  if (processedEvents.has(eventId)) {
    log.warn('Mint', 'Duplicate event — skipping', { eventId });
    return null;
  }

  // All mints go through the nonce queue — guaranteed sequential execution
  return NonceManager.enqueue(() => _executeMint(walletAddress, amountUsdCents, eventId));
}

// ═══════════════════════════════════════════════
// PLAN PROVISIONING — checkout de suscripción (Payment Links con
// metadata.plan_id). NO minta BEZ: activa el plan en gateway_subscriptions.
// El Hub añade ?client_reference_id=<app_id> al Payment Link para que
// el webhook sepa a qué app registrada pertenece la compra.
// ═══════════════════════════════════════════════
async function provisionPlanSubscription(session, eventId) {
  const planId = session.metadata?.plan_id;
  const billing = session.metadata?.billing === 'annual' ? 'annual' : 'monthly';
  const appId = session.client_reference_id;

  const plan = getPlan(planId);
  if (!plan) {
    log.error('Stripe', 'Unknown plan_id in session metadata', { sessionId: session.id, planId });
    return;
  }
  if (!appId) {
    // Sin app_id no podemos asociar la suscripción — queda para reconciliación
    // manual vía customer email en el dashboard de Stripe.
    log.warn('Stripe', 'Plan checkout without client_reference_id — manual reconciliation needed', {
      sessionId: session.id, planId, customerEmail: session.customer_details?.email,
    });
    return;
  }

  const renewInterval = billing === 'annual' ? "INTERVAL '1 year'" : "INTERVAL '1 month'";
  await query(
    `INSERT INTO gateway_subscriptions (app_id, plan_id, status, renews_at)
     VALUES ($1, $2, 'active', NOW() + ${renewInterval})
     ON CONFLICT (app_id) DO UPDATE
       SET plan_id = $2, status = 'active',
           renews_at = NOW() + ${renewInterval}, updated_at = NOW()`,
    [appId, planId]
  );
  log.info('Stripe', 'Plan subscription provisioned', {
    eventId, appId, planId, billing, stripeCustomer: session.customer,
  });
}

// ═══════════════════════════════════════════════
// Wallet e importe de una Checkout Session
// ═══════════════════════════════════════════════
//
// Los Payment Links de Stripe NO pueden poner metadata por sesión: la wallet
// del comprador llega en un campo personalizado del formulario. El enlace de
// compra de BEZ lo llama `wallettosendthebezcoin` y los de suscripción
// `walletaddresstosendbezcoin`. Este manejador sólo miraba metadata.walletAddress,
// así que toda compra por Payment Link terminaba en «No wallet address in
// session»: cobrada y sin BEZ entregado.
const CAMPOS_WALLET = ['walletaddresstosendbezcoin', 'wallettosendthebezcoin', 'walletaddress', 'wallet'];

function walletDeSesion(session) {
  const candidatos = [session.metadata?.walletAddress, session.client_reference_id];
  for (const campo of session.custom_fields || []) {
    if (CAMPOS_WALLET.includes(String(campo.key || '').toLowerCase())) candidatos.push(campo.text?.value);
  }
  for (const c of candidatos) {
    const v = typeof c === 'string' ? c.trim() : '';
    // Lo escribe el comprador a mano: sólo vale una dirección EVM bien formada.
    if (/^0x[0-9a-fA-F]{40}$/.test(v)) return v;
  }
  return null;
}

/**
 * mintBezTokens trabaja en céntimos de USD. Los enlaces cobran en EUR: tomar
 * amount_total tal cual entregaba BEZ como si 100 € fueran 100 $.
 */
async function importeEnCentimosUsd(session) {
  const moneda = String(session.currency || 'usd').toUpperCase();
  let rate = null;
  if (moneda === 'EUR') {
    const { getEurUsdRate } = require('../services/fxService');
    ({ rate } = await getEurUsdRate({ fallback: Number(process.env.EUR_USD_RATE) || undefined }));
  }
  const cents = toUsdCents(session.amount_total, moneda, rate);
  if (cents === null) throw new Error(`Moneda no soportada para la compra de BEZ: ${moneda}`);
  return cents;
}

// ═══════════════════════════════════════════════
// ROUTE: POST /webhooks/stripe
// ═══════════════════════════════════════════════
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, CONFIG.stripeWebhookSecret);
  } catch (err) {
    log.error('Stripe', 'Signature verification failed', { error: err.message });
    return res.status(400).json({ error: `Webhook signature error: ${err.message}` });
  }

  // Respond immediately — Stripe has a 30s timeout; minting can take longer
  res.json({ received: true });

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;

      if (session.payment_status !== 'paid') {
        log.warn('Stripe', 'Session not fully paid — skipping', {
          sessionId: session.id,
          payment_status: session.payment_status,
        });
        break;
      }

      // Suscripción de plan (Payment Link con metadata.plan_id): provisionar
      // el plan, nunca mintear BEZ por el importe de la cuota.
      if (session.metadata?.plan_id) {
        try {
          await provisionPlanSubscription(session, event.id);
        } catch (err) {
          log.error('Stripe', 'Plan provisioning failed', {
            sessionId: session.id, error: err.message,
          });
        }
        break;
      }

      const walletAddress = walletDeSesion(session);

      if (!walletAddress) {
        log.error('Stripe', 'No wallet address in session', {
          sessionId: session.id,
          campos: (session.custom_fields || []).map((c) => c.key),
        });
        break;
      }

      let amountUsdCents;
      try {
        amountUsdCents = await importeEnCentimosUsd(session);
      } catch (err) {
        // Sin importe fiable no se mintea nada: ni a ciegas ni encolado con un
        // importe nulo. El pago queda en el log para conciliarlo a mano.
        log.error('Stripe', 'Importe no convertible — pago cobrado SIN entregar BEZ, conciliar a mano', {
          sessionId: session.id, currency: session.currency, error: err.message,
        });
        break;
      }

      // ── NO SE ENTREGA AQUÍ ────────────────────────────────────────────────
      // Antes se minteaba en este mismo instante. Un cobro con tarjeta se puede
      // revertir; el BEZ entregado, no. La compra queda RETENIDA con el BEZ
      // congelado al precio de hoy, y services/cardSettlementWorker la entrega
      // cuando cardFundsVerifier confirma —en Stripe, no en este evento— que el
      // importe exacto se cobró, sigue en pie, está disponible y ha llegado a la
      // cuenta bancaria de BeZhas. La misma regla que aplica BezPay en el Hub.
      const bezWei = centimosUsdABezWei(amountUsdCents);
      if (bezWei <= 0n) {
        log.error('Stripe', 'Importe demasiado pequeño para 1 unidad de BEZ — conciliar a mano', { sessionId: session.id });
        break;
      }
      const { ethers: eth } = require('ethers');
      const bezDisplay = eth.formatUnits(bezWei, 18);
      const referencia = (typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id) || session.id;

      try {
        const fila = await ledger.recordHeldCardPurchase({
          eventId: event.id,
          chargeId: referencia,
          walletAddress,
          amountUsd: (amountUsdCents / 100).toFixed(2),
          amountBez: bezDisplay,
          entrega: {
            estado: 'retenida',
            referencia,
            sesion: session.id,
            importeMinor: session.amount_total,
            moneda: String(session.currency || 'usd').toLowerCase(),
            bezWei: bezWei.toString(),
            precioUsd: precioUsd(),
            cliente: {
              nombre: session.customer_details?.name || null,
              pais: session.customer_details?.address?.country || null,
              email: session.customer_details?.email || null,
            },
            retenidaEn: new Date().toISOString(),
          },
        });
        if (fila) {
          log.info('Stripe', 'Compra con tarjeta retenida hasta confirmar fondos', { paymentId: fila.id, sessionId: session.id, bezDisplay });
          await ledger.notifyWalletOwner({
            walletAddress,
            type: 'transaction',
            title: 'Pago recibido',
            message: `Tus ${bezDisplay} BEZ se entregarán cuando el banco confirme el cobro (normalmente en pocos días hábiles).`,
            metadata: { paymentId: fila.id, provider: 'stripe' },
          }).catch(() => { /* la notificación nunca bloquea el cobro */ });
        }
      } catch (err) {
        log.error('Stripe', 'No se pudo registrar la compra retenida — conciliar a mano', { sessionId: session.id, error: err.message });
      }
      break;
    }

    case 'charge.dispute.created': {
      // Una disputa durante la retención: esa compra no se entrega nunca.
      const disputa = event.data.object;
      const ref = disputa.payment_intent || disputa.charge;
      try {
        const r = await require('../services/cardSettlementWorker').bloquearPorReferencia(ref, 'DISPUTADO');
        log.warn('Stripe', 'Disputa recibida', { ref, ...r });
      } catch (err) {
        log.error('Stripe', 'No se pudo bloquear la entrega por disputa', { ref, error: err.message });
      }
      break;
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object;
      const reason = pi.last_payment_error?.message || 'unknown';
      const failedWallet = pi.metadata?.walletAddress || null;

      log.warn('Stripe', 'Payment intent failed', { intentId: pi.id, reason });

      // Queda registrado como orden 'failed' en lugar de morir en un log: es
      // información que el usuario y soporte necesitan poder consultar.
      try {
        await ledger.recordFailedPurchase({
          provider: 'stripe',
          eventId: event.id,
          chargeId: pi.id,
          walletAddress: failedWallet,
          amountUsd: pi.amount != null ? (Number(pi.amount) / 100).toFixed(2) : null,
          reason,
        });
      } catch (err) {
        log.error('Stripe', 'No se pudo registrar el pago fallido', {
          intentId: pi.id, error: err.message,
        });
      }

      if (failedWallet) {
        await ledger.notifyWalletOwner({
          walletAddress: failedWallet,
          type: 'alert',
          title: 'Tu pago no se ha podido completar',
          message: `El cobro fue rechazado (${reason}). No se ha emitido ningún BEZ.`,
          metadata: { intentId: pi.id, provider: 'stripe' },
        }).catch((err) => log.warn('Stripe', 'Notificación no entregada', { error: err.message }));
      }
      break;
    }

    case 'charge.refunded': {
      const charge = event.data.object;
      const paymentIntentId = charge.payment_intent || charge.id;

      // El reembolso completo (estado, nota y webhook payment.refunded a la app
      // creadora) ya lo implementa refundPayment(); aquí sólo hay que resolver el
      // cargo de Stripe a la orden del libro mayor, que es lo que faltaba.
      //
      // ALCANCE: se revierte el estado en la plataforma, NO se toca la cadena. La
      // quema del BEZ ya minteado exige decidir contrato y operación (burn desde
      // tesorería contra un holder que puede haberlo movido ya), y eso no se
      // decide aquí. La orden queda en 'refunded' con la nota del reembolso, que
      // es el estado correcto para conciliarlo después.
      try {
        const retenida = await require('../services/cardSettlementWorker').bloquearPorReferencia(paymentIntentId, 'REEMBOLSADO');
        if (retenida.bloqueada) {
          log.info('Stripe', 'Reembolso de una compra aún retenida: bloqueada, nada entregado', { paymentIntentId });
          break;
        }
        const order = await ledger.findByChargeId(paymentIntentId, 'stripe');

        if (!order) {
          log.warn('Stripe', 'Reembolso sin orden asociada — nada que revertir', {
            chargeId: charge.id, paymentIntentId,
          });
          break;
        }

        await refundPayment({
          paymentId: order.id,
          reason: `stripe:charge.refunded:${charge.id}`,
          requestedBy: 'stripe-webhook',
        });

        log.info('Stripe', 'Orden marcada como reembolsada', {
          paymentId: order.id, chargeId: charge.id,
        });

        await ledger.notifyWalletOwner({
          walletAddress: order.wallet_address,
          type: 'transaction',
          title: 'Reembolso procesado',
          message: 'Tu compra ha sido reembolsada. El BEZ asociado queda pendiente de regularizar.',
          metadata: { paymentId: order.id, chargeId: charge.id, provider: 'stripe' },
        }).catch(() => { /* la notificación nunca bloquea el reembolso */ });
      } catch (err) {
        // ALREADY_REFUNDED es esperable: Stripe reenvía el evento hasta el 2xx.
        if (err instanceof SettlementError && err.code === 'ALREADY_REFUNDED') {
          log.info('Stripe', 'Reembolso ya aplicado — evento repetido', { chargeId: charge.id });
          break;
        }
        log.error('Stripe', 'Fallo al aplicar el reembolso', {
          chargeId: charge.id, error: err.message,
        });
      }
      break;
    }

    default:
      // Silently ignore — Stripe Dashboard logs all events
      break;
  }
});

// ═══════════════════════════════════════════════
// ROUTE: POST /webhooks/bank
// ═══════════════════════════════════════════════
router.post('/bank', express.json(), async (req, res) => {

  // 1. HMAC timing-safe validation [SEC-1]
  // FALLA CERRADO. Antes, sin secreto sólo se avisaba y se seguía: cualquiera
  // podía «confirmar» una transferencia SEPA que nunca llegó y hacerse mintear
  // BEZ. Y docker-compose.yml no pasaba BANK_WEBHOOK_SECRET a la API, así que
  // en el VPS el endpoint quedaba abierto de facto.
  if (!CONFIG.bankWebhookSecret) {
    log.error('Bank', 'BANK_WEBHOOK_SECRET no configurado — petición rechazada');
    return res.status(503).json({ error: 'Bank webhook not configured' });
  } else {
    const bodyStr = JSON.stringify(req.body);
    const isValid = verifyHmac(bodyStr, req.headers['x-bank-signature'], CONFIG.bankWebhookSecret);

    if (!isValid) {
      log.error('Bank', 'Invalid HMAC signature — request rejected');
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const { iban, amountCents, currency, reference, walletAddress, eventId } = req.body;

  // 2. Payload validation
  if (!iban || !amountCents || !currency || !walletAddress || !eventId) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['iban', 'amountCents', 'currency', 'walletAddress', 'eventId'],
    });
  }

  // 3. Region-based currency acceptance [SEC-2]
  // European-region IBANs settle in EUR, the rest of the world in USD. The amount
  // is converted to USD cents (the mint's pricing unit) via an explicit FX rate —
  // never a silent 1:1 (€1000 ≠ $1000).
  const expectedCurrency = regionCurrencyForIban(iban);
  if (currency !== expectedCurrency) {
    log.error('Bank', 'Currency does not match IBAN region', {
      ibanCountry: String(iban).slice(0, 2).toUpperCase(), currency, expectedCurrency, reference,
    });
    return res.status(422).json({
      error: `Currency "${currency}" is not accepted for this region. Expected ${expectedCurrency}.`,
      detail: `IBAN country ${String(iban).slice(0, 2).toUpperCase()} settles in ${expectedCurrency}.`,
    });
  }

  // EUR converts to USD cents via the live ECB reference rate (falls back to the
  // configured static rate if the feed is unreachable). USD needs no FX call.
  let fx = { rate: 1, source: 'none' };
  if (currency === 'EUR') {
    fx = await fxService.getEurUsdRate({ fallback: CONFIG.eurUsdRate });
  }
  const usdCents = toUsdCents(amountCents, currency, fx.rate);
  if (usdCents === null || usdCents <= 0) {
    return res.status(422).json({ error: `Currency "${currency}" is not supported.` });
  }

  log.info('Bank', 'Webhook received', {
    ibanCountry: String(iban).slice(0, 2).toUpperCase(), amountCents, currency, usdCents,
    fxRate: currency === 'EUR' ? fx.rate : undefined, fxSource: currency === 'EUR' ? fx.source : undefined,
    reference,
  });

  // El HMAC del banco confirma que el dinero está en la cuenta (una
  // transferencia SEPA no se revierte sin nuestro consentimiento). Aun así, el
  // BEZ no sale de aquí: se registra con los fondos confirmados y la entrega la
  // hace services/cardSettlementWorker por la capa de seguridad, igual que con
  // tarjeta (intención desde tesorería, aprobaciones EIP-712, tx-signer).
  if (!ethers.isAddress(walletAddress)) {
    return res.status(400).json({ error: 'walletAddress no es una dirección EVM válida.' });
  }
  const bezWei = centimosUsdABezWei(usdCents);
  if (bezWei <= 0n) return res.status(422).json({ error: 'Importe demasiado pequeño.' });
  const bezDisplay = ethers.formatUnits(bezWei, 18);
  try {
    const fila = await ledger.recordHeldPurchase({
      provider: 'bank', paymentMethod: 'bank',
      eventId, chargeId: reference || eventId, walletAddress,
      amountUsd: (usdCents / 100).toFixed(2), amountBez: bezDisplay,
      entrega: {
        estado: 'fondos_confirmados', origen: 'banco', referencia: reference || eventId,
        importeMinor: amountCents, moneda: String(currency).toLowerCase(), bezWei: bezWei.toString(),
        precioUsd: precioUsd(),
        cliente: { nombre: req.body.payerName || null, pais: String(iban).slice(0, 2).toUpperCase() },
        confirmadosEn: new Date().toISOString(),
      },
    });
    if (!fila) return res.json({ success: true, status: 'already_processed' });
    return res.status(202).json({ success: true, status: 'held_for_delivery', paymentId: fila.id, bez: bezDisplay });
  } catch (err) {
    log.error('Bank', 'No se pudo registrar el ingreso — conciliar a mano', { eventId, error: err.message });
    return res.status(500).json({ error: 'No se pudo registrar el ingreso.' });
  }
});

module.exports = router;
// Pure helpers exposed for unit testing (does not change the mount — router is a fn).
module.exports.regionCurrencyForIban = regionCurrencyForIban;
module.exports.toUsdCents = toUsdCents;
module.exports.walletDeSesion = walletDeSesion;
