/**
 * Pagos con Stripe desde el chat: creación de sesiones (plan y BEZ) y estado del plan por usuario.
 * El cobro, la retención y la entrega de BEZ los cubre webhooks-fiat-hold.test.js; aquí, lo que hace este
 * servicio: fijar precio e identidad en el servidor y negarse cuando no es seguro.
 */
const crypto = require('crypto');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { mockQuery } = require('../helpers');

const app = require('../../index');
const chatCheckout = require('../../services/chatCheckout');
const { getPlan } = require('../../config/plans');

let UID = crypto.randomUUID(); // un usuario nuevo por test: el limitador de pagos es por usuario
const WALLET = '0x' + 'ab'.repeat(20);
const sesion = (userId = UID) => ({ Authorization: `Bearer ${jwt.sign({ address: WALLET, userId, role: 'user' }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' })}` });

const create = jest.fn();
let usuario; let plan;
beforeEach(() => {
    jest.clearAllMocks();
    UID = crypto.randomUUID();
    process.env.CHAT_CHECKOUT_RETURN_BASE = 'https://bezhas.com';
    create.mockResolvedValue({ url: 'https://checkout.stripe.com/c/pay/cs_live_abc', id: 'cs_1' });
    chatCheckout.__setStripe({ checkout: { sessions: { create } } });
    usuario = { id: UID, email: 'ana@bezhas.com', auth_type: 'wallet', custody_mode: 'external', wallet_address: WALLET, primary_wallet_address: WALLET, primary_smart_wallet_address: null };
    plan = null; // plan contratado
    mockQuery.mockReset();
    mockQuery.mockImplementation(async (sql) => {
        if (/FROM user_subscriptions/.test(sql) && /plan_id/.test(sql) && /status = 'active'/.test(sql)) return { rows: plan ? [{ plan_id: plan }] : [] };
        if (/stripe_customer_id FROM user_subscriptions/.test(sql)) return { rows: [] };
        if (/FROM users WHERE id/.test(sql)) return { rows: [usuario] };
        return { rows: [], rowCount: 0 };
    });
});

const pagar = (ruta, body, headers = sesion()) => request(app).post(`/api/checkout${ruta}`).set(headers).send(body);

describe('POST /api/checkout/plan', () => {
    it('sin sesión → 401/403 y no toca Stripe', async () => {
        const res = await request(app).post('/api/checkout/plan').send({ planId: 'business' });
        expect([401, 403]).toContain(res.status);
        expect(create).not.toHaveBeenCalled();
    });

    it('crea una suscripción con el precio REAL del servidor y la identidad de la sesión', async () => {
        const res = await pagar('/plan', { planId: 'business', cycle: 'monthly' });
        expect(res.status).toBe(200);
        expect(res.body.url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
        const arg = create.mock.calls[0][0];
        expect(arg.mode).toBe('subscription');
        expect(arg.line_items).toEqual([{ price: getPlan('business').stripe.monthlyPriceId, quantity: 1 }]);
        expect(arg.client_reference_id).toBe(UID);
        expect(arg.metadata).toMatchObject({ kind: 'chat_plan', plan_id: 'business', billing: 'monthly', user_id: UID });
        expect(arg.subscription_data.metadata.user_id).toBe(UID);
        expect(arg.success_url).toBe('https://bezhas.com/?checkout=success&kind=plan&session_id={CHECKOUT_SESSION_ID}');
        expect(arg.cancel_url).toBe('https://bezhas.com/?checkout=cancelled&kind=plan');
    });

    it('ciclo anual usa el precio anual', async () => {
        await pagar('/plan', { planId: 'creator_pro', cycle: 'yearly' });
        expect(create.mock.calls[0][0].line_items[0].price).toBe(getPlan('creator_pro').stripe.annualPriceId);
        expect(create.mock.calls[0][0].metadata.billing).toBe('annual');
    });

    it('el cliente NO puede imponer precio, usuario, destino ni moneda', async () => {
        await pagar('/plan', { planId: 'business', price: 'price_gratis', user_id: 'otro', success_url: 'https://evil.example', amount: 1, client_reference_id: 'otro' });
        const arg = create.mock.calls[0][0];
        expect(arg.line_items[0].price).toBe(getPlan('business').stripe.monthlyPriceId);
        expect(arg.client_reference_id).toBe(UID);
        expect(JSON.stringify(arg)).not.toMatch(/evil\.example|price_gratis|"otro"/);
    });

    it.each([['starter'], ['no_existe'], [''], [null], [{ a: 1 }], ['../admin']])('plan no comprable %j → 400', async (planId) => {
        expect((await pagar('/plan', { planId })).status).toBe(400);
        expect(create).not.toHaveBeenCalled();
    });

    it('ciclo inválido → 400', async () => {
        expect((await pagar('/plan', { planId: 'business', cycle: 'weekly' })).status).toBe(400);
    });

    it('ya tiene ese plan → 409, no se cobra dos veces', async () => {
        plan = 'business';
        const res = await pagar('/plan', { planId: 'business' });
        expect(res.status).toBe(409);
        expect(create).not.toHaveBeenCalled();
    });

    it('un error de Stripe no filtra detalles al cliente', async () => {
        create.mockRejectedValueOnce(Object.assign(new Error('No such price: price_1TPf… (acct_1KbkSO…)'), { type: 'StripeInvalidRequestError' }));
        const res = await pagar('/plan', { planId: 'business' });
        expect(res.status).toBe(502);
        expect(JSON.stringify(res.body)).not.toMatch(/acct_|price_1|No such price/);
    });

    it('sin STRIPE_SECRET_KEY responde 503 claro', async () => {
        chatCheckout.__setStripe(null);
        const k = process.env.STRIPE_SECRET_KEY; delete process.env.STRIPE_SECRET_KEY;
        try { expect((await pagar('/plan', { planId: 'business' })).status).toBe(503); } finally { process.env.STRIPE_SECRET_KEY = k; }
    });

    it('el retorno nunca es http fuera de desarrollo', async () => {
        process.env.CHAT_CHECKOUT_RETURN_BASE = 'http://evil.example';
        expect((await pagar('/plan', { planId: 'business' })).status).toBe(503);
    });
});

describe('POST /api/checkout/bez', () => {
    it('crea un pago único en EUR a la wallet de la CUENTA, con el importe en céntimos', async () => {
        const res = await pagar('/bez', { amountEur: 100 });
        expect(res.status).toBe(200);
        const arg = create.mock.calls[0][0];
        expect(arg.mode).toBe('payment');
        expect(arg.line_items[0].price_data).toMatchObject({ currency: 'eur', unit_amount: 10000 });
        expect(arg.client_reference_id).toBe(WALLET);              // el webhook lo lee de aquí
        expect(arg.metadata).toMatchObject({ kind: 'chat_bez', walletAddress: WALLET, user_id: UID });
        expect(arg.payment_intent_data.metadata.walletAddress).toBe(WALLET);
    });

    it('la wallet que manda el cliente se ignora: no se puede redirigir el BEZ a otra dirección', async () => {
        await pagar('/bez', { amountEur: 50, walletAddress: '0x' + 'ee'.repeat(20), wallet: '0x' + 'ee'.repeat(20), client_reference_id: '0x' + 'ee'.repeat(20) });
        const arg = create.mock.calls[0][0];
        expect(arg.client_reference_id).toBe(WALLET);
        expect(JSON.stringify(arg)).not.toMatch(/eeeeeeee/);
    });

    it.each([[9.99], [5000.01], ['abc'], [-10], [0], [null], [NaN], [10.005], [1e9]])('importe inválido %j → 400', async (amountEur) => {
        expect((await pagar('/bez', { amountEur })).status).toBe(400);
        expect(create).not.toHaveBeenCalled();
    });

    it('los límites 10 y 5000 son válidos', async () => {
        expect((await pagar('/bez', { amountEur: 10 })).status).toBe(200);
        expect((await pagar('/bez', { amountEur: 5000 })).status).toBe(200);
    });

    it('cuenta de email SIN wallet real (dirección provisional) → 409 y no se cobra', async () => {
        usuario = { ...usuario, auth_type: 'fiat', custody_mode: 'managed', primary_smart_wallet_address: null, wallet_address: '0x' + '9'.repeat(40) };
        const res = await pagar('/bez', { amountEur: 100 });
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('WALLET_REQUIRED');
        expect(create).not.toHaveBeenCalled();
    });

    it('cuenta de email con wallet gestionada ya provisionada → puede comprar', async () => {
        usuario = { ...usuario, auth_type: 'fiat', custody_mode: 'managed', primary_smart_wallet_address: '0x' + '2'.repeat(40) };
        expect((await pagar('/bez', { amountEur: 100 })).status).toBe(200);
    });

    it('límite de peticiones por usuario: cada llamada crea un objeto en Stripe', async () => {
        let ultimo;
        for (let i = 0; i < 8; i++) ultimo = await pagar('/bez', { amountEur: 20 }, sesion('22222222-2222-4222-8222-222222222222'));
        expect(ultimo.status).toBe(429);
        expect(create.mock.calls.length).toBeLessThan(8);
    });
});

describe('estado del plan por usuario (webhook)', () => {
    const sesionPlan = (extra = {}) => ({ id: 'cs_9', customer: 'cus_1', subscription: 'sub_1', client_reference_id: UID, metadata: { kind: 'chat_plan', plan_id: 'business', billing: 'monthly', user_id: UID }, ...extra });

    it('provisiona el plan del usuario (UPSERT) con cliente y suscripción de Stripe', async () => {
        await chatCheckout.provisionUserPlan(sesionPlan(), 'evt_1');
        const [sql, params] = mockQuery.mock.calls.find(([s]) => /INSERT INTO user_subscriptions/.test(s));
        expect(sql).toMatch(/ON CONFLICT \(user_id\)/);
        expect(params).toEqual([UID, 'business', 'monthly', 'cus_1', 'sub_1', 'evt_1']);
    });
    it('rechaza una sesión cuyo client_reference_id no es el usuario de los metadatos', async () => {
        await expect(chatCheckout.provisionUserPlan(sesionPlan({ client_reference_id: '33333333-3333-4333-8333-333333333333' }), 'e')).rejects.toThrow(/no coincide/);
    });
    it('rechaza un plan inventado', async () => {
        await expect(chatCheckout.provisionUserPlan(sesionPlan({ metadata: { kind: 'chat_plan', plan_id: 'gratis_total', user_id: UID } }), 'e')).rejects.toThrow();
    });
    it('cancelar la suscripción deja el plan en canceled; las ajenas al chat se ignoran', async () => {
        const ev = (obj, type = 'customer.subscription.deleted') => ({ id: 'evt_2', type, data: { object: obj } });
        expect(await chatCheckout.handleSubscriptionEvent(ev({ id: 'sub_1', status: 'canceled', metadata: { kind: 'chat_plan' } }))).toBe(true);
        expect(mockQuery.mock.calls.find(([s]) => /UPDATE user_subscriptions/.test(s))[1][1]).toBe('canceled');
        mockQuery.mockClear();
        expect(await chatCheckout.handleSubscriptionEvent(ev({ id: 'sub_x', status: 'active', metadata: {} }))).toBe(false);
        expect(mockQuery).not.toHaveBeenCalled();
    });
    it('una suscripción que sigue activa se mantiene y actualiza la renovación', async () => {
        await chatCheckout.handleSubscriptionEvent({ id: 'evt_3', type: 'customer.subscription.updated', data: { object: { id: 'sub_1', status: 'active', current_period_end: 1800000000, metadata: { kind: 'chat_plan' } } } });
        const [, params] = mockQuery.mock.calls.find(([s]) => /UPDATE user_subscriptions/.test(s));
        expect(params[1]).toBe('active');
        expect(params[2]).toBe(new Date(1800000000 * 1000).toISOString());
    });
});
