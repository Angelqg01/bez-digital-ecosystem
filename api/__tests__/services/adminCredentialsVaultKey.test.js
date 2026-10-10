'use strict';

// La clave de cifrado del secreto TOTP no puede ser efímera: dos cargas del
// módulo (= dos reinicios o dos réplicas) deben cifrar/descifrar entre sí.
describe('adminCredentials — clave de cifrado estable', () => {
    const load = () => {
        jest.resetModules();
        jest.doMock('../../db/pool', () => ({ query: jest.fn() }));
        return require('../../services/adminCredentials');
    };

    afterEach(() => { delete process.env.VAULT_KEY; });

    test('sin VAULT_KEY deriva de JWT_SECRET y es la misma en cada carga', () => {
        process.env.JWT_SECRET = 'a'.repeat(48);
        delete process.env.VAULT_KEY;
        const a = load();
        const b = load();
        expect(a.VAULT_KEY_SOURCE).toBe('JWT_SECRET');
        expect(b.VAULT_KEY_SOURCE).toBe('JWT_SECRET');
    });

    test('VAULT_KEY hex de 64 caracteres tiene prioridad', () => {
        process.env.JWT_SECRET = 'a'.repeat(48);
        process.env.VAULT_KEY = 'ab'.repeat(32);
        expect(load().VAULT_KEY_SOURCE).toBe('VAULT_KEY');
    });
});
