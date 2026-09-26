/**
 * MCP público — el conector que añaden los clientes en Claude, Codex (ChatGPT)
 * y Gemini/Antigravity.
 *
 *   POST /mcp                                   Streamable HTTP, sin estado
 *   GET  /.well-known/oauth-protected-resource  RFC 9728
 *
 * Es un recurso protegido OAuth 2.1: sin Bearer válido responde 401 con
 * `WWW-Authenticate: Bearer resource_metadata=…`, que es lo que hace que el
 * cliente descubra el servidor de autorización (el backend) y lance el flujo
 * PKCE sin que nadie configure nada a mano.
 *
 * Por aquí NO se publica el catálogo interno entero. Las 20 herramientas del
 * servidor incluyen GitHub, Playwright, Telegram o pagos con Stripe, pensadas
 * para el backend y el equipo. Al cliente sólo le llega una lista cerrada de
 * lectura y cotización, y dentro de ella sólo lo que cubren los scopes que la
 * persona concedió en la pantalla de consentimiento. Una herramienta nueva en
 * `registerTools` queda fuera por omisión.
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerTools } from './tools/index.js';
import { hardenServer } from './security/index.js';
import {
    verificarToken,
    TokenError,
    OAUTH_ISSUER,
    MCP_PUBLIC_URL,
    WWW_AUTHENTICATE,
    type Claims,
} from './auth/bearer.js';

/** Scope → herramientas que habilita. Mismos scopes que el consentimiento del backend. */
export const HERRAMIENTAS_POR_SCOPE: Record<string, readonly string[]> = {
    'chain.read': ['analyze_gas_strategy', 'blockscout_explorer', 'get_wallet_balance'],
    'payments.quote': ['get_payment_quote'],
};

export function herramientasPermitidas(scope: string | undefined): Set<string> {
    const permitidas = new Set<string>();
    for (const s of (scope || '').split(/\s+/)) {
        for (const h of HERRAMIENTAS_POR_SCOPE[s] || []) permitidas.add(h);
    }
    return permitidas;
}

/**
 * Proxy que sólo deja registrar las herramientas de la lista. Las demás ni se
 * dan de alta: no aparecen en `tools/list` y un `tools/call` con su nombre
 * falla como herramienta inexistente.
 */
function soloPermitidas<T extends { tool: (...args: any[]) => any }>(server: T, permitidas: Set<string>): T {
    return new Proxy(server, {
        get(target, prop, receiver) {
            if (prop === 'tool') {
                return (...args: any[]) => (permitidas.has(args[0]) ? target.tool(...args) : undefined);
            }
            return Reflect.get(target, prop, receiver);
        },
    });
}

function metadataRecurso() {
    return {
        resource: MCP_PUBLIC_URL,
        authorization_servers: [OAUTH_ISSUER],
        scopes_supported: Object.keys(HERRAMIENTAS_POR_SCOPE),
        bearer_methods_supported: ['header'],
        resource_name: 'BeZhas MCP',
        resource_documentation: 'https://bezhas.com/mcp',
    };
}

type ReqAutenticada = Request & { oauth?: Claims };

function noAutorizado(res: Response, error: 'invalid_request' | 'invalid_token', descripcion: string) {
    res.setHeader(
        'WWW-Authenticate',
        error === 'invalid_request' ? WWW_AUTHENTICATE : `${WWW_AUTHENTICATE}, error="invalid_token"`,
    );
    return res.status(401).json({
        jsonrpc: '2.0',
        error: { code: -32001, message: descripcion },
        id: null,
    });
}

async function exigirBearer(req: ReqAutenticada, res: Response, next: NextFunction) {
    const cabecera = req.headers.authorization || '';
    const m = /^Bearer\s+([A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+)$/i.exec(cabecera);
    if (!m) return noAutorizado(res, 'invalid_request', 'Falta el token de acceso.');
    try {
        req.oauth = await verificarToken(m[1]);
        return next();
    } catch (err) {
        if (err instanceof TokenError) return noAutorizado(res, 'invalid_token', err.message);
        // JWKS caído u otro fallo nuestro: no es culpa del token, no se le
        // pide al cliente que vuelva a autorizar.
        console.error('[mcp-public] verificación del token:', (err as Error).message);
        return res.status(503).json({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Autorización no disponible temporalmente.' },
            id: null,
        });
    }
}

export function crearRouterMcpPublico(): Router {
    const router = Router();

    // El navegador no deja leer WWW-Authenticate a un cliente web si no se expone.
    router.use((_req, res, next) => {
        res.setHeader('Access-Control-Expose-Headers', 'WWW-Authenticate, Mcp-Session-Id');
        next();
    });

    const metadata = (_req: Request, res: Response) => {
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.json(metadataRecurso());
    };
    router.get('/.well-known/oauth-protected-resource', metadata);
    router.get('/.well-known/oauth-protected-resource/mcp', metadata);

    // Techo por persona, además del global por IP: detrás de un NAT
    // corporativo muchas personas comparten IP y una sola no debe agotarla.
    const porSujeto = rateLimit({
        windowMs: 60_000,
        limit: Number(process.env.MCP_PUBLIC_LIMIT_PER_MINUTE || 120),
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        keyGenerator: (req) => `oauth:${(req as ReqAutenticada).oauth?.sub}`,
    });

    router.post('/mcp', exigirBearer, porSujeto, async (req: ReqAutenticada, res: Response) => {
        const claims = req.oauth!;
        const sujeto = `oauth:${claims.sub}`;

        // Un servidor por petición: sin estado compartido entre personas, y la
        // lista de herramientas sale de SUS scopes, no de los de otro.
        const server = new McpServer({ name: 'bezhas-mcp', version: '1.0.0' });
        const blindado = hardenServer(server, { resolveSubject: () => sujeto });
        registerTools(soloPermitidas(blindado, herramientasPermitidas(claims.scope)) as unknown as McpServer);

        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
            enableJsonResponse: true,
        });
        res.on('close', () => {
            void transport.close();
            void server.close();
        });
        try {
            await server.connect(transport);
            await transport.handleRequest(req, res, req.body);
        } catch (err) {
            console.error('[mcp-public] petición:', (err as Error).message);
            if (!res.headersSent) {
                res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Error interno.' }, id: null });
            }
        }
    });

    // Sin estado: no hay stream de servidor que abrir ni sesión que cerrar.
    const sinSesion = (_req: Request, res: Response) => {
        res.setHeader('Allow', 'POST');
        res.status(405).json({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Método no permitido: este servidor MCP no guarda sesión.' },
            id: null,
        });
    };
    router.get('/mcp', sinSesion);
    router.delete('/mcp', sinSesion);

    return router;
}
