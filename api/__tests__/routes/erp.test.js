const dns = require('dns');
const request = require('supertest');
const { mockQuery } = require('../helpers');
const app = require('../../index');

function conApp(scopes = ['contracts', 'wallet']) {
    mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'app-1', app_name: 'cliente', scopes, is_active: true, address_access_mode: 'strict' }],
    });
}

describe('Rutas ERP (/api/erp)', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
        jest.spyOn(dns.promises, 'lookup').mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    });
    afterEach(() => jest.restoreAllMocks());

    describe('autenticación', () => {
        it('sin api-key devuelve 401', async () => {
            expect((await request(app).get('/api/erp/catalogo')).status).toBe(401);
        });

        it('sin el scope necesario devuelve 403', async () => {
            conApp(['token']);
            expect((await request(app).get('/api/erp/catalogo').set('x-api-key', 'k')).status).toBe(403);
        });
    });

    describe('catálogo', () => {
        it('lista los ERPs y qué credenciales pide cada uno, sin valores', async () => {
            conApp();
            const res = await request(app).get('/api/erp/catalogo').set('x-api-key', 'k');
            expect(res.status).toBe(200);
            expect(res.body.erps.map((e) => e.id)).toEqual(
                ['sap_s4hana', 'sap_b1', 'odoo', 'dynamics', 'netsuite']
            );
            expect(res.body.tiposDocumento).toHaveLength(5);
        });
    });

    describe('alta de conexión', () => {
        it('rechaza una URL apuntada a la red interna', async () => {
            // Es SSRF: la URL la elige el cliente y la petición la hace nuestro
            // servidor.
            conApp();
            dns.promises.lookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
            const res = await request(app).post('/api/erp/connections').set('x-api-key', 'k')
                .send({ erp: 'odoo', nombre: 'x', baseUrl: 'https://interno.example.com',
                    credenciales: { baseDatos: 'db', usuario: 'u', password: 'p' } });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('ERP_DESTINO_INTERNO');
        });

        it('rechaza apuntar al Postgres de la propia plataforma', async () => {
            conApp();
            const res = await request(app).post('/api/erp/connections').set('x-api-key', 'k')
                .send({ erp: 'odoo', nombre: 'x', baseUrl: 'https://erp.example.com:5432',
                    credenciales: { baseDatos: 'db', usuario: 'u', password: 'p' } });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('ERP_PUERTO_NO_ADMITIDO');
        });

        it('rechaza HTTP', async () => {
            conApp();
            const res = await request(app).post('/api/erp/connections').set('x-api-key', 'k')
                .send({ erp: 'odoo', nombre: 'x', baseUrl: 'http://erp.example.com',
                    credenciales: { baseDatos: 'db', usuario: 'u', password: 'p' } });
            expect(res.body.code).toBe('ERP_URL_NO_HTTPS');
        });

        it('exige erp, nombre y baseUrl', async () => {
            conApp();
            const res = await request(app).post('/api/erp/connections').set('x-api-key', 'k').send({ erp: 'odoo' });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('ERP_ALTA_INCOMPLETA');
        });
    });

    describe('escritura', () => {
        it('sin Idempotency-Key se rechaza antes de tocar el ERP', async () => {
            conApp();
            const res = await request(app)
                .post('/api/erp/connections/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/documents/factura')
                .set('x-api-key', 'k')
                .send({ documento: { numero: 'F-1', importe: 10, moneda: 'EUR' } });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('ERP_SIN_IDEMPOTENCIA');
            // Ni siquiera se ha consultado la conexión.
            expect(mockQuery.mock.calls.filter((c) => /erp_connections/i.test(String(c[0])))).toHaveLength(0);
        });
    });

    describe('superficie', () => {
        it('ninguna ruta acepta una URL, ruta o consulta como parámetro', async () => {
            // El destino y el conjunto de documentos posibles se deciden en el
            // repositorio, no en una petición.
            conApp();
            const res = await request(app)
                .get('/api/erp/connections/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/documents/factura')
                .query({ path: '/etc/passwd', sql: 'SELECT 1', url: 'http://169.254.169.254' })
                .set('x-api-key', 'k');
            // Los parámetros desconocidos se ignoran por no estar en la lista:
            // lo que llega al adaptador es sólo el filtro cerrado.
            expect([404, 409, 502]).toContain(res.status);
            const texto = JSON.stringify(res.body);
            expect(texto).not.toContain('169.254.169.254');
            expect(texto).not.toContain('etc/passwd');
        });
    });
});
