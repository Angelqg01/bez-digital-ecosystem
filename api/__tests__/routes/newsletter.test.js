const request = require('supertest');
const { mockQuery } = require('../helpers');
process.env.OPERANT_INTERNAL_KEY = 'clave-interna-de-prueba';
const app = require('../../index');
const operantBridge = require('../../services/operantBridge');

// Sólo las consultas de ESTA tabla: otros middlewares también escriben (auditoría, métricas).
const deNewsletter = () => mockQuery.mock.calls.filter((c) => /newsletter_subscribers/.test(String(c[0])));

const KEY = { 'x-api-key': 'clave-interna-de-prueba' };
const T = 'a'.repeat(64);

beforeEach(() => mockQuery.mockReset().mockResolvedValue({ rows: [], rowCount: 0 }));

describe('POST /api/newsletter/request', () => {
    it('sin clave interna: 401 y no toca la base', async () => {
        const r = await request(app).post('/api/newsletter/request').send({ email: 'a@b.co', source: 'telegram' });
        expect(r.status).toBe(401);
        expect(deNewsletter()).toHaveLength(0);
    });

    it('correo inválido o canal desconocido: 400', async () => {
        expect((await request(app).post('/api/newsletter/request').set(KEY).send({ email: 'no-es-correo', source: 'telegram' })).status).toBe(400);
        expect((await request(app).post('/api/newsletter/request').set(KEY).send({ email: 'a@b.co', source: 'fax' })).status).toBe(400);
    });

    it('alta nueva: pending, enlaces con token en claro y sólo hashes en la base', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] });                 // SELECT previa
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });    // INSERT
        const r = await request(app).post('/api/newsletter/request').set(KEY)
            .send({ email: 'Nuevo@Acme.com', source: 'telegram', language: 'es' });
        expect(r.status).toBe(200);
        expect(r.body.status).toBe('pending');
        expect(r.body.confirmUrl).toMatch(/\/api\/newsletter\/confirm\/[0-9a-f]{64}$/);
        const insert = mockQuery.mock.calls.find((c) => /INSERT INTO newsletter_subscribers/.test(c[0]));
        expect(insert[1][0]).toBe('nuevo@acme.com');
        const token = r.body.confirmUrl.split('/').pop();
        expect(insert[1]).not.toContain(token);                         // el token en claro no se guarda
        expect(insert[1][1]).toHaveLength(64);                          // sí su hash
    });

    it('ya confirmada: no genera tokens ni escribe', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ status: 'confirmed', requested_at: new Date() }] });
        const r = await request(app).post('/api/newsletter/request').set(KEY).send({ email: 'a@b.co', source: 'email' });
        expect(r.body).toEqual({ status: 'already_confirmed' });
        expect(deNewsletter().some((c) => /INSERT/.test(c[0]))).toBe(false);
    });

    it('pendiente pedida hace un momento: no se reenvía (anti-spam a un tercero)', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ status: 'pending', requested_at: new Date() }] });
        const r = await request(app).post('/api/newsletter/request').set(KEY).send({ email: 'a@b.co', source: 'chat' });
        expect(r.body).toEqual({ status: 'pending_recent' });
    });
});

describe('confirmar y darse de baja', () => {
    it('GET /confirm NO confirma: sólo enseña el botón (los antivirus abren los enlaces)', async () => {
        const r = await request(app).get(`/api/newsletter/confirm/${T}`);
        expect(r.status).toBe(200);
        expect(r.text).toContain('method="post"');
        expect(deNewsletter()).toHaveLength(0);
    });

    it('POST /confirm confirma con el hash del token', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });
        const r = await request(app).post(`/api/newsletter/confirm/${T}`);
        expect(r.status).toBe(200);
        expect(r.text).toContain('confirmada');
        expect(mockQuery.mock.calls[0][1][0]).toHaveLength(64);
        expect(mockQuery.mock.calls[0][1][0]).not.toBe(T);
    });

    it('token caducado o ya usado: 410', async () => {
        const r = await request(app).post(`/api/newsletter/confirm/${T}`);
        expect(r.status).toBe(410);
    });

    it('token con formato inválido: 404 sin consultar la base', async () => {
        const r = await request(app).post('/api/newsletter/confirm/../x');
        expect([404, 400]).toContain(r.status);
        expect(deNewsletter()).toHaveLength(0);
    });

    it('la baja es idempotente y no revela si el enlace existía', async () => {
        const r = await request(app).post(`/api/newsletter/unsubscribe/${T}`);
        expect(r.status).toBe(200);
        expect(r.text).toContain('Baja realizada');
    });
});

describe('POST /api/operant/channels/telegram', () => {
    beforeEach(() => {
        process.env.OPERANT_TELEGRAM_SECRET = 'secreto-telegram-de-prueba';
        jest.spyOn(operantBridge, 'forwardChannel').mockRejectedValue(new Error('OPERANT no disponible: prueba'));
    });
    afterEach(() => { delete process.env.OPERANT_TELEGRAM_SECRET; jest.restoreAllMocks(); });

    it('sin el secreto de Telegram: 401', async () => {
        const r = await request(app).post('/api/operant/channels/telegram').send({ update_id: 1 });
        expect(r.status).toBe(401);
    });

    it('sin secreto configurado en el servidor: 503 (no queda abierto)', async () => {
        delete process.env.OPERANT_TELEGRAM_SECRET;
        const r = await request(app).post('/api/operant/channels/telegram').set('x-telegram-bot-api-secret-token', 'x').send({ update_id: 1 });
        expect(r.status).toBe(503);
    });

    it('con el secreto: contesta 200 aunque OPERANT no esté disponible (evita reintentos de Telegram)', async () => {
        const r = await request(app).post('/api/operant/channels/telegram')
            .set('x-telegram-bot-api-secret-token', 'secreto-telegram-de-prueba')
            .send({ update_id: 777001, message: { text: 'hola', chat: { id: 1 }, from: { id: 1 } } });
        expect(r.status).toBe(200);
        expect(operantBridge.forwardChannel).toHaveBeenCalledWith(expect.objectContaining({
            channel: 'telegram', tenantId: expect.any(String),
            headers: { 'x-telegram-bot-api-secret-token': 'secreto-telegram-de-prueba' },
        }));
    });

    it('el mismo update_id dos veces: el segundo se descarta', async () => {
        const mandar = () => request(app).post('/api/operant/channels/telegram')
            .set('x-telegram-bot-api-secret-token', 'secreto-telegram-de-prueba')
            .send({ update_id: 777002, message: { text: 'hola', chat: { id: 1 }, from: { id: 1 } } });
        await mandar();
        const r2 = await mandar();
        expect(r2.body.duplicate).toBe(true);
    });
});
