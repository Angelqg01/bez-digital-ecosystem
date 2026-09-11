'use strict';

/**
 * services/telemetryPipeline.js — recogida de telemetría y episodios.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  EL ORDEN DE LAS COMPROBACIONES ES EL CONTROL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Antes de escribir una sola fila se comprueban tres cosas, y en este orden:
 *
 *   1. ¿El PLAN permite recoger? Business y Enterprise VIP son zero-retention:
 *      para ellos la capa de episodios NI SE ESCRIBE. Se vende como feature, así
 *      que tiene que ser cierto, y la forma de que sea cierto es que la
 *      comprobación esté antes del INSERT y no en un documento.
 *   2. ¿Se ha OPUESTO el cliente (art. 21 RGPD)? La oposición se respeta
 *      aunque el plan permitiera recoger.
 *   3. ¿El registro sobrevive a la seudonimización sin llevar contenido?
 *
 * Cualquiera de las tres que falle, no se escribe. Y no se escribe «una versión
 * reducida»: no se escribe.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUÉ ESTO NUNCA PUEDE ROMPER UNA PETICIÓN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Es telemetría: mejora el producto, no lo presta. Un fallo aquí no puede
 * devolver un error a un cliente que estaba consultando su tesorería, así que
 * todo va en try/catch y se registra en el log del servidor. La alternativa
 * —dejar que propague— convertiría una tabla de mejora interna en un punto de
 * caída del servicio.
 *
 * Se escribe DESPUÉS de responder (el llamante no espera al INSERT) por la
 * misma razón: la latencia de esto no es problema del cliente.
 */

const { query } = require('../db/pool');
const { getEntitlements, PLAN_POR_DEFECTO } = require('../config/plan-entitlements');
const anon = require('./episodeAnonymizer');
const logger = require('../utils/logger');

/** Plazos del art. 5.1.e. Cambiarlos aquí los cambia en la fila, no sólo en la purga. */
const DIAS_TELEMETRIA = parseInt(process.env.TELEMETRY_RETENTION_DAYS || '90', 10);
const MESES_EPISODIOS = parseInt(process.env.EPISODES_RETENTION_MONTHS || '24', 10);

/** Caché corta de preferencias: la oposición se consulta en cada llamada. */
const CACHE_TTL_MS = 60_000;
const cachePreferencias = new Map();

/**
 * ¿Se ha opuesto esta app? Ante un fallo de base se asume QUE SÍ.
 *
 * Es lo contrario de lo que haría un caché normal, y es deliberado: si no
 * podemos comprobar si alguien se opuso, tratar sus datos sería tratarlos sin
 * poder acreditar la base jurídica. Perder telemetría no cuesta nada; tratarla
 * sin base, sí.
 */
async function _seOpuso(appId) {
    const cached = cachePreferencias.get(appId);
    if (cached && cached.expira > Date.now()) return cached.opuesto;

    try {
        const { rows } = await query(
            'SELECT telemetria, episodios FROM telemetry_preferences WHERE app_id = $1 LIMIT 1',
            [appId]
        );
        const prefs = rows[0] || { telemetria: true, episodios: true };
        const opuesto = { telemetria: !prefs.telemetria, episodios: !prefs.episodios };
        cachePreferencias.set(appId, { opuesto, expira: Date.now() + CACHE_TTL_MS });
        return opuesto;
    } catch (err) {
        logger.warn({ appId, error: err.message },
            'No se pudo comprobar la oposición al tratamiento; no se recoge');
        return { telemetria: true, episodios: true };
    }
}

/** Decide si se puede recoger, y por qué no cuando no. */
async function permiteRecoger(appId, plan = PLAN_POR_DEFECTO) {
    const ent = getEntitlements(plan);

    // Zero-retention: ni telemetría ni episodios. Es la feature que se vende.
    if (ent.privacidad.regimen === 'zero_retention') {
        return { telemetria: false, episodios: false, motivo: 'zero_retention' };
    }

    const opuesto = await _seOpuso(appId);
    if (opuesto.telemetria) {
        return { telemetria: false, episodios: false, motivo: 'oposicion_art21' };
    }
    return {
        telemetria: true,
        episodios: ent.privacidad.episodios && !opuesto.episodios,
        motivo: null,
    };
}

/**
 * Registra una llamada. Nunca lanza.
 *
 * @param {object} ev
 * @param {string} ev.appId
 * @param {string} [ev.plan]
 * @param {'mcp'|'rest'|'cli'} ev.canal
 * @param {string} ev.herramienta
 * @param {object} [ev.argumentos]   se guarda su FORMA, jamás su contenido
 * @param {'ok'|'error_cliente'|'error_servidor'|'denegado'} ev.resultado
 */
async function registrar(ev) {
    try {
        const permiso = await permiteRecoger(ev.appId, ev.plan);
        if (!permiso.telemetria) return { escrito: false, motivo: permiso.motivo };

        const forma = anon.formaArgumentos(ev.argumentos);
        const registro = {
            tenant_seudonimo: anon.seudonimo(ev.appId, 'telemetria'),
            canal: ev.canal,
            herramienta: String(ev.herramienta).slice(0, 120),
            plan: ev.plan || null,
            forma_argumentos: forma,
            resultado: ev.resultado,
            codigo_error: ev.codigoError ? String(ev.codigoError).slice(0, 60) : null,
            latencia_ms: Number.isFinite(ev.latenciaMs) ? Math.round(ev.latenciaMs) : null,
            reintento: Boolean(ev.reintento),
            requirio_aprobacion: Boolean(ev.requirioAprobacion),
            aprobacion_resuelta: ev.aprobacionResuelta || null,
        };

        // Red de seguridad: si algo de la forma no es un tipo conocido, es que
        // se ha colado un valor. Se descarta la fila entera.
        const sospechoso = anon.contieneContenido(registro);
        if (sospechoso.length > 0) {
            logger.error({ campos: sospechoso },
                'Registro de telemetría descartado: la forma llevaba algo que no es un tipo');
            return { escrito: false, motivo: 'contenido_detectado' };
        }

        await query(
            `INSERT INTO agent_telemetry
                 (tenant_seudonimo, canal, herramienta, plan, forma_argumentos, resultado,
                  codigo_error, latencia_ms, reintento, requirio_aprobacion, aprobacion_resuelta,
                  purgar_despues_de)
             VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11, NOW() + ($12 || ' days')::interval)`,
            [registro.tenant_seudonimo, registro.canal, registro.herramienta, registro.plan,
                JSON.stringify(registro.forma_argumentos), registro.resultado, registro.codigo_error,
                registro.latencia_ms, registro.reintento, registro.requirio_aprobacion,
                registro.aprobacion_resuelta, String(DIAS_TELEMETRIA)]
        );
        return { escrito: true };
    } catch (err) {
        // Telemetría que rompe una petición sería peor que no tener telemetría.
        logger.warn({ error: err.message }, 'No se pudo registrar telemetría');
        return { escrito: false, motivo: 'error' };
    }
}

/**
 * Registra un episodio de servicio (capa 3).
 *
 * Aquí ya no hay inquilino: se agrega por sector. Es un paso más de agregación
 * sobre la telemetría, no una copia con más campos.
 */
async function registrarEpisodio(ep) {
    try {
        const permiso = await permiteRecoger(ep.appId, ep.plan);
        if (!permiso.episodios) return { escrito: false, motivo: permiso.motivo };

        await query(
            `INSERT INTO cs_episodes
                 (sector, plan, intencion, herramientas, turnos, resolucion, hueco_detectado, purgar_despues_de)
             VALUES ($1,$2,$3,$4,$5,$6,$7, NOW() + ($8 || ' months')::interval)`,
            [ep.sector || null, ep.plan || null,
                String(ep.intencion).slice(0, 120),
                Array.isArray(ep.herramientas) ? ep.herramientas.slice(0, 20) : [],
                Math.min(Number(ep.turnos) || 1, 999),
                ep.resolucion,
                ep.huecoDetectado ? String(ep.huecoDetectado).slice(0, 200) : null,
                String(MESES_EPISODIOS)]
        );
        return { escrito: true };
    } catch (err) {
        logger.warn({ error: err.message }, 'No se pudo registrar episodio');
        return { escrito: false, motivo: 'error' };
    }
}

/**
 * Purga por plazo (art. 5.1.e).
 *
 * Borra por `purgar_despues_de`, que va en la fila: así una fila escrita con un
 * plazo de 90 días conserva ese plazo aunque mañana se cambie la constante. Lo
 * contrario —purgar con la constante de hoy— alargaría retroactivamente la
 * conservación de datos ya recogidos, que es exactamente lo que el principio de
 * limitación del plazo prohíbe.
 */
async function purgar() {
    const t = await query('DELETE FROM agent_telemetry WHERE purgar_despues_de <= NOW()');
    const e = await query('DELETE FROM cs_episodes WHERE purgar_despues_de <= NOW()');
    return { telemetriaBorrada: t.rowCount || 0, episodiosBorrados: e.rowCount || 0 };
}

/**
 * Ejercicio del derecho de oposición (art. 21).
 *
 * Se guarda la FECHA además del interruptor: ante una reclamación hay que poder
 * acreditar desde cuándo se dejó de tratar, y un booleano no lo dice.
 */
async function fijarPreferencias(appId, { telemetria = true, episodios = true }) {
    const { rows } = await query(
        `INSERT INTO telemetry_preferences (app_id, telemetria, episodios, opuesto_at, actualizado_at)
         VALUES ($1, $2, $3, CASE WHEN $2 = FALSE OR $3 = FALSE THEN NOW() ELSE NULL END, NOW())
         ON CONFLICT (app_id) DO UPDATE
            SET telemetria = EXCLUDED.telemetria,
                episodios = EXCLUDED.episodios,
                opuesto_at = CASE WHEN EXCLUDED.telemetria = FALSE OR EXCLUDED.episodios = FALSE
                                  THEN COALESCE(telemetry_preferences.opuesto_at, NOW()) END,
                actualizado_at = NOW()
       RETURNING telemetria, episodios, opuesto_at`,
        [appId, telemetria, episodios]
    );
    cachePreferencias.delete(appId);
    logger.info({ appId, telemetria, episodios }, 'Preferencias de telemetría actualizadas');
    return rows[0];
}

async function obtenerPreferencias(appId) {
    const { rows } = await query(
        'SELECT telemetria, episodios, opuesto_at, actualizado_at FROM telemetry_preferences WHERE app_id = $1',
        [appId]
    );
    return rows[0] || { telemetria: true, episodios: true, opuesto_at: null, actualizado_at: null };
}

/**
 * Derecho de acceso (art. 15): qué hay recogido de este inquilino.
 *
 * Se resuelve por el seudónimo, que es lo único que hay en la tabla — y poder
 * recalcularlo es justo lo que hace que esto sea seudonimizado y no anónimo, y
 * por tanto que el derecho de acceso siga siendo ejercitable.
 */
async function exportarDe(appId) {
    const { rows } = await query(
        `SELECT canal, herramienta, plan, forma_argumentos, resultado, codigo_error,
                latencia_ms, reintento, requirio_aprobacion, aprobacion_resuelta,
                created_at, purgar_despues_de
           FROM agent_telemetry WHERE tenant_seudonimo = $1 ORDER BY created_at DESC LIMIT 5000`,
        [anon.seudonimo(appId, 'telemetria')]
    );
    return rows;
}

/**
 * Derecho de supresión (art. 17) sobre la telemetría.
 *
 * Los episodios NO se borran aquí y hay que decir por qué: están agregados por
 * sector y ya no contienen dato que permita identificar al inquilino, así que
 * no son suyos que suprimir. Si alguna vez un episodio pudiera reconducirse a
 * un cliente, dejaría de ser un episodio y esta decisión habría que rehacerla.
 */
async function suprimirDe(appId) {
    const { rowCount } = await query(
        'DELETE FROM agent_telemetry WHERE tenant_seudonimo = $1',
        [anon.seudonimo(appId, 'telemetria')]
    );
    return { telemetriaBorrada: rowCount || 0 };
}

module.exports = {
    registrar, registrarEpisodio, permiteRecoger, purgar,
    fijarPreferencias, obtenerPreferencias, exportarDe, suprimirDe,
    DIAS_TELEMETRIA, MESES_EPISODIOS,
};
