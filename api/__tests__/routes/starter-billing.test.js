/**
 * Plan Starter (pago por uso): tarjeta y 15 días gratis en Checkout, consumo del ciclo, comparación con los otros planes
 * y resumen por correo al cerrar el ciclo.
 */
const request = require('supertest');
const { mockQuery, makeToken } = require('../helpers');

const mockSendMail = jest.fn().mockResolvedValue({ sent: true });
jest.mock('../../services/mailer', () => ({ sendMail: (...a) => mockSendMail(...a) }));
const app = require('../../index');
const planCheckout = require('../../routes/plan-checkout');
const { compare } = require('../../services/planComparison');
const starterBilling = require('../../services/starterBilling');

const USER = { id: 'u-1', email: 'ana@bezhas.com', username: 'ana', bezhas_id: 'BZ-ABCDEFGH23', email_verified_at: '2026-10-22T10:00:00Z' };
const token = () => makeToken({ userId: 'u-1' });
function db(rules) {
    mockQuery.mockImplementation(async (sql) => {
        for (const [re, rows] of rules) if (re.test(sql)) return { rows: typeof rows === 'function' ? rows() : rows, rowCount: 1 };
        return { rows: [], rowCount: 0 };
    });
}
beforeEach(() => { mockQuery.mockReset(); mockQuery.mockResolvedValue({ rows: [], rowCount: 0 }); mockSendMail.mockClear(); });

describe('comparación con los otros planes', () => {
    it('sin consumo o por debajo del plan más barato → seguir por uso', () => {
        expect(compare({ usageEUR: 0, calls: 0 }).suggestion.kind).toBe('stay');
        const c = compare({ usageEUR: 42.5, calls: 900 });
        expect(c.suggestion.kind).toBe('stay');
        expect(c.suggestion.message).toMatch(/Creator Pro/);
    });
    it('un consumo mayor que la cuota de Creator Pro, y que cabe en él → sugiere cambiar y calcula el ahorro', () => {
        const c = compare({ usageEUR: 150, calls: 900 });
        expect(c.suggestion).toMatchObject({ kind: 'switch', planId: 'creator_pro', savingsEUR: 51 });
        expect(c.plans.map((p) => p.id)).toEqual(['creator_pro', 'business', 'enterprise_vip']);
    });
    it('si las acciones no caben en el plan barato se sugiere uno mayor, o seguir por uso si ninguno compensa', () => {
        expect(compare({ usageEUR: 700, calls: 4000 }).suggestion).toMatchObject({ kind: 'switch', planId: 'business', savingsEUR: 201 });
        const sigue = compare({ usageEUR: 150, calls: 4000 });
        expect(sigue.suggestion.kind).toBe('stay');
        expect(sigue.suggestion.message).toMatch(/no caben/);
    });
});

describe('POST /api/billing/plan-checkout con Starter', () => {
    const create = jest.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/c/pay/cs_test_starter' });
    beforeEach(() => { create.mockClear(); process.env.STRIPE_SECRET_KEY = 'sk_test_x'; planCheckout.__setStripe({ checkout: { sessions: { create } } }); });
    const reglas = [[/FROM users WHERE id/, [USER]], [/INSERT INTO organizations/, [{ id: 'o' }]], [/INSERT INTO enterprises/, [{ id: 'e' }]], [/INSERT INTO app_registry/, [{ id: 'app-1' }]]];

    it('crea una suscripción de precio medido con 15 días de prueba y tarjeta obligatoria', async () => {
        db(reglas);
        const res = await request(app).post('/api/billing/plan-checkout').set('Authorization', `Bearer ${token()}`).send({ planId: 'starter', returnTo: 'https://energy.bezhas.com/panel' });
        expect(res.status).toBe(200);
        const a = create.mock.calls[0][0];
        expect(a.mode).toBe('subscription');
        expect(a.payment_method_collection).toBe('always');
        expect(a.line_items).toEqual([{ price: expect.stringMatching(/^price_/) }]);      // medido: sin cantidad
        expect(a.line_items[0]).not.toHaveProperty('quantity');
        expect(a.subscription_data.trial_period_days).toBe(15);
        expect(a.subscription_data.trial_settings.end_behavior.missing_payment_method).toBe('cancel');
        expect(a.metadata).toMatchObject({ plan_id: 'starter', billing: 'payg', user_id: 'u-1' });
        expect(a.client_reference_id).toBe('app-1');
    });
    it('los planes de pago no llevan prueba ni se piden sin cantidad', async () => {
        db(reglas);
        await request(app).post('/api/billing/plan-checkout').set('Authorization', `Bearer ${token()}`).send({ planId: 'business', billing: 'monthly' });
        const a = create.mock.calls[0][0];
        expect(a.line_items[0].quantity).toBe(1);
        expect(a.subscription_data.trial_period_days).toBeUndefined();
        expect(a.payment_method_collection).toBeUndefined();
    });
    it('Starter ya no se activa sin tarjeta: /plan-free no existe', async () => {
        const res = await request(app).post('/api/billing/plan-free').set('Authorization', `Bearer ${token()}`).send({});
        expect(res.status).toBe(404);
    });
});

describe('GET /api/billing/usage', () => {
    it('suma el consumo de las apps de la cuenta y compara con los otros planes', async () => {
        db([
            [/FROM users WHERE id/, [USER]],
            [/SELECT s\.app_id, s\.plan_id/, [{ app_id: 'app-1', plan_id: 'starter', status: 'active', stripe_subscription_id: null }]],
            [/SELECT DISTINCT a\.id::text/, [{ id: 'app-1' }]],
            [/FROM gateway_usage_ledger/, [{ calls: 900, credits: 150000, eur: '150.000000' }]],
        ]);
        const res = await request(app).get('/api/billing/usage').set('Authorization', `Bearer ${token()}`);
        expect(res.status).toBe(200);
        expect(res.body.plan).toMatchObject({ id: 'starter', status: 'active' });
        expect(res.body.usage).toEqual({ calls: 900, credits: 150000, eur: 150 });
        expect(res.body.comparison.suggestion).toMatchObject({ kind: 'switch', planId: 'creator_pro', savingsEUR: 51 });
        expect(res.body.trialDays).toBe(15);
    });
    it('sin sesión → 401', async () => {
        expect((await request(app).get('/api/billing/usage')).status).toBe(401);
    });
});

describe('resumen de fin de ciclo (invoice.paid)', () => {
    const factura = { id: 'in_1', billing_reason: 'subscription_cycle', subscription: 'sub_1', amount_paid: 18150, period_start: 1790000000, period_end: 1792592000 };
    const reglas = (claimRows) => [
        [/SELECT app_id FROM gateway_subscriptions/, [{ app_id: 'app-1' }]],
        [/JOIN organization_members m ON m\.organization_id = o\.id AND m\.role = 'owner'/, [USER]],
        [/INSERT INTO starter_summaries/, claimRows],
        [/SELECT DISTINCT a\.id::text/, [{ id: 'app-1' }]],
        [/FROM gateway_usage_ledger/, [{ calls: 900, credits: 150000, eur: '150.000000' }]],
    ];

    it('manda al titular lo cobrado, el consumo y la comparación con los planes', async () => {
        db(reglas([{ key: 'invoice:in_1' }]));
        const r = await starterBilling.alFacturar(factura);
        expect(r.accion).toBe('enviado');
        expect(mockSendMail).toHaveBeenCalledTimes(1);
        const mail = mockSendMail.mock.calls[0][0];
        expect(mail.to).toBe('ana@bezhas.com');
        expect(mail.text).toMatch(/181,50 €/);                    // lo cobrado (IVA incluido)
        expect(mail.text).toMatch(/Creator Pro: 99,00 €/);
        expect(mail.text).toMatch(/habrías pagado 51,00 € menos/);
        expect(mail.html).toMatch(/hub\.bezhas\.com\/cuenta/);
    });
    it('Stripe reenvía el evento: el correo no se manda dos veces', async () => {
        db(reglas([]));                                           // el INSERT … ON CONFLICT no devuelve fila
        expect((await starterBilling.alFacturar(factura)).accion).toBe('repetido');
        expect(mockSendMail).not.toHaveBeenCalled();
    });
    it('solo cuenta la factura de fin de ciclo, no la primera ni la de otros planes', async () => {
        expect((await starterBilling.alFacturar({ ...factura, billing_reason: 'subscription_create' })).accion).toBe('ignorada');
        db([[/SELECT app_id FROM gateway_subscriptions/, []]]);
        expect((await starterBilling.alFacturar(factura)).accion).toBe('no_starter');
        expect(mockSendMail).not.toHaveBeenCalled();
    });
});
