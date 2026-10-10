/**
 * Un fallo de la base de datos dentro de un middleware de seguridad no puede tumbar el proceso: en producción un
 * `unhandledRejection` hace `process.exit(1)` (index.js), y Express 4 no captura los rechazos de funciones async.
 */
const mockQuery = jest.fn();
jest.mock('../../db/pool', () => ({ query: (...a) => mockQuery(...a) }));
jest.mock('../../cache/redis', () => ({ checkRateLimit: jest.fn().mockRejectedValue(new Error('redis caído')) }));

const { requireRole, requireOrgRole, enterpriseRateLimit, asyncSeguro } = require('../../middleware/security');

const res = () => { const r = { headersSent: false }; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
const espera = () => new Promise((r) => setImmediate(r));

describe('middleware de seguridad async', () => {
    let rechazos;
    const alRechazar = (e) => rechazos.push(e);
    beforeEach(() => { rechazos = []; mockQuery.mockReset(); process.on('unhandledRejection', alRechazar); });
    afterEach(() => process.off('unhandledRejection', alRechazar));

    it('requireOrgRole: si la consulta falla responde 503 y NO deja un unhandledRejection', async () => {
        mockQuery.mockRejectedValue(new Error('Connection terminated due to connection timeout'));
        const r = res(); const next = jest.fn();
        requireOrgRole('owner')({ user: { userId: 'u', role: 'user' }, params: { orgId: 'o' }, originalUrl: '/api/organizations/o' }, r, next);
        await espera(); await espera();
        expect(r.status).toHaveBeenCalledWith(503);
        expect(r.json.mock.calls[0][0].code).toBe('DEPENDENCY_UNAVAILABLE');
        expect(next).not.toHaveBeenCalled();
        expect(rechazos).toEqual([]);
    });

    it('requireRole: igual con el fallo de la base de datos', async () => {
        mockQuery.mockRejectedValue(new Error('db caída'));
        const r = res();
        requireRole('admin')({ user: { userId: 'u', address: '0xabc' }, originalUrl: '/api/x' }, r, jest.fn());
        await espera(); await espera();
        expect(r.status).toHaveBeenCalledWith(503);
        expect(rechazos).toEqual([]);
    });

    it('enterpriseRateLimit: Redis caído tampoco tumba el proceso', async () => {
        const r = res();
        enterpriseRateLimit(10, 60)({ user: { address: '0x1' }, ip: '1.1.1.1', originalUrl: '/api/x' }, r, jest.fn());
        await espera(); await espera();
        expect(r.status).toHaveBeenCalledWith(503);
        expect(rechazos).toEqual([]);
    });

    it('el caso normal no cambia: un miembro con rol permitido pasa a next()', async () => {
        mockQuery.mockResolvedValue({ rows: [{ role: 'owner' }] });
        const r = res(); const next = jest.fn(); const req = { user: { userId: 'u', role: 'user' }, params: { orgId: 'o' } };
        requireOrgRole('owner', 'admin')(req, r, next);
        await espera(); await espera();
        expect(next).toHaveBeenCalledTimes(1);
        expect(req.orgRole).toBe('owner');
    });

    it('no responde dos veces si la respuesta ya salió', async () => {
        const r = res(); r.headersSent = true;
        asyncSeguro(async () => { throw new Error('tarde'); })({ originalUrl: '/x' }, r, jest.fn());
        await espera(); await espera();
        expect(r.status).not.toHaveBeenCalled();
    });
});
