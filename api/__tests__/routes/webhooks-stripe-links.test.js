/**
 * Compras por Payment Link y webhook bancario.
 */
const express = require('express');
const request = require('supertest');
require('../helpers');

describe('walletDeSesion', () => {
    const { walletDeSesion } = require('../../routes/webhooks');
    const W = '0x' + 'ab'.repeat(20);

    it('lee la wallet del campo personalizado de los Payment Links', () => {
        // El enlace de compra de BEZ la pide como `wallettosendthebezcoin` y los de
        // suscripción como `walletaddresstosendbezcoin`: ninguno pone metadata.
        expect(walletDeSesion({ metadata: {}, custom_fields: [{ key: 'wallettosendthebezcoin', text: { value: ` ${W} ` } }] })).toBe(W);
        expect(walletDeSesion({ metadata: {}, custom_fields: [{ key: 'walletaddresstosendbezcoin', text: { value: W } }] })).toBe(W);
    });
    it('sigue aceptando metadata y client_reference_id', () => {
        expect(walletDeSesion({ metadata: { walletAddress: W } })).toBe(W);
        expect(walletDeSesion({ metadata: {}, client_reference_id: W })).toBe(W);
    });
    it('lo que escribe el comprador sólo vale si es una dirección', () => {
        expect(walletDeSesion({ metadata: {}, custom_fields: [{ key: 'wallettosendthebezcoin', text: { value: 'mi wallet de metamask' } }] })).toBeNull();
    });
});

describe('POST /webhooks/bank sin secreto', () => {
    it('falla cerrado: 503, nunca procesa sin HMAC', async () => {
        const previo = process.env.BANK_WEBHOOK_SECRET;
        delete process.env.BANK_WEBHOOK_SECRET;
        let rutas;
        jest.isolateModules(() => { rutas = require('../../routes/webhooks'); });
        process.env.BANK_WEBHOOK_SECRET = previo;
        const app = express();
        app.use('/webhooks', rutas);
        const res = await request(app).post('/webhooks/bank').send({
            iban: 'ES9121000418450200051332', amountCents: 100000, currency: 'EUR',
            walletAddress: '0x' + '1'.repeat(40), eventId: 'evt-falso',
        });
        expect(res.status).toBe(503);
    });
});
