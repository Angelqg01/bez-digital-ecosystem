/**
 * Pruebas de GlobalSettings (configuración global del panel de administración).
 *
 * Esta suite comprobaba el esquema de Mongoose (`models/GlobalSettings.model.js`),
 * pero importaba el DAO de PostgreSQL (`models/pg/GlobalSettings.js`), que no
 * tiene `.schema`: las 29 pruebas de esquema fallaban con
 * «Cannot read properties of undefined (reading 'paths')».
 *
 * La implementación viva es la de PostgreSQL —es la que usa
 * `routes/globalSettings.routes.js`, y nada en el backend requiere ya el modelo
 * de Mongoose—, así que las pruebas se reescriben contra ella: secciones,
 * valores por defecto y, sobre todo, las cotas numéricas que la migración a
 * `jsonb` había dejado sin aplicar.
 */

const GlobalSettings = require('../models/pg/GlobalSettings');
const { COTAS, SECCIONES, validateSettings, SettingsValidationError } = GlobalSettings;

jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
}));

// El DAO abre un pool de PostgreSQL al importarse; aquí no se consulta la base
// de datos, solo los valores por defecto y la validación, que son puros.
jest.mock('../db/pool', () => ({
    query: jest.fn(),
    end: jest.fn(),
}));

describe('GlobalSettings (DAO PostgreSQL)', () => {
    const defaults = GlobalSettings.getDefaultSettings();

    describe('Secciones de configuración', () => {
        const seccionesEsperadas = ['defi', 'fiat', 'token', 'farming', 'staking', 'dao', 'rwa', 'platform'];

        seccionesEsperadas.forEach((seccion) => {
            test(`existe la sección ${seccion}`, () => {
                expect(defaults[seccion]).toBeDefined();
                expect(typeof defaults[seccion]).toBe('object');
            });
        });

        test('la lista de secciones escribibles incluye openclaw además de las públicas', () => {
            expect(SECCIONES).toEqual(expect.arrayContaining([...seccionesEsperadas, 'openclaw']));
        });

        test('defi expone comisión de swap y slippage', () => {
            expect(defaults.defi).toHaveProperty('swapFeePercent');
            expect(defaults.defi).toHaveProperty('maxSlippage');
            expect(defaults.defi).toHaveProperty('bridgeFeePercent');
        });

        test('token expone los parámetros de tokenómica', () => {
            expect(defaults.token).toHaveProperty('burnRate');
            expect(defaults.token).toHaveProperty('treasuryRate');
            expect(defaults.token).toHaveProperty('transferFeePercent');
        });

        test('dao expone quórum y periodo de votación', () => {
            expect(defaults.dao).toHaveProperty('quorumPercentage');
            expect(defaults.dao).toHaveProperty('votingPeriodDays');
        });
    });

    describe('Valores por defecto', () => {
        test('defi', () => {
            expect(defaults.defi.enabled).toBe(true);
            expect(defaults.defi.swapFeePercent).toBe(0.3);
            expect(defaults.defi.maxSlippage).toBe(1);
        });

        test('fiat', () => {
            expect(defaults.fiat.enabled).toBe(true);
            expect(defaults.fiat.minPurchaseUSD).toBe(10);
            expect(defaults.fiat.maxPurchaseUSD).toBe(10000);
            expect(defaults.fiat.kycRequired).toBe(true);
        });

        test('token apunta al contrato BEZ desplegado', () => {
            expect(defaults.token.symbol).toBe('BEZ');
            expect(defaults.token.decimals).toBe(18);
            expect(defaults.token.contractAddress).toBe('0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8');
            // Acuñación cerrada por defecto: abrirla es una decisión explícita.
            expect(defaults.token.mintingEnabled).toBe(false);
        });

        test('farming y staking', () => {
            expect(defaults.farming.defaultAPY).toBe(15);
            expect(defaults.staking.rewardRatePercent).toBe(12);
        });

        test('dao', () => {
            expect(defaults.dao.quorumPercentage).toBe(10);
            expect(defaults.dao.votingPeriodDays).toBe(7);
        });

        test('platform', () => {
            expect(defaults.platform.maintenanceMode).toBe(false);
            expect(defaults.platform.registrationEnabled).toBe(true);
            expect(defaults.platform.sessionTimeoutMinutes).toBe(60);
        });

        test('todos los valores por defecto pasan su propia validación', () => {
            expect(() => validateSettings(defaults)).not.toThrow();
        });
    });

    describe('Cotas de los parámetros sensibles', () => {
        const casos = [
            ['defi.swapFeePercent', 0, 10],
            ['defi.maxSlippage', 0.1, 50],
            ['token.burnRate', 0, 500],
            ['token.treasuryRate', 0, 1000],
            ['staking.rewardRatePercent', 0, 100],
            ['dao.quorumPercentage', 1, 100],
            ['dao.votingPeriodDays', 1, 30],
            ['rwa.platformFeePercent', 0, 10],
        ];

        casos.forEach(([ruta, min, max]) => {
            test(`${ruta} está acotado en [${min}, ${max}]`, () => {
                expect(COTAS[ruta]).toEqual({ min, max });
            });

            test(`${ruta} rechaza un valor por encima del máximo`, () => {
                const [seccion, campo] = ruta.split('.');
                expect(() => validateSettings({ [seccion]: { [campo]: max + 1 } }))
                    .toThrow(SettingsValidationError);
            });

            test(`${ruta} rechaza un valor por debajo del mínimo`, () => {
                const [seccion, campo] = ruta.split('.');
                expect(() => validateSettings({ [seccion]: { [campo]: min - 1 } }))
                    .toThrow(SettingsValidationError);
            });

            test(`${ruta} acepta los extremos del rango`, () => {
                const [seccion, campo] = ruta.split('.');
                expect(() => validateSettings({ [seccion]: { [campo]: min } })).not.toThrow();
                expect(() => validateSettings({ [seccion]: { [campo]: max } })).not.toThrow();
            });
        });

        test('rechaza NaN e Infinity, que en jsonb se guardarían como null', () => {
            expect(() => validateSettings({ defi: { swapFeePercent: Number.NaN } })).toThrow(SettingsValidationError);
            expect(() => validateSettings({ defi: { swapFeePercent: Number.POSITIVE_INFINITY } })).toThrow(SettingsValidationError);
        });

        test('acepta números en forma de cadena (los formularios envían texto)', () => {
            expect(() => validateSettings({ dao: { quorumPercentage: '51' } })).not.toThrow();
            expect(() => validateSettings({ dao: { quorumPercentage: '0' } })).toThrow(SettingsValidationError);
        });

        test('ignora los campos que no vienen en la actualización parcial', () => {
            expect(() => validateSettings({ defi: { enabled: false } })).not.toThrow();
            expect(() => validateSettings({})).not.toThrow();
            expect(() => validateSettings(undefined)).not.toThrow();
        });

        test('el error de validación se traduce a 400, no a 500', () => {
            try {
                validateSettings({ defi: { swapFeePercent: 500 } });
                throw new Error('debería haber lanzado');
            } catch (error) {
                expect(error).toBeInstanceOf(SettingsValidationError);
                expect(error.statusCode).toBe(400);
                expect(error.message).toContain('defi.swapFeePercent');
            }
        });
    });

    describe('Métodos estáticos', () => {
        ['getSettings', 'updateSettings', 'resetSettings', 'rollback', 'getDefaultSettings'].forEach((metodo) => {
            test(`expone ${metodo}`, () => {
                expect(typeof GlobalSettings[metodo]).toBe('function');
            });
        });
    });
});

describe('Rutas de GlobalSettings', () => {
    const router = require('../routes/globalSettings.routes');

    /** Extrae los pares método/ruta registrados en el router de Express. */
    const rutasRegistradas = router.stack
        .filter((capa) => capa.route)
        .flatMap((capa) => Object.keys(capa.route.methods).map((m) => `${m.toUpperCase()} ${capa.route.path}`));

    const esperadas = [
        'GET /',
        'PUT /',
        'GET /:section',
        'PATCH /:section',
        'POST /reset',
        'GET /public/frontend',
    ];

    esperadas.forEach((ruta) => {
        test(`registra ${ruta}`, () => {
            expect(rutasRegistradas).toContain(ruta);
        });
    });

    test('/reset usa el DAO de PostgreSQL, no métodos de Mongoose', () => {
        // `deleteOne` y `create` son de Mongoose y no existen en el DAO: la
        // ruta devolvía siempre 500. Se comprueba que ya no se nombran.
        const fuente = require('fs').readFileSync(require.resolve('../routes/globalSettings.routes'), 'utf8');
        expect(fuente).toContain('GlobalSettings.resetSettings(');
        expect(fuente).not.toContain('GlobalSettings.deleteOne(');
        expect(fuente).not.toContain('GlobalSettings.create(');
    });
});
