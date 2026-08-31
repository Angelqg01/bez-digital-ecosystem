/**
 * Retención de pagos fiat antes de entregar BEZ.
 *
 * La propiedad que se defiende: un cobro reversible NO entrega tokens hasta que
 * vence su plazo, y si llega una disputa dentro del plazo no entrega nunca.
 *
 * ⚠️ Orden del fichero: jest.config.js usa `transform: {}`, que desactiva
 * babel-jest y con él el hoisting de jest.mock(). Los mocks van ANTES de los
 * require. Y `resetMocks: true` vacía implementaciones antes de cada test, así
 * que todas se reinstalan en el beforeEach.
 */

jest.mock('../models/pg/Payment', () => ({
  holdFiatPayment: jest.fn(),
  findReleasable: jest.fn(),
  blockSettlement: jest.fn(),
  findByProviderReference: jest.fn(),
  claimForSettlement: jest.fn(),
  markSettlementFailed: jest.fn(),
  updateByPaymentIntent: jest.fn(),
}));

const PaymentPG = require('../models/pg/Payment');
const fiat = require('../services/bezpayFiatSettlement');

const PAYER = '0x1111111111111111111111111111111111111111';
const PI = 'pi_test_123';

function heldOrder(overrides = {}) {
  return {
    payment_intent_id: 'BEZ-TEST-0001',
    wallet_address: PAYER,
    bez_amount: '79.435483',
    provider_reference: PI,
    payment_method_kind: 'card',
    status: 'processing',
    settled_at: null,
    tx_hash: null,
    hold_until: new Date(Date.now() - 1000),
    ...overrides,
  };
}

let dispense;

beforeEach(() => {
  dispense = jest.fn(async () => ({ txHash: '0x' + 'cd'.repeat(32), blockNumber: 1 }));
  fiat.configure({ dispense, verifyProviderCharge: null });

  PaymentPG.holdFiatPayment.mockResolvedValue(heldOrder());
  PaymentPG.findReleasable.mockResolvedValue([]);
  PaymentPG.blockSettlement.mockResolvedValue(null);
  PaymentPG.findByProviderReference.mockResolvedValue(null);
  PaymentPG.claimForSettlement.mockImplementation(async () => heldOrder());
  PaymentPG.markSettlementFailed.mockResolvedValue(undefined);
  PaymentPG.updateByPaymentIntent.mockResolvedValue(undefined);
});

// ═══════════════════════════════════════════════════════════════════════════
describe('plazos por medio de pago', () => {
  it('la transferencia SEPA no se retiene: devolverla exige nuestro consentimiento', () => {
    expect(fiat.holdHoursFor('bank_transfer')).toBe(0);
  });

  it('el adeudo SEPA se retiene 8 semanas, que es su ventana de devolución', () => {
    expect(fiat.holdHoursFor('sepa_debit')).toBe(1344);  // 56 días
  });

  it('la tarjeta se retiene 72 h por defecto', () => {
    expect(fiat.holdHoursFor('card')).toBe(72);
  });

  it('un medio desconocido cae al plazo por defecto, nunca a cero', () => {
    expect(fiat.holdHoursFor('lo_que_sea')).toBeGreaterThan(0);
  });

  it('holdUntilFor sitúa la fecha en el futuro según el medio', () => {
    const from = new Date('2026-01-01T00:00:00Z');
    expect(fiat.holdUntilFor('card', from).toISOString()).toBe('2026-01-04T00:00:00.000Z');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('cobrar retiene, no entrega', () => {
  it('un cobro con tarjeta queda retenido sin dispensar nada', async () => {
    const res = await fiat.recordFiatPayment({
      paymentId: 'BEZ-TEST-0001', providerReference: PI, methodKind: 'card',
    });

    expect(res.held).toBe(true);
    expect(res.holdUntil.getTime()).toBeGreaterThan(Date.now());
    expect(dispense).not.toHaveBeenCalled();   // ← lo importante
  });

  it('el mismo cobro repetido (reintento del webhook) no duplica', async () => {
    PaymentPG.holdFiatPayment.mockResolvedValue(null);
    const res = await fiat.recordFiatPayment({ paymentId: 'BEZ-TEST-0001', providerReference: PI });

    expect(res.held).toBe(false);
    expect(res.alreadyHeld).toBe(true);
    expect(dispense).not.toHaveBeenCalled();
  });

  it('un cobro que ya acreditó otra orden (23505) se rechaza', async () => {
    const dup = new Error('duplicate key');
    dup.code = '23505';
    PaymentPG.holdFiatPayment.mockRejectedValue(dup);

    const res = await fiat.recordFiatPayment({ paymentId: 'BEZ-OTRA', providerReference: PI });
    expect(res.duplicate).toBe(true);
    expect(dispense).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('liberación al vencer el plazo', () => {
  it('entrega el BEZ congelado en la orden, no uno recalculado', async () => {
    PaymentPG.findReleasable.mockResolvedValue([heldOrder()]);

    const res = await fiat.releaseDueSettlements();

    expect(res.delivered).toBe(1);
    expect(dispense).toHaveBeenCalledWith(PAYER, 79.435483);
    expect(PaymentPG.updateByPaymentIntent).toHaveBeenCalledWith(
      'BEZ-TEST-0001', expect.objectContaining({ status: 'completed' })
    );
  });

  it('no entrega nada si no hay órdenes vencidas', async () => {
    const res = await fiat.releaseDueSettlements();
    expect(res.delivered).toBe(0);
    expect(dispense).not.toHaveBeenCalled();
  });

  it('si el proveedor dice que el cobro ya no vale, bloquea en vez de entregar', async () => {
    PaymentPG.findReleasable.mockResolvedValue([heldOrder()]);
    fiat.configure({ dispense, verifyProviderCharge: async () => ({ ok: false, reason: 'REFUNDED' }) });

    const res = await fiat.releaseDueSettlements();

    expect(res.delivered).toBe(0);
    expect(dispense).not.toHaveBeenCalled();
    expect(PaymentPG.blockSettlement).toHaveBeenCalledWith(PI, 'REFUNDED');
  });

  it('si no se puede comprobar con el proveedor, pospone — no entrega a ciegas', async () => {
    PaymentPG.findReleasable.mockResolvedValue([heldOrder()]);
    fiat.configure({
      dispense,
      verifyProviderCharge: async () => { throw new Error('Stripe caído'); },
    });

    const res = await fiat.releaseDueSettlements();

    expect(res.delivered).toBe(0);
    expect(dispense).not.toHaveBeenCalled();
    // No la bloquea: el cobro puede ser perfectamente válido, se reintenta.
    expect(PaymentPG.blockSettlement).not.toHaveBeenCalled();
  });

  it('si otro liberador ganó el claim, no entrega dos veces', async () => {
    PaymentPG.findReleasable.mockResolvedValue([heldOrder()]);
    PaymentPG.claimForSettlement.mockResolvedValue(null);

    const res = await fiat.releaseDueSettlements();

    expect(res.delivered).toBe(0);
    expect(dispense).not.toHaveBeenCalled();
  });

  it('una orden sin bezAmount no se entrega, se marca para revisión', async () => {
    PaymentPG.findReleasable.mockResolvedValue([heldOrder()]);
    PaymentPG.claimForSettlement.mockResolvedValue(heldOrder({ bez_amount: null }));

    const res = await fiat.releaseDueSettlements();

    expect(res.failed).toBe(1);
    expect(dispense).not.toHaveBeenCalled();
    expect(PaymentPG.markSettlementFailed).toHaveBeenCalled();
  });

  it('si el dispensado falla, queda marcado (el cliente ya pagó)', async () => {
    PaymentPG.findReleasable.mockResolvedValue([heldOrder()]);
    dispense.mockRejectedValue(new Error('hot wallet sin gas'));

    const res = await fiat.releaseDueSettlements();

    expect(res.failed).toBe(1);
    expect(PaymentPG.markSettlementFailed).toHaveBeenCalledWith(
      'BEZ-TEST-0001', expect.stringContaining('DELIVERY_FAILED')
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('disputas y reembolsos', () => {
  it('una disputa dentro del plazo bloquea la entrega', async () => {
    PaymentPG.blockSettlement.mockResolvedValue(heldOrder({ status: 'failed' }));

    const res = await fiat.cancelFiatSettlement({
      providerReference: PI, reason: 'charge.dispute.created',
    });

    expect(res.blocked).toBe(true);
    expect(PaymentPG.blockSettlement).toHaveBeenCalledWith(PI, 'charge.dispute.created');
  });

  it('bloqueada ya no se libera aunque venza el plazo', async () => {
    // findReleasable excluye las bloqueadas — se comprueba que el barrido
    // sólo mira lo que esa consulta devuelve.
    PaymentPG.findReleasable.mockResolvedValue([]);
    const res = await fiat.releaseDueSettlements();
    expect(res.delivered).toBe(0);
    expect(dispense).not.toHaveBeenCalled();
  });

  it('una disputa sobre un pago YA entregado se reporta como pérdida', async () => {
    PaymentPG.blockSettlement.mockResolvedValue(null);
    PaymentPG.findByProviderReference.mockResolvedValue(
      heldOrder({ settled_at: new Date(), status: 'completed' })
    );

    const res = await fiat.cancelFiatSettlement({ providerReference: PI, reason: 'chargeback' });

    // El token ya salió: el código no puede deshacerlo, sólo señalarlo.
    expect(res.blocked).toBe(false);
    expect(res.alreadyDelivered).toBe(true);
  });

  it('una referencia desconocida no revienta', async () => {
    const res = await fiat.cancelFiatSettlement({ providerReference: 'pi_no_existe' });
    expect(res.notFound).toBe(true);
  });
});
