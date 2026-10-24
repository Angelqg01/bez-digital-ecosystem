/**
 * Patrocinio y conciliación del Gas Tank — Postgres real con el esquema COMPLETO (node db/migrate.js hasta la 074).
 * Sin GAS_TANK_TEST_DATABASE_URL se salta. Firma, precios y cadena van inyectados.
 */
const URL = process.env.GAS_TANK_TEST_DATABASE_URL;
const maybe = URL ? describe : describe.skip;

maybe('gasTank paymasterService + policy + reconciler (Postgres real)', () => {
    const { ethers } = require('ethers');
    let db, ledger, svc, u, rec, orgId, appId, enterpriseId;

    const signerWallet = ethers.Wallet.createRandom();
    const signer = { address: signerWallet.address, signMessage: (b) => signerWallet.signMessage(b) };
    const chain = {
        chainId: 137,
        entryPoint: '0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108',
        paymaster: '0x' + '44'.repeat(20),
        vault: '0x' + '11'.repeat(20),
        bez: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
    };
    const FACTORY = ethers.getAddress('0x' + '77'.repeat(20));
    const TOKENIZE = ethers.id('tokenizeAsset(string)').slice(0, 10);
    const SENDER = ethers.getAddress('0x000000000000000000000000000000000000bEEF');
    const prices = { getPolEur: async () => 0.4, getBezEur: async () => 0.0075 };
    let deps;

    const ACCOUNT = new ethers.Interface(['function executeBatch((address target,uint256 value,bytes data)[])', 'function execute(address,uint256,bytes)']);
    const FACT = new ethers.Interface(['function tokenizeAsset(string)']);
    const ERC20 = new ethers.Interface(['function approve(address,uint256)', 'function transfer(address,uint256)']);
    const VAULT = new ethers.Interface(['function pullProtocolFee(bytes32,address,bytes4,uint256,uint48,bytes32,bytes)']);

    const mkOp = (callData, nonce = 1n) => ({
        sender: SENDER, nonce: '0x' + nonce.toString(16), initCode: '0x', callData,
        accountGasLimits: ethers.concat([ethers.toBeHex(200000, 16), ethers.toBeHex(300000, 16)]),
        preVerificationGas: '0xea60',
        gasFees: ethers.concat([ethers.toBeHex(30_000_000_000, 16), ethers.toBeHex(60_000_000_000, 16)]),
        paymasterAndData: ethers.concat([chain.paymaster, ethers.toBeHex(150000, 16), ethers.toBeHex(80000, 16)]),
    });
    const plainCall = (nonce) => mkOp(ACCOUNT.encodeFunctionData('execute', [FACTORY, 0, FACT.encodeFunctionData('tokenizeAsset', ['x'])]), nonce);

    async function feeBatch({ amountBez = '100', nonce = 1n, tweak = {} } = {}) {
        const v = await svc.issueFeeVoucher({ orgId, appId, sender: SENDER, target: FACTORY, selector: TOKENIZE, amountBez }, deps);
        const amount = BigInt(v.amount);
        const calls = [
            [chain.vault, 0, VAULT.encodeFunctionData('pullProtocolFee', [v.orgId, v.target, v.selector, amount, v.validUntil, v.nonce, v.signature])],
            [chain.bez, 0, ERC20.encodeFunctionData('approve', [tweak.spender || FACTORY, tweak.approve ?? amount])],
            [FACTORY, 0, FACT.encodeFunctionData('tokenizeAsset', ['galpon'])],
        ].filter((c, i) => !(tweak.dropCall === i));
        return mkOp(ACCOUNT.encodeFunctionData('executeBatch', [calls]), nonce);
    }

    beforeAll(async () => {
        process.env.DATABASE_URL = URL;
        db = require('../../db/pool');
        ledger = require('../../services/gasTank/ledger');
        svc = require('../../services/gasTank/paymasterService');
        u = require('../../services/gasTank/userOp');
        rec = require('../../services/gasTank/reconciler');
    });

    beforeEach(async () => {
        // DELETE y no TRUNCATE ... CASCADE: enterprises arrastraría tablas append-only (tx_approvals) que no se pueden vaciar.
        await db.query('TRUNCATE gas_tank_ledger, gas_tank_reservations, gas_tank_policies, gas_tank_accounts, gas_tank_chain_cursor');
        await db.query(`DELETE FROM app_registry WHERE app_name IN ('acme-app', 'otra')`);
        await db.query(`DELETE FROM organizations WHERE name IN ('Acme', 'Otra')`);
        await db.query(`DELETE FROM enterprises WHERE name IN ('Acme', 'Otra')`);
        enterpriseId = (await db.query(`INSERT INTO enterprises (name, sector, tier, is_active) VALUES ('Acme', 'logistics', 'enterprise', TRUE) RETURNING id`)).rows[0].id;
        orgId = (await db.query(`INSERT INTO organizations (name, legacy_enterprise_id, verification_status) VALUES ('Acme', $1, 'verified') RETURNING id`, [enterpriseId])).rows[0].id;
        appId = (await db.query(`INSERT INTO app_registry (app_name, enterprise_id, api_key_hash) VALUES ('acme-app', $1, 'h-acme') RETURNING id`, [enterpriseId])).rows[0].id;
        await db.query(
            `INSERT INTO gas_tank_policies (organization_id, allowed_targets, max_cost_credits_per_op) VALUES ($1, $2::jsonb, 5000)`,
            [orgId, JSON.stringify([{ address: FACTORY, selectors: [TOKENIZE], maxFeeBez: '100' }])]);
        await ledger.credit(orgId, 100000);
        deps = { chain, signer, prices, now: () => 1_800_000_000 };
    });
    afterAll(async () => { await db.pool.end(); });

    test('patrocina una llamada permitida: firma recuperable, reserva hecha y paymasterAndData bien formado', async () => {
        const raw = plainCall();
        const out = await svc.sponsorUserOp({ orgId, appId, userOp: raw }, deps);

        const pd = ethers.getBytes(out.paymasterAndData);
        expect(ethers.hexlify(pd.slice(0, 20))).toBe(chain.paymaster.toLowerCase());
        expect(pd.length).toBe(52 + 128 + 65);
        const op = u.normalize({ ...raw, paymasterAndData: out.paymasterAndData });
        const orgB32 = u.orgIdBytes32(orgId);
        const hash = u.paymasterHash({ op, orgId: orgB32, validUntil: out.validUntil, validAfter: 0, signedMax: BigInt(out.maxCostWei), chainId: 137, paymaster: chain.paymaster });
        const sig = ethers.hexlify(pd.slice(52 + 128));
        expect(ethers.verifyMessage(ethers.getBytes(hash), sig)).toBe(signer.address);

        const max = u.maxCost(u.normalize(raw));
        expect(BigInt(out.maxCostWei)).toBe(max.maxCostWei);
        const b = await ledger.getBalance(orgId);
        expect(b.reservedCredits).toBe(out.maxCostCredits);
        expect(b.balanceCredits).toBe(100000 - out.maxCostCredits);
    });

    test('la misma UserOp (cuenta+nonce) no se patrocina dos veces; otro nonce sí', async () => {
        await svc.sponsorUserOp({ orgId, appId, userOp: plainCall(1n) }, deps);
        await expect(svc.sponsorUserOp({ orgId, appId, userOp: plainCall(1n) }, deps)).rejects.toMatchObject({ code: 'ALREADY_SPONSORED' });
        await expect(svc.sponsorUserOp({ orgId, appId, userOp: plainCall(2n) }, deps)).resolves.toBeTruthy();
    });

    test.each([
        ['sin política', async () => db.query('DELETE FROM gas_tank_policies'), 'NO_POLICY'],
        ['política inactiva', async () => db.query('UPDATE gas_tank_policies SET active = FALSE'), 'NO_POLICY'],
        ['organización sin KYB', async () => db.query(`UPDATE organizations SET verification_status = 'pending'`), 'ORG_NOT_VERIFIED'],
        ['coste sobre el tope por operación', async () => db.query('UPDATE gas_tank_policies SET max_cost_credits_per_op = 1'), 'COST_ABOVE_POLICY'],
        ['tope diario agotado', async () => db.query('UPDATE gas_tank_policies SET daily_cap_credits = 1'), 'DAILY_CAP'],
        ['destino fuera de la política', async () => db.query(`UPDATE gas_tank_policies SET allowed_targets = '[]'::jsonb`), 'TARGET_NOT_ALLOWED'],
    ])('deniega: %s', async (_n, mutate, code) => {
        await mutate();
        await expect(svc.sponsorUserOp({ orgId, appId, userOp: plainCall() }, deps)).rejects.toMatchObject({ code });
        expect((await ledger.getBalance(orgId)).reservedCredits).toBe(0);
    });

    test('app de otra organización, o sin saldo: 403 / 402 sin reservar', async () => {
        const otherEnt = (await db.query(`INSERT INTO enterprises (name, sector, tier, is_active) VALUES ('Otra', 'fintech', 'enterprise', TRUE) RETURNING id`)).rows[0].id;
        const otherApp = (await db.query(`INSERT INTO app_registry (app_name, enterprise_id, api_key_hash) VALUES ('otra', $1, 'h-otra') RETURNING id`, [otherEnt])).rows[0].id;
        await db.query(`INSERT INTO organizations (name, legacy_enterprise_id) VALUES ('Otra', $1)`, [otherEnt]);
        await expect(svc.sponsorUserOp({ orgId, appId: otherApp, userOp: plainCall() }, deps)).rejects.toMatchObject({ code: 'APP_NOT_IN_ORG', status: 403 });

        await db.query('UPDATE gas_tank_accounts SET balance_credits = 0');
        await expect(svc.sponsorUserOp({ orgId, appId, userOp: plainCall() }, deps)).rejects.toMatchObject({ code: 'INSUFFICIENT_GAS_TANK', status: 402 });
    });

    test('rechaza llamadas con valor, transferencias de BEZ y cualquier otra función de la cuenta', async () => {
        const withValue = mkOp(ACCOUNT.encodeFunctionData('execute', [FACTORY, 1, FACT.encodeFunctionData('tokenizeAsset', ['x'])]));
        await expect(svc.sponsorUserOp({ orgId, appId, userOp: withValue }, deps)).rejects.toMatchObject({ code: 'VALUE_NOT_ALLOWED' });
        const steal = mkOp(ACCOUNT.encodeFunctionData('execute', [chain.bez, 0, ERC20.encodeFunctionData('transfer', [SENDER, 1])]));
        await expect(svc.sponsorUserOp({ orgId, appId, userOp: steal }, deps)).rejects.toMatchObject({ code: 'BEZ_CALL_NOT_ALLOWED' });
        const other = mkOp(new ethers.Interface(['function upgradeToAndCall(address,bytes)']).encodeFunctionData('upgradeToAndCall', [FACTORY, '0x']));
        await expect(svc.sponsorUserOp({ orgId, appId, userOp: other }, deps)).rejects.toMatchObject({ code: 'CALLDATA_NOT_SUPPORTED' });
    });

    describe('comisión de protocolo con la bóveda', () => {
        test('lote voucher + approve + tokenizar: patrocinado, y la reserva incluye la comisión', async () => {
            const out = await svc.sponsorUserOp({ orgId, appId, userOp: await feeBatch() }, deps);
            const r = await ledger.getReservation(u.reservationKey({ entryPoint: chain.entryPoint, chainId: 137, sender: SENDER, nonce: 1n }));
            expect(r.meta.feeCredits).toBeGreaterThan(0);
            // 100 BEZ × 0,0075 € × 1,25 / 0,001 = 937,5 → 938 créditos de comisión
            expect(r.meta.feeCredits).toBe(938);
            expect(out.maxCostCredits).toBe(r.meta.gasOnlyCredits + 938);
        });

        test.each([
            ['approve a otro contrato', { tweak: { spender: '0x' + '99'.repeat(20) } }, 'APPROVE_SPENDER_MISMATCH'],
            ['approve por más de la comisión', { tweak: { approve: 10n ** 30n } }, 'APPROVE_AMOUNT_MISMATCH'],
            ['sin approve', { tweak: { dropCall: 1 } }, 'FEE_BATCH_MISMATCH'],
            ['sin la llamada que consume la comisión', { tweak: { dropCall: 2 } }, 'FEE_TARGET_MISSING'],
        ])('deniega: %s', async (_n, opts, code) => {
            await expect(svc.sponsorUserOp({ orgId, appId, userOp: await feeBatch(opts) }, deps)).rejects.toMatchObject({ code });
        });

        test('un voucher falsificado (firmado por otra clave) se rechaza', async () => {
            const v = await svc.issueFeeVoucher({ orgId, appId, sender: SENDER, target: FACTORY, selector: TOKENIZE, amountBez: '100' }, deps);
            const fake = await ethers.Wallet.createRandom().signMessage(ethers.getBytes(u.vaultHash({
                chainId: 137, vault: chain.vault, orgId: v.orgId, to: SENDER, target: FACTORY, selector: TOKENIZE, amount: BigInt(v.amount), validUntil: v.validUntil, nonce: v.nonce })));
            const calls = [
                [chain.vault, 0, VAULT.encodeFunctionData('pullProtocolFee', [v.orgId, v.target, v.selector, BigInt(v.amount), v.validUntil, v.nonce, fake])],
                [chain.bez, 0, ERC20.encodeFunctionData('approve', [FACTORY, BigInt(v.amount)])],
                [FACTORY, 0, FACT.encodeFunctionData('tokenizeAsset', ['x'])],
            ];
            await expect(svc.sponsorUserOp({ orgId, appId, userOp: mkOp(ACCOUNT.encodeFunctionData('executeBatch', [calls])) }, deps)).rejects.toMatchObject({ code: 'VOUCHER_INVALID' });
        });

        test('un voucher emitido para otra cuenta no sirve en esta', async () => {
            const v = await svc.issueFeeVoucher({ orgId, appId, sender: '0x' + '88'.repeat(20), target: FACTORY, selector: TOKENIZE, amountBez: '100' }, deps);
            const calls = [
                [chain.vault, 0, VAULT.encodeFunctionData('pullProtocolFee', [v.orgId, v.target, v.selector, BigInt(v.amount), v.validUntil, v.nonce, v.signature])],
                [chain.bez, 0, ERC20.encodeFunctionData('approve', [FACTORY, BigInt(v.amount)])],
                [FACTORY, 0, FACT.encodeFunctionData('tokenizeAsset', ['x'])],
            ];
            await expect(svc.sponsorUserOp({ orgId, appId, userOp: mkOp(ACCOUNT.encodeFunctionData('executeBatch', [calls])) }, deps)).rejects.toMatchObject({ code: 'VOUCHER_INVALID' });
        });

        test('issueFeeVoucher respeta la regla: importe máximo, destino y KYB', async () => {
            const base = { orgId, appId, sender: SENDER, target: FACTORY, selector: TOKENIZE, amountBez: '100' };
            await expect(svc.issueFeeVoucher({ ...base, amountBez: '101' }, deps)).rejects.toMatchObject({ code: 'FEE_ABOVE_RULE' });
            await expect(svc.issueFeeVoucher({ ...base, target: '0x' + '55'.repeat(20) }, deps)).rejects.toMatchObject({ code: 'FEE_TARGET_NOT_ALLOWED' });
            await db.query(`UPDATE organizations SET verification_status = 'pending'`);
            await expect(svc.issueFeeVoucher(base, deps)).rejects.toMatchObject({ code: 'ORG_NOT_VERIFIED' });
        });
    });

    describe('conciliador', () => {
        const key = (nonce = 1n) => u.reservationKey({ entryPoint: chain.entryPoint, chainId: 137, sender: SENDER, nonce });
        const ev = (over = {}) => ({ entryPoint: chain.entryPoint, chainId: 137, sender: SENDER, nonce: 1n, success: true, actualGasCost: 10n ** 15n, txHash: '0xtx', ...over });

        test('liquida con actualGasCost y el precio fijado al reservar; devuelve el resto', async () => {
            const out = await svc.sponsorUserOp({ orgId, appId, userOp: plainCall() }, deps);
            const r = await rec.settleFromEvent(ev());
            const expected = rec.creditsFromWei(10n ** 15n, 0.4); // 0,001 POL × 0,4 € × 1,25 / 0,001 = 0,5 → 1
            expect(r).toMatchObject({ gasCredits: expected, feeCredits: 0, charged: expected });
            const b = await ledger.getBalance(orgId);
            expect(b.balanceCredits).toBe(100000 - expected);
            expect(b.reservedCredits).toBe(0);
            expect(out.maxCostCredits).toBeGreaterThan(expected);
        });

        test('una UserOp con comisión cobra gas + comisión si tuvo éxito, y solo gas si revirtió', async () => {
            await svc.sponsorUserOp({ orgId, appId, userOp: await feeBatch({ nonce: 1n }) }, deps);
            await svc.sponsorUserOp({ orgId, appId, userOp: await feeBatch({ nonce: 2n }) }, deps);
            const ok = await rec.settleFromEvent(ev({ nonce: 1n, success: true }));
            const bad = await rec.settleFromEvent(ev({ nonce: 2n, success: false }));
            expect(ok.feeCredits).toBe(938);
            expect(bad.feeCredits).toBe(0);
            expect(ok.charged).toBe(ok.gasCredits + 938);
            expect(bad.charged).toBe(bad.gasCredits);
        });

        test('es idempotente, ignora eventos sin reserva y nunca cobra más de lo reservado', async () => {
            await svc.sponsorUserOp({ orgId, appId, userOp: plainCall() }, deps);
            await rec.settleFromEvent(ev());
            expect(await rec.settleFromEvent(ev())).toMatchObject({ skipped: 'settled' });
            expect(await rec.settleFromEvent(ev({ nonce: 99n }))).toMatchObject({ skipped: 'no_reservation' });

            await svc.sponsorUserOp({ orgId, appId, userOp: plainCall(2n) }, deps);
            const huge = await rec.settleFromEvent(ev({ nonce: 2n, actualGasCost: 10n ** 24n }));
            expect(huge.capped).toBe(true);
            const r = await ledger.getReservation(key(2n));
            expect(huge.charged).toBe(r.max_cost_credits);
        });

        test('scan lee UserOperationEvent del EntryPoint filtrando por paymaster y liquida; el cursor avanza', async () => {
            await svc.sponsorUserOp({ orgId, appId, userOp: plainCall() }, deps);
            const topics = rec.EP_IFACE.encodeEventLog('UserOperationEvent', [ethers.id('h'), SENDER, chain.paymaster, 1n, true, 10n ** 15n, 90000n]);
            let seen;
            const provider = {
                getBlockNumber: async () => 1000,
                getLogs: async (f) => { seen = f; return [{ ...topics, transactionHash: '0xaa', address: chain.entryPoint }]; },
            };
            const out = await rec.runOnce({ provider, entryPoint: chain.entryPoint, paymaster: chain.paymaster, chainId: 137, startBlock: 900 });
            expect(seen.topics[0]).toBe(rec.EVENT_TOPIC);
            expect(seen.topics[3]).toBe(ethers.zeroPadValue(chain.paymaster, 32));
            expect(out.results[0]).toMatchObject({ gasCredits: expect.any(Number) });
            expect((await db.query('SELECT last_block FROM gas_tank_chain_cursor')).rows[0].last_block).toBe('995'); // head 1000 - 5 confirmaciones
            expect((await rec.runOnce({ provider, entryPoint: chain.entryPoint, paymaster: chain.paymaster, chainId: 137 })).scanned).toBe(0);
        });

        test('si un evento no se puede liquidar, el cursor NO avanza (se reintenta)', async () => {
            await svc.sponsorUserOp({ orgId, appId, userOp: plainCall() }, deps);
            const topics = rec.EP_IFACE.encodeEventLog('UserOperationEvent', [ethers.id('h'), SENDER, chain.paymaster, 1n, true, 10n ** 15n, 90000n]);
            const provider = { getBlockNumber: async () => 1000, getLogs: async () => [{ ...topics, transactionHash: '0xaa', address: chain.entryPoint }] };
            const boom = { ledger: { ...ledger, getReservation: async () => { throw new Error('db caída'); } } };
            const out = await rec.runOnce({ provider, entryPoint: chain.entryPoint, paymaster: chain.paymaster, chainId: 137, startBlock: 900 }, boom);
            expect(out.results[0].error).toBe('db caída');
            expect((await db.query('SELECT COUNT(*)::int AS n FROM gas_tank_chain_cursor')).rows[0].n).toBe(0);
        });
    });

    test('releaseSponsorship devuelve la reserva si el cliente no llega a enviar la UserOp', async () => {
        const raw = plainCall();
        await svc.sponsorUserOp({ orgId, appId, userOp: raw }, deps);
        expect((await svc.releaseSponsorship({ orgId, userOp: raw }, deps)).released).toBe(true);
        expect(await ledger.getBalance(orgId)).toMatchObject({ balanceCredits: 100000, reservedCredits: 0 });
        expect((await svc.releaseSponsorship({ orgId: '00000000-0000-0000-0000-000000000000', userOp: raw }, deps)).released).toBe(false);
    });
});
