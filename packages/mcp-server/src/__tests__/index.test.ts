/**
 * Pruebas del punto de entrada por STDIO.
 *
 * Es el transporte que usa un cliente MCP de verdad, y hasta ahora no lo
 * tocaba ninguna prueba: 0 % de cobertura sobre el fichero que arranca todo.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { crearServidor } from '../index.js';
import { auditLog, subjectFromApiKey } from '../security/index.js';

const CLAVE = 'bzh_live_clave_de_prueba_1234567890';

beforeEach(() => {
    delete process.env.BEZHAS_API_KEY;
});

afterEach(() => {
    delete process.env.BEZHAS_API_KEY;
});

describe('punto de entrada STDIO', () => {
    it('arma el servidor sin que el SDK rechace ningún esquema', () => {
        // El mismo fallo que dejó el servidor sin arrancar durante meses: un
        // esquema en JSON-Schema crudo que el SDK rechaza al registrarlo. Con
        // un servidor simulado no se ve; hay que armar el de verdad.
        expect(() => crearServidor()).not.toThrow();
    });

    it('importar el módulo no abre el transporte', async () => {
        // Si conectase al importar, esta suite se quedaría enganchada a stdin.
        // Que estas pruebas terminen es, en sí, la comprobación.
        const server = crearServidor();
        expect(server).toBeDefined();
    });
});

describe('el sujeto del vigilante no lleva la credencial', () => {
    it('no contiene ningún trozo de la clave de API', () => {
        // Antes era `BEZHAS_API_KEY.slice(0, 12)`: doce caracteres en claro de
        // la credencial, en cada entrada de la auditoría y por tanto en el
        // fichero que se escribe a disco.
        const sujeto = subjectFromApiKey(CLAVE);

        expect(sujeto).not.toContain(CLAVE);
        for (let n = 6; n <= CLAVE.length; n++) {
            expect(sujeto).not.toContain(CLAVE.slice(0, n));
        }
        expect(sujeto).toMatch(/^sbj_[0-9a-f]{16}$/);
    });

    it('la misma clave da el mismo sujeto, y dos claves distintas no lo comparten', () => {
        // Sin lo primero no se puede seguir a un sujeto por la auditoría; sin
        // lo segundo, dos clientes se contabilizarían en el mismo cubo.
        expect(subjectFromApiKey(CLAVE)).toBe(subjectFromApiKey(CLAVE));
        expect(subjectFromApiKey(CLAVE)).not.toBe(subjectFromApiKey(CLAVE + 'x'));
    });

    it('sin clave configurada sigue habiendo un sujeto estable', () => {
        const sujeto = subjectFromApiKey(undefined);

        expect(sujeto).toMatch(/^sbj_/);
        expect(sujeto).toBe(subjectFromApiKey(undefined));
    });

    it('la credencial no aparece en lo que se anota en la auditoría', () => {
        process.env.BEZHAS_API_KEY = CLAVE;

        auditLog.record({
            tool: 'analyze_gas_strategy',
            subject: subjectFromApiKey(process.env.BEZHAS_API_KEY),
            verdict: 'allow',
            reason: 'Sin hallazgos.',
        });

        const anotado = JSON.stringify(auditLog.recent(5));
        expect(anotado).not.toContain(CLAVE);
        expect(anotado).not.toContain(CLAVE.slice(0, 12));
    });
});
