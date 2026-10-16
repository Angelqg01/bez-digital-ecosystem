/**
 * Ruta del chat con R2 y R3: precios y límites sin modelo, y cifras inventadas retiradas en chat y en stream.
 */
process.env.KNOWLEDGE_STORE = 'memory';
process.env.AI_PROVIDER = 'extractive';
process.env.NATIVE_APPS_PROBE = 'false';

const express = require('express');
const request = require('supertest');
const { mockQuery, makeToken } = require('../helpers');
const rutas = require('../../routes/ai-workspace');
const { _cache } = require('../../services/ai-workspace/principal');
const gateway = require('../../services/ai-workspace/gateway');

const app = () => { const a = express(); a.use('/api/ai-workspace', rutas); return a; };
const tk = makeToken({ userId: 1, role: 'user' });
const T9 = 'Somos un grupo con 8 sociedades y varios parques. ¿Qué plan nos conviene y cuánto cuesta?';
const MALA = 'El plan Business es lo mejor.\n\nEl coste es de **19,99 € al mes** por entidad (sociedad).\n\nIncluye soporte por correo.';

beforeEach(() => {
    _cache.clear(); rutas.facturacion._filas.clear(); mockQuery.mockReset();
    mockQuery.mockImplementation(async (sql) => (/FROM organization_members/.test(sql)
        ? { rows: [{ organization_id: 'org-a', role: 'owner', plan: 'business', app_id: 'app-a' }] } : { rows: [], rowCount: 0 }));
});
afterEach(() => jest.restoreAllMocks());

const chat = (message) => request(app()).post('/api/ai-workspace/chat').set('Authorization', `Bearer ${tk}`).send({ message });

describe('R3 en la ruta: precios y límites sin modelo', () => {
    it('T9: responde el servidor (provider facts), con Enterprise VIP y sin llamar al modelo ni gastar cuota', async () => {
        const complete = jest.spyOn(gateway, 'complete');
        const res = await chat(T9);
        expect(res.status).toBe(200);
        expect(res.body.provider).toBe('facts');
        expect(res.body.reply).toMatch(/Enterprise VIP/);
        expect(res.body.reply).toMatch(/499 €\/mes/);
        expect(res.body.reply).not.toMatch(/19,99/);
        expect(res.body.usage).toBeNull();
        // El cierre es genérico: ni repite la recomendación de grupo ni manda a BEZ Energy por mencionar «parques».
        expect((res.body.reply.match(/Enterprise VIP \(Holdings/g) || []).length).toBeGreaterThan(0);
        expect(res.body.reply).not.toMatch(/Plan para un grupo/);
        expect(res.body.reply).not.toMatch(/BEZ Energy/);
        expect(res.body.reply).toMatch(/Consejo de seguridad/);
        expect(complete).not.toHaveBeenCalled();
        expect(rutas.facturacion._filas.size).toBe(0);
    });
    it('stream: evento provider facts, texto completo y sin reserva de cuota', async () => {
        const stream = jest.spyOn(gateway, 'stream');
        const res = await request(app()).post('/api/ai-workspace/chat/stream').set('Authorization', `Bearer ${tk}`).send({ message: T9 }).buffer(true).parse((r, cb) => { let d = ''; r.on('data', (c) => { d += c; }); r.on('end', () => cb(null, d)); });
        expect(res.status).toBe(200);
        expect(res.body).toMatch(/event: provider\ndata: {"provider":"facts"}/);
        expect(res.body).toMatch(/Enterprise VIP/);
        expect(res.body).not.toMatch(/19,99/);
        expect(stream).not.toHaveBeenCalled();
    });
    it('una pregunta de precio de OTRA cosa sigue yendo al modelo', async () => {
        const complete = jest.spyOn(gateway, 'complete');
        const res = await chat('¿Cuánto cuesta tokenizar un activo?');
        expect(res.body.provider).not.toBe('facts');
        expect(complete).toHaveBeenCalled();
    });
});

describe('R2 en la ruta: cifras inventadas por el modelo', () => {
    it('chat: se retira el precio inventado y se avisa', async () => {
        jest.spyOn(gateway, 'complete').mockResolvedValue({ provider: 'anthropic', text: MALA, usage: { model: 'claude-sonnet-5-5', inputTokens: 100, outputTokens: 40 } });
        const res = await chat('Cuéntame algo del soporte');
        expect(res.status).toBe(200);
        expect(res.body.reply).not.toMatch(/19,99/);
        expect(res.body.reply).toMatch(/Incluye soporte por correo/);
        expect(res.body.reply).toMatch(/He retirado de esta respuesta una o más cifras/);
    });
    it('stream: el cliente recibe un evento replace con el texto ya comprobado', async () => {
        jest.spyOn(gateway, 'stream').mockImplementation(async function* () {
            yield { type: 'start', provider: 'anthropic' };
            yield { type: 'delta', text: MALA };
            yield { type: 'usage', provider: 'anthropic', model: 'claude-sonnet-5-5', inputTokens: 100, outputTokens: 40 };
            yield { type: 'done' };
        });
        const res = await request(app()).post('/api/ai-workspace/chat/stream').set('Authorization', `Bearer ${tk}`).send({ message: 'Cuéntame algo del soporte' }).buffer(true).parse((r, cb) => { let d = ''; r.on('data', (c) => { d += c; }); r.on('end', () => cb(null, d)); });
        const m = res.body.match(/event: replace\ndata: (.+)\n/);
        expect(m).toBeTruthy();
        const reemplazo = JSON.parse(m[1]).text;
        expect(reemplazo).not.toMatch(/19,99/);
        expect(reemplazo).toMatch(/He retirado de esta respuesta/);
    });
    it('una respuesta con cifras que sí constan en el contexto no se toca', async () => {
        jest.spyOn(gateway, 'complete').mockResolvedValue({ provider: 'anthropic', text: 'Creator Pro cuesta 99 €/mes + IVA [1].', usage: { model: 'claude-sonnet-5-5', inputTokens: 100, outputTokens: 20 } });
        const res = await chat('Háblame de los planes y de qué incluye Creator Pro');
        expect(res.body.reply).toMatch(/Creator Pro cuesta 99 €\/mes/);
        expect(res.body.reply).not.toMatch(/He retirado/);
    });
    it('multi-turno: una cifra dicha antes por el servidor en la conversación puede repetirse', async () => {
        const primera = await chat(T9); // respuesta determinista con 499 € y 2499 €
        jest.spyOn(gateway, 'complete').mockResolvedValue({ provider: 'anthropic', text: 'Como te indiqué, Business cuesta 499 €/mes y Enterprise VIP 2499 €/mes.', usage: { model: 'claude-sonnet-5-5', inputTokens: 100, outputTokens: 20 } });
        const res = await request(app()).post('/api/ai-workspace/chat').set('Authorization', `Bearer ${tk}`).send({ message: 'Resúmelo en una línea', conversationId: primera.body.conversationId });
        expect(res.body.reply).toMatch(/Business cuesta 499 €\/mes/);
        expect(res.body.reply).not.toMatch(/He retirado/);
    });
    it('sin esa conversación previa, la misma frase sí se retira (el modelo no puede saber el precio)', async () => {
        jest.spyOn(gateway, 'complete').mockResolvedValue({ provider: 'anthropic', text: 'Business cuesta 7777 €/mes.', usage: { model: 'claude-sonnet-5-5', inputTokens: 100, outputTokens: 20 } });
        const res = await chat('Resúmelo en una línea');
        expect(res.body.reply).not.toMatch(/7777/);
    });
});
