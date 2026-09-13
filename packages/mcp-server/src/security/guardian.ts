/**
 * BeZhas Watchdog — el agente vigilante
 *
 * Se sitúa entre el modelo y cada herramienta del MCP. Inspecciona lo que
 * entra (parámetros) y lo que sale (respuestas), aplica la política de riesgo
 * y deja rastro auditable de cada decisión.
 *
 * Principio de diseño: el vigilante no consulta a ningún modelo. Si el modelo
 * está siendo manipulado, preguntarle si le están manipulando no sirve de nada.
 */
import { auditLog, type AuditEntry, type Verdict } from './auditLog.js';
import { FORBIDDEN_ENV_KEYS, SEVERITY_RANK, type Severity } from './patterns.js';
import { extractAmountUSD, policy, riskOf, type RiskTier } from './policy.js';
import { rateLimiter } from './rateLimiter.js';
import { scan, type Finding } from './scanner.js';

export interface GuardContext {
    tool: string;
    /** Quién origina la llamada: API key, wallet o sesión. */
    subject?: string;
}

export interface Decision {
    verdict: Verdict;
    reason: string;
    findings: Finding[];
    risk: RiskTier;
    amountUSD: number | null;
    /** Parámetros o resultado con los secretos ya sustituidos. */
    sanitized: unknown;
    entry: AuditEntry;
}

export class WatchdogError extends Error {
    readonly code = 'WATCHDOG_BLOCKED';
    constructor(
        message: string,
        readonly decision: Decision,
    ) {
        super(message);
        this.name = 'WatchdogError';
    }
}

function atLeast(sev: Severity, threshold: Severity): boolean {
    return SEVERITY_RANK[sev] >= SEVERITY_RANK[threshold];
}

/** Comprueba que no se estén colando valores de entorno sensibles. */
function scanForEnvLeak(value: unknown): Finding[] {
    const out: Finding[] = [];
    const serialized = (() => {
        try {
            return JSON.stringify(value) ?? '';
        } catch {
            return '';
        }
    })();
    if (!serialized) return out;

    for (const key of FORBIDDEN_ENV_KEYS) {
        const secret = process.env[key];
        // Solo tiene sentido comparar valores con entidad: un valor corto
        // podría coincidir por casualidad con texto legítimo.
        if (!secret || secret.length < 12) continue;
        if (serialized.includes(secret)) {
            out.push({
                patternId: `ENV_LEAK_${key}`,
                kind: 'secret',
                severity: 'critical',
                description: `El contenido incluye el valor de ${key}`,
                path: '<contenido>',
                evidence: `[valor de ${key} redactado]`,
            });
        }
    }
    return out;
}

export class Guardian {
    /** Inspecciona los parámetros antes de ejecutar la herramienta. */
    inspectInput(ctx: GuardContext, params: unknown): Decision {
        const tool = ctx.tool;
        const subject = ctx.subject || 'anonymous';
        const risk = riskOf(tool);
        const amountUSD = extractAmountUSD(params);

        const { findings: scanFindings, maxSeverity, redacted } = scan(params, 'params');
        const findings = [...scanFindings, ...scanForEnvLeak(params)];

        const decide = (verdict: Verdict, reason: string): Decision => {
            const entry = auditLog.record({ tool, subject, verdict, reason, findings, amountUSD });
            return { verdict, reason, findings, risk, amountUSD, sanitized: redacted, entry };
        };

        // 1. Herramienta desactivada en caliente.
        if (policy.disabledTools.includes(tool)) {
            return decide('block', `La herramienta "${tool}" está desactivada por política.`);
        }

        // 2. Inyección de prompt o filtración de entorno en los parámetros.
        const worst = findings.reduce<Severity | null>(
            (acc, f) => (!acc || SEVERITY_RANK[f.severity] > SEVERITY_RANK[acc] ? f.severity : acc),
            maxSeverity,
        );
        if (worst && atLeast(worst, policy.blockAtSeverity)) {
            const ids = [...new Set(findings.map((f) => f.patternId))].join(', ');
            return decide(
                'block',
                `Contenido sospechoso en los parámetros (${ids}). La instrucción venía en los datos, no del operador.`,
            );
        }

        // 3. Ritmo de llamadas.
        const calls = rateLimiter.countCall(subject);
        if (calls.perMinute > policy.callsPerMinute) {
            return decide('block', `Exceso de llamadas: ${calls.perMinute}/min para ${subject}.`);
        }
        if (risk === 'critical' && calls.perHour > policy.criticalCallsPerHour) {
            return decide(
                'block',
                `Exceso de operaciones críticas: ${calls.perHour}/h para ${subject}.`,
            );
        }

        // 4. Techos de importe, solo donde hay dinero de por medio.
        if (amountUSD !== null && (risk === 'critical' || risk === 'elevated')) {
            if (amountUSD > policy.maxTransactionUSD) {
                return decide(
                    'block',
                    `Importe ${amountUSD.toFixed(2)} USD por encima del techo por operación (${policy.maxTransactionUSD} USD).`,
                );
            }
            const accumulated = rateLimiter.hourlyAmount(subject) + amountUSD;
            if (accumulated > policy.maxHourlyUSD) {
                return decide(
                    'block',
                    `Acumulado ${accumulated.toFixed(2)} USD por encima del techo horario (${policy.maxHourlyUSD} USD).`,
                );
            }
            rateLimiter.addAmount(subject, amountUSD);
        }

        const verdict: Verdict = findings.length ? 'redact' : 'allow';
        return decide(
            verdict,
            findings.length
                ? `Permitido con ${findings.length} hallazgo(s) por debajo del umbral de bloqueo.`
                : 'Sin hallazgos.',
        );
    }

    /**
     * Inspecciona la respuesta antes de devolverla al modelo.
     *
     * Aquí es donde se corta la inyección indirecta: una web, un repo o un
     * contrato pueden traer instrucciones incrustadas en su contenido.
     */
    inspectOutput(ctx: GuardContext, result: unknown): Decision {
        const tool = ctx.tool;
        const subject = ctx.subject || 'anonymous';
        const risk = riskOf(tool);

        const { findings: scanFindings, redacted } = scan(result, 'result');
        const findings = [...scanFindings, ...scanForEnvLeak(result)];

        const secretFindings = findings.filter((f) => f.kind === 'secret');
        const injectionFindings = findings.filter((f) => f.kind === 'injection');

        const decide = (verdict: Verdict, reason: string): Decision => {
            const entry = auditLog.record({ tool, subject, verdict, reason, findings });
            return { verdict, reason, findings, risk, amountUSD: null, sanitized: redacted, entry };
        };

        // Un secreto crítico en la salida se bloquea: redactar no basta cuando
        // la propia existencia del dato indica que algo va mal.
        const criticalSecret = secretFindings.find((f) => f.severity === 'critical');
        if (criticalSecret) {
            return decide(
                'block',
                `La respuesta de "${tool}" contenía un secreto crítico (${criticalSecret.patternId}). Se ha retenido.`,
            );
        }

        if (injectionFindings.length) {
            const ids = [...new Set(injectionFindings.map((f) => f.patternId))].join(', ');
            return decide(
                'redact',
                `La respuesta de "${tool}" traía texto con forma de instrucción (${ids}). Se entrega como dato inerte.`,
            );
        }

        return decide(
            secretFindings.length ? 'redact' : 'allow',
            secretFindings.length ? 'Secretos redactados en la respuesta.' : 'Sin hallazgos.',
        );
    }

    /** Aplica la decisión: lanza si toca bloquear y la política lo exige. */
    enforce(decision: Decision): void {
        if (decision.verdict === 'block' && policy.enforce) {
            throw new WatchdogError(decision.reason, decision);
        }
    }
}

export const guardian = new Guardian();
