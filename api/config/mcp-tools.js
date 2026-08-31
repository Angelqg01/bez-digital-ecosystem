'use strict';

/**
 * config/mcp-tools.js — Catálogo de herramientas del MCP de cara al cliente.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUÉ ESTE FICHERO ES UNA LISTA BLANCA Y NO UN PROXY
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La tentación evidente es exponer UNA herramienta genérica —
 * `call_gateway(path, params)`— y dejar que el agente componga la llamada. Eso
 * convertiría el MCP en un proxy de toda la API: `requireScope` se aplica por
 * ruta en Express, así que una herramienta que acepta la ruta como argumento
 * salta el control de permisos por diseño. Además abriría SSRF y permitiría
 * alcanzar rutas internas nunca pensadas para clientes.
 *
 * Aquí cada herramienta es UN endpoint concreto, con su scope declarado y sus
 * argumentos validados. Lo que no está en esta lista no existe para un cliente.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUÉ NO HAY NINGUNA HERRAMIENTA CON `address` COMO ARGUMENTO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Varios endpoints del Gateway aceptan una dirección arbitraria y devuelven
 * datos de quien sea, porque `app_registry` no tiene titular: la api-key
 * identifica una APP, no a un dueño de datos, así que no hay contra qué
 * contrastar la dirección recibida.
 *
 * En la API REST eso ya es un problema. En un MCP sería mucho peor: las
 * direcciones son públicas en cadena, y «tráeme el historial de pagos y el
 * estado KYC de estas 200 direcciones» es UNA frase. Se pasaría de una
 * vulnerabilidad que hay que saber explotar a una que se explota en lenguaje
 * natural.
 *
 * Quedan fuera hasta que exista vinculación entre la api-key y las direcciones
 * que le pertenecen:
 *
 *   GET /payments/history/:address  → tipo, importe, método, destinatario,
 *                                     NOTA y tx de cualquiera. Datos internos,
 *                                     no de cadena.
 *   GET /kyc/status/:address        → nivel KYC, proveedor, fecha de
 *                                     verificación y volumen acumulado en USD.
 *                                     Dato personal y de cumplimiento.
 *   GET /wallet/history/:address    → movimientos por dirección.
 *   GET /bridge/transfers/:address  → transferencias por dirección.
 *   GET /staking|farming/positions/:address → posiciones por dirección.
 *
 * También queda fuera GET /apps/list: exige scope `admin` y devuelve el
 * registro COMPLETO de clientes con sus permisos, tarifa y límites. Estuvo un
 * momento en este catálogo con scope `contracts` por descuido, que habría dado
 * a cualquier cliente la lista de todos los demás. Es administración interna,
 * no superficie de cliente, y no pertenece aquí con ningún scope.
 *
 * Las dos primeras son las graves. Las tres últimas reflejan estado de cadena
 * —consultable en cualquier explorador— pero se excluyen igual: mientras no
 * haya titular, no se ofrece ninguna herramienta que tome una dirección ajena.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUÉ v1 ES DE SOLO LECTURA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El Gateway tiene escritura: votar, proponer, encolar y ejecutar en la DAO.
 * Nada de eso entra aquí. Votar exige la firma del votante, y un agente que
 * vota «en nombre de» sin firma es un agente que decide gobernanza por su
 * cuenta. Cuando se exponga, será con firma del usuario y confirmación humana
 * explícita, no antes.
 */

const { z } = require('zod');

/** Tope de caracteres por respuesta. Un agente que pide 10.000 filas no debe
 *  poder inundar su propia ventana de contexto ni la memoria del servidor. */
const MAX_RESPUESTA_CHARS = parseInt(process.env.MCP_MAX_RESPONSE_CHARS || '24000', 10);

/**
 * Catálogo. Cada entrada:
 *   scope        — permiso del Gateway exigido. Si la api-key no lo tiene, la
 *                  herramienta NO SE LISTA siquiera (ver mcp-gateway.js).
 *   inputSchema  — forma zod. Sin esquema = sin argumentos.
 *   handler      — recibe ({ args, app, deps }) y devuelve un objeto plano.
 *                  Llama a los servicios internos, NUNCA hace una petición HTTP
 *                  a la propia API: eso duplicaría la autenticación y abriría
 *                  un camino de SSRF hacia dentro.
 */
const TOOLS = [
    // ── Token y mercado ──────────────────────────────────────────────────────
    {
        name: 'bezhas_token_info',
        scope: 'token',
        title: 'Información del token BEZ',
        description: 'Datos del token BEZ-Coin: símbolo, decimales, suministro y direcciones de contrato por red.',
        handler: async ({ bridge }) => bridge.tokenInfo(),
    },
    {
        name: 'bezhas_token_price',
        scope: 'token',
        title: 'Precio del token BEZ',
        description: 'Precio actual de BEZ y su origen. Devuelve null si todavía no hay pool con liquidez: eso es un estado real, no un error.',
        handler: async ({ bridge }) => bridge.tokenPrice(),
    },
    {
        name: 'bezhas_oracle_prices',
        scope: 'token',
        title: 'Precios del oráculo por cadena',
        description: 'Mercados del par BEZ por cadena, con pool, precio y liquidez. Los que aún no cotizan salen como `pending`.',
        handler: async ({ bridge }) => bridge.oraclePrices(),
    },

    // ── DEX ──────────────────────────────────────────────────────────────────
    {
        name: 'bezhas_dex_quote',
        scope: 'token',
        title: 'Cotización de intercambio',
        description: 'Cotiza un intercambio en el DEX. SOLO calcula: no firma, no envía y no mueve fondos.',
        inputSchema: {
            amount: z.string().regex(/^\d+(\.\d+)?$/, 'Cantidad numérica en texto')
                .describe('Cantidad a intercambiar'),
            from: z.enum(['BEZ', 'USDT', 'USDC', 'BNB', 'MATIC']).describe('Token de origen'),
            to: z.enum(['BEZ', 'USDT', 'USDC', 'BNB', 'MATIC']).describe('Token de destino'),
        },
        handler: async ({ args, bridge }) => bridge.dexQuote(args),
    },
    {
        name: 'bezhas_dex_pool',
        scope: 'token',
        title: 'Estado del pool de liquidez',
        description: 'Reservas y liquidez del pool BEZ.',
        handler: async ({ bridge }) => bridge.dexPool(),
    },

    // ── Red y contratos ──────────────────────────────────────────────────────
    {
        name: 'bezhas_network_stats',
        scope: 'contracts',
        title: 'Estadísticas de la red',
        description: 'Altura de bloque, id de cadena y precio del gas de la L2 de BeZhas.',
        handler: async ({ bridge }) => bridge.networkStats(),
    },
    {
        name: 'bezhas_contracts_list',
        scope: 'contracts',
        title: 'Contratos desplegados',
        description: 'Contratos desplegados con su dirección por cadena. Información pública y verificable en cualquier explorador.',
        inputSchema: {
            chain_id: z.number().int().positive().optional()
                .describe('Filtrar por cadena (56 BNB, 137 Polygon, 97 y 80001 pruebas)'),
        },
        handler: async ({ args, bridge }) => bridge.contractsList({ chainId: args.chain_id }),
    },

    // ── Suscripción: acotado a la propia api-key ────────────────────────────
    // Estas tres SÍ están acotadas al llamante porque el Gateway las resuelve
    // con req.registeredApp.id, no con un argumento. Es la diferencia entre
    // «dime lo mío» y «dime lo de esa dirección».
    {
        name: 'bezhas_subscription',
        scope: 'wallet',
        title: 'Mi suscripción',
        description: 'Plan contratado, módulos activos y estado. Siempre el de la api-key que llama; no acepta identificar a otro.',
        handler: async ({ app, bridge }) => bridge.subscription(app.id),
    },
];

/** Índice por nombre, para no recorrer el array en cada llamada. */
const PORNOMBRE = new Map(TOOLS.map((t) => [t.name, t]));

/**
 * Herramientas visibles para un conjunto de scopes.
 *
 * Se filtra el LISTADO, no solo la ejecución. Si un cliente sin el scope
 * `token` viera `bezhas_dex_quote` en tools/list y recibiera un 403 al
 * llamarla, ya le habríamos contado qué hay detrás: el catálogo completo de la
 * plataforma es información competitiva. Lo que no puedes usar, no existe.
 */
function toolsParaScopes(scopes = []) {
    // `admin` es una clave interna, no un plan de cliente: no se le da el
    // catálogo entero por serlo, se le dan las mismas herramientas. El MCP no
    // es la vía para operaciones de administración.
    const conjunto = new Set(scopes);
    return TOOLS.filter((t) => conjunto.has(t.scope) || conjunto.has('admin'));
}

function getTool(name) {
    return PORNOMBRE.get(name) || null;
}

module.exports = { TOOLS, toolsParaScopes, getTool, MAX_RESPUESTA_CHARS };
