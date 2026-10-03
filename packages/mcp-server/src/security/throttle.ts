/**
 * BeZhas Watchdog — límite de ritmo para los endpoints de observación
 *
 * `/status`, `/audit` e `/inspect` exponen política activa y ventana de
 * auditoría. Sin freno servirían para sondear el sistema, o para desplazar el
 * rastro reciente a base de peticiones hasta que la evidencia de un ataque
 * saliera de la ventana en memoria.
 *
 * Este módulo aporta solo la **configuración**; la llamada a `rateLimit()` se
 * hace en el punto de montaje, junto a la ruta que protege. Es deliberado:
 * envolver la librería en un ayudante propio escondía el control tanto del
 * lector como del análisis estático, que dejaba de reconocer la ruta como
 * limitada. La protección era la misma, pero solo se podía comprobar
 * ejecutándola.
 */
import { ipKeyGenerator, type Options } from 'express-rate-limit';
import type { Request, Response } from 'express';
import { normalizeIp, subjectFromRequest } from './auditLog.js';

export interface ThrottleOptions {
    /**
     * Sujeto opaco del llamante. Por defecto se deriva de la propia petición
     * con `subjectFromRequest`, de modo que el limitador **no depende de que
     * otro middleware haya corrido antes**: así puede montarse el primero de
     * todos, por delante incluso del parseo del cuerpo.
     */
    resolveSubject?: (req: Request) => string | undefined;
    /**
     * Si es `true`, el cupo es del sujeto para todo el servidor en vez de por
     * ruta. Es lo que corresponde al techo global: separar por ruta ahí
     * multiplicaría el cupo real por el número de endpoints, que es justo lo
     * que un abusador aprovecharía.
     */
    global?: boolean;
}

/** Cupo global por sujeto y minuto para todo el servidor HTTP. */
export const GLOBAL_LIMIT_PER_MINUTE = Number(process.env.MCP_RATE_LIMIT_PER_MINUTE) || 300;

/**
 * Configuración de un limitador de `limitPerMinute` peticiones por minuto.
 *
 * La clave sale del sujeto opaco, no de la IP en crudo: `subjectFromRequest`
 * ya decide qué identifica al llamante. Por defecto se separa además por ruta,
 * para que agotar un endpoint no cierre los demás; con `global: true` el cupo
 * es uno solo para todo el servidor.
 */
export function watchdogLimiter(limitPerMinute: number, options: ThrottleOptions = {}): Partial<Options> {
    return {
        windowMs: 60_000,
        limit: limitPerMinute,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req: Request) => {
            // IPv6 por subred /56, no por dirección: si no, un cliente con su
            // /64 rota de dirección y estrena cupo en cada petición.
            // `subjectFromRequest` agrupa igual por dentro (ver `ipAddressKey`,
            // idempotente); se hace explícito aquí para que la clave del
            // limitador se vea basada en subred, y express-rate-limit lo
            // reconozca al validar el `keyGenerator` al arrancar.
            const subject =
                options.resolveSubject?.(req) ?? subjectFromRequest({ ip: ipKeyGenerator(normalizeIp(req.ip)) });
            return options.global ? subject : `${subject}:${req.path}`;
        },
        handler: (_req: Request, res: Response) => {
            res.status(429).json({
                success: false,
                error: 'Demasiadas peticiones',
                retryAfterSeconds: 60,
            });
        },
    };
}

/**
 * Saltos de proxy en los que confiar, a partir de `TRUST_PROXY_HOPS`.
 *
 * Solo se acepta un entero entre 0 y 5; cualquier otra cosa (vacío, `true`,
 * texto, negativos) cae a 1. Nunca devuelve `true`: con `true` Express toma el
 * primer valor de `X-Forwarded-For`, que lo escribe el cliente.
 */
export function trustProxyHops(raw: string | undefined): number {
    if (raw === undefined || !/^\d$/.test(raw.trim())) return 1;
    const hops = Number(raw.trim());
    return hops <= 5 ? hops : 1;
}
