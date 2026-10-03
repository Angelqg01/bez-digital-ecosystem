/** Pagos desde el MCP: token OAuth ES256 con el scope billing.checkout (y solo con él). */
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockUsers = new Map([['u1', { id: 'u1', email: 'a@b.c', walletAddress: '0x' + 'a'.repeat(40) }]]);
jest.mock('../../models/pg/User', () => ({ findById: async (id) => mockUsers.get(String(id)) || null }));
jest.mock('../../middleware/auth.middleware', () => ({
    protect: (req, res, next) => res.status(401).json({ error: 'Not authorized' }),
}));

process.env.FRONTEND_URL = 'https://www.bezhas.com';
process.env.STRIPE_SECRET_KEY = 'sk_test_unit';
process.env.CHECKOUT_RATE_LIMIT = '1000';

const tokens = require('../../services/oauth/tokens');
const billing = require('../../services/billing-checkout.service');
const router = require('../../routes/checkout.routes');

const app = express();
app.use(express.json());
app.use('/api/checkout', router);

const created = [];
beforeEach(() => {
    created.length = 0;
    billing._setStripeForTests({
        checkout: { sessions: { create: async (p) => { created.push(p); return { id: 'cs_test_abcdefghij123', url: 'https://checkout.stripe.com/c/pay/cs_test_abcdefghij123' }; } } },
    });
});

const tokenCon = (scope, userId = 'u1') => tokens.emitirAccessToken({ userId, clientId: 'c1', scope }).token;
const post = (path, token, body) => request(app).post(`/api/checkout/${path}`).set('Authorization', `Bearer ${token}`).send(body);

test('token con billing.checkout crea el pago para SU cuenta', async () => {
    const r = await post('plan', tokenCon(['billing.checkout']), { planId: 'creator', cycle: 'monthly', userId: 'otro' });
    expect(r.status).toBe(200);
    expect(created[0].client_reference_id).toBe('u1');
});

test('token de solo lectura no puede crear pagos', async () => {
    const r = await post('plan', tokenCon(['chain.read', 'payments.quote']), { planId: 'creator', cycle: 'monthly' });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('INSUFFICIENT_SCOPE');
    expect(created).toHaveLength(0);
});

test('token de una cuenta inexistente o con firma ajena se rechaza', async () => {
    expect((await post('plan', tokenCon(['billing.checkout'], 'fantasma'), { planId: 'creator', cycle: 'monthly' })).status).toBe(401);
    const falso = jwt.sign({ scope: 'billing.checkout' }, 'secreto', { algorithm: 'HS256', subject: 'u1' });
    expect((await post('plan', falso, { planId: 'creator', cycle: 'monthly' })).status).toBe(401); // HS256 → vía de sesión
    // Se altera un carácter del medio de la firma (el último solo lleva bits de relleno y no invalida nada).
    const [h, p, sig] = tokenCon(['billing.checkout']).split('.');
    const tampered = [h, p, `${sig.slice(0, 20)}${sig[20] === 'A' ? 'B' : 'A'}${sig.slice(21)}`].join('.');
    expect((await post('plan', tampered, { planId: 'creator', cycle: 'monthly' })).status).toBe(401);
});
