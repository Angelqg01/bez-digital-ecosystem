import { describe, expect, test, vi, beforeEach } from 'vitest';
import { keccak256, toBytes, pad, toHex } from 'viem';

vi.mock('../services/http', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

import http from '../services/http';
import {
    mensajeDeError, repartosDeActivo, prepararReclamo, prepararCompra, leerOferta, idDeOfertaDeRecibo, sessionAddress,
    runTransactions, POLYGON_CHAIN_ID,
} from './rwaOps';

const CUENTA = '0x' + 'a'.repeat(40);

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

describe('mensajeDeError', () => {
    test('traduce los códigos de la API', () => {
        expect(mensajeDeError({ response: { data: { code: 'KYC_REQUIRED' } } })).toMatch(/KYC/);
        expect(mensajeDeError({ response: { data: { code: 'DISTRIBUTOR_NOT_DEPLOYED' } } })).toMatch(/no está desplegado/);
        expect(mensajeDeError({ response: { data: { code: 'SALE_NOT_DEPLOYED' } } })).toMatch(/no está desplegado/);
        expect(mensajeDeError({ response: { data: { code: 'LISTING_CLOSED' } } })).toMatch(/cerrada/);
    });

    test('un código desconocido cae al mensaje de la API', () => {
        expect(mensajeDeError({ response: { data: { code: 'RARO', error: 'Algo concreto' } } })).toBe('Algo concreto');
    });

    test('401, 403 (wallet ajena o sesión caducada) y 429', () => {
        expect(mensajeDeError({ response: { status: 401, data: {} } })).toMatch(/sesión/);
        expect(mensajeDeError({ response: { status: 403, data: { error: 'No puedes operar en nombre de esa dirección.' } } })).toMatch(/no es la de tu sesión/);
        expect(mensajeDeError({ response: { status: 403, data: { error: 'Invalid or expired SSO token' } } })).toMatch(/sesión ha caducado/);
        expect(mensajeDeError({ response: { status: 429, data: {} } })).toMatch(/Demasiadas/);
    });

    test('sin respuesta de la API se explica en vez de «Network Error»', () => {
        expect(mensajeDeError({ isAxiosError: true, message: 'Network Error' })).toMatch(/No se pudo conectar con la API/);
    });

    test('rechazar la firma no es un fallo', () => {
        expect(mensajeDeError({ code: 4001, message: 'x' })).toMatch(/Cancelaste/);
        expect(mensajeDeError(new Error('User rejected the request.'))).toMatch(/Cancelaste/);
    });

    test('un error cualquiera conserva su mensaje', () => {
        expect(mensajeDeError(new Error('boom'))).toBe('boom');
        expect(mensajeDeError({})).toBe('Algo ha fallado.');
    });
});

describe('cliente', () => {
    test('repartosDeActivo sólo manda la cuenta si se pide', async () => {
        http.get.mockResolvedValue({ data: { repartos: [] } });
        await repartosDeActivo({ assetId: 3 });
        expect(http.get).toHaveBeenLastCalledWith('/api/gateway/v1/rwa/activos/assets/3/rent/distributions', { params: undefined });
        await repartosDeActivo({ fabrica: 'industrial', assetId: 3, cuenta: '0xabc' });
        expect(http.get).toHaveBeenLastCalledWith('/api/gateway/v1/rwa/industrial/assets/3/rent/distributions', { params: { cuenta: '0xabc' } });
    });

    test('venta primaria: leerOferta devuelve la oferta; prepararCompra hace POST', async () => {
        http.get.mockResolvedValue({ data: { oferta: { listingId: '1', abierta: true } } });
        expect(await leerOferta({ listingId: 1 })).toEqual({ listingId: '1', abierta: true });
        expect(http.get).toHaveBeenCalledWith('/api/gateway/v1/rwa/activos/sale/listings/1');
        http.post.mockResolvedValue({ data: { transacciones: [] } });
        await prepararCompra({ listingId: 1, cantidad: 2, comprador: CUENTA });
        expect(http.post).toHaveBeenCalledWith('/api/gateway/v1/rwa/sale/buy/prepare', { listingId: 1, cantidad: 2, comprador: CUENTA });
    });

    test('prepararReclamo hace POST con el cuerpo', async () => {
        http.post.mockResolvedValue({ data: {} });
        await prepararReclamo({ distributionId: 1, cuenta: CUENTA });
        expect(http.post).toHaveBeenCalledWith('/api/gateway/v1/rwa/rent/claim/prepare', { distributionId: 1, cuenta: CUENTA });
    });
});

describe('idDeOfertaDeRecibo', () => {
    const VENTA = '0x' + '5'.repeat(40);
    const topic = keccak256(toBytes('Listed(uint256,uint256,address,uint256,uint256)'));

    test('lee el número de oferta del evento Listed del contrato de venta', () => {
        const recibo = { logs: [
            { address: '0x' + '9'.repeat(40), topics: [topic, pad(toHex(99n), { size: 32 })] }, // otro contrato
            { address: VENTA.toUpperCase().replace('0X', '0x'), topics: [topic, pad(toHex(7n), { size: 32 })] },
        ] };
        expect(idDeOfertaDeRecibo(recibo, VENTA)).toBe('7');
    });

    test('sin evento devuelve null', () => {
        expect(idDeOfertaDeRecibo({ logs: [] }, VENTA)).toBeNull();
        expect(idDeOfertaDeRecibo(null, VENTA)).toBeNull();
    });
});

describe('sessionAddress', () => {
    const jwt = (claims) => `h.${btoa(JSON.stringify(claims)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}.s`;

    test('lee la wallet del JWT', () => {
        localStorage.setItem('bezhas-jwt', jwt({ address: CUENTA }));
        expect(sessionAddress('0x' + 'b'.repeat(40))).toBe(CUENTA);
    });

    test('sin JWT o con uno ilegible usa el respaldo', () => {
        expect(sessionAddress('0xfallback')).toBe('0xfallback');
        localStorage.setItem('bezhas-jwt', 'no-es-un-jwt');
        expect(sessionAddress('0xfallback')).toBe('0xfallback');
        localStorage.setItem('bezhas-jwt', 'demo-123');
        expect(sessionAddress(null)).toBeNull();
    });
});

describe('runTransactions', () => {
    const txs = [
        { paso: 2, descripcion: 'depositar', to: '0xB', data: '0x02', value: '0', chainId: 137 },
        { paso: 1, descripcion: 'aprobar', to: '0xA', data: '0x01', value: '0', chainId: 137 },
    ];

    function deps(over = {}) {
        const orden = [];
        const d = {
            cuentaWallet: CUENTA, cuentaSesion: CUENTA, chainId: 137,
            switchChain: vi.fn(async () => {}),
            sendTransaction: vi.fn(async (tx) => { orden.push(`envia ${tx.data}`); return `h${tx.data}`; }),
            waitForReceipt: vi.fn(async (h) => { orden.push(`espera ${h}`); return { status: 'success', logs: [] }; }),
            onProgress: vi.fn(),
            ...over,
        };
        return { d, orden };
    }

    test('firma en orden de paso y espera cada recibo antes de la siguiente', async () => {
        const { d, orden } = deps();
        expect(await runTransactions(txs, d)).toEqual(['h0x01', 'h0x02']);
        expect(orden).toEqual(['envia 0x01', 'espera h0x01', 'envia 0x02', 'espera h0x02']);
        expect(d.sendTransaction).toHaveBeenCalledWith({ to: '0xA', data: '0x01', value: 0n, chainId: 137 });
    });

    test('cambia a Polygon si la wallet está en otra red', async () => {
        const { d } = deps({ chainId: 1 });
        await runTransactions(txs, d);
        expect(d.switchChain).toHaveBeenCalledWith(POLYGON_CHAIN_ID);
    });

    test('si la wallet tiene activa otra cuenta, no firma nada', async () => {
        const { d } = deps({ cuentaWallet: '0x' + 'b'.repeat(40) });
        await expect(runTransactions(txs, d)).rejects.toThrow(/otra cuenta/);
        expect(d.sendTransaction).not.toHaveBeenCalled();
    });

    test('compara las cuentas sin distinguir mayúsculas', async () => {
        const { d } = deps({ cuentaWallet: CUENTA.toUpperCase().replace('0X', '0x') });
        await expect(runTransactions(txs, d)).resolves.toHaveLength(2);
    });

    test('el progreso «hecho» lleva el recibo', async () => {
        const { d } = deps();
        await runTransactions([txs[1]], d);
        const hecho = d.onProgress.mock.calls.map(([e]) => e).find((e) => e.estado === 'hecho');
        expect(hecho.recibo).toEqual({ status: 'success', logs: [] });
    });

    test('si el primer paso revierte no se envía el segundo', async () => {
        const { d } = deps({ waitForReceipt: vi.fn(async () => ({ status: 'reverted' })) });
        await expect(runTransactions(txs, d)).rejects.toThrow(/paso 1/);
        expect(d.sendTransaction).toHaveBeenCalledTimes(1);
    });

    test('si la wallet rechaza la firma, se corta sin esperar recibo', async () => {
        const { d } = deps({ sendTransaction: vi.fn().mockRejectedValue(Object.assign(new Error('User rejected'), { code: 4001 })) });
        await expect(runTransactions(txs, d)).rejects.toThrow(/rejected/);
        expect(d.waitForReceipt).not.toHaveBeenCalled();
    });

    test('sin transacciones lanza error', async () => {
        await expect(runTransactions([], deps().d)).rejects.toThrow(/No hay transacciones/);
    });
});
