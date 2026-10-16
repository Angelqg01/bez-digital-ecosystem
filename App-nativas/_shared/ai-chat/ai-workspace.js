/**
 * Lógica del chat de la plataforma (BeZhas AI) para las SubApps Vite: parser SSE, Markdown seguro, clasificación de
 * enlaces y cliente HTTP. Sin React y sin dependencias.
 *
 * ES UN PORT de control-center/frontend/lib/ai-workspace.ts (el chat de www.bezhas.com). Las dos copias se comprueban
 * con los MISMOS casos (ver __tests__/ai-chat.test.mjs y control-center/frontend/__tests__/lib/ai-workspace.test.ts,
 * que leen __tests__/fixtures/chat-markdown.json): si cambias una, cambia la otra.
 *
 * El servidor ya sanea la salida del modelo; aquí se vuelve a escapar TODO el HTML y sólo se pintan como enlace las
 * rutas internas y https://(www.)bezhas.com. Cualquier otro destino queda como texto.
 */

export const FREE_KEY = 'bezhas_ai_free_used';

/** Marca local de «pregunta gratis usada». Sólo para la interfaz: quien decide es el servidor. */
export function freeQuestionUsed() {
    try { return typeof window !== 'undefined' && window.localStorage.getItem(FREE_KEY) === '1'; } catch { return false; }
}
export function markFreeQuestionUsed() {
    try { window.localStorage.setItem(FREE_KEY, '1'); } catch { /* almacenamiento bloqueado */ }
}

/** Línea de consumo bajo una respuesta. */
export function describeUsage(u) {
    const acciones = u.limit === null ? `${u.used} acciones de IA este mes` : `${u.used} de ${u.limit} acciones de IA este mes`;
    return u.payg ? `${acciones} · ${u.credits} créditos (${u.billableEUR.toLocaleString('es-ES', { maximumFractionDigits: 4 })} €)` : acciones;
}

/** Parser SSE incremental: acumula trozos y emite { event, data } por cada bloque completo. */
export function createSseParser(onEvent) {
    let buf = '';
    return (chunk) => {
        buf += chunk.replace(/\r\n/g, '\n');
        let i;
        while ((i = buf.indexOf('\n\n')) !== -1) {
            const block = buf.slice(0, i);
            buf = buf.slice(i + 2);
            let event = 'message';
            const data = [];
            for (const line of block.split('\n')) {
                if (line.startsWith('event:')) event = line.slice(6).trim();
                else if (line.startsWith('data:')) data.push(line.slice(5).trim());
            }
            if (!data.length) continue;
            try { onEvent({ event, data: JSON.parse(data.join('\n')) }); } catch { /* bloque no JSON */ }
        }
    };
}

const TRUSTED_HOSTS = ['bezhas.com', 'www.bezhas.com', 'mcp.bezhas.com'];

/** Destino de un enlace del modelo: ruta interna, dominio propio o bloqueado. */
export function classifyLink(href) {
    const h = String(href || '').trim();
    if (/^\/(?!\/)[A-Za-z0-9\-._~/?#=&%]*$/.test(h) && !h.includes('..') && !h.includes('\\')) return { type: 'internal', href: h };
    try {
        const u = new URL(h);
        if (u.protocol === 'https:' && !u.username && !u.password && !u.port && TRUSTED_HOSTS.includes(u.hostname.toLowerCase())) {
            return { type: 'external', href: u.toString() };
        }
    } catch { /* no es URL */ }
    return { type: 'blocked' };
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => s.replace(/[&<>"']/g, (c) => ESC[c]);

function inline(text) {
    // Se escapa primero; los patrones trabajan sobre texto ya escapado.
    let out = esc(text);
    out = out.replace(/`([^`]{1,500})`/g, '<code>$1</code>');
    out = out.replace(/\*\*([^*]{1,500})\*\*/g, '<strong>$1</strong>');
    out = out.replace(/(^|[^*])\*([^*\n]{1,500})\*/g, '$1<em>$2</em>');
    out = out.replace(/\[([^\]]{1,300})\]\(([^)\s]{1,2000})\)/g, (_m, label, rawHref) => {
        const href = rawHref.replace(/&amp;/g, '&');
        const d = classifyLink(href);
        if (d.type === 'internal') return `<a href="${esc(d.href)}">${label}</a>`;
        if (d.type === 'external') return `<a href="${esc(d.href)}" target="_blank" rel="noopener noreferrer nofollow">${label}</a>`;
        return label;
    });
    return out;
}

/** Markdown → HTML seguro (subconjunto: párrafos, títulos, listas, código, negrita, cursiva, enlaces). */
export function renderChatMarkdown(src) {
    const lines = String(src || '').replace(/\r\n/g, '\n').split('\n');
    const html = [];
    let list = null;
    let code = null;
    const closeList = () => { if (list) { html.push(`</${list}>`); list = null; } };

    for (const line of lines) {
        if (line.trim().startsWith('```')) {
            if (code) { html.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`); code = null; }
            else { closeList(); code = []; }
            continue;
        }
        if (code) { code.push(line); continue; }
        const h = /^(#{1,4})\s+(.+)$/.exec(line);
        const ul = /^\s*[-*]\s+(.+)$/.exec(line);
        const ol = /^\s*\d+[.)]\s+(.+)$/.exec(line);
        if (h) { closeList(); html.push(`<p class="font-semibold">${inline(h[2])}</p>`); }
        else if (ul) { if (list !== 'ul') { closeList(); html.push('<ul>'); list = 'ul'; } html.push(`<li>${inline(ul[1])}</li>`); }
        else if (ol) { if (list !== 'ol') { closeList(); html.push('<ol>'); list = 'ol'; } html.push(`<li>${inline(ol[1])}</li>`); }
        else if (!line.trim()) closeList();
        else { closeList(); html.push(`<p>${inline(line)}</p>`); }
    }
    if (code) html.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
    closeList();
    return html.join('');
}

/**
 * Cliente del chat para una API concreta. `apiBase` es el origen sin `/api` (p. ej. https://api.bezhas.com).
 * `aiFetch` es una petición JSON autenticada que lanza Error con el mensaje del servidor.
 */
export function createAiClient(apiBase) {
    const base = String(apiBase || '').replace(/\/+$/, '').replace(/\/api$/, '');
    const AI_BASE = `${base}/api/ai-workspace`;
    async function aiFetch(path, token, init = {}) {
        const res = await fetch(`${AI_BASE}${path}`, {
            ...init,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers || {}) },
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw Object.assign(new Error(body.error || `Error ${res.status}`), { status: res.status, upgradeActionId: body.upgradeActionId });
        return body;
    }
    return { AI_BASE, aiFetch };
}

/** Las acciones de tipo «app» son tarjetas de acceso directo a las apps del ecosistema. */
export const esApp = (a) => a && a.kind === 'app';
