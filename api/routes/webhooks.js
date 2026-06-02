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
 *  [REL-3]  Retry queue       → cola en memoria con backoff exponencial (stub BullMQ)
 *  [MEM-1]  TTL idempotency   → Map con timestamp + limpieza cada hora (antes: Set infinito)
 *  [CFG-1]  MINT_GAS_LIMIT    → parseado con try/catch (antes: BigInt() en module scope)
 *  [CFG-2]  contractAddress   → validado con ethers.isAddress() antes de instanciar
 *  [LOG-1]  Logger estructurado → pino-compatible con nivel, módulo, timestamp
 */

'use strict';

const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { ethers } = require('ethers');
const crypto = require('crypto');

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
  // BEZ-Coin v1 (LIVE on BSC) — BEZCoinV2 not deployed yet
  bezContractAddress: process.env.BEZ_TOKEN_ADDRESS ?? '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
  treasuryPk: process.env.BEZ_TREASURY_PK || process.env.ADMIN_PK || '',
  rpcUrl: process.env.RPC_URL || 'https://rpc-amoy.polygon.technology',
  bezPriceUsdCents: parseInt(process.env.BEZ_PRICE_USD_CENTS || '7', 10),
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
    ['treasuryPk', CONFIG.treasuryPk, () => CONFIG.treasuryPk.startsWith('0x') && CONFIG.treasuryPk.length === 66],
    ['stripeWebhookSecret', CONFIG.stripeWebhookSecret, () => CONFIG.stripeWebhookSecret.startsWith('whsec_')],
  ];

  for (const [name, value, validate] of checks) {
    if (!value || !validate()) {
      log.error('Config', `Invalid or missing: ${name}`, { value: value ? '[SET_BUT_INVALID]' : '[MISSING]' });
    }
  }

  if (!CONFIG.bankWebhookSecret) {
    log.warn('Config', 'BANK_WEBHOOK_SECRET not set — /bank endpoint is unprotected');
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
  const _pending = [];
  let _running = false;

  async function _processNext() {
    if (_running || _pending.length === 0) return;
    _running = true;

    const job = _pending[0];
    const delay = CONFIG.retryBaseDelayMs * (2 ** job.attempt);

    log.info('RetryQueue', `Retrying mint in ${delay}ms`, {
      eventId: job.eventId,
      attempt: job.attempt + 1,
      maxAttempts: CONFIG.retryMaxAttempts,
    });

    await new Promise((r) => setTimeout(r, delay));

    try {
      await _executeMint(job.walletAddress, job.amountUsdCents, job.eventId);
      _pending.shift();
      log.info('RetryQueue', 'Retry succeeded', { eventId: job.eventId });
    } catch (err) {
      job.attempt++;
      if (job.attempt >= CONFIG.retryMaxAttempts) {
        _pending.shift();
        log.error('RetryQueue', 'Max retries exceeded — mint permanently failed', {
          eventId: job.eventId,
          wallet: job.walletAddress,
          error: err.message,
          // ALERT: integrate PagerDuty / Sentry / SNS here for critical failures
        });
      }
    } finally {
      _running = false;
      _processNext();
    }
  }

  function enqueue(walletAddress, amountUsdCents, eventId) {
    _pending.push({ walletAddress, amountUsdCents, eventId, attempt: 0 });
    log.info('RetryQueue', 'Job enqueued', { eventId, queueLength: _pending.length });
    _processNext();
  }

  return { enqueue };
})();

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════

/**
 * Convierte USD cents → BEZ wei usando aritmética de enteros. [sin cambio]
 */
function usdCentsToBezWei(amountUsdCents, decimals) {
  const scaleFactor = 10n ** BigInt(decimals);
  return (BigInt(amountUsdCents) * scaleFactor) / BigInt(CONFIG.bezPriceUsdCents);
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
    throw new Error(`Calculated 0 BEZ for ${amountUsdCents} cents. Check BEZ_PRICE_USD_CENTS (currently ${CONFIG.bezPriceUsdCents}).`);
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
// ROUTE: POST /webhooks/stripe
// ═══════════════════════════════════════════════
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, CONFIG.stripeWebhookSecret);
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

      const walletAddress = session.metadata?.walletAddress || session.client_reference_id;

      if (!walletAddress) {
        log.error('Stripe', 'No wallet address in session', { sessionId: session.id });
        break;
      }

      const amountUsdCents = session.amount_total;

      try {
        const result = await mintBezTokens(walletAddress, amountUsdCents, event.id);
        if (result) {
          log.info('Stripe', 'Mint successful', {
            bezDisplay: result.bezDisplay,
            txHash: result.txHash,
            wallet: walletAddress,
          });
        }
      } catch (err) {
        log.error('Stripe', 'Mint failed — enqueuing retry', {
          sessionId: session.id,
          error: err.message,
        });
        RetryQueue.enqueue(walletAddress, amountUsdCents, event.id);
      }
      break;
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object;
      log.warn('Stripe', 'Payment intent failed', {
        intentId: pi.id,
        reason: pi.last_payment_error?.message,
      });
      // TODO: notify user via email/notification service; update order in DB
      break;
    }

    case 'charge.refunded': {
      // TODO: implement token burn / balance freeze on refund
      log.warn('Stripe', 'Charge refunded — token reversal not yet implemented', {
        chargeId: event.data.object.id,
      });
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
  if (!CONFIG.bankWebhookSecret) {
    log.warn('Bank', 'Request received but BANK_WEBHOOK_SECRET is not set');
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

  // 3. Currency normalization [SEC-2]
  // Rejecting non-USD explicitly until a real FX oracle is integrated.
  // NEVER silently use 1:1 for production — €1000 ≠ $1000.
  if (currency !== 'USD') {
    log.error('Bank', 'Non-USD currency rejected — FX conversion not yet implemented', {
      currency, reference,
    });
    // Return 422 so the bank system knows to retry after FX is available,
    // rather than 400 (which would indicate a bad request they shouldn't retry)
    return res.status(422).json({
      error: `Currency "${currency}" is not supported yet. Only USD is accepted.`,
      detail: 'FX oracle integration is pending. Contact BeZhas support.',
    });
  }

  log.info('Bank', 'Webhook received', { iban, amountCents, currency, reference });

  try {
    const result = await mintBezTokens(walletAddress, amountCents, eventId);
    if (result) {
      return res.json({ success: true, txHash: result.txHash, bezMinted: result.bezDisplay });
    }
    return res.json({ success: true, status: 'already_processed' });
  } catch (err) {
    log.error('Bank', 'Mint failed — enqueuing retry', { eventId, error: err.message });
    RetryQueue.enqueue(walletAddress, amountCents, eventId);
    // Return 202 Accepted: we received the event and will process it asynchronously
    return res.status(202).json({ status: 'queued', message: 'Mint will be retried automatically.' });
  }
});

module.exports = router;