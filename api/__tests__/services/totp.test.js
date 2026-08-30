const totp = require('../../services/totp');

describe('Service: TOTP (RFC 6238)', () => {
    // Secreto de referencia de la RFC: ASCII '12345678901234567890'.
    const SECRET = totp.base32Encode(Buffer.from('12345678901234567890', 'ascii'));

    it('reproduce los vectores oficiales SHA-1 de la RFC 6238', () => {
        const vectors = [
            [59, '287082'],
            [1111111109, '081804'],
            [1111111111, '050471'],
            [1234567890, '005924'],
            [2000000000, '279037'],
            [20000000000, '353130'],
        ];
        for (const [seconds, expected] of vectors) {
            expect(totp.totp(SECRET, seconds)).toBe(expected);
        }
    });

    it('genera secretos base32 de 160 bits', () => {
        const secret = totp.generateSecret();
        expect(secret).toMatch(/^[A-Z2-7]+$/);
        expect(totp.base32Decode(secret)).toHaveLength(20);
    });

    it('acepta el código del periodo actual', () => {
        const secret = totp.generateSecret();
        expect(totp.verify(secret, totp.totp(secret))).toBe(true);
    });

    it('tolera ±1 periodo de desfase de reloj', () => {
        const secret = totp.generateSecret();
        const now = 1_700_000_000;
        expect(totp.verify(secret, totp.totp(secret, now - 30), { atSeconds: now })).toBe(true);
        expect(totp.verify(secret, totp.totp(secret, now + 30), { atSeconds: now })).toBe(true);
    });

    it('rechaza un código dos periodos atrás', () => {
        const secret = totp.generateSecret();
        const now = 1_700_000_000;
        expect(totp.verify(secret, totp.totp(secret, now - 90), { atSeconds: now })).toBe(false);
    });

    it('rechaza formatos que no son 6 dígitos sin reventar', () => {
        const secret = totp.generateSecret();
        // timingSafeEqual lanza si los buffers miden distinto: si estas
        // entradas llegasen a la comparación, tumbarían la petición en vez de
        // devolver "código inválido".
        for (const bad of ['', '12345', '1234567', 'abcdef', null, undefined, {}, '12 34 56']) {
            expect(totp.verify(secret, bad)).toBe(false);
        }
    });

    it('produce un otpauth:// que las apps de autenticación entienden', () => {
        const secret = totp.generateSecret();
        const url = totp.otpauthUrl({ secret, account: 'YoelAdmin' });
        expect(url).toMatch(/^otpauth:\/\/totp\/BeZhas%3AYoelAdmin\?/);
        const params = new URL(url).searchParams;
        expect(params.get('secret')).toBe(secret);
        expect(params.get('algorithm')).toBe('SHA1');
        expect(params.get('digits')).toBe('6');
        expect(params.get('period')).toBe('30');
    });

    it('base32 hace ida y vuelta con bytes arbitrarios', () => {
        for (const len of [1, 2, 5, 10, 20, 32]) {
            const buf = require('crypto').randomBytes(len);
            expect(totp.base32Decode(totp.base32Encode(buf))).toEqual(buf);
        }
    });
});
