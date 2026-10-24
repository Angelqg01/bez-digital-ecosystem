/**
 * gasTank/meter — reserva → envío → liquidación. Usa el ledger real si hay
 * GAS_TANK_TEST_DATABASE_URL (ver gasTankLedger.test.js); los precios van simulados.
 */
const URL = process.env.GAS_TANK_TEST_DATABASE_URL;
const maybe = URL ? describe : describe.skip;

maybe('gasTank/meter (Postgres real)', () => {
    let db, ledger, meter, orgId;
    const prices = { getPolEur: async () => 0.4, getBezEur: async () => 0.0075 };
    const base = { opType: 'anchorBatch', appId: 'app-1', maxGasLimit: 200000, maxGasPriceGwei: 100 };
    // coste = ceil(gas × gwei × 1e-9 × polEur × 1,25 / 0,001)
    const credits = (gas, gwei) => Math.ceil((gas * gwei * 1e-9 * 0.4 * 1.25) / 0.001);

    beforeAll(() => {
        process.env.DATABASE_URL = URL;
        db = require('../../db/pool');
        ledger = require('../../services/gasTank/ledger');
        meter = require('../../services/gasTank/meter');
    });
    beforeEach(async () => {
        await db.query('TRUNCATE gas_tank_ledger, gas_tank_reservations, gas_tank_accounts, organizations CASCADE');
        orgId = (await db.query(`INSERT INTO organizations (name) VALUES ('Acme') RETURNING id`)).rows[0].id;
        await ledger.credit(orgId, 100000);
    });
    afterAll(async () => { await db.pool.end(); });

    const run = (over, send) => meter.meterOperation({ orgId, ...base, ...over }, send, { prices });
    const okSend = (gasUsed, gwei) => async () => ({ receipt: { hash: '0xtx', gasUsed: BigInt(gasUsed), gasPrice: BigInt(gwei * 1e9) } });

    test('cobra el gas real (no el máximo) y deja el movimiento con su tx', async () => {
        const { charged } = await run({ chainId: 137 }, okSend(60000, 40));
        const real = credits(60000, 40);
        expect(charged).toMatchObject({ charged: real });
        expect((await ledger.getBalance(orgId))).toMatchObject({ balanceCredits: 100000 - real, reservedCredits: 0 });
        expect((await ledger.activity(orgId))[0]).toMatchObject({ kind: 'charge', tx_hash: '0xtx', op_type: 'anchorBatch', chain_id: 137, gas_used: '60000' });
    });

    test('sin saldo suficiente para el máximo: 402 y no se llama a send', async () => {
        const send = jest.fn();
        await expect(run({ maxGasLimit: 5_000_000_000 }, send)).rejects.toMatchObject({ code: 'INSUFFICIENT_GAS_TANK', status: 402 });
        expect(send).not.toHaveBeenCalled();
    });

    test('si send falla antes de minarse, se libera la reserva y se propaga el error', async () => {
        await expect(run({}, async () => { throw new Error('rpc caído'); })).rejects.toThrow('rpc caído');
        expect(await ledger.getBalance(orgId)).toMatchObject({ balanceCredits: 100000, reservedCredits: 0 });
        expect(await ledger.activity(orgId)).toHaveLength(1); // sólo la recarga inicial
    });

    test('una operación revertida y minada se cobra igualmente', async () => {
        const err = Object.assign(new Error('execution reverted'), { receipt: { hash: '0xrev', gasUsed: 30000n, gasPrice: BigInt(50e9) } });
        await expect(run({}, async () => { throw err; })).rejects.toThrow('reverted');
        expect((await ledger.getBalance(orgId)).balanceCredits).toBe(100000 - credits(30000, 50));
    });

    test('con comisión de protocolo en BEZ suma su coste', async () => {
        const { charged } = await run({ protocolFeeBez: 100 }, okSend(60000, 40));
        const real = Math.ceil(((60000 * 40e-9 * 0.4 + 100 * 0.0075) * 1.25) / 0.001);
        expect(charged.charged).toBe(real);
    });

    test('el mismo opId no se mide dos veces', async () => {
        await run({ opId: 'batch-42' }, okSend(60000, 40));
        await expect(run({ opId: 'batch-42' }, okSend(60000, 40))).rejects.toMatchObject({ code: 'OPERATION_ALREADY_METERED' });
        expect((await ledger.activity(orgId)).filter((a) => a.kind === 'charge')).toHaveLength(1);
    });
});

describe('gasTank/prices', () => {
    test('sin precio fresco ni GAS_TANK_POL_EUR falla cerrado', async () => {
        jest.resetModules();
        jest.doMock('../../db/pool', () => ({ query: async () => ({ rows: [] }) }));
        delete process.env.GAS_TANK_POL_EUR;
        await expect(require('../../services/gasTank/prices').getPolEur()).rejects.toMatchObject({ code: 'NO_POL_PRICE' });
        process.env.GAS_TANK_POL_EUR = '0.35';
        expect(await require('../../services/gasTank/prices').getPolEur()).toBe(0.35);
        delete process.env.GAS_TANK_POL_EUR;
        jest.dontMock('../../db/pool');
    });
});
