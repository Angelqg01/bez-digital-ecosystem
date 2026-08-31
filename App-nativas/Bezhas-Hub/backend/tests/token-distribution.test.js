/**
 * @fileoverview Test para Token Distribution Service
 * @description Verifica el cálculo y distribución de tokens con burn + treasury
 */

const { calculateDistribution, simulateDistribution, getDistributionStats, BURN_RATE, TREASURY_RATE } = require('../services/token-distribution.service');

describe('Token Distribution Service', () => {

    describe('calculateDistribution', () => {

        test('debe calcular correctamente la distribución para 100,000 BEZ', () => {
            const result = calculateDistribution(100000);

            // Verificar totales
            expect(result.total).toBe(100000);

            // Verificar rates
            expect(result.rates.burnPercent).toBe(0.2);
            expect(result.rates.treasuryPercent).toBe(1);
            expect(result.rates.userPercent).toBe(98.8);

            // Verificar montos
            expect(result.burn).toBe(200);        // 0.2% de 100,000
            expect(result.treasury).toBe(1000);   // 1% de 100,000
            expect(result.user).toBe(98800);      // 98.8% de 100,000

            // Verificar que suma el total
            expect(result.user + result.burn + result.treasury).toBe(result.total);
        });

        test('debe calcular correctamente para montos pequeños', () => {
            const result = calculateDistribution(1000);

            expect(result.burn).toBe(2);          // 0.2% de 1,000
            expect(result.treasury).toBe(10);     // 1% de 1,000
            expect(result.user).toBe(988);        // 98.8% de 1,000
        });

        test('debe calcular correctamente para montos grandes', () => {
            const result = calculateDistribution(1000000);

            expect(result.burn).toBe(2000);       // 0.2% de 1,000,000
            expect(result.treasury).toBe(10000);  // 1% de 1,000,000
            expect(result.user).toBe(988000);     // 98.8% de 1,000,000
        });

        test('debe manejar decimales correctamente', () => {
            const result = calculateDistribution(12345.67);

            // Verificar que los montos son números válidos
            expect(typeof result.burn).toBe('number');
            expect(typeof result.treasury).toBe('number');
            expect(typeof result.user).toBe('number');

            // Verificar que suma aproximadamente el total
            const sum = result.user + result.burn + result.treasury;
            expect(Math.abs(sum - result.total)).toBeLessThan(0.01);
        });

    });

    describe('simulateDistribution', () => {

        test('debe retornar la misma estructura que calculateDistribution', () => {
            const simulated = simulateDistribution(50000);
            const calculated = calculateDistribution(50000);

            expect(simulated).toEqual(calculated);
        });

    });

    describe('getDistributionStats', () => {

        test('debe retornar configuración válida', () => {
            const stats = getDistributionStats();

            // Verificar estructura
            expect(stats).toHaveProperty('rates');
            expect(stats).toHaveProperty('addresses');
            expect(stats).toHaveProperty('enabled');

            // Verificar rates
            expect(stats.rates.burn).toBe('0.2%');
            expect(stats.rates.treasury).toBe('1%');
            expect(stats.rates.user).toBe('98.8%');

            // Verificar addresses
            expect(stats.addresses.burn).toBeDefined();
            expect(stats.addresses.treasury).toBeDefined();
            expect(stats.addresses.token).toBeDefined();
        });

    });

    describe('Constantes exportadas', () => {

        test('BURN_RATE debe ser 20 (0.2% en base 10000)', () => {
            expect(BURN_RATE).toBe(20);
        });

        test('TREASURY_RATE debe ser 100 (1% en base 10000)', () => {
            expect(TREASURY_RATE).toBe(100);
        });

    });

    describe('Escenarios de negocio', () => {

        test('compra de €1000 en BEZ (precio 0.000694 EUR)', () => {
            const priceEUR = 0.000694;
            const eurAmount = 1000;
            const bezAmount = eurAmount / priceEUR; // ~1,440,922 BEZ

            const result = calculateDistribution(bezAmount);

            // El usuario debe recibir 98.8%
            expect(result.user / result.total).toBeCloseTo(0.988, 2);

            // Burn debe ser 0.2%
            expect(result.burn / result.total).toBeCloseTo(0.002, 3);

            // Treasury debe ser 1%
            expect(result.treasury / result.total).toBeCloseTo(0.01, 2);
        });

        test('compra mínima de €10', () => {
            const priceEUR = 0.000694;
            const eurAmount = 10;
            const bezAmount = eurAmount / priceEUR; // ~14,409 BEZ

            const result = calculateDistribution(bezAmount);

            // Verificar que incluso montos pequeños se distribuyen correctamente
            expect(result.burn).toBeGreaterThan(0);
            expect(result.treasury).toBeGreaterThan(0);
            expect(result.user).toBeGreaterThan(result.burn + result.treasury);
        });

    });

});
