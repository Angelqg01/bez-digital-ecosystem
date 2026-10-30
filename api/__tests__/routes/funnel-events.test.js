const request = require('supertest');
const { mockQuery } = require('../helpers');
const app = require('../../index');

const ok = { event: 'nudge_shown', trigger: 'pricing', path: '/be-vip', mode: 'contextual', sid: 'abcd1234-ef56' };
const inserts = () => mockQuery.mock.calls.filter((c) => /INSERT INTO funnel_events/i.test(c[0]));

describe('Eventos del embudo del chat', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    });

    it('guarda un evento válido y responde 204', async () => {
        const res = await request(app).post('/api/funnel/events').send(ok);
        expect(res.status).toBe(204);
        expect(inserts()).toHaveLength(1);
        expect(inserts()[0][1]).toEqual(['nudge_shown', 'pricing', null, '/be-vip', 'contextual', 'abcd1234-ef56', null]);
    });

    it('en modo contextual descarta la fuente aunque llegue; con consentimiento la guarda', async () => {
        await request(app).post('/api/funnel/events').send({ ...ok, source: 'linkedin' });
        expect(inserts()[0][1][6]).toBeNull();
        mockQuery.mockClear();
        await request(app).post('/api/funnel/events').send({ ...ok, mode: 'personalized', source: 'linkedin' });
        expect(inserts()[0][1][6]).toBe('linkedin');
    });

    it('no admite texto libre ni campos desconocidos: no hay dónde guardar un mensaje o un email', async () => {
        await request(app).post('/api/funnel/events').send({ ...ok, message: 'mi iban es ES91...' });
        await request(app).post('/api/funnel/events').send({ ...ok, email: 'ana@empresa.com' });
        expect(inserts()).toHaveLength(0);
    });

    it('rechaza una ruta con query o fuera del formato', async () => {
        await request(app).post('/api/funnel/events').send({ ...ok, path: '/be-vip?token=secreto' });
        await request(app).post('/api/funnel/events').send({ ...ok, path: 'https://evil.com/x' });
        expect(inserts()).toHaveLength(0);
    });

    it('rechaza eventos y disparadores fuera del catálogo', async () => {
        await request(app).post('/api/funnel/events').send({ ...ok, event: 'drop_table' });
        await request(app).post('/api/funnel/events').send({ ...ok, trigger: 'x' });
        expect(inserts()).toHaveLength(0);
    });

    it('un evento no válido responde igual que uno válido (no da pistas)', async () => {
        const res = await request(app).post('/api/funnel/events').send({ nada: true });
        expect(res.status).toBe(204);
    });

    it('si la base falla, la página no se entera', async () => {
        mockQuery.mockRejectedValue(new Error('db caída'));
        const res = await request(app).post('/api/funnel/events').send(ok);
        expect(res.status).toBe(204);
    });
});
