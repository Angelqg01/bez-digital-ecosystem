const breaker = require('../../services/marketplace/circuitBreaker');

describe('marketplace circuit breaker', () => {
    beforeEach(() => breaker._estados.clear());

    it('se abre tras UMBRAL fallos seguidos y deja pasar una sola sonda al enfriarse', () => {
        const t0 = 1_000_000;
        for (let i = 0; i < breaker.UMBRAL; i += 1) breaker.fallo('l', t0);
        expect(breaker.permitir('l', t0 + 1)).toBe(false);
        const tarde = t0 + breaker.ENFRIAMIENTO_MS + 1;
        expect(breaker.permitir('l', tarde)).toBe(true);   // sonda
        expect(breaker.permitir('l', tarde + 1)).toBe(false); // las demás esperan
        breaker.fallo('l', tarde + 2);                        // la sonda falla
        expect(breaker.permitir('l', tarde + 3)).toBe(false);
    });

    it('un éxito lo cierra y reinicia la cuenta', () => {
        for (let i = 0; i < breaker.UMBRAL - 1; i += 1) breaker.fallo('l');
        breaker.exito('l');
        breaker.fallo('l');
        expect(breaker.permitir('l')).toBe(true);
    });
});
