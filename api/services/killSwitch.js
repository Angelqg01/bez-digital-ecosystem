'use strict';

/**
 * killSwitch — estado de emergencia de la operativa con fondos.
 *
 *     NORMAL → SUSPICIOUS → LOCKDOWN
 *
 * LOCKDOWN bloquea firmas, pagos y ejecuciones nuevas; las lecturas siguen, y
 * la auditoría también. SUSPICIOUS deja operar con una aprobación más.
 *
 * Ámbitos, del más amplio al más fino:
 *     global            toda la plataforma
 *     rail:<carril>     p. ej. rail:fiat_to_fiat
 *     tenant:<appId>    un cliente
 * El estado efectivo de una operación es el MÁS severo de los tres.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  SUBIR ES FÁCIL; BAJAR EXIGE DOS PERSONAS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Elevar el estado lo puede hacer una sola persona de seguridad, la clave
 * interna o el propio motor de riesgo: ante un incidente, cada minuto cuenta y
 * un falso positivo cuesta poco. Rebajarlo exige dos firmas EIP-712 de
 * aprobadores de seguridad DISTINTOS. Si la cuenta de quien pulsó el botón está
 * comprometida, el atacante no puede reabrir la operativa él solo.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  SI NO SE PUEDE LEER, NO SE MUEVE DINERO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `estadoEfectivo()` devuelve UNKNOWN cuando la base no responde y la última
 * lectura buena tiene más de 30 s. La política trata UNKNOWN como bloqueo. La
 * alternativa —asumir NORMAL— convertiría una caída de Postgres en la ventana
 * perfecta para vaciar una tesorería.
 */

const { query } = require('../db/pool');
const logger = require('../utils/logger');

const ESTADOS = ['NORMAL', 'SUSPICIOUS', 'LOCKDOWN'];
const SEVERIDAD = { NORMAL: 0, SUSPICIOUS: 1, LOCKDOWN: 2, UNKNOWN: 3 };
const RE_SCOPE = /^(global|rail:[a-z_]{3,40}|tenant:[A-Za-z0-9_-]{1,64})$/;

const FRESCURA_MS = 5000;
const CADUCIDAD_MS = 30000;

let cache = { cargadoEn: 0, filas: new Map(), cargado: false };
let temporizador = null;

async function cargar() {
    const { rows } = await query('SELECT scope, state, reason, updated_at FROM security_kill_switch');
    cache = {
        cargadoEn: Date.now(),
        filas: new Map(rows.map((r) => [r.scope, { estado: r.state, motivo: r.reason, actualizado: r.updated_at }])),
        cargado: true,
    };
    return cache;
}

function combinar(scopes) {
    let peor = { estado: 'NORMAL', scope: null, motivo: null };
    for (const s of scopes) {
        const f = cache.filas.get(s);
        if (f && SEVERIDAD[f.estado] > SEVERIDAD[peor.estado]) peor = { estado: f.estado, scope: s, motivo: f.motivo };
    }
    return peor;
}

const scopesDe = ({ appId, rail } = {}) => ['global', rail && `rail:${rail}`, appId && `tenant:${appId}`].filter(Boolean);

/** Estado efectivo con lectura fresca. Para decidir si se mueve dinero. */
async function estadoEfectivo(ctx = {}) {
    if (Date.now() - cache.cargadoEn > FRESCURA_MS) {
        try {
            await cargar();
        } catch (err) {
            if (!cache.cargado || Date.now() - cache.cargadoEn > CADUCIDAD_MS) {
                logger.error({ error: err.message }, 'kill switch ilegible: se trata como bloqueo');
                return { estado: 'UNKNOWN', scope: null, motivo: 'No se pudo leer el estado de emergencia.' };
            }
        }
    }
    return combinar(scopesDe(ctx));
}

/**
 * Lectura en memoria, síncrona, para rutas que no pueden añadir una consulta.
 * Refleja la última carga del temporizador de `iniciar()`.
 */
function consultarCache(ctx = {}) {
    if (!cache.cargado) return { estado: 'NORMAL', scope: null, motivo: null, cargado: false };
    if (Date.now() - cache.cargadoEn > CADUCIDAD_MS) {
        return { estado: 'UNKNOWN', scope: null, motivo: 'Estado de emergencia sin refrescar.', cargado: true };
    }
    return { ...combinar(scopesDe(ctx)), cargado: true };
}

function validar(scope, estado) {
    if (!RE_SCOPE.test(String(scope || ''))) {
        const e = new Error('Ámbito del kill switch no válido.'); e.code = 'KILL_SWITCH_SCOPE_INVALID'; throw e;
    }
    if (!ESTADOS.includes(estado)) {
        const e = new Error('Estado del kill switch no válido.'); e.code = 'KILL_SWITCH_STATE_INVALID'; throw e;
    }
}

async function escribir({ scope, estado, motivo, actores, transicion }) {
    await query(
        `INSERT INTO security_kill_switch (scope, state, reason, updated_by, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (scope) DO UPDATE SET state = $2, reason = $3, updated_by = $4, updated_at = NOW()`,
        [scope, estado, motivo, actores.join(',')]
    );
    await query(
        `INSERT INTO security_kill_switch_events (scope, from_state, to_state, reason, actors)
         VALUES ($1, $2, $3, $4, $5)`,
        [scope, transicion.desde, estado, motivo, actores]
    );
    cache.cargadoEn = 0; // la próxima lectura va a la base
}

/** Sube (o mantiene) la severidad. Un solo actor basta. */
async function elevar({ scope, estado, motivo, actor }) {
    validar(scope, estado);
    await cargar().catch(() => {});
    const actual = cache.filas.get(scope)?.estado || 'NORMAL';
    if (SEVERIDAD[estado] < SEVERIDAD[actual]) {
        const e = new Error('Para rebajar el estado hacen falta dos aprobadores de seguridad.');
        e.code = 'KILL_SWITCH_LOWER_REQUIRES_TWO';
        throw e;
    }
    await escribir({ scope, estado, motivo: String(motivo || '').slice(0, 300), actores: [actor], transicion: { desde: actual } });
    logger.warn({ scope, desde: actual, hacia: estado, actor }, 'KILL SWITCH elevado');
    return { scope, desde: actual, estado };
}

/**
 * Rebaja la severidad. `actores` son direcciones YA verificadas como
 * aprobadores de seguridad distintos (lo comprueba la ruta con txApproval).
 */
async function rebajar({ scope, estado, motivo, actores }) {
    validar(scope, estado);
    const distintos = [...new Set((actores || []).map((a) => String(a).toLowerCase()))];
    if (distintos.length < 2) {
        const e = new Error('Para rebajar el estado hacen falta dos aprobadores de seguridad distintos.');
        e.code = 'KILL_SWITCH_LOWER_REQUIRES_TWO';
        throw e;
    }
    await cargar();
    const actual = cache.filas.get(scope)?.estado || 'NORMAL';
    if (SEVERIDAD[estado] >= SEVERIDAD[actual]) {
        const e = new Error('Eso no es una rebaja: usa elevar.'); e.code = 'KILL_SWITCH_NOT_A_LOWERING'; throw e;
    }
    await escribir({ scope, estado, motivo: String(motivo || '').slice(0, 300), actores: distintos, transicion: { desde: actual } });
    logger.warn({ scope, desde: actual, hacia: estado, actores: distintos }, 'KILL SWITCH rebajado');
    return { scope, desde: actual, estado };
}

/** Carga inicial + refresco periódico. Se llama al arrancar, antes de escuchar. */
async function iniciar({ intervaloMs = FRESCURA_MS } = {}) {
    if (!temporizador) {
        temporizador = setInterval(() => {
            cargar().catch((err) => logger.warn({ error: err.message }, 'kill switch: refresco fallido'));
        }, intervaloMs);
        temporizador.unref?.();
    }
    return cargar();
}

function detener() {
    if (temporizador) clearInterval(temporizador);
    temporizador = null;
}

/** Para pruebas. */
function _reset(filas = null) {
    cache = filas
        ? { cargadoEn: Date.now(), filas: new Map(Object.entries(filas)), cargado: true }
        : { cargadoEn: 0, filas: new Map(), cargado: false };
}

module.exports = {
    ESTADOS, SEVERIDAD,
    estadoEfectivo, consultarCache, elevar, rebajar, iniciar, detener, cargar, _reset,
};
