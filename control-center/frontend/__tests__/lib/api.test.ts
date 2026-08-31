import api, { ApiError, fetcher } from '@/lib/api';

const BASE = 'http://localhost:3001/api';

function mockResponse(init: {
    ok?: boolean;
    status?: number;
    statusText?: string;
    body?: unknown;
}) {
    return {
        ok: init.ok ?? true,
        status: init.status ?? 200,
        statusText: init.statusText ?? 'OK',
        json: jest.fn().mockResolvedValue(init.body ?? {}),
    } as unknown as Response;
}

const fetchMock = jest.fn();

beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    localStorage.clear();
});

describe('construcción de la petición', () => {
    it('antepone la base de la API al endpoint', async () => {
        fetchMock.mockResolvedValue(mockResponse({ body: { ok: true } }));

        await api.get('/users/1');

        expect(fetchMock).toHaveBeenCalledWith(`${BASE}/users/1`, expect.anything());
    });

    it.each([
        ['get', 'GET'],
        ['del', 'DELETE'],
    ] as const)('%s usa el método %s', async (method, expected) => {
        fetchMock.mockResolvedValue(mockResponse({ body: {} }));

        await api[method]('/recurso');

        expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: expected });
    });

    it.each([
        ['post', 'POST'],
        ['put', 'PUT'],
        ['patch', 'PATCH'],
    ] as const)('%s manda el cuerpo serializado con el método %s', async (method, expected) => {
        fetchMock.mockResolvedValue(mockResponse({ body: {} }));

        await api[method]('/recurso', { nombre: 'BeZhas' });

        expect(fetchMock.mock.calls[0][1]).toMatchObject({
            method: expected,
            body: JSON.stringify({ nombre: 'BeZhas' }),
        });
    });

    it('manda Content-Type JSON por defecto', async () => {
        fetchMock.mockResolvedValue(mockResponse({ body: {} }));

        await api.get('/recurso');

        expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
            'Content-Type': 'application/json',
        });
    });

    it('añade el Bearer sólo cuando se pasa token', async () => {
        fetchMock.mockResolvedValue(mockResponse({ body: {} }));

        await api.get('/privado', { token: 'abc123' });
        expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer abc123');

        fetchMock.mockResolvedValue(mockResponse({ body: {} }));
        await api.get('/publico');
        expect(fetchMock.mock.calls[1][1].headers.Authorization).toBeUndefined();
    });

    it('no filtra las opciones internas token/quiet al fetch', async () => {
        fetchMock.mockResolvedValue(mockResponse({ body: {} }));

        await api.get('/privado', { token: 'abc123', quiet: true });

        const options = fetchMock.mock.calls[0][1];
        expect(options).not.toHaveProperty('token');
        expect(options).not.toHaveProperty('quiet');
    });
});

describe('manejo de errores', () => {
    it('convierte un fallo de red en ApiError con status 0', async () => {
        fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

        const error = await api.get('/lo-que-sea').catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect(error.status).toBe(0);
        expect(error.message).toBe('API no disponible');
    });

    it('usa el error del backend e incluye método y endpoint', async () => {
        fetchMock.mockResolvedValue(
            mockResponse({ ok: false, status: 404, body: { error: 'No existe' } }),
        );

        const error = await api.get('/users/999').catch((e) => e);

        expect(error).toBeInstanceOf(ApiError);
        expect(error.status).toBe(404);
        expect(error.message).toBe('No existe (GET /users/999)');
        expect(error.data).toEqual({ error: 'No existe' });
    });

    it('cae a statusText cuando el cuerpo del error no es JSON', async () => {
        const res = mockResponse({ ok: false, status: 500, statusText: 'Internal Server Error' });
        (res.json as jest.Mock).mockRejectedValue(new SyntaxError('not json'));
        fetchMock.mockResolvedValue(res);

        const error = await api.post('/pagos', {}).catch((e) => e);

        expect(error.message).toBe('Internal Server Error (POST /pagos)');
        expect(error.data).toBeNull();
    });
});

describe('respuestas', () => {
    it('devuelve el JSON en las respuestas con cuerpo', async () => {
        fetchMock.mockResolvedValue(mockResponse({ body: { saldo: 42 } }));

        await expect(api.get('/wallet')).resolves.toEqual({ saldo: 42 });
    });

    it('devuelve null en un 204 sin intentar parsear', async () => {
        const res = mockResponse({ status: 204 });
        fetchMock.mockResolvedValue(res);

        await expect(api.del('/sesion')).resolves.toBeNull();
        expect(res.json).not.toHaveBeenCalled();
    });
});

describe('fetcher de SWR', () => {
    it('adjunta el token guardado en localStorage', async () => {
        localStorage.setItem('bezhas_token', 'token-de-sesion');
        fetchMock.mockResolvedValue(mockResponse({ body: {} }));

        await fetcher('/perfil');

        expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer token-de-sesion');
    });

    it('funciona sin sesión iniciada', async () => {
        fetchMock.mockResolvedValue(mockResponse({ body: {} }));

        await fetcher('/publico');

        expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
    });
});
