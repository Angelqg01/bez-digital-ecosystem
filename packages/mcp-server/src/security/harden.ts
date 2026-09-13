/**
 * BeZhas Watchdog — blindaje del servidor MCP
 *
 * Envuelve la instancia del servidor para que TODA herramienta registrada pase
 * por el vigilante, sin tocar el código de las herramientas. Así una
 * herramienta nueva queda protegida por omisión: no hay que acordarse de nada.
 */
import { guardian, WatchdogError, type GuardContext } from './guardian.js';

/** Mensaje que sustituye a un resultado retenido. */
function blockedPayload(reason: string) {
    return {
        content: [
            {
                type: 'text' as const,
                text: JSON.stringify(
                    {
                        success: false,
                        blockedBy: 'BeZhas Watchdog',
                        reason,
                        hint: 'Si la petición es legítima, revisa los parámetros o solicita la operación por un canal con autorización explícita.',
                    },
                    null,
                    2,
                ),
            },
        ],
        isError: true,
    };
}

/**
 * Marca el contenido de una respuesta como dato, no como instrucción.
 * Evita que texto traído de fuera se lea como orden al modelo.
 */
function fenceAsData(payload: any, note: string): any {
    if (!payload || !Array.isArray(payload.content)) return payload;
    return {
        ...payload,
        content: payload.content.map((part: any) =>
            part?.type === 'text'
                ? {
                      ...part,
                      text:
                          `<datos_no_confiables origen="herramienta" nota="${note}">\n` +
                          `${part.text}\n` +
                          `</datos_no_confiables>`,
                  }
                : part,
        ),
    };
}

export interface HardenOptions {
    /** Resuelve el sujeto de la llamada (API key, wallet). */
    resolveSubject?: () => string | undefined;
}

/**
 * Devuelve un proxy del servidor cuyo método `tool` registra siempre un
 * manejador vigilado.
 */
export function hardenServer<T extends { tool: (...args: any[]) => any }>(
    server: T,
    options: HardenOptions = {},
): T {
    const originalTool = server.tool.bind(server);

    const guardedTool = (...args: any[]) => {
        const name = args[0] as string;
        const handlerIndex = args.length - 1;
        const original = args[handlerIndex];

        if (typeof original !== 'function') return originalTool(...args);

        const guarded = async (...handlerArgs: any[]) => {
            const params = handlerArgs[0];
            const ctx: GuardContext = { tool: name, subject: options.resolveSubject?.() };

            try {
                const inbound = guardian.inspectInput(ctx, params);
                guardian.enforce(inbound);

                const result = await original(...handlerArgs);

                const outbound = guardian.inspectOutput(ctx, result);
                if (outbound.verdict === 'block') {
                    guardian.enforce(outbound);
                    return blockedPayload(outbound.reason);
                }
                if (outbound.verdict === 'redact') {
                    return fenceAsData(outbound.sanitized ?? result, outbound.reason);
                }
                return result;
            } catch (err) {
                if (err instanceof WatchdogError) return blockedPayload(err.message);
                throw err;
            }
        };

        const next = [...args];
        next[handlerIndex] = guarded;
        return originalTool(...next);
    };

    return new Proxy(server, {
        get(target, prop, receiver) {
            if (prop === 'tool') return guardedTool;
            return Reflect.get(target, prop, receiver);
        },
    }) as T;
}
