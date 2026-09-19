/**
 * BeZhas Watchdog — límites por sujeto
 *
 * Ventanas deslizantes en memoria para número de llamadas e importe
 * acumulado. Un agente comprometido puede intentar muchas operaciones
 * pequeñas en lugar de una grande; esto lo corta igual.
 */

interface Window {
    hits: number[];      // marcas de tiempo
    amounts: Array<{ ts: number; usd: number }>;
}

const MINUTE = 60_000;
const HOUR = 3_600_000;

/**
 * Tope de sujetos vigilados a la vez.
 *
 * La limpieza periódica sola no bastaba: solo corre cada cinco minutos, y en
 * ese hueco cada sujeto nuevo estrenaba entrada. Como el sujeto sale de la IP,
 * una riada desde orígenes distintos —o un cliente que se conecte sin proxy
 * delante y vaya cambiando `X-Forwarded-For`— hacía crecer el mapa sin techo
 * hasta la siguiente pasada. Justo lo que un limitador de ritmo no debería
 * permitir: agotar la memoria del proceso que vigila los abusos.
 */
const MAX_SUJETOS = 10_000;

export class RateLimiter {
    private readonly windows = new Map<string, Window>();
    private lastSweep = Date.now();

    private windowFor(subject: string, now = Date.now()): Window {
        let w = this.windows.get(subject);
        if (w) return w;

        // Al llegar al tope se fuerza una limpieza aunque no toque por tiempo.
        if (this.windows.size >= MAX_SUJETOS) {
            this.sweep(now, true);
            // Si después de limpiar sigue lleno es que todos están activos:
            // se suelta el más antiguo para hacer sitio al que llega. Las
            // entradas de un Map se recorren en orden de inserción.
            if (this.windows.size >= MAX_SUJETOS) {
                const masViejo = this.windows.keys().next();
                if (!masViejo.done) this.windows.delete(masViejo.value);
            }
        }

        w = { hits: [], amounts: [] };
        this.windows.set(subject, w);
        return w;
    }

    /** Descarta sujetos inactivos para que el mapa no crezca sin fin. */
    private sweep(now: number, forzar = false): void {
        if (!forzar && now - this.lastSweep < 5 * MINUTE) return;
        this.lastSweep = now;
        for (const [subject, w] of this.windows) {
            const freshHit = w.hits.some((t) => now - t < HOUR);
            const freshAmt = w.amounts.some((a) => now - a.ts < HOUR);
            if (!freshHit && !freshAmt) this.windows.delete(subject);
        }
    }

    /** Sujetos vigilados ahora mismo. Para pruebas y para el endpoint de estado. */
    get tamano(): number {
        return this.windows.size;
    }

    countCall(subject: string, now = Date.now()): { perMinute: number; perHour: number } {
        this.sweep(now);
        const w = this.windowFor(subject, now);
        w.hits = w.hits.filter((t) => now - t < HOUR);
        w.hits.push(now);
        return {
            perMinute: w.hits.filter((t) => now - t < MINUTE).length,
            perHour: w.hits.length,
        };
    }

    /** Solo consulta; no registra. */
    peekCalls(subject: string, now = Date.now()): { perMinute: number; perHour: number } {
        const w = this.windows.get(subject);
        if (!w) return { perMinute: 0, perHour: 0 };
        return {
            perMinute: w.hits.filter((t) => now - t < MINUTE).length,
            perHour: w.hits.filter((t) => now - t < HOUR).length,
        };
    }

    addAmount(subject: string, usd: number, now = Date.now()): number {
        const w = this.windowFor(subject, now);
        w.amounts = w.amounts.filter((a) => now - a.ts < HOUR);
        w.amounts.push({ ts: now, usd });
        return w.amounts.reduce((sum, a) => sum + a.usd, 0);
    }

    hourlyAmount(subject: string, now = Date.now()): number {
        const w = this.windows.get(subject);
        if (!w) return 0;
        return w.amounts.filter((a) => now - a.ts < HOUR).reduce((sum, a) => sum + a.usd, 0);
    }

    reset(): void {
        this.windows.clear();
    }
}

export const rateLimiter = new RateLimiter();
