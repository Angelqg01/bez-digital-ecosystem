'use strict';

/**
 * Exporta del vault de Obsidian SOLO lo que se ha marcado como público.
 *
 * El vault es conocimiento interno (decisiones, auto-modelo, memoria de los
 * agentes, notas de infraestructura). La regla es denegar por defecto:
 *   1. La nota lleva `visibility: public` en el frontmatter.
 *   2. No está en una carpeta interna, aunque lo lleve (00, 01, 02, 99, 07).
 *   3. Sólo se publica su sección «## Para clientes», nunca el resto.
 *   4. El texto pasa assertPublicable (sin rutas, puertos, hosts ni secretos).
 *
 * El resultado se guarda en vault-public.json, versionado: lo que pasa a ser
 * público se revisa en el diff del PR, y la imagen de la API no necesita el vault.
 * Regenerar con `node scripts/build-vault-knowledge.js`.
 */
const fs = require('fs');
const path = require('path');
const { assertPublicable } = require('./publicSafety');

const CARPETAS_INTERNAS = ['00-Episodic-Memory', '01-Self-Model', '02-Decisions', '07-Sources', '99-Inbox'];
const SECCION = /^##\s+Para clientes\s*$/im;
const MAX_CHARS = 4000;

function frontmatter(texto) {
    const m = texto.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (!m) return { datos: {}, cuerpo: texto };
    const datos = {};
    for (const linea of m[1].split(/\r?\n/)) {
        const kv = linea.match(/^([\w-]+):\s*(.*)$/);
        if (kv) datos[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
    }
    return { datos, cuerpo: texto.slice(m[0].length) };
}

/** Texto de la sección «## Para clientes» hasta el siguiente encabezado de nivel ≤ 2. */
function seccionClientes(cuerpo) {
    const m = SECCION.exec(cuerpo);
    if (!m) return '';
    const resto = cuerpo.slice(m.index + m[0].length);
    const fin = resto.search(/^#{1,2}\s/m);
    return (fin === -1 ? resto : resto.slice(0, fin)).trim();
}

function titulo(cuerpo, archivo) {
    const h1 = cuerpo.match(/^#\s+(.+)$/m);
    return (h1 ? h1[1] : path.basename(archivo, '.md').replace(/-/g, ' ')).trim();
}

function slug(rel) {
    return `vault_${rel.replace(/\.md$/i, '').replace(/[^\w]+/g, '_').toLowerCase()}`.slice(0, 80);
}

function* recorrer(dir, base = dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name.startsWith('.')) continue;
        const abs = path.join(dir, e.name);
        if (e.isDirectory()) yield* recorrer(abs, base);
        else if (e.name.endsWith('.md')) yield path.relative(base, abs).split(path.sep).join('/');
    }
}

/** Documentos públicos del vault: [{ id, title, content, source }] ordenados por id. */
function exportarVault(vaultRoot) {
    const docs = [];
    for (const rel of recorrer(vaultRoot)) {
        if (CARPETAS_INTERNAS.includes(rel.split('/')[0])) continue;
        const { datos, cuerpo } = frontmatter(fs.readFileSync(path.join(vaultRoot, rel), 'utf8'));
        if (String(datos.visibility || '').toLowerCase() !== 'public') continue;
        const content = seccionClientes(cuerpo);
        if (!content) throw new Error(`${rel} es visibility: public pero no tiene sección «## Para clientes»`);
        if (content.length > MAX_CHARS) throw new Error(`${rel}: la sección pública supera ${MAX_CHARS} caracteres`);
        // public_title: nombre para clientes. Un título con «BeZhas» en cada SubApp le quita a
        // «¿Qué es BeZhas?» su documento (el BM25 pesa el título tres veces).
        const title = datos.public_title || titulo(cuerpo, rel);
        assertPublicable(`${title}\n${content}`, rel);
        docs.push({ id: slug(rel), title, content, source: `vault:${rel}` });
    }
    return docs.sort((a, b) => a.id.localeCompare(b.id));
}

module.exports = { exportarVault, seccionClientes, frontmatter, CARPETAS_INTERNAS };
