/**
 * @jest-environment node
 */
import jwt from 'jsonwebtoken';
import { verifyMessage } from 'viem';
import { POST } from '@/app/api/auth/verify/route';
import { JWT_SECRET } from '@/lib/auth-secrets';

// La criptografía de la firma es de viem y ya está probada aguas arriba. Lo que
// aquí importa es qué hace la ruta con su veredicto.
jest.mock('viem', () => ({ verifyMessage: jest.fn() }));

const verifyMessageMock = verifyMessage as jest.Mock;

const WALLET = '0x52Df82920CBAE522880dD7657e43d1A754eD044E';
const ADMIN = '0x89c23890c742d710265dD61be789C71dC8999b12';

function post(body: unknown) {
    return POST(
        new Request('http://localhost/api/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }),
    );
}

const firmaDe = (address = WALLET) => ({
    address,
    message: 'Inicia sesión en BeZhas',
    signature: '0xfirma',
});

let adminGuardado: string | undefined;

beforeEach(() => {
    verifyMessageMock.mockReset();
    adminGuardado = process.env.NEXT_PUBLIC_ADMIN_WALLET;
    delete process.env.NEXT_PUBLIC_ADMIN_WALLET;
});

afterEach(() => {
    if (adminGuardado === undefined) delete process.env.NEXT_PUBLIC_ADMIN_WALLET;
    else process.env.NEXT_PUBLIC_ADMIN_WALLET = adminGuardado;
});

describe('firma inválida', () => {
    it('devuelve 401 sin emitir token', async () => {
        verifyMessageMock.mockResolvedValue(false);

        const res = await post(firmaDe());

        expect(res.status).toBe(401);
        await expect(res.json()).resolves.toEqual({ error: 'Firma inválida' });
        expect(res.headers.getSetCookie()).toHaveLength(0);
    });

    it('devuelve 500 si la verificación revienta, sin dar por buena la firma', async () => {
        verifyMessageMock.mockRejectedValue(new Error('address malformada'));

        const res = await post(firmaDe('no-es-una-address'));

        expect(res.status).toBe(500);
        expect(res.headers.getSetCookie()).toHaveLength(0);
    });
});

describe('firma válida', () => {
    beforeEach(() => verifyMessageMock.mockResolvedValue(true));

    it('comprueba la firma contra el mensaje y la address recibidos', async () => {
        await post(firmaDe());

        expect(verifyMessageMock).toHaveBeenCalledWith({
            address: WALLET,
            message: 'Inicia sesión en BeZhas',
            signature: '0xfirma',
        });
    });

    it('asigna RETAIL a una wallet cualquiera', async () => {
        const res = await post(firmaDe());
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.role).toBe('RETAIL');
        expect(body.user).toMatchObject({ wallet_address: WALLET, role: 'RETAIL' });
    });

    it('asigna ADMIN a la wallet configurada', async () => {
        process.env.NEXT_PUBLIC_ADMIN_WALLET = ADMIN;

        const body = await (await post(firmaDe(ADMIN))).json();

        expect(body.role).toBe('ADMIN');
    });

    it('compara la wallet de admin sin distinguir mayúsculas', async () => {
        // Las direcciones EVM circulan en checksum y en minúsculas indistintamente;
        // comparar en crudo dejaría al admin fuera según de dónde venga la cadena.
        process.env.NEXT_PUBLIC_ADMIN_WALLET = ADMIN.toLowerCase();

        const body = await (await post(firmaDe(ADMIN.toUpperCase()))).json();

        expect(body.role).toBe('ADMIN');
    });

    it('no reparte ADMIN cuando no hay wallet de admin configurada', async () => {
        const body = await (await post(firmaDe(ADMIN))).json();

        expect(body.role).toBe('RETAIL');
    });

    it('abrevia la wallet como nombre de usuario', async () => {
        const body = await (await post(firmaDe())).json();

        expect(body.user.username).toBe('0x52Df...044E');
    });

    it('firma un JWT con la address y el rol', async () => {
        const { token } = await (await post(firmaDe())).json();

        const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;

        expect(payload).toMatchObject({
            address: WALLET,
            role: 'RETAIL',
            iss: 'bezhas-control-center',
        });
    });

    /**
     * Regresión de 8d47f06: esta ruta emitía tokens de 1h mientras el login por email
     * los emitía de 24h, así que la sesión duraba una cosa u otra según por dónde
     * hubieras entrado. Ahora las dos leen JWT_ACCESS_TTL.
     */
    it('emite el mismo TTL de 24h que el login por email', async () => {
        const { token } = await (await post(firmaDe())).json();

        const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;

        expect(payload.exp! - payload.iat!).toBe(86400);
    });

    it('entrega el token en cookie HttpOnly y en la legible por el cliente', async () => {
        const res = await post(firmaDe());
        const cookies = res.headers.getSetCookie().map((c) => c.toLowerCase());

        const auth = cookies.find((c) => c.startsWith('bezhas_auth='));
        const legible = cookies.find((c) => c.startsWith('bezhas_token='));

        expect(auth).toContain('httponly');
        expect(auth).toContain('max-age=86400');
        expect(legible).not.toContain('httponly');
    });
});
