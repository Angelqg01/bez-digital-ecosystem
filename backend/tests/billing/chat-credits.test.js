/** Créditos del chat: cuota del plan → créditos comprados → 402 con opciones; compra de packs y mejora de plan. */
const express = require('express');
const request = require('supertest');

jest.mock('../../middleware/auth.middleware', () => ({
    protect: (req, res, next) => {
        const raw = req.headers['x-test-user'];
        if (!raw) return res.status(401).json({ error: 'Not authorized' });
        req.user = JSON.parse(raw);
        next();
    },
}));
const mockUsers = new Map();
jest.mock('../../models/pg/User', () => ({
    findById: async (id) => mockUsers.get(String(id)) || null,
    update: async (id, patch) => { const n = { ...mockUsers.get(String(id)), ...patch }; mockUsers.set(String(id), n); return n; },
}));

process.env.AI_CREDITS_ENFORCE = 'true';
process.env.AI_CREDITS_LIMIT_OVERRIDE = '2'; // starter y creator: 2 mensajes/día para probar
process.env.KNOWLEDGE_AUTOSEED = 'false';
process.env.AI_WORKSPACE_RATE_LIMIT = '1000';
process.env.AI_WORKSPACE_READ_RATE_LIMIT = '1000';
process.env.AI_WORKSPACE_IP_RATE_LIMIT = '1000';
process.env.FRONTEND_URL = 'https://www.bezhas.com';
process.env.STRIPE_SECRET_KEY = 'sk_test_unit';
process.env.CHECKOUT_RATE_LIMIT = '1000';
delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.AI_PROVIDER;

const { getCreditService } = require('../../services/ai-workspace/credits');
const billing = require('../../services/billing-checkout.service');
const { getPack } = require('../../config/credit-packs');
const aiRouter = require('../../routes/ai-workspace.routes');
const checkoutRouter = require('../../routes/checkout.routes');

const app = express();
app.use(express.json());
app.use('/api/ai-workspace', aiRouter);
app.use('/api/checkout', checkoutRouter);

let n = 0;
const newUser = (extra = {}) => ({ id: `cu${++n}`, roles: ['USER'], subscription: 'FREE', ...extra });
const as = (u) => JSON.stringify(u);
const chat = (u, message = 'hola') => request(app).post('/api/ai-workspace/chat').set('x-test-user', as(u)).send({ message });

describe('consumo de créditos del chat', () => {
    test('usa la cuota del plan y al agotarla responde 402 con la opción de suscribirse', async () => {
        const u = newUser();
        expect((await chat(u)).status).toBe(200);
        expect((await chat(u)).status).toBe(200);
        const r = await chat(u);
        expect(r.status).toBe(402);
        expect(r.body).toMatchObject({ code: 'CREDITS_EXHAUSTED', kind: 'subscribe', plan: 'starter', upgradeActionId: 'subscribe_plans' });
        expect(r.body.packs.length).toBeGreaterThan(0);
        expect(r.body.usage).toMatchObject({ dailyLimit: 2, dailyUsed: 2, credits: 0 });
    });

    test('con plan de pago agotado ofrece mejorar de plan o comprar créditos', async () => {
        const u = newUser({ subscription: 'CREATOR' });
        await chat(u); await chat(u);
        const r = await chat(u);
        expect(r.status).toBe(402);
        expect(r.body).toMatchObject({ kind: 'upgrade', plan: 'creator' });
    });

    test('los créditos comprados se usan cuando se agota la cuota, y se acaban', async () => {
        const u = newUser();
        await chat(u); await chat(u);
        await getCreditService().store.addCredits(u.id, 2);
        expect((await chat(u)).status).toBe(200);
        expect((await chat(u)).status).toBe(200);
        expect((await chat(u)).status).toBe(402);
    });

    test('un mensaje rechazado antes del modelo (vacío) no consume crédito', async () => {
        const u = newUser();
        expect((await chat(u, '')).status).toBeGreaterThanOrEqual(400);
        expect((await chat(u)).status).toBe(200);
        expect((await chat(u)).status).toBe(200);
    });

    test('los administradores no se miden y GET /credits informa del saldo', async () => {
        const admin = newUser({ roles: ['ADMIN'] });
        for (let i = 0; i < 5; i++) expect((await chat(admin)).status).toBe(200);
        const u = newUser();
        await chat(u);
        const r = await request(app).get('/api/ai-workspace/credits').set('x-test-user', as(u));
        expect(r.body).toMatchObject({ plan: 'starter', dailyUsed: 1, credits: 0 });
        expect(r.body.packs[0]).toHaveProperty('priceEur');
    });

    test('el stream también responde 402 antes de abrir el flujo', async () => {
        const u = newUser();
        await chat(u); await chat(u);
        const r = await request(app).post('/api/ai-workspace/chat/stream').set('x-test-user', as(u)).send({ message: 'hola' });
        expect(r.status).toBe(402);
        expect(r.body.code).toBe('CREDITS_EXHAUSTED');
    });
});

describe('compra de créditos con Stripe', () => {
    const created = [];
    const stripe = {
        checkout: { sessions: { create: async (p) => { created.push(p); return { id: 'cs_test_abcdefghij123', url: 'https://checkout.stripe.com/c/pay/cs_test_abcdefghij123' }; } } },
    };
    beforeEach(() => { created.length = 0; billing._setStripeForTests(stripe); });

    test('crea el pago con precio del servidor y la sesión del usuario', async () => {
        const u = newUser({ email: 'a@b.c' });
        mockUsers.set(u.id, u);
        const r = await request(app).post('/api/checkout/credits').set('x-test-user', as(u)).send({ packId: 'chat_500', price: 1, credits: 99999, userId: 'otro' });
        expect(r.status).toBe(200);
        const p = created[0];
        expect(p.mode).toBe('payment');
        expect(p.line_items[0].price_data.unit_amount).toBe(2000);
        expect(p.client_reference_id).toBe(u.id);
        expect(p.metadata).toMatchObject({ source: 'bezhas_credits', bz_user_id: u.id, bz_pack: 'chat_500' });
        expect(JSON.stringify(p)).not.toContain('99999');
    });

    test.each([['nope'], [undefined], ['../x'], [5]])('rechaza pack %p', async (packId) => {
        const r = await request(app).post('/api/checkout/credits').set('x-test-user', as(newUser())).send({ packId });
        expect(r.status).toBe(400);
        expect(created).toHaveLength(0);
    });

    const session = (u, over = {}) => ({
        id: `cs_test_${u.id}_x1234567890`, mode: 'payment', payment_status: 'paid', currency: 'eur', amount_total: 2000,
        client_reference_id: u.id, metadata: { source: 'bezhas_credits', bz_user_id: u.id, bz_pack: 'chat_500' }, ...over,
    });
    const ev = (s) => ({ id: 'evt_1', type: 'checkout.session.completed', data: { object: s } });

    test('el webhook suma los créditos una sola vez', async () => {
        const u = newUser(); mockUsers.set(u.id, u);
        const store = getCreditService().store;
        expect((await billing.handleEvent(ev(session(u)))).granted).toBe(true);
        expect((await billing.handleEvent(ev(session(u)))).granted).toBe(false); // repetido
        expect((await store.snapshot(u.id, { dayKey: 'd', monthKey: 'm' })).credits).toBe(getPack('chat_500').credits);
    });

    test.each([
        ['pago pendiente', { payment_status: 'unpaid' }, false],
        ['importe menor al del pack', { amount_total: 100 }, false],
        ['otra divisa', { currency: 'usd' }, false],
        ['sesión de otro usuario', { client_reference_id: 'otro' }, false],
    ])('no entrega créditos: %s', async (_n, over, granted) => {
        const u = newUser(); mockUsers.set(u.id, u);
        const r = await billing.handleEvent(ev(session(u, over)));
        expect(r.granted).toBe(granted);
        expect((await getCreditService().store.snapshot(u.id, { dayKey: 'd', monthKey: 'm' })).credits).toBe(0);
    });
});

describe('quien ya está suscrito mejora la suscripción en lugar de abrir otra', () => {
    const calls = { update: [], retrieve: 0, create: 0 };
    const sub = (over = {}) => ({ id: 'sub_1', status: 'active', metadata: { bz_user_id: 'x' }, items: { data: [{ id: 'si_1', price: { product: 'prod_1' } }] }, ...over });
    let current;
    beforeEach(() => {
        calls.update = []; calls.retrieve = 0; calls.create = 0;
        billing._setStripeForTests({
            subscriptions: {
                retrieve: async () => { calls.retrieve++; return current; },
                update: async (id, params) => { calls.update.push({ id, params }); return {}; },
            },
            checkout: { sessions: { create: async () => { calls.create++; return { id: 'cs_test_abcdefghij123', url: 'https://checkout.stripe.com/x' }; } } },
        });
    });
    const subscribed = (plan = 'CREATOR') => {
        const u = newUser({ subscription: plan, stripe_subscription_id: 'sub_1', email: 'a@b.c' });
        mockUsers.set(u.id, u);
        current = sub({ metadata: { bz_user_id: u.id } });
        return u;
    };
    const post = (u, body) => request(app).post('/api/checkout/plan').set('x-test-user', as(u)).send(body);

    test('mejora a un plan superior cobrando la diferencia y sin abrir otro checkout', async () => {
        const u = subscribed('CREATOR');
        const r = await post(u, { planId: 'business', cycle: 'monthly' });
        expect(r.status).toBe(200);
        expect(r.body).toMatchObject({ upgraded: true, plan: 'business' });
        expect(r.body.url).toBeUndefined();
        expect(calls.create).toBe(0);
        const { params } = calls.update[0];
        expect(params.proration_behavior).toBe('always_invoice');
        expect(params.payment_behavior).toBe('error_if_incomplete');
        expect(params.items[0].price_data.unit_amount).toBe(49900);
        expect(mockUsers.get(u.id).subscription).toBe('BUSINESS');
    });

    test.each([['creator'], ['starter']])('no deja suscribirse de nuevo al mismo plan ni a uno inferior (%s)', async (plan) => {
        const u = subscribed('CREATOR');
        const r = await post(u, { planId: plan, cycle: 'monthly' });
        expect([400, 409]).toContain(r.status);
        expect(calls.update).toHaveLength(0);
        expect(calls.create).toBe(0);
    });

    test('no toca una suscripción que no es de esta persona', async () => {
        const u = subscribed('CREATOR');
        current = sub({ metadata: { bz_user_id: 'otra-persona' } });
        const r = await post(u, { planId: 'business', cycle: 'monthly' });
        expect(r.status).toBe(409);
        expect(calls.update).toHaveLength(0);
    });
});
