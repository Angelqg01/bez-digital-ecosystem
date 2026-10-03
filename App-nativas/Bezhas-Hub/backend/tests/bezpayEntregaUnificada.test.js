/**
 * BezPay (Hub) con la regla unificada: sin fondos confirmados no hay entrega,
 * y la entrega se pide a la capa de seguridad de la API como intención.
 */
jest.mock('../models/pg/Payment', () => ({
  holdFiatPayment: jest.fn(),
  findReleasable: jest.fn(),
  blockSettlement: jest.fn(),
  findByProviderReference: jest.fn(),
  claimForSettlement: jest.fn(),
  markSettlementFailed: jest.fn(),
  updateByPaymentIntent: jest.fn(),
  setDeliveryState: jest.fn(),
  findPendingDeliveries: jest.fn(),
}));
jest.mock('../services/bezhasTxClient', () => ({
  crearEntrega: jest.fn(),
  obtener: jest.fn(),
  ejecutar: jest.fn(),
  cancelar: jest.fn(),
}));

const PaymentPG = require('../models/pg/Payment');
const txClient = require('../services/bezhasTxClient');
const fiat = require('../services/bezpayFiatSettlement');

const WALLET = '0x1111111111111111111111111111111111111111';
const orden = (extra = {}) => ({
  payment_intent_id: 'BEZ-0001', wallet_address: WALLET, bez_amount: '13333.33',
  provider_reference: 'pi_1', payment_method_kind: 'card', status: 'processing',
  settled_at: null, hold_until: new Date(Date.now() - 1000), metadata: {}, ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.BEZPAY_DELIVERY_MODE;
  PaymentPG.findReleasable.mockResolvedValue([orden()]);
  PaymentPG.claimForSettlement.mockImplementation(async () => orden());
  PaymentPG.setDeliveryState.mockResolvedValue({});
  PaymentPG.markSettlementFailed.mockResolvedValue(undefined);
  PaymentPG.updateByPaymentIntent.mockResolvedValue(undefined);
  PaymentPG.blockSettlement.mockResolvedValue(null);
});

describe('verificación de fondos', () => {
  it('sin STRIPE_SECRET_KEY no se entrega nada (antes: se entregaba sin comprobar)', async () => {
    const previa = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    const dispense = jest.fn();
    fiat.configure({ dispense, verifyProviderCharge: undefined });
    try {
      const r = await fiat.releaseDueSettlements();
      expect(dispense).not.toHaveBeenCalled();
      expect(PaymentPG.claimForSettlement).not.toHaveBeenCalled();
      expect(r.skipped).toBe(1);
      // Reintentable: no se bloquea, se espera a poder comprobarlo.
      expect(PaymentPG.blockSettlement).not.toHaveBeenCalled();
    } finally {
      if (previa) process.env.STRIPE_SECRET_KEY = previa;
    }
  });

  it('un motivo de revisión manual bloquea la orden para una persona', async () => {
    fiat.configure({ dispense: jest.fn(), verifyProviderCharge: async () => ({ ok: false, reason: 'REVISION_MANUAL:SIN_3DS', retryable: false }) });
    await fiat.releaseDueSettlements();
    expect(PaymentPG.blockSettlement).toHaveBeenCalledWith('pi_1', 'REVISION_MANUAL:SIN_3DS');
  });
});

describe('entrega por intención (modo por defecto)', () => {
  beforeEach(() => {
    fiat.configure({
      dispense: null,
      verifyProviderCharge: async () => ({ ok: true, detalles: { titular: { nombre: 'Ana Pérez', pais: 'ES' } } }),
    });
  });

  it('con fondos confirmados pide la intención y NO marca la orden como completada', async () => {
    txClient.crearEntrega.mockResolvedValue({ id: 'int-1', estado: 'awaiting_approval', aprobacionesRequeridas: 2 });
    const r = await fiat.releaseDueSettlements();
    expect(txClient.crearEntrega).toHaveBeenCalledWith(expect.objectContaining({
      paymentId: 'BEZ-0001', wallet: WALLET, titular: { nombre: 'Ana Pérez', pais: 'ES' },
    }));
    expect(PaymentPG.setDeliveryState).toHaveBeenCalledWith('BEZ-0001', expect.objectContaining({ estado: 'pendiente_aprobacion', intentId: 'int-1' }));
    expect(PaymentPG.updateByPaymentIntent).not.toHaveBeenCalled();
    expect(r.pendingApproval).toBe(1);
  });

  it('si la API deniega la intención, la orden queda marcada, no entregada', async () => {
    txClient.crearEntrega.mockResolvedValue({ id: 'int-1', estado: 'denied', motivos: [{ code: 'TRAVEL_RULE_DATA_MISSING' }] });
    const r = await fiat.releaseDueSettlements();
    expect(r.failed).toBe(1);
    expect(PaymentPG.markSettlementFailed).toHaveBeenCalledWith('BEZ-0001', expect.stringContaining('TRAVEL_RULE_DATA_MISSING'));
  });

  it('seguimiento: aprobada → se reverifica, se ejecuta y se completa con su tx', async () => {
    const pendiente = orden({ settled_at: new Date(), metadata: { entrega: { estado: 'pendiente_aprobacion', intentId: 'int-1' } } });
    PaymentPG.findPendingDeliveries.mockResolvedValue([pendiente]);
    txClient.obtener.mockResolvedValue({ id: 'int-1', estado: 'approved' });
    txClient.ejecutar.mockResolvedValue({ id: 'int-1', estado: 'broadcast', txHash: '0x' + 'ab'.repeat(32) });
    const r = await fiat.seguirEntregas();
    expect(r.delivered).toBe(1);
    expect(PaymentPG.updateByPaymentIntent).toHaveBeenCalledWith('BEZ-0001', expect.objectContaining({ status: 'completed', txHash: '0x' + 'ab'.repeat(32) }));
  });

  it('seguimiento: una disputa aparecida durante la aprobación cancela y no ejecuta', async () => {
    fiat.configure({ verifyProviderCharge: async () => ({ ok: false, reason: 'DISPUTADO', retryable: false }) });
    PaymentPG.findPendingDeliveries.mockResolvedValue([
      orden({ settled_at: new Date(), metadata: { entrega: { estado: 'pendiente_aprobacion', intentId: 'int-1' } } }),
    ]);
    txClient.obtener.mockResolvedValue({ id: 'int-1', estado: 'approved' });
    const r = await fiat.seguirEntregas();
    expect(txClient.ejecutar).not.toHaveBeenCalled();
    expect(txClient.cancelar).toHaveBeenCalledWith('int-1', 'DISPUTADO');
    expect(r.blocked).toBe(1);
  });

  it('una disputa por webhook sobre una entrega pendiente cancela la intención', async () => {
    PaymentPG.findByProviderReference.mockResolvedValue(
      orden({ settled_at: new Date(), metadata: { entrega: { estado: 'pendiente_aprobacion', intentId: 'int-9' } } }),
    );
    txClient.cancelar.mockResolvedValue({});
    const r = await fiat.cancelFiatSettlement({ providerReference: 'pi_1', reason: 'charge.dispute.created' });
    expect(r).toMatchObject({ blocked: true, cancelledIntent: true });
    expect(txClient.cancelar).toHaveBeenCalledWith('int-9', 'charge.dispute.created');
  });
});
