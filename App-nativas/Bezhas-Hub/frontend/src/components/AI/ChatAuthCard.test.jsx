import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { auth, wallet, open, signMessageAsync, svc } = vi.hoisted(() => ({
    auth: { login: vi.fn(), register: vi.fn(), verifyLogin2FA: vi.fn(), loginOrRegisterWithWallet: vi.fn() },
    wallet: { isConnected: true, address: '0x1234567890abcdef1234567890abcdef12345678' },
    open: vi.fn(),
    signMessageAsync: vi.fn(),
    svc: { forgotPassword: vi.fn(), resetPassword: vi.fn() },
}));

vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('wagmi', () => ({ useAccount: () => wallet, useSignMessage: () => ({ signMessageAsync }) }));
vi.mock('@web3modal/wagmi/react', () => ({ useWeb3Modal: () => ({ open }) }));
vi.mock('../../services/authService', () => svc);

import ChatAuthCard from './ChatAuthCard';

const err = (status, error) => Object.assign(new Error('x'), { response: { status, data: { error } } });
const escribir = (re, v) => fireEvent.change(screen.getByPlaceholderText(re), { target: { value: v } });

beforeEach(() => {
    vi.clearAllMocks();
    signMessageAsync.mockResolvedValue('0xfirma');
    Object.assign(wallet, { isConnected: true, address: '0x1234567890abcdef1234567890abcdef12345678' });
});

describe('ChatAuthCard · wallet', () => {
    it('con la wallet conectada firma una vez y entra sin redirigir', async () => {
        auth.loginOrRegisterWithWallet.mockResolvedValue({ token: 't' });
        const onAuthed = vi.fn();
        render(<ChatAuthCard onAuthed={onAuthed} />);
        fireEvent.click(screen.getByRole('button', { name: /Firmar con 0x1234…5678/ }));
        await waitFor(() => expect(onAuthed).toHaveBeenCalledWith({ token: 't' }));
        const [addr, opts] = auth.loginOrRegisterWithWallet.mock.calls[0];
        expect(addr).toBe(wallet.address);
        expect(opts.redirect).toBe(false);
        await opts.signMessage('hola');
        expect(signMessageAsync).toHaveBeenCalledWith({ message: 'hola' });
    });
    it('sin wallet conectada abre el selector en vez de intentar firmar', () => {
        Object.assign(wallet, { isConnected: false, address: undefined });
        render(<ChatAuthCard onAuthed={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: /Conectar wallet/ }));
        expect(open).toHaveBeenCalled();
        expect(auth.loginOrRegisterWithWallet).not.toHaveBeenCalled();
    });
    it('firma rechazada → "Firma cancelada."', async () => {
        auth.loginOrRegisterWithWallet.mockRejectedValue(Object.assign(new Error('User rejected the request'), {}));
        render(<ChatAuthCard onAuthed={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: /Firmar con/ }));
        expect(await screen.findByText('Firma cancelada.')).toBeTruthy();
    });
    it('error del servidor → muestra la causa, no un genérico', async () => {
        auth.loginOrRegisterWithWallet.mockRejectedValue(err(500, 'Base de datos no disponible'));
        render(<ChatAuthCard onAuthed={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: /Firmar con/ }));
        expect(await screen.findByText('Base de datos no disponible')).toBeTruthy();
    });
    it('error sin respuesta (red caída) → muestra el mensaje de la excepción', async () => {
        auth.loginOrRegisterWithWallet.mockRejectedValue(new Error('Network Error'));
        render(<ChatAuthCard onAuthed={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: /Firmar con/ }));
        expect(await screen.findByText('Network Error')).toBeTruthy();
    });
});

describe('ChatAuthCard · firma automática (wallet ya conectada)', () => {
    it('con autoSign pide la firma sola, una vez, aunque la tarjeta se vuelva a pintar', async () => {
        auth.loginOrRegisterWithWallet.mockResolvedValue({ token: 't' });
        const onAuthed = vi.fn();
        const { rerender } = render(<ChatAuthCard onAuthed={onAuthed} autoSign />);
        await waitFor(() => expect(onAuthed).toHaveBeenCalledTimes(1));
        rerender(<ChatAuthCard onAuthed={onAuthed} autoSign />);
        await new Promise((r) => setTimeout(r, 20));
        expect(auth.loginOrRegisterWithWallet).toHaveBeenCalledTimes(1);
    });
    it('si el usuario rechaza la firma NO se insiste: queda el botón', async () => {
        auth.loginOrRegisterWithWallet.mockRejectedValue(new Error('User rejected the request'));
        const { rerender } = render(<ChatAuthCard onAuthed={vi.fn()} autoSign />);
        expect(await screen.findByText('Firma cancelada.')).toBeTruthy();
        rerender(<ChatAuthCard onAuthed={vi.fn()} autoSign />);
        await new Promise((r) => setTimeout(r, 20));
        expect(auth.loginOrRegisterWithWallet).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('button', { name: /Firmar con/ })).toBeTruthy();
    });
    it('sin autoSign no firma nada por su cuenta', async () => {
        render(<ChatAuthCard onAuthed={vi.fn()} />);
        await new Promise((r) => setTimeout(r, 20));
        expect(auth.loginOrRegisterWithWallet).not.toHaveBeenCalled();
    });
    it('sin wallet conectada tampoco intenta firmar', async () => {
        Object.assign(wallet, { isConnected: false, address: undefined });
        render(<ChatAuthCard onAuthed={vi.fn()} autoSign />);
        await new Promise((r) => setTimeout(r, 20));
        expect(auth.loginOrRegisterWithWallet).not.toHaveBeenCalled();
    });
});

describe('ChatAuthCard · wallet que no responde', () => {
    it('tras 90 s sin firma muestra un aviso claro y deja reintentar', async () => {
        vi.useFakeTimers();
        try {
            signMessageAsync.mockReturnValue(new Promise(() => {}));            // la wallet nunca contesta
            auth.loginOrRegisterWithWallet.mockImplementation((_a, { signMessage }) => signMessage('m'));
            render(<ChatAuthCard onAuthed={vi.fn()} />);
            fireEvent.click(screen.getByRole('button', { name: /Firmar con/ }));
            await vi.advanceTimersByTimeAsync(90_001);
            expect(screen.getByText(/La wallet no ha respondido/)).toBeTruthy();
            expect(screen.getByRole('button', { name: /Firmar con/ }).disabled).toBe(false);
        } finally { vi.useRealTimers(); }
    });
});

describe('ChatAuthCard · email y contraseña', () => {
    it('login: envía email y contraseña sin redirigir', async () => {
        auth.login.mockResolvedValue({ token: 't' });
        const onAuthed = vi.fn();
        render(<ChatAuthCard onAuthed={onAuthed} />);
        escribir(/Email/, 'ana@bezhas.com'); escribir(/Contraseña/, 'Correcta123');
        fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
        await waitFor(() => expect(onAuthed).toHaveBeenCalled());
        expect(auth.login).toHaveBeenCalledWith('ana@bezhas.com', 'Correcta123', { redirect: false });
    });
    it('login con credenciales malas → muestra el error del servidor', async () => {
        auth.login.mockRejectedValue(err(401, 'Invalid credentials'));
        render(<ChatAuthCard onAuthed={vi.fn()} />);
        escribir(/Email/, 'ana@bezhas.com'); escribir(/Contraseña/, 'mala');
        fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
        expect(await screen.findByText('Email o contraseña incorrectos.')).toBeTruthy();
    });
    it('registro: usa el modo Crear cuenta con usuario', async () => {
        auth.register.mockResolvedValue({ token: 't' });
        render(<ChatAuthCard onAuthed={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
        escribir(/Nombre de usuario/, 'ana'); escribir(/Email/, 'ana@bezhas.com'); escribir(/Contraseña/, 'Correcta123');
        fireEvent.click(screen.getByRole('button', { name: 'Registrarme' }));
        await waitFor(() => expect(auth.register).toHaveBeenCalled());
        expect(auth.register.mock.calls[0][0]).toMatchObject({ email: 'ana@bezhas.com', password: 'Correcta123', username: 'ana' });
        expect(auth.register.mock.calls[0][1]).toEqual({ redirect: false });
    });
    it('email ya registrado → muestra el aviso', async () => {
        auth.register.mockRejectedValue(err(409, 'Email or wallet already registered'));
        render(<ChatAuthCard onAuthed={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
        escribir(/Email/, 'ana@bezhas.com'); escribir(/Contraseña/, 'Correcta123');
        fireEvent.click(screen.getByRole('button', { name: 'Registrarme' }));
        expect(await screen.findByText(/Ese email ya tiene una cuenta/)).toBeTruthy();
    });
    it('exige 8 caracteres de contraseña', () => {
        render(<ChatAuthCard onAuthed={vi.fn()} />);
        expect(screen.getByPlaceholderText(/Contraseña/).getAttribute('minlength')).toBe('8');
    });
});

describe('ChatAuthCard · olvidé la contraseña', () => {
    it('pide el código y luego cambia la contraseña y vuelve al login con aviso', async () => {
        svc.forgotPassword.mockResolvedValue({ message: 'Te hemos enviado un código.' });
        svc.resetPassword.mockResolvedValue({ success: true });
        render(<ChatAuthCard onAuthed={vi.fn()} />);
        fireEvent.click(screen.getByText('¿Olvidaste tu contraseña?'));
        escribir(/Email/, 'ana@bezhas.com');
        fireEvent.click(screen.getByRole('button', { name: 'Enviarme un código' }));
        expect(await screen.findByText('Te hemos enviado un código.')).toBeTruthy();
        expect(svc.forgotPassword).toHaveBeenCalledWith('ana@bezhas.com');

        escribir(/Código del email/, 'ABCDEFGHJK'); escribir(/Nueva contraseña/, 'NuevaClave99');
        fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
        await waitFor(() => expect(svc.resetPassword).toHaveBeenCalledWith('ana@bezhas.com', 'ABCDEFGHJK', 'NuevaClave99'));
        expect(await screen.findByText('Contraseña actualizada. Ya puedes iniciar sesión.')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy();
    });
    it('código incorrecto → muestra el error y no vuelve al login', async () => {
        svc.forgotPassword.mockResolvedValue({ message: 'ok' });
        svc.resetPassword.mockRejectedValue(err(400, 'Código inválido o caducado'));
        render(<ChatAuthCard onAuthed={vi.fn()} />);
        fireEvent.click(screen.getByText('¿Olvidaste tu contraseña?'));
        escribir(/Email/, 'ana@bezhas.com');
        fireEvent.click(screen.getByRole('button', { name: 'Enviarme un código' }));
        await screen.findByPlaceholderText(/Código del email/);
        escribir(/Código del email/, 'ZZZZZZ'); escribir(/Nueva contraseña/, 'NuevaClave99');
        fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
        expect(await screen.findByText('Código inválido o caducado')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Entrar' })).toBeNull();
    });
});
