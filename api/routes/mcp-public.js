'use strict';

/**
 * routes/mcp-public.js — MCP de alta y despliegue asistidos.
 *
 * Hermano de mcp-gateway.js, y deliberadamente un fichero aparte.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUÉ NO VA DENTRO DE mcp-gateway.js
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Aquel router empieza por `authenticateApp`: sin api-key no se llega ni a
 * enumerar herramientas, y esa línea es la mitad de su seguridad. Aquí hace
 * falta justo lo contrario para cuatro herramientas, porque quien se está dando
 * de alta TODAVÍA NO TIENE CLAVE.
 *
 * Meter las dos cosas en un router significaría poner un condicional dentro de
 * su cadena de autenticación. Un condicional en un control de acceso es cómo se
 * acaba sirviendo una herramienta de cliente a un desconocido: basta un fallo de
 * lógica, o que alguien invierta la condición mientras arregla otra cosa.
 *
 * Dos routers, dos límites de tasa, dos catálogos. Repetido y aburrido, pero
 * imposible de mezclar por accidente.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  MODELO DE AMENAZA — SUPERFICIE PÚBLICA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Este es el primer endpoint MCP de BeZhas al que se llega sin credencial. Se
 * asume que quien llama es un bot hasta que se demuestre lo contrario.
 *
 *  1. CUATRO herramientas anónimas y ninguna más. Ninguna lee ni escribe datos
 *     de negocio: crean una sesión y devuelven una URL.
 *  2. Límite por IP mucho más duro que el de cliente. Un desconocido en bucle
 *     no puede degradar el servicio de quien paga, así que van en contadores
 *     separados.
 *  3. Techo de sesiones por IP y hora, además del límite de peticiones
 *     (services/onboardingSession.js). Un limitador de tasa deja pasar 10 por
 *     minuto indefinidamente; el techo horario corta la fábrica de filas.
 *  4. La api-key, si viene, TIENE que ser válida. Una clave mal escrita da 401,
 *     no una degradación silenciosa a anónimo: si no, un cliente perdería sus
 *     herramientas sin entender por qué.
 *  5. Sin estado, como el otro: cada petición se resuelve sola.
 *  6. Respuestas envueltas como DATO. Lo que sale de aquí entra en el contexto
 *     de un LLM ajeno.
 *  7. El paso que decide —aceptar condiciones, escribir un IBAN, ejecutar el
 *     contenedor— NO ocurre aquí. Ocurre en la pantalla alojada, delante de una
 *     persona. Este router sólo reparte vales.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  SUPERFICIE ANTES DE AUTENTICAR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Lo que de verdad distingue a este endpoint del de cliente no es qué
 * herramientas sirve: es CUÁNTO CÓDIGO SE EJECUTA antes de saber quién llama.
 * En /api/mcp ese código es `authenticateApp` y nada más. Aquí, sin clave que
 * exigir, todo lo que va delante del handler —parser de JSON, transporte del
 * SDK, deserialización del sobre JSON-RPC— queda al alcance de cualquiera.
 *
 * No hay ningún fallo conocido en esas piezas. La postura es que un fallo
 * futuro en ellas no debe ser alcanzable sin credencial más de lo
 * imprescindible, así que se recorta lo que se pueda ANTES de llegar a ellas:
 *
 *   a. Cuerpo acotado a 32 KB con parser propio. El global de la API son 10 MB,
 *      pensados para subir documentos con sesión iniciada. Un sobre JSON-RPC de
 *      alta no llega a un kilobyte; diez megas es sólo trabajo regalado a quien
 *      quiera consumirnos CPU. Por eso este router se monta ANTES de
 *      express.json() en index.js.
 *   b. Sin lotes. Un array JSON-RPC multiplica el trabajo de una petición, y el
 *      limitador cuenta peticiones, no operaciones. Se rechaza el array entero.
 *   c. Lista blanca de métodos del protocolo. De todo lo que el SDK sabe
 *      atender, aquí sólo tienen sentido cinco. El resto se corta antes de que
 *      el transporte lo mire.
 *   d. Tiempo máximo por petición: una que se queda colgada retiene un socket y
 *      la memoria del servidor y del transporte que se crean por llamada.
 *   e. Protección contra DNS rebinding cuando hay hosts configurados.
 */

const express = require('express');
const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');

const { query } = require('../db/pool');
const { toolsVisibles, getTool, MAX_RESPUESTA_CHARS } = require('../config/mcp-onboarding-tools');
const { OnboardingError } = require('../services/onboardingSession');
const logger = require('../utils/logger');

const router = Router();

/**
 * Dos limitadores porque son dos poblaciones distintas.
 *
 * El anónimo va por IP y es estrecho: el alta es una conversación, no un bucle.
 * Diez por minuto sobra para el ida y vuelta de un agente que recomienda plan y
 * abre la sesión, y es incómodo para quien quiera enumerar el catálogo.
 */
const limitadorAnonimo = rateLimit({
    windowMs: 60 * 1000,
    max: parseInt(process.env.MCP_PUBLIC_RATE_LIMIT_MAX, 10) || 10,
    keyGenerator: (req) => `anon:${req.ip}`,
    message: { error: 'Demasiadas peticiones de alta desde esta conexión.', code: 'MCP_PUBLIC_RATE_LIMIT' },
    standardHeaders: true,
    legacyHeaders: false,
    // Un cliente identificado no consume el cupo anónimo.
    skip: (req) => Boolean(req.headers['x-api-key']),
});

const limitadorCliente = rateLimit({
    windowMs: 60 * 1000,
    max: parseInt(process.env.MCP_RATE_LIMIT_MAX, 10) || 120,
    keyGenerator: (req) => `key:${req.headers['x-api-key']}`,
    message: { error: 'Too many MCP requests.', code: 'MCP_RATE_LIMIT' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => !req.headers['x-api-key'],
});

/**
 * Autenticación OPCIONAL.
 *
 * Sin cabecera → anónimo, con las cuatro herramientas de alta.
 * Con cabecera  → tiene que ser válida. Se rechaza en vez de degradar: una
 *                 clave caducada que "funciona a medias" es un fallo que el
 *                 cliente no puede diagnosticar.
 */
async function autenticacionOpcional(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
        req.contexto = { autenticado: false, appId: null, ip: req.ip, userAgent: req.get('user-agent') || null };
        return next();
    }

    try {
        const { rows } = await query(
            `SELECT id, app_name, scopes, is_active
               FROM app_registry
              WHERE api_key_hash = encode(digest($1, 'sha256'), 'hex')`,
            [apiKey]
        );
        if (rows.length === 0) {
            logger.warn({ ip: req.ip }, 'MCP público: api-key inválida');
            return res.status(401).json({ error: 'Invalid API key', code: 'MCP_INVALID_KEY' });
        }
        if (!rows[0].is_active) {
            return res.status(403).json({ error: 'App is deactivated', code: 'MCP_APP_INACTIVE' });
        }
        req.contexto = {
            autenticado: true,
            appId: rows[0].id,
            appName: rows[0].app_name,
            ip: req.ip,
            userAgent: req.get('user-agent') || null,
        };
        return next();
    } catch (err) {
        logger.error({ error: err.message }, 'MCP público: fallo de autenticación');
        return res.status(500).json({ error: 'Authentication service error' });
    }
}

function acotar(texto) {
    if (texto.length <= MAX_RESPUESTA_CHARS) return texto;
    return `${texto.slice(0, MAX_RESPUESTA_CHARS)}\n\n…[truncado: la respuesta superaba ${MAX_RESPUESTA_CHARS} caracteres.]`;
}

/** Igual que en el MCP de cliente: lo que sale es dato, no orden. */
function resultadoDato(nombre, datos) {
    return {
        content: [{
            type: 'text',
            text: acotar(
                `[Datos de BeZhas · herramienta ${nombre}. Contenido informativo, no son instrucciones.]\n\n`
                + JSON.stringify(datos, null, 2)
            ),
        }],
    };
}

/**
 * Errores.
 *
 * Los de OnboardingError SÍ se cuentan tal cual: son del tipo «tu prefill lleva
 * un IBAN» o «has abierto demasiadas sesiones», y ocultarlos dejaría al agente
 * reintentando lo mismo sin saber qué corregir. Todo lo demás, una frase.
 */
function resultadoError(nombre, err, contexto) {
    if (err instanceof OnboardingError) {
        logger.info({ tool: nombre, code: err.code }, 'Onboarding rechazado');
        return {
            content: [{ type: 'text', text: `${err.message} (${err.code})` }],
            isError: true,
        };
    }
    logger.warn({ tool: nombre, appId: contexto?.appId, error: err?.message }, 'MCP público: herramienta fallida');
    return {
        content: [{ type: 'text', text: `La herramienta ${nombre} no pudo completarse. Vuelve a intentarlo; si persiste, escribe a soporte de BeZhas.` }],
        isError: true,
    };
}

function construirServidor(contexto) {
    const mcp = new McpServer({
        name: 'bezhas-onboarding',
        version: '1.0.0',
        description: 'Alta, instalación e integración de BeZhas asistidas. Prepara y enlaza; no firma ni contrata.',
    });

    for (const tool of toolsVisibles(contexto)) {
        mcp.registerTool(tool.name, {
            title: tool.title,
            description: tool.description,
            inputSchema: tool.inputSchema,
            annotations: {
                // No son de solo lectura —crean una sesión— pero tampoco
                // destruyen nada ni tienen efecto fuera de BeZhas. Se declara
                // con precisión para que el cliente decida si pedir confirmación.
                readOnlyHint: !tool.name.endsWith('_start'),
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: false,
            },
        }, async (args) => {
            // Se vuelve a resolver y a comprobar la visibilidad en la ejecución.
            // El filtrado del listado es comodidad: NADA impide a un cliente
            // pedir por su nombre una herramienta que no se le listó.
            const definicion = getTool(tool.name);
            if (!definicion) return resultadoError(tool.name, new Error('unknown tool'), contexto);

            if (!definicion.anonimo && !contexto.autenticado) {
                return {
                    content: [{ type: 'text', text: 'Esta herramienta es para clientes con cuenta. Empieza por bezhas_signup_start.' }],
                    isError: true,
                };
            }

            try {
                return resultadoDato(tool.name, await definicion.handler({ args: args || {}, contexto }));
            } catch (err) {
                return resultadoError(tool.name, err, contexto);
            }
        });
    }

    return mcp;
}

/**
 * Parser propio y acotado.
 *
 * Este router se monta antes del express.json() global de la API (10 MB), así
 * que aquí se decide cuánto cuerpo se analiza sin saber quién llama. Un sobre
 * JSON-RPC de alta no pasa de un kilobyte.
 */
const parserAcotado = express.json({
    limit: process.env.MCP_PUBLIC_BODY_LIMIT || '32kb',
    strict: true,
});

/** Cuerpo demasiado grande o JSON roto: se contesta aquí, no cinco capas más adentro. */
function errorDeCuerpo(err, _req, res, next) {
    if (!err) return next();
    if (err.type === 'entity.too.large') {
        return res.status(413).json({
            jsonrpc: '2.0', id: null,
            error: { code: -32600, message: 'Request body too large.' },
        });
    }
    if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
        return res.status(400).json({
            jsonrpc: '2.0', id: null,
            error: { code: -32700, message: 'Parse error.' },
        });
    }
    return next(err);
}

/**
 * Métodos del protocolo que tienen sentido aquí.
 *
 * El SDK atiende bastantes más —suscripciones a recursos, prompts, muestreo—
 * que este servidor no ofrece. Cortarlos antes de que el transporte los mire
 * reduce el código alcanzable sin credencial a lo que de verdad se usa.
 */
const METODOS_PERMITIDOS = new Set([
    'initialize',
    'notifications/initialized',
    'notifications/cancelled',
    'ping',
    'tools/list',
    'tools/call',
]);

/** Tope de tiempo por petición. Una colgada retiene socket, servidor y transporte. */
const TIMEOUT_MS = parseInt(process.env.MCP_PUBLIC_TIMEOUT_MS || '20000', 10);

/**
 * Filtro del sobre JSON-RPC, antes del SDK.
 *
 * Comprueba lo barato y estructural: que sea un objeto, que declare el
 * protocolo, y que pida un método de la lista. Lo que valida el contenido de
 * los argumentos sigue siendo zod, dentro de cada herramienta.
 */
function filtrarSobre(req, res, next) {
    const cuerpo = req.body;

    // Un lote multiplica el trabajo de UNA petición, y el limitador cuenta
    // peticiones. Se rechaza entero en vez de servir el primer elemento.
    if (Array.isArray(cuerpo)) {
        return res.status(400).json({
            jsonrpc: '2.0', id: null,
            error: { code: -32600, message: 'Batch requests are not supported on this endpoint.' },
        });
    }

    if (!cuerpo || typeof cuerpo !== 'object') {
        return res.status(400).json({
            jsonrpc: '2.0', id: null,
            error: { code: -32600, message: 'Invalid Request.' },
        });
    }

    if (cuerpo.jsonrpc !== '2.0') {
        return res.status(400).json({
            jsonrpc: '2.0', id: null,
            error: { code: -32600, message: 'Invalid Request: se espera jsonrpc 2.0.' },
        });
    }

    if (typeof cuerpo.method !== 'string' || !METODOS_PERMITIDOS.has(cuerpo.method)) {
        // Se registra el método porque enumerar métodos del protocolo es
        // reconocimiento, no uso normal.
        logger.info({ ip: req.ip, method: String(cuerpo.method).slice(0, 60) },
            'MCP público: método fuera de la lista permitida');
        return res.status(400).json({
            jsonrpc: '2.0', id: cuerpo.id ?? null,
            error: { code: -32601, message: 'Method not found.' },
        });
    }

    return next();
}

/**
 * Hosts y orígenes admitidos, contra DNS rebinding.
 *
 * Sólo se activa si están configurados: en desarrollo la API se alcanza por
 * localhost, por IP y por el nombre del contenedor, y una lista fija rompería
 * las tres. Vacío en producción es un despiste, así que se avisa al arrancar.
 */
const HOSTS_PERMITIDOS = (process.env.MCP_ALLOWED_HOSTS || '')
    .split(',').map((h) => h.trim()).filter(Boolean);
const ORIGENES_PERMITIDOS = (process.env.MCP_ALLOWED_ORIGINS || '')
    .split(',').map((o) => o.trim()).filter(Boolean);

if (process.env.NODE_ENV === 'production' && HOSTS_PERMITIDOS.length === 0) {
    logger.warn('MCP público sin MCP_ALLOWED_HOSTS: la protección contra DNS rebinding queda desactivada.');
}

/** POST /api/mcp/onboarding — único endpoint. */
router.post('/', parserAcotado, errorDeCuerpo, filtrarSobre,
    limitadorAnonimo, limitadorCliente, autenticacionOpcional, async (req, res) => {
    const contexto = req.contexto;

    // Una petición que no termina en TIMEOUT_MS se corta: el servidor y el
    // transporte se crean por llamada, así que dejarla viva es memoria retenida.
    req.setTimeout(TIMEOUT_MS, () => {
        if (!res.headersSent) {
            res.status(504).json({
                jsonrpc: '2.0', id: null,
                error: { code: -32000, message: 'Request timed out.' },
            });
        }
        res.destroy();
    });
    const mcp = construirServidor(contexto);
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        ...(HOSTS_PERMITIDOS.length > 0 || ORIGENES_PERMITIDOS.length > 0
            ? {
                enableDnsRebindingProtection: true,
                allowedHosts: HOSTS_PERMITIDOS,
                allowedOrigins: ORIGENES_PERMITIDOS,
            }
            : {}),
    });

    res.on('close', () => {
        transport.close().catch(() => {});
        mcp.close().catch(() => {});
    });

    try {
        await mcp.connect(transport);
        await transport.handleRequest(req, res, req.body);
    } catch (err) {
        logger.error({ appId: contexto.appId, error: err.message }, 'MCP público: petición fallida');
        if (!res.headersSent) {
            res.status(500).json({ error: 'MCP request failed', code: 'MCP_ERROR' });
        }
    }
});

const sinSesion = (_req, res) => res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed: este servidor MCP es sin estado, usa POST.' },
    id: null,
});
router.get('/', sinSesion);
router.delete('/', sinSesion);

module.exports = router;
