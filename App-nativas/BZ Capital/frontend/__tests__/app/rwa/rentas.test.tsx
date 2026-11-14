import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
        activosDeCreador: jest.fn(),
        leerActivo: jest.fn(),
        repartosDeActivo: jest.fn(),
        prepararReparto: jest.fn(),
        prepararReclamo: jest.fn(),
        firmarConWallet: jest.fn(),
        descargarJustificante: jest.fn(),
    };
});

import * as api from '../../../lib/rwaRent';
import { sessionAddress } from '../../../lib/api';
import RwaRentasPage from '../../../app/rwa/rentas/page';

const CUENTA = '0x' + 'a'.repeat(40);
const mocked = <T extends (...a: never[]) => unknown>(f: T) => f as unknown as jest.Mock;

const abierto = {
    distributionId: '7', assetId: '3', emisor: '0xE', token: 'USDC', importe: '900.0', sinReclamar: '900.0',
    plazoReclamo: new Date(Date.now() + 40 * 86400_000).toISOString(), abierto: true, detallesCID: null,
    yaCobrado: false, miParte: '600.0', motivoSinParte: null,
};

beforeEach(() => {
    jest.clearAllMocks();
    sesion.token = 'jwt';
    (sessionAddress as jest.Mock).mockReturnValue(CUENTA);
});

describe('RWA · Rentas', () => {
    it('sin sesión pide iniciarla y no llama a la API', async () => {
        sesion.token = null;
        render(<RwaRentasPage />);
        expect(await screen.findByText(/LOCK: Inicia sesión/)).toBeInTheDocument();
        expect(api.repartosDeActivo).not.toHaveBeenCalled();
    });

    it('con sesión pero sin wallet en el JWT tampoco ofrece nada', async () => {
        (sessionAddress as jest.Mock).mockReturnValue(null);
        render(<RwaRentasPage />);
        expect(await screen.findByText(/LOCK:/)).toBeInTheDocument();
    });

    it('titular: lista los repartos con lo que le toca y cobra firmando con la cuenta de la sesión', async () => {
        const user = userEvent.setup();
        const transacciones = [{ paso: 1, descripcion: 'cobrar', to: '0xD', data: '0x01', value: '0', chainId: 137 }];
        mocked(api.repartosDeActivo).mockResolvedValue({ repartos: [abierto] });
        mocked(api.prepararReclamo).mockResolvedValue({ cobro: { importe: '600.0', token: 'USDC' }, transacciones });
        mocked(api.firmarConWallet).mockResolvedValue(['0xhash']);
        render(<RwaRentasPage />);

        await user.type(await screen.findByLabelText(/Nº de activo/), '3');
        await user.click(screen.getByRole('button', { name: 'Ver repartos' }));
        expect(api.repartosDeActivo).toHaveBeenCalledWith('activos', '3', CUENTA);

        await user.click(await screen.findByRole('button', { name: /Cobrar 600.0 USDC/ }));
        await waitFor(() => expect(api.firmarConWallet).toHaveBeenCalledWith(transacciones, CUENTA, expect.any(Function)));
        expect(api.prepararReclamo).toHaveBeenCalledWith({ fabrica: 'activos', distributionId: 7, cuenta: CUENTA });
        expect(await screen.findByText(/Cobrado: 600.0 USDC/)).toBeInTheDocument();
    });

    it('titular: no ofrece cobrar si ya cobró o no tenía fracciones', async () => {
        const user = userEvent.setup();
        mocked(api.repartosDeActivo).mockResolvedValue({
            repartos: [
                { ...abierto, distributionId: '8', yaCobrado: true, miParte: null },
                { ...abierto, distributionId: '9', miParte: null, motivoSinParte: 'NO_SHARE' },
            ],
        });
        render(<RwaRentasPage />);
        await user.type(await screen.findByLabelText(/Nº de activo/), '3');
        await user.click(screen.getByRole('button', { name: 'Ver repartos' }));

        expect(await screen.findByText('Ya cobrado')).toBeInTheDocument();
        expect(screen.getByText(/No tenías fracciones en el corte/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^Cobrar/ })).not.toBeInTheDocument();
    });

    it('titular: muestra el error de la API en español', async () => {
        const user = userEvent.setup();
        mocked(api.repartosDeActivo).mockRejectedValue(new (jest.requireActual('../../../lib/api').ApiError)('x', 503, 'DISTRIBUTOR_NOT_DEPLOYED'));
        render(<RwaRentasPage />);
        await user.type(await screen.findByLabelText(/Nº de activo/), '3');
        await user.click(screen.getByRole('button', { name: 'Ver repartos' }));
        expect(await screen.findByRole('alert')).toHaveTextContent(/todavía no está activo/);
    });

    it('titular: rechaza un número de activo que no es un número', async () => {
        const user = userEvent.setup();
        render(<RwaRentasPage />);
        await user.type(await screen.findByLabelText(/Nº de activo/), 'abc');
        await user.click(screen.getByRole('button', { name: 'Ver repartos' }));
        expect(await screen.findByRole('alert')).toHaveTextContent(/número del activo/);
        expect(api.repartosDeActivo).not.toHaveBeenCalled();
    });

    describe('emisor', () => {
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

        async function hastaElFormulario(user: ReturnType<typeof userEvent.setup>) {
            mocked(api.activosDeCreador).mockResolvedValue({ assetIds: ['3'] });
            mocked(api.leerActivo).mockResolvedValue({ assetId: '3', nombre: 'Nave', fracciones: '1000', activo: true });
            mocked(api.repartosDeActivo).mockResolvedValue({ repartos: [] });
            render(<RwaRentasPage />);
            await user.click(await screen.findByRole('tab', { name: 'Soy emisor' }));
            await user.click(await screen.findByRole('radio', { name: /Nave/ }));
        }

        it('calcula el reparto, enseña lo que se paga y firma las dos transacciones', async () => {
            const user = userEvent.setup();
            mocked(api.prepararReparto).mockResolvedValue(propuesta);
            mocked(api.firmarConWallet).mockResolvedValue(['0x1', '0x2']);
            await hastaElFormulario(user);

            await user.type(screen.getByLabelText(/Importe a repartir/), '900');
            await user.click(screen.getByRole('button', { name: 'Calcular reparto' }));
            expect(api.prepararReparto).toHaveBeenCalledWith({
                fabrica: 'activos', assetId: 3, emisor: CUENTA, token: 'usdc', importe: '900', plazoDias: 90,
            });
            expect(await screen.findByText('909.0 USDC')).toBeInTheDocument();

            await user.click(screen.getByRole('button', { name: /Firmar y depositar 909.0 USDC/ }));
            await waitFor(() => expect(api.firmarConWallet).toHaveBeenCalledWith(propuesta.transacciones, CUENTA, expect.any(Function)));
            expect(await screen.findByText(/Reparto creado/)).toBeInTheDocument();
        });

        it('cambiar el importe invalida el cálculo y quita el botón de firmar', async () => {
            const user = userEvent.setup();
            mocked(api.prepararReparto).mockResolvedValue(propuesta);
            await hastaElFormulario(user);
            await user.type(screen.getByLabelText(/Importe a repartir/), '900');
            await user.click(screen.getByRole('button', { name: 'Calcular reparto' }));
            await screen.findByText('909.0 USDC');

            await user.type(screen.getByLabelText(/Importe a repartir/), '0');
            expect(screen.queryByRole('button', { name: /Firmar y depositar/ })).not.toBeInTheDocument();
        });

        it('si la wallet rechaza la firma lo explica sin dar el reparto por creado', async () => {
            const user = userEvent.setup();
            mocked(api.prepararReparto).mockResolvedValue(propuesta);
            mocked(api.firmarConWallet).mockRejectedValue(Object.assign(new Error('User rejected the request.'), { code: 4001 }));
            await hastaElFormulario(user);
            await user.type(screen.getByLabelText(/Importe a repartir/), '900');
            await user.click(screen.getByRole('button', { name: 'Calcular reparto' }));
            await user.click(await screen.findByRole('button', { name: /Firmar y depositar/ }));
            expect(await screen.findByRole('alert')).toHaveTextContent(/Cancelaste la firma/);
            expect(screen.queryByText(/Reparto creado/)).not.toBeInTheDocument();
        });

        it('muestra el error de la API (no hay a quién repartir)', async () => {
            const user = userEvent.setup();
            mocked(api.prepararReparto).mockRejectedValue(new (jest.requireActual('../../../lib/api').ApiError)('x', 400, 'NO_HOLDERS'));
            await hastaElFormulario(user);
            await user.type(screen.getByLabelText(/Importe a repartir/), '900');
            await user.click(screen.getByRole('button', { name: 'Calcular reparto' }));
            expect(await screen.findByRole('alert')).toHaveTextContent(/no hay a quién repartir/);
        });

        it('una wallet sin activos lo dice', async () => {
            const user = userEvent.setup();
            mocked(api.activosDeCreador).mockResolvedValue({ assetIds: [] });
            render(<RwaRentasPage />);
            await user.click(await screen.findByRole('tab', { name: 'Soy emisor' }));
            expect(await screen.findByText(/no ha creado ningún activo/)).toBeInTheDocument();
        });
    });
});
