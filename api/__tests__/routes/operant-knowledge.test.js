const express = require('express');
const request = require('supertest');
const { crearRouter, appDeTenant } = require('../../routes/operant-knowledge');

const CLAVE = 'k'.repeat(48);

function app({ filas = [], buscar } = {}) {
    const db = jest.fn(async () => ({ rows: filas }));
    const b = buscar || jest.fn(async (args) => ({ pregunta: args.pregunta, resultados: [], sinResultados: true, recibido: args }));
    const a = express();
    a.use(express.json());
    a.use('/api/operant-knowledge', crearRouter({ db, buscar: b }));
    return { a, db, buscar: b };
}

describe('POST /api/operant-knowledge/search', () => {
    const ENV = process.env;
    beforeEach(() => { process.env = { ...ENV, OPERANT_INTERNAL_KEY: CLAVE }; delete process.env.OPERANT_PLATFORM_TENANT; });
    afterAll(() => { process.env = ENV; });

    test('sin clave interna o con otra: 401 y no consulta nada', async () => {
        const { a, db, buscar } = app();
        await request(a).post('/api/operant-knowledge/search').send({ tenantId: 'bezhas', pregunta: 'x' }).expect(401);
        await request(a).post('/api/operant-knowledge/search').set('x-api-key', 'otra').send({ tenantId: 'bezhas', pregunta: 'x' }).expect(401);
        expect(db).not.toHaveBeenCalled();
        expect(buscar).not.toHaveBeenCalled();
    });

    test('sin OPERANT_INTERNAL_KEY configurada nadie entra', async () => {
        delete process.env.OPERANT_INTERNAL_KEY;
        const { a } = app();
        await request(a).post('/api/operant-knowledge/search').set('x-api-key', '').send({ tenantId: 'bezhas' }).expect(401);
    });

    test('el tenant de la plataforma busca como público, sin tocar la base de datos', async () => {
        const { a, db, buscar } = app();
        const res = await request(a).post('/api/operant-knowledge/search').set('x-api-key', CLAVE)
            .send({ tenantId: 'bezhas', pregunta: '¿Qué es CargoLink?', limite: 3 }).expect(200);
        expect(db).not.toHaveBeenCalled();
        expect(buscar).toHaveBeenCalledWith({ app: { id: 'operant-bezhas' }, plan: 'starter', soloPropio: false, pregunta: '¿Qué es CargoLink?', limite: 3 });
        expect(res.body.pregunta).toBe('¿Qué es CargoLink?');
    });

    test('un tenant de empresa busca con su app y su plan, nunca con lo que mande el cuerpo', async () => {
        const { a, buscar } = app({ filas: [{ app_id: '11111111-2222-3333-4444-555555555555', plan_id: 'business' }] });
        await request(a).post('/api/operant-knowledge/search').set('x-api-key', CLAVE)
            .send({ tenantId: 'bez-111111112222333344445555', pregunta: 'hola', app: { id: 'ajena' }, plan: 'enterprise_vip' }).expect(200);
        expect(buscar).toHaveBeenCalledWith(expect.objectContaining({
            app: { id: '11111111-2222-3333-4444-555555555555' }, plan: 'business', soloPropio: true,
        }));
    });

    test('tenant desconocido o inactivo: 404; tenant mal formado: 400', async () => {
        const { a, buscar } = app({ filas: [] });
        await request(a).post('/api/operant-knowledge/search').set('x-api-key', CLAVE).send({ tenantId: 'bez-nadie', pregunta: 'x' }).expect(404);
        await request(a).post('/api/operant-knowledge/search').set('x-api-key', CLAVE).send({ tenantId: '../etc', pregunta: 'x' }).expect(400);
        expect(buscar).not.toHaveBeenCalled();
    });

    test('los errores de validación de la búsqueda se devuelven con su estado', async () => {
        const buscar = jest.fn(async () => { throw Object.assign(new Error('La pregunta es obligatoria'), { status: 400, code: 'QUERY_REQUIRED' }); });
        const { a } = app({ buscar });
        const res = await request(a).post('/api/operant-knowledge/search').set('x-api-key', CLAVE).send({ tenantId: 'bezhas' }).expect(400);
        expect(res.body.code).toBe('QUERY_REQUIRED');
    });

    test('appDeTenant solo acepta tenants activos (lo filtra la consulta)', async () => {
        const db = jest.fn(async () => ({ rows: [] }));
        await expect(appDeTenant('bez-x1', db)).resolves.toBeNull();
        expect(db.mock.calls[0][0]).toMatch(/t\.status = 'active'/);
    });
});
