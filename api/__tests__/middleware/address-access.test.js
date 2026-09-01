const jwt = require('jsonwebtoken');
const request = require('supertest');
const { mockQuery } = require('../helpers');
const app = require('../../index');
const { _resetCache } = require('../../middleware/address-access');

const JWT_SECRET = process.env.JWT_SECRET;
const AJENA  = '0x' + 'a'.repeat(40);
const PROPIA = '0x' + 'b'.repeat(40);

/** app_registry devuelve la clave cuando authenticateApp consulta por el hash. */
function conClave({ scopes = ['wallet'], enterprise_id = null, authorized_addresses = [], mode = 'strict' } = {}) {
    mockQuery.mockResolvedValueOnce({
        rows: [{
            id: 'app-1', app_name: 'cliente', scopes, tier: 'standard', is_active: true,
            enterprise_id, authorized_addresses, address_access_mode: mode,
        }],
    });
}
const tokenDe = (address) => jwt.sign({ address, userId: 1, role: 'user' }, JWT_SECRET, { expiresIn: '5m' });

/**
 * Siete rutas del Gateway aceptaban una dirección por la URL y devolvían sus
 * datos sin comprobar de quién era. Con scope `wallet` y una dirección —pública
 * en cadena— se leían los pagos y el KYC de cualquier otro cliente.
 */
describe('Titularidad de dirección en el Gateway', () => {
    beforeEach(() => { jest.clearAllMocks(); _resetCache(); });

    const RUTAS = [
        ['/api/gateway/v1/payments/history/', 'wallet'],
        ['/api/gateway/v1/kyc/status/', 'wallet'],
        ['/api/gateway/v1/wallet/history/', 'wallet'],
        ['/api/gateway/v1/wallet/balance/', 'wallet'],
        ['/api/gateway/v1/bridge/transfers/', 'bridge'],
        ['/api/gateway/v1/staking/positions/', 'staking'],
        ['/api/gateway/v1/farming/positions/', 'farming'],
    ];

    describe('el ataque original queda cerrado', () => {
        it.each(RUTAS)('%s bloquea una dirección ajena', async (ruta, scope) => {
            conClave({ scopes: [scope] });
            const res = await request(app).get(ruta + AJENA).set('x-api-key', 'k');
            expect(res.status).toBe(403);
            expect(res.body.code).toBe('ADDRESS_ACCESS_DENIED');
        });

        it('deniega con 403, no con lista vacía ni 404', async () => {
            // Un 404 o una lista vacía serían indistinguibles de «esa dirección
            // no tiene datos», y eso permite enumerar direcciones con actividad.
            conClave();
            const res = await request(app).get('/api/gateway/v1/payments/history/' + AJENA).set('x-api-key', 'k');
            expect(res.status).toBe(403);
            expect(res.body.payments).toBeUndefined();
        });
    });

    describe('las vías legítimas siguen abiertas', () => {
        it('el usuario final consulta lo suyo con su JWT', async () => {
            conClave();
            const res = await request(app).get('/api/gateway/v1/payments/history/' + AJENA)
                .set('x-api-key', 'k').set('Authorization', `Bearer ${tokenDe(AJENA)}`);
            expect(res.status).not.toBe(403);
        });

        it('pero con su JWT no puede pedir la de otro', async () => {
            conClave();
            const res = await request(app).get('/api/gateway/v1/payments/history/' + PROPIA)
                .set('x-api-key', 'k').set('Authorization', `Bearer ${tokenDe(AJENA)}`);
            expect(res.status).toBe(403);
        });

        it('la lista explícita de la clave vale', async () => {
            conClave({ authorized_addresses: [PROPIA] });
            const res = await request(app).get('/api/gateway/v1/payments/history/' + PROPIA).set('x-api-key', 'k');
            expect(res.status).not.toBe(403);
        });

        it('las direcciones de la empresa titular valen', async () => {
            conClave({ enterprise_id: 'ent-1' });
            mockQuery.mockResolvedValueOnce({ rows: [{ addr: PROPIA.toLowerCase() }] });
            const res = await request(app).get('/api/gateway/v1/payments/history/' + PROPIA).set('x-api-key', 'k');
            expect(res.status).not.toBe(403);
        });

        it('una clave interna con scope admin pasa', async () => {
            conClave({ scopes: ['admin'] });
            const res = await request(app).get('/api/gateway/v1/payments/history/' + AJENA).set('x-api-key', 'k');
            expect(res.status).not.toBe(403);
        });

        it('la comparación no distingue mayúsculas', async () => {
            conClave({ authorized_addresses: [PROPIA.toUpperCase()] });
            const res = await request(app).get('/api/gateway/v1/payments/history/' + PROPIA.toLowerCase()).set('x-api-key', 'k');
            expect(res.status).not.toBe(403);
        });
    });

    describe('falla cerrado', () => {
        it('si la consulta de pertenencia revienta, deniega', async () => {
            // Un fallo al resolver la titularidad no puede convertirse en permiso.
            conClave({ enterprise_id: 'ent-1' });
            mockQuery.mockRejectedValueOnce(new Error('db caída'));
            const res = await request(app).get('/api/gateway/v1/payments/history/' + PROPIA).set('x-api-key', 'k');
            expect(res.status).toBe(403);
        });

        it('sin la columna del modo (base sin migrar) asume strict', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'a', app_name: 'x', scopes: ['wallet'], tier: 'standard', is_active: true }],
            });
            mockQuery.mockResolvedValueOnce({ rows: [] });
            const res = await request(app).get('/api/gateway/v1/payments/history/' + AJENA).set('x-api-key', 'k');
            expect(res.status).toBe(403);
        });

        it('el modo legacy deja pasar, para desatascar una integración concreta', async () => {
            conClave({ mode: 'legacy' });
            const res = await request(app).get('/api/gateway/v1/payments/history/' + AJENA).set('x-api-key', 'k');
            expect(res.status).not.toBe(403);
        });
    });
});
