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

export class RateLimiter {
    private readonly windows = new Map<string, Window>();
    private lastSweep = Date.now();

    private windowFor(subject: string): Window {
        let w = this.windows.get(subject);
        if (!w) {
            w = { hits: [], amounts: [] };
            this.windows.set(subject, w);
        }
        return w;
    }

    /** Descarta sujetos inactivos para que el mapa no crezca sin fin. */
    private sweep(now: number): void {
        if (now - this.lastSweep < 5 * MINUTE) return;
        this.lastSweep = now;
        for (const [subject, w] of this.windows) {
            const freshHit = w.hits.some((t) => now - t < HOUR);
            const freshAmt = w.amounts.some((a) => now - a.ts < HOUR);
            if (!freshHit && !freshAmt) this.windows.delete(subject);
        }
    }

    countCall(subject: string, now = Date.now()): { perMinute: number; perHour: number } {
        this.sweep(now);
        const w = this.windowFor(subject);
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
        const w = this.windowFor(subject);
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
