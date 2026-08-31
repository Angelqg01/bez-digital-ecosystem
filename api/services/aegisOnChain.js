'use strict';

/**
 * aegisOnChain — deja constancia EN CADENA de que Aegis rechazó algo.
 *
 * ── El hueco que cierra ─────────────────────────────────────────────────────
 *
 * Hasta ahora, cuando Aegis rechazaba una telemetría —cadena de frío rota,
 * lectura imposible, sensor manipulado— el hecho quedaba en `ai_logs`: una
 * tabla de nuestra base de datos, que podemos editar nosotros.
 *
 * Y ése es justo el hecho que importa después: *«detectamos que la cadena de
 * frío se rompió y nos negamos a certificar el envío»*. Sostenerlo frente a
 * una aseguradora con una fila de nuestra propia base de datos es pedirle que
 * se fíe de la parte interesada. `AegisSecurityProvider` lo convierte en un
 * registro que no controlamos.
 *
 * ── Qué NO hace, y es deliberado ────────────────────────────────────────────
 *
 * `OpenClawAgent` y `L2Sequencer` permiten que un agente de IA **pause la
 * producción de bloques** ante una señal. Esa vía queda SIN CABLEAR a
 * propósito:
 *
 *   * Ninguno de los dos contratos tiene una sola prueba.
 *   * El conector off-chain (`agent-lib/connectors/AegisConnector.js`) escucha
 *     eventos que no existen —`ThreatDetected`, `SecurityCheckFailed`, cuando
 *     el real es `RiskSignalTriggered`— con hashes de tópico que son
 *     literalmente la cadena `"...placeholder"`, y mete ruido con
 *     `Math.random()`. Es un esqueleto, no una integración a medio hacer.
 *   * Y sobre todo: parar una cadena es una decisión con consecuencias para
 *     todos los que operan en ella. Automatizarla a partir de una puntuación de
 *     ML —una que hoy lleva ruido aleatorio dentro— no es una función que se
 *     enciende, es una que se diseña.
 *
 * Registrar la señal es evidencia. Pausar es una decisión. Aquí se hace lo
 * primero.
 *
 * ── Sobre el volumen ────────────────────────────────────────────────────────
 *
 * Sólo suben las señales de nivel HIGH o CRITICAL. No es un interruptor que
 * alguien pueda dejarse apagado: el propio umbral limita el gasto. Un sensor
 * averiado que dispare cien rechazos leves al día no gasta gas; uno que
 * detecte manipulación, sí — y debe.
 */

const { ethers } = require('ethers');
const logger = require('../utils/logger');
const { chainCall } = require('../utils/chainCall');
const { getSignedContract } = require('./contractService');

// Espejo del enum del contrato: NONE, LOW, MEDIUM, HIGH, CRITICAL.
const RISK_LEVEL = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

/** A partir de aquí se ancla. Por debajo se queda en la base de datos. */
const ON_CHAIN_FROM = RISK_LEVEL.HIGH;

/**
 * Traduce un rechazo de Aegis a un nivel de riesgo.
 *
 * El circuito abierto NO es CRITICAL: significa que no sabemos, no que haya
 * una amenaza. Marcarlo como crítico llenaría la cadena de señales durante una
 * caída del servicio de IA — que es cuando menos información tenemos.
 */
function levelFor({ reason, score, usedFallback }) {
    if (reason === 'circuit_open') return RISK_LEVEL.LOW;
    if (usedFallback) return RISK_LEVEL.MEDIUM;      // decidió la regla, no el modelo
    if (typeof score === 'number' && score >= 0.9) return RISK_LEVEL.CRITICAL;
    return RISK_LEVEL.HIGH;
}

/**
 * Publica la señal de riesgo. Best-effort: si la cadena no está, el rechazo
 * sigue siendo válido — lo que se pierde es la prueba independiente, no la
 * decisión.
 */
async function signalRejection({ containerId, wallet, reason, score, usedFallback }) {
    const level = levelFor({ reason, score, usedFallback });
    if (level < ON_CHAIN_FROM) {
        return { signalled: false, mode: 'below_threshold', level };
    }

    const aegis = await chainCall('AegisSecurityProvider',
        () => getSignedContract('AegisSecurityProvider'), null);
    if (!aegis) return { signalled: false, mode: 'no_contract', level };

    // La metadata va como hash, no en claro: la posición GPS y el identificador
    // de contenedor de un cliente no tienen por qué quedar públicos en L1 para
    // demostrar que hubo un rechazo. El original queda en `ai_logs` y el hash
    // permite probar después que es el mismo.
    const payload = { containerId, wallet, reason, score, usedFallback, at: new Date().toISOString() };
    const metadata = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(payload)));

    const receipt = await chainCall('AegisSecurityProvider.triggerRiskSignalWithLevel',
        async () => (await aegis.triggerRiskSignalWithLevel(
            `TELEMETRY_REJECTED:${containerId}`, level, metadata,
        )).wait(), null);

    if (!receipt) return { signalled: false, mode: 'signal_failed', level };

    logger.warn(
        `[AEGIS][CADENA] rechazo anclado: ${containerId} nivel=${level} tx=${receipt.hash}`
    );
    return {
        signalled: true, level, metadata,
        txHash: receipt.hash, gasUsed: Number(receipt.gasUsed),
    };
}

module.exports = { signalRejection, levelFor, RISK_LEVEL, ON_CHAIN_FROM };
