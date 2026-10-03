/**
 * Los webhooks de cobro FIAT ya no entregan BEZ: retienen la compra y la
 * entrega la hace la capa de seguridad cuando el dinero está en la cuenta.
 */
const crypto = require('crypto');
const express = require('express');
const request = require('supertest');
const { mockQuery } = require('../helpers');

// El helper común simula Stripe con un evento fijo; aquí se devuelve el evento
// que se envía (la firma se genera de verdad, pero el SDK está simulado).
require('stripe').mockImplementation(() => ({
    webhooks: { constructEvent: (cuerpo) => JSON.parse(Buffer.isBuffer(cuerpo) ? cuerpo.toString('utf8') : cuerpo) },
}));
const rutas = require('../../routes/webhooks');
// Cabecera de firma de Stripe, construida como la construye Stripe (t=…,v1=HMAC).
function firmaStripe(payload, secreto) {
    const t = Math.floor(Date.now() / 1000);
    return `t=${t},v1=${crypto.createHmac('sha256', secreto).update(`${t}.${payload}`).digest('hex')}`;
}

function app() {
    const a = express();
    a.use('/webhooks', rutas);
    return a;
}
const WALLET = '0x' + 'ab'.repeat(20);
const esperar = () => new Promise((r) => setTimeout(r, 50));

describe('Stripe checkout.session.completed', () => {
    beforeEach(() => { mockQuery.mockReset(); mockQuery.mockResolvedValue({ rows: [{ id: 77, status: 'processing', wallet_address: WALLET }], rowCount: 1 }); });

    it('retiene la compra del Payment Link: nada se acuña, la wallet sale del campo personalizado', async () => {
        const payload = JSON.stringify({
            id: 'evt_1', type: 'checkout.session.completed',
            data: { object: {
                id: 'cs_1', payment_status: 'paid', payment_intent: 'pi_1', amount_total: 10000, currency: 'usd', metadata: {},
                custom_fields: [{ key: 'wallettosendthebezcoin', text: { value: WALLET } }],
                customer_details: { name: 'Ana Pérez', email: 'ana@ejemplo.com', address: { country: 'ES' } },
            } },
        });
        const firma = firmaStripe(payload, process.env.STRIPE_WEBHOOK_SECRET);
        const res = await request(app()).post('/webhooks/stripe')
            .set('stripe-signature', firma).set('content-type', 'application/json').send(payload);
        expect(res.status).toBe(200);
        await esperar();

        const insercion = mockQuery.mock.calls.find(([sql]) => /INSERT INTO payment_transactions/.test(sql));
        expect(insercion).toBeDefined();
        const [, params] = insercion;
        expect(params).toEqual(expect.arrayContaining([WALLET, 'card', 'stripe', 'evt_1', 'pi_1']));
        const nota = JSON.parse(params.find((p) => typeof p === 'string' && p.includes('"entrega"')));
        // 100 USD a 0,0075 → 13.333,33… BEZ, retenidos a la espera de fondos.
        expect(nota.entrega).toMatchObject({ estado: 'retenida', referencia: 'pi_1', importeMinor: 10000, moneda: 'usd' });
        expect(params).toEqual(expect.arrayContaining(['13333.333333333333333333']));
    });
});

describe('POST /webhooks/bank', () => {
    beforeEach(() => { mockQuery.mockReset(); mockQuery.mockResolvedValue({ rows: [{ id: 88, status: 'processing' }], rowCount: 1 }); });

    it('con HMAC válido registra el ingreso para entrega por la capa de seguridad (202), sin acuñar', async () => {
        const cuerpo = { iban: 'DE89370400440532013000', amountCents: 5000, currency: 'EUR', walletAddress: WALLET, eventId: 'bank-1', reference: 'BZ-1', payerName: 'Muster GmbH' };
        const firma = crypto.createHmac('sha256', process.env.BANK_WEBHOOK_SECRET).update(JSON.stringify(cuerpo)).digest('hex');
        const res = await request(app()).post('/webhooks/bank').set('x-bank-signature', firma).send(cuerpo);
        expect(res.status).toBe(202);
        expect(res.body.status).toBe('held_for_delivery');
        const insercion = mockQuery.mock.calls.find(([sql]) => /INSERT INTO payment_transactions/.test(sql));
        const nota = JSON.parse(insercion[1].find((p) => typeof p === 'string' && p.includes('"entrega"')));
        expect(nota.entrega).toMatchObject({ estado: 'fondos_confirmados', origen: 'banco', cliente: { pais: 'DE' } });
    });

    it('sin firma no pasa', async () => {
        const res = await request(app()).post('/webhooks/bank').send({ iban: 'x' });
        expect(res.status).toBe(401);
    });
});
