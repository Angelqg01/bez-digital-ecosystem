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
 * ACTUALIZACIÓN: la fuga que motivó esta decisión ya está corregida. La
 * migración 049 añadió titularidad a `app_registry` y las siete rutas con
 * `:address` pasan por `middleware/address-access.js`, que exige acreditar el
 * derecho a esa dirección. Ver ese fichero para el detalle.
 *
 * Aun así, v1 del MCP sigue SIN herramientas que tomen una dirección, por una
 * razón distinta de la original: un cliente MCP se conecta con api-key y sin
 * JWT de usuario, así que la única vía de acreditación disponible sería la
 * titularidad de la clave. Eso funciona, pero conviene estrenarlo primero por
 * REST, donde el volumen es bajo y los fallos se ven, antes de ponerlo detrás
 * de un agente que puede pedir mil direcciones en un minuto.
 *
 * Añadirlas ahora es un cambio pequeño y seguro: basta una herramienta que
 * llame al puente y deje que `puedeAcceder()` decida. Lo que NO puede volver
 * es una herramienta que acepte una dirección sin pasar por esa comprobación.
 *
 * El problema original, para que quede el porqué: las direcciones son públicas
 * en cadena, y «tráeme el historial de pagos y el estado KYC de estas 200
 * direcciones» es UNA frase. Convertía una vulnerabilidad que había que saber
 * explotar en una que se explota hablando.
 *
 * Endpoints afectados, hoy ya protegidos:
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
 * Las dos primeras eran las graves: datos internos y de cumplimiento, no
 * estado de cadena.
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
const { alcanza, describirPlan, PLAN_POR_DEFECTO } = require('./plan-entitlements');

/** Tope de caracteres por respuesta. Un agente que pide 10.000 filas no debe
 *  poder inundar su propia ventana de contexto ni la memoria del servidor. */
const MAX_RESPUESTA_CHARS = parseInt(process.env.MCP_MAX_RESPONSE_CHARS || '24000', 10);

/**
 * Catálogo. Cada entrada:
 *   scope        — permiso del Gateway exigido. Si la api-key no lo tiene, la
 *                  herramienta NO SE LISTA siquiera (ver mcp-gateway.js).
 *   planMinimo   — plan contratado que hace falta. Es un eje DISTINTO del
 *                  scope y los dos se exigen a la vez: el scope dice qué área
 *                  te han habilitado, el plan dice hasta dónde llega lo que
 *                  pagas. Sin esto, un starter y un enterprise veían el mismo
 *                  catálogo y la suscripción no significaba nada.
 *   inputSchema  — forma zod. Sin esquema = sin argumentos.
 *   handler      — recibe ({ args, app, deps }) y devuelve un objeto plano.
 *                  Llama a los servicios internos, NUNCA hace una petición HTTP
 *                  a la propia API: eso duplicaría la autenticación y abriría
 *                  un camino de SSRF hacia dentro.
 */
/**
 * Anota la frescura del dato de mercado según el plan.
 *
 * Servir dato diferido en el plan básico es práctica normal en datos de
 * mercado. Lo que lo hace honesto es DECIRLO en la propia respuesta: el agente
 * que la lee tiene que poder distinguir «precio de ahora» de «precio de hace un
 * cuarto de hora». Presentarlo como actual sería otra cosa, y quien opere con
 * él va a perder dinero por nuestra culpa.
 *
 * No se falsea el dato ni se retrasa artificialmente su entrega: se entrega lo
 * que hay, etiquetado.
 */
function marcarFrescura(datos, entitlements) {
    const retraso = entitlements?.mercado?.retrasoSegundos ?? 0;
    if (!datos || typeof datos !== 'object') return datos;
    if (retraso === 0) {
        return { ...datos, frescura: { tiempoReal: true } };
    }
    return {
        ...datos,
        frescura: {
            tiempoReal: false,
            retrasoDeclaradoSegundos: retraso,
            aviso: `Tu plan sirve dato de mercado con hasta ${Math.round(retraso / 60)} minutos de retraso. `
                + 'No lo uses como precio de ejecución.',
        },
    };
}

const TOOLS = [
    // ── Token y mercado ──────────────────────────────────────────────────────
    {
        name: 'bezhas_token_info',
        planMinimo: 'starter',
        scope: 'token',
        title: 'Información del token BEZ',
        description: 'Datos del token BEZ-Coin: símbolo, decimales, suministro y direcciones de contrato por red.',
        handler: async ({ bridge }) => bridge.tokenInfo(),
    },
    {
        name: 'bezhas_token_price',
        planMinimo: 'starter',
        scope: 'token',
        title: 'Precio del token BEZ',
        description: 'Precio actual de BEZ y su origen. Devuelve null si todavía no hay pool con liquidez: eso es un estado real, no un error. '
            + 'En planes con dato diferido lleva el retraso declarado en la propia respuesta.',
        handler: async ({ bridge, entitlements }) => marcarFrescura(await bridge.tokenPrice(), entitlements),
    },
    {
        name: 'bezhas_oracle_prices',
        planMinimo: 'creator_pro',
        scope: 'token',
        title: 'Precios del oráculo por cadena',
        description: 'Mercados del par BEZ por cadena, con pool, precio y liquidez. Los que aún no cotizan salen como `pending`.',
        handler: async ({ bridge, entitlements }) => marcarFrescura(await bridge.oraclePrices(), entitlements),
    },

    // ── DEX ──────────────────────────────────────────────────────────────────
    {
        name: 'bezhas_dex_quote',
        planMinimo: 'creator_pro',
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
        planMinimo: 'creator_pro',
        scope: 'token',
        title: 'Estado del pool de liquidez',
        description: 'Reservas y liquidez del pool BEZ.',
        handler: async ({ bridge }) => bridge.dexPool(),
    },

    // ── Red y contratos ──────────────────────────────────────────────────────
    {
        name: 'bezhas_network_stats',
        planMinimo: 'starter',
        scope: 'contracts',
        title: 'Estadísticas de la red',
        description: 'Altura de bloque, id de cadena y precio del gas de la L2 de BeZhas.',
        handler: async ({ bridge }) => bridge.networkStats(),
    },
    {
        name: 'bezhas_contracts_list',
        planMinimo: 'creator_pro',
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
        planMinimo: 'starter',
        scope: 'wallet',
        title: 'Mi suscripción',
        description: 'Plan contratado, módulos activos, y qué incluye ese plan: nivel de razonamiento, frescura del dato '
            + 'de mercado, límites y régimen de privacidad. Siempre el de la api-key que llama; no acepta identificar a otro.',
        handler: async ({ app, bridge }) => {
            const suscripcion = await bridge.subscription(app.id);
            // Se devuelve qué DA el plan, no sólo cómo se llama: un agente que
            // sabe que su dato va con retraso puede advertirlo a su usuario en
            // vez de presentarlo como precio de ejecución.
            return { ...suscripcion, incluye: describirPlan(suscripcion.plan) };
        },
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
function toolsParaScopes(scopes = [], plan = PLAN_POR_DEFECTO) {
    // `admin` es una clave interna, no un plan de cliente: no se le da el
    // catálogo entero por serlo, se le dan las mismas herramientas. El MCP no
    // es la vía para operaciones de administración.
    const conjunto = new Set(scopes);
    return TOOLS.filter((t) => {
        const tienePermiso = conjunto.has(t.scope) || conjunto.has('admin');
        // Los dos filtros se aplican SIEMPRE y ninguno cubre al otro: `admin`
        // salta el scope porque es una clave interna, pero no compra plan. Una
        // clave interna con plan starter sigue viendo catálogo de starter.
        return tienePermiso && alcanza(plan, t.planMinimo || PLAN_POR_DEFECTO);
    });
}

/** ¿Esta herramienta está al alcance de este plan? Se re-comprueba al ejecutar. */
function planPermiteTool(nombre, plan = PLAN_POR_DEFECTO) {
    const t = PORNOMBRE.get(nombre);
    if (!t) return false;
    return alcanza(plan, t.planMinimo || PLAN_POR_DEFECTO);
}

function getTool(name) {
    return PORNOMBRE.get(name) || null;
}

module.exports = { TOOLS, toolsParaScopes, planPermiteTool, getTool, MAX_RESPUESTA_CHARS };
