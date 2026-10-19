'use strict';

/**
 * El puente hacia OPERANT cuando éste vive en Cloud Run (--no-allow-unauthenticated):
 * ID token en X-Serverless-Authorization, la clave interna intacta en x-api-key,
 * y nada de eso en local.
 */
const cargar = (url) => {
    jest.resetModules();
    process.env.OPERANT_API_URL = url;
    process.env.OPERANT_INTERNAL_KEY = 'clave-interna-de-prueba';
    jest.doMock('google-auth-library', () => ({
        GoogleAuth: class {
            async getIdTokenClient(audience) {
                return { getRequestHeaders: async () => ({ Authorization: `Bearer idtoken-para-${audience}` }) };
            }
        },
    }));
    return require('../../services/operantBridge');
};

let llamadas;
beforeEach(() => {
    llamadas = [];
    global.fetch = jest.fn(async (url, opts) => {
        llamadas.push({ url, headers: opts.headers });
        return { ok: true, text: async () => '{"status":"healthy"}' };
    });
});
afterEach(() => { delete process.env.OPERANT_API_URL; delete process.env.OPERANT_INTERNAL_KEY; });

test('en Cloud Run: ID token con la URL del servicio como audience, en X-Serverless-Authorization', async () => {
    const bridge = cargar('https://bezhas-operant-123.us-central1.run.app');
    await bridge.health();
    const h = llamadas[0].headers;
    expect(h['x-serverless-authorization']).toBe('Bearer idtoken-para-https://bezhas-operant-123.us-central1.run.app');
    expect(h['x-api-key']).toBe('clave-interna-de-prueba');   // la clave de OPERANT no se toca
    expect(h.authorization).toBeUndefined();
});

test('en local (http://localhost) no se pide ningún token', async () => {
    const bridge = cargar('http://localhost:4000');
    await bridge.health();
    expect(llamadas[0].headers['x-serverless-authorization']).toBeUndefined();
    expect(llamadas[0].headers['x-api-key']).toBe('clave-interna-de-prueba');
});

test('si no se puede acuñar el token, la petición sale igualmente (falla abierto)', async () => {
    jest.resetModules();
    process.env.OPERANT_API_URL = 'https://bezhas-operant-123.us-central1.run.app';
    process.env.OPERANT_INTERNAL_KEY = 'k';
    jest.doMock('google-auth-library', () => ({ GoogleAuth: class { async getIdTokenClient() { throw new Error('sin credenciales'); } } }));
    const bridge = require('../../services/operantBridge');
    await bridge.health();
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].headers['x-serverless-authorization']).toBeUndefined();
});

test('un 503 con status:degraded (p. ej. el correo caído) es OPERANT vivo y degradado, no caído', async () => {
    const bridge = cargar('http://localhost:4000');
    global.fetch = jest.fn(async () => ({
        ok: false, status: 503,
        text: async () => JSON.stringify({ status: 'degraded', checks: { store: 'ok', email: 'degradado' } }),
    }));
    const h = await bridge.health();
    expect(h).toMatchObject({ available: true, degraded: true, status: 'degraded' });
});

test('un 503 sin cuerpo reconocible sigue siendo no disponible', async () => {
    const bridge = cargar('http://localhost:4000');
    global.fetch = jest.fn(async () => ({ ok: false, status: 503, text: async () => 'Service Unavailable' }));
    const h = await bridge.health();
    expect(h.available).toBe(false);
});
