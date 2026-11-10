/**
 * Un secreto que falta en producción detiene el arranque; fuera de producción
 * se usa el valor de desarrollo. Ver config/requiredSecret.js.
 */
const { secretoObligatorio } = require('../config/requiredSecret');

describe('secretoObligatorio', () => {
    const original = { ...process.env };
    afterEach(() => { process.env = { ...original }; });

    const enProduccion = () => { process.env.NODE_ENV = 'production'; };

    test('fuera de producción devuelve el valor de desarrollo si falta la variable', () => {
        process.env.NODE_ENV = 'test';
        delete process.env.X_SECRETO;
        expect(secretoObligatorio('X_SECRETO', { dev: 'solo-dev' })).toBe('solo-dev');
        expect(secretoObligatorio('X_SECRETO', { dev: () => 'generado' })).toBe('generado');
        expect(secretoObligatorio('X_SECRETO')).toBe('');
    });

    test('la variable de entorno gana al valor de desarrollo', () => {
        process.env.NODE_ENV = 'test';
        process.env.X_SECRETO = 'real';
        expect(secretoObligatorio('X_SECRETO', { dev: 'solo-dev' })).toBe('real');
    });

    test('en producción, sin variable, lanza y no usa el valor de desarrollo', () => {
        enProduccion();
        delete process.env.X_SECRETO;
        expect(() => secretoObligatorio('X_SECRETO', { dev: 'solo-dev' })).toThrow(/falta X_SECRETO/);
    });

    test('en producción rechaza un valor de desarrollo conocido', () => {
        enProduccion();
        process.env.X_SECRETO = 'debug123';
        expect(() => secretoObligatorio('X_SECRETO', { prohibidos: ['debug123'] })).toThrow(/público/);
    });

    test('en producción exige la longitud mínima', () => {
        enProduccion();
        process.env.X_SECRETO = 'corto';
        expect(() => secretoObligatorio('X_SECRETO', { minLength: 24 })).toThrow(/al menos 24/);
    });

    test('acepta una variable alternativa', () => {
        enProduccion();
        delete process.env.X_SECRETO;
        process.env.X_ALTERNATIVA = 'valor-de-la-alternativa';
        expect(secretoObligatorio('X_SECRETO', { alternativas: ['X_ALTERNATIVA'] })).toBe('valor-de-la-alternativa');
    });

    test('el motor de riesgo no carga en producción sin AI_SIGNER_PRIVATE_KEY ni con la clave 0x…01', () => {
        enProduccion();
        delete process.env.AI_SIGNER_PRIVATE_KEY;
        jest.isolateModules(() => {
            expect(() => require('../controllers/aiRiskEngine.controller')).toThrow(/AI_SIGNER_PRIVATE_KEY/);
        });
        process.env.AI_SIGNER_PRIVATE_KEY = '0x' + '0'.repeat(63) + '1';
        jest.isolateModules(() => {
            expect(() => require('../controllers/aiRiskEngine.controller')).toThrow(/público/);
        });
    });

    test('la ruta de diagnóstico no carga en producción sin DIAGNOSTIC_KEY ni con debug123', () => {
        enProduccion();
        delete process.env.DIAGNOSTIC_KEY;
        jest.isolateModules(() => {
            expect(() => require('../routes/diagnostic.routes')).toThrow(/DIAGNOSTIC_KEY/);
        });
        process.env.DIAGNOSTIC_KEY = 'debug123';
        jest.isolateModules(() => {
            expect(() => require('../routes/diagnostic.routes')).toThrow(/público/);
        });
    });
});
