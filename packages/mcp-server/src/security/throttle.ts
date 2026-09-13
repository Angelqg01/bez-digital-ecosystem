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
}

/**
 * Configuración de un limitador de `limitPerMinute` peticiones por minuto.
 *
 * La clave es el sujeto opaco y la ruta, no la IP en crudo: `subjectFromRequest`
 * ya decide qué identifica al llamante, y así el cupo de una ruta no se lleva
 * por delante el de las demás.
 */
export function watchdogLimiter(limitPerMinute: number, options: ThrottleOptions = {}): Partial<Options> {
    return {
        windowMs: 60_000,
        limit: limitPerMinute,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req: Request) => `${options.resolveSubject?.() ?? 'anon'}:${req.path}`,
        handler: (_req: Request, res: Response) => {
            res.status(429).json({
                success: false,
                error: 'Demasiadas peticiones',
                retryAfterSeconds: 60,
            });
        },
    };
}
