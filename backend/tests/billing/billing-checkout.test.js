/**
 * Pagos reales con Stripe (planes + compra de BEZ) con Stripe simulado.
 * Cubre: precios del servidor, identidad de la sesión, URLs de retorno, activación
 * idempotente, bajas, renovaciones y la ruta HTTP (incluido el webhook firmado).
 */
const express = require('express');
const request = require('supertest');
const Stripe = require('stripe');

const mockUsers = new Map();
jest.mock('../../models/pg/User', () => ({
    findById: async (id) => mockUsers.get(String(id)) || null,
    update: async (id, patch) => {
        const cur = mockUsers.get(String(id));
        if (!cur) return null;
        const next = { ...cur, ...patch };
        mockUsers.set(String(id), next);
        return next;
    },
    findByStripeSubscription: async (sid) => [...mockUsers.values()].find((u) => u.stripeSubscriptionId === sid) || null,
    findByStripeCustomer: async (cid) => [...mockUsers.values()].find((u) => u.stripeCustomerId === cid) || null,
}));
jest.mock('../../middleware/auth.middleware', () => ({
    protect: (req, res, next) => {
        const raw = req.headers['x-test-user'];
        if (!raw) return res.status(401).json({ error: 'Not authorized' });
        req.user = JSON.parse(raw);
        next();
    },
}));

process.env.FRONTEND_URL = 'https://www.bezhas.com';
process.env.STRIPE_SECRET_KEY = 'sk_test_unit';
process.env.CHECKOUT_RATE_LIMIT = '1000';

const billing = require('../../services/billing-checkout.service');
const router = require('../../routes/checkout.routes');

const created = [];
// Las implementaciones se (re)definen en beforeEach: la config de Jest puede resetear los mocks entre tests.
const fakeStripe = {
    checkout: { sessions: { create: jest.fn(), retrieve: jest.fn() } },
    billingPortal: { sessions: { create: jest.fn() } },
};
function resetStripeMocks() {
    fakeStripe.checkout.sessions.create.mockImplementation(async (params) => {
        created.push(params);
        return { id: 'cs_test_abcdefghij123', url: 'https://checkout.stripe.com/c/pay/cs_test_abcdefghij123' };
    });
    fakeStripe.checkout.sessions.retrieve.mockImplementation(async (id) => ({
        id, status: 'complete', payment_status: 'paid', client_reference_id: 'u1',
        metadata: { source: billing.SOURCE_PLAN, bz_plan: 'creator' },
    }));
    fakeStripe.billingPortal.sessions.create.mockImplementation(async () => ({ url: 'https://billing.stripe.com/p/session/x' }));
}

const app = express();
app.use(express.json());
app.use('/api/checkout', router);
const as = (u) => JSON.stringify(u);

beforeEach(() => {
    created.length = 0;
    mockUsers.clear();
    mockUsers.set('u1', { id: 'u1', email: 'a@b.c', subscription: 'FREE', walletAddress: '0x' + 'a'.repeat(40) });
    resetStripeMocks();
    billing._setStripeForTests(fakeStripe);
});

describe('catálogo', () => {
    test('GET /plans es público y trae precios del servidor', async () => {
        const r = await request(app).get('/api/checkout/plans');
        expect(r.status).toBe(200);
        const byId = Object.fromEntries(r.body.plans.map((p) => [p.id, p]));
        expect(byId.creator.priceMonthly).toBe(99);
        expect(byId.starter.purchasable).toBe(false);
    });
});

describe('POST /plan', () => {
    test('requiere sesión', async () => {
        expect((await request(app).post('/api/checkout/plan').send({ planId: 'creator', cycle: 'monthly' })).status).toBe(401);
    });

    test('crea Checkout con precio del servidor, identidad de la sesión y URLs de FRONTEND_URL', async () => {
        const r = await request(app).post('/api/checkout/plan').set('x-test-user', as({ id: 'u1', email: 'a@b.c' }))
            // un cliente hostil intenta imponer precio, usuario y redirección:
            .send({ planId: 'creator', cycle: 'monthly', price: 1, userId: 'victima', successUrl: 'https://evil.test' });
        expect(r.status).toBe(200);
        expect(r.body.url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
        const p = created[0];
        expect(p.mode).toBe('subscription');
        expect(p.client_reference_id).toBe('u1');
        expect(p.metadata.bz_user_id).toBe('u1');
        expect(p.success_url.startsWith('https://www.bezhas.com/')).toBe(true);
        expect(p.cancel_url.startsWith('https://www.bezhas.com/')).toBe(true);
        expect(JSON.stringify(p)).not.toContain('evil.test');
        expect(p.line_items[0].price_data.unit_amount).toBe(9900);
    });

    test.each([['starter', 'monthly'], ['admin', 'monthly'], ['creator', 'weekly'], [undefined, undefined]])(
        'rechaza plan/ciclo no válidos (%s, %s)', async (planId, cycle) => {
            const r = await request(app).post('/api/checkout/plan').set('x-test-user', as({ id: 'u1' })).send({ planId, cycle });
            expect(r.status).toBe(400);
            expect(created).toHaveLength(0);
        });

    test('sin STRIPE_SECRET_KEY responde 503 sin filtrar detalles', async () => {
        billing._setStripeForTests(null);
        const key = process.env.STRIPE_SECRET_KEY;
        delete process.env.STRIPE_SECRET_KEY;
        const r = await request(app).post('/api/checkout/plan').set('x-test-user', as({ id: 'u1' })).send({ planId: 'creator', cycle: 'monthly' });
        process.env.STRIPE_SECRET_KEY = key;
        expect(r.status).toBe(503);
        expect(r.body.code).toBe('PAYMENTS_UNAVAILABLE');
    });

    test('un error desconocido de Stripe no se filtra al cliente', async () => {
        fakeStripe.checkout.sessions.create.mockRejectedValueOnce(new Error('No such price: price_SECRETO'));
        const r = await request(app).post('/api/checkout/plan').set('x-test-user', as({ id: 'u1' })).send({ planId: 'creator', cycle: 'monthly' });
        expect(r.status).toBe(500);
        expect(JSON.stringify(r.body)).not.toContain('SECRETO');
    });

    test('rechaza una URL de pago fuera de Stripe', async () => {
        fakeStripe.checkout.sessions.create.mockResolvedValueOnce({ id: 'cs_test_abcdefghij123', url: 'https://evil.test/pay' });
        const r = await request(app).post('/api/checkout/plan').set('x-test-user', as({ id: 'u1' })).send({ planId: 'creator', cycle: 'monthly' });
        expect(r.status).toBe(502);
        expect(JSON.stringify(r.body)).not.toContain('evil.test');
    });
});

describe('POST /bez', () => {
    const post = (body, user = { id: 'u1', walletAddress: '0x' + 'a'.repeat(40) }) =>
        request(app).post('/api/checkout/bez').set('x-test-user', as(user)).send(body);

    test('crea pago en EUR a la wallet vinculada de la cuenta', async () => {
        const r = await post({ amountEur: 25, walletAddress: '0x' + 'b'.repeat(40) });
        expect(r.status).toBe(200);
        const p = created[0];
        expect(p.mode).toBe('payment');
        expect(p.line_items[0].price_data.currency).toBe('eur');
        expect(p.line_items[0].price_data.unit_amount).toBe(2500);
        expect(p.metadata.walletAddress).toBe('0x' + 'a'.repeat(40)); // la del usuario, no la del body
    });

    test.each([[1], [5001], [10.123], ['abc'], [-5], [null]])('rechaza importe %p', async (amountEur) => {
        expect((await post({ amountEur })).status).toBe(400);
        expect(created).toHaveLength(0);
    });

    test('exige wallet vinculada', async () => {
        const r = await post({ amountEur: 20 }, { id: 'u1' });
        expect(r.status).toBe(409);
        expect(r.body.code).toBe('WALLET_REQUIRED');
    });
});

describe('sesiones y portal', () => {
    test('una sesión ajena se reporta como inexistente', async () => {
        const r = await request(app).get('/api/checkout/session/cs_test_abcdefghij123').set('x-test-user', as({ id: 'otro' }));
        expect(r.status).toBe(404);
    });
    test('la propia sesión se ve', async () => {
        const r = await request(app).get('/api/checkout/session/cs_test_abcdefghij123').set('x-test-user', as({ id: 'u1' }));
        expect(r.body).toMatchObject({ paymentStatus: 'paid', kind: 'plan' });
    });
    test('id de sesión con formato inválido', async () => {
        expect((await request(app).get('/api/checkout/session/../etc').set('x-test-user', as({ id: 'u1' }))).status).toBeGreaterThanOrEqual(400);
        expect((await request(app).get('/api/checkout/session/xyz').set('x-test-user', as({ id: 'u1' }))).status).toBe(400);
    });
    test('portal exige suscripción previa', async () => {
        expect((await request(app).post('/api/checkout/portal').set('x-test-user', as({ id: 'u1' }))).status).toBe(409);
        const r = await request(app).post('/api/checkout/portal').set('x-test-user', as({ id: 'u1', stripe_customer_id: 'cus_1' }));
        expect(r.body.url).toMatch(/^https:\/\/billing\.stripe\.com\//);
    });
});

describe('activación por webhook', () => {
    const session = (over = {}) => ({
        id: 'cs_test_abcdefghij123', mode: 'subscription', payment_status: 'paid', client_reference_id: 'u1',
        customer: 'cus_1', subscription: 'sub_1', amount_total: 9900,
        metadata: { source: billing.SOURCE_PLAN, bz_user_id: 'u1', bz_plan: 'creator', bz_cycle: 'monthly' }, ...over,
    });
    const ev = (type, object) => ({ id: 'evt_1', type, data: { object } });

    test('activa el plan y es idempotente', async () => {
        const r1 = await billing.handleEvent(ev('checkout.session.completed', session()));
        expect(r1).toMatchObject({ activated: true, plan: 'CREATOR' });
        const first = { ...mockUsers.get('u1') };
        await billing.handleEvent(ev('checkout.session.completed', session()));
        expect(mockUsers.get('u1').subscription).toBe('CREATOR');
        expect(mockUsers.get('u1').stripeSubscriptionId).toBe('sub_1');
        expect(first.subscription).toBe('CREATOR');
    });

    test('no activa si el pago está pendiente', async () => {
        const r = await billing.handleEvent(ev('checkout.session.completed', session({ payment_status: 'unpaid' })));
        expect(r.activated).toBe(false);
        expect(mockUsers.get('u1').subscription).toBe('FREE');
    });

    test('rechaza sesión cuyo cliente no coincide con el usuario de los metadatos', async () => {
        const r = await billing.handleEvent(ev('checkout.session.completed', session({ client_reference_id: 'otro' })));
        expect(r.activated).toBe(false);
        expect(mockUsers.get('u1').subscription).toBe('FREE');
    });

    test('ignora sesiones de otros orígenes y no activa planes no comprables', async () => {
        expect((await billing.handleEvent(ev('checkout.session.completed', session({ metadata: { type: 'nft_purchase' } })))).handled).toBe(false);
        const r = await billing.handleEvent(ev('checkout.session.completed',
            session({ metadata: { source: billing.SOURCE_PLAN, bz_user_id: 'u1', bz_plan: 'enterprise_gratis', bz_cycle: 'monthly' } })));
        expect(r.activated).toBe(false);
    });

    test('baja al cancelarse y la renovación extiende la caducidad', async () => {
        await billing.handleEvent(ev('checkout.session.completed', session()));
        const end = Math.floor(Date.now() / 1000) + 40 * 86400;
        await billing.handleEvent(ev('invoice.payment_succeeded', { id: 'in_1', subscription: 'sub_1', lines: { data: [{ period: { end } }] } }));
        expect(new Date(mockUsers.get('u1').subscriptionExpiresAt).getTime()).toBe(end * 1000);
        await billing.handleEvent(ev('customer.subscription.deleted', { id: 'sub_1' }));
        expect(mockUsers.get('u1').subscription).toBe('FREE');
        expect(mockUsers.get('u1').stripeSubscriptionId).toBeNull();
    });

    test('un impago solo se audita, no da de baja', async () => {
        await billing.handleEvent(ev('checkout.session.completed', session()));
        await billing.handleEvent(ev('invoice.payment_failed', { id: 'in_2', subscription: 'sub_1', attempt_count: 1 }));
        expect(mockUsers.get('u1').subscription).toBe('CREATOR');
    });
});

describe('firma del webhook', () => {
    test('verifica la firma con el secreto: sin firma válida no hay activación', async () => {
        const secret = 'whsec_unit_test';
        const payload = JSON.stringify({ id: 'evt_x', type: 'checkout.session.completed', data: { object: {} } });
        const stripe = new Stripe('sk_test_unit');
        const good = stripe.webhooks.generateTestHeaderString({ payload, secret });
        expect(() => stripe.webhooks.constructEvent(payload, good, secret)).not.toThrow();
        expect(() => stripe.webhooks.constructEvent(payload, good, 'whsec_otro')).toThrow();
        expect(() => stripe.webhooks.constructEvent(payload + ' ', good, secret)).toThrow();
    });
});
