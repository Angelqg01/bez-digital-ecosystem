/**
 * Saldo publicitario, recargas y depósitos BEZ sobre un Postgres REAL (migraciones 006, 008, 009 y 023). Se salta sin base:
 *
 *   docker run -d --name pgtest -e POSTGRES_PASSWORD=test -e POSTGRES_DB=t -p 54330:5432 postgres:16-alpine
 *   HUB_TEST_PG_URL=postgres://postgres:test@localhost:54330/t pnpm exec jest --env=node tests/integration/ad-balance-pg.test.js
 *
 * Hace DROP SCHEMA public CASCADE: usar SÓLO una base desechable.
 */
const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');
const { ethers } = require('ethers');

const URL = process.env.HUB_TEST_PG_URL;
const d = URL ? describe : describe.skip;
const sql = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'db', 'migrations', f), 'utf8');

const TOKEN = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';
const DEPOSITO = '0x1111111111111111111111111111111111111111';
const WALLET_ANA = '0x2222222222222222222222222222222222222222';
const WALLET_BETO = '0x3333333333333333333333333333333333333333';
const hashTx = (n) => `0x${n.toString(16).padStart(64, '0')}`;
const wei = (bez) => ethers.parseUnits(String(bez), 18);

/** Recibo falso con logs Transfer(from, to, value) del token indicado. */
const recibo = (transfers, { status = 1, blockNumber = 100 } = {}) => ({
    status, blockNumber,
    logs: transfers.map(({ from, to, value, token = TOKEN }) => ({
        address: token,
        topics: [ethers.id('Transfer(address,address,uint256)'), ethers.zeroPadValue(from, 32), ethers.zeroPadValue(to, 32)],
        data: ethers.toBeHex(wei(value), 32),
    })),
});
const proveedor = (rec, head = 200) => ({ getTransactionReceipt: async () => rec, getBlockNumber: async () => head });

d('saldo publicitario sobre Postgres', () => {
    let pg; let AdBalance; let BillingTransaction; let adTopup; let verificador; let ana; let beto;

    beforeAll(async () => {
        process.env.POSTGRES_URL = URL;
        process.env.BEZ_ADS_DEPOSIT_ADDRESS = DEPOSITO;
        process.env.BEZ_DEPOSIT_CONFIRMATIONS = '20';
        jest.resetModules();
        pg = require('../../db/pool');
        await pg.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
        await pg.query(sql('008_logistics_bridge_fiat.sql'));
        await pg.query(sql('009_core_users.sql'));
        await pg.query(sql('006_billing.sql'));
        await pg.query(sql('023_ad_balances.sql'));
        await pg.query(sql('023_ad_balances.sql')); // idempotente
        AdBalance = require('../../models/pg/AdBalance');
        BillingTransaction = require('../../models/pg/BillingTransaction');
        adTopup = require('../../services/adTopup.service');
        verificador = require('../../services/bezDepositVerifier');
        const mk = async (n, w) => (await pg.query('INSERT INTO users (username, email, wallet_address) VALUES ($1,$2,$3) RETURNING *', [n, `${n}@x.io`, w])).rows[0];
        ana = await mk('ana', WALLET_ANA); beto = await mk('beto', WALLET_BETO);
    });
    afterAll(async () => { await pg.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;'); });

    describe('AdBalance', () => {
        it('ensure crea el saldo a cero una vez y es idempotente', async () => {
            const [a, b] = await Promise.all([AdBalance.ensure(ana.id, WALLET_ANA), AdBalance.ensure(ana.id, WALLET_ANA)]);
            expect(a.id).toBe(b.id);
            expect(a).toMatchObject({ fiatBalance: 0, bezBalance: 0 });
        });

        it('credit suma sin perder abonos simultáneos', async () => {
            await Promise.all(Array.from({ length: 10 }, () => AdBalance.credit(beto.id, WALLET_BETO, { fiat: 5, depositedEur: 5 })));
            expect(await AdBalance.findByUserId(beto.id)).toMatchObject({ fiatBalance: 50, totalDeposited: 50 });
            await expect(AdBalance.credit(beto.id, WALLET_BETO, { fiat: -1 })).rejects.toThrow(/inválido/);
        });

        it('deduct cobra primero fiat y luego BEZ al precio dado', async () => {
            await pg.query('DELETE FROM ad_balances WHERE user_id = $1', [ana.id]);
            await AdBalance.credit(ana.id, WALLET_ANA, { fiat: 3, bez: 100, depositedEur: 13 });
            const r = await AdBalance.deduct(ana.id, 5, 0.1);
            expect(r.fiatBalance).toBe(0);
            expect(r.bezBalance).toBeCloseTo(80, 6); // 2 EUR restantes / 0,1 = 20 BEZ
            expect(r.totalSpent).toBe(5);
        });

        it('deduct con saldo insuficiente no descuenta nada y devuelve null', async () => {
            const antes = await AdBalance.findByUserId(ana.id);
            expect(await AdBalance.deduct(ana.id, 1000, 0.1)).toBeNull();
            expect(await AdBalance.findByUserId(ana.id)).toMatchObject({ fiatBalance: antes.fiatBalance, bezBalance: antes.bezBalance, totalSpent: antes.totalSpent });
        });

        it('30 cobros simultáneos de 1 EUR con 20 EUR de saldo: exactamente 20 pasan y nunca queda negativo', async () => {
            await pg.query('DELETE FROM ad_balances WHERE user_id = $1', [ana.id]);
            await AdBalance.credit(ana.id, WALLET_ANA, { fiat: 10, bez: 100, depositedEur: 20 }); // 10 + 100 BEZ x 0,1
            const r = await Promise.all(Array.from({ length: 30 }, () => AdBalance.deduct(ana.id, 1, 0.1)));
            expect(r.filter(Boolean)).toHaveLength(20);
            const final = await AdBalance.findByUserId(ana.id);
            expect(final.fiatBalance).toBe(0);
            expect(final.bezBalance).toBeGreaterThanOrEqual(0);
            expect(final.bezBalance).toBeLessThan(0.001);
            expect(final.totalSpent).toBe(20);
        });

        it('la base rechaza un saldo negativo aunque la aplicación falle', async () => {
            await expect(pg.query('UPDATE ad_balances SET fiat_balance = -1 WHERE user_id = $1', [ana.id])).rejects.toThrow(/fiat_balance/);
        });
    });

    describe('recarga con tarjeta (webhook de Stripe)', () => {
        const nuevaRecarga = async (user, wallet, amount, pi) => BillingTransaction.hydrate(await BillingTransaction.create({
            userId: user.id, walletAddress: wallet, type: 'deposit_fiat', amount, currency: 'EUR', status: 'pending',
            paymentMethod: 'stripe', stripePaymentIntentId: pi, description: `Recarga €${amount}`,
        }));
        const evento = (pi, eur, extra = {}) => ({ id: pi, amount: Math.round(eur * 100), amount_received: Math.round(eur * 100), currency: 'eur', ...extra });

        it('abona UNA vez aunque Stripe reintente o llegue en paralelo', async () => {
            await pg.query('DELETE FROM ad_balances WHERE user_id = $1', [beto.id]);
            const tx = await nuevaRecarga(beto, WALLET_BETO, 25, 'pi_1');
            const r = await Promise.all(Array.from({ length: 6 }, () => adTopup.completeStripeTopup(evento('pi_1', 25))));
            expect(r.filter((x) => x.credited)).toHaveLength(1);
            expect(r.filter((x) => x.reason === 'ALREADY_PROCESSED')).toHaveLength(5);
            expect(await AdBalance.findByUserId(beto.id)).toMatchObject({ fiatBalance: 25, totalDeposited: 25 });
            expect((await BillingTransaction.findById(tx.id)).status).toBe('completed');
            expect((await adTopup.completeStripeTopup(evento('pi_1', 25))).reason).toBe('ALREADY_PROCESSED');
            expect((await AdBalance.findByUserId(beto.id)).fiatBalance).toBe(25);
        });

        it('si el importe cobrado no coincide con la recarga no abona nada y la marca fallida', async () => {
            const tx = await nuevaRecarga(beto, WALLET_BETO, 50, 'pi_2');
            const r = await adTopup.completeStripeTopup(evento('pi_2', 5));
            expect(r).toMatchObject({ credited: false, reason: 'AMOUNT_MISMATCH' });
            expect((await BillingTransaction.findById(tx.id)).status).toBe('failed');
            expect((await AdBalance.findByUserId(beto.id)).fiatBalance).toBe(25);
        });

        it('una moneda distinta de EUR tampoco abona, y un PaymentIntent desconocido se ignora', async () => {
            await nuevaRecarga(beto, WALLET_BETO, 10, 'pi_3');
            expect((await adTopup.completeStripeTopup(evento('pi_3', 10, { currency: 'usd' }))).reason).toBe('AMOUNT_MISMATCH');
            expect((await adTopup.completeStripeTopup(evento('pi_desconocido', 10))).reason).toBe('NO_TRANSACTION');
        });

        it('la base impide dos recargas con el mismo PaymentIntent', async () => {
            await nuevaRecarga(ana, WALLET_ANA, 10, 'pi_dup');
            await expect(nuevaRecarga(beto, WALLET_BETO, 10, 'pi_dup')).rejects.toThrow(/uq_billing_deposit_fiat_intent/);
        });
    });

    describe('verificación en cadena del depósito BEZ', () => {
        const verifica = (rec, opts = {}, head) => verificador.verifyBezDeposit({ txHash: hashTx(1), fromWallet: WALLET_ANA, provider: proveedor(rec, head), ...opts });

        it('acepta una transferencia confirmada desde la wallet del usuario al depósito y suma varias', async () => {
            const r = await verifica(recibo([{ from: WALLET_ANA, to: DEPOSITO, value: 150 }, { from: WALLET_ANA, to: DEPOSITO, value: 50 }]));
            expect(r).toMatchObject({ ok: true, amountBez: 200 });
        });

        it.each([
            ['destinatario distinto', recibo([{ from: WALLET_ANA, to: WALLET_BETO, value: 500 }]), 'NO_MATCHING_TRANSFER'],
            ['remitente distinto (la transacción es de otro)', recibo([{ from: WALLET_BETO, to: DEPOSITO, value: 500 }]), 'NO_MATCHING_TRANSFER'],
            ['otro token', recibo([{ from: WALLET_ANA, to: DEPOSITO, value: 500, token: '0x4444444444444444444444444444444444444444' }]), 'NO_MATCHING_TRANSFER'],
            ['transacción fallida', recibo([{ from: WALLET_ANA, to: DEPOSITO, value: 500 }], { status: 0 }), 'TX_FAILED'],
            ['sin recibo', null, 'TX_NOT_FOUND'],
        ])('rechaza: %s', async (_, rec, code) => {
            expect(await verifica(rec)).toMatchObject({ ok: false, code });
        });

        it('exige confirmaciones y rechaza un hash mal formado', async () => {
            expect(await verifica(recibo([{ from: WALLET_ANA, to: DEPOSITO, value: 500 }], { blockNumber: 100 }), {}, 110)).toMatchObject({ ok: false, code: 'NOT_CONFIRMED' });
            expect(await verifica(recibo([]), { txHash: '0x123' })).toMatchObject({ ok: false, code: 'BAD_TX_HASH' });
        });

        it('sin dirección de depósito configurada falla cerrado', async () => {
            expect(await verificador.verifyBezDeposit({ txHash: hashTx(1), fromWallet: WALLET_ANA, provider: proveedor(recibo([])), env: {} })).toMatchObject({ ok: false, code: 'NOT_CONFIGURED' });
        });

        it('un error del RPC se informa como RPC_ERROR, no como depósito válido', async () => {
            const roto = { getTransactionReceipt: async () => { throw new Error('timeout'); }, getBlockNumber: async () => 1 };
            expect(await verifica(null, { provider: roto })).toMatchObject({ ok: false, code: 'RPC_ERROR' });
        });
    });

    describe('POST /api/billing/add-bez-funds', () => {
        let app; let usuarioActual; let verifyMock;

        beforeAll(() => {
            jest.resetModules();
            verifyMock = jest.fn();
            jest.doMock('../../middleware/auth.middleware', () => ({ protect: (req, _res, next) => { req.user = usuarioActual; next(); } }));
            jest.doMock('../../services/price-oracle.service', () => ({ getBezEurPrice: async () => 0.1 }));
            jest.doMock('../../services/bezDepositVerifier', () => ({ verifyBezDeposit: verifyMock }));
            app = express();
            app.use(express.json());
            app.use('/api/billing', require('../../routes/billing.routes'));
        });

        const post = (hash, body = {}) => request(app).post('/api/billing/add-bez-funds').send({ txHash: hash, ...body });

        it('acredita lo VERIFICADO en cadena e ignora el importe que envía el cliente', async () => {
            await pg.query('DELETE FROM ad_balances WHERE user_id = $1', [beto.id]);
            usuarioActual = { _id: beto.id, walletAddress: WALLET_BETO };
            verifyMock.mockResolvedValueOnce({ ok: true, amountBez: 200, blockNumber: 1 });
            const r = await post(hashTx(10), { amount: 999999999 });
            expect(r.status).toBe(200);
            expect(r.body.transaction).toMatchObject({ amount: 200, eurEquivalent: '20.00' });
            expect(await AdBalance.findByUserId(beto.id)).toMatchObject({ bezBalance: 200, totalDeposited: 20 });
            expect(verifyMock).toHaveBeenCalledWith(expect.objectContaining({ txHash: hashTx(10), fromWallet: WALLET_BETO }));
        });

        it('el mismo hash no se acredita dos veces, ni en mayúsculas ni con peticiones simultáneas', async () => {
            usuarioActual = { _id: beto.id, walletAddress: WALLET_BETO };
            verifyMock.mockResolvedValue({ ok: true, amountBez: 300, blockNumber: 1 });
            const h = hashTx(11);
            const r = await Promise.all([post(h), post(h), post(h.toUpperCase().replace('0X', '0x')), post(h)]);
            expect(r.filter((x) => x.status === 200)).toHaveLength(1);
            expect(r.filter((x) => x.status === 409 && x.body.code === 'DUPLICATE_TX')).toHaveLength(3);
            expect((await AdBalance.findByUserId(beto.id)).bezBalance).toBe(500);
        });

        it('una verificación fallida no acredita nada y devuelve su código', async () => {
            usuarioActual = { _id: beto.id, walletAddress: WALLET_BETO };
            verifyMock.mockResolvedValueOnce({ ok: false, code: 'NO_MATCHING_TRANSFER', error: 'sin transferencia' });
            const r = await post(hashTx(12), { amount: 5000 });
            expect(r.status).toBe(400);
            expect(r.body.code).toBe('NO_MATCHING_TRANSFER');
            expect((await AdBalance.findByUserId(beto.id)).bezBalance).toBe(500);
            verifyMock.mockResolvedValueOnce({ ok: false, code: 'NOT_CONFIGURED', error: 'x' });
            expect((await post(hashTx(13))).status).toBe(503);
            verifyMock.mockResolvedValueOnce({ ok: false, code: 'RPC_ERROR', error: 'x' });
            expect((await post(hashTx(14))).status).toBe(502);
        });

        it('rechaza menos de 100 BEZ verificados, un hash inválido y un usuario sin wallet', async () => {
            usuarioActual = { _id: beto.id, walletAddress: WALLET_BETO };
            verifyMock.mockResolvedValueOnce({ ok: true, amountBez: 50, blockNumber: 1 });
            expect((await post(hashTx(15))).body.code).toBe('BELOW_MINIMUM');
            expect((await post('0xabc')).status).toBe(400);
            usuarioActual = { _id: beto.id, walletAddress: null };
            expect((await post(hashTx(16))).body.code).toBe('WALLET_REQUIRED');
            expect((await AdBalance.findByUserId(beto.id)).bezBalance).toBe(500);
        });

        it('GET /balance y /history leen el saldo y las transacciones del usuario', async () => {
            usuarioActual = { _id: beto.id, walletAddress: WALLET_BETO };
            const b = await request(app).get('/api/billing/balance');
            expect(b.body.data).toMatchObject({ bez: { amount: 500, eurEquivalent: '50.00' }, totalInEur: '50.00' });
            const h = await request(app).get('/api/billing/history?type=deposit_bez&limit=1');
            expect(h.body.pagination).toMatchObject({ total: 2, pages: 2 });
            expect(h.body.data[0]).toMatchObject({ type: 'deposit_bez', status: 'completed', currency: 'BEZ' });
        });
    });
});
