'use strict';

/**
 * services/erpConnections.js — alta, custodia y uso de las conexiones con el ERP.
 *
 * Es la capa que hay entre las rutas y los adaptadores, y donde viven las tres
 * decisiones que no son técnicas:
 *
 *  1. Sin DPA firmado no se activa una conexión. Guardar credenciales del ERP
 *     de otro sin contrato de encargado de tratamiento no es una imprudencia
 *     técnica, es una infracción.
 *  2. Las credenciales entran y no salen. Ninguna función de este módulo las
 *     devuelve, ni enmascaradas: se devuelve QUÉ campos hay puestos, no su
 *     valor. Enmascarar invita a enseñarlo «solo un poco», y cuatro caracteres
 *     de una contraseña siguen siendo cuatro caracteres.
 *  3. El alcance de campos lo aprueba una persona. Vacío no significa «todos
 *     por comodidad»: significa que nadie ha decidido todavía, y hasta que se
 *     decida se sirven sólo los campos canónicos, que ya son un recorte.
 */

const crypto = require('crypto');
const { query } = require('../db/pool');
const { encryptSecret, decryptSecret } = require('./secretVault');
const { crearAdaptador, CREDENCIALES, IDS, canonical } = require('./erp');
const { validarUrlBase, ErpHttpError } = require('./erp/httpGuard');
const logger = require('../utils/logger');

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');

/**
 * Vista pública de una conexión. Lo que se devuelve por cualquier ruta.
 *
 * `credencialesPuestas` es la lista de NOMBRES de campo que tienen valor. Es
 * suficiente para que la pantalla sepa qué falta y para que el agente diga «te
 * falta la contraseña», sin que el valor salga de aquí.
 */
function vistaPublica(fila, credenciales = null) {
    return {
        id: fila.id,
        erp: fila.erp,
        nombre: fila.nombre,
        baseUrl: fila.base_url,
        modo: fila.modo,
        activa: fila.activa,
        alcanceCampos: fila.alcance_campos || [],
        tiposEscritura: fila.tipos_escritura || [],
        dpaFirmado: Boolean(fila.dpa_firmado_at),
        dpaFirmadoAt: fila.dpa_firmado_at || null,
        ultimaPrueba: fila.ultima_prueba_at
            ? { fecha: fila.ultima_prueba_at, ok: fila.ultima_prueba_ok, error: fila.ultimo_error || null }
            : null,
        credencialesPuestas: credenciales ? Object.keys(credenciales).filter((k) => credenciales[k]) : undefined,
        creada: fila.created_at,
    };
}

/** Comprueba que las credenciales traen lo que ese ERP necesita. */
function validarCredenciales(erp, credenciales) {
    const definicion = CREDENCIALES[erp] || [];
    const faltan = definicion
        .filter((c) => !c.opcional && !credenciales[c.campo])
        .map((c) => c.campo);
    if (faltan.length > 0) {
        throw new ErpHttpError(
            `Faltan credenciales de ${erp}: ${faltan.join(', ')}.`,
            'ERP_CREDENCIALES_INCOMPLETAS'
        );
    }
    // S/4HANA admite dos formas; hay que traer una de las dos.
    if (erp === 'sap_s4hana' && !credenciales.token && !(credenciales.usuario && credenciales.password)) {
        throw new ErpHttpError(
            'Para S/4HANA hace falta un token de BTP, o usuario y contraseña.',
            'ERP_CREDENCIALES_INCOMPLETAS'
        );
    }
    const desconocidas = Object.keys(credenciales)
        .filter((k) => !definicion.some((c) => c.campo === k));
    if (desconocidas.length > 0) {
        throw new ErpHttpError(
            `Credenciales no reconocidas para ${erp}: ${desconocidas.join(', ')}.`,
            'ERP_CREDENCIALES_DESCONOCIDAS'
        );
    }
}

/** Los campos aprobados tienen que existir en el modelo canónico. */
function validarAlcance(alcance) {
    if (!Array.isArray(alcance)) return [];
    const todos = new Set(canonical.NOMBRES.flatMap((t) => canonical.camposDe(t)));
    const invalidos = alcance.filter((c) => !todos.has(c));
    if (invalidos.length > 0) {
        throw new ErpHttpError(
            `Campos fuera del modelo canónico: ${invalidos.join(', ')}.`,
            'ERP_ALCANCE_INVALIDO'
        );
    }
    return alcance;
}

/**
 * Da de alta una conexión. Nace DESACTIVADA: dar de alta no es encender.
 */
async function crear({ appId, orgId = null, erp, nombre, baseUrl, credenciales = {}, alcanceCampos = [], modo = 'gestionado' }) {
    if (!IDS.includes(erp)) {
        throw new ErpHttpError(`ERP no soportado: ${erp}.`, 'ERP_NO_SOPORTADO');
    }
    validarCredenciales(erp, credenciales);
    const alcance = validarAlcance(alcanceCampos);

    // Valida esquema, puerto y —sobre todo— que el nombre no resuelva a una
    // dirección interna. Ver httpGuard: se repite en cada uso.
    const url = await validarUrlBase(baseUrl);

    const { rows } = await query(
        `INSERT INTO erp_connections
             (app_id, org_id, erp, nombre, base_url, credenciales_cifradas, alcance_campos, modo, activa)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE)
         RETURNING *`,
        [appId, orgId, erp, String(nombre).slice(0, 120), url.origin,
            encryptSecret(JSON.stringify(credenciales)), alcance, modo]
    );
    logger.info({ appId, erp, connectionId: rows[0].id }, 'Conexión ERP dada de alta (inactiva)');
    return vistaPublica(rows[0], credenciales);
}

async function listar(appId) {
    const { rows } = await query(
        `SELECT * FROM erp_connections WHERE app_id = $1 ORDER BY created_at DESC`,
        [appId]
    );
    return rows.map((f) => vistaPublica(f));
}

/**
 * Trae la fila cruda comprobando la titularidad.
 *
 * Se filtra SIEMPRE por app_id en el WHERE, no después en JavaScript: es la
 * misma lección de la fuga que arregló la migración 049. Un filtro que se
 * aplica después de traer la fila es un filtro que alguien puede olvidar.
 */
async function _filaPropia(appId, connectionId) {
    const { rows } = await query(
        `SELECT * FROM erp_connections WHERE id = $1 AND app_id = $2 LIMIT 1`,
        [connectionId, appId]
    );
    return rows[0] || null;
}

async function obtener(appId, connectionId) {
    const fila = await _filaPropia(appId, connectionId);
    return fila ? vistaPublica(fila) : null;
}

/**
 * Activa la conexión. Exige DPA y una prueba de conexión que haya salido bien.
 *
 * El orden importa: primero se prueba, después se activa. Activar y probar
 * luego dejaría una ventana en la que un agente puede pedir documentos contra
 * una conexión que no funciona, y el error que recibiría no diría por qué.
 */
async function activar(appId, connectionId, { dpaFirmadoAt }) {
    const fila = await _filaPropia(appId, connectionId);
    if (!fila) return null;

    if (!dpaFirmadoAt && !fila.dpa_firmado_at) {
        throw new ErpHttpError(
            'No se puede activar una conexión gestionada sin DPA firmado: guardar credenciales del ERP '
            + 'de un cliente nos hace encargado de tratamiento de sus datos.',
            'ERP_SIN_DPA'
        );
    }

    const prueba = await probar(appId, connectionId);
    if (!prueba.ok) {
        throw new ErpHttpError(
            `La conexión no se puede activar porque la prueba falló: ${prueba.error}`,
            'ERP_PRUEBA_FALLIDA'
        );
    }

    const { rows } = await query(
        `UPDATE erp_connections
            SET activa = TRUE,
                dpa_firmado_at = COALESCE($3, dpa_firmado_at),
                updated_at = NOW()
          WHERE id = $1 AND app_id = $2
      RETURNING *`,
        [connectionId, appId, dpaFirmadoAt || null]
    );
    logger.info({ appId, connectionId }, 'Conexión ERP activada');
    return vistaPublica(rows[0]);
}

async function desactivar(appId, connectionId) {
    const { rows } = await query(
        `UPDATE erp_connections SET activa = FALSE, updated_at = NOW()
          WHERE id = $1 AND app_id = $2 RETURNING *`,
        [connectionId, appId]
    );
    return rows[0] ? vistaPublica(rows[0]) : null;
}

/** Borra la conexión y con ella las credenciales. */
async function borrar(appId, connectionId) {
    const { rowCount } = await query(
        `DELETE FROM erp_connections WHERE id = $1 AND app_id = $2`,
        [connectionId, appId]
    );
    return rowCount > 0;
}

/**
 * Construye el adaptador de una conexión.
 *
 * Vuelve a validar la URL: una conexión guardada hace meses puede apuntar hoy a
 * otro sitio, y el DNS de un nombre cambia sin que nadie toque esta fila.
 */
async function _adaptadorDe(fila, { exigirActiva = true } = {}) {
    if (exigirActiva && !fila.activa) {
        throw new ErpHttpError('La conexión está desactivada.', 'ERP_INACTIVA');
    }
    await validarUrlBase(fila.base_url);

    let credenciales = {};
    try {
        credenciales = JSON.parse(decryptSecret(fila.credenciales_cifradas) || '{}');
    } catch {
        throw new ErpHttpError(
            'No se pudieron descifrar las credenciales de esta conexión. Vuelve a introducirlas.',
            'ERP_CREDENCIALES_ILEGIBLES'
        );
    }

    return crearAdaptador(fila.erp, {
        baseUrl: fila.base_url,
        credenciales,
        alcanceCampos: fila.alcance_campos || [],
    });
}

/** Prueba de conexión. Registra el resultado para que se vea en la pantalla. */
async function probar(appId, connectionId) {
    const fila = await _filaPropia(appId, connectionId);
    if (!fila) return { ok: false, error: 'Conexión no encontrada.' };

    let ok = false;
    let error = null;
    let adaptador = null;
    try {
        adaptador = await _adaptadorDe(fila, { exigirActiva: false });
        await adaptador.probarConexion();
        ok = true;
    } catch (err) {
        error = err.message;
        // El detalle técnico al log; al cliente, la frase.
        logger.warn({ connectionId, erp: fila.erp, code: err.code }, 'Prueba de conexión ERP fallida');
    } finally {
        await adaptador?.cerrar?.().catch(() => {});
    }

    await query(
        `UPDATE erp_connections
            SET ultima_prueba_at = NOW(), ultima_prueba_ok = $2, ultimo_error = $3, updated_at = NOW()
          WHERE id = $1`,
        [connectionId, ok, error]
    );
    return { ok, error };
}

/** Lectura: lista de documentos ya recortada al modelo canónico y al alcance. */
async function listarDocumentos(appId, connectionId, tipo, filtro) {
    const fila = await _filaPropia(appId, connectionId);
    if (!fila) return null;
    const adaptador = await _adaptadorDe(fila);
    try {
        return await adaptador.listarDocumentos(tipo, filtro);
    } finally {
        await adaptador.cerrar?.().catch(() => {});
    }
}

async function obtenerDocumento(appId, connectionId, tipo, id) {
    const fila = await _filaPropia(appId, connectionId);
    if (!fila) return null;
    const adaptador = await _adaptadorDe(fila);
    try {
        return await adaptador.obtenerDocumento(tipo, id);
    } finally {
        await adaptador.cerrar?.().catch(() => {});
    }
}

async function describirEsquema(appId, connectionId, tipo) {
    const fila = await _filaPropia(appId, connectionId);
    if (!fila) return null;
    const adaptador = await _adaptadorDe(fila, { exigirActiva: false });
    return adaptador.describirEsquema(tipo);
}

/**
 * Escritura hacia el ERP.
 *
 * Tres cosas ocurren aquí y las tres importan:
 *
 *  1. La conexión tiene que declarar ese tipo como escribible. Una conexión de
 *     solo lectura no se convierte en escribible porque el agente lo pida.
 *  2. La clave de idempotencia se reserva en erp_write_log ANTES de llamar al
 *     ERP. Si dos peticiones llegan a la vez, el índice único deja pasar una.
 *  3. Si la clave ya existía con OTRO contenido, es un error del llamante —está
 *     reusando una clave— y no un reintento. Se rechaza en vez de aplicar, que
 *     es lo único seguro cuando no se sabe cuál de los dos contenidos quería.
 */
async function escribirDocumento(appId, connectionId, { tipo, payload, idempotencyKey, approvalId = null }) {
    const fila = await _filaPropia(appId, connectionId);
    if (!fila) return null;

    if (!(fila.tipos_escritura || []).includes(tipo)) {
        throw new ErpHttpError(
            `Esta conexión no tiene autorizada la escritura de «${tipo}». `
            + 'Se autoriza en la pantalla de la conexión, no desde el agente.',
            'ERP_ESCRITURA_NO_AUTORIZADA'
        );
    }

    const validacion = canonical.validarParaEscritura(tipo, payload || {});
    if (!validacion.valido) {
        throw new ErpHttpError(
            `Faltan campos obligatorios para ${tipo}: ${validacion.faltan.join(', ')}.`,
            'ERP_PAYLOAD_INCOMPLETO'
        );
    }

    const huella = sha256(JSON.stringify(payload));

    const previa = await query(
        `SELECT id, estado, documento_id, payload_sha256 FROM erp_write_log
          WHERE connection_id = $1 AND idempotency_key = $2 LIMIT 1`,
        [connectionId, idempotencyKey]
    );
    if (previa.rows.length > 0) {
        const anterior = previa.rows[0];
        if (anterior.payload_sha256 !== huella) {
            throw new ErpHttpError(
                'Esa clave de idempotencia ya se usó con un contenido distinto. '
                + 'Usa una clave nueva: reutilizarla haría ambiguo qué documento querías.',
                'ERP_IDEMPOTENCIA_REUSADA'
            );
        }
        if (anterior.estado === 'aplicado') {
            return { id: anterior.documento_id, creado: false, reintento: true };
        }
    }

    await query(
        `INSERT INTO erp_write_log (connection_id, idempotency_key, tipo, payload_sha256, approval_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (connection_id, idempotency_key) DO NOTHING`,
        [connectionId, idempotencyKey, tipo, huella, approvalId]
    );

    const adaptador = await _adaptadorDe(fila);
    try {
        const resultado = await adaptador.escribirDocumento(tipo, payload, idempotencyKey);
        await query(
            `UPDATE erp_write_log SET estado = 'aplicado', documento_id = $3, updated_at = NOW()
              WHERE connection_id = $1 AND idempotency_key = $2`,
            [connectionId, idempotencyKey, resultado.id]
        );
        return { ...resultado, reintento: false };
    } catch (err) {
        await query(
            `UPDATE erp_write_log SET estado = 'fallido', error = $3, updated_at = NOW()
              WHERE connection_id = $1 AND idempotency_key = $2`,
            [connectionId, idempotencyKey, String(err.message).slice(0, 500)]
        );
        throw err;
    } finally {
        await adaptador.cerrar?.().catch(() => {});
    }
}

/** Autoriza escritura de unos tipos. Lo llama la pantalla, tras aprobación humana. */
async function autorizarEscritura(appId, connectionId, tipos) {
    const invalidos = (tipos || []).filter((t) => !canonical.esTipoValido(t));
    if (invalidos.length > 0) {
        throw new ErpHttpError(`Tipos desconocidos: ${invalidos.join(', ')}.`, 'ERP_TIPO_DESCONOCIDO');
    }
    const { rows } = await query(
        `UPDATE erp_connections SET tipos_escritura = $3, updated_at = NOW()
          WHERE id = $1 AND app_id = $2 RETURNING *`,
        [connectionId, appId, tipos || []]
    );
    return rows[0] ? vistaPublica(rows[0]) : null;
}

module.exports = {
    crear, listar, obtener, activar, desactivar, borrar, probar,
    listarDocumentos, obtenerDocumento, describirEsquema, escribirDocumento,
    autorizarEscritura, vistaPublica, validarCredenciales, validarAlcance,
};
