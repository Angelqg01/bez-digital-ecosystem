/**
 * Verificación del access token OAuth 2.1 del MCP público.
 *
 * El servidor de autorización es el backend (api.bezhas.com): autentica a la
 * persona y firma el token con su clave privada ES256. Este servicio NO tiene
 * base de datos ni esa clave: sólo verifica la firma con la pública, que saca
 * de /.well-known/jwks.json del backend (o de OAUTH_JWT_PUBLIC_KEY si se
 * inyecta, que evita la dependencia de red en el arranque y en las pruebas).
 *
 * Se implementa con `node:crypto` y no con una librería: son pocas líneas y
 * todas las comprobaciones están a la vista — algoritmo fijado a ES256 (un
 * token con `alg: none` o HS256 no pasa), `kid` conocido, firma, emisor,
 * audiencia y caducidad.
 */
import crypto, { type KeyObject } from 'node:crypto';

export interface Claims {
    sub: string;
    iss: string;
    aud: string | string[];
    exp: number;
    iat?: number;
    nbf?: number;
    jti?: string;
    scope?: string;
    client_id?: string;
}

export class TokenError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TokenError';
    }
}

export const OAUTH_ISSUER = process.env.OAUTH_ISSUER || process.env.BACKEND_URL || 'https://api.bezhas.com';
export const MCP_PUBLIC_URL = process.env.MCP_PUBLIC_URL || 'https://mcp.bezhas.com';
const JWKS_URL = process.env.OAUTH_JWKS_URL || `${OAUTH_ISSUER}/.well-known/jwks.json`;
const JWKS_TTL_MS = 10 * 60_000;
const LEEWAY_S = 30;

function pem(valor?: string): string | null {
    if (!valor) return null;
    const v = valor.trim();
    if (v.startsWith('-----BEGIN')) return v;
    const d = Buffer.from(v, 'base64').toString('utf8');
    return d.startsWith('-----BEGIN') ? d : null;
}

let cache: { claves: Map<string, KeyObject>; cargado: number } | null = null;
let cargaEnCurso: Promise<void> | null = null;

async function cargarJwks(): Promise<void> {
    const r = await fetch(JWKS_URL, { signal: AbortSignal.timeout(5_000) });
    if (!r.ok) throw new TokenError(`JWKS no disponible (${r.status})`);
    const { keys } = (await r.json()) as { keys?: Array<Record<string, unknown>> };
    const claves = new Map<string, KeyObject>();
    for (const k of keys || []) {
        if (k.kty !== 'EC' || k.crv !== 'P-256' || typeof k.kid !== 'string') continue;
        claves.set(k.kid, crypto.createPublicKey({ key: k as crypto.JsonWebKey, format: 'jwk' }));
    }
    cache = { claves, cargado: Date.now() };
}

async function claveParaKid(kid: string | undefined): Promise<KeyObject> {
    const fija = pem(process.env.OAUTH_JWT_PUBLIC_KEY);
    if (fija) return crypto.createPublicKey(fija);
    if (!kid) throw new TokenError('Token sin kid');

    const caducado = !cache || Date.now() - cache.cargado > JWKS_TTL_MS;
    // Kid desconocido con la caché fresca: puede ser una rotación de clave.
    // Se recarga, pero como mucho una vez por minuto, para que un token con kid
    // inventado no convierta este servicio en un amplificador contra el backend.
    const recargarPorKid = cache && !cache.claves.has(kid) && Date.now() - cache.cargado > 60_000;
    if (caducado || recargarPorKid) {
        cargaEnCurso ??= cargarJwks().finally(() => { cargaEnCurso = null; });
        await cargaEnCurso;
    }
    const clave = cache?.claves.get(kid);
    if (!clave) throw new TokenError('kid desconocido');
    return clave;
}

const b64urlJson = (parte: string) => JSON.parse(Buffer.from(parte, 'base64url').toString('utf8'));

export async function verificarToken(token: string): Promise<Claims> {
    const partes = token.split('.');
    if (partes.length !== 3) throw new TokenError('Formato de token no válido');
    const [h, p, s] = partes;

    let header: { alg?: string; kid?: string; typ?: string };
    let claims: Claims;
    try {
        header = b64urlJson(h);
        claims = b64urlJson(p);
    } catch {
        throw new TokenError('Token ilegible');
    }
    if (header.alg !== 'ES256') throw new TokenError('Algoritmo no admitido');

    const clave = await claveParaKid(header.kid);
    const firmaOk = crypto.verify(
        'sha256', Buffer.from(`${h}.${p}`), { key: clave, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url'),
    );
    if (!firmaOk) throw new TokenError('Firma no válida');

    const ahora = Math.floor(Date.now() / 1000);
    if (typeof claims.exp !== 'number' || claims.exp + LEEWAY_S < ahora) throw new TokenError('Token caducado');
    if (typeof claims.nbf === 'number' && claims.nbf - LEEWAY_S > ahora) throw new TokenError('Token aún no válido');
    if (claims.iss !== OAUTH_ISSUER) throw new TokenError('Emisor no válido');
    // Igualdad exacta por elemento: `aud` puede llegar como cadena, y un
    // `includes` sobre ella aceptaría «https://mcp.bezhas.com.evil.example».
    const aud: unknown[] = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!aud.some((a) => a === MCP_PUBLIC_URL)) throw new TokenError('Audiencia no válida');
    if (typeof claims.sub !== 'string' || !claims.sub) throw new TokenError('Token sin sujeto');
    return claims;
}

/** RFC 9728 §5.1: el 401 dice dónde está la metadata del recurso protegido. */
export const WWW_AUTHENTICATE = `Bearer resource_metadata="${MCP_PUBLIC_URL}/.well-known/oauth-protected-resource"`;

/** Sólo para pruebas. */
export function _resetJwksCache(): void {
    cache = null;
}
