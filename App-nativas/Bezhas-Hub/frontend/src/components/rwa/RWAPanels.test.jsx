import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const wallet = { address: '0x' + 'a'.repeat(40), isConnected: true };
const sendTransactionAsync = vi.fn(async () => '0xhash');
const waitForTransactionReceipt = vi.fn(async () => ({ status: 'success', logs: [] }));

vi.mock('wagmi', () => ({
    useAccount: () => wallet,
    useChainId: () => 137,
    useSwitchChain: () => ({ switchChainAsync: vi.fn() }),
    useSendTransaction: () => ({ sendTransactionAsync }),
    usePublicClient: () => ({ waitForTransactionReceipt }),
}));
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../lib/rwaOps', async (orig) => {
    const real = await orig();
    return {
        ...real,
        activosDeCreador: vi.fn(), leerActivo: vi.fn(), repartosDeActivo: vi.fn(), prepararReparto: vi.fn(),
        prepararReclamo: vi.fn(), leerOferta: vi.fn(), prepararOferta: vi.fn(), prepararCompra: vi.fn(),
        descargarJustificante: vi.fn(),
    };
});

import * as api from '../../lib/rwaOps';
import RWARentPanel from './RWARentPanel';
import RWASalePanel from './RWASalePanel';

const CUENTA = wallet.address;

// @testing-library/user-event no está en las dependencias del Hub: basta fireEvent para estos formularios.
const user = {
    click: async (el) => { fireEvent.click(el); },
    type: async (el, texto) => { fireEvent.change(el, { target: { value: `${el.value}${texto}` } }); },
};

beforeEach(() => {
    vi.clearAllMocks();
    waitForTransactionReceipt.mockResolvedValue({ status: 'success', logs: [] });
});

const abierto = {
    distributionId: '7', assetId: '3', emisor: '0xE', token: 'USDC', importe: '900.0', sinReclamar: '900.0',
    plazoReclamo: new Date(Date.now() + 40 * 86400_000).toISOString(), abierto: true, detallesCID: null,
    yaCobrado: false, miParte: '600.0', motivoSinParte: null,
};

describe('RWARentPanel · titular', () => {
    it('lista los repartos con lo que le toca y cobra firmando con la cuenta de la sesión', async () => {
        api.repartosDeActivo.mockResolvedValue({ repartos: [abierto] });
        api.prepararReclamo.mockResolvedValue({
            cobro: { importe: '600.0', token: 'USDC' },
            transacciones: [{ paso: 1, descripcion: 'cobrar', to: '0xD', data: '0x01', value: '0', chainId: 137 }],
        });
        render(<RWARentPanel cuenta={CUENTA} />);

        await user.type(screen.getByLabelText(/Nº de activo/), '3');
        await user.click(screen.getByRole('button', { name: 'Ver repartos' }));
        expect(api.repartosDeActivo).toHaveBeenCalledWith({ fabrica: 'activos', assetId: '3', cuenta: CUENTA });

        await user.click(await screen.findByRole('button', { name: /Cobrar 600.0 USDC/ }));
        await waitFor(() => expect(sendTransactionAsync).toHaveBeenCalledWith({ to: '0xD', data: '0x01', value: 0n, chainId: 137 }));
        expect(api.prepararReclamo).toHaveBeenCalledWith({ fabrica: 'activos', distributionId: 7, cuenta: CUENTA });
    });

    it('no ofrece cobrar si ya cobró o no tenía fracciones', async () => {
        api.repartosDeActivo.mockResolvedValue({
            repartos: [
                { ...abierto, distributionId: '8', yaCobrado: true, miParte: null },
                { ...abierto, distributionId: '9', miParte: null, motivoSinParte: 'NO_SHARE' },
            ],
        });
        render(<RWARentPanel cuenta={CUENTA} />);
        await user.type(screen.getByLabelText(/Nº de activo/), '3');
        await user.click(screen.getByRole('button', { name: 'Ver repartos' }));
        expect(await screen.findByText('Ya cobrado')).toBeInTheDocument();
        expect(screen.getByText(/No tenías fracciones en el corte/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^Cobrar/ })).not.toBeInTheDocument();
    });

    it('muestra el error de la API en español y rechaza un número de activo que no lo es', async () => {
        api.repartosDeActivo.mockRejectedValue({ response: { status: 503, data: { code: 'DISTRIBUTOR_NOT_DEPLOYED' } } });
        render(<RWARentPanel cuenta={CUENTA} />);
        await user.type(screen.getByLabelText(/Nº de activo/), 'abc');
        await user.click(screen.getByRole('button', { name: 'Ver repartos' }));
        expect(await screen.findByRole('alert')).toHaveTextContent(/número del activo/);
        expect(api.repartosDeActivo).not.toHaveBeenCalled();

        await user.type(screen.getByLabelText(/Nº de activo/), '');
        fireEvent.change(screen.getByLabelText(/Nº de activo/), { target: { value: '3' } });
        await user.click(screen.getByRole('button', { name: 'Ver repartos' }));
        expect(await screen.findByText(/no está desplegado/)).toBeInTheDocument();
    });
});

describe('RWARentPanel · emisor', () => {
    const propuesta = {
        reparto: {
            titulares: 3, importe: '900.0', comision: '9.0', totalAPagar: '909.0', restoSinAsignar: '0.0',
            bloqueDeCorte: 9872, raiz: '0x1', token: 'USDC', plazoReclamo: new Date(Date.now() + 90 * 86400_000).toISOString(),
        },
        justificante: { version: 1 },
        aviso: 'Las fracciones que conservas no cobran.',
        transacciones: [
            { paso: 1, descripcion: 'aprobar', to: '0xU', data: '0x01', value: '0', chainId: 137 },
            { paso: 2, descripcion: 'crear', to: '0xD', data: '0x02', value: '0', chainId: 137 },
        ],
    };

    async function hastaElFormulario() {
        api.activosDeCreador.mockResolvedValue({ assetIds: ['3'] });
        api.leerActivo.mockResolvedValue({ assetId: '3', nombre: 'Nave', fracciones: '1000', activo: true });
        api.repartosDeActivo.mockResolvedValue({ repartos: [] });
        render(<RWARentPanel cuenta={CUENTA} />);
        await user.click(screen.getByRole('tab', { name: 'Soy emisor' }));
        await user.click(await screen.findByRole('radio', { name: /Nave/ }));
    }

    it('calcula el reparto, enseña lo que se paga y firma las dos transacciones en orden', async () => {
        api.prepararReparto.mockResolvedValue(propuesta);
        await hastaElFormulario();
        await user.type(screen.getByLabelText(/Importe a repartir/), '900');
        await user.click(screen.getByRole('button', { name: 'Calcular reparto' }));
        expect(api.prepararReparto).toHaveBeenCalledWith({
            fabrica: 'activos', assetId: 3, emisor: CUENTA, token: 'usdc', importe: '900', plazoDias: 90,
        });
        expect(await screen.findByText('909.0 USDC')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /Firmar y depositar 909.0 USDC/ }));
        await waitFor(() => expect(sendTransactionAsync).toHaveBeenCalledTimes(2));
        expect(sendTransactionAsync.mock.calls.map(([tx]) => tx.data)).toEqual(['0x01', '0x02']);
        expect(await screen.findByText(/Reparto creado/)).toBeInTheDocument();
    });

    it('cambiar el importe invalida el cálculo y quita el botón de firmar', async () => {
        api.prepararReparto.mockResolvedValue(propuesta);
        await hastaElFormulario();
        await user.type(screen.getByLabelText(/Importe a repartir/), '900');
        await user.click(screen.getByRole('button', { name: 'Calcular reparto' }));
        await screen.findByText('909.0 USDC');
        await user.type(screen.getByLabelText(/Importe a repartir/), '0');
        expect(screen.queryByRole('button', { name: /Firmar y depositar/ })).not.toBeInTheDocument();
    });

    it('si la wallet rechaza la firma lo explica sin dar el reparto por creado', async () => {
        api.prepararReparto.mockResolvedValue(propuesta);
        sendTransactionAsync.mockRejectedValueOnce(Object.assign(new Error('User rejected the request.'), { code: 4001 }));
        await hastaElFormulario();
        await user.type(screen.getByLabelText(/Importe a repartir/), '900');
        await user.click(screen.getByRole('button', { name: 'Calcular reparto' }));
        await user.click(await screen.findByRole('button', { name: /Firmar y depositar/ }));
        expect(await screen.findByRole('alert')).toHaveTextContent(/Cancelaste la firma/);
        expect(screen.queryByText(/Reparto creado/)).not.toBeInTheDocument();
    });

    it('una wallet sin activos lo dice', async () => {
        api.activosDeCreador.mockResolvedValue({ assetIds: [] });
        render(<RWARentPanel cuenta={CUENTA} />);
        await user.click(screen.getByRole('tab', { name: 'Soy emisor' }));
        expect(await screen.findByText(/no ha creado ningún activo/)).toBeInTheDocument();
    });
});

describe('RWASalePanel · comprar', () => {
    const oferta = { listingId: '1', assetId: '3', vendedor: '0xV', precioFraccionBez: '10.0', disponibles: '50', abierta: true };

    it('consulta la oferta, calcula el total y firma aprobar + comprar', async () => {
        api.leerOferta.mockResolvedValue(oferta);
        api.prepararCompra.mockResolvedValue({
            compra: { listingId: '1', assetId: '3', fracciones: '5', totalBez: '50.0' },
            transacciones: [
                { paso: 1, descripcion: 'aprobar', to: '0xBEZ', data: '0x01', value: '0', chainId: 137 },
                { paso: 2, descripcion: 'comprar', to: '0xSALE', data: '0x02', value: '0', chainId: 137 },
            ],
        });
        render(<RWASalePanel cuenta={CUENTA} />);
        await user.type(screen.getByLabelText(/Nº de oferta/), '1');
        await user.click(screen.getByRole('button', { name: 'Ver oferta' }));
        expect(api.leerOferta).toHaveBeenCalledWith({ fabrica: 'activos', listingId: '1' });

        fireEvent.change(await screen.findByLabelText(/Fracciones a comprar/), { target: { value: '5' } });
        await user.click(screen.getByRole('button', { name: 'Comprar por 50 BEZ' }));

        await waitFor(() => expect(sendTransactionAsync).toHaveBeenCalledTimes(2));
        expect(api.prepararCompra).toHaveBeenCalledWith({ fabrica: 'activos', listingId: 1, cantidad: 5, comprador: CUENTA });
        expect(await screen.findByText(/Compradas 5 fracciones del activo #3 por 50.0 BEZ/)).toBeInTheDocument();
    });

    it('no deja comprar más de lo disponible ni en una oferta cerrada', async () => {
        api.leerOferta.mockResolvedValue(oferta);
        render(<RWASalePanel cuenta={CUENTA} />);
        await user.type(screen.getByLabelText(/Nº de oferta/), '1');
        await user.click(screen.getByRole('button', { name: 'Ver oferta' }));
        fireEvent.change(await screen.findByLabelText(/Fracciones a comprar/), { target: { value: '51' } });
        expect(screen.getByRole('button', { name: 'Cantidad no válida' })).toBeDisabled();

        api.leerOferta.mockResolvedValue({ ...oferta, abierta: false });
        fireEvent.change(screen.getByLabelText(/Nº de oferta/), { target: { value: '2' } });
        await user.click(screen.getByRole('button', { name: 'Ver oferta' }));
        expect(await screen.findByText('Cerrada')).toBeInTheDocument();
        expect(screen.queryByLabelText(/Fracciones a comprar/)).not.toBeInTheDocument();
    });

    it('muestra el error cuando la venta aún no está desplegada', async () => {
        api.leerOferta.mockRejectedValue({ response: { status: 503, data: { code: 'SALE_NOT_DEPLOYED' } } });
        render(<RWASalePanel cuenta={CUENTA} />);
        await user.type(screen.getByLabelText(/Nº de oferta/), '1');
        await user.click(screen.getByRole('button', { name: 'Ver oferta' }));
        expect(await screen.findByRole('alert')).toHaveTextContent(/no está desplegado/);
    });
});

describe('RWASalePanel · vender', () => {
    it('prepara la oferta, firma autorizar + publicar y muestra el número de oferta del recibo', async () => {
        const { keccak256, toBytes, pad, toHex } = await import('viem');
        const topic = keccak256(toBytes('Listed(uint256,uint256,address,uint256,uint256)'));
        api.activosDeCreador.mockResolvedValue({ assetIds: ['3'] });
        api.leerActivo.mockResolvedValue({ assetId: '3', nombre: 'Nave', fracciones: '1000', precioFraccionBez: '10.0', activo: true });
        api.prepararOferta.mockResolvedValue({
            contratoVenta: '0x' + '5'.repeat(40),
            oferta: { assetId: '3', fracciones: '100', precioFraccionBez: '12.5' },
            transacciones: [
                { paso: 1, descripcion: 'autorizar', to: '0xF', data: '0x01', value: '0', chainId: 137 },
                { paso: 2, descripcion: 'publicar', to: '0xS', data: '0x02', value: '0', chainId: 137 },
            ],
        });
        waitForTransactionReceipt.mockImplementation(async (arg) => (arg.hash === '0xhash'
            ? { status: 'success', logs: [{ address: '0x' + '5'.repeat(40), topics: [topic, pad(toHex(42n), { size: 32 })] }] }
            : { status: 'success', logs: [] }));

        render(<RWASalePanel cuenta={CUENTA} />);
        await user.click(screen.getByRole('tab', { name: 'Vender (emisor)' }));
        await user.click(await screen.findByRole('radio', { name: /Nave/ }));
        await user.type(screen.getByLabelText(/Fracciones a la venta/), '100');
        await user.type(screen.getByLabelText(/Precio por fracción/), '12.5');
        await user.click(screen.getByRole('button', { name: 'Preparar oferta' }));
        expect(api.prepararOferta).toHaveBeenCalledWith({
            fabrica: 'activos', assetId: 3, cantidad: 100, precioFraccionBez: '12.5', vendedor: CUENTA,
        });

        await user.click(await screen.findByRole('button', { name: 'Firmar y publicar oferta' }));
        await waitFor(() => expect(sendTransactionAsync).toHaveBeenCalledTimes(2));
        expect(await screen.findByText('42')).toBeInTheDocument();
    });

    it('cambiar la cantidad invalida la oferta preparada', async () => {
        api.activosDeCreador.mockResolvedValue({ assetIds: ['3'] });
        api.leerActivo.mockResolvedValue({ assetId: '3', nombre: 'Nave', fracciones: '1000', precioFraccionBez: '10.0', activo: true });
        api.prepararOferta.mockResolvedValue({
            contratoVenta: '0xS', oferta: { assetId: '3', fracciones: '100', precioFraccionBez: '12.5' }, transacciones: [],
        });
        render(<RWASalePanel cuenta={CUENTA} />);
        await user.click(screen.getByRole('tab', { name: 'Vender (emisor)' }));
        await user.click(await screen.findByRole('radio', { name: /Nave/ }));
        await user.type(screen.getByLabelText(/Fracciones a la venta/), '100');
        await user.type(screen.getByLabelText(/Precio por fracción/), '12.5');
        await user.click(screen.getByRole('button', { name: 'Preparar oferta' }));
        await screen.findByRole('button', { name: 'Firmar y publicar oferta' });
        await user.type(screen.getByLabelText(/Fracciones a la venta/), '0');
        expect(screen.queryByRole('button', { name: 'Firmar y publicar oferta' })).not.toBeInTheDocument();
    });
});
