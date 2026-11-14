import { ApiError } from '../../lib/api';
import { id as keccakId, zeroPadValue, toBeHex } from 'ethers';
import {
    mensajeDeError, runTransactions, repartosDeActivo, prepararReclamo, leerOferta, prepararCompra, idDeOfertaDeRecibo,
    POLYGON_CHAIN_ID, type Transaccion,
} from '../../lib/rwaRent';

jest.mock('../../lib/api', () => {
    const real = jest.requireActual('../../lib/api');
    return { ...real, apiFetch: jest.fn() };
});
jest.mock('../../lib/contracts', () => ({ getBrowserSigner: jest.fn() }));

import { apiFetch } from '../../lib/api';

const CUENTA = '0x' + 'a'.repeat(40);

beforeEach(() => jest.clearAllMocks());

describe('mensajeDeError', () => {
    it('traduce los códigos de la API', () => {
        expect(mensajeDeError(new ApiError('x', 409, 'KYC_REQUIRED'))).toMatch(/KYC/);
        expect(mensajeDeError(new ApiError('x', 503, 'DISTRIBUTOR_NOT_DEPLOYED'))).toMatch(/no está desplegado/);
    });

    it('un código desconocido cae al mensaje de la API; 403 y 429 tienen su texto', () => {
        expect(mensajeDeError(new ApiError('Algo concreto', 400, 'RARO'))).toBe('Algo concreto');
        expect(mensajeDeError(new ApiError('No puedes operar en nombre de esa dirección.', 403))).toMatch(/no es la de tu sesión/);
        expect(mensajeDeError(new ApiError('Invalid or expired SSO token', 403))).toMatch(/sesión ha caducado/);
        expect(mensajeDeError(new ApiError('x', 429))).toMatch(/Demasiadas/);
    });

    it('rechazar la firma no es un fallo (EIP-1193 y ethers)', () => {
        expect(mensajeDeError({ code: 4001, message: 'x' })).toMatch(/Cancelaste/);
        expect(mensajeDeError({ code: 'ACTION_REJECTED', message: 'x' })).toMatch(/Cancelaste/);
        expect(mensajeDeError(new Error('User rejected the request.'))).toMatch(/Cancelaste/);
    });

    it('«Failed to fetch» del navegador se explica como API inaccesible', () => {
        for (const m of ['Failed to fetch', 'NetworkError when attempting to fetch resource.', 'Load failed']) {
            expect(mensajeDeError(new TypeError(m))).toMatch(/No se pudo conectar con la API/);
        }
        // Un TypeError de código no es un problema de red.
        expect(mensajeDeError(new TypeError('x is not a function'))).toBe('x is not a function');
    });

    it('un error cualquiera conserva su mensaje', () => {
        expect(mensajeDeError(new Error('boom'))).toBe('boom');
        expect(mensajeDeError({})).toBe('Algo ha fallado.');
    });
});

describe('cliente', () => {
    it('repartosDeActivo sólo manda la cuenta si se pide', async () => {
        (apiFetch as jest.Mock).mockResolvedValue({ repartos: [] });
        await repartosDeActivo('activos', '3');
        expect(apiFetch).toHaveBeenLastCalledWith('/api/rwa/activos/assets/3/rent/distributions');
        await repartosDeActivo('industrial', '3', CUENTA);
        expect(apiFetch).toHaveBeenLastCalledWith(`/api/rwa/industrial/assets/3/rent/distributions?cuenta=${CUENTA}`);
    });

    it('prepararReclamo hace POST con el cuerpo', async () => {
        (apiFetch as jest.Mock).mockResolvedValue({ transacciones: [] });
        await prepararReclamo({ fabrica: 'activos', distributionId: 1, cuenta: CUENTA });
        expect(apiFetch).toHaveBeenCalledWith('/api/rwa/rent/claim/prepare', {
            method: 'POST', body: JSON.stringify({ fabrica: 'activos', distributionId: 1, cuenta: CUENTA }),
        });
    });
});

describe('venta primaria', () => {
    it('leerOferta devuelve la oferta y prepararCompra hace POST', async () => {
        (apiFetch as jest.Mock).mockResolvedValue({ oferta: { listingId: '1', abierta: true } });
        expect(await leerOferta('activos', '1')).toEqual({ listingId: '1', abierta: true });
        expect(apiFetch).toHaveBeenCalledWith('/api/rwa/activos/sale/listings/1');
        (apiFetch as jest.Mock).mockResolvedValue({ transacciones: [] });
        await prepararCompra({ fabrica: 'activos', listingId: 1, cantidad: 2, comprador: CUENTA });
        expect(apiFetch).toHaveBeenLastCalledWith('/api/rwa/sale/buy/prepare', {
            method: 'POST', body: JSON.stringify({ fabrica: 'activos', listingId: 1, cantidad: 2, comprador: CUENTA }),
        });
    });

    it('traduce los códigos de la venta', () => {
        expect(mensajeDeError(new ApiError('x', 503, 'SALE_NOT_DEPLOYED'))).toMatch(/no está desplegado/);
        expect(mensajeDeError(new ApiError('x', 409, 'LISTING_CLOSED'))).toMatch(/cerrada/);
    });

    it('idDeOfertaDeRecibo lee el evento Listed del contrato de venta', () => {
        const venta = '0x' + '5'.repeat(40);
        const topic = keccakId('Listed(uint256,uint256,address,uint256,uint256)');
        const recibo = { logs: [
            { address: '0x' + '9'.repeat(40), topics: [topic, zeroPadValue(toBeHex(99), 32)] },
            { address: venta.toUpperCase().replace('0X', '0x'), topics: [topic, zeroPadValue(toBeHex(7), 32)] },
        ] };
        expect(idDeOfertaDeRecibo(recibo, venta)).toBe('7');
        expect(idDeOfertaDeRecibo({ logs: [] }, venta)).toBeNull();
        expect(idDeOfertaDeRecibo(null, venta)).toBeNull();
    });
});

describe('runTransactions', () => {
    const txs: Transaccion[] = [
        { paso: 2, descripcion: 'depositar', to: '0xB', data: '0x02', value: '0', chainId: 137 },
        { paso: 1, descripcion: 'aprobar', to: '0xA', data: '0x01', value: '0', chainId: 137 },
    ];

    function deps(over: Record<string, unknown> = {}) {
        const orden: string[] = [];
        const d = {
            cuentaWallet: CUENTA, cuentaSesion: CUENTA, chainId: 137,
            switchChain: jest.fn(async () => undefined),
            sendTransaction: jest.fn(async (tx: { data: string }) => { orden.push(`envia ${tx.data}`); return `h${tx.data}`; }),
            waitForReceipt: jest.fn(async (h: string) => { orden.push(`espera ${h}`); return { status: 1 }; }),
            onProgress: jest.fn(),
            ...over,
        };
        return { d, orden };
    }

    it('firma en orden de paso y espera cada recibo antes de la siguiente', async () => {
        const { d, orden } = deps();
        const hashes = await runTransactions(txs, d);
        expect(orden).toEqual(['envia 0x01', 'espera h0x01', 'envia 0x02', 'espera h0x02']);
        expect(hashes).toEqual(['h0x01', 'h0x02']);
        expect(d.switchChain).not.toHaveBeenCalled();
        expect(d.sendTransaction).toHaveBeenCalledWith({ to: '0xA', data: '0x01', value: 0n, chainId: 137 });
    });

    it('cambia a Polygon si la wallet está en otra red', async () => {
        const { d } = deps({ chainId: 1 });
        await runTransactions(txs, d);
        expect(d.switchChain).toHaveBeenCalledWith(POLYGON_CHAIN_ID);
    });

    it('si la wallet tiene activa otra cuenta, no firma nada', async () => {
        const { d } = deps({ cuentaWallet: '0x' + 'b'.repeat(40) });
        await expect(runTransactions(txs, d)).rejects.toThrow(/otra cuenta/);
        expect(d.sendTransaction).not.toHaveBeenCalled();
        expect(d.switchChain).not.toHaveBeenCalled();
    });

    it('compara las cuentas sin distinguir mayúsculas', async () => {
        const { d } = deps({ cuentaWallet: CUENTA.toUpperCase().replace('0X', '0x') });
        await expect(runTransactions(txs, d)).resolves.toHaveLength(2);
    });

    it('el progreso «hecho» lleva el recibo', async () => {
        const { d } = deps();
        await runTransactions([txs[1]], d);
        const hecho = (d.onProgress as jest.Mock).mock.calls.map(([e]) => e).find((e) => e.estado === 'hecho');
        expect(hecho.recibo).toEqual({ status: 1 });
    });

    it('informa de cada estado', async () => {
        const { d } = deps();
        await runTransactions([txs[1]], d);
        expect((d.onProgress as jest.Mock).mock.calls.map(([e]) => e.estado)).toEqual(['firmando', 'confirmando', 'hecho']);
    });

    it('si el primer paso revierte no se envía el segundo (status 0 de ethers)', async () => {
        const { d } = deps({ waitForReceipt: jest.fn(async () => ({ status: 0 })) });
        await expect(runTransactions(txs, d)).rejects.toThrow(/paso 1/);
        expect(d.sendTransaction).toHaveBeenCalledTimes(1);
    });

    it('si la wallet rechaza la firma, se corta sin esperar recibo', async () => {
        const { d } = deps({ sendTransaction: jest.fn().mockRejectedValue(Object.assign(new Error('User rejected'), { code: 4001 })) });
        await expect(runTransactions(txs, d)).rejects.toThrow(/rejected/);
        expect(d.waitForReceipt).not.toHaveBeenCalled();
    });

    it('sin transacciones lanza error', async () => {
        await expect(runTransactions([], deps().d)).rejects.toThrow(/No hay transacciones/);
    });
});
