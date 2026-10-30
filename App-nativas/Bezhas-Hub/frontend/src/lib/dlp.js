/**
 * DLP del chat: detecta secretos y datos financieros ANTES de que el mensaje salga del navegador.
 * Se ejecuta en el cliente a propósito: si el dato llega al servidor, al modelo o a un log, ya no se puede retirar.
 *
 * Detecta: IBAN (con dígito de control), tarjeta (Luhn), JWT, claves de API, cabeceras Bearer, claves privadas
 * (PEM o 0x + 64 hex), frases semilla y «contraseña: …». Está pensado para tener pocos falsos positivos: un
 * número cualquiera o una dirección de wallet (0x + 40 hex) no se tocan.
 */

const mod97 = (iban) => {
    const s = iban.replace(/\s+/g, '').toUpperCase();
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s)) return false;
    const r = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, (c) => c.charCodeAt(0) - 55);
    let rem = 0;
    for (let i = 0; i < r.length; i += 7) rem = Number(String(rem) + r.slice(i, i + 7)) % 97;
    return rem === 1;
};

const luhn = (digits) => {
    let sum = 0;
    let alt = false;
    for (let i = digits.length - 1; i >= 0; i--) {
        let n = Number(digits[i]);
        if (alt) { n *= 2; if (n > 9) n -= 9; }
        sum += n;
        alt = !alt;
    }
    return sum % 10 === 0;
};

/**
 * El patrón del IBAN es holgado (el último grupo es opcional y puede arrastrar la palabra siguiente):
 * se devuelve la longitud del prefijo más largo que sí pasa el dígito de control, o false.
 */
const ibanPrefix = (m) => {
    for (let end = m.length; end >= 15; end--) {
        if (m[end - 1] !== ' ' && mod97(m.slice(0, end))) return end;
    }
    return false;
};

/** Cada regla: etiqueta legible, patrón global y, si hace falta, validación del acierto. */
const RULES = [
    { type: 'private_key', label: 'clave privada', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g },
    { type: 'private_key', label: 'clave privada', re: /\b0x[0-9a-fA-F]{64}\b/g },
    { type: 'jwt', label: 'token JWT', re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
    { type: 'bearer', label: 'token de acceso', re: /\bBearer\s+[A-Za-z0-9._~+/-]{16,}=*/gi },
    { type: 'api_key', label: 'clave de API', re: /\b(?:sk|pk|rk)[-_](?:live|test|prod)?[-_]?[A-Za-z0-9]{20,}\b/g },
    { type: 'api_key', label: 'clave de API', re: /\b(?:AIza[0-9A-Za-z_-]{30,}|ghp_[A-Za-z0-9]{30,}|xox[baprs]-[A-Za-z0-9-]{10,})\b/g },
    { type: 'iban', label: 'IBAN', re: /\b[A-Za-z]{2}\d{2}(?:[ ]?[A-Za-z0-9]{4}){2,7}(?:[ ]?[A-Za-z0-9]{1,4})?\b/g, check: ibanPrefix },
    { type: 'card', label: 'número de tarjeta', re: /\b(?:\d[ -]?){13,19}\b/g, check: (m) => { const d = m.replace(/[ -]/g, ''); return d.length >= 13 && d.length <= 19 && luhn(d); } },
    { type: 'password', label: 'contraseña', re: /\b(?:contrase(?:ñ|n)a|password|passwd|clave de acceso|pin)\s*(?:es|is|:|=)\s*\S{3,}/gi },
];

/** Doce o 24 palabras sueltas en minúsculas y sin puntuación: forma de una frase semilla. */
function looksLikeSeedPhrase(text) {
    const words = text.trim().split(/\s+/);
    if (![12, 15, 18, 21, 24].includes(words.length)) return false;
    return words.every((w) => /^[a-z]{3,8}$/.test(w));
}

/**
 * @returns {{ type: string, label: string, start: number, end: number }[]} sin solapes, ordenados por posición
 */
export function scanSecrets(text) {
    const src = String(text || '');
    const hits = [];
    for (const rule of RULES) {
        rule.re.lastIndex = 0;
        let m;
        while ((m = rule.re.exec(src)) !== null) {
            if (m[0].length === 0) { rule.re.lastIndex++; continue; }
            let len = m[0].length;
            if (rule.check) {
                const ok = rule.check(m[0]);
                if (!ok) continue;
                if (typeof ok === 'number') len = ok;
            }
            hits.push({ type: rule.type, label: rule.label, start: m.index, end: m.index + len });
        }
    }
    if (looksLikeSeedPhrase(src)) hits.push({ type: 'seed', label: 'frase semilla', start: 0, end: src.length });
    hits.sort((a, b) => a.start - b.start || b.end - a.end);
    const out = [];
    for (const h of hits) {
        const last = out[out.length - 1];
        if (!last || h.start >= last.end) out.push(h);
    }
    return out;
}

/** Sustituye cada hallazgo por un marcador. El texto original no se conserva en ninguna parte. */
export function redactSecrets(text) {
    const src = String(text || '');
    let out = '';
    let pos = 0;
    for (const h of scanSecrets(src)) {
        out += src.slice(pos, h.start) + `[${h.label} retirado]`;
        pos = h.end;
    }
    return out + src.slice(pos);
}

/** Etiquetas distintas encontradas, para el aviso («IBAN y token JWT»). */
export function describeFindings(findings) {
    const labels = [...new Set(findings.map((f) => f.label))];
    if (labels.length <= 1) return labels[0] || '';
    return `${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]}`;
}
