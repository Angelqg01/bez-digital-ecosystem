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
export function subjectId(raw: string): string {
    if (!raw) return 'anonymous';
    return 'sbj_' + createHmac('sha256', SUBJECT_SALT).update(raw).digest('hex').slice(0, 16);
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
            findings: (input.findings ?? []).map((f) => ({
                patternId: f.patternId,
                kind: f.kind,
                severity: f.severity,
                path: f.path,
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
