import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { id as keccakId, zeroPadValue, toBeHex } from 'ethers';

const sesion = { token: 'jwt' as string | null };
jest.mock('../../../components/SSOProvider', () => ({
    useAuth: () => sesion,
    LockScreen: ({ title }: { title: string }) => <div>{`LOCK: ${title}`}</div>,
}));
jest.mock('../../../lib/api', () => {
    const real = jest.requireActual('../../../lib/api');
    return { ...real, sessionAddress: jest.fn(() => '0x' + 'a'.repeat(40)) };
});
jest.mock('../../../lib/contracts', () => ({ getBrowserSigner: jest.fn() }));
jest.mock('../../../lib/rwaRent', () => {
    const real = jest.requireActual('../../../lib/rwaRent');
    return {
        ...real,
        activosDeCreador: jest.fn(), leerActivo: jest.fn(), leerOferta: jest.fn(),
        prepararOferta: jest.fn(), prepararCompra: jest.fn(), firmarConWallet: jest.fn(),
    };
});

import * as api from '../../../lib/rwaRent';
import RwaVentaPage from '../../../app/rwa/venta/page';

const CUENTA = '0x' + 'a'.repeat(40);
const mocked = <T extends (...a: never[]) => unknown>(f: T) => f as unknown as jest.Mock;
const oferta = { listingId: '1', assetId: '3', vendedor: '0xV', precioFraccionBez: '10.0', disponibles: '50', abierta: true };

beforeEach(() => {
    jest.clearAllMocks();
    sesion.token = 'jwt';
});

describe('RWA · Fracciones', () => {
    it('sin sesión pide iniciarla y no llama a la API', async () => {
        sesion.token = null;
        render(<RwaVentaPage />);
        expect(await screen.findByText(/LOCK: Inicia sesión/)).toBeInTheDocument();
        expect(api.leerOferta).not.toHaveBeenCalled();
    });

    it('comprar: consulta la oferta, calcula el total y firma aprobar + comprar con la cuenta de la sesión', async () => {
        const user = userEvent.setup();
        const transacciones = [
            { paso: 1, descripcion: 'aprobar', to: '0xBEZ', data: '0x01', value: '0', chainId: 137 },
            { paso: 2, descripcion: 'comprar', to: '0xSALE', data: '0x02', value: '0', chainId: 137 },
        ];
        mocked(api.leerOferta).mockResolvedValue(oferta);
        mocked(api.prepararCompra).mockResolvedValue({ compra: { listingId: '1', assetId: '3', fracciones: '5', totalBez: '50.0' }, transacciones });
        mocked(api.firmarConWallet).mockResolvedValue(['0x1', '0x2']);
        render(<RwaVentaPage />);

        await user.type(await screen.findByLabelText(/Nº de oferta/), '1');
        await user.click(screen.getByRole('button', { name: 'Ver oferta' }));
        expect(api.leerOferta).toHaveBeenCalledWith('activos', '1');

        const cantidad = await screen.findByLabelText(/Fracciones a comprar/);
        await user.clear(cantidad);
        await user.type(cantidad, '5');
        await user.click(screen.getByRole('button', { name: 'Comprar por 50 BEZ' }));

        await waitFor(() => expect(api.firmarConWallet).toHaveBeenCalledWith(transacciones, CUENTA, expect.any(Function)));
        expect(api.prepararCompra).toHaveBeenCalledWith({ fabrica: 'activos', listingId: 1, cantidad: 5, comprador: CUENTA });
        expect(await screen.findByText(/Compradas 5 fracciones del activo #3 por 50.0 BEZ/)).toBeInTheDocument();
    });

    it('comprar: no deja pedir más de lo disponible ni en una oferta cerrada', async () => {
        const user = userEvent.setup();
        mocked(api.leerOferta).mockResolvedValue(oferta);
        render(<RwaVentaPage />);
        await user.type(await screen.findByLabelText(/Nº de oferta/), '1');
        await user.click(screen.getByRole('button', { name: 'Ver oferta' }));
        const cantidad = await screen.findByLabelText(/Fracciones a comprar/);
        await user.clear(cantidad);
        await user.type(cantidad, '51');
        expect(screen.getByRole('button', { name: 'Cantidad no válida' })).toBeDisabled();

        mocked(api.leerOferta).mockResolvedValue({ ...oferta, abierta: false });
        await user.click(screen.getByRole('button', { name: 'Ver oferta' }));
        expect(await screen.findByText('Cerrada')).toBeInTheDocument();
        expect(screen.queryByLabelText(/Fracciones a comprar/)).not.toBeInTheDocument();
    });

    it('comprar: muestra el error cuando la venta aún no está desplegada', async () => {
        const user = userEvent.setup();
        mocked(api.leerOferta).mockRejectedValue(new (jest.requireActual('../../../lib/api').ApiError)('x', 503, 'SALE_NOT_DEPLOYED'));
        render(<RwaVentaPage />);
        await user.type(await screen.findByLabelText(/Nº de oferta/), '1');
        await user.click(screen.getByRole('button', { name: 'Ver oferta' }));
        expect(await screen.findByRole('alert')).toHaveTextContent(/no está desplegado/);
    });

    it('vender: prepara la oferta, firma y muestra el número de oferta del recibo', async () => {
        const user = userEvent.setup();
        const venta = '0x' + '5'.repeat(40);
        const topic = keccakId('Listed(uint256,uint256,address,uint256,uint256)');
        const transacciones = [
            { paso: 1, descripcion: 'autorizar', to: '0xF', data: '0x01', value: '0', chainId: 137 },
            { paso: 2, descripcion: 'publicar', to: '0xS', data: '0x02', value: '0', chainId: 137 },
        ];
        mocked(api.activosDeCreador).mockResolvedValue({ assetIds: ['3'] });
        mocked(api.leerActivo).mockResolvedValue({ assetId: '3', nombre: 'Nave', fracciones: '1000', precioFraccionBez: '10.0', activo: true });
        mocked(api.prepararOferta).mockResolvedValue({
            contratoVenta: venta, oferta: { assetId: '3', fracciones: '100', precioFraccionBez: '12.5' }, transacciones,
        });
        // firmarConWallet de verdad entrega los recibos por el progreso: se simula igual.
        mocked(api.firmarConWallet).mockImplementation(async (_t: unknown, _c: unknown, onProgress: (e: unknown) => void) => {
            onProgress({ paso: 1, total: 2, descripcion: 'autorizar', estado: 'hecho', hash: '0x1', recibo: { status: 1, logs: [] } });
            onProgress({
                paso: 2, total: 2, descripcion: 'publicar', estado: 'hecho', hash: '0x2',
                recibo: { status: 1, logs: [{ address: venta, topics: [topic, zeroPadValue(toBeHex(42), 32)] }] },
            });
            return ['0x1', '0x2'];
        });
        render(<RwaVentaPage />);

        await user.click(await screen.findByRole('tab', { name: 'Vender (emisor)' }));
        await user.click(await screen.findByRole('radio', { name: /Nave/ }));
        await user.type(screen.getByLabelText(/Fracciones a la venta/), '100');
        await user.type(screen.getByLabelText(/Precio por fracción/), '12.5');
        await user.click(screen.getByRole('button', { name: 'Preparar oferta' }));
        expect(api.prepararOferta).toHaveBeenCalledWith({
            fabrica: 'activos', assetId: 3, cantidad: 100, precioFraccionBez: '12.5', vendedor: CUENTA,
        });

        await user.click(await screen.findByRole('button', { name: 'Firmar y publicar oferta' }));
        expect(await screen.findByText('42')).toBeInTheDocument();
    });

    it('vender: si la wallet rechaza la firma lo explica y no da la oferta por publicada', async () => {
        const user = userEvent.setup();
        mocked(api.activosDeCreador).mockResolvedValue({ assetIds: ['3'] });
        mocked(api.leerActivo).mockResolvedValue({ assetId: '3', nombre: 'Nave', fracciones: '1000', activo: true });
        mocked(api.prepararOferta).mockResolvedValue({
            contratoVenta: '0xS', oferta: { assetId: '3', fracciones: '100', precioFraccionBez: '12.5' }, transacciones: [],
        });
        mocked(api.firmarConWallet).mockRejectedValue(Object.assign(new Error('User rejected the request.'), { code: 4001 }));
        render(<RwaVentaPage />);
        await user.click(await screen.findByRole('tab', { name: 'Vender (emisor)' }));
        await user.click(await screen.findByRole('radio', { name: /Nave/ }));
        await user.type(screen.getByLabelText(/Fracciones a la venta/), '100');
        await user.type(screen.getByLabelText(/Precio por fracción/), '12.5');
        await user.click(screen.getByRole('button', { name: 'Preparar oferta' }));
        await user.click(await screen.findByRole('button', { name: 'Firmar y publicar oferta' }));
        expect(await screen.findByRole('alert')).toHaveTextContent(/Cancelaste la firma/);
        expect(screen.queryByText(/Oferta publicada/)).not.toBeInTheDocument();
    });
});
