/**
 * Compra de BEZ con tarjeta desde el chat: creación de la sesión de Stripe. El cobro, la retención y la
 * entrega de BEZ los cubre webhooks-fiat-hold.test.js; aquí, lo que hace este servicio: fijar importe,
 * moneda e identidad en el servidor y negarse cuando no es seguro. Los planes se contratan con Payment Links.
 */
const crypto = require('crypto');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { mockQuery } = require('../helpers');

const app = require('../../index');
const chatCheckout = require('../../services/chatCheckout');

let UID = crypto.randomUUID(); // un usuario nuevo por test: el limitador de pagos es por usuario
const WALLET = '0x' + 'ab'.repeat(20);
const sesion = (userId = UID) => ({ Authorization: `Bearer ${jwt.sign({ address: WALLET, userId, role: 'user' }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' })}` });

const create = jest.fn();
let usuario;
beforeEach(() => {
    jest.clearAllMocks();
    UID = crypto.randomUUID();
    process.env.CHAT_CHECKOUT_RETURN_BASE = 'https://bezhas.com';
    create.mockResolvedValue({ url: 'https://checkout.stripe.com/c/pay/cs_live_abc', id: 'cs_1' });
    chatCheckout.__setStripe({ checkout: { sessions: { create } } });
    usuario = { id: UID, email: 'ana@bezhas.com', auth_type: 'wallet', custody_mode: 'external', wallet_address: WALLET, primary_wallet_address: WALLET, primary_smart_wallet_address: null };
    mockQuery.mockReset();
    mockQuery.mockImplementation(async (sql) => {
        if (/FROM users WHERE id/.test(sql)) return { rows: [usuario] };
        return { rows: [], rowCount: 0 };
    });
});

const pagar = (ruta, body, headers = sesion()) => request(app).post(`/api/checkout${ruta}`).set(headers).send(body);
const sinSesion = () => request(app).post('/api/checkout/bez').send({ amountEur: 10 });

describe('POST /api/checkout/bez', () => {
    it('sin sesión → 401/403 y no toca Stripe', async () => {
        expect([401, 403]).toContain((await sinSesion()).status);
        expect(create).not.toHaveBeenCalled();
    });

    it('el POST /plan ya no existe aquí: los planes van por Payment Links', async () => {
        expect((await pagar('/plan', { planId: 'business' })).status).toBe(404);
    });

    it('crea un pago único en EUR a la wallet de la CUENTA, con el importe en céntimos', async () => {
        const res = await pagar('/bez', { amountEur: 100 });
        expect(res.status).toBe(200);
        const arg = create.mock.calls[0][0];
        expect(arg.mode).toBe('payment');
        expect(arg.line_items[0].price_data).toMatchObject({ currency: 'eur', unit_amount: 10000 });
        expect(arg.client_reference_id).toBe(WALLET);              // el webhook lo lee de aquí
        expect(arg.metadata).toMatchObject({ kind: 'chat_bez', walletAddress: WALLET, user_id: UID });
        expect(arg.payment_intent_data.metadata.walletAddress).toBe(WALLET);
    });

    it('la wallet que manda el cliente se ignora: no se puede redirigir el BEZ a otra dirección', async () => {
        await pagar('/bez', { amountEur: 50, walletAddress: '0x' + 'ee'.repeat(20), wallet: '0x' + 'ee'.repeat(20), client_reference_id: '0x' + 'ee'.repeat(20) });
        const arg = create.mock.calls[0][0];
        expect(arg.client_reference_id).toBe(WALLET);
        expect(JSON.stringify(arg)).not.toMatch(/eeeeeeee/);
    });

    it.each([[9.99], [5000.01], ['abc'], [-10], [0], [null], [NaN], [10.005], [1e9]])('importe inválido %j → 400', async (amountEur) => {
        expect((await pagar('/bez', { amountEur })).status).toBe(400);
        expect(create).not.toHaveBeenCalled();
    });

    it('los límites 10 y 5000 son válidos', async () => {
        expect((await pagar('/bez', { amountEur: 10 })).status).toBe(200);
        expect((await pagar('/bez', { amountEur: 5000 })).status).toBe(200);
    });

    it('cuenta de email SIN wallet real (dirección provisional) → 409 y no se cobra', async () => {
        usuario = { ...usuario, auth_type: 'fiat', custody_mode: 'managed', primary_smart_wallet_address: null, wallet_address: '0x' + '9'.repeat(40) };
        const res = await pagar('/bez', { amountEur: 100 });
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('WALLET_REQUIRED');
        expect(create).not.toHaveBeenCalled();
    });

    it('cuenta de email con wallet gestionada ya provisionada → puede comprar', async () => {
        usuario = { ...usuario, auth_type: 'fiat', custody_mode: 'managed', primary_smart_wallet_address: '0x' + '2'.repeat(40) };
        expect((await pagar('/bez', { amountEur: 100 })).status).toBe(200);
    });

    it('límite de peticiones por usuario: cada llamada crea un objeto en Stripe', async () => {
        let ultimo;
        for (let i = 0; i < 8; i++) ultimo = await pagar('/bez', { amountEur: 20 }, sesion('22222222-2222-4222-8222-222222222222'));
        expect(ultimo.status).toBe(429);
        expect(create.mock.calls.length).toBeLessThan(8);
    });
});

describe('configuración de pagos', () => {
    it('sin STRIPE_SECRET_KEY responde 503 claro', async () => {
        chatCheckout.__setStripe(null);
        const k = process.env.STRIPE_SECRET_KEY; delete process.env.STRIPE_SECRET_KEY;
        try { expect((await pagar('/bez', { amountEur: 20 })).status).toBe(503); } finally { process.env.STRIPE_SECRET_KEY = k; }
    });
    it('el retorno nunca es http fuera de desarrollo', async () => {
        process.env.CHAT_CHECKOUT_RETURN_BASE = 'http://evil.example';
        expect((await pagar('/bez', { amountEur: 20 })).status).toBe(503);
    });
    it('un error de Stripe no filtra detalles al cliente', async () => {
        create.mockRejectedValueOnce(Object.assign(new Error('No such account: acct_1KbkSO… (key sk_live_…)'), { type: 'StripeAuthenticationError' }));
        const res = await pagar('/bez', { amountEur: 20 });
        expect(res.status).toBe(502);
        expect(JSON.stringify(res.body)).not.toMatch(/acct_|sk_live|No such account/);
    });
});
