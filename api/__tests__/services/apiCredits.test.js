/**
 * Saldo prepago de la API (plan Starter). El libro se prueba con el almacén en
 * memoria, que tiene la misma interfaz que el de Postgres.
 */
const { crearLibro, crearAlmacenMemoria } = require('../../services/apiCredits/ledger');
const cfg = require('../../config/api-credits');

describe('apiCredits/ledger', () => {
    let libro;
    beforeEach(() => { libro = crearLibro(crearAlmacenMemoria()); });

    test('una recarga suma saldo y marca la cuenta', async () => {
        const r = await libro.credit('app', 10000, { ref: 'stripe:cs_1' });
        expect(r).toEqual({ applied: true, balance: 10000 });
        expect(await libro.getAccount('app')).toMatchObject({ balance: 10000, lifetime: 10000 });
    });

    test('la misma sesión de Stripe no recarga dos veces', async () => {
        await libro.credit('app', 10000, { ref: 'stripe:cs_1' });
        const r = await libro.credit('app', 10000, { ref: 'stripe:cs_1' });
        expect(r).toEqual({ applied: false, balance: 10000 });
    });

    test('un bono suma saldo pero no convierte la cuenta en prepago', async () => {
        await libro.credit('app', 2000, { kind: 'bonus' });
        expect(await libro.getAccount('app')).toMatchObject({ balance: 2000, lifetime: 0 });
    });

    test('un cobro descuenta y es idempotente por referencia', async () => {
        await libro.credit('app', 1000);
        expect(await libro.charge('app', 300, { ref: 'r1' })).toMatchObject({ charged: 300, shortfall: 0, balance: 700 });
        expect(await libro.charge('app', 300, { ref: 'r1' })).toMatchObject({ charged: 300, balance: 700, duplicate: true });
    });

    test('si el saldo no alcanza cobra lo que queda y nunca queda en negativo', async () => {
        await libro.credit('app', 100);
        expect(await libro.charge('app', 250, { ref: 'r1' })).toMatchObject({ charged: 100, shortfall: 150, balance: 0 });
        expect(await libro.charge('app', 50, { ref: 'r2' })).toMatchObject({ charged: 0, shortfall: 50, balance: 0 });
    });

    test('la referencia de un cobro es propia de cada app', async () => {
        await libro.credit('a', 1000); await libro.credit('b', 1000);
        await libro.charge('a', 100, { ref: 'misma' });
        expect(await libro.charge('b', 100, { ref: 'misma' })).toMatchObject({ charged: 100, balance: 900 });
    });

    test('reserva y liquidación: se cobra el coste real y vuelve el resto', async () => {
        await libro.credit('app', 1000);
        expect(await libro.reserve('app', 400, { ref: 't1' })).toMatchObject({ maxCredits: 400, balance: 600 });
        expect(await libro.settle('app', 't1', 150)).toMatchObject({ charged: 150, refunded: 250, capped: false, balance: 850 });
        // Liquidar otra vez no devuelve nada más.
        expect(await libro.settle('app', 't1', 150)).toMatchObject({ alreadySettled: true, charged: 150, balance: 850 });
    });

    test('la liquidación nunca cobra más de lo reservado', async () => {
        await libro.credit('app', 1000);
        await libro.reserve('app', 400, { ref: 't1' });
        expect(await libro.settle('app', 't1', 900)).toMatchObject({ charged: 400, refunded: 0, capped: true, balance: 600 });
    });

    test('sin saldo para la reserva no se reserva nada', async () => {
        await libro.credit('app', 300);
        expect(await libro.reserve('app', 400, { ref: 't1' })).toBeNull();
        expect((await libro.getAccount('app')).balance).toBe(300);
    });

    test('dos reservas simultáneas no gastan el mismo saldo', async () => {
        await libro.credit('app', 500);
        const [a, b] = await Promise.all([libro.reserve('app', 400, { ref: 't1' }), libro.reserve('app', 400, { ref: 't2' })]);
        expect([a, b].filter(Boolean)).toHaveLength(1);
        expect((await libro.getAccount('app')).balance).toBe(100);
    });

    test('liberar una reserva devuelve el saldo entero', async () => {
        await libro.credit('app', 1000);
        await libro.reserve('app', 400, { ref: 't1' });
        expect(await libro.release('app', 't1')).toMatchObject({ charged: 0, refunded: 400, balance: 1000 });
    });

    test('rechaza cantidades que no son enteros no negativos', async () => {
        await expect(libro.credit('app', 1.5)).rejects.toThrow(/entero/);
        await expect(libro.credit('app', 0)).rejects.toThrow(/mayor que cero/);
        await expect(libro.charge('app', -5)).rejects.toThrow(/entero/);
    });
});

describe('apiCredits (servicio)', () => {
    let apiCredits; let libro; let planes; let stripeCalls; let sql;

    beforeEach(() => {
        jest.resetModules();
        apiCredits = require('../../services/apiCredits');
        libro = apiCredits.__memoria();
        planes = {}; stripeCalls = []; sql = [];
        apiCredits.__set({
            db: {
                query: async (text, params) => {
                    sql.push({ text, params });
                    if (/FROM gateway_subscriptions/.test(text)) return { rows: planes[params[0]] ? [{ plan_id: planes[params[0]] }] : [] };
                    return { rows: [] };
                },
            },
            stripe: { checkout: { sessions: { create: async (args) => { stripeCalls.push(args); return { id: 'cs_test', url: 'https://checkout.stripe.test/cs_test' }; } } } },
        });
        process.env.FRONTEND_URL = 'https://bezhas.com';
    });

    const sesion = (extra = {}) => ({
        id: 'cs_1', payment_status: 'paid', currency: 'eur', amount_subtotal: 2500, amount_total: 3025,
        metadata: { kind: 'api_credits', app_id: 'app-1' }, ...extra,
    });

    test('1 € da 1.000 créditos y los paquetes no llevan bono', () => {
        expect(cfg.creditosDe(10)).toBe(10000);
        expect(cfg.creditosDe(0.29)).toBe(290);
        expect(cfg.PAQUETES.map((p) => p.eur)).toEqual([10, 25, 50, 100]);
    });

    test('una cuenta que nunca ha recargado no es prepago: la factura el medidor', async () => {
        expect(await apiCredits.cobrar('app-1', 50, 'r1')).toEqual({ prepaid: false });
        expect((await apiCredits.puedeGastar('app-1', 1)).ok).toBe(true);
    });

    test('el webhook abona el importe SIN impuestos y sólo una vez', async () => {
        const r = await apiCredits.acreditarSesion(sesion());
        expect(r).toMatchObject({ appId: 'app-1', eur: 25, credits: 25000, applied: true, balance: 25000 });
        expect(await apiCredits.acreditarSesion(sesion())).toMatchObject({ applied: false, balance: 25000 });
        // La primera recarga da de alta el plan Starter.
        expect(sql.filter((q) => /INSERT INTO gateway_subscriptions/.test(q.text))).toHaveLength(1);
    });

    test('los créditos salen de lo cobrado, no de la metadata', async () => {
        const r = await apiCredits.acreditarSesion(sesion({ amount_subtotal: 1000, metadata: { kind: 'api_credits', app_id: 'app-1', credits: '9999999' } }));
        expect(r.credits).toBe(10000);
    });

    test('no abona sesiones sin cobrar, en otra moneda o sin importe', async () => {
        await expect(apiCredits.acreditarSesion(sesion({ payment_status: 'unpaid' }))).rejects.toThrow(/sin cobrar/);
        await expect(apiCredits.acreditarSesion(sesion({ currency: 'usd' }))).rejects.toThrow(/Moneda/);
        await expect(apiCredits.acreditarSesion(sesion({ amount_subtotal: 0, amount_total: 0 }))).rejects.toThrow(/importe/);
        expect((await libro.getAccount('app-1')).balance).toBe(0);
    });

    test('sólo reconoce como recarga las sesiones marcadas como saldo de la API', () => {
        expect(apiCredits.esSesionDeSaldo(sesion())).toBe(true);
        expect(apiCredits.esSesionDeSaldo({ metadata: { kind: 'chat_bez' } })).toBe(false);
        expect(apiCredits.esSesionDeSaldo({ metadata: { plan_id: 'starter' } })).toBe(false);
        expect(apiCredits.esSesionDeSaldo({})).toBe(false);
    });

    test('tras recargar, el consumo sale del saldo y con el saldo a cero no se puede gastar', async () => {
        await apiCredits.acreditarSesion(sesion({ amount_subtotal: 100 })); // 1 € = 1.000 créditos
        expect(await apiCredits.cobrar('app-1', 400, 'r1')).toMatchObject({ prepaid: true, charged: 400, balance: 600 });
        expect(await apiCredits.puedeGastar('app-1', 601)).toMatchObject({ prepaid: true, ok: false });
        await apiCredits.cobrar('app-1', 600, 'r2');
        expect(await apiCredits.puedeGastar('app-1', 1)).toMatchObject({ prepaid: true, ok: false, balanceCredits: 0 });
    });

    test('un plan de cuota fija no gasta saldo aunque la cuenta lo tenga', async () => {
        await apiCredits.acreditarSesion(sesion());
        planes['app-1'] = 'business';
        expect(await apiCredits.cobrar('app-1', 400, 'r1')).toEqual({ prepaid: false });
        expect((await libro.getAccount('app-1')).balance).toBe(25000);
    });

    test('el checkout cobra el importe del paquete y lleva la app en la metadata', async () => {
        const out = await apiCredits.crearCheckout({ appId: 'app-1', packageId: 'saldo_25', email: 'a@b.es' });
        expect(out).toMatchObject({ url: 'https://checkout.stripe.test/cs_test', eur: 25, credits: 25000 });
        const args = stripeCalls[0];
        expect(args.mode).toBe('payment');
        expect(args.line_items[0].price_data).toMatchObject({ currency: 'eur', unit_amount: 2500 });
        expect(args.metadata).toMatchObject({ kind: 'api_credits', app_id: 'app-1' });
        expect(args.success_url).toBe('https://bezhas.com/dashboard/credits?checkout=success');
    });

    test('el checkout rechaza importes fuera de rango, con más de dos decimales o sin app', async () => {
        await expect(apiCredits.crearCheckout({ appId: 'app-1', amountEur: 1 })).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
        await expect(apiCredits.crearCheckout({ appId: 'app-1', amountEur: 99999 })).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
        await expect(apiCredits.crearCheckout({ appId: 'app-1', amountEur: 10.005 })).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
        await expect(apiCredits.crearCheckout({ appId: 'app-1', packageId: 'no-existe' })).rejects.toMatchObject({ code: 'INVALID_PACKAGE' });
        await expect(apiCredits.crearCheckout({ appId: null, packageId: 'saldo_10' })).rejects.toMatchObject({ code: 'APP_REQUIRED' });
        expect(stripeCalls).toHaveLength(0);
    });

    test('el resumen enseña el cobro neto, no la reserva interna', async () => {
        await apiCredits.acreditarSesion(sesion());
        await apiCredits.reservar('app-1', 400, 't1', { action: 'operant_task' });
        await apiCredits.liquidar('app-1', 't1', 150, { action: 'operant_task' });
        const r = await apiCredits.resumen('app-1');
        expect(r).toMatchObject({ prepaid: true, balanceCredits: 24850, balanceEUR: 24.85 });
        expect(r.activity.map((m) => [m.kind, m.credits])).toEqual([['charge', -150], ['recharge', 25000]]);
        expect(r.models.filter((m) => m.estado === 'disponible').map((m) => m.familia)).toEqual(['Claude', 'Gemini']);
    });
});
