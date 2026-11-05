const { contratoDe, ContratoIncumplido } = require('../../services/marketplace/openapiContract');

let n = 0;
const contrato = (paths, components) => contratoDe({
    id: `t-${n += 1}`, updated_at: 0,
    openapi: { openapi: '3.1.0', info: { title: 't', version: '1' }, paths, ...(components ? { components } : {}) },
});
const json = (schema) => ({ content: { 'application/json': { schema } } });
const falla = (fn) => {
    try { fn(); } catch (e) { expect(e).toBeInstanceOf(ContratoIncumplido); return e; }
    throw new Error('no lanzó');
};

describe('openapiContract', () => {
    it('una ruta literal gana a una con plantilla', () => {
        const c = contrato({
            '/items/{id}': { get: { operationId: 'uno', responses: {} } },
            '/items/latest': { get: { operationId: 'ultimo', responses: {} } },
        });
        expect(c.validarPeticion('GET', '/items/latest').operationId).toBe('ultimo');
        expect(c.validarPeticion('GET', '/items/42').operationId).toBe('uno');
    });

    it('HEAD sin declarar usa el GET; otro método sin declarar da 405', () => {
        const c = contrato({ '/x': { get: { responses: {} } } });
        expect(c.validarPeticion('HEAD', '/x').metodoContrato).toBe('get');
        expect(falla(() => c.validarPeticion('DELETE', '/x')).status).toBe(405);
    });

    it('recodifica los parámetros de ruta al reenviar', () => {
        const c = contrato({ '/q/{nombre}': { get: { parameters: [{ name: 'nombre', in: 'path', schema: { type: 'string' } }], responses: {} } } });
        expect(c.validarPeticion('GET', '/q/caf%C3%A9 con leche').rutaReenvio).toBe('/q/caf%C3%A9%20con%20leche');
        expect(falla(() => c.validarPeticion('GET', '/q/%2E%2E')).code).toBe('INVALID_REQUEST');
    });

    it('query requerida y coerción de tipos', () => {
        const c = contrato({ '/s': { get: { parameters: [{ name: 'n', in: 'query', required: true, schema: { type: 'integer', minimum: 1 } }], responses: {} } } });
        expect(falla(() => c.validarPeticion('GET', '/s', {})).detalles[0]).toContain('Falta');
        expect(c.validarPeticion('GET', '/s', { n: '3' }).query).toBe('?n=3');
        expect(falla(() => c.validarPeticion('GET', '/s', { n: '0' })).code).toBe('INVALID_REQUEST');
    });

    it('respuesta: usa el código exacto, luego 2XX, luego default; sin esquema es 502', () => {
        const c = contrato({
            '/a': { get: { responses: { '2XX': json({ type: 'object', properties: { ok: { type: 'boolean' } } }) } } },
            '/b': { get: { responses: { 200: { description: 'sin cuerpo declarado' } } } },
        });
        expect(c.validarRespuesta('get', '/a', 201, { ok: true, extra: 1 })).toEqual({ ok: true });
        expect(falla(() => c.validarRespuesta('get', '/b', 200, {})).code).toBe('RESPONSE_NOT_DECLARED');
    });

    it('quita campos no declarados también en objetos anidados y en $ref', () => {
        const c = contrato(
            { '/p': { get: { responses: { 200: json({ type: 'array', items: { $ref: '#/components/schemas/P' } }) } } } },
            { schemas: { P: { type: 'object', properties: { id: { type: 'string' }, dir: { type: 'object', properties: { pais: { type: 'string' } } } } } } },
        );
        expect(c.validarRespuesta('get', '/p', 200, [{ id: '1', email: 'x@y', dir: { pais: 'ES', calle: 'z' } }]))
            .toEqual([{ id: '1', dir: { pais: 'ES' } }]);
    });
});
