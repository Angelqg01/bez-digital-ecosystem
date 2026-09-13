/**
 * Dónde está la frontera entre "se ha roto lo nuestro" y "el servicio de
 * enfrente no está disponible".
 *
 * Importa porque de ella depende que el humo E2E tumbe o no la build. Si se
 * amplía de más, una herramienta rota pasaría desapercibida; si se queda
 * corta, el limitador de ritmo de un tercero vuelve a dejar la CI en rojo
 * permanente, que es como estaba.
 */
const { classifyError, failure, BEZ_TOKEN } = require('../services/orchestrator.service');

const httpError = (status) => ({ response: { status }, message: `Request failed with status code ${status}` });
const netError = (code) => ({ code, message: code });

describe('classifyError: qué es culpa del otro lado', () => {
    test.each([401, 403, 408, 429, 500, 502, 503, 504])('%i se marca como ajeno', (status) => {
        expect(classifyError(httpError(status)).upstream).toBe(true);
    });

    test.each(['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED', 'EAI_AGAIN', 'ERR_NETWORK'])(
        '%s se marca como ajeno',
        (code) => {
            expect(classifyError(netError(code)).upstream).toBe(true);
        },
    );
});

describe('classifyError: qué sigue siendo nuestro', () => {
    // Este es el caso que de verdad importa. Los dos fallos de GitHub del humo
    // venían de apuntar a un repositorio que no existe, y los de Blockscout de
    // pedir metadatos de token sobre la dirección de la tesorería. Si un 404
    // se clasificara como ajeno, ese tipo de error volvería a pasar inadvertido.
    test('un 404 NO es ajeno: apuntar a algo que no existe es error nuestro', () => {
        expect(classifyError(httpError(404)).upstream).toBe(false);
    });

    test.each([400, 405, 409, 410, 422])('%i tampoco es ajeno', (status) => {
        expect(classifyError(httpError(status)).upstream).toBe(false);
    });

    test('un error sin respuesta HTTP ni código de red no se da por ajeno', () => {
        expect(classifyError(new Error('algo se rompió en nuestro código')).upstream).toBe(false);
    });
});

describe('failure: forma del resultado', () => {
    test('conserva el contexto y adjunta la clasificación', () => {
        const r = failure(httpError(429), { action: 'supply_metrics' });

        expect(r).toMatchObject({
            action: 'supply_metrics',
            status: 'FAILED',
            upstream: true,
            httpStatus: 429,
        });
        expect(r.reasoning).toContain('429');
        expect(r.data.error).toBe(r.reasoning);
    });

    test('un 404 llega con upstream false, que es lo que tumba el humo', () => {
        expect(failure(httpError(404), { action: 'analyze_repo' })).toMatchObject({
            status: 'FAILED',
            upstream: false,
            httpStatus: 404,
        });
    });

    test('prefiere el mensaje del cuerpo de la respuesta cuando lo hay', () => {
        const err = { response: { status: 422, data: { message: 'Validation failed' } }, message: 'genérico' };
        expect(failure(err, {}).reasoning).toBe('Validation failed');
    });
});

describe('dirección del token BEZ', () => {
    // El valor por defecto apuntaba a la tesorería (0x89c23890…), no al token,
    // así que supply_metrics y holder_analysis pedían datos de token sobre una
    // cartera. Es el contrato que usa el resto del repositorio.
    test('es el contrato del token, no la tesorería', () => {
        expect(BEZ_TOKEN.toLowerCase()).toBe('0xecba873b534c54de2b62acde232adca4369f11a8');
        expect(BEZ_TOKEN.toLowerCase()).not.toBe('0x89c23890c742d710265dd61be789c71dc8999b12');
    });
});
