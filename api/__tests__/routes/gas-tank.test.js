const express = require('express');
const request = require('supertest');

jest.mock('../../middleware/security', () => ({
    authenticateToken: (req, _res, next) => { req.user = { userId: 'u1', role: 'user' }; next(); },
    // Simula el rol del miembro con la cabecera x-role (sin ella, 403 como un no-miembro).
    requireOrgRole: (...roles) => (req, res, next) =>
        (roles.includes(req.get('x-role')) ? next() : res.status(403).json({ error: 'Not a member of this organization' })),
}));
const mockQuery = jest.fn();
jest.mock('../../db/pool', () => ({ query: (...a) => mockQuery(...a) }));
const mockLedger = {
    ensureAccount: jest.fn().mockResolvedValue(),
    getBalance: jest.fn().mockResolvedValue({ status: 'active', balanceCredits: 2500, reservedCredits: 0 }),
    activity: jest.fn().mockResolvedValue([{ id: 'x', kind: 'recharge', credits: 1000 }]),
};
jest.mock('../../services/gasTank/ledger', () => mockLedger);
const mockCreate = jest.fn().mockResolvedValue({ url: 'https://checkout.stripe.test/s1' });
jest.mock('stripe', () => () => ({ checkout: { sessions: { create: (...a) => mockCreate(...a) } } }));

const app = express();
app.use(express.json());
app.use('/api/organizations', require('../../routes/gas-tank'));
const base = '/api/organizations/org-1/gas-tank';

beforeEach(() => { mockQuery.mockReset(); mockCreate.mockClear(); process.env.STRIPE_SECRET_KEY = 'sk_test_x'; });

test('un no-miembro recibe 403 en todo', async () => {
    expect((await request(app).get(`${base}/balance`)).status).toBe(403);
    expect((await request(app).post(`${base}/recharge/checkout`).send({ packageId: 'gas-50' })).status).toBe(403);
});

test('balance traduce créditos a euros', async () => {
    const res = await request(app).get(`${base}/balance`).set('x-role', 'auditor');
    expect(res.status).toBe(200);
    expect(res.body.balanceEur).toBeCloseTo(2.5);
});

test('un auditor no puede recargar; un financiero sí, con el importe del paquete en céntimos', async () => {
    expect((await request(app).post(`${base}/recharge/checkout`).set('x-role', 'auditor').send({ packageId: 'gas-50' })).status).toBe(403);
    const res = await request(app).post(`${base}/recharge/checkout`).set('x-role', 'financial').send({ packageId: 'gas-50' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ url: 'https://checkout.stripe.test/s1', credits: 52500 });
    const arg = mockCreate.mock.calls[0][0];
    expect(arg.line_items[0].price_data).toMatchObject({ currency: 'eur', unit_amount: 5000 });
    expect(arg.metadata).toMatchObject({ gas_tank_org_id: 'org-1', gas_tank_package_id: 'gas-50' });
});

test('importes fuera de topes y paquetes desconocidos se rechazan sin llamar a Stripe', async () => {
    const h = { 'x-role': 'owner' };
    expect((await request(app).post(`${base}/recharge/checkout`).set(h).send({ amountEur: 1 })).status).toBe(400);
    expect((await request(app).post(`${base}/recharge/checkout`).set(h).send({ amountEur: 99999 })).status).toBe(400);
    expect((await request(app).post(`${base}/recharge/checkout`).set(h).send({ packageId: 'nope' })).status).toBe(400);
    expect((await request(app).post(`${base}/recharge/checkout`).set(h).send({})).status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
});

test('importe libre sin bono', async () => {
    const res = await request(app).post(`${base}/recharge/checkout`).set('x-role', 'admin').send({ amountEur: 30 });
    expect(res.body.credits).toBe(30000);
});

describe('PATCH settings', () => {
    const h = { 'x-role': 'financial' };
    test('no deja activar la auto-recarga sin método de pago guardado', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ stripe_default_payment_method_id: null }] });
        const res = await request(app).patch(`${base}/settings`).set(h).send({ autoRecharge: true });
        expect(res.status).toBe(409);
        expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    test('guarda umbral e importes convertidos a créditos y deja el tope sin tocar si no viene', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ stripe_default_payment_method_id: 'pm_1' }] }).mockResolvedValueOnce({ rows: [] });
        const res = await request(app).patch(`${base}/settings`).set(h).send({ autoRecharge: true, thresholdEur: 10, rechargeEur: 50 });
        expect(res.status).toBe(200);
        const [sql, params] = mockQuery.mock.calls[1];
        expect(sql).toContain('UPDATE gas_tank_accounts');
        expect(params).toEqual(['org-1', true, 10000, 50000, false, null]);
    });

    test('monthlyCapEur null quita el tope; importes fuera de rango, 400; auditor, 403', async () => {
        mockQuery.mockResolvedValue({ rows: [] });
        await request(app).patch(`${base}/settings`).set(h).send({ monthlyCapEur: null });
        expect(mockQuery.mock.calls[0][1]).toEqual(['org-1', null, null, null, true, null]);
        expect((await request(app).patch(`${base}/settings`).set(h).send({ rechargeEur: 1 })).status).toBe(400);
        expect((await request(app).patch(`${base}/settings`).set({ 'x-role': 'auditor' }).send({ autoRecharge: false })).status).toBe(403);
    });
});
