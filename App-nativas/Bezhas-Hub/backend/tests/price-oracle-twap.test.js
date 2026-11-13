/**
 * El oráculo de precios lee el TWAP de BeZhasDEX, nunca el precio spot (SEC-06).
 * El spot se mueve con un préstamo flash dentro de una transacción; el TWAP, no.
 */

const DEX = '0x00000000000000000000000000000000000d3001';
const BEZ = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';

let dexMock;
let contractCalls;

jest.mock('ethers', () => {
    const actual = jest.requireActual('ethers');
    return {
        ...actual,
        ethers: {
            ...actual.ethers,
            JsonRpcProvider: jest.fn(() => ({})),
            Contract: jest.fn((address) => {
                contractCalls.push(address);
                if (String(address).toLowerCase() === DEX.toLowerCase()) return dexMock;
                // Cualquier otra fuente (QuickSwap) falla: no hay red en los tests.
                return new Proxy({}, { get: () => () => Promise.reject(new Error('sin red')) });
            }),
        },
    };
});

function cargar() {
    let mod;
    jest.isolateModules(() => {
        process.env.BEZHAS_DEX_ADDRESS = DEX;
        mod = require('../services/price-oracle.service');
    });
    mod.clearCache();
    return mod;
}

const ahora = () => Math.floor(Date.now() / 1000);

beforeEach(() => {
    contractCalls = [];
    dexMock = {
        consultTwap: jest.fn(async () => 50_000n),                  // 0,05 USD por BEZ (BEZ 18 dec / USDC 6 dec)
        pairId: jest.fn(async () => '0x' + '11'.repeat(32)),
        observations: jest.fn(async () => ({ timestamp: ahora() - 3600 })),
        getSpotPrice: jest.fn(async () => 9_999_999n),              // precio spot manipulado
        getPool: jest.fn(async () => ({ reserve0: 1n, reserve1: 1n, token0: BEZ })),
    };
});

afterAll(() => { delete process.env.BEZHAS_DEX_ADDRESS; });

describe('oráculo de precios con la pool interna', () => {
    test('usa el TWAP y se mantiene aunque el precio spot esté manipulado', async () => {
        const oraculo = cargar();
        const precio = await oraculo.getBezUsdPrice();
        expect(precio).toBeCloseTo(0.05, 10);
        expect(dexMock.consultTwap).toHaveBeenCalledTimes(1);
        // El spot sólo se consulta para avisar de la desviación: no decide el precio.
        expect(precio).not.toBeCloseTo(9.999999, 3);
    });

    test('sin observación (consultTwap revierte) NO cae al precio spot: usa la siguiente fuente', async () => {
        dexMock.consultTwap = jest.fn(async () => { throw new Error('execution reverted: NoObservation()'); });
        const oraculo = cargar();
        const precio = await oraculo.getBezUsdPrice();
        // QuickSwap también falla en el test → precio de reserva, jamás el spot del DEX.
        expect(precio).toBe(oraculo.FALLBACK_PRICE_USD);
        expect(dexMock.getSpotPrice).not.toHaveBeenCalled();
    });

    test('con la ventana demasiado corta tampoco usa el spot', async () => {
        dexMock.consultTwap = jest.fn(async () => { throw new Error('execution reverted: TwapWindowTooShort()'); });
        const oraculo = cargar();
        expect(await oraculo.getBezUsdPrice()).toBe(oraculo.FALLBACK_PRICE_USD);
        expect(dexMock.getSpotPrice).not.toHaveBeenCalled();
    });

    test('una observación caducada (nadie llamó a updateObservation) se descarta', async () => {
        dexMock.observations = jest.fn(async () => ({ timestamp: ahora() - 3 * 24 * 3600 }));
        const oraculo = cargar();
        expect(await oraculo.getBezUsdPrice()).toBe(oraculo.FALLBACK_PRICE_USD);
    });

    test('un TWAP de cero no es un precio', async () => {
        dexMock.consultTwap = jest.fn(async () => 0n);
        const oraculo = cargar();
        expect(await oraculo.getBezUsdPrice()).toBe(oraculo.FALLBACK_PRICE_USD);
    });

    test('un fallo al leer los datos de apoyo no tumba un TWAP válido', async () => {
        dexMock.getSpotPrice = jest.fn(async () => { throw new Error('rpc caido'); });
        const oraculo = cargar();
        expect(await oraculo.getBezUsdPrice()).toBeCloseTo(0.05, 10);
    });
});
