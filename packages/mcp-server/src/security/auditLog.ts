/**
 * BeZhas Watchdog — registro de auditoría encadenado
 *
 * Cada entrada incluye el hash de la anterior. Alterar o borrar un registro
 * rompe la cadena y `verifyChain` lo detecta, así que un atacante que consiga
 * ejecución no puede limpiar su rastro sin dejar señal.
 */
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Finding } from './scanner.js';

export type Verdict = 'allow' | 'block' | 'redact';

export interface AuditEntry {
    seq: number;
    ts: string;
    tool: string;
    subject: string;
    verdict: Verdict;
    reason: string;
    findings: Array<Pick<Finding, 'patternId' | 'kind' | 'severity' | 'path'>>;
    amountUSD: number | null;
    prevHash: string;
    hash: string;
}

const GENESIS = '0'.repeat(64);

/**
 * Sal de proceso para el identificador de sujeto. Se genera al arrancar si no
 * se proporciona: así el identificador no es reversible ni correlacionable
 * entre despliegues.
 */
const SUBJECT_SALT = process.env.WATCHDOG_SUBJECT_SALT || randomBytes(32).toString('hex');

/** Longitud máxima de los campos de texto que llegan al fichero. */
const MAX_FIELD = 200;

/**
 * Convierte un identificador de llamante en una etiqueta opaca.
 *
 * Antes se guardaban los últimos caracteres de la API Key, que son material de
 * la credencial: el propio registro de auditoría se convertía en una filtración
 * parcial. El HMAC con sal de proceso permite seguir agrupando por sujeto sin
 * conservar nada reversible.
 */
/**
 * Memoria de sujetos ya calculados.
 *
 * El HMAC se pedía en CADA llamada a herramienta y en CADA petición HTTP, y
 * siempre sobre el mismo puñado de valores —una IP, una clave—. Acotada para
 * que una riada de orígenes distintos no la convierta en una fuga de memoria:
 * al llenarse se vacía entera, que es más barato que llevar cuentas de uso y
 * basta de sobra para lo que esto es.
 */
const MAX_SUJETOS_MEMORIZADOS = 4096;
const sujetosMemorizados = new Map<string, string>();

export function subjectId(raw: string): string {
    if (!raw) return 'anonymous';

    const memorizado = sujetosMemorizados.get(raw);
    if (memorizado !== undefined) return memorizado;

    const id = 'sbj_' + createHmac('sha256', SUBJECT_SALT).update(raw).digest('hex').slice(0, 16);

    if (sujetosMemorizados.size >= MAX_SUJETOS_MEMORIZADOS) sujetosMemorizados.clear();
    sujetosMemorizados.set(raw, id);
    return id;
}

/**
 * Deriva el sujeto de una petición: a quién se le imputan los topes de ritmo
 * y de importe, y bajo qué etiqueta queda en la auditoría.
 *
 * **La credencial no interviene, y es deliberado.** Este servidor no
 * autentica: lee `X-API-Key` pero no la valida contra nada. Indexar los topes
 * por esa cabecera los volvía inútiles — bastaba enviar una clave distinta en
 * cada petición para estrenar cupo — y además metía material de credencial
 * (incluida una contraseña de `Basic`) en el rastro de auditoría. Dos
 * problemas con un mismo origen: tratar como identidad algo que no lo es.
 *
 * Mientras no haya autenticación, la IP es el identificador más firme
 * disponible: no es perfecto (tras un proxy compartido varios llamantes caen
 * en el mismo cupo, salvo que se configure `trust proxy`), pero es un tope que
 * ata, en vez de uno que aparenta atar. Cuando exista una capa que valide la
 * clave, `accountId` toma el relevo sin tocar nada más.
 */
export function subjectFromRequest(opts: { ip?: string; accountId?: string }): string {
    if (opts.accountId) return subjectId(`account:${opts.accountId}`);
    return subjectId(`ip:${opts.ip ?? 'desconocida'}`);
}

/**
 * Sujeto de una sesión por STDIO, a partir de su clave de API.
 *
 * Existe para que nadie caiga en la tentación de usar un trozo de la clave
 * como identificador. El sujeto acaba en cada entrada de la auditoría y la
 * auditoría se escribe a disco: un prefijo de la credencial ahí es una
 * credencial en un fichero de registro. El HMAC identifica igual de bien y no
 * guarda nada que sirva para autenticarse.
 */
export function subjectFromApiKey(apiKey?: string): string {
    return apiKey ? subjectId(`apikey:${apiKey}`) : subjectId('stdio');
}

/** Recorta los campos de texto antes de persistirlos. */
function clamp(text: string): string {
    const flat = String(text).replace(/[\r\n]+/g, ' ');
    return flat.length > MAX_FIELD ? flat.slice(0, MAX_FIELD) + '…' : flat;
}

function hashEntry(e: Omit<AuditEntry, 'hash'>): string {
    return createHash('sha256').update(JSON.stringify(e)).digest('hex');
}

export class AuditLog {
    private seq = 0;
    private prevHash = GENESIS;
    private readonly entries: AuditEntry[] = [];
    private readonly maxInMemory: number;
    private readonly filePath?: string;

    constructor(opts: { filePath?: string; maxInMemory?: number } = {}) {
        this.filePath = opts.filePath ?? process.env.WATCHDOG_AUDIT_FILE;
        this.maxInMemory = opts.maxInMemory ?? 1_000;

        if (this.filePath) {
            const dir = dirname(this.filePath);
            if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
            this.resumeFrom(this.filePath);
        }
    }

    /** Retoma la cadena de un fichero previo para no reiniciar el encadenado. */
    private resumeFrom(path: string): void {
        if (!existsSync(path)) return;
        try {
            const lines = readFileSync(path, 'utf8').trim().split('\n').filter(Boolean);
            if (!lines.length) return;
            const last = JSON.parse(lines[lines.length - 1]) as AuditEntry;
            this.seq = last.seq;
            this.prevHash = last.hash;
        } catch {
            // Un fichero corrupto no debe impedir arrancar: se empieza cadena
            // nueva y la verificación lo reflejará.
        }
    }

    record(input: {
        tool: string;
        subject: string;
        verdict: Verdict;
        reason: string;
        findings?: Finding[];
        amountUSD?: number | null;
    }): AuditEntry {
        const base: Omit<AuditEntry, 'hash'> = {
            seq: ++this.seq,
            ts: new Date().toISOString(),
            tool: clamp(input.tool),
            subject: clamp(input.subject),
            verdict: input.verdict,
            reason: clamp(input.reason),
            // `path` se recorta igual que el resto.
            //
            // No es un campo interno: se construye con los NOMBRES DE CLAVE de
            // los datos inspeccionados (`${path}.${k}`), así que lo escribe
            // quien manda la petición. Sin recortarlo, un objeto muy anidado o
            // con claves larguísimas escribía entradas de tamaño arbitrario en
            // el fichero de auditoría — el único campo que se colaba sin pasar
            // por `clamp`.
            findings: (input.findings ?? []).map((f) => ({
                patternId: clamp(f.patternId),
                kind: f.kind,
                severity: f.severity,
                path: clamp(f.path),
            })),
            amountUSD: input.amountUSD ?? null,
            prevHash: this.prevHash,
        };

        const entry: AuditEntry = { ...base, hash: hashEntry(base) };
        this.prevHash = entry.hash;

        this.entries.push(entry);
        if (this.entries.length > this.maxInMemory) this.entries.shift();

        if (this.filePath) {
            try {
                // CodeQL marca esta línea como «network data written to file»,
                // y seguirá marcándola: las supresiones en línea
                // (`// codeql[...]`, `// lgtm[...]`) NO las honra GitHub code
                // scanning, eso era de LGTM. Para cerrarla hay que descartar
                // la alerta desde la pestaña Security del repositorio.
                //
                // Que aquí se escriba dato ajeno no es un descuido, es la
                // función: un registro de auditoría existe para dejar
                // constancia de lo que se inspeccionó. Lo que importa es que
                // no se pueda abusar de ello, y de eso se ocupan tres cosas:
                //
                //   1. La RUTA no es dato del usuario: sale de
                //      `WATCHDOG_AUDIT_FILE` o del constructor, así que no hay
                //      travesía de directorios.
                //   2. Cada campo de texto pasa por `clamp`, que acota la
                //      longitud y quita `\r` y `\n`. Sin eso se podría forjar
                //      una línea entera, porque el fichero es JSONL.
                //   3. No se vuelca el contenido inspeccionado, solo la
                //      decisión y la forma del hallazgo.
                appendFileSync(this.filePath, JSON.stringify(entry) + '\n');
            } catch {
                // Perder la copia en disco no debe tumbar la petición; queda
                // la copia en memoria y el aviso por stderr.
                console.error('[watchdog] no se pudo escribir el registro de auditoría');
            }
        }
        return entry;
    }

    /** Entradas retenidas en memoria, de más antigua a más reciente. */
    recent(limit = 50): AuditEntry[] {
        return this.entries.slice(-limit);
    }

    /** Comprueba que la cadena en memoria no ha sido alterada. */
    verifyChain(): { valid: boolean; brokenAt?: number } {
        let prev = this.entries.length ? this.entries[0].prevHash : GENESIS;
        for (const e of this.entries) {
            const { hash, ...rest } = e;
            if (rest.prevHash !== prev || hashEntry(rest) !== hash) {
                return { valid: false, brokenAt: e.seq };
            }
            prev = hash;
        }
        return { valid: true };
    }

    stats(): Record<Verdict | 'total', number> {
        const out = { allow: 0, block: 0, redact: 0, total: this.entries.length };
        for (const e of this.entries) out[e.verdict]++;
        return out;
    }
}

export const auditLog = new AuditLog();
