const request = require('supertest');
const { mockQuery } = require('../helpers');
const app = require('../../index');

const token = (c = 'a') => c.repeat(64);
const enMinutos = (m) => new Date(Date.now() + m * 60000);

function conSesion(over = {}) {
    mockQuery.mockResolvedValueOnce({
        rows: [{
            id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            kind: 'signup',
            prefill: { sector: 'logistica', razonSocial: 'Delta SL' },
            status: 'pendiente',
            step: null,
            org_id: 'org-secreta',
            expires_at: enMinutos(10),
            created_at: new Date(),
            completed_at: null,
            ...over,
        }],
    });
}

describe('Pantallas de onboarding (/o)', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });

    describe('la página', () => {
        it('sirve el HTML sin consultar nada', async () => {
            // La página no revela nada por sí sola: todo lo pide después al
            // endpoint público, que es quien valida token y caducidad. Así un
            // token inventado no distingue «no existe» de «existe y caducó»
            // por el tiempo de respuesta del HTML.
            const res = await request(app).get(`/o/${token()}`);
            expect(res.status).toBe(200);
            expect(res.text).toContain('BeZhas');
            expect(mockQuery).not.toHaveBeenCalled();
        });

        it('no se indexa ni se cachea', async () => {
            const res = await request(app).get(`/o/${token()}`);
            expect(res.headers['cache-control']).toContain('no-store');
            expect(res.headers['x-robots-tag']).toContain('noindex');
            expect(res.text).toContain('noindex');
        });

        it('rechaza un token con otra forma', async () => {
            expect((await request(app).get('/o/corto')).status).toBe(404);
            expect((await request(app).get('/o/' + 'z'.repeat(64))).status).toBe(404);
        });

        it('avisa de que el IBAN no se escribe en el chat', async () => {
            const res = await request(app).get(`/o/${token()}`);
            expect(res.text).toMatch(/No lo escribas nunca en el chat/);
        });
    });

    describe('estado público', () => {
        it('devuelve el prefill a quien tiene el enlace, pero nunca la organización', async () => {
            // El prefill son SUS datos, los que su agente recogió: puede verlos.
            // org_id identifica a un tercero dentro de BeZhas y no sale nunca.
            conSesion();
            const res = await request(app).get(`/api/gateway/v1/onboarding/${token()}`);
            expect(res.status).toBe(200);
            expect(res.body.onboarding.prefill.razonSocial).toBe('Delta SL');
            expect(JSON.stringify(res.body)).not.toContain('org-secreta');
        });

        it('una sesión inexistente da 404', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });
            expect((await request(app).get(`/api/gateway/v1/onboarding/${token('b')}`)).status).toBe(404);
        });

        it('un token con forma inválida no llega a la ruta', async () => {
            expect((await request(app).get('/api/gateway/v1/onboarding/xyz')).status).toBe(404);
            expect(mockQuery).not.toHaveBeenCalled();
        });

        it('marca caducada la sesión vencida al consultarla', async () => {
            conSesion({ expires_at: enMinutos(-1) });
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
            const res = await request(app).get(`/api/gateway/v1/onboarding/${token()}`);
            expect(res.body.onboarding.estado).toBe('caducado');
        });
    });

    describe('avance y cierre', () => {
        it('el avance no acepta datos, sólo el paso', async () => {
            // Es la garantía de que ningún dato de negocio entra por aquí: el
            // endpoint ignora todo lo que no sea el nombre del paso.
            conSesion();
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'x', kind: 'signup', prefill: {}, status: 'en_curso', step: 'Condiciones',
                    org_id: null, expires_at: enMinutos(10), created_at: new Date(), completed_at: null }],
            });
            const res = await request(app)
                .post(`/api/gateway/v1/onboarding/${token()}/step`)
                .send({ step: 'Condiciones', iban: 'ES7714650100911766376210' });

            expect(res.status).toBe(200);
            const escrito = JSON.stringify(mockQuery.mock.calls);
            expect(escrito).not.toContain('ES7714650100911766376210');
        });

        it('cerrar una sesión caducada da 409', async () => {
            conSesion({ status: 'caducado', expires_at: enMinutos(-30) });
            const res = await request(app).post(`/api/gateway/v1/onboarding/${token()}/complete`);
            expect(res.status).toBe(409);
            expect(res.body.code).toBe('ONBOARDING_CADUCADA');
        });

        it('cerrar una inexistente da 404', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });
            expect((await request(app).post(`/api/gateway/v1/onboarding/${token()}/complete`)).status).toBe(404);
        });
    });
});
