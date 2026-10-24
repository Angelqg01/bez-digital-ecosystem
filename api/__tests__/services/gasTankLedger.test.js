/**
 * Gas Tank — config de precios (siempre) y ledger contra un Postgres real.
 *
 * El ledger se prueba con transacciones y concurrencia de verdad, así que sólo corre si
 * GAS_TANK_TEST_DATABASE_URL apunta a una base DESECHABLE con las tablas de la migración 072
 * y una tabla `organizations(id uuid)`. Ejemplo:
 *   docker run -d --name gastank-pg -e POSTGRES_PASSWORD=test -e POSTGRES_DB=gt -p 55432:5432 postgres:16-alpine
 *   GAS_TANK_TEST_DATABASE_URL=postgres://postgres:test@localhost:55432/gt pnpm exec jest gasTankLedger
 */
const cfg = require('../../config/gas-tank');

describe('gas-tank config', () => {
    test('créditos: 1 crédito = 0,001 EUR y el bono sólo en paquetes', () => {
        expect(cfg.creditsForEur(10)).toBe(10000);
        expect(cfg.rechargeCredits(50, cfg.getPackage('gas-50'))).toBe(52500);
        expect(cfg.rechargeCredits(50)).toBe(50000);
    });

    test('el coste de una operación redondea hacia arriba, aplica markup y nunca baja de 1', () => {
        const c = cfg.operationCostCredits({ gasUsed: 150000, gasPriceGwei: 40, polEur: 0.4, protocolFeeBez: 100, bezEur: 0.0075 });
        // (150000*40e-9*0.4 + 100*0.0075) * 1.25 / 0.001
        expect(c).toBe(Math.ceil(((150000 * 40e-9 * 0.4 + 0.75) * 1.25) / 0.001));
        expect(cfg.operationCostCredits({ gasUsed: 1, gasPriceGwei: 0.001, polEur: 0.1 })).toBe(1);
    });

    test('los paquetes caen dentro de los topes de recarga', () => {
        for (const p of cfg.RECHARGE_PACKAGES) {
            expect(p.eur).toBeGreaterThanOrEqual(cfg.MIN_RECHARGE_EUR);
            expect(p.eur).toBeLessThanOrEqual(cfg.MAX_RECHARGE_EUR);
        }
    });
});

const URL = process.env.GAS_TANK_TEST_DATABASE_URL;
const maybe = URL ? describe : describe.skip;

maybe('gasTank/ledger (Postgres real)', () => {
    let db, ledger, orgId;

    beforeAll(async () => {
        process.env.DATABASE_URL = URL;
        db = require('../../db/pool');
        ledger = require('../../services/gasTank/ledger');
    });

    beforeEach(async () => {
        await db.query('TRUNCATE gas_tank_ledger, gas_tank_reservations, gas_tank_accounts, organizations CASCADE');
        orgId = (await db.query(`INSERT INTO organizations (name) VALUES ('Acme') RETURNING id`)).rows[0].id;
    });

    afterAll(async () => { await db.pool.end(); });

    test('credit suma, es idempotente por externalRef y queda en el libro', async () => {
        expect(await ledger.credit(orgId, 1000, { externalRef: 'cs_1' })).toEqual({ applied: true, balance: 1000 });
        expect(await ledger.credit(orgId, 1000, { externalRef: 'cs_1' })).toEqual({ applied: false, balance: 1000 });
        const act = await ledger.activity(orgId);
        expect(act).toHaveLength(1);
        expect(act[0]).toMatchObject({ kind: 'recharge', credits: 1000, balance_after: 1000 });
    });

    test('reserve → settle cobra el coste real y devuelve el resto', async () => {
        await ledger.credit(orgId, 1000);
        const r = await ledger.reserve(orgId, 300, { opHash: '0xa' });
        expect(r.status).toBe('reserved');
        expect((await ledger.getBalance(orgId))).toMatchObject({ balanceCredits: 700, reservedCredits: 300 });

        expect(await ledger.settle('0xa', 120, { txHash: '0xtx', opType: 'tokenizeAsset' })).toMatchObject({ charged: 120, refunded: 180 });
        expect(await ledger.getBalance(orgId)).toMatchObject({ balanceCredits: 880, reservedCredits: 0 });
        expect(await ledger.settle('0xa', 120)).toEqual({ alreadySettled: true });
        expect((await ledger.activity(orgId))[0]).toMatchObject({ kind: 'charge', credits: -120, tx_hash: '0xtx' });
    });

    test('settle nunca cobra más de lo reservado', async () => {
        await ledger.credit(orgId, 500);
        await ledger.reserve(orgId, 100, { opHash: '0xb' });
        expect(await ledger.settle('0xb', 999)).toMatchObject({ charged: 100, refunded: 0, capped: true });
        expect((await ledger.getBalance(orgId)).balanceCredits).toBe(400);
    });

    test('reserve devuelve null sin saldo, con la cuenta suspendida, y es idempotente por opHash', async () => {
        await ledger.credit(orgId, 100);
        expect(await ledger.reserve(orgId, 101, { opHash: '0xc' })).toBeNull();
        await ledger.reserve(orgId, 60, { opHash: '0xd' });
        expect((await ledger.reserve(orgId, 60, { opHash: '0xd' })).reused).toBe(true);
        expect((await ledger.getBalance(orgId)).balanceCredits).toBe(40);
        await db.query(`UPDATE gas_tank_accounts SET status = 'suspended' WHERE organization_id = $1`, [orgId]);
        expect(await ledger.reserve(orgId, 10, { opHash: '0xe' })).toBeNull();
    });

    test('release devuelve la reserva entera una sola vez', async () => {
        await ledger.credit(orgId, 100);
        await ledger.reserve(orgId, 80, { opHash: '0xf' });
        expect(await ledger.release('0xf')).toEqual({ released: true, credits: 80 });
        expect(await ledger.release('0xf')).toEqual({ released: false });
        expect((await ledger.getBalance(orgId)).balanceCredits).toBe(100);
        await expect(ledger.settle('0xf', 10)).rejects.toThrow(/liberada/);
    });

    test('releaseExpired libera las reservas vencidas', async () => {
        await ledger.credit(orgId, 100);
        await ledger.reserve(orgId, 50, { opHash: '0x10', ttlSeconds: 1 });
        await db.query(`UPDATE gas_tank_reservations SET valid_until = NOW() - interval '1 minute'`);
        expect(await ledger.releaseExpired()).toBe(1);
        expect((await ledger.getBalance(orgId)).balanceCredits).toBe(100);
    });

    test('concurrencia: 50 reservas de 30 sobre 1000 créditos nunca sobregiran', async () => {
        await ledger.credit(orgId, 1000);
        const results = await Promise.all(
            Array.from({ length: 50 }, (_, i) => ledger.reserve(orgId, 30, { opHash: `0xc${i}` }))
        );
        const ok = results.filter(Boolean).length;
        expect(ok).toBe(33); // floor(1000/30)
        const b = await ledger.getBalance(orgId);
        expect(b.balanceCredits).toBe(1000 - 33 * 30);
        expect(b.reservedCredits).toBe(33 * 30);
    });

    describe('recharge desde Stripe', () => {
        const recharge = () => require('../../services/gasTank/recharge');
        const session = (over = {}) => ({
            id: 'cs_test_1', currency: 'eur', amount_total: 5000,
            metadata: { gas_tank_org_id: orgId, gas_tank_package_id: 'gas-50' }, ...over,
        });

        test('acredita con bono si el importe cobrado es el del paquete, y es idempotente', async () => {
            const r1 = await recharge().creditFromSession(session());
            expect(r1).toMatchObject({ credits: 52500, applied: true, balance: 52500 });
            const r2 = await recharge().creditFromSession(session());
            expect(r2).toMatchObject({ applied: false, balance: 52500 });
        });

        test('sin bono si el importe no coincide con el paquete declarado', async () => {
            const r = await recharge().creditFromSession(session({ amount_total: 4000 }));
            expect(r.credits).toBe(40000);
        });

        test('rechaza moneda distinta de EUR o sesión sin importe', async () => {
            await expect(recharge().creditFromSession(session({ currency: 'usd' }))).rejects.toThrow(/Moneda/);
            await expect(recharge().creditFromSession(session({ amount_total: 0 }))).rejects.toThrow(/importe/);
            expect((await ledger.getBalance(orgId)).balanceCredits).toBe(0);
        });
    });
});
