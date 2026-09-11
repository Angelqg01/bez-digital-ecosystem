// Este fichero no carga helpers.js (no necesita la base simulada), así que la
// clave de seudonimización se fija aquí. En este entorno NODE_ENV llega como
// 'production' y sin clave el módulo aborta, que es justo lo que se prueba al
// final del fichero, a propósito y aparte.
process.env.TELEMETRY_PSEUDONYM_KEY = process.env.TELEMETRY_PSEUDONYM_KEY
    || 'clave-de-pruebas-para-seudonimos';

const anon = require('../../services/episodeAnonymizer');

describe('episodeAnonymizer — seudonimización art. 4.5 RGPD', () => {
    describe('formaDe: devuelve el TIPO, jamás el valor', () => {
        it.each([
            ['48200.00', 'decimal'],
            ['48200', 'entero'],
            [48200.5, 'decimal'],
            [true, 'booleano'],
            ['0x' + 'a'.repeat(40), 'direccion_evm'],
            ['0x' + 'b'.repeat(64), 'hash'],
            ['3f1a2b4c-5d6e-4f70-8a91-b2c3d4e5f607', 'uuid'],
            ['2026-09-10', 'fecha'],
            ['BEZ', 'enum_corto'],
            ['pago a Delta Logistics del contrato 42', 'texto'],
            [null, 'vacio'],
            [[1, 2], 'lista'],
        ])('%s → %s', (valor, tipo) => {
            expect(anon.formaDe(valor)).toBe(tipo);
        });

        it('no existe ninguna rama que devuelva el valor original', () => {
            // Cualquier excepción —«los importes son inofensivos», «el país no
            // identifica a nadie»— es el primer paso de un goteo que acaba con
            // la conversación entera guardada.
            const valores = ['secreto', 42, 3.14, true, '0x123', {}, [], null, 'ES77 1465 0100 91'];
            for (const v of valores) {
                const forma = anon.formaDe(v);
                expect(anon.TIPOS).toContain(forma);
                expect(String(forma)).not.toBe(String(v));
            }
        });
    });

    describe('formaArgumentos', () => {
        it('conserva los NOMBRES (son de nuestro esquema) y tira los valores', () => {
            const r = anon.formaArgumentos({ amount: '48200.00', nota: 'Delta Logistics' });
            expect(r).toEqual({ amount: 'decimal', nota: 'texto' });
        });

        it('acota el número de campos: un agente puede mandar cien inventados', () => {
            const muchos = {};
            for (let i = 0; i < 200; i++) muchos[`campo_${i}`] = i;
            expect(Object.keys(anon.formaArgumentos(muchos)).length).toBe(anon.MAX_CAMPOS);
        });

        it('acota la longitud del nombre', () => {
            const r = anon.formaArgumentos({ ['x'.repeat(500)]: 1 });
            expect(Object.keys(r)[0].length).toBeLessThanOrEqual(40);
        });

        it('un argumento que no es objeto no produce nada', () => {
            expect(anon.formaArgumentos('texto suelto')).toEqual({});
            expect(anon.formaArgumentos(null)).toEqual({});
            expect(anon.formaArgumentos([1, 2])).toEqual({});
        });
    });

    describe('seudónimo: es seudónimo, no anónimo, y se dice así', () => {
        it('es estable para el mismo valor', () => {
            expect(anon.seudonimo('app-1')).toBe(anon.seudonimo('app-1'));
        });

        it('no permite cruzar entre finalidades', () => {
            // La sal por finalidad impide correlacionar la telemetría con
            // cualquier otro tratamiento.
            expect(anon.seudonimo('app-1', 'telemetria'))
                .not.toBe(anon.seudonimo('app-1', 'episodios'));
        });

        it('no contiene el valor original', () => {
            expect(anon.seudonimo('app-secreta-1')).not.toContain('app-secreta');
            expect(anon.seudonimo('app-1')).toHaveLength(32);
        });

        it('lo podemos recalcular: por eso el derecho de acceso sigue siendo ejercitable', () => {
            // Si fuera irreversible para nosotros también, sería anónimo y no
            // habría forma de atender un art. 15 ni un art. 17.
            const s1 = anon.seudonimo('app-1', 'telemetria');
            const s2 = anon.seudonimo('app-1', 'telemetria');
            expect(s1).toBe(s2);
        });
    });

    describe('la clave de seudonimización es obligatoria en producción', () => {
        it('sin clave, aborta en vez de generar un hash reproducible por cualquiera', () => {
            // Sin clave el «seudónimo» sería un SHA que cualquiera con la tabla
            // puede recalcular: dejaría de seudonimizar nada.
            const original = process.env.TELEMETRY_PSEUDONYM_KEY;
            const vault = process.env.SECRET_VAULT_KEY;
            delete process.env.TELEMETRY_PSEUDONYM_KEY;
            delete process.env.SECRET_VAULT_KEY;
            jest.resetModules();
            const recargado = require('../../services/episodeAnonymizer');
            // NODE_ENV llega como 'production' en este entorno (ver helpers.js).
            expect(() => recargado.seudonimo('app-1')).toThrow(/TELEMETRY_PSEUDONYM_KEY/);
            process.env.TELEMETRY_PSEUDONYM_KEY = original;
            if (vault) process.env.SECRET_VAULT_KEY = vault;
            jest.resetModules();
        });
    });

    describe('contieneContenido: red de seguridad de salida', () => {
        it('señala un valor que no es un tipo conocido', () => {
            const sospechoso = anon.contieneContenido({
                forma_argumentos: { amount: '48200.00' },   // valor, no tipo
            });
            expect(sospechoso).toContain('forma_argumentos.amount');
        });

        it('no se queja de una forma correcta', () => {
            expect(anon.contieneContenido({
                herramienta: 'bezhas_dex_quote',
                forma_argumentos: { amount: 'decimal', from: 'enum_corto' },
            })).toEqual([]);
        });
    });
});
