const request = require('supertest');
const { mockQuery, mockWalletService, makeToken } = require('../helpers');

const mockSendMail = jest.fn().mockResolvedValue({ sent: true });
jest.mock('../../services/mailer', () => ({ sendMail: (...a) => mockSendMail(...a) }));
const app = require('../../index');
const planCheckout = require('../../routes/plan-checkout');
const { safeReturnTo } = require('../../lib/returnTo');
const verifications = require('../../services/emailVerification');

const USER = {
    id: 'u-1', wallet_address: '0x' + 'a'.repeat(40), primary_wallet_address: '0x' + 'a'.repeat(40), username: 'ana',
    role: 'user', email: 'ana@bezhas.com', auth_type: 'fiat', custody_mode: 'managed', bezhas_id: 'BZ-ABCDEFGH23', email_verified_at: null,
};
const sessionToken = () => makeToken({ userId: 'u-1' });

/** Responde a cada consulta SQL según su texto; lo que no se prevé devuelve filas vacías. */
function db(rules) {
    mockQuery.mockImplementation(async (sql) => {
        for (const [re, rows] of rules) if (re.test(sql)) return { rows: typeof rows === 'function' ? rows() : rows, rowCount: 1 };
        return { rows: [], rowCount: 0 };
    });
}

beforeEach(() => { mockQuery.mockReset(); mockQuery.mockResolvedValue({ rows: [], rowCount: 0 }); mockSendMail.mockClear(); mockWalletService.ensureFiatSafeWalletForUser.mockResolvedValue(null); });

describe('returnTo', () => {
    it('acepta https en bezhas.com y sus subdominios', () => {
        expect(safeReturnTo('https://energy.bezhas.com/panel?x=1')).toBe('https://energy.bezhas.com/panel?x=1');
        expect(safeReturnTo('https://bezhas.com/')).toBe('https://bezhas.com/');
    });
    it('descarta dominios ajenos, parecidos, esquemas raros y credenciales', () => {
        for (const u of ['https://bezhas.com.evil.io/', 'https://evilbezhas.com/', 'http://energy.bezhas.com/', 'javascript:alert(1)',
            'https://user:pw@energy.bezhas.com/', '//evil.io', '', null, 42]) {
            expect(safeReturnTo(u)).toBeNull();
        }
    });
});

describe('registro con email de confirmación', () => {
    const registro = (extra = {}) => request(app).post('/api/auth/register-email').send({ email: 'Ana@Bezhas.com', password: 'Correcta123', username: 'ana', ...extra });

    it('crea la cuenta y manda un correo con el enlace al Hub (token, BeZhas ID y return)', async () => {
        db([[/INSERT INTO users/, [USER]], [/FROM users WHERE id/, [USER]]]);
        const res = await registro({ returnTo: 'https://energy.bezhas.com/panel' });
        expect(res.status).toBe(201);
        expect(res.body.emailVerification).toEqual({ sent: true });
        expect(res.body.user.email_verified_at).toBeNull();
        expect(mockSendMail).toHaveBeenCalledTimes(1);
        const mail = mockSendMail.mock.calls[0][0];
        expect(mail.to).toBe('ana@bezhas.com');
        expect(mail.text).toMatch(/BZ-ABCDEFGH23/);
        const url = mail.text.match(/https:\/\/hub\.bezhas\.com\/confirmar\?[^\s]+/)[0];
        expect(new URL(url).searchParams.get('token')).toMatch(/^[0-9a-f]{64}$/);
        expect(new URL(url).searchParams.get('return')).toBe('https://energy.bezhas.com/panel');
        expect(mail.html).toMatch(/Confirmar email y elegir plan/);
    });

    it('un returnTo ajeno no entra en el enlace del correo', async () => {
        db([[/INSERT INTO users/, [USER]], [/FROM users WHERE id/, [USER]]]);
        await registro({ returnTo: 'https://evil.io/robar' });
        expect(mockSendMail.mock.calls[0][0].text).not.toMatch(/evil\.io/);
        // y tampoco se guarda en la base
        const insert = mockQuery.mock.calls.find(([sql]) => /INSERT INTO email_verifications/.test(sql));
        expect(insert[1][2]).toBeNull();
    });

    it('si el correo falla, la cuenta se crea igualmente', async () => {
        mockSendMail.mockRejectedValueOnce(new Error('SMTP caído'));
        db([[/INSERT INTO users/, [USER]], [/FROM users WHERE id/, [USER]]]);
        const res = await registro();
        expect(res.status).toBe(201);
        expect(res.body.emailVerification).toEqual({ sent: false });
    });
});

describe('POST /api/auth/verify-email', () => {
    it('un enlace válido verifica el email y devuelve sesión y destino', async () => {
        db([
            [/UPDATE email_verifications SET used_at = NOW\(\)\s+WHERE token_hash/, [{ user_id: 'u-1', return_to: 'https://energy.bezhas.com/panel' }]],
            [/FROM users WHERE id/, [{ ...USER, email_verified_at: new Date().toISOString() }]],
        ]);
        const res = await request(app).post('/api/auth/verify-email').send({ token: 'a'.repeat(64) });
        expect(res.status).toBe(200);
        expect(res.body.token).toBeTruthy();
        expect(res.body.returnTo).toBe('https://energy.bezhas.com/panel');
        expect(mockQuery.mock.calls.some(([sql]) => /UPDATE users SET email_verified_at/.test(sql))).toBe(true);
    });
    it('un enlace ya usado, con el email verificado, sigue llevando a elegir plan pero sin dar sesión nueva', async () => {
        db([[/SELECT v\.user_id, v\.return_to/, [{ user_id: 'u-1', return_to: 'https://energy.bezhas.com/panel' }]]]);
        const res = await request(app).post('/api/auth/verify-email').send({ token: 'c'.repeat(64) });
        expect(res.status).toBe(200);
        expect(res.body.alreadyVerified).toBe(true);
        expect(res.body.returnTo).toBe('https://energy.bezhas.com/panel');
        expect(res.body.token).toBeUndefined();
        expect(res.body.user).toBeUndefined();
        // y no vuelve a gastar nada ni toca al usuario
        expect(mockQuery.mock.calls.some(([sql]) => /UPDATE users/.test(sql))).toBe(false);
    });
    it('un enlace sustituido por otro con el email aún sin verificar no vale', async () => {
        const res = await request(app).post('/api/auth/verify-email').send({ token: 'd'.repeat(64) });
        expect(res.status).toBe(400);
    });
    it('un enlace usado, caducado o inexistente → 400 sin sesión', async () => {
        const res = await request(app).post('/api/auth/verify-email').send({ token: 'b'.repeat(64) });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_TOKEN');
        expect(res.body.token).toBeUndefined();
    });
    it('un token mal formado ni toca la base', async () => {
        const res = await request(app).post('/api/auth/verify-email').send({ token: 'corto' });
        expect(res.status).toBe(400);
        // (el único acceso a la base es el registro de auditoría de la petición, nunca el de tokens)
        expect(mockQuery.mock.calls.filter(([sql]) => /email_verifications|users/.test(sql))).toHaveLength(0);
    });
    it('el token se guarda sólo como SHA-256', async () => {
        db([[/INSERT INTO email_verifications/, []]]);
        const t = await verifications.issue('u-1', { returnTo: null });
        const insert = mockQuery.mock.calls.find(([sql]) => /INSERT INTO email_verifications/.test(sql));
        expect(insert[1][1]).toBe(verifications.hash(t));
        expect(insert[1].includes(t)).toBe(false);
    });
});

describe('POST /api/billing/plan-checkout', () => {
    const create = jest.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/c/pay/cs_test_123' });
    beforeEach(() => { create.mockClear(); process.env.STRIPE_SECRET_KEY = 'sk_test_x'; planCheckout.__setStripe({ checkout: { sessions: { create } } }); });
    const pedir = (body) => request(app).post('/api/billing/plan-checkout').set('Authorization', `Bearer ${sessionToken()}`).send(body);
    const verificado = { ...USER, email_verified_at: '2026-10-22T10:00:00Z' };

    it('sin email confirmado → 403 y no se crea ninguna sesión de pago', async () => {
        db([[/FROM users WHERE id/, [USER]]]);
        const res = await pedir({ planId: 'business' });
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
        expect(create).not.toHaveBeenCalled();
    });

    it('con email confirmado crea la sesión de Stripe, cuelga el plan de la app de la cuenta y vuelve a la app de origen', async () => {
        db([
            [/FROM users WHERE id/, [verificado]],
            [/INSERT INTO organizations/, [{ id: 'org-1' }]],
            [/INSERT INTO enterprises/, [{ id: 'ent-1' }]],
            [/INSERT INTO app_registry/, [{ id: 'app-1' }]],
        ]);
        const res = await pedir({ planId: 'business', billing: 'annual', returnTo: 'https://energy.bezhas.com/panel' });
        expect(res.status).toBe(200);
        expect(res.body.url).toMatch(/checkout\.stripe\.com/);
        const args = create.mock.calls[0][0];
        expect(args.mode).toBe('subscription');
        expect(args.client_reference_id).toBe('app-1');
        expect(args.customer_email).toBe('ana@bezhas.com');
        expect(args.metadata).toMatchObject({ plan_id: 'business', billing: 'annual', user_id: 'u-1' });
        expect(args.line_items[0].price).toMatch(/^price_/);
        expect(args.success_url).toContain('https://hub.bezhas.com/suscripcion/listo?session_id={CHECKOUT_SESSION_ID}');
        expect(decodeURIComponent(args.success_url)).toContain('return=https://energy.bezhas.com/panel');
    });

    it('un returnTo ajeno no llega a la URL de éxito', async () => {
        db([[/FROM users WHERE id/, [verificado]], [/INSERT INTO organizations/, [{ id: 'o' }]], [/INSERT INTO enterprises/, [{ id: 'e' }]], [/INSERT INTO app_registry/, [{ id: 'a' }]]]);
        await pedir({ planId: 'creator_pro', returnTo: 'https://evil.io/x' });
        expect(create.mock.calls[0][0].success_url).not.toMatch(/evil\.io/);
    });

    it('rechaza planes que no son de pago y exige sesión', async () => {
        expect((await pedir({ planId: 'starter' })).status).toBe(400);
        expect((await request(app).post('/api/billing/plan-checkout').send({ planId: 'business' })).status).toBe(401);
    });
});
