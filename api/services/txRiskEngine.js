'use strict';

/**
 * txRiskEngine — puntúa el riesgo de una intención.
 *
 * Función pura: recibe la intención y las señales ya calculadas (historial,
 * simulación, cribado) y devuelve un nivel con sus motivos. No lee base de
 * datos ni red, así que se prueba con tablas y no tiene estados raros.
 *
 *   LOW       puede ir sola, si la política lo permite
 *   MEDIUM    necesita aprobación humana
 *   HIGH      se bloquea
 *   CRITICAL  se bloquea y levanta alerta (y pone al inquilino en SUSPICIOUS)
 *
 * Hay reglas que no suman puntos sino que fuerzan el nivel: una jurisdicción
 * bloqueada o una simulación que no casa con lo pedido no se compensan con un
 * historial limpio.
 */

const { jurisdiccionesBloqueadas, jurisdiccionesReforzadas } = require('../config/tx-rails');

const NIVELES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const peso = (nivel) => NIVELES.indexOf(nivel);
const maxNivel = (a, b) => (peso(a) >= peso(b) ? a : b);

function nivelPorPuntos(puntos) {
    if (puntos >= 80) return 'CRITICAL';
    if (puntos >= 50) return 'HIGH';
    if (puntos >= 25) return 'MEDIUM';
    return 'LOW';
}

/**
 * @param {object} intent  intención normalizada
 * @param {object} s       señales:
 *   importeEur                number|null  (null = sin referencia de precio fiable)
 *   destinoConocido           boolean
 *   destinoRecienteHoras      number|null  horas desde que se dio de alta el destino
 *   operacionesUltimaHora     number
 *   mediaEur30d               number
 *   cercaDeUmbral24h          number  operaciones entre el 90 y el 100 % de un umbral
 *   simulacion                { ok, motivo?, aprobacionIlimitada?, discrepancia? } | null
 *   verificacionBeneficiario  'match'|'close_match'|'no_match'|'unavailable'|null
 *   cribado                   'clear'|'hit'|'unavailable'|null
 */
function evaluarRiesgo(intent, s = {}, env = process.env) {
    const factores = [];
    let puntos = 0;
    let forzado = 'LOW';
    const sumar = (code, p, mensaje) => { puntos += p; factores.push({ code, puntos: p, mensaje }); };
    const forzar = (code, nivel, mensaje) => { forzado = maxNivel(forzado, nivel); factores.push({ code, nivel, mensaje }); };

    // ── Jurisdicción ─────────────────────────────────────────────────────────
    const paises = [
        intent.destination?.country, intent.destination?.ibanCountry,
        intent.counterparty?.country, intent.counterparty?.taxResidence,
    ].filter(Boolean);
    const bloqueadas = jurisdiccionesBloqueadas(env);
    const reforzadas = jurisdiccionesReforzadas(env);
    const bloqueada = paises.find((p) => bloqueadas.has(p));
    if (bloqueada) {
        forzar('JURISDICTION_BLOCKED', 'CRITICAL', `Jurisdicción bloqueada (${bloqueada}).`);
    } else {
        const reforzada = paises.find((p) => reforzadas.has(p));
        if (reforzada) sumar('JURISDICTION_ENHANCED', 30, `Jurisdicción con diligencia reforzada (${reforzada}).`);
    }

    // ── Destino ──────────────────────────────────────────────────────────────
    if (!s.destinoConocido) {
        sumar('NEW_DESTINATION', 20, 'Destino nunca usado por este cliente.');
    } else if (typeof s.destinoRecienteHoras === 'number' && s.destinoRecienteHoras < 24) {
        sumar('RECENT_DESTINATION', 10, 'Destino dado de alta hace menos de 24 h.');
    }
    if (intent.destination?.type === 'iban' && intent.destination.sepa === false) {
        sumar('NON_SEPA', 20, 'IBAN fuera de la zona SEPA.');
    }
    const importe = s.importeEur;
    if (intent.destination?.type === 'evm_address' && intent.destination.selfHosted
        && !intent.destination.ownershipProof && (importe === null || importe === undefined || importe >= 1000)) {
        sumar('SELF_HOSTED_UNVERIFIED', 30, 'Wallet autoalojada sin prueba de titularidad por encima de 1.000 €.');
    }

    // ── Comportamiento ───────────────────────────────────────────────────────
    const hora = s.operacionesUltimaHora || 0;
    if (hora >= 10) sumar('VELOCITY', 30, `${hora} operaciones en la última hora.`);
    else if (hora >= 5) sumar('VELOCITY', 15, `${hora} operaciones en la última hora.`);

    if (typeof importe === 'number' && s.mediaEur30d > 0 && importe > 5 * s.mediaEur30d) {
        sumar('AMOUNT_ANOMALY', 25, 'Importe más de cinco veces superior a la media de 30 días.');
    }
    if ((s.cercaDeUmbral24h || 0) >= 3) {
        // Tres operaciones seguidas justo por debajo de un umbral es el patrón
        // de fraccionamiento de libro para esquivar la revisión.
        sumar('STRUCTURING', 35, 'Varias operaciones justo por debajo de un umbral en 24 h.');
    }
    if (importe === null || importe === undefined) {
        sumar('PRICE_UNAVAILABLE', 15, 'Sin precio de referencia fiable: el importe en euros no se puede verificar.');
    }

    // ── Beneficiario y cribado ───────────────────────────────────────────────
    if (s.verificacionBeneficiario === 'no_match') {
        sumar('PAYEE_MISMATCH', 40, 'El nombre del beneficiario no casa con el titular del IBAN.');
    } else if (s.verificacionBeneficiario === 'close_match') {
        sumar('PAYEE_CLOSE_MATCH', 15, 'El nombre del beneficiario casa sólo parcialmente.');
    }
    if (s.cribado === 'hit') forzar('SANCTIONS_HIT', 'CRITICAL', 'Coincidencia en listas de sanciones.');

    // ── Simulación ───────────────────────────────────────────────────────────
    const sim = s.simulacion;
    if (sim) {
        if (sim.aprobacionIlimitada) forzar('UNLIMITED_APPROVAL', 'CRITICAL', 'La operación concede una aprobación ilimitada.');
        if (sim.discrepancia) forzar('SIMULATION_MISMATCH', 'CRITICAL', 'El efecto simulado no coincide con lo pedido.');
        if (!sim.ok) forzar('SIMULATION_FAILED', 'HIGH', `La simulación falló (${sim.motivo || 'sin motivo'}).`);
    }

    const nivel = maxNivel(nivelPorPuntos(puntos), forzado);
    return { nivel, puntos, factores };
}

module.exports = { evaluarRiesgo, NIVELES, maxNivel, nivelPorPuntos };
