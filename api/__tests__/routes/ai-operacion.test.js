/**
 * Operación del chat: interruptor de apagado, métricas sin texto, techo diario compartido y límite compartido.
 */
process.env.KNOWLEDGE_STORE = 'memory';
process.env.AI_PROVIDER = 'extractive';
process.env.NATIVE_APPS_PROBE = 'false';

const express = require('express');
const request = require('supertest');
const { mockQuery, makeToken } = require('../helpers');
const rutas = require('../../routes/ai-workspace');
const { _cache } = require('../../services/ai-workspace/principal');
const logger = require('../../utils/logger');
const telemetria = require('../../services/ai-workspace/telemetry');
const { register } = require('../../middleware/metrics');
const { SharedRateLimitStore } = require('../../utils/sharedRateLimitStore');
const gateway = require('../../services/ai-workspace/gateway');

const app = () => { const a = express(); a.use('/api/ai-workspace/public', rutas.publicRouter); a.use('/api/ai-workspace', rutas); return a; };
const tk = makeToken({ userId: 1, role: 'user' });

beforeEach(() => {
    _cache.clear();
    rutas.facturacion._filas.clear();
    mockQuery.mockReset();
    mockQuery.mockImplementation(async (sql) => (/FROM organization_members/.test(sql)
        ? { rows: [{ organization_id: 'org-a', role: 'owner', plan: 'business', app_id: 'app-a' }] } : { rows: [], rowCount: 0 }));
});
afterEach(() => { delete process.env.AI_WORKSPACE_ENABLED; jest.restoreAllMocks(); });

describe('interruptor de apagado AI_WORKSPACE_ENABLED=false', () => {
    it.each([['/api/ai-workspace/chat'], ['/api/ai-workspace/chat/stream'], ['/api/ai-workspace/public/chat/stream']])('%s → 503 AI_DISABLED', async (ruta) => {
        process.env.AI_WORKSPACE_ENABLED = 'false';
        const res = await request(app()).post(ruta).set('Authorization', `Bearer ${tk}`).send({ message: 'hola' });
        expect(res.status).toBe(503);
        expect(res.body.code).toBe('AI_DISABLED');
    });
    it('no afecta a las lecturas (acciones)', async () => {
        process.env.AI_WORKSPACE_ENABLED = 'false';
        expect((await request(app()).get('/api/ai-workspace/actions').set('Authorization', `Bearer ${tk}`)).status).toBe(200);
    });
    it('encendido por defecto', async () => {
        const res = await request(app()).post('/api/ai-workspace/chat').set('Authorization', `Bearer ${tk}`).send({ message: '¿Cómo compro BEZ con tarjeta?' });
        expect(res.status).toBe(200);
    });
});

describe('métricas y log por mensaje', () => {
    it('registra el turno sin el texto de la pregunta ni de la respuesta', async () => {
        const info = jest.spyOn(logger, 'info');
        const secreto = 'pregunta-única-zafiro-12345 ¿cómo compro BEZ con tarjeta?';
        const res = await request(app()).post('/api/ai-workspace/chat').set('Authorization', `Bearer ${tk}`).send({ message: secreto });
        expect(res.status).toBe(200);
        const linea = info.mock.calls.map((c) => c[0]).find((o) => o && o.evento === 'ai_chat_turno');
        expect(linea).toMatchObject({ canal: 'chat', outcome: 'ok', provider: 'extractive', userId: '1' });
        expect(linea.retrieval).toMatchObject({ resultado: expect.stringMatching(/hit|weak|none/) });
        expect(JSON.stringify(linea)).not.toMatch(/zafiro|comprar|tarjeta/i);
    });
    it('expone los contadores en /metrics', async () => {
        await request(app()).post('/api/ai-workspace/chat').set('Authorization', `Bearer ${tk}`).send({ message: '¿Qué es el Edge Node?' });
        const m = await register.metrics();
        expect(m).toMatch(/bezhas_ai_chat_messages_total\{[^}]*outcome="ok"/);
        expect(m).toMatch(/bezhas_ai_retrieval_duration_seconds_count/);
        expect(m).toMatch(/bezhas_ai_retrieval_total\{resultado="(hit|weak|none)"\}/);
    });
    it('clasifica la cobertura: hit, weak y none', () => {
        const ctx = (r) => `<untrusted_document ref="1" relevance="${r}">x</untrusted_document>`;
        expect(telemetria.retrieval({ ms: 1, sources: [{}], context: ctx('0.80') }).resultado).toBe('hit');
        expect(telemetria.retrieval({ ms: 1, sources: [{}], context: ctx('0.31') }).resultado).toBe('weak');
        expect(telemetria.retrieval({ ms: 1, sources: [], context: '' }).resultado).toBe('none');
    });
});

describe('techo diario compartido entre instancias', () => {
    it('si Redis dice que el techo global se alcanzó, se sirve el modo extractivo', async () => {
        process.env.ANTHROPIC_API_KEY = 'x'; delete process.env.AI_PROVIDER;
        try {
            expect(await gateway.techoCompartidoLibre(async () => ({ allowed: false, count: 20001 }))).toBe(false);
            expect(await gateway.techoCompartidoLibre(async () => ({ allowed: true, count: 5 }))).toBe(true);
        } finally { delete process.env.ANTHROPIC_API_KEY; process.env.AI_PROVIDER = 'extractive'; }
    });
    it('Redis degradado o caído no bloquea el chat', async () => {
        expect(await gateway.techoCompartidoLibre(async () => ({ allowed: true, degraded: true }))).toBe(true);
        expect(await gateway.techoCompartidoLibre(async () => { throw new Error('caído'); })).toBe(true);
    });
});

describe('límite compartido (SharedRateLimitStore)', () => {
    const opts = { windowMs: 60_000, limit: 3 };
    it('usa el contador de Redis cuando está disponible (cuenta de todas las instancias)', async () => {
        const check = jest.fn().mockResolvedValue({ allowed: true, count: 7, resetInSec: 30 });
        const s = new SharedRateLimitStore({ prefix: 'p', check }); s.init(opts);
        const r = await s.increment('u1');
        expect(r.totalHits).toBe(7);
        expect(check).toHaveBeenCalledWith('p:u1', 3, 60);
    });
    it('sin Redis cae al contador local de la instancia', async () => {
        const s = new SharedRateLimitStore({ check: async () => ({ degraded: true, allowed: true, count: 0 }) }); s.init(opts);
        expect((await s.increment('u')).totalHits).toBe(1);
        expect((await s.increment('u')).totalHits).toBe(2);
        await s.decrement('u');
        expect((await s.increment('u')).totalHits).toBe(2);
        await s.resetKey('u');
        expect((await s.increment('u')).totalHits).toBe(1);
    });
    it('si el check lanza, también cae al local', async () => {
        const s = new SharedRateLimitStore({ check: async () => { throw new Error('x'); } }); s.init(opts);
        expect((await s.increment('k')).totalHits).toBe(1);
    });
});
