/**
 * lib/markdown.ts
 * Renderizador Markdown -> HTML sin dependencias externas.
 *
 * Cubre el subconjunto que usa la biblioteca de documentacion publica:
 * encabezados, parrafos, listas, tablas, bloques de codigo, citas,
 * separadores, enlaces, negrita, cursiva y codigo en linea.
 *
 * El contenido procede de archivos del repositorio (no de entrada de usuario),
 * pero se escapa igualmente todo el HTML antes de aplicar formato.
 */

const ESCAPES: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

function escapeHtml(text: string): string {
    return text.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** Convierte un titulo en un id apto para anclas. */
export function slugifyHeading(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
}

/**
 * Formato en linea: codigo, enlaces, negrita y cursiva.
 * El codigo se extrae primero para que su contenido no se reinterprete.
 */
function inline(raw: string): string {
    const codeSpans: string[] = [];

    // 1. Extraer `codigo` a marcadores antes de cualquier otra transformacion.
    //    El marcador usa NUL: no lo escapa escapeHtml ni lo tocan las reglas siguientes.
    let text = raw.replace(/`([^`]+)`/g, (_m, code: string) => {
        const token = `\u0000${codeSpans.length}\u0000`;
        codeSpans.push(`<code class="md-code">${escapeHtml(code)}</code>`);
        return token;
    });

    text = escapeHtml(text);

    // 2. Enlaces [texto](destino) — solo http(s), rutas internas y anclas.
    text = text.replace(
        /\[([^\]]+)\]\(([^)\s]+)\)/g,
        (match, label: string, href: string) => {
            const safe = /^(https?:\/\/|\/|#)/.test(href);
            if (!safe) return match;
            const external = href.startsWith('http');
            const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : '';
            return `<a class="md-link" href="${href}"${attrs}>${label}</a>`;
        },
    );

    // 3. Negrita y cursiva.
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');

    // 4. Restaurar los fragmentos de codigo.
    return text.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => codeSpans[Number(i)]);
}

function isTableSeparator(line: string): boolean {
    return /^\|?[\s:|-]*-[\s:|-]*\|?$/.test(line.trim()) && line.includes('-');
}

function splitRow(line: string): string[] {
    return line
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((cell) => cell.trim());
}

export interface DocHeading {
    id: string;
    text: string;
    level: number;
}

export interface RenderedMarkdown {
    html: string;
    headings: DocHeading[];
}

export function renderMarkdown(source: string): RenderedMarkdown {
    const lines = source.replace(/\r\n/g, '\n').split('\n');
    const out: string[] = [];
    const headings: DocHeading[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // Linea en blanco
        if (!line.trim()) {
            i++;
            continue;
        }

        // Bloque de codigo con vallas
        const fence = line.match(/^```(\w*)\s*$/);
        if (fence) {
            const lang = fence[1] || 'text';
            const body: string[] = [];
            i++;
            while (i < lines.length && !/^```\s*$/.test(lines[i])) {
                body.push(lines[i]);
                i++;
            }
            i++; // cierre
            out.push(
                `<div class="md-pre-wrap"><div class="md-pre-lang">${escapeHtml(lang)}</div>` +
                `<pre class="md-pre"><code>${escapeHtml(body.join('\n'))}</code></pre></div>`,
            );
            continue;
        }

        // Encabezado
        const heading = line.match(/^(#{1,6})\s+(.*)$/);
        if (heading) {
            const level = heading[1].length;
            const text = heading[2].trim();
            const id = slugifyHeading(text);
            if (level <= 3) headings.push({ id, text, level });
            out.push(`<h${level} id="${id}" class="md-h${level}">${inline(text)}</h${level}>`);
            i++;
            continue;
        }

        // Separador horizontal
        if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
            out.push('<hr class="md-hr" />');
            i++;
            continue;
        }

        // Tabla
        if (line.trim().startsWith('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
            const header = splitRow(line);
            i += 2;
            const rows: string[][] = [];
            while (i < lines.length && lines[i].trim().startsWith('|')) {
                rows.push(splitRow(lines[i]));
                i++;
            }
            const head = header.map((c) => `<th>${inline(c)}</th>`).join('');
            const body = rows
                .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
                .join('');
            out.push(
                `<div class="md-table-wrap"><table class="md-table">` +
                `<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`,
            );
            continue;
        }

        // Cita
        if (line.trim().startsWith('>')) {
            const body: string[] = [];
            while (i < lines.length && lines[i].trim().startsWith('>')) {
                body.push(lines[i].trim().replace(/^>\s?/, ''));
                i++;
            }
            out.push(`<blockquote class="md-quote">${inline(body.join(' '))}</blockquote>`);
            continue;
        }

        // Lista sin orden (incluye casillas de verificacion)
        if (/^\s*[-*]\s+/.test(line)) {
            const items: string[] = [];
            while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
                const item = lines[i].replace(/^\s*[-*]\s+/, '');
                const task = item.match(/^\[([ xX])\]\s+(.*)$/);
                if (task) {
                    const done = task[1].toLowerCase() === 'x';
                    const box = done ? '&#10003;' : '&#9744;';
                    items.push(
                        `<li class="md-li md-li-task">` +
                        `<span class="md-task${done ? ' is-done' : ''}">${box}</span>` +
                        `${inline(task[2])}</li>`,
                    );
                } else {
                    items.push(`<li class="md-li">${inline(item)}</li>`);
                }
                i++;
            }
            out.push(`<ul class="md-ul">${items.join('')}</ul>`);
            continue;
        }

        // Lista ordenada
        if (/^\s*\d+\.\s+/.test(line)) {
            const items: string[] = [];
            while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
                items.push(`<li class="md-li">${inline(lines[i].replace(/^\s*\d+\.\s+/, ''))}</li>`);
                i++;
            }
            out.push(`<ol class="md-ol">${items.join('')}</ol>`);
            continue;
        }

        // Parrafo: acumula hasta linea en blanco o inicio de otro bloque
        const para: string[] = [];
        while (
            i < lines.length &&
            lines[i].trim() &&
            !/^(#{1,6}\s|```|>|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i]) &&
            !lines[i].trim().startsWith('|') &&
            !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i].trim())
        ) {
            para.push(lines[i].trim());
            i++;
        }
        if (para.length) out.push(`<p class="md-p">${inline(para.join(' '))}</p>`);
    }

    return { html: out.join('\n'), headings };
}
