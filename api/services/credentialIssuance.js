'use strict';

/**
 * services/credentialIssuance.js — lo que la pantalla entrega, una sola vez.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LA FRONTERA DEL SISTEMA PASA POR AQUÍ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Todo el onboarding asistido existe para llegar a este momento: una persona,
 * en una pantalla, recoge algo que el agente no puede ver. Dos cosas se emiten:
 *
 *   sdk_install     → una api-key DERIVADA de la del cliente
 *   node_provision  → un token de registro de un solo uso para el nodo
 *
 * Y una regla que no admite excepción: **el valor se devuelve una vez y se
 * guarda hasheado**. No hay endpoint para volver a verlo, ni «mostrar de nuevo»
 * en la pantalla, ni consulta de administración que lo recupere. Si se pierde,
 * se emite otro y se revoca el anterior. Cualquier atajo aquí —guardarlo «solo
 * un ratito» para que el usuario pueda volver atrás— convierte la base de datos
 * en un almacén de credenciales en claro.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUÉ LA EMISIÓN ES UNA OPERACIÓN ATÓMICA Y NO UNA COMPROBACIÓN + UN INSERT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Dos pestañas abiertas con la misma URL, o un doble clic, son dos peticiones
 * simultáneas. Comprobar «¿ya se emitió?» y después insertar deja una ventana
 * en la que las dos comprueban que no, y las dos emiten: el cliente acaba con
 * dos claves activas y sólo sabe de una. La que no conoce no la va a revocar
 * nunca.
 *
 * Por eso el consumo de la sesión es un UPDATE condicional que devuelve filas
 * sólo si ganó la carrera. La segunda petición recibe 0 filas y un 409, que es
 * el resultado correcto: la primera ya se lo llevó.
 */

const crypto = require('crypto');
const { query } = require('../db/pool');
const { getPerfil } = require('../config/node-profiles');
const logger = require('../utils/logger');

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');

/** Vida del token de registro de un nodo: lo justo para arrancar un contenedor. */
const TTL_NODO_HORAS = parseInt(process.env.NODE_TOKEN_TTL_HORAS || '24', 10);

class IssuanceError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'IssuanceError';
        this.code = code;
    }
}

/**
 * Consume la sesión: la marca completada y devuelve la fila SÓLO si esta
 * llamada fue la que la cerró. Ver la cabecera: es la defensa contra la doble
 * emisión, y tiene que ser una única sentencia.
 */
async function _consumirSesion(token) {
    const { rows } = await query(
        `UPDATE onboarding_sessions
            SET status = 'completado', completed_at = NOW(), updated_at = NOW()
          WHERE token_hash = $1
            AND status IN ('pendiente', 'en_curso')
            AND expires_at > NOW()
      RETURNING id, kind, prefill, app_id, org_id`,
        [sha256(token)]
    );
    return rows[0] || null;
}

/** Distingue «no existe» de «ya se usó» para dar un mensaje accionable. */
async function _porQueNoSePudo(token) {
    const { rows } = await query(
        `SELECT status, expires_at FROM onboarding_sessions WHERE token_hash = $1 LIMIT 1`,
        [sha256(token)]
    );
    if (rows.length === 0) {
        return new IssuanceError('Este enlace no es válido.', 'ISSUE_NO_EXISTE');
    }
    if (rows[0].status === 'completado') {
        return new IssuanceError(
            'Este enlace ya se usó y lo emitido no se puede volver a mostrar. '
            + 'Pide otro enlace a tu asistente: se genera al momento y el anterior queda sin efecto.',
            'ISSUE_YA_EMITIDO'
        );
    }
    return new IssuanceError('El enlace caducó por seguridad. Pide otro.', 'ISSUE_CADUCADO');
}

/**
 * api-key derivada para una instalación del SDK.
 *
 * NO rota la clave del cliente: crea una entrada hermana con los mismos
 * permisos y el mismo titular. Rotar dejaría sin autenticar la integración que
 * ya tiene en marcha, sin avisar. Así, además, una instalación comprometida se
 * revoca sola.
 */
async function _emitirApiKey(sesion, { nombre }) {
    if (!sesion.app_id) {
        throw new IssuanceError(
            'Esta sesión no está asociada a ninguna cuenta. Conecta primero tu IA con tu cuenta de BeZhas.',
            'ISSUE_SIN_CUENTA'
        );
    }

    const { rows: padre } = await query(
        `SELECT app_name, scopes, tier, enterprise_id, authorized_addresses, address_access_mode
           FROM app_registry WHERE id = $1 AND is_active = TRUE LIMIT 1`,
        [sesion.app_id]
    );
    if (padre.length === 0) {
        throw new IssuanceError('La cuenta de origen ya no está activa.', 'ISSUE_ORIGEN_INACTIVO');
    }
    const base = padre[0];

    const etiqueta = String(nombre || sesion.prefill?.entorno || 'instalacion')
        .replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 40);
    // Sufijo aleatorio: dos instalaciones con el mismo nombre no pueden chocar
    // contra la restricción única de app_name y dejar al usuario sin clave.
    const nombreApp = `${base.app_name}-${etiqueta}-${crypto.randomBytes(3).toString('hex')}`;

    const clave = crypto.randomBytes(32).toString('hex');

    const { rows } = await query(
        `INSERT INTO app_registry
             (app_name, api_key_hash, scopes, tier, enterprise_id,
              authorized_addresses, address_access_mode, derived_from, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
         RETURNING id, app_name`,
        [nombreApp, sha256(clave), base.scopes, base.tier, base.enterprise_id,
            base.authorized_addresses || [], base.address_access_mode || 'strict', sesion.app_id]
    );

    // Se registra QUÉ se emitió y para quién; jamás el valor.
    logger.info({ appId: rows[0].id, derivadaDe: sesion.app_id, onboardingId: sesion.id },
        'api-key derivada emitida');

    return {
        tipo: 'api_key',
        // Única vez que este valor sale de aquí.
        valor: clave,
        appId: rows[0].id,
        appName: rows[0].app_name,
        scopes: base.scopes,
        instrucciones: [
            'Pégala en tu gestor de secretos como BEZHAS_API_KEY.',
            'No la escribas en un fichero de configuración versionado.',
            'No vuelve a mostrarse: si la pierdes, pide otra y revoca ésta.',
        ],
    };
}

/**
 * Token de registro de un nodo.
 *
 * Lo que se emite NO es una credencial de acceso: es un vale para que el nodo
 * se presente una vez. El nodo genera su par de claves al arrancar y nos manda
 * la pública. Su privada no sale de la máquina del cliente, y esta tabla no
 * tiene dónde guardarla.
 */
async function _emitirTokenNodo(sesion, { nombre }) {
    if (!sesion.app_id) {
        throw new IssuanceError(
            'Esta sesión no está asociada a ninguna cuenta.',
            'ISSUE_SIN_CUENTA'
        );
    }
    const tipo = sesion.prefill?.tipo;
    if (!getPerfil(tipo)) {
        throw new IssuanceError(`Perfil de nodo desconocido: ${tipo}.`, 'ISSUE_PERFIL_NODO');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const { rows } = await query(
        `INSERT INTO client_nodes
             (app_id, tipo, entorno, nombre, registration_token_hash, token_expira_at)
         VALUES ($1, $2, $3, $4, $5, NOW() + ($6 || ' hours')::interval)
         RETURNING id, tipo, entorno, nombre, token_expira_at`,
        [sesion.app_id, tipo, sesion.prefill?.entorno || 'sandbox',
            String(nombre || `${tipo}-${Date.now()}`).slice(0, 120),
            sha256(token), String(TTL_NODO_HORAS)]
    );

    logger.info({ nodeId: rows[0].id, tipo, onboardingId: sesion.id }, 'Token de registro de nodo emitido');

    return {
        tipo: 'node_registration_token',
        valor: token,
        nodeId: rows[0].id,
        perfil: rows[0].tipo,
        entorno: rows[0].entorno,
        caduca: rows[0].token_expira_at,
        instrucciones: [
            `Ponlo en el fichero de entorno del nodo como BEZHAS_NODE_TOKEN y arranca con docker compose up -d.`,
            'El nodo genera su par de claves al arrancar: la privada NO sale de tu máquina.',
            `Caduca en ${TTL_NODO_HORAS} horas y sólo sirve una vez.`,
        ],
    };
}

/** Qué emite cada tipo de sesión. Lo que no está aquí, no emite nada. */
const EMISORES = {
    sdk_install: _emitirApiKey,
    node_provision: _emitirTokenNodo,
};

/**
 * Emite lo que corresponda a la sesión. Idempotente por imposibilidad: la
 * segunda llamada no encuentra la sesión abierta y recibe 409.
 */
async function emitir(token, opciones = {}) {
    const sesion = await _consumirSesion(token);
    if (!sesion) throw await _porQueNoSePudo(token);

    const emisor = EMISORES[sesion.kind];
    if (!emisor) {
        // La sesión ya se ha consumido, y así se queda: reabrirla para «arreglar»
        // el error dejaría un camino por el que reintentar la emisión.
        throw new IssuanceError(
            `Una sesión de tipo «${sesion.kind}» no emite credenciales.`,
            'ISSUE_TIPO_SIN_EMISION'
        );
    }
    return emisor(sesion, opciones);
}

/**
 * Registro del nodo con su token.
 *
 * Llega desde la máquina del cliente, sin credencial previa: el token ES la
 * credencial, y por eso se consume con un UPDATE condicional igual que la
 * sesión. La clave pública se comprueba mínimamente —que tenga forma de clave—
 * antes de guardarla, para que un error de configuración no deje un nodo
 * registrado con basura.
 */
async function registrarNodo({ registrationToken, publicKey, version = null }) {
    if (typeof registrationToken !== 'string' || !/^[0-9a-f]{64}$/.test(registrationToken)) {
        throw new IssuanceError('Token de registro no válido.', 'NODO_TOKEN_INVALIDO');
    }
    if (typeof publicKey !== 'string' || publicKey.length < 32 || publicKey.length > 4096) {
        throw new IssuanceError('La clave pública no tiene una forma válida.', 'NODO_CLAVE_INVALIDA');
    }
    // Una privada tiene cabecera propia. Si llega una, es un error de
    // configuración del cliente y hay que pararlo aquí: guardarla sería
    // custodiar la llave de su nodo sin que nadie lo haya decidido.
    if (/PRIVATE KEY/i.test(publicKey)) {
        throw new IssuanceError(
            'Eso es una clave PRIVADA. No la mandes: el nodo sólo debe enviar su clave pública, '
            + 'y la privada no debe salir nunca de tu máquina.',
            'NODO_CLAVE_PRIVADA'
        );
    }

    const { rows } = await query(
        `UPDATE client_nodes
            SET public_key = $2, version = $3, estado = 'registrado',
                registrado_at = NOW(), ultimo_contacto_at = NOW(),
                registration_token_hash = NULL, token_expira_at = NULL,
                updated_at = NOW()
          WHERE registration_token_hash = $1
            AND estado = 'pendiente'
            AND token_expira_at > NOW()
      RETURNING id, tipo, entorno, nombre, app_id`,
        [sha256(registrationToken), publicKey, version]
    );

    if (rows.length === 0) {
        throw new IssuanceError(
            'El token de registro no es válido, ya se usó o caducó. Pide otro desde tu asistente.',
            'NODO_TOKEN_CONSUMIDO'
        );
    }

    logger.info({ nodeId: rows[0].id, tipo: rows[0].tipo }, 'Nodo de cliente registrado');
    return {
        nodeId: rows[0].id,
        tipo: rows[0].tipo,
        entorno: rows[0].entorno,
        nombre: rows[0].nombre,
    };
}

/** Nodos de una app. Nunca devuelve el token, que además ya es NULL. */
async function listarNodos(appId) {
    const { rows } = await query(
        `SELECT id, tipo, entorno, nombre, estado, version,
                registrado_at, ultimo_contacto_at, created_at,
                public_key IS NOT NULL AS con_clave
           FROM client_nodes WHERE app_id = $1 ORDER BY created_at DESC`,
        [appId]
    );
    return rows;
}

/** Caduca los vales de registro que nadie usó. Lo llama el barrido. */
async function caducarTokensDeNodo() {
    const { rowCount } = await query(
        `UPDATE client_nodes
            SET estado = 'caducado', registration_token_hash = NULL,
                token_expira_at = NULL, updated_at = NOW()
          WHERE estado = 'pendiente' AND token_expira_at <= NOW()`
    );
    return rowCount;
}

module.exports = {
    emitir, registrarNodo, listarNodos, caducarTokensDeNodo,
    IssuanceError, TTL_NODO_HORAS,
};
