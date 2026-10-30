import { describe, it, expect } from 'vitest';
import { scanSecrets, redactSecrets, describeFindings } from './dlp';

const types = (t) => scanSecrets(t).map((h) => h.type);

describe('DLP del chat', () => {
    it('detecta un IBAN válido, con o sin espacios', () => {
        expect(types('mi cuenta es ES91 2100 0418 4502 0005 1332 gracias')).toEqual(['iban']);
        expect(types('ES9121000418450200051332')).toEqual(['iban']);
    });

    it('no confunde con un IBAN un código que no pasa el dígito de control', () => {
        expect(types('ES00 2100 0418 4502 0005 1332')).toEqual([]);
        expect(types('referencia AB12 3456 7890')).toEqual([]);
    });

    it('detecta tarjetas por Luhn y deja pasar números cualquiera', () => {
        expect(types('4111 1111 1111 1111')).toEqual(['card']);
        expect(types('4111 1111 1111 1112')).toEqual([]);
        expect(types('facturamos 1234567890123 al año')).toEqual([]);
    });

    it('detecta JWT, Bearer y claves de API', () => {
        const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcDEFghiJKLmnoPQR';
        expect(types(`mi token ${jwt}`)).toEqual(['jwt']);
        expect(types('Authorization: Bearer abcdefghijklmnop1234567890')).toEqual(['bearer']);
        expect(types('sk_live_' + 'a'.repeat(24))).toEqual(['api_key']);
        expect(types('AIza' + 'b'.repeat(35))).toEqual(['api_key']);
    });

    it('detecta claves privadas pero no direcciones de wallet', () => {
        expect(types('0x' + 'ab'.repeat(32))).toEqual(['private_key']);
        expect(types('mi wallet es 0x' + 'ab'.repeat(20))).toEqual([]);
        expect(types('-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----')).toEqual(['private_key']);
    });

    it('detecta una frase semilla y no una frase normal de 12 palabras', () => {
        const seed = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
        expect(types(seed)).toEqual(['seed']);
        expect(types('Somos una empresa de logística que quiere conectar su ERP con BeZhas hoy')).toEqual([]);
    });

    it('detecta «contraseña: …»', () => {
        expect(types('mi contraseña es Hunter2!')).toEqual(['password']);
        expect(types('password: hunter2')).toEqual(['password']);
        expect(types('quiero cambiar mi contraseña')).toEqual([]);
    });

    it('redacta sin conservar el valor y mantiene el resto del texto', () => {
        const out = redactSecrets('Hola, mi IBAN es ES91 2100 0418 4502 0005 1332 y mi sector es logística');
        expect(out).toBe('Hola, mi IBAN es [IBAN retirado] y mi sector es logística');
        expect(out).not.toMatch(/2100/);
    });

    it('un texto limpio no cambia', () => {
        const t = 'Somos 40 personas en Algeciras y usamos SAP Business One';
        expect(scanSecrets(t)).toEqual([]);
        expect(redactSecrets(t)).toBe(t);
    });

    it('describe los hallazgos en una frase', () => {
        const f = scanSecrets('ES9121000418450200051332 y 4111 1111 1111 1111');
        expect(describeFindings(f)).toBe('IBAN y número de tarjeta');
    });
});
