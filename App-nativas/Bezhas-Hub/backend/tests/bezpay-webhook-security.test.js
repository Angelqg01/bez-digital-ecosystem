/**
 * Suite de seguridad del webhook de BezPay.
 *
 * El webhook lo llama el navegador del pagador, así que la propiedad que estos
 * tests defienden es una sola: NADA del body puede provocar una salida del hot
 * wallet que la cadena no respalde.
 *
 * El ataque original que esto cierra: POST /api/payment/webhook con
 * { type:'buy_bez', walletAddress:<mía>, amountUSD:100000 } y sin haber pagado
 * nada → el servicio dispensaba 100.000 USD en BEZ.
 */

jest.mock('../models/pg/Payment', () => ({
  create: jest.fn(),
  findByPaymentIntent: jest.fn(),
  updateByPaymentIntent: jest.fn(),
  claimForSettlement: jest.fn(),
  markSettlementFailed: jest.fn(),
}));
jest.mock('../bridge', () => ({ bridgeCore: { getAdapter: jest.fn(() => null) } }));
jest.mock('../services/payment-openclaw-bridge', () => ({
  onPaymentCompleted: jest.fn(() => Promise.resolve()),
}), { virtual: true });
jest.mock('../services/bezpayVerifier', () => {
  const actual = jest.requireActual('../services/bezpayVerifier');
  return { ...actual, verifyIncomingPayment: jest.fn() };
});

const PaymentPG = require('../models/pg/Payment');
const { verifyIncomingPayment, VerificationError } = require('../services/bezpayVerifier');
const openclawBridge = require('../services/payment-openclaw-bridge');
const bezpay = require('../services/bezpay.service');

const TX = '0x' + 'ab'.repeat(32);
const PAYER = '0x1111111111111111111111111111111111111111';
const ATTACKER = '0x2222222222222222222222222222222222222222';
const TREASURY = '0x89c23890c742d710265dD61be789C71dC8999b12';
const USDT = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

/** Orden legítima de 100 USDT → 79,43 BEZ, tal y como la deja /create. */
function validOrder(overrides = {}) {
  return {
    payment_intent_id: 'BEZ-TEST-0001',
    wallet_address: PAYER,
    type: 'token_purchase',
    status: 'pending',
    bez_amount: '79.435483',
    settled_at: null,
    tx_hash: null,
    metadata: {
      type: 'buy_bez',
      settlement: {
        chainId: 137,
        payToken: 'USDT',
        tokenAddress: USDT,
        expectedAmountWei: '100000000',  // 100 USDT (6 decimales)
        recipient: TREASURY,
        bezAmount: 79.435483,
        expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      },
    },
    ...overrides,
  };
}

let dispenseSpy;

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.HOT_WALLET_PRIVATE_KEY;
  global.fetch = jest.fn(() => Promise.reject(new Error('network disabled in tests')));

  PaymentPG.updateByPaymentIntent.mockResolvedValue(undefined);
  PaymentPG.markSettlementFailed.mockResolvedValue(undefined);
  openclawBridge.onPaymentCompleted.mockResolvedValue(undefined);
  // claimForSettlement devuelve la fila reclamada por defecto
  PaymentPG.claimForSettlement.mockImplementation(async (id) => validOrder({
    payment_intent_id: id, status: 'processing', settled_at: new Date(),
  }));

  verifyIncomingPayment.mockResolvedValue({
    txHash: TX, blockNumber: 100, confirmations: 5,
    paidWei: 100000000n, payer: PAYER,
  });

  // Espía del dispensado: si esto se llama, ha salido dinero del hot wallet.
  dispenseSpy = jest.fn(async () => ({ txHash: '0x' + 'cd'.repeat(32), blockNumber: 101 }));
  bezpay.__setDispenser(dispenseSpy);
});

afterEach(() => bezpay.__setDispenser(null));

// ═══════════════════════════════════════════════════════════════════════════
describe('el body no puede fabricar un pago', () => {
  it('sin paymentId responde 400 y no dispensa', async () => {
    const res = mockRes();
    await bezpay.handleWebhook({ body: { type: 'buy_bez', walletAddress: ATTACKER, amountUSD: 100000, txHash: TX } }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('NO_PAYMENT_ID');
    expect(dispenseSpy).not.toHaveBeenCalled();
  });

  it('sin txHash responde 400 y no dispensa', async () => {
    const res = mockRes();
    await bezpay.handleWebhook({ body: { paymentId: 'BEZ-TEST-0001' } }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('BAD_TXHASH');
    expect(dispenseSpy).not.toHaveBeenCalled();
  });

  it('con una orden inexistente responde 404 y no dispensa', async () => {
    PaymentPG.findByPaymentIntent.mockResolvedValue(null);
    const res = mockRes();
    await bezpay.handleWebhook({ body: { paymentId: 'BEZ-NO-EXISTE', txHash: TX } }, res);

    expect(res.statusCode).toBe(404);
    expect(dispenseSpy).not.toHaveBeenCalled();
  });

  it('EL ATAQUE: importe y wallet del body se ignoran; se paga lo de la orden', async () => {
    PaymentPG.findByPaymentIntent.mockResolvedValue(validOrder());
    const res = mockRes();

    await bezpay.handleWebhook({
      body: {
        paymentId: 'BEZ-TEST-0001',
        txHash: TX,
        // Todo esto es del atacante y no debe influir en nada:
        walletAddress: ATTACKER,
        amountUSD: 100000,
        payToken: 'BEZ',
        type: 'buy_bez',
      },
    }, res);

    expect(res.body.success).toBe(true);
    expect(dispenseSpy).toHaveBeenCalledTimes(1);
    // Se dispensa a la wallet DE LA ORDEN, por el importe DE LA ORDEN.
    expect(dispenseSpy).toHaveBeenCalledWith(PAYER, 79.435483);
    expect(dispenseSpy).not.toHaveBeenCalledWith(ATTACKER, expect.anything());
  });

  it('la verificación se hace contra los términos de la orden, no del body', async () => {
    PaymentPG.findByPaymentIntent.mockResolvedValue(validOrder());
    const res = mockRes();

    await bezpay.handleWebhook({
      body: { paymentId: 'BEZ-TEST-0001', txHash: TX, payToken: 'BEZ', amountUSD: 1 },
    }, res);

    expect(verifyIncomingPayment).toHaveBeenCalledWith(expect.objectContaining({
      chainId: 137,
      payer: PAYER,
      recipient: TREASURY,
      tokenAddress: USDT,
      minAmountWei: 100000000n,
    }));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('la cadena manda', () => {
  beforeEach(() => PaymentPG.findByPaymentIntent.mockResolvedValue(validOrder()));

  it('TX revertida → 400, sin dispensar', async () => {
    verifyIncomingPayment.mockRejectedValue(new VerificationError('TX_REVERTED', 'revirtió'));
    const res = mockRes();
    await bezpay.handleWebhook({ body: { paymentId: 'BEZ-TEST-0001', txHash: TX } }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('TX_REVERTED');
    expect(dispenseSpy).not.toHaveBeenCalled();
  });

  it('pago insuficiente → 400, sin dispensar', async () => {
    verifyIncomingPayment.mockRejectedValue(new VerificationError('UNDERPAID', 'pagó de menos'));
    const res = mockRes();
    await bezpay.handleWebhook({ body: { paymentId: 'BEZ-TEST-0001', txHash: TX } }, res);

    expect(res.statusCode).toBe(400);
    expect(dispenseSpy).not.toHaveBeenCalled();
  });

  it('la TX la firmó otro → 400, sin dispensar', async () => {
    verifyIncomingPayment.mockRejectedValue(new VerificationError('WRONG_PAYER', 'otro pagador'));
    const res = mockRes();
    await bezpay.handleWebhook({ body: { paymentId: 'BEZ-TEST-0001', txHash: TX } }, res);

    expect(res.statusCode).toBe(400);
    expect(dispenseSpy).not.toHaveBeenCalled();
  });

  it('RPC caído → 202 reintentable, NUNCA se da por bueno', async () => {
    verifyIncomingPayment.mockRejectedValue(
      new VerificationError('RPC_UNAVAILABLE', 'sin RPC', { retryable: true })
    );
    const res = mockRes();
    await bezpay.handleWebhook({ body: { paymentId: 'BEZ-TEST-0001', txHash: TX } }, res);

    expect(res.statusCode).toBe(202);
    expect(res.body.retryable).toBe(true);
    expect(dispenseSpy).not.toHaveBeenCalled();
    // Y no se marca como fallida: el pago puede seguir siendo válido.
    expect(PaymentPG.updateByPaymentIntent).not.toHaveBeenCalled();
  });

  it('pocas confirmaciones → 202, sin dispensar', async () => {
    verifyIncomingPayment.mockRejectedValue(
      new VerificationError('INSUFFICIENT_CONFIRMATIONS', '1/3', { retryable: true })
    );
    const res = mockRes();
    await bezpay.handleWebhook({ body: { paymentId: 'BEZ-TEST-0001', txHash: TX } }, res);

    expect(res.statusCode).toBe(202);
    expect(dispenseSpy).not.toHaveBeenCalled();
  });

  it('orden expirada → 410, sin dispensar', async () => {
    PaymentPG.findByPaymentIntent.mockResolvedValue(validOrder({
      metadata: {
        type: 'buy_bez',
        settlement: {
          chainId: 137, payToken: 'USDT', tokenAddress: USDT,
          expectedAmountWei: '100000000', recipient: TREASURY,
          expiresAt: new Date(Date.now() - 60_000).toISOString(),
        },
      },
    }));
    const res = mockRes();
    await bezpay.handleWebhook({ body: { paymentId: 'BEZ-TEST-0001', txHash: TX } }, res);

    expect(res.statusCode).toBe(410);
    expect(dispenseSpy).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('idempotencia: una TX, un pago', () => {
  it('orden ya liquidada → responde ok sin volver a dispensar', async () => {
    PaymentPG.findByPaymentIntent.mockResolvedValue(validOrder({
      status: 'completed', settled_at: new Date(), tx_hash: TX,
    }));
    const res = mockRes();
    await bezpay.handleWebhook({ body: { paymentId: 'BEZ-TEST-0001', txHash: TX } }, res);

    expect(res.body.success).toBe(true);
    expect(res.body.alreadySettled).toBe(true);
    expect(dispenseSpy).not.toHaveBeenCalled();
  });

  it('carrera perdida (claim devuelve null) → no dispensa', async () => {
    PaymentPG.findByPaymentIntent.mockResolvedValue(validOrder());
    PaymentPG.claimForSettlement.mockResolvedValue(null);
    const res = mockRes();
    await bezpay.handleWebhook({ body: { paymentId: 'BEZ-TEST-0001', txHash: TX } }, res);

    expect(res.body.alreadySettled).toBe(true);
    expect(dispenseSpy).not.toHaveBeenCalled();
  });

  it('TX ya usada en otra orden (23505) → 409, sin dispensar', async () => {
    PaymentPG.findByPaymentIntent.mockResolvedValue(validOrder());
    const dup = new Error('duplicate key');
    dup.code = '23505';
    PaymentPG.claimForSettlement.mockRejectedValue(dup);
    const res = mockRes();
    await bezpay.handleWebhook({ body: { paymentId: 'BEZ-TEST-0001', txHash: TX } }, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('TX_ALREADY_USED');
    expect(dispenseSpy).not.toHaveBeenCalled();
  });

  it('el claim ocurre DESPUÉS de verificar y ANTES de dispensar', async () => {
    PaymentPG.findByPaymentIntent.mockResolvedValue(validOrder());
    const order = [];
    verifyIncomingPayment.mockImplementation(async () => {
      order.push('verify');
      return { txHash: TX, blockNumber: 100, confirmations: 5, paidWei: 100000000n, payer: PAYER };
    });
    PaymentPG.claimForSettlement.mockImplementation(async (id) => {
      order.push('claim');
      return validOrder({ payment_intent_id: id });
    });
    dispenseSpy.mockImplementation(async () => {
      order.push('dispense');
      return { txHash: '0x' + 'cd'.repeat(32), blockNumber: 101 };
    });

    await bezpay.handleWebhook({ body: { paymentId: 'BEZ-TEST-0001', txHash: TX } }, mockRes());
    expect(order).toEqual(['verify', 'claim', 'dispense']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('fallo tras cobrar', () => {
  it('si el dispensado revienta, la orden queda marcada para revisión', async () => {
    PaymentPG.findByPaymentIntent.mockResolvedValue(validOrder());
    dispenseSpy.mockRejectedValue(new Error('hot wallet sin gas'));
    const res = mockRes();
    await bezpay.handleWebhook({ body: { paymentId: 'BEZ-TEST-0001', txHash: TX } }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.code).toBe('DELIVERY_FAILED');
    expect(res.body.paid).toBe(true);   // el cliente sí pagó
    expect(PaymentPG.markSettlementFailed).toHaveBeenCalledWith(
      'BEZ-TEST-0001', expect.stringContaining('DELIVERY_FAILED')
    );
  });

  it('un bridge que peta no convierte una entrega buena en fallida', async () => {
    PaymentPG.findByPaymentIntent.mockResolvedValue(validOrder());
    openclawBridge.onPaymentCompleted.mockImplementation(() => { throw new Error('bridge caído'); });
    const res = mockRes();
    await bezpay.handleWebhook({ body: { paymentId: 'BEZ-TEST-0001', txHash: TX } }, res);

    expect(res.body.success).toBe(true);
    expect(dispenseSpy).toHaveBeenCalledTimes(1);
    expect(PaymentPG.markSettlementFailed).not.toHaveBeenCalled();
  });

  it('un bridge que no devuelve promesa tampoco rompe la entrega', async () => {
    PaymentPG.findByPaymentIntent.mockResolvedValue(validOrder());
    openclawBridge.onPaymentCompleted.mockReturnValue(undefined);
    const res = mockRes();
    await bezpay.handleWebhook({ body: { paymentId: 'BEZ-TEST-0001', txHash: TX } }, res);

    expect(res.body.success).toBe(true);
    expect(PaymentPG.markSettlementFailed).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('no se puede sabotear la orden de otro', () => {
  it('un rechazo no marca la orden como fallida: sigue liquidable después', async () => {
    PaymentPG.findByPaymentIntent.mockResolvedValue(validOrder());
    verifyIncomingPayment.mockRejectedValue(new VerificationError('WRONG_PAYER', 'la TX es de otro'));

    const res = mockRes();
    await bezpay.handleWebhook({ body: { paymentId: 'BEZ-TEST-0001', txHash: TX } }, res);

    expect(res.statusCode).toBe(400);
    // Nada de tocar la orden: si se marcase 'failed', cualquiera podría
    // ensuciar órdenes ajenas conociendo el paymentId.
    expect(PaymentPG.updateByPaymentIntent).not.toHaveBeenCalled();
    expect(PaymentPG.markSettlementFailed).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('tipos de orden que la BD acepta', () => {
  const cases = [
    ['buy_bez', 'token_purchase'],
    ['subscription', 'vip_subscription'],
    ['nft_purchase', 'nft_purchase'],
    ['service', 'token_purchase'],
    ['farming', 'token_purchase'],
    ['escrow', 'token_purchase'],
  ];

  it.each(cases)('%s se guarda como %s (enum válido) y conserva el tipo real', async (type, dbType) => {
    PaymentPG.create.mockImplementation(async (doc) => ({ ...doc, id: 'x' }));
    const res = mockRes();

    await bezpay.createPayment({
      body: { payToken: 'USDT', amountUSD: 100, walletAddress: PAYER, type,
              planId: type === 'subscription' ? 'pro' : undefined },
    }, res);

    expect(res.body.success).toBe(true);
    const saved = PaymentPG.create.mock.calls[0][0];
    expect(saved.type).toBe(dbType);
    expect(saved.metadata.type).toBe(type);   // el tipo real no se pierde
  });

  it('createPayment congela los términos de liquidación en metadata', async () => {
    PaymentPG.create.mockImplementation(async (doc) => ({ ...doc, id: 'x' }));
    const res = mockRes();

    await bezpay.createPayment({
      body: { payToken: 'USDT', amountUSD: 100, walletAddress: PAYER, type: 'buy_bez' },
    }, res);

    const { settlement } = PaymentPG.create.mock.calls[0][0].metadata;
    expect(settlement.chainId).toBe(137);
    expect(settlement.tokenAddress).toBe(USDT);
    expect(settlement.expectedAmountWei).toBe('100000000');  // 100 USDT, 6 decimales
    expect(settlement.recipient).toBe(TREASURY);
    expect(new Date(settlement.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('si la orden no se puede guardar, no se acepta el pago', async () => {
    PaymentPG.create.mockRejectedValue(new Error('BD caída'));
    const res = mockRes();

    await bezpay.createPayment({
      body: { payToken: 'USDT', amountUSD: 100, walletAddress: PAYER, type: 'buy_bez' },
    }, res);

    // Sin orden no hay nada contra qué verificar después: mejor 503 que
    // cobrar algo que luego no sabremos liquidar.
    expect(res.statusCode).toBe(503);
    expect(res.body.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('cobros fiat', () => {
  beforeEach(() => {
    PaymentPG.create.mockImplementation(async (doc) => ({ ...doc, id: 'x' }));
    delete process.env.BANK_ACCOUNT_NUMBER_USD;
  });

  it('EUR ofrece tarjeta (Stripe) y transferencia, con la misma referencia', async () => {
    const res = mockRes();
    await bezpay.createPayment({ body: { payToken: 'EUR', amountUSD: 250, type: 'buy_bez' } }, res);

    expect(res.body.success).toBe(true);
    expect(res.body.card.provider).toBe('stripe');
    expect(res.body.card.url).toMatch(/^https:\/\/buy\.stripe\.com\//);
    expect(res.body.card.reference).toBe(res.body.paymentId);
    expect(res.body.bankDetails.iban).toMatch(/ES77 1465 0100 91 1766376210/);
    expect(res.body.bankDetails.concept).toBe(res.body.paymentId);
  });

  it('la clave que se publica es la publicable, jamás una secreta', async () => {
    const res = mockRes();
    await bezpay.createPayment({ body: { payToken: 'EUR', amountUSD: 50, type: 'buy_bez' } }, res);

    expect(res.body.card.publishableKey).toMatch(/^pk_/);
    expect(JSON.stringify(res.body)).not.toMatch(/sk_live|sk_test|rk_live/);
  });

  it('USD sin cuenta configurada ofrece tarjeta pero NO datos bancarios', async () => {
    const res = mockRes();
    await bezpay.createPayment({ body: { payToken: 'USD', amountUSD: 100, type: 'buy_bez' } }, res);

    expect(res.body.success).toBe(true);
    expect(res.body.card.url).toBeTruthy();
    // El IBAN de relleno que había ('US12 3456 7890…' / Chase) mandaba al
    // cliente a transferir a ninguna parte.
    expect(res.body.bankDetails).toBeNull();
    expect(JSON.stringify(res.body)).not.toMatch(/US12 3456|CHASUS33/);
  });

  it('USD con cuenta real configurada sí devuelve la transferencia', async () => {
    process.env.BANK_ACCOUNT_NUMBER_USD = 'US00 1111 2222 3333';
    process.env.BANK_SWIFT_USD = 'TESTUS33XXX';
    const res = mockRes();
    await bezpay.createPayment({ body: { payToken: 'USD', amountUSD: 100, type: 'buy_bez' } }, res);

    expect(res.body.bankDetails.iban).toBe('US00 1111 2222 3333');
    delete process.env.BANK_ACCOUNT_NUMBER_USD;
    delete process.env.BANK_SWIFT_USD;
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('órdenes heredadas', () => {
  it('sin términos de liquidación → 409, nunca se adivina el importe', async () => {
    PaymentPG.findByPaymentIntent.mockResolvedValue(validOrder({ metadata: { type: 'buy_bez' } }));
    const res = mockRes();
    await bezpay.handleWebhook({ body: { paymentId: 'BEZ-TEST-0001', txHash: TX } }, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('NO_SETTLEMENT_TERMS');
    expect(dispenseSpy).not.toHaveBeenCalled();
  });
});
