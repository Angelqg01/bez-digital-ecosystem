import { describe, expect, test } from 'vitest';
import { sugerirPrecioBez, bezAUsd, equivalencias, TOLERANCIA_PCT } from './rwaPricing';

const P = 0.0075; // precio real del BEZ en la fase semilla

describe('sugerirPrecioBez', () => {
    test('1.000.000 USD en 10.000 fracciones = 100 USD cada una = 13.333,33 BEZ', () => {
        expect(sugerirPrecioBez({ valoracionUsd: 1_000_000, fracciones: 10_000, precioBezUsd: P })).toBe('13333.33');
    });
    test('acepta texto (los inputs del formulario) y 100.000 fracciones', () => {
        expect(sugerirPrecioBez({ valoracionUsd: '1000000', fracciones: '100000', precioBezUsd: P })).toBe('1333.33');
    });
    test('sin precio, sin fracciones o sin valoración no hay sugerencia', () => {
        expect(sugerirPrecioBez({ valoracionUsd: 1e6, fracciones: 1000, precioBezUsd: null })).toBeNull();
        expect(sugerirPrecioBez({ valoracionUsd: 1e6, fracciones: 0, precioBezUsd: P })).toBeNull();
        expect(sugerirPrecioBez({ valoracionUsd: '', fracciones: 1000, precioBezUsd: P })).toBeNull();
        expect(sugerirPrecioBez({ valoracionUsd: 1e6, fracciones: 1000, precioBezUsd: 0 })).toBeNull();
    });
});

describe('bezAUsd', () => {
    test('100 BEZ = 0,75 USD', () => expect(bezAUsd(100, P)).toBeCloseTo(0.75, 10));
    test('sin precio, null', () => { expect(bezAUsd(100, null)).toBeNull(); expect(bezAUsd('x', P)).toBeNull(); });
});

describe('equivalencias', () => {
    test('con el precio sugerido cuadra con la valoración', () => {
        const e = equivalencias({ fracciones: 10_000, precioFraccionBez: '13333.33', valoracionUsd: 1_000_000, precioBezUsd: P });
        expect(e.precioFraccionUsd).toBeCloseTo(100, 2);
        expect(e.capitalUsd).toBeCloseTo(1_000_000, -1);
        expect(e.valorFraccionUsd).toBe(100);
        expect(e.cuadra).toBe(true);
        expect(Math.abs(e.desviacionPct)).toBeLessThan(0.01);
    });
    test('100 BEZ por fracción en 1.000 fracciones recauda 750 USD de un activo de 1.000.000: no cuadra', () => {
        const e = equivalencias({ fracciones: 1000, precioFraccionBez: 100, valoracionUsd: 1_000_000, precioBezUsd: P });
        expect(e.capitalUsd).toBeCloseTo(750, 6);
        expect(e.cuadra).toBe(false);
        expect(e.desviacionPct).toBeCloseTo(-99.925, 3);
    });
    test('la tolerancia es del 5 %', () => {
        const justo = equivalencias({ fracciones: 1000, precioFraccionBez: (1000 * (1 + TOLERANCIA_PCT / 100)) / P, valoracionUsd: 1_000_000, precioBezUsd: P });
        expect(justo.cuadra).toBe(true);
        const fuera = equivalencias({ fracciones: 1000, precioFraccionBez: (1000 * 1.06) / P, valoracionUsd: 1_000_000, precioBezUsd: P });
        expect(fuera.cuadra).toBe(false);
    });
    test('sin precio del BEZ no hay equivalencias; sin valoración, no hay juicio', () => {
        expect(equivalencias({ fracciones: 1000, precioFraccionBez: 100, valoracionUsd: 1e6, precioBezUsd: null })).toBeNull();
        const e = equivalencias({ fracciones: 1000, precioFraccionBez: 100, valoracionUsd: '', precioBezUsd: P });
        expect(e.cuadra).toBeNull();
        expect(e.desviacionPct).toBeNull();
    });
});
