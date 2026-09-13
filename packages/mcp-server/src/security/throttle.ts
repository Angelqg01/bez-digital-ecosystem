/**
 * BeZhas Watchdog — límite de ritmo para los endpoints de observación
 *
 * `/status`, `/audit` e `/inspect` exponen política activa y ventana de
 * auditoría. Sin freno servirían para sondear el sistema, o para desplazar el
 * rastro reciente a base de peticiones hasta que la evidencia de un ataque
 * saliera de la ventana en memoria.
 *
 * Usa `express-rate-limit`, que es lo que ya emplea el backend, en vez de una
 * ventana propia: el contador vive fuera del proceso de inspección y emite las
 * cabeceras `RateLimit-*` estándar.
 */
import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import type { Request, Response } from 'express';

export interface ThrottleOptions {
    /** Sujeto opaco del llamante en curso. Ver `subjectFromCredentials`. */
    resolveSubject?: () => string | undefined;
}

/**
 * Construye un limitador de `limitPerMinute` peticiones por minuto y sujeto.
 *
 * La clave es el sujeto opaco y no la IP: detrás de un proxy todas las
 * llamadas compartirían origen, y una sola clave agotaría el cupo del resto.
 */
export function throttle(limitPerMinute: number, options: ThrottleOptions = {}): RateLimitRequestHandler {
    return rateLimit({
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
    });
}
