/**
 * La plataforma cobra en dos cuentas de Stripe (principal y BeZhas). El webhook
 * acepta la firma de cualquiera de las dos, rechaza el resto y anota en la
 * compra retenida qué cuenta la cobró para verificarla allí.
 */
const crypto = require('crypto');
const express = require('express');
const request = require('supertest');
const { mockQuery } = require('../helpers');

const SECRETO_BEZHAS = 'whsec_cuenta_bezhas_test';
process.env.STRIPE_WEBHOOK_SECRET_BEZHAS = SECRETO_BEZHAS;

// Aquí la firma se verifica de verdad, con el SDK real de Stripe.
const StripeReal = jest.requireActual('stripe');
require('stripe').mockImplementation(() => StripeReal('sk_test_x'));

let rutas;
jest.isolateModules(() => { rutas = require('../../routes/webhooks'); });
const { crearLiquidador } = require('../../services/cardSettlementWorker');

function firmaStripe(payload, secreto) {
    const t = Math.floor(Date.now() / 1000);
    return `t=${t},v1=${crypto.createHmac('sha256', secreto).update(`${t}.${payload}`).digest('hex')}`;
}
function app() {
    const a = express();
    a.use('/webhooks', rutas);
    return a;
}
const WALLET = '0x' + 'cd'.repeat(20);
const esperar = () => new Promise((r) => setTimeout(r, 50));
const compra = (id) => JSON.stringify({
    id, type: 'checkout.session.completed',
    data: { object: {
        id: `cs_${id}`, payment_status: 'paid', payment_intent: `pi_${id}`, amount_total: 10000, currency: 'usd', metadata: {},
        custom_fields: [{ key: 'walletaddresstosendbezcoin', text: { value: WALLET } }],
        customer_details: { name: 'Ana', address: { country: 'ES' } },
    } },
});
async function enviar(payload, secreto) {
    return request(app()).post('/webhooks/stripe')
        .set('stripe-signature', firmaStripe(payload, secreto))
        .set('content-type', 'application/json').send(payload);
}
function notaInsertada() {
    const ins = mockQuery.mock.calls.find(([sql]) => /INSERT INTO payment_transactions/.test(sql));
    return ins && JSON.parse(ins[1].find((p) => typeof p === 'string' && p.includes('"entrega"')));
}

afterAll(() => { delete process.env.STRIPE_WEBHOOK_SECRET_BEZHAS; });

describe('POST /webhooks/stripe con dos cuentas', () => {
    beforeEach(() => { mockQuery.mockReset(); mockQuery.mockResolvedValue({ rows: [{ id: 5, status: 'processing' }], rowCount: 1 }); });

    it('acepta la firma de la cuenta principal y la anota', async () => {
        const res = await enviar(compra('evt_a'), process.env.STRIPE_WEBHOOK_SECRET);
        expect(res.status).toBe(200);
        await esperar();
        expect(notaInsertada().entrega).toMatchObject({ estado: 'retenida', referencia: 'pi_evt_a', cuentaStripe: 'principal' });
    });

    it('acepta la firma de la cuenta BeZhas y la anota', async () => {
        const res = await enviar(compra('evt_b'), SECRETO_BEZHAS);
        expect(res.status).toBe(200);
        await esperar();
        expect(notaInsertada().entrega).toMatchObject({ referencia: 'pi_evt_b', cuentaStripe: 'bezhas' });
    });

    it('rechaza una firma que no es de ninguna de las dos', async () => {
        const res = await enviar(compra('evt_c'), 'whsec_de_otro');
        expect(res.status).toBe(400);
        await esperar();
        expect(notaInsertada()).toBeUndefined();
    });
});

describe('cardSettlementWorker elige la cuenta de Stripe de cada compra', () => {
    function montar(entrega, inyectadas) {
        const fila = { id: 1, status: 'processing', note: JSON.stringify({ entrega }) };
        const query = jest.fn(async (sql, params) => {
            if (/^UPDATE/.test(sql)) { fila.note = params[1]; return { rows: [], rowCount: 1 }; }
            return { rows: [fila] };
        });
        const verificar = jest.fn(async () => ({ ok: false, reintentable: true, motivo: 'EN_CAMINO_AL_BANCO' }));
        const liq = crearLiquidador({ query, verificar, notificar: async () => ({}), env: {}, ...inyectadas });
        return { liq, verificar };
    }
    const base = { estado: 'retenida', referencia: 'pi_1', importeMinor: 10000, moneda: 'eur' };
    const principal = { nombre: 'principal' };
    const bezhas = { nombre: 'bezhas' };

    it('una compra de la cuenta BeZhas se verifica con el cliente BeZhas', async () => {
        const { liq, verificar } = montar({ ...base, cuentaStripe: 'bezhas' }, { stripe: principal, stripeBezhas: bezhas });
        await liq.barrer();
        expect(verificar.mock.calls[0][0].stripe).toBe(bezhas);
    });

    it('una compra sin cuenta anotada (anteriores) usa la principal', async () => {
        const { liq, verificar } = montar(base, { stripe: principal, stripeBezhas: bezhas });
        await liq.barrer();
        expect(verificar.mock.calls[0][0].stripe).toBe(principal);
    });

    it('sin clave de la cuenta BeZhas no hay verificador: nunca se usa la principal', async () => {
        const { liq, verificar } = montar({ ...base, cuentaStripe: 'bezhas' }, { stripe: principal });
        await liq.barrer();
        expect(verificar.mock.calls[0][0].stripe).toBeNull();
    });
});
