/**
 * El webhook de Stripe enruta el ciclo de vida de los planes a
 * services/planSubscriptions.
 */
const crypto = require('crypto');
const express = require('express');
const request = require('supertest');
const { mockQuery } = require('../helpers');

jest.mock('../../services/planSubscriptions', () => ({
    registrarCompra: jest.fn(async () => ({ estado: 'pendiente' })),
    alCambiarSuscripcion: jest.fn(async () => ({ estado: 'canceled', apps: [] })),
    alReembolsar: jest.fn(async () => ({ accion: 'plan_cancelado' })),
}));
const planes = require('../../services/planSubscriptions');

require('stripe').mockImplementation(() => ({
    webhooks: { constructEvent: (cuerpo) => JSON.parse(Buffer.isBuffer(cuerpo) ? cuerpo.toString('utf8') : cuerpo) },
}));
const rutas = require('../../routes/webhooks');

function enviar(evento) {
    const payload = JSON.stringify(evento);
    const t = Math.floor(Date.now() / 1000);
    const firma = `t=${t},v1=${crypto.createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET).update(`${t}.${payload}`).digest('hex')}`;
    const a = express();
    a.use('/webhooks', rutas);
    return request(a).post('/webhooks/stripe').set('stripe-signature', firma).set('content-type', 'application/json').send(payload);
}
const esperar = () => new Promise((r) => setTimeout(r, 30));

beforeEach(() => { jest.clearAllMocks(); mockQuery.mockReset(); mockQuery.mockResolvedValue({ rows: [], rowCount: 0 }); });

it('checkout de un plan → registrarCompra', async () => {
    const s = { id: 'cs_live_1', payment_status: 'paid', metadata: { plan_id: 'creator_pro' } };
    expect((await enviar({ id: 'evt_1', type: 'checkout.session.completed', data: { object: s } })).status).toBe(200);
    await esperar();
    expect(planes.registrarCompra).toHaveBeenCalledWith(s, { eventId: 'evt_1' });
});

it.each([
    ['customer.subscription.deleted', true],
    ['customer.subscription.updated', false],
])('%s → alCambiarSuscripcion(borrada=%s)', async (type, borrada) => {
    expect((await enviar({ id: 'evt_2', type, data: { object: { id: 'sub_1', status: 'canceled' } } })).status).toBe(200);
    await esperar();
    expect(planes.alCambiarSuscripcion).toHaveBeenCalledWith({ id: 'sub_1', status: 'canceled' }, { borrada });
});

it('reembolso de un plan: no se busca ninguna compra de BEZ que revertir', async () => {
    const r = await enviar({ id: 'evt_3', type: 'charge.refunded', data: { object: { id: 'ch_1', payment_intent: 'pi_1', refunded: true, customer: 'cus_1' } } });
    expect(r.status).toBe(200);
    await esperar();
    expect(planes.alReembolsar).toHaveBeenCalled();
    expect(mockQuery).not.toHaveBeenCalled();
});

it('reembolso que no es de un plan: sigue la vía de BEZ', async () => {
    planes.alReembolsar.mockResolvedValueOnce({ accion: 'ninguna' });
    await enviar({ id: 'evt_4', type: 'charge.refunded', data: { object: { id: 'ch_2', payment_intent: 'pi_2', refunded: true } } });
    await esperar();
    expect(mockQuery).toHaveBeenCalled();
});
