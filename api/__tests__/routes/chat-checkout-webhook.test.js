/** Webhook de Stripe con un plan comprado desde el chat: activa el plan del USUARIO y no toca BEZ ni api-keys. */
const crypto = require('crypto');
const express = require('express');
const request = require('supertest');
const { mockQuery } = require('../helpers');

// La verificación de firma es la REAL del SDK de Stripe (no un simulacro): una firma mala tiene que dar 400.
const realStripe = jest.requireActual('stripe')('sk_test_unused');
require('stripe').mockImplementation(() => ({
    webhooks: { constructEvent: (cuerpo, sig, secreto) => realStripe.webhooks.constructEvent(cuerpo, sig, secreto) },
}));
const rutas = require('../../routes/webhooks');

const UID = '44444444-4444-4444-8444-444444444444';
const firma = (payload) => {
    const t = Math.floor(Date.now() / 1000);
    return `t=${t},v1=${crypto.createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET).update(`${t}.${payload}`).digest('hex')}`;
};
const enviar = async (evento) => {
    const a = express(); a.use('/webhooks', rutas);
    const payload = JSON.stringify(evento);
    const res = await request(a).post('/webhooks/stripe').set('stripe-signature', firma(payload)).set('content-type', 'application/json').send(payload);
    await new Promise((r) => setTimeout(r, 80));
    return res;
};
const sqls = () => mockQuery.mock.calls.map(([s]) => s).join('\n');
const completada = (metadata, extra = {}) => ({ id: 'evt_9', type: 'checkout.session.completed', data: { object: { id: 'cs_9', payment_status: 'paid', customer: 'cus_1', subscription: 'sub_1', client_reference_id: UID, amount_total: 49900, currency: 'eur', metadata, ...extra } } });

beforeEach(() => { mockQuery.mockReset(); mockQuery.mockResolvedValue({ rows: [], rowCount: 1 }); });

describe('webhook /stripe · plan del chat', () => {
    it('chat_plan activa el plan del usuario y NO acuña BEZ ni toca gateway_subscriptions', async () => {
        const res = await enviar(completada({ kind: 'chat_plan', plan_id: 'business', billing: 'monthly', user_id: UID }));
        expect(res.status).toBe(200);
        expect(sqls()).toMatch(/INSERT INTO user_subscriptions/);
        expect(sqls()).not.toMatch(/gateway_subscriptions|payment_transactions/);
    });
    it('una sesión de chat_plan sin pagar no activa nada', async () => {
        await enviar(completada({ kind: 'chat_plan', plan_id: 'business', billing: 'monthly', user_id: UID }, { payment_status: 'unpaid' }));
        expect(sqls()).not.toMatch(/user_subscriptions/);
    });
    it('un chat_plan con client_reference_id ajeno no activa el plan', async () => {
        await enviar(completada({ kind: 'chat_plan', plan_id: 'business', billing: 'monthly', user_id: UID }, { client_reference_id: '55555555-5555-4555-8555-555555555555' }));
        expect(sqls()).not.toMatch(/INSERT INTO user_subscriptions/);
    });
    it('customer.subscription.deleted de un plan del chat lo marca como cancelado', async () => {
        const res = await enviar({ id: 'evt_10', type: 'customer.subscription.deleted', data: { object: { id: 'sub_1', status: 'canceled', metadata: { kind: 'chat_plan' } } } });
        expect(res.status).toBe(200);
        expect(sqls()).toMatch(/UPDATE user_subscriptions/);
    });
    it('una firma inválida se rechaza y no activa nada', async () => {
        const a = express(); a.use('/webhooks', rutas);
        const payload = JSON.stringify(completada({ kind: 'chat_plan', plan_id: 'business', user_id: UID }));
        const res = await request(a).post('/webhooks/stripe').set('stripe-signature', 't=1,v1=malafirma').set('content-type', 'application/json').send(payload);
        await new Promise((r) => setTimeout(r, 50));
        expect(sqls()).not.toMatch(/user_subscriptions/);
        expect(res.status).toBe(400);
    });
});
