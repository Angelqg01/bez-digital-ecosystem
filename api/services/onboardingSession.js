'use strict';

/**
 * services/onboardingSession.js — sesiones de alta y despliegue asistidos.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  QUÉ ES UNA SESIÓN DE ONBOARDING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Un vale de un solo uso, con caducidad corta, que autoriza a UNA persona a
 * completar UN paso en una pantalla alojada por BeZhas. La crea una herramienta
 * MCP —que puede estar hablando con un desconocido— y la consume un humano.
 *
 * El reparto es el que sostiene todo el diseño:
 *
 *   el agente CONDUCE  → recoge contexto, recomienda, crea la sesión, sondea
 *   la persona DECIDE  → acepta condiciones, escribe el IBAN, ejecuta el
 *                        comando en su máquina, aprueba el mapeo de campos
 *
 * Por eso ninguna función de este módulo escribe un dato sensible: no hay dónde
 * escribirlo. Lo sensible entra por la pantalla y sale hacia su destino real
 * (proveedor de pagos, gestor de secretos del cliente, su propia máquina).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  EL TOKEN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 32 bytes de aleatoriedad criptográfica en hexadecimal. Se devuelve UNA vez,
 * dentro de la URL, y se guarda hasheado con SHA-256. Mismo criterio que las
 * api-keys del Gateway: un volcado de la tabla no permite continuar la sesión
 * de nadie.
 *
 * No lleva firma ni datos dentro (nada de JWT): así se puede revocar borrando
 * una fila, y un token robado deja de servir en cuanto la sesión se marca
 * consumida o caduca.
 */

const crypto = require('crypto');
const { query } = require('../db/pool');
const logger = require('../utils/logger');

/** Vida de una sesión. Corta a propósito: es un vale, no una sesión de trabajo. */
const TTL_MINUTOS = parseInt(process.env.ONBOARDING_TTL_MIN || '15', 10);

/** Techo de sesiones por IP y hora en el canal anónimo. */
const MAX_POR_IP_HORA = parseInt(process.env.ONBOARDING_MAX_POR_IP_HORA || '20', 10);

const TIPOS = Object.freeze([
    // `signup` es para quien no es cliente; `connect`, para quien ya lo es y
    // sólo tiene que identificarse desde una IA nueva. Son flujos distintos
    // aunque acaben en la misma pantalla: uno crea empresa, el otro no crea
    // nada — comprueba quién eres y emite una credencial acotada.
    'signup', 'connect', 'sdk_install', 'erp_integration', 'node_provision', 'bank_setup',
]);

const ESTADOS = Object.freeze([
    'pendiente', 'en_curso', 'completado', 'caducado', 'cancelado',
]);

/**
 * Claves que NO pueden aparecer en `prefill`, en ningún nivel de anidamiento.
 *
 * El prefill lo compone un modelo de lenguaje a partir de una conversación. Si
 * el usuario le dicta su IBAN «para agilizar», el modelo va a intentar
 * pasárnoslo: es justo lo que se le ha pedido. La defensa no puede ser confiar
 * en que no lo haga — tiene que ser que la herramienta lo rechace.
 *
 * Se rechaza la sesión ENTERA en vez de limpiar el campo en silencio: si el
 * agente mandó un IBAN, el usuario cree que ya está puesto, y una limpieza
 * silenciosa le dejaría creyendo que hizo un paso que no hizo.
 */
const PREFILL_PROHIBIDO = [
    /iban/i, /swift/i, /\bbic\b/i, /account_?number/i, /numero_?cuenta/i,
    /card|tarjeta/i, /cvv|cvc/i, /password|contrase/i, /secret|secreto/i,
    /api[_-]?key/i, /private[_-]?key|clave_?privada/i, /seed|mnemonic/i,
    /token/i, /credential|credencial/i,
];

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');

function baseUrl() {
    return process.env.PUBLIC_ONBOARDING_BASE_URL
        || process.env.PUBLIC_PAY_BASE_URL
        || '';
}

/**
 * Recorre el prefill buscando claves prohibidas.
 * @returns {string[]} rutas ofensivas; vacío si está limpio.
 */
function clavesProhibidas(valor, ruta = '', hallazgos = []) {
    if (!valor || typeof valor !== 'object') return hallazgos;
    if (Array.isArray(valor)) {
        valor.forEach((v, i) => clavesProhibidas(v, `${ruta}[${i}]`, hallazgos));
        return hallazgos;
    }
    for (const [clave, v] of Object.entries(valor)) {
        const completa = ruta ? `${ruta}.${clave}` : clave;
        if (PREFILL_PROHIBIDO.some((re) => re.test(clave))) hallazgos.push(completa);
        clavesProhibidas(v, completa, hallazgos);
    }
    return hallazgos;
}

/**
 * Un prefill no puede ser tampoco un vertedero: lo compone un modelo y podría
 * mandar la conversación entera. Se acota el tamaño serializado.
 */
const MAX_PREFILL_BYTES = parseInt(process.env.ONBOARDING_MAX_PREFILL_BYTES || '8192', 10);

class OnboardingError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'OnboardingError';
        this.code = code;
    }
}

/**
 * Cuántas sesiones ha abierto una IP en la última hora.
 * Se consulta ANTES de crear, para que el canal anónimo no sea una fábrica de
 * filas gratis para cualquiera con un bucle.
 */
async function sesionesRecientesDeIp(ip) {
    if (!ip) return 0;
    const { rows } = await query(
        `SELECT COUNT(*)::int AS n FROM onboarding_sessions
          WHERE source_ip = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
        [ip]
    );
    return rows[0]?.n || 0;
}

/**
 * Crea una sesión y devuelve el token EN CLARO una sola vez.
 *
 * @param {object} cfg
 * @param {string} cfg.kind          uno de TIPOS
 * @param {object} [cfg.prefill]     datos no sensibles ya conocidos
 * @param {string} [cfg.appId]       api-key que la crea, si está autenticada
 * @param {string} [cfg.orgId]
 * @param {string} [cfg.ip]
 * @param {string} [cfg.userAgent]
 * @returns {Promise<{id:string, token:string, url:string, expiresAt:Date, kind:string}>}
 */
async function crear({ kind, prefill = {}, appId = null, orgId = null, ip = null, userAgent = null }) {
    if (!TIPOS.includes(kind)) {
        throw new OnboardingError(`Tipo de onboarding desconocido: ${kind}`, 'ONBOARDING_TIPO');
    }

    const ofensivas = clavesProhibidas(prefill);
    if (ofensivas.length > 0) {
        // Se registra QUÉ clave, nunca su valor: el log no puede ser el sitio
        // donde acabe el dato que estamos impidiendo que llegue.
        logger.warn({ kind, claves: ofensivas }, 'Prefill de onboarding rechazado por claves sensibles');
        throw new OnboardingError(
            `El prefill no puede contener datos sensibles (${ofensivas.join(', ')}). `
            + 'Esos datos se introducen en la pantalla segura, nunca por el chat.',
            'ONBOARDING_PREFILL_SENSIBLE'
        );
    }

    const serializado = JSON.stringify(prefill || {});
    if (Buffer.byteLength(serializado, 'utf8') > MAX_PREFILL_BYTES) {
        throw new OnboardingError(
            `El prefill supera ${MAX_PREFILL_BYTES} bytes. Manda solo los datos del alta, no la conversación.`,
            'ONBOARDING_PREFILL_GRANDE'
        );
    }

    if (!appId) {
        const recientes = await sesionesRecientesDeIp(ip);
        if (recientes >= MAX_POR_IP_HORA) {
            throw new OnboardingError(
                'Se han abierto demasiadas sesiones de alta desde esta conexión. Inténtalo dentro de un rato.',
                'ONBOARDING_RATE'
            );
        }
    }

    const token = crypto.randomBytes(32).toString('hex');
    const { rows } = await query(
        `INSERT INTO onboarding_sessions
             (token_hash, kind, prefill, app_id, org_id, source_ip, user_agent, expires_at)
         VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, NOW() + ($8 || ' minutes')::interval)
         RETURNING id, kind, status, expires_at, created_at`,
        [sha256(token), kind, serializado, appId, orgId, ip, userAgent, String(TTL_MINUTOS)]
    );

    const fila = rows[0];
    logger.info({ onboardingId: fila.id, kind, autenticada: Boolean(appId) }, 'Sesión de onboarding creada');

    return {
        id: fila.id,
        token,
        url: `${baseUrl()}/o/${token}`,
        expiresAt: fila.expires_at,
        kind: fila.kind,
    };
}

/**
 * Busca por token y resuelve la caducidad de paso.
 *
 * Que la caducidad se aplique AL LEER y no solo por barrido es deliberado: si
 * el barrido se para, una sesión vencida seguiría abriendo su pantalla.
 */
async function porToken(token) {
    if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return null;

    const { rows } = await query(
        `SELECT id, kind, prefill, status, step, org_id, expires_at, created_at, completed_at
           FROM onboarding_sessions WHERE token_hash = $1 LIMIT 1`,
        [sha256(token)]
    );
    if (rows.length === 0) return null;

    const sesion = rows[0];
    const vencida = new Date(sesion.expires_at).getTime() <= Date.now();
    if (vencida && ['pendiente', 'en_curso'].includes(sesion.status)) {
        await query(
            `UPDATE onboarding_sessions SET status = 'caducado', updated_at = NOW() WHERE id = $1`,
            [sesion.id]
        );
        sesion.status = 'caducado';
    }
    return sesion;
}

/**
 * Busca por identificador, que es lo que tiene el agente: el token va en la URL
 * que se lleva la persona, y el agente no debe conservarlo. Con el id sólo se
 * puede consultar el ESTADO, nunca abrir la pantalla ni leer el prefill.
 */
async function porId(id) {
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return null;
    const { rows } = await query(
        `SELECT id, kind, status, step, expires_at, created_at, completed_at
           FROM onboarding_sessions WHERE id = $1 LIMIT 1`,
        [id]
    );
    if (rows.length === 0) return null;

    const sesion = rows[0];
    if (new Date(sesion.expires_at).getTime() <= Date.now()
        && ['pendiente', 'en_curso'].includes(sesion.status)) {
        await query(
            `UPDATE onboarding_sessions SET status = 'caducado', updated_at = NOW() WHERE id = $1`,
            [sesion.id]
        );
        sesion.status = 'caducado';
    }
    return sesion;
}

/**
 * Estado público, para la pantalla alojada y para `bezhas_onboarding_status`.
 *
 * Lo que sale de aquí llega al contexto de un modelo ajeno, así que no lleva
 * `app_id`, ni `org_id`, ni la IP, ni nada que identifique a un tercero.
 */
function estadoPublico(sesion) {
    if (!sesion) return null;
    return {
        onboardingId: sesion.id,
        tipo: sesion.kind,
        estado: sesion.status,
        pasoActual: sesion.step || null,
        creada: sesion.created_at,
        caduca: sesion.expires_at,
        completada: sesion.completed_at || null,
        siguienteAccion: siguienteAccion(sesion),
    };
}

/** Qué tiene que pasar ahora, dicho para que el agente lo repita al usuario. */
function siguienteAccion(sesion) {
    switch (sesion.status) {
        case 'pendiente':
            return 'Abre el enlace y completa el formulario. Nadie más puede hacerlo por ti.';
        case 'en_curso':
            return 'La pantalla está abierta y a medias. Termínala en la pestaña donde la abriste.';
        case 'completado':
            return 'Listo. Puedes continuar con el siguiente paso.';
        case 'caducado':
            return 'El enlace caducó por seguridad. Pide otro y se genera al momento.';
        case 'cancelado':
            return 'La sesión se canceló. Pide una nueva si quieres retomarlo.';
        default:
            return null;
    }
}

/** Marca el avance dentro de la pantalla. No cambia nada sensible. */
async function avanzar(token, { step = null, status = null } = {}) {
    const sesion = await porToken(token);
    if (!sesion) return null;
    if (['completado', 'caducado', 'cancelado'].includes(sesion.status)) return sesion;

    if (status && !ESTADOS.includes(status)) {
        throw new OnboardingError(`Estado desconocido: ${status}`, 'ONBOARDING_ESTADO');
    }

    const { rows } = await query(
        `UPDATE onboarding_sessions
            SET step = COALESCE($2, step),
                status = COALESCE($3, status),
                updated_at = NOW()
          WHERE id = $1
      RETURNING id, kind, prefill, status, step, org_id, expires_at, created_at, completed_at`,
        [sesion.id, step, status]
    );
    return rows[0] || null;
}

/**
 * Cierra la sesión. A partir de aquí el token no sirve para nada: es el «un
 * solo uso» del vale.
 */
async function completar(token, { orgId = null } = {}) {
    const sesion = await porToken(token);
    if (!sesion) return null;
    if (sesion.status === 'caducado') {
        throw new OnboardingError('La sesión caducó antes de completarse.', 'ONBOARDING_CADUCADA');
    }

    const { rows } = await query(
        `UPDATE onboarding_sessions
            SET status = 'completado', completed_at = NOW(), updated_at = NOW(),
                org_id = COALESCE($2, org_id)
          WHERE id = $1
      RETURNING id, kind, prefill, status, step, org_id, expires_at, created_at, completed_at`,
        [sesion.id, orgId]
    );
    logger.info({ onboardingId: sesion.id, kind: sesion.kind }, 'Sesión de onboarding completada');
    return rows[0] || null;
}

/**
 * Barrido. Caduca las vencidas y BORRA la IP y el user-agent de todo lo que ya
 * está cerrado: son datos personales recogidos para un limitador, y pasada la
 * ventana del limitador no hay razón para conservarlos.
 */
async function barrer() {
    const { rowCount: caducadas } = await query(
        `UPDATE onboarding_sessions
            SET status = 'caducado', updated_at = NOW()
          WHERE status IN ('pendiente', 'en_curso') AND expires_at <= NOW()`
    );
    const { rowCount: anonimizadas } = await query(
        `UPDATE onboarding_sessions
            SET source_ip = NULL, user_agent = NULL
          WHERE created_at < NOW() - INTERVAL '24 hours'
            AND (source_ip IS NOT NULL OR user_agent IS NOT NULL)`
    );
    return { caducadas, anonimizadas };
}

module.exports = {
    crear,
    porToken,
    porId,
    estadoPublico,
    avanzar,
    completar,
    barrer,
    sesionesRecientesDeIp,
    clavesProhibidas,
    OnboardingError,
    TIPOS,
    ESTADOS,
    TTL_MINUTOS,
    MAX_POR_IP_HORA,
    PREFILL_PROHIBIDO,
};
