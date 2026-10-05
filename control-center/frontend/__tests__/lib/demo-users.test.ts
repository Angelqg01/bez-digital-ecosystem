/**
 * @jest-environment node
 */
import {
    createUser,
    findUserByEmail,
    hashPassword,
    userExists,
    verifyPassword,
} from '@/lib/demo-users';

describe('hashPassword', () => {
    it('devuelve el formato "salt:hash" con longitudes de scrypt', () => {
        const [salt, hash] = hashPassword('contraseña-larga').split(':');

        expect(salt).toMatch(/^[0-9a-f]{32}$/);
        expect(hash).toMatch(/^[0-9a-f]{128}$/);
    });

    it('usa un salt distinto en cada llamada', () => {
        // Sin esto, dos usuarios con la misma contraseña tendrían el mismo hash y
        // una tabla filtrada delataría de golpe quién comparte contraseña.
        expect(hashPassword('misma')).not.toBe(hashPassword('misma'));
    });
});

describe('verifyPassword', () => {
    it('acepta la contraseña correcta', () => {
        expect(verifyPassword('correcta', hashPassword('correcta'))).toBe(true);
    });

    it('rechaza una contraseña incorrecta', () => {
        expect(verifyPassword('incorrecta', hashPassword('correcta'))).toBe(false);
    });

    it('distingue mayúsculas y minúsculas', () => {
        expect(verifyPassword('Correcta', hashPassword('correcta'))).toBe(false);
    });

    it('rechaza la cadena vacía frente a una contraseña real', () => {
        expect(verifyPassword('', hashPassword('correcta'))).toBe(false);
    });
});

describe('almacén de usuarios', () => {
    it('trae la cuenta demo preconfigurada', () => {
        const demo = findUserByEmail('demo@bezhas.com');

        expect(demo).toBeDefined();
        expect(demo?.role).toBe('INVESTOR');
        expect(verifyPassword('demo1234', demo!.passwordHash)).toBe(true);
    });

    it('normaliza mayúsculas y espacios al buscar', () => {
        expect(findUserByEmail('  DEMO@BEZHAS.COM  ')).toBeDefined();
    });

    it('devuelve undefined para un email desconocido', () => {
        expect(findUserByEmail('nadie@bezhas.com')).toBeUndefined();
    });

    it('crea usuarios con rol RETAIL y email normalizado', () => {
        const user = createUser('  Ana  ', '  ANA@bezhas.com ', 'clave-seguraaa');

        expect(user.email).toBe('ana@bezhas.com');
        expect(user.username).toBe('Ana');
        expect(user.role).toBe('RETAIL');
        expect(verifyPassword('clave-seguraaa', user.passwordHash)).toBe(true);
    });

    it('no guarda la contraseña en claro', () => {
        const user = createUser('Bruno', 'bruno@bezhas.com', 'clave-en-claro');

        expect(JSON.stringify(user)).not.toContain('clave-en-claro');
    });

    it('asigna ids distintos a cada usuario', () => {
        const uno = createUser('Uno', 'uno@bezhas.com', 'clave-uno-larga');
        const dos = createUser('Dos', 'dos@bezhas.com', 'clave-dos-larga');

        expect(dos.id).not.toBe(uno.id);
    });

    it('userExists refleja el alta y normaliza igual que la búsqueda', () => {
        expect(userExists('carla@bezhas.com')).toBe(false);

        createUser('Carla', 'carla@bezhas.com', 'clave-carla-x');

        expect(userExists('carla@bezhas.com')).toBe(true);
        expect(userExists('  CARLA@BEZHAS.COM  ')).toBe(true);
    });
});
