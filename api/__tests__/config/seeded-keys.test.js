const fs = require('fs');
const path = require('path');

/**
 * La migración 005 sembraba las cuatro claves del Gateway con su secreto EN
 * CLARO dentro del propio fichero versionado. Cualquiera con el repositorio
 * calculaba el SHA-256 y entraba — y 'core-internal-key' llevaba scope `admin`,
 * que en middleware/address-access.js salta la comprobación de titularidad:
 * esa clave anulaba por sí sola el control de acceso a datos de otros clientes.
 *
 * Estas comprobaciones existen para que no vuelva a colarse una clave usable en
 * una migración.
 */
describe('Ninguna migración siembra claves utilizables', () => {
    const DIR = path.join(__dirname, '..', '..', 'db', 'migrations');
    const ficheros = fs.readdirSync(DIR).filter(f => f.endsWith('.sql'));

    /** Los valores concretos que se publicaron, ya revocados por la 051. */
    const PUBLICADAS = ['core-internal-key', 'defi-dev-key', 'app-dev-key', 'web3-dev-key'];

    it('ninguna migración calcula el hash de una clave escrita a mano', () => {
        // El patrón peligroso es digest('<literal>','sha256') dentro de un
        // INSERT/UPDATE: convierte el fichero en la clave misma.
        const infractoras = [];
        for (const f of ficheros) {
            const sql = fs.readFileSync(path.join(DIR, f), 'utf8');
            // Se ignoran los comentarios: la 005 y la 051 explican el incidente
            // citando los valores, y esa documentación debe poder quedarse.
            const sinComentarios = sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
            if (/digest\(\s*'[^']+'\s*,\s*'sha256'\s*\)/i.test(sinComentarios)) {
                // La 051 los usa para REVOCAR, comparando en un WHERE. Eso es
                // legítimo: no crea acceso, lo quita.
                if (!/UPDATE[\s\S]*REVOKED_/i.test(sinComentarios)) infractoras.push(f);
            }
        }
        expect(infractoras).toEqual([]);
    });

    it('la 005 ya no siembra ninguna de las claves publicadas', () => {
        const sql = fs.readFileSync(path.join(DIR, '005_app_registry_sso.sql'), 'utf8');
        const sinComentarios = sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
        for (const clave of PUBLICADAS) {
            expect(sinComentarios).not.toContain(clave);
        }
    });

    it('la 005 deja las apps desactivadas, para que haya que darlas de alta a mano', () => {
        const sql = fs.readFileSync(path.join(DIR, '005_app_registry_sso.sql'), 'utf8');
        expect(sql).toMatch(/PROVISION_REQUIRED_/);
        // Un hash con caracteres fuera del alfabeto hexadecimal no puede ser el
        // SHA-256 de nada: no existe entrada que lo produzca.
        expect(sql).not.toMatch(/is_active\s*\)\s*VALUES[\s\S]*TRUE\s*\)\s*ON CONFLICT/);
    });

    it('existe la migración que revoca las claves ya sembradas', () => {
        const revocacion = ficheros.find(f => f.includes('revoke_seeded_dev_keys'));
        expect(revocacion).toBeDefined();
        const sql = fs.readFileSync(path.join(DIR, revocacion), 'utf8');
        // Compara por hash y no por nombre de app: si alguien ya rotó la suya a
        // mano, su hash no coincide y la migración la deja en paz.
        expect(sql).toMatch(/WHERE api_key_hash IN/);
        for (const clave of PUBLICADAS) expect(sql).toContain(clave);
    });
});
