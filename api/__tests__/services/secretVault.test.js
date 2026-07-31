'use strict';

/**
 * secretVault — cifrado de credenciales de terceros (API keys de POS/ERP).
 * Sin BD ni red: cripto puro.
 */
process.env.SECRET_VAULT_KEY = 'test-vault-key-for-unit-tests';

const { encryptSecret, decryptSecret, isEncrypted, maskSecret } = require('../../services/secretVault');

describe('secretVault', () => {
    const SECRET = 'sk_live_pos_9f2b7c41e8';

    test('cifra y descifra con ida y vuelta exacta', () => {
        const enc = encryptSecret(SECRET);
        expect(enc).not.toBe(SECRET);
        expect(enc).not.toContain(SECRET);
        expect(decryptSecret(enc)).toBe(SECRET);
    });

    test('el texto cifrado lleva versión y es reconocible', () => {
        const enc = encryptSecret(SECRET);
        expect(enc.startsWith('v1:')).toBe(true);
        expect(enc.split(':')).toHaveLength(4);
        expect(isEncrypted(enc)).toBe(true);
        expect(isEncrypted(SECRET)).toBe(false);
    });

    test('cada cifrado usa un IV distinto (no determinista)', () => {
        expect(encryptSecret(SECRET)).not.toBe(encryptSecret(SECRET));
    });

    test('es idempotente: no re-cifra un valor ya cifrado', () => {
        const once = encryptSecret(SECRET);
        expect(encryptSecret(once)).toBe(once);
        expect(decryptSecret(encryptSecret(once))).toBe(SECRET);
    });

    test('compatibilidad hacia atrás: un secreto en claro se devuelve tal cual', () => {
        expect(decryptSecret(SECRET)).toBe(SECRET);
    });

    test('respeta los valores vacíos (campo opcional)', () => {
        for (const v of [null, undefined, '']) {
            expect(encryptSecret(v)).toBe(v);
            expect(decryptSecret(v)).toBe(v);
        }
    });

    test('detecta manipulación del texto cifrado (GCM autenticado)', () => {
        const [v, iv, tag, ct] = encryptSecret(SECRET).split(':');
        const tampered = [v, iv, tag, Buffer.from('otro-valor').toString('base64url')].join(':');
        expect(() => decryptSecret(tampered)).toThrow();
    });

    test('no descifra con otra clave de vault', () => {
        const enc = encryptSecret(SECRET);
        const prev = process.env.SECRET_VAULT_KEY;
        process.env.SECRET_VAULT_KEY = 'clave-distinta';
        jest.resetModules();
        const other = require('../../services/secretVault');
        expect(() => other.decryptSecret(enc)).toThrow();
        process.env.SECRET_VAULT_KEY = prev;
        jest.resetModules();
    });

    test('maskSecret nunca revela el valor completo', () => {
        expect(maskSecret(SECRET)).toBe('sk_l…41e8');
        expect(maskSecret('corto')).toBe('****');
        expect(maskSecret(null)).toBeNull();
    });
});
