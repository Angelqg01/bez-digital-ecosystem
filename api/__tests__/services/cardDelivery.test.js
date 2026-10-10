/**
 * Entrega de BEZ por compras FIAT: verificación de fondos (compartida con el
 * Hub), liquidador, precio único y guarda de claves.
 */
require('../helpers');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const { verificarFondosTarjeta } = require('../../services/cardFundsVerifier');
const { crearLiquidador } = require('../../services/cardSettlementWorker');
const precio = require('../../config/bez-price');
const hotKeyGuard = require('../../services/hotKeyGuard');

const AHORA = new Date('2026-09-19T12:00:00Z');
const hace = (dias) => Math.floor(AHORA.getTime() / 1000) - dias * 86400;

/** Stripe simulado con un cobro sano: 100,00 €, 3DS, disponible y abonado. */
function stripeFalso(cambios = {}) {
    const bt = { id: 'txn_1', status: 'available', net: 9650, currency: 'eur', available_on: hace(3), ...cambios.bt };
    const cargo = {
        id: 'ch_1', paid: true, captured: true, status: 'succeeded', refunded: false, amount_refunded: 0, disputed: false,
        created: hace(6), outcome: { type: 'authorized', risk_level: 'normal' },
        payment_method_details: { type: 'card', card: { three_d_secure: { result: 'authenticated' } } },
        billing_details: { name: 'Ana Pérez', email: 'ana@ejemplo.com', address: { country: 'ES' } },
        balance_transaction: bt, ...cambios.cargo,
    };
    const pi = { id: 'pi_1', status: 'succeeded', currency: 'eur', amount_received: 10000, latest_charge: cargo, ...cambios.pi };
    const payouts = cambios.payouts ?? [{ id: 'po_1', arrival_date: hace(1) }];
    const movimientos = cambios.movimientos ?? { po_1: ['txn_0', 'txn_1'] };
    return {
        checkout: { sessions: { retrieve: jest.fn(async () => ({ payment_intent: 'pi_1' })) } },
        paymentIntents: { retrieve: jest.fn(async () => pi) },
        payouts: { list: jest.fn(async () => ({ data: payouts })) },
        balanceTransactions: {
            list: jest.fn(async ({ payout }) => ({ data: (movimientos[payout] || []).map((id) => ({ id })), has_more: false })),
        },
    };
}

const verificar = (stripe, extra = {}) => verificarFondosTarjeta({
    stripe, referencia: 'pi_1', esperado: { importe: 10000, moneda: 'EUR' }, ahora: AHORA, ...extra,
});

describe('cardFundsVerifier', () => {
    it('el fichero es IDÉNTICO en la API y en el Hub', () => {
        const api = fs.readFileSync(path.resolve(__dirname, '../../services/cardFundsVerifier.js'), 'utf8');
        const hub = fs.readFileSync(path.resolve(__dirname, '../../../App-nativas/Bezhas-Hub/backend/services/cardFundsVerifier.js'), 'utf8');
        expect(hub).toBe(api);
    });

    it('cobro sano, disponible y abonado en el banco → se puede entregar', async () => {
        const r = await verificar(stripeFalso());
        expect(r.ok).toBe(true);
        expect(r.detalles).toMatchObject({ payout: 'po_1', autenticacion: '3ds', titular: { nombre: 'Ana Pérez', pais: 'ES' } });
    });

    it('acepta una sesión de Checkout como referencia', async () => {
        expect((await verificar(stripeFalso(), { referencia: 'cs_1' })).ok).toBe(true);
    });

    const casos = [
        ['importe distinto al pedido', { pi: { amount_received: 9999 } }, 'IMPORTE_NO_COINCIDE', 'revisionManual'],
        ['otra moneda', { pi: { currency: 'usd' } }, 'MONEDA_NO_COINCIDE', 'revisionManual'],
        ['reembolso parcial', { cargo: { amount_refunded: 1 } }, 'REEMBOLSADO', 'bloquear'],
        ['disputa', { cargo: { disputed: true } }, 'DISPUTADO', 'bloquear'],
        ['pago cancelado', { pi: { status: 'canceled' } }, 'PAGO_CANCELADO', 'bloquear'],
        ['riesgo elevado en Radar', { cargo: { outcome: { type: 'authorized', risk_level: 'elevated' } } }, 'RIESGO_ELEVADO', 'revisionManual'],
        ['sin 3-D Secure', { cargo: { payment_method_details: { type: 'card', card: {} } } }, 'SIN_3DS', 'revisionManual'],
        ['aún en retención', { cargo: { created: hace(1) } }, 'RETENCION_EN_CURSO', 'reintentable'],
        ['fondos pendientes en Stripe', { bt: { status: 'pending' } }, 'FONDOS_PENDIENTES', 'reintentable'],
        ['no ha llegado al banco', { movimientos: { po_1: ['txn_otro'] } }, 'EN_CAMINO_AL_BANCO', 'reintentable'],
        ['sin payouts pagados', { payouts: [] }, 'EN_CAMINO_AL_BANCO', 'reintentable'],
    ];
    it.each(casos)('%s → %s', async (_n, cambios, motivo, tipo) => {
        const r = await verificar(stripeFalso(cambios));
        expect(r.ok).toBe(false);
        expect(r.motivo).toBe(motivo);
        expect(r[tipo]).toBe(true);
    });

    it('Apple Pay cuenta como autenticado', async () => {
        const r = await verificar(stripeFalso({ cargo: { payment_method_details: { type: 'card', card: { wallet: { type: 'apple_pay' } } } } }));
        expect(r.ok).toBe(true);
        expect(r.detalles.autenticacion).toBe('apple_pay');
    });

    it('sin cliente de Stripe no hay entrega', async () => {
        expect(await verificarFondosTarjeta({ stripe: null, referencia: 'pi_1', esperado: { importe: 1, moneda: 'eur' } }))
            .toMatchObject({ ok: false, motivo: 'SIN_VERIFICADOR', reintentable: true });
    });

    it('la caché de payouts evita releer movimientos', async () => {
        const s = stripeFalso();
        const cache = new Map();
        await verificar(s, { cachePayouts: cache });
        await verificar(s, { cachePayouts: cache });
        expect(s.balanceTransactions.list).toHaveBeenCalledTimes(1);
    });
});

describe('bez-price', () => {
    it('0,0075 USD por defecto, sin coma flotante', () => {
        expect(precio.precioMicroUsd({})).toBe(7500n);
        // 100 USD = 10.000 céntimos → 13.333,33… BEZ, redondeado hacia abajo.
        expect(ethers.formatUnits(precio.centimosUsdABezWei(10000, {}), 18)).toBe('13333.333333333333333333');
    });
    it('BEZ_PRICE_USD manda; un precio mal escrito es un error, no un cero', () => {
        expect(precio.precioUsd({ BEZ_PRICE_USD: '0.01' })).toBe(0.01);
        expect(() => precio.precioMicroUsd({ BEZ_PRICE_USD: '0,0075' })).toThrow();
        expect(() => precio.precioMicroUsd({ BEZ_PRICE_USD: '0' })).toThrow();
    });
});

describe('cardSettlementWorker', () => {
    const WALLET = '0x' + '1'.repeat(40);

    function montar({ nota, verificar: v, estadoIntencion = 'awaiting_approval', env = {} } = {}) {
        const filas = new Map([[1, { id: 1, wallet_address: WALLET, amount_bez: '13333.33', status: 'processing', note: JSON.stringify(nota) }]]);
        const query = jest.fn(async (sql, params) => {
            if (/^UPDATE payment_transactions/.test(sql)) {
                const f = filas.get(params[0]);
                f.note = params[1];
                if (/status = \$3/.test(sql)) f.status = params[2];
                if (/tx_hash = \$(3|4)/.test(sql)) f.tx_hash = params[params.length - 1];
                return { rows: [], rowCount: 1 };
            }
            return { rows: [...filas.values()].filter((f) => f.status === 'processing') };
        });
        const orq = {
            crearIntencion: jest.fn(async () => ({ id: 'int-1', estado: 'awaiting_approval', aprobacionesRequeridas: 2, motivos: [] })),
            obtener: jest.fn(async () => ({ id: 'int-1', estado: estadoIntencion })),
            ejecutar: jest.fn(async () => ({ id: 'int-1', estado: 'broadcast', txHash: '0x' + 'ab'.repeat(32) })),
            cancelar: jest.fn(async () => ({})),
        };
        const liq = crearLiquidador({
            query, orquestador: () => orq, verificar: v || (async () => ({ ok: true, detalles: { titular: { nombre: 'Ana', pais: 'ES' } } })),
            notificar: jest.fn(async () => ({})), stripe: {}, env: { BEZPAY_TREASURY_APP_ID: '00000000-0000-0000-0000-000000000001', ...env },
            ahora: () => AHORA,
        });
        return { liq, orq, fila: () => ({ ...filas.get(1), nota: JSON.parse(filas.get(1).note) }) };
    }
    const retenida = { entrega: { estado: 'retenida', referencia: 'pi_1', importeMinor: 10000, moneda: 'eur' } };

    it('sin fondos confirmados no crea ninguna intención', async () => {
        const { liq, orq, fila } = montar({ nota: retenida, verificar: async () => ({ ok: false, reintentable: true, motivo: 'EN_CAMINO_AL_BANCO' }) });
        await liq.barrer();
        expect(orq.crearIntencion).not.toHaveBeenCalled();
        expect(fila().nota.entrega).toMatchObject({ estado: 'retenida', ultimoMotivo: 'EN_CAMINO_AL_BANCO' });
    });

    it('fondos confirmados → intención desde tesorería, con travel rule del titular', async () => {
        const { liq, orq, fila } = montar({ nota: retenida });
        await liq.barrer();
        const { entrada } = orq.crearIntencion.mock.calls[0][0];
        expect(entrada).toMatchObject({ rail: 'crypto_transfer', asset: 'BEZ', source: { type: 'bezhas_treasury' }, counterparty: { legalName: 'Ana', country: 'ES' } });
        expect(fila().nota.entrega).toMatchObject({ estado: 'pendiente_aprobacion', intentId: 'int-1' });
    });

    it('aprobada por tesorería → se ejecuta y la compra queda completada', async () => {
        const { liq, orq, fila } = montar({
            nota: { entrega: { ...retenida.entrega, estado: 'pendiente_aprobacion', intentId: 'int-1' } }, estadoIntencion: 'approved',
        });
        await liq.barrer();
        expect(orq.ejecutar).toHaveBeenCalled();
        expect(fila().status).toBe('completed');
        expect(fila().nota.entrega.estado).toBe('entregada');
    });

    it('una disputa durante la aprobación cancela la intención y bloquea', async () => {
        const { liq, orq, fila } = montar({
            nota: { entrega: { ...retenida.entrega, estado: 'pendiente_aprobacion', intentId: 'int-1' } },
            verificar: async () => ({ ok: false, bloquear: true, motivo: 'DISPUTADO' }),
        });
        await liq.barrer();
        expect(orq.cancelar).toHaveBeenCalledWith(expect.objectContaining({ id: 'int-1', motivo: 'DISPUTADO' }));
        expect(orq.ejecutar).not.toHaveBeenCalled();
        expect(fila()).toMatchObject({ status: 'failed' });
    });

    it('transferencia bancaria: sin Stripe, directa a intención', async () => {
        const verificarMock = jest.fn();
        const { liq, orq } = montar({ nota: { entrega: { estado: 'fondos_confirmados', origen: 'banco', cliente: { nombre: 'Muster GmbH', pais: 'DE' } } }, verificar: verificarMock });
        await liq.barrer();
        expect(verificarMock).not.toHaveBeenCalled();
        expect(orq.crearIntencion.mock.calls[0][0].entrada.reference).toMatch(/^BZ-BANK-/);
    });

    it('sin app de tesorería configurada no entrega', async () => {
        const { liq, orq, fila } = montar({ nota: retenida, env: { BEZPAY_TREASURY_APP_ID: '' } });
        await liq.barrer();
        expect(orq.crearIntencion).not.toHaveBeenCalled();
        expect(fila().nota.entrega.ultimoMotivo).toBe('SIN_APP_TESORERIA');
    });
});

describe('hotKeyGuard', () => {
    const clave = ethers.Wallet.createRandom();
    it('en producción retira la clave de minteo antigua y la que controla la tesorería', () => {
        const env = {
            NODE_ENV: 'production', BEZ_TREASURY_PK: clave.privateKey,
            OPERATOR_PRIVATE_KEY: clave.privateKey, TX_TREASURY_ADDRESS: clave.address,
            CARGOLINK_OPERATOR_KEY: ethers.Wallet.createRandom().privateKey,
        };
        const r = hotKeyGuard.revisar(env);
        expect(env.BEZ_TREASURY_PK).toBeUndefined();
        expect(env.OPERATOR_PRIVATE_KEY).toBeUndefined();
        expect(env.CARGOLINK_OPERATOR_KEY).toBeDefined();
        expect(r.inventario.map((i) => i.variable)).toEqual(['CARGOLINK_OPERATOR_KEY']);
        expect(JSON.stringify(r)).not.toContain(clave.privateKey.slice(2));
    });
    it('fuera de producción sólo avisa', () => {
        const env = { NODE_ENV: 'development', BEZ_TREASURY_PK: clave.privateKey };
        hotKeyGuard.revisar(env);
        expect(env.BEZ_TREASURY_PK).toBe(clave.privateKey);
    });
});
