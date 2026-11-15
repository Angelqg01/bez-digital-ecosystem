/**
 * db/migrate.js registra cada migración por su NOMBRE de fichero completo y las aplica en orden
 * alfabético. Por eso los números repetidos de hoy (002, 008, 074) son inofensivos: tienen nombres
 * distintos y un orden determinista. Y por eso NO se renombran: un fichero renombrado es, para el
 * runner, una migración nueva y se volvería a ejecutar en producción.
 *
 * Este test congela esa herencia: no puede aparecer ningún duplicado más.
 */
const fs = require('fs');
const path = require('path');

const DIR = path.resolve(__dirname, '..', '..', 'db', 'migrations');
const HEREDADOS = new Set(['002', '008', '074']);
const ficheros = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
const numero = (f) => /^(\d+)_/.exec(f)?.[1];

test('todas las migraciones empiezan por un número y un guion bajo', () => {
    expect(ficheros.filter((f) => !numero(f))).toEqual([]);
});

test('no hay números repetidos salvo los tres heredados', () => {
    const vistos = new Map();
    for (const f of ficheros) vistos.set(numero(f), (vistos.get(numero(f)) || 0) + 1);
    const nuevos = [...vistos].filter(([n, veces]) => veces > 1 && !HEREDADOS.has(n)).map(([n]) => n);
    expect(nuevos).toEqual([]);
});

test('los tres duplicados heredados siguen siendo exactamente esos (si se resuelve uno, quitarlo de HEREDADOS)', () => {
    const repetidos = new Set();
    const vistos = new Set();
    for (const f of ficheros) { const n = numero(f); if (vistos.has(n)) repetidos.add(n); vistos.add(n); }
    expect([...repetidos].sort()).toEqual([...HEREDADOS].sort());
});

test('api/CLAUDE.md anuncia como siguiente el número que toca', () => {
    const maximo = Math.max(...ficheros.map((f) => parseInt(numero(f), 10)));
    const claude = fs.readFileSync(path.resolve(__dirname, '..', '..', 'CLAUDE.md'), 'utf8');
    expect(claude).toContain(`la siguiente es la ${String(maximo + 1).padStart(3, '0')}`);
});
