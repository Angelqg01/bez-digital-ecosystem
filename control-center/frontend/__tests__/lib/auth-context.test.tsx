import { act, renderHook, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth, type AuthUser } from '@/lib/auth-context';
import api from '@/lib/api';

jest.mock('@/lib/api', () => ({
    __esModule: true,
    default: { post: jest.fn() },
}));

const apiPost = api.post as jest.Mock;

const USER: AuthUser = {
    id: 7,
    wallet_address: null,
    username: 'yoel',
    email: 'yoel@bez.digital',
    role: 'ADMIN',
    avatar_url: null,
};

const fetchMock = jest.fn();

function clearCookies() {
    for (const cookie of document.cookie.split(';')) {
        const name = cookie.split('=')[0].trim();
        if (name) document.cookie = `${name}=; path=/; max-age=0`;
    }
}

function jsonResponse(body: unknown, ok = true) {
    return { ok, json: jest.fn().mockResolvedValue(body) } as unknown as Response;
}

/** Monta el hook ya hidratado (isLoading a false) para no repetirlo en cada caso. */
async function renderAuth() {
    const view = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(view.result.current.isLoading).toBe(false));
    return view;
}

beforeEach(() => {
    localStorage.clear();
    clearCookies();
    apiPost.mockReset();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
});

describe('useAuth', () => {
    it('falla si se usa fuera del provider en vez de devolver un contexto vacío', () => {
        const silenced = jest.spyOn(console, 'error').mockImplementation(() => {});

        expect(() => renderHook(() => useAuth())).toThrow(
            'useAuth must be used within AuthProvider',
        );

        silenced.mockRestore();
    });
});

describe('hidratación al montar', () => {
    it('arranca sin sesión cuando no hay nada guardado', async () => {
        const { result } = await renderAuth();

        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.user).toBeNull();
        expect(result.current.token).toBeNull();
    });

    it('restaura la sesión guardada en localStorage', async () => {
        localStorage.setItem('bezhas_token', 'token-guardado');
        localStorage.setItem('bezhas_user', JSON.stringify(USER));

        const { result } = await renderAuth();

        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.token).toBe('token-guardado');
        expect(result.current.user).toEqual(USER);
    });

    it('no restaura nada si falta el usuario aunque haya token', async () => {
        localStorage.setItem('bezhas_token', 'token-huérfano');

        const { result } = await renderAuth();

        expect(result.current.isAuthenticated).toBe(false);
    });

    it('limpia el almacenamiento cuando el usuario guardado está corrupto', async () => {
        localStorage.setItem('bezhas_token', 'token-guardado');
        localStorage.setItem('bezhas_user', '{esto no es json');

        const { result } = await renderAuth();

        expect(localStorage.getItem('bezhas_token')).toBeNull();
        expect(localStorage.getItem('bezhas_user')).toBeNull();
        expect(result.current.user).toBeNull();
    });
});

describe('login con email', () => {
    it('persiste token, usuario y cookie al autenticarse', async () => {
        fetchMock.mockResolvedValue(jsonResponse({ token: 'token-nuevo', user: USER }));

        const { result } = await renderAuth();
        await act(async () => {
            await result.current.loginWithEmail('yoel@bez.digital', 'clave-buena');
        });

        expect(fetchMock).toHaveBeenCalledWith('/api/auth/login-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'yoel@bez.digital', password: 'clave-buena' }),
        });
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.user).toEqual(USER);
        expect(localStorage.getItem('bezhas_token')).toBe('token-nuevo');
        expect(document.cookie).toContain('bezhas_token=token-nuevo');
    });

    it('propaga el error del backend y no deja sesión a medias', async () => {
        fetchMock.mockResolvedValue(jsonResponse({ error: 'Credenciales inválidas.' }, false));

        const { result } = await renderAuth();
        await expect(
            act(async () => {
                await result.current.loginWithEmail('yoel@bez.digital', 'clave-mala');
            }),
        ).rejects.toThrow('Credenciales inválidas.');

        expect(result.current.isAuthenticated).toBe(false);
        expect(localStorage.getItem('bezhas_token')).toBeNull();
    });
});

describe('registro', () => {
    it('deja la sesión iniciada tras registrarse', async () => {
        fetchMock.mockResolvedValue(jsonResponse({ token: 'token-alta', user: USER }));

        const { result } = await renderAuth();
        await act(async () => {
            await result.current.register('yoel', 'yoel@bez.digital', 'clave-buena');
        });

        expect(result.current.token).toBe('token-alta');
        expect(localStorage.getItem('bezhas_user')).toBe(JSON.stringify(USER));
    });

    it('propaga los errores de validación del backend', async () => {
        fetchMock.mockResolvedValue(
            jsonResponse({ error: 'Ya existe una cuenta con este email.' }, false),
        );

        const { result } = await renderAuth();
        await expect(
            act(async () => {
                await result.current.register('yoel', 'yoel@bez.digital', 'clave-buena');
            }),
        ).rejects.toThrow('Ya existe una cuenta con este email.');
    });
});

describe('login con wallet', () => {
    it('firma contra /auth/login de la API y guarda la sesión', async () => {
        apiPost.mockResolvedValue({ success: true, token: 'token-wallet', user: USER });

        const { result } = await renderAuth();
        await act(async () => {
            await result.current.login('0xabc', '0xfirma', 'mensaje a firmar');
        });

        expect(apiPost).toHaveBeenCalledWith('/auth/login', {
            address: '0xabc',
            signature: '0xfirma',
            message: 'mensaje a firmar',
        });
        expect(result.current.token).toBe('token-wallet');
    });

    it('no crea sesión si la API rechaza la firma', async () => {
        apiPost.mockRejectedValue(new Error('Firma inválida'));

        const { result } = await renderAuth();
        await expect(
            act(async () => {
                await result.current.login('0xabc', '0xmala', 'mensaje');
            }),
        ).rejects.toThrow('Firma inválida');

        expect(result.current.isAuthenticated).toBe(false);
    });
});

describe('logout', () => {
    it('borra estado, localStorage y ambas cookies', async () => {
        localStorage.setItem('bezhas_token', 'token-guardado');
        localStorage.setItem('bezhas_user', JSON.stringify(USER));
        document.cookie = 'bezhas_auth=token-guardado; path=/';

        const { result } = await renderAuth();
        act(() => result.current.logout());

        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.user).toBeNull();
        expect(localStorage.getItem('bezhas_token')).toBeNull();
        expect(localStorage.getItem('bezhas_user')).toBeNull();
        expect(document.cookie).not.toContain('bezhas_token=');
        expect(document.cookie).not.toContain('bezhas_auth=');
    });
});

describe('modal de login', () => {
    it('abre y cierra', async () => {
        const { result } = await renderAuth();

        expect(result.current.isLoginModalOpen).toBe(false);
        act(() => result.current.openLoginModal());
        expect(result.current.isLoginModalOpen).toBe(true);
        act(() => result.current.closeLoginModal());
        expect(result.current.isLoginModalOpen).toBe(false);
    });
});

/**
 * Las rutas *Demo existen para que la demo de inversores no se caiga si la API no
 * responde: fabrican una sesión virtual en el navegador. Es el último mock-jwt que
 * queda en la plataforma — las 13 Apps Nativas ya lo eliminaron en aa7188b/7c1c980/f09eaeb.
 * Estos tests fijan el alcance del atajo para que no se extienda ni se cuele en un
 * camino que no sea el de demo.
 */
describe('atajos de demo', () => {
    let warned: jest.SpyInstance;

    beforeEach(() => {
        warned = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        warned.mockRestore();
    });

    it('loginWithEmailDemo inventa una sesión cuando la API falla', async () => {
        fetchMock.mockRejectedValue(new Error('API caída'));

        const { result } = await renderAuth();
        await act(async () => {
            await result.current.loginWithEmailDemo('inversor@bez.digital', 'lo-que-sea');
        });

        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.token).toMatch(/^mock-jwt-\d+$/);
        expect(result.current.user).toMatchObject({
            username: 'inversor',
            email: 'inversor@bez.digital',
            role: 'Inversor Especial',
        });
    });

    it('el token de demo no es un JWT: no tiene las tres partes firmadas', async () => {
        fetchMock.mockRejectedValue(new Error('API caída'));

        const { result } = await renderAuth();
        await act(async () => {
            await result.current.loginWithEmailDemo('inversor@bez.digital', 'lo-que-sea');
        });

        expect(result.current.token!.split('.')).toHaveLength(1);
    });

    it('loginWithEmailDemo usa la sesión real cuando la API responde', async () => {
        fetchMock.mockResolvedValue(jsonResponse({ token: 'token-real', user: USER }));

        const { result } = await renderAuth();
        await act(async () => {
            await result.current.loginWithEmailDemo('yoel@bez.digital', 'clave-buena');
        });

        expect(result.current.token).toBe('token-real');
        expect(warned).not.toHaveBeenCalled();
    });

    it('completa un usuario sin arroba con el dominio de demo', async () => {
        fetchMock.mockRejectedValue(new Error('API caída'));

        const { result } = await renderAuth();
        await act(async () => {
            await result.current.loginWithEmailDemo('inversor', 'lo-que-sea');
        });

        expect(result.current.user?.email).toBe('inversor@bezhas.net');
    });

    it('registerDemo respeta el rol elegido cuando el alta real funciona', async () => {
        fetchMock.mockResolvedValue(jsonResponse({ token: 'token-alta', user: USER }));

        const { result } = await renderAuth();
        await act(async () => {
            await result.current.registerDemo('ana', 'ana@bez.digital', 'Socio', 'clave-buena');
        });

        expect(result.current.user?.role).toBe('Socio');
        expect(JSON.parse(localStorage.getItem('bezhas_user')!).role).toBe('Socio');
    });

    it('registerDemo inventa una sesión con el rol pedido si el alta falla', async () => {
        fetchMock.mockRejectedValue(new Error('API caída'));

        const { result } = await renderAuth();
        await act(async () => {
            await result.current.registerDemo('ana', 'ana@bez.digital', 'Socio', 'clave-buena');
        });

        expect(result.current.token).toMatch(/^mock-jwt-\d+$/);
        expect(result.current.user).toMatchObject({ username: 'ana', role: 'Socio' });
    });
});
