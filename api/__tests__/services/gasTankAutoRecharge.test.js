/**
 * Gas Tank — auto-recarga y ajustes contra un Postgres real (ver gasTankLedger.test.js).
 * Requiere además la migración 073. Si no existe organization_billing_profiles (base mínima), el test crea una versión reducida;
 * con el esquema completo (node db/migrate.js) usa la real.
 */
const URL = process.env.GAS_TANK_TEST_DATABASE_URL;
const maybe = URL ? describe : describe.skip;

const mockPi = jest.fn();
jest.mock('stripe', () => () => ({ paymentIntents: { create: (...a) => mockPi(...a) } }));
const mockMail = jest.fn().mockResolvedValue({ sent: true });
jest.mock('../../services/mailer', () => ({ sendMail: (...a) => mockMail(...a) }));

maybe('gasTank/autoRecharge (Postgres real)', () => {
    let db, ledger, auto, orgId;

    beforeAll(async () => {
        process.env.DATABASE_URL = URL;
        process.env.STRIPE_SECRET_KEY = 'sk_test_x';
        db = require('../../db/pool');
        await db.query(`CREATE TABLE IF NOT EXISTS organization_billing_profiles (
            organization_id UUID PRIMARY KEY, billing_email text, stripe_customer_id text, stripe_default_payment_method_id text)`);
        await db.query(`ALTER TABLE gas_tank_accounts ADD COLUMN IF NOT EXISTS last_auto_attempt_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS last_auto_error TEXT`);
        ledger = require('../../services/gasTank/ledger');
        auto = require('../../services/gasTank/autoRecharge');
    });

    beforeEach(async () => {
        mockPi.mockReset(); mockMail.mockClear();
        await db.query('TRUNCATE gas_tank_ledger, gas_tank_reservations, gas_tank_accounts, organization_billing_profiles, organizations CASCADE');
        orgId = (await db.query(`INSERT INTO organizations (name) VALUES ('Acme') RETURNING id`)).rows[0].id;
        await db.query(`INSERT INTO organization_billing_profiles (organization_id, billing_email, stripe_customer_id, stripe_default_payment_method_id) VALUES ($1, 'fin@acme.test', 'cus_1', 'pm_1')`, [orgId]);
        await ledger.ensureAccount(orgId);
        await db.query(`UPDATE gas_tank_accounts SET auto_recharge_enabled = TRUE, threshold_credits = 10000, recharge_credits = 50000 WHERE organization_id = $1`, [orgId]);
    });

    afterAll(async () => { await db.pool.end(); });

    test('saldo bajo: cobra en EUR off-session y acredita; el mismo barrido no repite (cooldown)', async () => {
        mockPi.mockResolvedValue({ id: 'pi_1', status: 'succeeded' });
        const r = await auto.rechargeIfNeeded(orgId);
        expect(r).toMatchObject({ recharged: true, credits: 50000, balance: 50000 });
        const arg = mockPi.mock.calls[0][0];
        expect(arg).toMatchObject({ amount: 5000, currency: 'eur', customer: 'cus_1', payment_method: 'pm_1', off_session: true, confirm: true });
        expect(mockPi.mock.calls[0][1].idempotencyKey).toMatch(/^gastank-auto-/);

        await db.query(`UPDATE gas_tank_accounts SET balance_credits = 0 WHERE organization_id = $1`, [orgId]);
        expect(await auto.rechargeIfNeeded(orgId)).toEqual({ skipped: 'cooldown' });
        expect(mockPi).toHaveBeenCalledTimes(1);
    });

    test('no cobra si está por encima del umbral, desactivada o sin método de pago', async () => {
        await ledger.credit(orgId, 20000);
        expect(await auto.rechargeIfNeeded(orgId)).toEqual({ skipped: 'above_threshold' });
        await db.query(`UPDATE gas_tank_accounts SET balance_credits = 0, auto_recharge_enabled = FALSE`);
        expect(await auto.rechargeIfNeeded(orgId)).toEqual({ skipped: 'disabled' });
        await db.query(`UPDATE gas_tank_accounts SET auto_recharge_enabled = TRUE`);
        await db.query(`UPDATE organization_billing_profiles SET stripe_default_payment_method_id = NULL`);
        expect(await auto.rechargeIfNeeded(orgId)).toEqual({ skipped: 'no_payment_method' });
        expect(mockPi).not.toHaveBeenCalled();
    });

    test('respeta el tope mensual de recargas automáticas', async () => {
        await db.query(`UPDATE gas_tank_accounts SET monthly_cap_credits = 80000 WHERE organization_id = $1`, [orgId]);
        mockPi.mockResolvedValue({ id: 'pi_a', status: 'succeeded' });
        expect((await auto.rechargeIfNeeded(orgId)).recharged).toBe(true);           // 50.000 de 80.000
        await db.query(`UPDATE gas_tank_accounts SET balance_credits = 0, last_auto_attempt_at = NULL WHERE organization_id = $1`, [orgId]);
        expect(await auto.rechargeIfNeeded(orgId)).toEqual({ skipped: 'monthly_cap' }); // otros 50.000 pasarían de 80.000
        expect(mockPi).toHaveBeenCalledTimes(1);
    });

    test('cobro rechazado: no acredita, guarda el motivo y avisa por correo', async () => {
        mockPi.mockRejectedValue(new Error('Your card was declined'));
        const r = await auto.rechargeIfNeeded(orgId);
        expect(r).toMatchObject({ recharged: false, error: 'Your card was declined' });
        expect((await ledger.getBalance(orgId))).toMatchObject({ balanceCredits: 0, lastAutoError: 'Your card was declined' });
        expect(mockMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'fin@acme.test' }));
    });

    test('pago que exige autenticación no se acredita', async () => {
        mockPi.mockResolvedValue({ id: 'pi_2', status: 'requires_action' });
        expect((await auto.rechargeIfNeeded(orgId)).recharged).toBe(false);
        expect((await ledger.getBalance(orgId)).balanceCredits).toBe(0);
    });

    test('sweep sólo procesa cuentas bajo umbral', async () => {
        mockPi.mockResolvedValue({ id: 'pi_s', status: 'succeeded' });
        const out = await auto.sweep();
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({ orgId, recharged: true });
        expect(await auto.sweep()).toHaveLength(0);
    });
});
