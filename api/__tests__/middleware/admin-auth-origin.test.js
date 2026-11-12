/**
 * La sesión del panel viaja en una cookie: una web ajena no debe poder lanzar
 * operaciones con ella. Ver middleware/admin-auth.js (origenAjeno).
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-para-admin-auth-origin';

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../config/secrets');
const { requireSuperAdmin, ADMIN_COOKIE, ADMIN_ISSUER } = require('../../middleware/admin-auth');

const token = jwt.sign({ role: 'SUPER_ADMIN' }, JWT_SECRET, { issuer: ADMIN_ISSUER, expiresIn: '5m' });

function llamar({ method = 'POST', origin, cookie = true, bearer = false } = {}) {
    const req = {
        method,
        headers: { ...(origin ? { origin } : {}), ...(bearer ? { authorization: `Bearer ${token}` } : {}) },
        cookies: cookie ? { [ADMIN_COOKIE]: token } : {},
    };
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
    let paso = false;
    requireSuperAdmin(req, res, () => { paso = true; });
    return { paso, status: res.statusCode, code: res.body && res.body.code };
}

describe('requireSuperAdmin: origen de las peticiones con cookie', () => {
    test('POST con cookie desde un origen ajeno: 403', () => {
        expect(llamar({ origin: 'https://sitio-malicioso.example' })).toMatchObject({ paso: false, status: 403, code: 'ADMIN_ORIGIN_REJECTED' });
    });

    test('un dominio que sólo contiene bezhas.com no cuenta como propio', () => {
        expect(llamar({ origin: 'https://bezhas.com.atacante.example' }).status).toBe(403);
        expect(llamar({ origin: 'http://www.bezhas.com' }).status).toBe(403);
    });

    test('POST con cookie desde el panel o una SubApp propia: pasa', () => {
        expect(llamar({ origin: 'https://www.bezhas.com' }).paso).toBe(true);
        expect(llamar({ origin: 'https://hub.bezhas.com' }).paso).toBe(true);
    });

    test('sin cabecera Origin (curl, scripts): pasa', () => {
        expect(llamar({}).paso).toBe(true);
    });

    test('las lecturas no se bloquean por origen', () => {
        expect(llamar({ method: 'GET', origin: 'https://sitio-malicioso.example' }).paso).toBe(true);
    });

    test('con Authorization y sin cookie no hay CSRF posible: pasa', () => {
        expect(llamar({ origin: 'https://herramienta-interna.example', cookie: false, bearer: true }).paso).toBe(true);
    });

    test('un origen ajeno sin sesión sigue siendo 401, no 403', () => {
        expect(llamar({ origin: 'https://sitio-malicioso.example', cookie: false })).toMatchObject({ paso: false, status: 401 });
    });
});
