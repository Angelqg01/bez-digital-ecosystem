'use strict';

/**
 * chainCall — llamada a contrato que degrada de forma VISIBLE.
 *
 * ── El problema que resuelve ────────────────────────────────────────────────
 *
 * El patrón `await contrato.metodo().catch(() => 0)` está por todo el código y
 * es razonable en intención: la cadena puede no estar disponible y la API no
 * debería reventar por eso.
 *
 * Lo que tiene de malo es que **un cero devuelto por un catch es
 * indistinguible de un cero legítimo**. Así estuvo meses
 * `EdgeNodeRewards.pendingRewards()` — un método que no existe en el ABI —
 * devolviendo 0 a todos los validadores sin que nada lo delatara.
 *
 * Este ayudante mantiene la degradación y le quita el silencio:
 *
 *   1. Registra el fallo con la etiqueta de QUÉ llamada falló.
 *   2. Incrementa un contador expuesto en Prometheus.
 *   3. Devuelve el valor por defecto, igual que antes.
 *
 * Un método que no existe deja de ser un cero creíble y pasa a ser una línea de
 * log y una métrica que sube. Sigue sin romper la petición — que era el motivo
 * legítimo del catch original.
 *
 * ── Sobre el ruido en el log ────────────────────────────────────────────────
 *
 * Con la cadena caída, todas las llamadas fallan a la vez. Registrar cada una
 * reproduce el problema del bucle de reconexión, así que se agrupa: una línea
 * por etiqueta y ventana, con la cuenta de las que se callaron.
 */

const logger = require('./logger');

const WINDOW_MS = parseInt(process.env.CHAIN_CALL_LOG_WINDOW_MS || '60000', 10);

/** Fallos acumulados por etiqueta. Lo lee el exportador de métricas. */
const failures = new Map();
const lastLogged = new Map();

function record(label, message) {
    const prev = failures.get(label) || { count: 0, lastError: null, since: Date.now() };
    prev.count++;
    prev.lastError = message;
    failures.set(label, prev);

    const now = Date.now();
    const last = lastLogged.get(label) || 0;
    if (now - last >= WINDOW_MS) {
        const suppressed = prev.count - 1;
        lastLogged.set(label, now);
        logger.warn(
            `[chain] ${label} falló: ${message}`
            + (suppressed > 0 ? ` (+${suppressed} fallos previos silenciados)` : '')
        );
    }
}

/**
 * Ejecuta una llamada a contrato devolviendo `fallback` si falla.
 *
 * @param {string}   label    Qué se llamó, p. ej. 'ValidatorRegistry.getValidatorInfo'.
 *                            Es lo que aparece en el log y en la métrica, así que
 *                            conviene que identifique contrato y método.
 * @param {Function} fn       Función que devuelve la promesa de la llamada.
 * @param {*}        fallback Valor a devolver si falla.
 */
async function chainCall(label, fn, fallback = null) {
    try {
        return await fn();
    } catch (err) {
        record(label, err?.shortMessage || err?.message || String(err));
        return fallback;
    }
}

/** Instantánea para el exportador de métricas y para /api/monitor. */
function getChainCallFailures() {
    return Object.fromEntries(
        [...failures.entries()].map(([label, v]) => [label, { ...v }])
    );
}

function totalChainCallFailures() {
    let n = 0;
    for (const v of failures.values()) n += v.count;
    return n;
}

/** Sólo para pruebas. */
function _reset() { failures.clear(); lastLogged.clear(); }

module.exports = { chainCall, getChainCallFailures, totalChainCallFailures, _reset };
