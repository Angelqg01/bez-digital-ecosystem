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
import type { Options } from 'express-rate-limit';
import type { Request, Response } from 'express';

export interface ThrottleOptions {
    /** Sujeto opaco del llamante en curso. Ver `subjectFromRequest`. */
    resolveSubject?: () => string | undefined;
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
            const subject = options.resolveSubject?.() ?? 'anon';
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
