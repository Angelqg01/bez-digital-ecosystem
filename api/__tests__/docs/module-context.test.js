/**
 * Los CLAUDE.md de cada módulo son el contexto que leen los agentes y el RAG interno. Un fichero o
 * un comando inventado ahí se ejecuta tal cual: el CLAUDE.md raíz llegó a describir directorios
 * (`BeZhas Web/bezhas-web3`) y comandos (`node sync-daemon.js`) que no existían.
 *
 * Este test comprueba que cada ruta y cada `pnpm <script>` que citan los CLAUDE.md de los módulos
 * existen de verdad.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..', '..');
const MODULOS = [
    'api',
    'smart-contracts',
    'control-center/frontend',
    'business-ops',
    'App-nativas/Bezhas-Hub',
];

// Lo que se menciona a propósito aunque no esté versionado o no exista siempre.
const NO_VERSIONADO = [/\.env/, /\.keys/, /^AGENTS\.md$/];
// Comandos propios de pnpm: no son scripts del package.json.
const PNPM_NATIVOS = new Set(['install', 'add', 'exec', 'why', 'audit', 'dlx', 'approve-builds', 'i']);

const leerJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };

/** Directorios contra los que se resuelve una ruta citada en el CLAUDE.md de un módulo. */
function basesDe(modulo) {
    const dir = path.join(RAIZ, modulo);
    const subs = ['frontend', 'backend', 'src', 'frontend/src', 'backend/src']
        .map((s) => path.join(dir, s)).filter((d) => fs.existsSync(d));
    return [dir, ...subs, RAIZ];
}

/** Scripts disponibles: los del módulo, los de sus subcarpetas y los de la raíz del repo. */
function scriptsDe(modulo) {
    const dir = path.join(RAIZ, modulo);
    const fuentes = [dir, path.join(dir, 'frontend'), path.join(dir, 'backend'), RAIZ];
    return new Set(fuentes.flatMap((d) => Object.keys((leerJson(path.join(d, 'package.json')) || {}).scripts || {})));
}

const CANDIDATO = /^[A-Za-z0-9_@.()\[\]/-]+(\.(js|cjs|mjs|ts|tsx|jsx|sol|md|json|yml|yaml|sh|sql|css))$|^[A-Za-z0-9_@.()\[\]-]+(\/[A-Za-z0-9_@.()\[\]-]+)*\/$/;

function rutasCitadas(texto) {
    const out = new Set();
    for (const m of texto.matchAll(/`([^`\n]+)`/g)) {
        const t = m[1].trim();
        if (/[\s*<>${}|:=]/.test(t) || /^https?:/.test(t)) continue;
        if (NO_VERSIONADO.some((re) => re.test(t))) continue;
        if (CANDIDATO.test(t)) out.add(t);
    }
    // Enlaces Markdown [texto](ruta)
    for (const m of texto.matchAll(/\]\(([^)#\s]+)\)/g)) {
        if (!/^https?:/.test(m[1])) out.add(m[1]);
    }
    return [...out];
}

function scriptsCitados(texto) {
    const out = new Set();
    for (const m of texto.matchAll(/\bpnpm\s+(?:run\s+)?([A-Za-z][\w:.-]*)/g)) {
        if (!PNPM_NATIVOS.has(m[1])) out.add(m[1]);
    }
    return [...out];
}

describe.each(MODULOS)('CLAUDE.md de %s', (modulo) => {
    const fichero = path.join(RAIZ, modulo, 'CLAUDE.md');
    const texto = fs.existsSync(fichero) ? fs.readFileSync(fichero, 'utf8') : '';

    test('existe y no está vacío', () => {
        expect(texto.length).toBeGreaterThan(500);
    });

    test('cada ruta que cita existe', () => {
        const bases = basesDe(modulo);
        const inexistentes = rutasCitadas(texto).filter((r) => !bases.some((b) => fs.existsSync(path.resolve(b, r))));
        expect(inexistentes).toEqual([]);
    });

    test('cada script de pnpm que cita existe en un package.json', () => {
        const disponibles = scriptsDe(modulo);
        const inexistentes = scriptsCitados(texto).filter((s) => !disponibles.has(s));
        expect(inexistentes).toEqual([]);
    });
});

test('el CLAUDE.md raíz remite a los de los módulos que existen', () => {
    for (const m of MODULOS) expect(fs.existsSync(path.join(RAIZ, m, 'CLAUDE.md'))).toBe(true);
});
