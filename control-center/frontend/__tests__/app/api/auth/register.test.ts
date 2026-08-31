/**
 * @jest-environment node
 */
import jwt from 'jsonwebtoken';
import { POST as register } from '@/app/api/auth/register/route';
import { POST as loginEmail } from '@/app/api/auth/login-email/route';
import { JWT_SECRET } from '@/lib/auth-secrets';

function call(handler: (req: Request) => Promise<Response>, url: string, body: unknown) {
    return handler(
        new Request(`http://localhost${url}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }),
    );
}

const alta = (body: unknown) => call(register, '/api/auth/register', body);
const login = (body: unknown) => call(loginEmail, '/api/auth/login-email', body);

/** El almacén es en memoria y compartido por el fichero: cada test necesita su email. */
let contador = 0;
const emailNuevo = () => `alta${contador++}.${Date.now()}@bez.digital`;

describe('validación', () => {
    it.each([
        ['sin username', { email: 'a@bez.digital', password: 'clave-buena' }],
        ['sin email', { username: 'ana', password: 'clave-buena' }],
        ['sin password', { username: 'ana', email: 'a@bez.digital' }],
    ])('rechaza el alta %s', async (_caso, body) => {
        const res = await alta(body);

        expect(res.status).toBe(400);
        await expect(res.json()).resolves.toEqual({
            error: 'Todos los campos son obligatorios.',
        });
    });

    it('exige al menos 6 caracteres de contraseña', async () => {
        const res = await alta({ username: 'ana', email: emailNuevo(), password: '12345' });

        expect(res.status).toBe(400);
        await expect(res.json()).resolves.toEqual({
            error: 'La contraseña debe tener al menos 6 caracteres.',
        });
    });

    it('acepta exactamente 6 caracteres', async () => {
        const res = await alta({ username: 'ana', email: emailNuevo(), password: '123456' });

        expect(res.status).toBe(200);
    });

    it.each(['sin-arroba', 'sin@dominio', '@bez.digital', 'con espacio@bez.digital'])(
        'rechaza el email inválido %p',
        async (email) => {
            const res = await alta({ username: 'ana', email, password: 'clave-buena' });

            expect(res.status).toBe(400);
            await expect(res.json()).resolves.toEqual({ error: 'El email no es válido.' });
        },
    );

    it('devuelve 409 si el email ya está dado de alta', async () => {
        const email = emailNuevo();
        await alta({ username: 'ana', email, password: 'clave-buena' });

        const repetido = await alta({ username: 'otra', email, password: 'otra-clave' });

        expect(repetido.status).toBe(409);
        await expect(repetido.json()).resolves.toEqual({
            error: 'Ya existe una cuenta con este email.',
        });
    });

    it('trata el email duplicado sin distinguir mayúsculas', async () => {
        const email = emailNuevo();
        await alta({ username: 'ana', email, password: 'clave-buena' });

        const repetido = await alta({
            username: 'otra',
            email: email.toUpperCase(),
            password: 'otra-clave',
        });

        expect(repetido.status).toBe(409);
    });

    it('devuelve 500 si el cuerpo no es JSON', async () => {
        const silenced = jest.spyOn(console, 'error').mockImplementation(() => {});

        const res = await register(
            new Request('http://localhost/api/auth/register', {
                method: 'POST',
                body: 'no soy json',
            }),
        );

        expect(res.status).toBe(500);
        silenced.mockRestore();
    });
});

describe('alta correcta', () => {
    it('crea al usuario con rol RETAIL y no devuelve el hash', async () => {
        const email = emailNuevo();

        const res = await alta({ username: '  Ana  ', email, password: 'clave-buena' });
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.user).toMatchObject({
            username: 'Ana',
            email,
            role: 'RETAIL',
            wallet_address: null,
        });
        expect(JSON.stringify(body)).not.toContain('passwordHash');
    });

    it('firma un JWT válido de 24h con el mismo emisor que el login', async () => {
        const email = emailNuevo();

        const { token } = await (await alta({ username: 'ana', email, password: 'clave-buena' })).json();
        const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;

        expect(payload).toMatchObject({ email, role: 'RETAIL', iss: 'bezhas-control-center' });
        expect(payload.exp! - payload.iat!).toBe(86400);
    });

    it('deja la sesión iniciada con las dos cookies', async () => {
        const res = await alta({ username: 'ana', email: emailNuevo(), password: 'clave-buena' });

        const nombres = res.headers.getSetCookie().map((c) => c.split('=')[0]);
        expect(nombres).toEqual(expect.arrayContaining(['bezhas_auth', 'bezhas_token']));
    });
});

/**
 * Alta y login comparten el almacén en memoria. Si se separan (por ejemplo al migrar
 * a Postgres sólo uno de los dos), registrarse dejaría de servir para entrar.
 */
describe('alta y login encajan', () => {
    it('el usuario recién creado puede iniciar sesión', async () => {
        const email = emailNuevo();
        await alta({ username: 'ana', email, password: 'clave-buena' });

        const res = await login({ email, password: 'clave-buena' });

        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toMatchObject({
            success: true,
            user: { email, role: 'RETAIL' },
        });
    });

    it('el usuario recién creado no entra con otra contraseña', async () => {
        const email = emailNuevo();
        await alta({ username: 'ana', email, password: 'clave-buena' });

        const res = await login({ email, password: 'clave-equivocada' });

        expect(res.status).toBe(401);
    });
});
