/**
 * Cliente del chat de la plataforma (BeZhas AI) y utilidades puras:
 * parser SSE, renderizado Markdown seguro y clasificación de enlaces.
 *
 * El servidor ya sanea la salida del modelo; aquí se vuelve a escapar TODO el
 * HTML y solo se pintan como enlace las rutas internas y https://(www.)bezhas.com.
 * Cualquier otro destino queda como texto.
 */
import { API_BASE } from '@/lib/api';

export const AI_BASE = `${API_BASE}/ai-workspace`;

/** Marca local de "pregunta gratis usada". Solo para la interfaz: quien decide es el servidor. */
export const FREE_KEY = 'bezhas_ai_free_used';
export function freeQuestionUsed(): boolean {
    try { return typeof window !== 'undefined' && window.localStorage.getItem(FREE_KEY) === '1'; } catch { return false; }
}
export function markFreeQuestionUsed(): void {
    try { window.localStorage.setItem(FREE_KEY, '1'); } catch { /* almacenamiento bloqueado */ }
}

export interface ChatSource { ref: number; title: string; section?: string | null; version: number }
export interface ChatAction {
    id: string; kind: 'navigate' | 'docs' | 'plans'; title: string; description: string;
    sensitive: boolean; locked: boolean; lockReason?: string; upgradeActionId?: string; categoryLabel?: string;
}
/** Lo que costó un mensaje al plan del cliente (lo calcula el servidor). */
export interface ChatUsage { credits: number; billableEUR: number; payg: boolean; used: number; limit: number | null }

/** Línea de consumo bajo una respuesta. */
export function describeUsage(u: ChatUsage): string {
    const acciones = u.limit === null ? `${u.used} acciones de IA este mes` : `${u.used} de ${u.limit} acciones de IA este mes`;
    return u.payg ? `${acciones} · ${u.credits} créditos (${u.billableEUR.toLocaleString('es-ES', { maximumFractionDigits: 4 })} €)` : acciones;
}

export interface ChatMessage {
    role: 'user' | 'assistant' | 'notice' | 'cta';
    content: string;
    streaming?: boolean;
    error?: boolean;
    sources?: ChatSource[];
    usage?: ChatUsage;
    actions?: ChatAction[];
}
export interface PlanInfo {
    id: string; name: string; profile: string; priceEUR: number; yearlyEUR: number;
    aiActions: number | null; monthlyUrl: string | null; annualUrl: string | null;
}

/** Parser SSE incremental: acumula trozos y emite { event, data } por cada bloque completo. */
export function createSseParser(onEvent: (ev: { event: string; data: any }) => void) {
    let buf = '';
    return (chunk: string) => {
        buf += chunk.replace(/\r\n/g, '\n');
        let i: number;
        while ((i = buf.indexOf('\n\n')) !== -1) {
            const block = buf.slice(0, i);
            buf = buf.slice(i + 2);
            let event = 'message';
            const data: string[] = [];
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
export function classifyLink(href: string): { type: 'internal' | 'external' | 'blocked'; href?: string } {
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

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

function inline(text: string): string {
    // Se escapa primero; los patrones trabajan sobre texto ya escapado.
    let out = esc(text);
    out = out.replace(/`([^`]{1,500})`/g, '<code>$1</code>');
    out = out.replace(/\*\*([^*]{1,500})\*\*/g, '<strong>$1</strong>');
    out = out.replace(/(^|[^*])\*([^*\n]{1,500})\*/g, '$1<em>$2</em>');
    out = out.replace(/\[([^\]]{1,300})\]\(([^)\s]{1,2000})\)/g, (_m, label: string, rawHref: string) => {
        const href = rawHref.replace(/&amp;/g, '&');
        const d = classifyLink(href);
        if (d.type === 'internal') return `<a href="${esc(d.href!)}">${label}</a>`;
        if (d.type === 'external') return `<a href="${esc(d.href!)}" target="_blank" rel="noopener noreferrer nofollow">${label}</a>`;
        return label;
    });
    return out;
}

/** Markdown → HTML seguro (subconjunto: párrafos, títulos, listas, código, negrita, cursiva, enlaces). */
export function renderChatMarkdown(src: string): string {
    const lines = String(src || '').replace(/\r\n/g, '\n').split('\n');
    const html: string[] = [];
    let list: 'ul' | 'ol' | null = null;
    let code: string[] | null = null;
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

/** Petición JSON autenticada al chat. Lanza Error con el mensaje del servidor. */
export async function aiFetch<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${AI_BASE}${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers || {}) },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(body.error || `Error ${res.status}`), { status: res.status, upgradeActionId: body.upgradeActionId });
    return body as T;
}
