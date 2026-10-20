describe('brainClient', () => {
    const ENV = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...ENV };
        delete process.env.BRAIN_API_KEY;
    });
    afterAll(() => { process.env = ENV; });

    test('manda la clave del Brain y no pide ID token en local', async () => {
        process.env.BRAIN_API_KEY = 'k'.repeat(48);
        const { brainHeaders } = require('../../services/brainClient');
        await expect(brainHeaders('http://obsidian-mcp:4007')).resolves.toEqual({ 'x-brain-key': 'k'.repeat(48) });
        await expect(brainHeaders('https://localhost:4007')).resolves.toEqual({ 'x-brain-key': 'k'.repeat(48) });
    });

    test('sin clave no inventa cabeceras', async () => {
        const { brainHeaders } = require('../../services/brainClient');
        await expect(brainHeaders('http://obsidian-mcp:4007')).resolves.toEqual({});
    });

    test('en Cloud Run añade el ID token con la URL del servicio como audience', async () => {
        const getIdTokenClient = jest.fn(async () => ({
            getRequestHeaders: async () => ({ Authorization: 'Bearer tok-123' }),
        }));
        jest.doMock('google-auth-library', () => ({ GoogleAuth: jest.fn(() => ({ getIdTokenClient })) }));
        process.env.BRAIN_API_KEY = 'k'.repeat(48);
        const { brainHeaders } = require('../../services/brainClient');
        const url = 'https://bezhas-brain-969634612038.us-central1.run.app/telemetry/summary';
        await expect(brainHeaders(url)).resolves.toEqual({
            'x-brain-key': 'k'.repeat(48),
            'x-serverless-authorization': 'Bearer tok-123',
        });
        expect(getIdTokenClient).toHaveBeenCalledWith('https://bezhas-brain-969634612038.us-central1.run.app');
        await brainHeaders(url);
        expect(getIdTokenClient).toHaveBeenCalledTimes(1); // cacheado
    });

    test('si no puede acuñar el token, sale sólo con la clave', async () => {
        jest.doMock('google-auth-library', () => ({
            GoogleAuth: jest.fn(() => ({ getIdTokenClient: async () => { throw new Error('sin credenciales'); } })),
        }));
        process.env.BRAIN_API_KEY = 'k'.repeat(48);
        const { brainHeaders } = require('../../services/brainClient');
        await expect(brainHeaders('https://bezhas-brain-1.us-central1.run.app')).resolves.toEqual({ 'x-brain-key': 'k'.repeat(48) });
    });
});
