/**
 * auth-secrets — fuente ÚNICA del secreto y la vida de los JWT del Control Center.
 *
 * Espejo TypeScript de api/config/secrets.js. El fallback de desarrollo DEBE ser
 * idéntico en los cuatro backends (API core, Hub, gateway y este) o el SSO entre
 * Apps Nativas se rompe en local: un token emitido por uno no verifica en el otro.
 *
 * Antes este servicio usaba 'bezhas_secret_key', distinto de los otros tres.
 *
 * Sólo debe importarse desde código de servidor (route handlers). No lo uses en
 * componentes cliente: filtraría el secreto al bundle del navegador.
 */

// Sólo el tipo: TypeScript lo borra al compilar, así que esto no mete
// jsonwebtoken en el bundle ni cambia nada en tiempo de ejecución.
import type { SignOptions } from 'jsonwebtoken';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * `next build` pone NODE_ENV=production e importa este módulo para recolectar
 * los datos de las rutas de app/api/auth. En esa fase no hay —ni debe haber—
 * ningún secreto real disponible: compilar no requiere credenciales. Sin esta
 * distinción el build moría con "Failed to collect page data for
 * /api/auth/verify", tanto en local como en CI.
 *
 * Esto NO relaja la comprobación en ejecución: al arrancar el servidor NEXT_PHASE
 * ya no vale 'phase-production-build', así que un despliegue sin JWT_SECRET sigue
 * reventando de inmediato, que es justo lo que se busca.
 */
const IS_BUILD_PHASE = process.env.NEXT_PHASE === 'phase-production-build';

/** Sólo se exige un secreto real cuando se va a ejecutar de verdad. */
const REQUIRES_REAL_SECRET = IS_PRODUCTION && !IS_BUILD_PHASE;

/** Debe coincidir con api/config/secrets.js. */
const DEV_FALLBACK_SECRET = 'dev-only-secret';

const resolved = process.env.JWT_SECRET || (REQUIRES_REAL_SECRET ? null : DEV_FALLBACK_SECRET);

if (!resolved) {
    throw new Error('FATAL: falta JWT_SECRET en producción.');
}
if (REQUIRES_REAL_SECRET && resolved === DEV_FALLBACK_SECRET) {
    throw new Error('FATAL: JWT_SECRET tiene el valor de desarrollo en producción. Rótalo antes de desplegar.');
}

export const JWT_SECRET: string = resolved;

/** El valor en crudo, que es lo que sabe parsear parseTtlSeconds(). */
const resolvedTtl: string = process.env.JWT_ACCESS_TTL || '24h';

/**
 * Mismo TTL que el resto del ecosistema (ver api/config/secrets.js).
 *
 * El tipo NO es `string` a propósito. `@types/jsonwebtoken` declara
 * `expiresIn?: StringValue | number`, donde `StringValue` es el tipo de plantilla
 * de `ms` (`"24h"`, `"7d"`…). Un `string` genérico no es asignable a él, así que
 * `jwt.sign(..., { expiresIn: JWT_ACCESS_TTL })` no casaba con ninguna sobrecarga
 * y `next build` fallaba en las tres rutas de auth — el build llevaba roto desde
 * 8d47f06 sin que se notara, porque los tests corren con SWC, que borra los tipos
 * sin comprobarlos.
 *
 * El valor sale de una variable de entorno, así que no se puede validar en tiempo
 * de compilación; la validación real la hace parseTtlSeconds() aquí abajo, que
 * revienta al arrancar si el formato no se reconoce.
 */
export const JWT_ACCESS_TTL = resolvedTtl as NonNullable<SignOptions['expiresIn']>;

/**
 * El mismo TTL en segundos, para el maxAge de las cookies. Se deriva del valor
 * anterior en lugar de repetir un número, que es como se desincronizan.
 */
export const JWT_ACCESS_TTL_SECONDS: number = parseTtlSeconds(resolvedTtl);

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
