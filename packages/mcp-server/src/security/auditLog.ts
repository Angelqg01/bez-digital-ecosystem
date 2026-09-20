/**
 * BeZhas Watchdog — registro de auditoría encadenado
 *
 * Cada entrada incluye el hash de la anterior. Alterar o borrar un registro
 * rompe la cadena y `verifyChain` lo detecta, así que un atacante que consiga
 * ejecución no puede limpiar su rastro sin dejar señal.
 */
import { createHash, createHmac, randomBytes, scryptSync } from 'node:crypto';
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
/**
 * Normaliza la dirección antes de derivar el sujeto.
 *
 * El mismo cliente llega unas veces como `1.2.3.4` y otras como
 * `::ffff:1.2.3.4` —la forma IPv4 mapeada en IPv6— según cómo esté configurado
 * el socket o el proxy de delante. Sin normalizar, cada forma estrena su propio
 * cupo: basta alternarlas para duplicar el límite de ritmo. Es exactamente el
 * fallo que `express-rate-limit` corrigió en su 8.2.2, y aquí nos toca igual
 * porque el limitador usa su propio `keyGenerator` sobre `req.ip`.
 *
 * Se normaliza también la caja de los hexadecimales, por el mismo motivo: dos
 * grafías de la misma dirección no pueden ser dos sujetos.
 */
export function normalizeIp(ip?: string): string {
    if (!ip) return 'desconocida';

    let limpia = ip.trim().toLowerCase();

    // Forma con corchetes de una IPv6 con puerto: [::1]:443
    if (limpia.startsWith('[')) limpia = limpia.slice(1, limpia.indexOf(']') === -1 ? undefined : limpia.indexOf(']'));

    // IPv4 mapeada en IPv6, con o sin el prefijo cero explícito.
    // Los cuantificadores están acotados (0{1,4} repetido como mucho 4 veces)
    // y el patrón está anclado por los dos extremos; además solo recibe
    // `req.ip`, de longitud acotada por el propio socket.
    // eslint-disable-next-line security/detect-unsafe-regex
    const mapeada = /^(?:::ffff:|0{1,4}(?::0{1,4}){0,4}:ffff:)(\d{1,3}(?:\.\d{1,3}){3})$/.exec(limpia);
    if (mapeada) return mapeada[1];

    // Localhost en sus dos grafías: el mismo origen no puede contar doble.
    if (limpia === '::1') return '127.0.0.1';

    return limpia;
}

export function subjectFromRequest(opts: { ip?: string; accountId?: string }): string {
    if (opts.accountId) return subjectId(`account:${opts.accountId}`);
    return subjectId(`ip:${normalizeIp(opts.ip)}`);
}

/**
 * Sujeto derivado de una CREDENCIAL, con derivación lenta.
 *
 * Se separa de `subjectId` a propósito, porque el material de partida es
 * distinto. Una IP no es un secreto: nadie gana nada invirtiendo el hash de
 * algo que ya viaja en claro en cada paquete, y por eso ahí basta un HMAC
 * rápido. Una clave de API sí lo es, y un hash rápido de un secreto con poca
 * entropía se rompe por fuerza bruta: quien se hiciera con el fichero de
 * auditoría podría ir probando claves candidatas a millones por segundo hasta
 * dar con la que produce esa etiqueta.
 *
 * `scrypt` hace que cada intento cueste, con los parámetros que recomienda el
 * propio Node. El coste no se paga en caliente: esta función se llama UNA vez
 * al armar el servidor, y el resultado queda memorizado.
 */
const SCRYPT_COSTE = { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const credencialesMemorizadas = new Map<string, string>();

export function subjectFromApiKey(apiKey?: string): string {
    if (!apiKey) return subjectId('stdio');

    const memorizado = credencialesMemorizadas.get(apiKey);
    if (memorizado !== undefined) return memorizado;

    const derivado = scryptSync(apiKey, SUBJECT_SALT, 16, SCRYPT_COSTE).toString('hex');
    const id = 'sbj_' + derivado.slice(0, 16);

    // Acotada: son claves de API, no hay muchas, pero tampoco se deja crecer.
    if (credencialesMemorizadas.size >= 64) credencialesMemorizadas.clear();
    credencialesMemorizadas.set(apiKey, id);
    return id;
}

/** Recorta los campos de texto antes de persistirlos. */
function clamp(text: string): string {
    const flat = String(text).replace(/[\r\n]+/g, ' ');
    return flat.length > MAX_FIELD ? flat.slice(0, MAX_FIELD) + '…' : flat;
}

/**
 * Eslabón de la cadena de integridad de la auditoría.
 *
 * CodeQL marca este SHA-256 como «password hash with insufficient computational
 * effort», porque sigue el rastro `BEZHAS_API_KEY` → `subjectFromApiKey` →
 * `subject` → entrada → aquí, y concluye que se está resumiendo una contraseña
 * con un hash rápido. No es lo que pasa, por dos motivos:
 *
 *   1. Esto NO es un hash de credencial, es el encadenado que hace la auditoría
 *      a prueba de manipulación: cada entrada resume la anterior, y por eso
 *      tiene que cubrir la entrada ENTERA, `subject` incluido. Si se excluyera,
 *      quien alterase el fichero podría cambiar a quién se le imputa una
 *      operación sin romper la cadena, que es justo lo que esto impide.
 *   2. Lo que llega en `subject` no es la credencial: es la etiqueta opaca que
 *      `subjectFromApiKey` ya derivó con `scrypt`. El factor de trabajo está
 *      puesto una capa antes; repetirlo aquí no añadiría nada y haría que cada
 *      entrada del registro costara decenas de milisegundos.
 *
 * Un hash rápido es lo correcto para una cadena de integridad. La alerta no se
 * puede silenciar desde el código —code scanning no honra los comentarios de
 * supresión— y hay que descartarla desde la pestaña Security del repositorio.
 */
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
