'use strict';

/**
 * Booking (TX002) y contenedores (TX003).
 *
 * El grueso de las pruebas está en la validación ISO 6346: es la única parte
 * con una respuesta objetivamente correcta contra la que contrastar, y la que
 * evita que una errata de teclado llegue a la cadena, donde ya no se corrige.
 */

const {
  validateContainerNo, checkDigit, letterValue, CATEGORIES,
} = require('../../services/cargoLinkBooking');

describe('ISO 6346 — tabla de valores de letra', () => {
  it('reproduce la tabla de la norma, que salta los múltiplos de 11', () => {
    // 11, 22 y 33 se omiten porque el módulo final es 11 y serían
    // indistinguibles del 0. Por eso B vale 12 y no 11, y L vale 23 y no 22.
    const oficial = {
      A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18, I: 19,
      J: 20, K: 21, L: 23, M: 24, N: 25, O: 26, P: 27, Q: 28, R: 29,
      S: 30, T: 31, U: 32, V: 34, W: 35, X: 36, Y: 37, Z: 38,
    };
    for (const [letra, valor] of Object.entries(oficial)) {
      expect(letterValue(letra)).toBe(valor);
    }
  });

  it('ningún valor es múltiplo de 11', () => {
    for (const l of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
      expect(letterValue(l) % 11).not.toBe(0);
    }
  });

  it('devuelve null para lo que no es una letra', () => {
    expect(letterValue('1')).toBeNull();
    expect(letterValue('ñ')).toBeNull();
  });
});

describe('ISO 6346 — validación de número de contenedor', () => {
  it('acepta números reales con dígito de control correcto', () => {
    // CSQU3054383 es el ejemplo canónico de la propia norma.
    for (const n of ['CSQU3054383', 'MSKU0839016', 'TGHU7157370']) {
      expect(validateContainerNo(n).valid).toBe(true);
    }
  });

  it('rechaza un dígito de control incorrecto y dice cuál era el bueno', () => {
    // Mismo número que el canónico con el último dígito cambiado: es
    // exactamente el error que comete alguien tecleando.
    const r = validateContainerNo('CSQU3054384');
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/check digit/);
    expect(r.expected).toBe(3);
  });

  it('detecta una errata en medio del número, no sólo al final', () => {
    // Cambiar un dígito interior también rompe el control: esa es la razón
    // de ser del dígito.
    expect(validateContainerNo('CSQU3054283').valid).toBe(false);
  });

  it('exige que la cuarta letra sea una categoría de equipo válida', () => {
    // U = contenedor de carga, J = equipo desmontable, Z = chasis.
    const r = validateContainerNo('CSQA3054383');
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/U, J or Z/);
  });

  it('rechaza formatos que no son 4 letras + 7 dígitos', () => {
    for (const malo of ['CSQU305438', 'CSQU30543831', 'CSU U3054383', '', null, 'ABCD123456X']) {
      expect(validateContainerNo(malo).valid).toBe(false);
    }
  });

  it('normaliza minúsculas y espacios antes de validar', () => {
    const r = validateContainerNo(' csqu 3054383 ');
    expect(r.valid).toBe(true);
    expect(r.normalized).toBe('CSQU3054383');
  });

  it('un resto de 10 se representa como 0, no como 10', () => {
    // Es el único caso especial de la norma y el que más implementaciones
    // se dejan: checkDigit nunca puede devolver 10.
    for (const prefijo of ['CSQU305438', 'MSKU083901', 'TGHU715737', 'ABCU000000']) {
      const d = checkDigit(prefijo);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(9);
    }
  });
});

describe('categorías de contenedor', () => {
  it('cubre los tipos que aparecen en tráfico portuario real', () => {
    for (const c of ['DRY', 'REEFER', 'TANK', 'OPEN_TOP', 'FLAT_RACK']) {
      expect(CATEGORIES.has(c)).toBe(true);
    }
  });
});
