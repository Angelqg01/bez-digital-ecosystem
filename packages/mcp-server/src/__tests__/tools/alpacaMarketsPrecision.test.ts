/**
 * Unit tests: precisión de alpaca_markets a la escala de precio real del BEZ.
 *
 * El precio definitivo del BEZ es 0,0075 $. A esa escala `toFixed(4)` deja
 * solo dos cifras significativas, así que los indicadores técnicos se
 * desviaban hasta un 0,74 %. Estas pruebas fijan la resolución mínima.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockMcpServer, parseToolResult } from '../helpers/mockMcpServer.js';

const PRECIO_BEZ = 0.0075;

vi.mock('../../config.js', () => ({
    config: {
        integrations: {},
        network: { mode: 'amoy', activeRpc: 'https://rpc-amoy.polygon.technology', rpc: {} },
        token: { address: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8', priceUSD: 0.0075, decimals: 18 },
    },
}));

import { registerAlpacaMarketsMcp, redondearPrecio } from '../../tools/alpacaMarketsMcp.js';

describe('redondearPrecio', () => {
    it('conserva seis cifras significativas por debajo de un céntimo', () => {
        expect(redondearPrecio(0.0075 * 0.98)).toBe(0.00735);
        expect(redondearPrecio(0.0075 * 0.95)).toBe(0.007125);
        expect(redondearPrecio(0.0075 * 0.9)).toBe(0.00675);
    });

    it('no añade decimales espurios a valores grandes', () => {
        expect(redondearPrecio(2400)).toBe(2400);
        expect(redondearPrecio(45000 * 1.05)).toBe(47250);
    });

    it('trata los valores no finitos y el cero sin propagar NaN', () => {
        expect(redondearPrecio(0)).toBe(0);
        expect(redondearPrecio(NaN)).toBe(0);
        expect(redondearPrecio(Infinity)).toBe(0);
    });
});

describe('alpaca_markets · price_analysis a 0,0075 $', () => {
    let handler: Function;

    beforeEach(() => {
        const { server, getHandler } = createMockMcpServer();
        registerAlpacaMarketsMcp(server as any);
        handler = getHandler('alpaca_markets')!;
        vi.stubGlobal('fetch', vi.fn());
    });

    it('devuelve indicadores con un error relativo inferior al 0,01 %', async () => {
        const result: any = parseToolResult(await handler({ action: 'price_analysis' }));
        const ind = result.data.technicalIndicators;

        const esperado: Array<[number, number]> = [
            [ind.sma20, PRECIO_BEZ * 0.98],
            [ind.sma50, PRECIO_BEZ * 0.95],
            [ind.bollingerBands.upper, PRECIO_BEZ * 1.05],
            [ind.bollingerBands.lower, PRECIO_BEZ * 0.95],
            [result.data.support, PRECIO_BEZ * 0.9],
            [result.data.resistance, PRECIO_BEZ * 1.1],
        ];

        for (const [valor, real] of esperado) {
            expect(Math.abs(valor - real) / real).toBeLessThan(0.0001);
        }
    });

    it('no colapsa los indicadores a dos cifras significativas', () => {
        // Con toFixed(4) sma20 daba 0,0073 en lugar de 0,00735.
        expect(redondearPrecio(PRECIO_BEZ * 0.98)).not.toBe(0.0073);
    });
});
