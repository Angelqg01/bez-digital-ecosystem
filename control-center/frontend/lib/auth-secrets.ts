/**
 * auth-secrets — fuente ÚNICA del secreto y la vida de los JWT del Control Center.
 *
 * Espejo TypeScript de api/config/secrets.js. El fallback de desarrollo DEBE ser
 * idéntico en los cuatro backends (API core, Hub, gateway y este) o el SSO entre
 * SubApps se rompe en local: un token emitido por uno no verifica en el otro.
 *
 * Antes este servicio usaba 'bezhas_secret_key', distinto de los otros tres.
 *
 * Sólo debe importarse desde código de servidor (route handlers). No lo uses en
 * componentes cliente: filtraría el secreto al bundle del navegador.
 */

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/** Debe coincidir con api/config/secrets.js. */
const DEV_FALLBACK_SECRET = 'dev-only-secret';

const resolved = process.env.JWT_SECRET || (IS_PRODUCTION ? null : DEV_FALLBACK_SECRET);

if (!resolved) {
    throw new Error('FATAL: falta JWT_SECRET en producción.');
}
if (IS_PRODUCTION && resolved === DEV_FALLBACK_SECRET) {
    throw new Error('FATAL: JWT_SECRET tiene el valor de desarrollo en producción. Rótalo antes de desplegar.');
}

export const JWT_SECRET: string = resolved;

/** Mismo TTL que el resto del ecosistema (ver api/config/secrets.js). */
export const JWT_ACCESS_TTL: string = process.env.JWT_ACCESS_TTL || '24h';

/**
 * El mismo TTL en segundos, para el maxAge de las cookies. Se deriva del valor
 * anterior en lugar de repetir un número, que es como se desincronizan.
 */
export const JWT_ACCESS_TTL_SECONDS: number = parseTtlSeconds(JWT_ACCESS_TTL);

function parseTtlSeconds(ttl: string): number {
    const match = /^(\d+)\s*([smhd])$/.exec(ttl.trim());
    if (!match) {
        const asNumber = Number(ttl);
        if (Number.isFinite(asNumber) && asNumber > 0) return asNumber;
        throw new Error(`JWT_ACCESS_TTL no reconocido: "${ttl}". Usa 30s, 15m, 24h o 7d.`);
    }
    const value = Number(match[1]);
    const unit = match[2] as 's' | 'm' | 'h' | 'd';
    const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[unit];
    return value * multiplier;
}
