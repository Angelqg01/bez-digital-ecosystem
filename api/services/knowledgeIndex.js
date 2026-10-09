'use strict';

/**
 * services/knowledgeIndex.js — RAG local de coste cero sobre docs/**.md.
 *
 * Recuperación léxica BM25 en memoria: sin embeddings, sin ChromaDB, sin
 * llamadas a ningún LLM. El «coste» de buscar es CPU del propio proceso, y el
 * índice se reconstruye como mucho una vez cada TTL. Un agente con MCP obtiene
 * los fragmentos relevantes y es SU modelo quien redacta: BeZhas no paga tokens.
 *
 * Sólo se sirve a claves internas (scope `admin`, ver config/mcp-tools.js): docs/
 * incluye material interno que no es de cara a clientes.
 */

const fs = require('fs');
const path = require('path');

const RAIZ = process.env.KNOWLEDGE_DOCS_DIR || path.resolve(__dirname, '../../docs');
const TTL_MS = parseInt(process.env.KNOWLEDGE_INDEX_TTL_MS || String(10 * 60 * 1000), 10);
const MAX_ARCHIVO_BYTES = 400 * 1024;
const MAX_CHUNK = 1200;
const K1 = 1.4;
const B = 0.75;
// Nombres que no se indexan nunca, por si alguien deja un volcado en docs/.
const VETADOS = /secret|credential|password|seed|mnemonic|private[-_ ]?key|wallet[-_ ]?backup|\.env/i;
const OMITIR_DIRS = new Set(['node_modules', '.git', 'obsidian-vault']);

const VACIAS = new Set(['de', 'la', 'el', 'en', 'y', 'a', 'los', 'las', 'un', 'una', 'que', 'por', 'con', 'para', 'del',
    'se', 'es', 'al', 'lo', 'the', 'of', 'and', 'to', 'in', 'is', 'for', 'on', 'a', 'an', 'or']);

let indice = null;
let construidoEn = 0;

function tokens(texto) {
    return String(texto).toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .split(/[^a-z0-9_]+/)
        .filter((t) => t.length > 1 && !VACIAS.has(t));
}

function* archivosMd(dir, profundidad = 0) {
    if (profundidad > 6) return;
    let entradas;
    try { entradas = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entradas) {
        if (e.isSymbolicLink()) continue;
        const ruta = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (!OMITIR_DIRS.has(e.name)) yield* archivosMd(ruta, profundidad + 1);
        } else if (e.name.endsWith('.md') && !VETADOS.test(e.name)) {
            yield ruta;
        }
    }
}

/** Parte por encabezados y recorta cada trozo a MAX_CHUNK. */
function trocear(texto) {
    const trozos = [];
    let titulo = '';
    let acum = [];
    const cerrar = () => {
        const cuerpo = acum.join('\n').trim();
        for (let i = 0; i < cuerpo.length; i += MAX_CHUNK) {
            const parte = cuerpo.slice(i, i + MAX_CHUNK);
            if (parte.trim()) trozos.push({ titulo, texto: parte });
        }
        acum = [];
    };
    for (const linea of texto.split('\n')) {
        const h = /^#{1,3}\s+(.*)/.exec(linea);
        if (h) { cerrar(); titulo = h[1].trim(); }
        acum.push(linea);
    }
    cerrar();
    return trozos;
}

/** Construye un índice BM25 a partir de trozos {archivo, titulo, texto, ...extra}. */
function indexar(trozos) {
    const docs = [];
    const df = new Map();
    for (const t of trozos) {
        const toks = tokens(`${t.titulo || ''} ${t.titulo || ''} ${t.texto}`);
        if (toks.length === 0) continue;
        const tf = new Map();
        for (const k of toks) tf.set(k, (tf.get(k) || 0) + 1);
        for (const k of tf.keys()) df.set(k, (df.get(k) || 0) + 1);
        docs.push({ ...t, tf, len: toks.length });
    }
    const media = docs.reduce((s, d) => s + d.len, 0) / (docs.length || 1);
    return { docs, df, media };
}

function construir() {
    const trozos = [];
    for (const ruta of archivosMd(RAIZ)) {
        let texto;
        try {
            if (fs.statSync(ruta).size > MAX_ARCHIVO_BYTES) continue;
            texto = fs.readFileSync(ruta, 'utf8');
        } catch { continue; }
        const rel = path.relative(RAIZ, ruta);
        for (const t of trocear(texto)) trozos.push({ archivo: rel, titulo: t.titulo, texto: t.texto });
    }
    return indexar(trozos);
}

function obtener() {
    if (!indice || Date.now() - construidoEn > TTL_MS) {
        indice = construir();
        construidoEn = Date.now();
    }
    return indice;
}

/** @returns {{fragmentos: Array, indexados: number}} */
function buscar(consulta, limite = 5) {
    return buscarEn(obtener(), consulta, limite);
}

/** BM25 sobre un índice concreto (el de docs/ o uno propio, como el del chat público). */
function buscarEn(indice, consulta, limite = 5) {
    const { docs, df, media } = indice;
    const q = [...new Set(tokens(consulta))];
    if (q.length === 0) return { fragmentos: [], indexados: docs.length };
    const N = docs.length;
    const puntuados = [];
    for (const d of docs) {
        let score = 0;
        for (const termino of q) {
            const f = d.tf.get(termino);
            if (!f) continue;
            const idf = Math.log(1 + (N - df.get(termino) + 0.5) / (df.get(termino) + 0.5));
            score += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + B * (d.len / media))));
        }
        if (score > 0) puntuados.push({ d, score });
    }
    puntuados.sort((a, b) => b.score - a.score);
    return {
        indexados: N,
        fragmentos: puntuados.slice(0, Math.min(Math.max(limite, 1), 10)).map(({ d, score }) => ({
            archivo: d.archivo,
            seccion: d.titulo || null,
            puntuacion: Math.round(score * 100) / 100,
            texto: d.texto.length > 900 ? `${d.texto.slice(0, 900)}…` : d.texto,
            ...(d.enlace ? { enlace: d.enlace } : {}),
        })),
    };
}

/** Sólo para tests. */
function reiniciar() { indice = null; construidoEn = 0; }

module.exports = { buscar, buscarEn, indexar, reiniciar, tokens };
