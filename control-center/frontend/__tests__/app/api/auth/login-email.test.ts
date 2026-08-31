/**
 * @jest-environment node
 */
import jwt from 'jsonwebtoken';
import { POST } from '@/app/api/auth/login-email/route';
import { JWT_SECRET } from '@/lib/auth-secrets';

function post(body: unknown, raw?: string) {
    return POST(
        new Request('http://localhost/api/auth/login-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: raw ?? JSON.stringify(body),
        }),
    );
}

/**
 * Devuelve la cabecera Set-Cookie completa de una cookie concreta, en minúsculas:
 * los atributos (HttpOnly, SameSite, Max-Age) no tienen una capitalización fijada
 * por el estándar y comparar en minúsculas evita atarse a la del serializador.
 */
function setCookie(res: Response, name: string) {
    return res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`))?.toLowerCase();
}

describe('validación de entrada', () => {
    it.each([
        ['sin email', { password: 'demo1234' }],
        ['sin password', { email: 'demo@bez.digital' }],
        ['vacío', {}],
    ])('rechaza la petición %s con 400', async (_caso, body) => {
        const res = await post(body);

        expect(res.status).toBe(400);
        await expect(res.json()).resolves.toEqual({
            error: 'Email y contraseña son obligatorios.',
        });
    });

    it('devuelve 500 si el cuerpo no es JSON, sin filtrar la excepción', async () => {
        const silenced = jest.spyOn(console, 'error').mockImplementation(() => {});

        const res = await post(null, 'esto no es json');

        expect(res.status).toBe(500);
        await expect(res.json()).resolves.toEqual({ error: 'Error interno del servidor.' });

        silenced.mockRestore();
    });
});

describe('credenciales incorrectas', () => {
    it('devuelve 401 para un usuario que no existe', async () => {
        const res = await post({ email: 'nadie@bez.digital', password: 'demo1234' });

        expect(res.status).toBe(401);
        await expect(res.json()).resolves.toEqual({ error: 'Credenciales inválidas.' });
    });

    it('devuelve 401 con la contraseña equivocada', async () => {
        const res = await post({ email: 'demo@bez.digital', password: 'incorrecta' });

        expect(res.status).toBe(401);
    });

    it('no distingue entre usuario inexistente y contraseña mala', async () => {
        // Mensajes distintos permitirían enumerar qué emails tienen cuenta.
        const desconocido = await post({ email: 'nadie@bez.digital', password: 'x' });
        const claveMala = await post({ email: 'demo@bez.digital', password: 'x' });

        expect(await desconocido.json()).toEqual(await claveMala.json());
        expect(desconocido.status).toBe(claveMala.status);
    });

    it('no emite cookies en un intento fallido', async () => {
        const res = await post({ email: 'demo@bez.digital', password: 'incorrecta' });

        expect(res.headers.getSetCookie()).toHaveLength(0);
    });
});

describe('login correcto', () => {
    const credenciales = { email: 'demo@bez.digital', password: 'demo1234' };

    it('devuelve el usuario sin exponer el hash de la contraseña', async () => {
        const res = await post(credenciales);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.user).toEqual({
            id: 1,
            wallet_address: null,
            username: 'Demo Investor',
            email: 'demo@bez.digital',
            role: 'INVESTOR',
            avatar_url: null,
        });
        expect(JSON.stringify(body)).not.toContain('passwordHash');
    });

    it('firma un JWT verificable con el secreto compartido del ecosistema', async () => {
        const { token } = await (await post(credenciales)).json();

        const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;

        expect(payload).toMatchObject({
            userId: 1,
            email: 'demo@bez.digital',
            role: 'INVESTOR',
            iss: 'bezhas-control-center',
        });
    });

    it('el token dura las 24h del ecosistema, no un TTL propio', async () => {
        const { token } = await (await post(credenciales)).json();

        const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;

        expect(payload.exp! - payload.iat!).toBe(86400);
    });

    it('rechaza un token manipulado', async () => {
        const { token } = await (await post(credenciales)).json();
        const [header, payload] = token.split('.');

        expect(() => jwt.verify(`${header}.${payload}.firmafalsa`, JWT_SECRET)).toThrow();
    });

    it('acepta el email con mayúsculas y espacios', async () => {
        const res = await post({ email: '  DEMO@BEZ.DIGITAL  ', password: 'demo1234' });

        expect(res.status).toBe(200);
    });

    describe('cookies de sesión', () => {
        it('bezhas_auth es HttpOnly: el JS de la página no debe poder leerla', async () => {
            const res = await post(credenciales);

            expect(setCookie(res, 'bezhas_auth')).toContain('httponly');
        });

        it('bezhas_token es legible por el cliente a propósito', async () => {
            // El AuthProvider la reescribe en el navegador para el SSO entre Apps Nativas.
            const res = await post(credenciales);

            expect(setCookie(res, 'bezhas_token')).not.toContain('httponly');
        });

        it('ambas cookies caducan a la vez que el JWT', async () => {
            const res = await post(credenciales);

            expect(setCookie(res, 'bezhas_auth')).toContain('max-age=86400');
            expect(setCookie(res, 'bezhas_token')).toContain('max-age=86400');
        });

        it('ambas cookies son SameSite=Lax y de ámbito raíz', async () => {
            const res = await post(credenciales);

            for (const nombre of ['bezhas_auth', 'bezhas_token']) {
                expect(setCookie(res, nombre)).toContain('samesite=lax');
                expect(setCookie(res, nombre)).toContain('path=/');
            }
        });

        it('las dos cookies llevan el mismo token que el cuerpo', async () => {
            const res = await post(credenciales);
            const { token } = await res.json();

            expect(setCookie(res, 'bezhas_auth')).toContain(`bezhas_auth=${token.toLowerCase()}`);
            expect(setCookie(res, 'bezhas_token')).toContain(`bezhas_token=${token.toLowerCase()}`);
        });
    });
});
