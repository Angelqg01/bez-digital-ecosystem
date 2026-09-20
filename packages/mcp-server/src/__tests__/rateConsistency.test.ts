/**
 * Tasas de referencia: una sola tabla para todo el paquete.
 *
 * El MATIC llegó a tener cuatro precios distintos vivos a la vez —0,40 $ en
 * las herramientas de gas, 0,80 $ en las de pago, 0,85 $ y 1,00 $ en el
 * backend— y el ETH tres. El coste que se le reportaba al usuario dependía
 * de qué herramienta hiciera la conversión.
 *
 * Estas pruebas fijan la tabla y vigilan que nadie vuelva a escribir una
 * tasa a mano en el código del servidor MCP.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

const SRC = join(fileURLToPath(new URL('.', import.meta.url)), '..');

function ficherosFuente(dir: string): string[] {
    return readdirSync(dir).flatMap((nombre) => {
        const ruta = join(dir, nombre);
        if (statSync(ruta).isDirectory()) {
            return nombre === '__tests__' ? [] : ficherosFuente(ruta);
        }
        return ruta.endsWith('.ts') ? [ruta] : [];
    });
}

/** Quita comentarios: documentan de dónde venimos y pueden citar los valores viejos. */
function sinComentarios(texto: string): string {
    return texto
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .filter((linea) => !linea.trimStart().startsWith('//'))
        .join('\n');
}

describe('config.rates · tabla única', () => {
    it('declara todas las divisas que usan las herramientas', () => {
        for (const simbolo of ['USD', 'USDT', 'USDC', 'EUR', 'GBP', 'MXN', 'MATIC', 'ETH', 'BTC', 'BNB']) {
            const tasa = config.rates.usdPerUnit[simbolo];
            expect({ simbolo, valida: Number.isFinite(tasa) && tasa > 0 })
                .toEqual({ simbolo, valida: true });
        }
    });

    it('mantiene las stablecoins a la par con el dólar', () => {
        expect(config.rates.usdPerUnit.USD).toBe(1);
        expect(config.rates.usdPerUnit.USDT).toBe(1);
        expect(config.rates.usdPerUnit.USDC).toBe(1);
    });

    it('avisa de que no son cotizaciones de mercado', () => {
        expect(config.rates.disclaimer).toMatch(/no cotizaciones de mercado/i);
    });
});

describe('ninguna tasa escrita a mano en el código', () => {
    const TASAS_ANTIGUAS = [
        { patron: /maticPrice(USD)?\s*[=:]\s*0\.40\b/, etiqueta: 'MATIC a 0,40 $' },
        { patron: /maticPrice(USD)?\s*[=:]\s*0\.85\b/, etiqueta: 'MATIC a 0,85 $' },
        { patron: /\|\|\s*0\.40\b/, etiqueta: 'MATIC a 0,40 $ como fallback' },
        { patron: /\bMATIC\s*:\s*0\.[0-9]/, etiqueta: 'tabla de tasas con MATIC propio' },
        { patron: /\bETH\s*:\s*[0-9]{4}\b/, etiqueta: 'tabla de tasas con ETH propio' },
        { patron: /\bMXN\s*:\s*17\.15\b/, etiqueta: 'tabla fiat propia' },
    ];

    const fuentes = ficherosFuente(SRC).filter((f) => !f.endsWith('config.ts'));

    it('encuentra ficheros que revisar', () => {
        expect(fuentes.length).toBeGreaterThan(5);
    });

    it.each(TASAS_ANTIGUAS)('ningún fichero lleva $etiqueta', ({ patron, etiqueta }) => {
        const culpables = fuentes
            .filter((f) => patron.test(sinComentarios(readFileSync(f, 'utf8'))))
            .map((f) => relative(SRC, f));

        expect({ etiqueta, culpables }).toEqual({ etiqueta, culpables: [] });
    });
});
