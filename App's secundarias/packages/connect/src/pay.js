// Pay module — wraps the gateway payment surface (/api/gateway/v1).
//
// Mirrors api/routes/gateway.js exactly: buy / sell / send / history / tokenomics
// + the stripe-link and bank-transfer discovery endpoints + live BEZ price.
// BEZ-Coin v1 (Polygon 0xEcBa…11A8) is the settlement currency.

const BASE = '/api/gateway/v1';

const PAYMENT_METHODS = ['card', 'crypto', 'qr', 'bank'];
const RECEIVE_METHODS = ['card', 'bank', 'crypto'];

export class PayModule {
  /** @param {import('./index.js').BeZhasConnect} client */
  constructor(client) {
    this.client = client;
  }

  /**
   * Initiate a BEZ purchase. For `card` it returns a Stripe checkoutUrl; for
   * `bank` it returns IBAN transfer instructions. The merchant embeds/redirects
   * to `checkoutUrl` from inside its own checkout — the customer never leaves.
   *
   * @param {object} p
   * @param {number} p.amountUSD              Net amount in USD (>= 1).
   * @param {'card'|'crypto'|'qr'|'bank'} p.paymentMethod
   * @param {string} [p.walletAddress]        Required unless a user JWT is set.
   * @param {string} [p.stripeUseCase]        Stripe payment-link selector (card only).
   * @param {string} [p.email]
   * @param {string} [p.idempotencyKey]       Retry-safe key (8-80 chars [A-Za-z0-9_-]):
   *                                          the same key replays the original order
   *                                          instead of creating a duplicate.
   * @returns {Promise<object>} { paymentId, status, checkoutUrl?, bankTransfer?, nextAction, ... }
   */
  buy(p = {}) {
    if (!PAYMENT_METHODS.includes(p.paymentMethod)) {
      throw new TypeError(`paymentMethod must be one of ${PAYMENT_METHODS.join(', ')}`);
    }
    if (!(p.amountUSD >= 1)) throw new TypeError('amountUSD must be a number >= 1');
    if (p.idempotencyKey && !/^[A-Za-z0-9_-]{8,80}$/.test(p.idempotencyKey)) {
      throw new TypeError('idempotencyKey must be 8-80 chars [A-Za-z0-9_-]');
    }
    return this.client.request('POST', `${BASE}/payments/buy`, {
      headers: p.idempotencyKey ? { 'Idempotency-Key': p.idempotencyKey } : undefined,
      body: {
        amountUSD: p.amountUSD,
        paymentMethod: p.paymentMethod,
        walletAddress: p.walletAddress,
        stripeUseCase: p.stripeUseCase,
        email: p.email,
      },
    });
  }

  /**
   * Sell BEZ back to fiat/crypto.
   * @param {object} p
   * @param {string} p.walletAddress
   * @param {number} p.amountBEZ        >= 0.1
   * @param {'card'|'bank'|'crypto'} p.receiveMethod
   */
  sell(p = {}) {
    if (!RECEIVE_METHODS.includes(p.receiveMethod)) {
      throw new TypeError(`receiveMethod must be one of ${RECEIVE_METHODS.join(', ')}`);
    }
    return this.client.request('POST', `${BASE}/payments/sell`, {
      body: { walletAddress: p.walletAddress, amountBEZ: p.amountBEZ, receiveMethod: p.receiveMethod },
    });
  }

  /**
   * BezPay peer transfer (sender -> recipient) in BEZ.
   * @param {object} p
   * @param {string} p.sender      Ethereum address.
   * @param {string} p.recipient   Address or alias (>= 3 chars).
   * @param {number} p.amount      >= 0.001
   * @param {string} [p.note]
   */
  send(p = {}) {
    return this.client.request('POST', `${BASE}/payments/send`, {
      body: { sender: p.sender, recipient: p.recipient, amount: p.amount, note: p.note },
    });
  }

  /**
   * Payment history for a wallet (newest first).
   * @param {string} address
   * @param {{ limit?: number }} [opts]
   */
  history(address, opts = {}) {
    return this.client.request('GET', `${BASE}/payments/history/${address}`, {
      query: { limit: opts.limit },
    });
  }

  /**
   * Fee + tokenomics breakdown for an amount (no side effects — safe to call
   * before showing the customer a price).
   * @param {{ amountUSD?: number, priceUSD?: number }} [opts]
   */
  tokenomics(opts = {}) {
    return this.client.request('GET', `${BASE}/payments/tokenomics`, {
      query: { amountUSD: opts.amountUSD, priceUSD: opts.priceUSD },
    });
  }

  /** Available Stripe payment links (card use-cases). */
  stripeLinks() {
    return this.client.request('GET', `${BASE}/payments/stripe-links`);
  }

  /** SEPA/SWIFT bank-transfer beneficiary details. */
  bankTransferDetails() {
    return this.client.request('GET', `${BASE}/payments/bank-transfer-details`);
  }

  /** Live or cached BEZ price in USD. */
  price() {
    return this.client.request('GET', `${BASE}/token/price`);
  }
}

export { PAYMENT_METHODS, RECEIVE_METHODS };
