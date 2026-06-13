/**
 * API-Key auth para el HTTP wrapper del MCP server (superficie institucional).
 *
 * Modo OPT-IN para no romper despliegues existentes:
 *  - Si `MCP_API_KEY` (o lista separada por comas `MCP_API_KEYS`) está definida,
 *    toda ruta protegida exige `X-API-Key: <key>` o `Authorization: Bearer <key>`.
 *  - Si NO hay clave configurada, se permite el paso pero se loggea un aviso
 *    (una sola vez) — el server queda en modo legacy/inseguro.
 *
 * `/api/mcp/health` queda siempre público (probes de Cloud Run).
 */
import type { Request, Response, NextFunction } from 'express';

export interface ApiKeyAuthOptions {
    /** Claves válidas. Si está vacío → modo legacy (allow + warn). */
    keys?: string[];
    /** Paths exentos de auth (prefijo exacto). */
    publicPaths?: string[];
    /** Logger para el aviso de modo legacy (default console.warn). */
    warn?: (msg: string) => void;
}

export function loadKeysFromEnv(env: NodeJS.ProcessEnv = process.env): string[] {
    const single = (env.MCP_API_KEY || '').trim();
    const multi = (env.MCP_API_KEYS || '')
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);
    const all = [...multi];
    if (single) all.push(single);
    return [...new Set(all)];
}

export function createApiKeyAuth(opts: ApiKeyAuthOptions = {}) {
    const keys = new Set(opts.keys ?? loadKeysFromEnv());
    const publicPaths = opts.publicPaths ?? ['/api/mcp/health'];
    const warn = opts.warn ?? ((m: string) => console.warn(m));
    let warned = false;

    return function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
        if (publicPaths.some((p) => req.path === p)) {
            next();
            return;
        }

        if (keys.size === 0) {
            if (!warned) {
                warned = true;
                warn(
                    '⚠️  MCP HTTP server SIN auth: define MCP_API_KEY para exigir X-API-Key en /api/mcp/* (modo legacy activo)'
                );
            }
            next();
            return;
        }

        const headerKey = req.header('x-api-key');
        const bearer = (req.header('authorization') || '').replace(/^Bearer\s+/i, '');
        const presented = headerKey || bearer;

        if (presented && keys.has(presented)) {
            next();
            return;
        }

        res.status(401).json({
            error: 'Unauthorized',
            message: 'API key requerida: header X-API-Key o Authorization: Bearer <key>',
        });
    };
}
