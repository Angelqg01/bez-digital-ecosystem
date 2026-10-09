import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

const { auth, wallet, cardProps } = vi.hoisted(() => ({
    auth: { token: null, logout: vi.fn() },
    wallet: { isConnected: false, address: undefined },
    cardProps: { current: null },
}));

vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('wagmi', () => ({ useAccount: () => wallet }));
vi.mock('react-markdown', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('remark-gfm', () => ({ default: () => {} }));
vi.mock('../../hooks/useChatActions', () => ({
    useChatActions: () => ({ catalog: [], dialog: null, busy: false, plans: [], docs: [], loadCatalog: vi.fn(), request: vi.fn(), requestById: vi.fn(), go: vi.fn(), close: vi.fn() }),
}));
// La tarjeta real se prueba en ChatAuthCard.test.jsx; aquí sólo importa cómo la usa la barra.
vi.mock('./ChatAuthCard', () => ({
    default: (props) => { cardProps.current = props; return <button onClick={() => { auth.token = 'jwt-real'; props.onAuthed({ token: 'jwt-real' }); }}>CARD-OK</button>; },
}));

import AIWorkspaceBar from './AIWorkspaceBar';

const sse = 'event: meta\ndata: {"conversationId":"c1","sources":[]}\n\nevent: delta\ndata: {"text":"Respuesta del chat"}\n\nevent: done\ndata: {}\n\n';
const streamResponse = () => new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(sse)); c.close(); } }), { status: 200 });

beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn(); // jsdom no lo implementa
    auth.token = null;
    auth.logout.mockImplementation(() => { auth.token = null; }); // cerrar sesión borra el token, como el real
    Object.assign(wallet, { isConnected: false, address: undefined });
    cardProps.current = null;
    global.fetch = vi.fn().mockImplementation(() => Promise.resolve(streamResponse()));
});

const escribir = (texto) => {
    const box = screen.getByLabelText('Mensaje para BeZhas AI');
    fireEvent.change(box, { target: { value: texto } });
    fireEvent.keyDown(box, { key: 'Enter' });
};

describe('AIWorkspaceBar · del login al primer mensaje', () => {
    it('sin sesión, al escribir aparece la tarjeta y NO se llama al servidor', async () => {
        render(<AIWorkspaceBar />);
        escribir('¿Cómo hago staking?');
        expect(await screen.findByText('CARD-OK')).toBeTruthy();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('tras iniciar sesión, el mensaje pendiente se envía solo y la tarjeta desaparece', async () => {
        render(<AIWorkspaceBar />);
        escribir('¿Cómo hago staking?');
        fireEvent.click(await screen.findByText('CARD-OK'));
        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
        const [, init] = global.fetch.mock.calls[0];
        expect(JSON.parse(init.body).message).toBe('¿Cómo hago staking?');
        expect(init.headers.Authorization).toBe('Bearer jwt-real');
        expect(await screen.findByText('Respuesta del chat')).toBeTruthy();
        expect(screen.queryByText('CARD-OK')).toBeNull();
    });

    it('la tarjeta recibe autoSign cuando hay un mensaje pendiente (la firma se pide sola)', async () => {
        Object.assign(wallet, { isConnected: true, address: '0x1234567890abcdef1234567890abcdef12345678' });
        render(<AIWorkspaceBar />);
        escribir('hola chat');
        await screen.findByText('CARD-OK');
        expect(cardProps.current.autoSign).toBe(true);
    });

    it('con la wallet conectada pero sin sesión, el campo lo dice claro', () => {
        Object.assign(wallet, { isConnected: true, address: '0x1234567890abcdef1234567890abcdef12345678' });
        render(<AIWorkspaceBar />);
        expect(screen.getByLabelText('Mensaje para BeZhas AI').getAttribute('placeholder')).toMatch(/Wallet conectada.*firma/i);
    });

    it('con sesión escribe directamente, sin tarjeta', async () => {
        auth.token = 'jwt-real';
        render(<AIWorkspaceBar />);
        escribir('hola');
        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
        expect(screen.queryByText('CARD-OK')).toBeNull();
    });

    it('un 401 del servidor cierra sesión y vuelve a pedirla conservando el mensaje', async () => {
        auth.token = 'jwt-caducado';
        global.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'x' }), { status: 401 }));
        render(<AIWorkspaceBar />);
        escribir('pregunta importante');
        await waitFor(() => expect(auth.logout).toHaveBeenCalled());
        expect(screen.getByLabelText('Mensaje para BeZhas AI').value).toBe('pregunta importante');
    });
});
