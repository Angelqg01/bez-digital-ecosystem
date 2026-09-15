/**
 * BeZhas Watchdog — escáner de contenido
 *
 * Recorre cualquier estructura (string, objeto, array) buscando inyecciones de
 * prompt y secretos. Devuelve hallazgos y una copia redactada.
 */
import {
    INJECTION_PATTERNS,
    SECRET_PATTERNS,
    SEVERITY_RANK,
    type Pattern,
    type Severity,
} from './patterns.js';

export interface Finding {
    patternId: string;
    kind: 'injection' | 'secret';
    severity: Severity;
    description: string;
    /** Ruta dentro de la estructura inspeccionada, p. ej. "params.note". */
    path: string;
    /** Fragmento del texto que disparó la regla, ya recortado y ofuscado. */
    evidence: string;
}

export interface ScanResult {
    findings: Finding[];
    /** Severidad más alta encontrada, o null si está limpio. */
    maxSeverity: Severity | null;
    /** Copia de la entrada con todos los secretos sustituidos. */
    redacted: unknown;
}

const MAX_STRING_SCAN = 200_000; // corta entradas absurdas antes de regexear

/** Claves que nunca deben copiarse: escribirlas contamina el prototipo. */
/**
 * Claves que nunca se copian al objeto redactado.
 *
 * La guarda real de `walk` las compara desplegadas, una a una; esta lista es
 * la referencia que documenta el conjunto y contra la que se comprueba en las
 * pruebas que la guarda no se ha quedado corta.
 */
export const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const EVIDENCE_WINDOW = 60;

/** Recorta y ofusca el fragmento para que el propio log no filtre el secreto. */
function makeEvidence(text: string, match: string, kind: Finding['kind']): string {
    if (kind === 'secret') {
        const head = match.slice(0, 4);
        return `${head}…[${match.length} car. redactados]`;
    }
    const at = text.indexOf(match);
    const from = Math.max(0, at - 10);
    const slice = text.slice(from, from + EVIDENCE_WINDOW).replace(/\s+/g, ' ');
    return slice.length < text.length ? `${slice}…` : slice;
}

function redactSecrets(text: string): string {
    let out = text;
    for (const p of SECRET_PATTERNS) {
        out = out.replace(new RegExp(p.regex.source, p.regex.flags), (m) =>
            `[REDACTADO:${p.id}:${m.length}]`,
        );
    }
    return out;
}

function scanString(text: string, path: string, findings: Finding[]): void {
    if (!text) return;
    const subject = text.length > MAX_STRING_SCAN ? text.slice(0, MAX_STRING_SCAN) : text;

    const check = (patterns: Pattern[], kind: Finding['kind']) => {
        for (const p of patterns) {
            // Se clona la regex: las globales llevan lastIndex y ensuciarían
            // llamadas posteriores si se reutilizara la instancia del catálogo.
            const re = new RegExp(p.regex.source, p.regex.flags.replace('g', ''));
            const m = re.exec(subject);
            if (m) {
                findings.push({
                    patternId: p.id,
                    kind,
                    severity: p.severity,
                    description: p.description,
                    path,
                    evidence: makeEvidence(subject, m[0], kind),
                });
            }
        }
    };

    check(INJECTION_PATTERNS, 'injection');
    check(SECRET_PATTERNS, 'secret');
}

function walk(value: unknown, path: string, findings: Finding[], depth: number): unknown {
    if (depth > 12) return value;

    if (typeof value === 'string') {
        scanString(value, path, findings);
        return redactSecrets(value);
    }
    if (Array.isArray(value)) {
        return value.map((v, i) => walk(v, `${path}[${i}]`, findings, depth + 1));
    }
    if (value && typeof value === 'object') {
        // Sin prototipo: escribir una clave `__proto__` sobre un objeto
        // literal contaminaría Object.prototype para todo el proceso, y las
        // claves aquí vienen del atacante.
        const out: Record<string, unknown> = Object.create(null);
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            // La clave también puede portar el ataque.
            scanString(k, `${path}.<clave>`, findings);

            // Comparación explícita, no `DANGEROUS_KEYS.has(k)`.
            //
            // El conjunto sigue siendo la fuente de la lista —se usa en las
            // pruebas y documenta la intención—, pero la guarda que protege
            // la escritura de abajo se escribe aquí desplegada porque un
            // análisis estático no sigue la pertenencia a un Set: con el
            // `has()` delante, CodeQL marcaba esta línea como inyección de
            // propiedad remota de severidad alta en cada PR que tocara este
            // camino. El código era correcto y la alerta, ruido recurrente.
            if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
                findings.push({
                    patternId: 'PROTO_POLLUTION_KEY',
                    kind: 'injection',
                    severity: 'high',
                    description: `Clave reservada del prototipo en los datos: ${k}`,
                    path: `${path}.<clave>`,
                    evidence: k,
                });
                continue;
            }

            out[k] = walk(v, path ? `${path}.${k}` : k, findings, depth + 1);
        }
        return out;
    }
    return value;
}

export function scan(value: unknown, rootPath = ''): ScanResult {
    const findings: Finding[] = [];
    const redacted = walk(value, rootPath, findings, 0);

    let maxSeverity: Severity | null = null;
    for (const f of findings) {
        if (!maxSeverity || SEVERITY_RANK[f.severity] > SEVERITY_RANK[maxSeverity]) {
            maxSeverity = f.severity;
        }
    }
    return { findings, maxSeverity, redacted };
}

/** Redacta sin analizar. Útil para volcar contexto en logs. */
export function redact(value: unknown): unknown {
    return walk(value, '', [], 0);
}
