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

    describe('entrega de credenciales', () => {
        const sha256 = (v) => require('crypto').createHash('sha256').update(v).digest('hex');

        it('emite la api-key una vez y devuelve el valor sin cachearlo', async () => {
            mockQuery.mockResolvedValueOnce({                       // consumir sesión
                rows: [{ id: 's1', kind: 'sdk_install', prefill: {}, app_id: 'app-1', org_id: null }], rowCount: 1,
            });
            mockQuery.mockResolvedValueOnce({                       // app padre
                rows: [{ app_name: 'cliente', scopes: ['token'], tier: 'standard',
                    enterprise_id: null, authorized_addresses: [], address_access_mode: 'strict' }],
            });
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'app-2', app_name: 'cliente-x' }] });

            const res = await request(app).post(`/api/gateway/v1/onboarding/${token()}/issue`).send({});
            expect(res.status).toBe(200);
            expect(res.body.emitido.valor).toHaveLength(64);
            // Sin no-store, un proxy o el propio navegador podrían dejar la
            // credencial en caché en disco.
            expect(res.headers['cache-control']).toContain('no-store');

            const insert = mockQuery.mock.calls.find((c) => /INSERT INTO app_registry/i.test(String(c[0])));
            expect(insert[1][1]).toBe(sha256(res.body.emitido.valor));
        });

        it('el segundo intento con el mismo enlace da 409', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            mockQuery.mockResolvedValueOnce({ rows: [{ status: 'completado', expires_at: new Date() }] });
            const res = await request(app).post(`/api/gateway/v1/onboarding/${token()}/issue`).send({});
            expect(res.status).toBe(409);
            expect(res.body.code).toBe('ISSUE_YA_EMITIDO');
        });

        it('un tipo que no emite no se convierte en emisor', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 's1', kind: 'bank_setup', prefill: {}, app_id: 'app-1', org_id: null }], rowCount: 1,
            });
            const res = await request(app).post(`/api/gateway/v1/onboarding/${token()}/issue`).send({});
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('ISSUE_TIPO_SIN_EMISION');
        });
    });

    describe('registro de nodo', () => {
        it('acepta la pública y consume el vale', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'n1', tipo: 'edge', entorno: 'sandbox', nombre: 'edge-1', app_id: 'app-1' }], rowCount: 1,
            });
            const res = await request(app).post('/api/gateway/v1/nodes/register')
                .send({ registrationToken: 'b'.repeat(64), publicKey: 'x'.repeat(64), version: '1.0.0' });
            expect(res.status).toBe(201);
            expect(res.body.nodo.nodeId).toBe('n1');
        });

        it('rechaza que le manden una clave privada', async () => {
            const res = await request(app).post('/api/gateway/v1/nodes/register')
                .send({ registrationToken: 'b'.repeat(64),
                    publicKey: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----' });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('NODO_CLAVE_PRIVADA');
        });
    });

    describe('la página entrega, pero avisa', () => {
        it('dice que el valor no vuelve a mostrarse', async () => {
            const res = await request(app).get(`/o/${token()}`);
            expect(res.text).toMatch(/no vuelve a mostrarse/i);
        });

        it('no guarda el secreto en localStorage ni en la URL', async () => {
            // Si la pestaña se cierra, se ha perdido: es lo que se le advierte
            // al usuario y tiene que ser cierto.
            const res = await request(app).get(`/o/${token()}`);
            // Se busca USO, no la palabra: el propio código lleva un comentario
            // explicando que no se usa, y una comprobación por palabra suelta
            // fallaría por el comentario que documenta la decisión correcta.
            expect(res.text).not.toMatch(/(local|session)Storage\s*[.[]/);
            expect(res.text).not.toMatch(/location\.(hash|search)\s*=/);
        });
    });

    describe('login del flujo connect', () => {
        function sesionConnect(over = {}) {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 's1', kind: 'connect', status: 'pendiente', prefill: {},
                    user_id: null, intentos_login: 0,
                    expires_at: new Date(Date.now() + 600000), ...over }],
            });
        }

        it('credenciales malas dan 401 sin decir si el correo existe', async () => {
            sesionConnect();
            mockQuery.mockResolvedValueOnce({ rows: [] });                       // usuario no existe
            mockQuery.mockResolvedValueOnce({ rows: [{ intentos_login: 1 }] });  // suma intento

            const res = await request(app).post(`/api/gateway/v1/onboarding/${token()}/login`)
                .send({ email: 'quien@sea.com', password: 'x' });
            expect(res.status).toBe(401);
            expect(res.body.error).not.toMatch(/no existe|no encontrado|desconocid/i);
        });

        it('no cachea la respuesta ni devuelve un token', async () => {
            sesionConnect();
            mockQuery.mockResolvedValueOnce({ rows: [] });
            mockQuery.mockResolvedValueOnce({ rows: [{ intentos_login: 1 }] });
            const res = await request(app).post(`/api/gateway/v1/onboarding/${token()}/login`)
                .send({ email: 'a@b.com', password: 'x' });
            expect(JSON.stringify(res.body)).not.toMatch(/"token"|jwt|Bearer/i);
        });

        it('la contraseña no vuelve en la respuesta bajo ningún concepto', async () => {
            sesionConnect();
            mockQuery.mockResolvedValueOnce({ rows: [] });
            mockQuery.mockResolvedValueOnce({ rows: [{ intentos_login: 1 }] });
            const res = await request(app).post(`/api/gateway/v1/onboarding/${token()}/login`)
                .send({ email: 'a@b.com', password: 'secreta-del-cliente' });
            expect(JSON.stringify(res.body)).not.toContain('secreta-del-cliente');
        });

        it('un flujo que no es connect no acepta login', async () => {
            sesionConnect({ kind: 'sdk_install' });
            const res = await request(app).post(`/api/gateway/v1/onboarding/${token()}/login`)
                .send({ email: 'a@b.com', password: 'x' });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('LOGIN_TIPO_NO_APLICA');
        });
    });

    describe('la pantalla de connect', () => {
        it('trae el formulario de identificación y el selector de organización', async () => {
            const res = await request(app).get(`/o/${token()}`);
            expect(res.text).toContain('id="form-login"');
            expect(res.text).toContain('id="o-select"');
            expect(res.text).toContain('autocomplete="current-password"');
        });

        it('avisa de que la contraseña no se escribe en el chat', async () => {
            const res = await request(app).get(`/o/${token()}`);
            expect(res.text).toMatch(/Nunca la escribas en el chat/i);
        });

        it('borra la contraseña del formulario en cuanto deja de hacer falta', async () => {
            // No tiene por qué seguir en el DOM el resto de la sesión.
            const res = await request(app).get(`/o/${token()}`);
            expect(res.text).toMatch(/getElementById\('l-pass'\)\.value = ''/);
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
