'use strict';

/**
 * services/onboardingSweeper.js — barrido periódico de sesiones de onboarding.
 *
 * Hace dos cosas, y la segunda es la que importa de verdad:
 *
 *  1. Marca `caducado` lo que venció. Es redundante con la comprobación al leer
 *     —`porToken` ya caduca de paso— y esa redundancia es deliberada: si el
 *     barrido se para, una sesión vencida sigue sin abrir su pantalla. El
 *     barrido es para que la tabla refleje la realidad, no para que la
 *     seguridad dependa de él.
 *  2. BORRA la IP y el user-agent de las sesiones de más de 24 horas. Se
 *     recogieron para sostener el techo por IP y hora; pasada esa ventana son
 *     un dato personal conservado sin finalidad, que es exactamente lo que el
 *     principio de minimización prohíbe. Nadie va a echar de menos esa columna,
 *     y por eso conviene que la borre un proceso y no la buena voluntad.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUÉ NO SE SOLAPA CONSIGO MISMO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Un `setInterval` que lanza una función asíncrona no espera a que termine: si
 * una pasada tarda más que el intervalo, se acumulan. Con una base lenta eso
 * pasa de un UPDATE cada diez minutos a diez UPDATE simultáneos sobre las
 * mismas filas. El cerrojo `enCurso` lo impide, y saltarse una pasada no tiene
 * ninguna consecuencia: la siguiente hace el mismo trabajo.
 */

const onboarding = require('./onboardingSession');
const credentialIssuance = require('./credentialIssuance');
const telemetry = require('./telemetryPipeline');
const oauthGrant = require('./oauthGrant');
const logger = require('../utils/logger');

const INTERVALO_POR_DEFECTO = parseInt(process.env.ONBOARDING_SWEEP_MS || '600000', 10); // 10 min

let temporizador = null;
let enCurso = false;
let ultimo = null;

async function pasada() {
    if (enCurso) {
        logger.debug('Barrido de onboarding: la pasada anterior sigue en curso, se salta ésta');
        return null;
    }
    enCurso = true;
    try {
        const r = await onboarding.barrer();
        // Los vales de registro de nodo que nadie usó caducan por su cuenta en
        // la consulta que los consume, pero conviene además marcarlos: un vale
        // «pendiente» de hace un mes en la pantalla del cliente parece que
        // todavía sirve, y no sirve.
        r.nodosCaducados = await credentialIssuance.caducarTokensDeNodo();
        // Purga por plazo (art. 5.1.e RGPD). Va aquí y no en un proceso aparte
        // porque un plazo que depende de un demonio que nadie vigila es un
        // plazo que no se cumple: si este barrido se para, se nota en todo lo
        // demás y alguien lo arregla.
        const purgado = await telemetry.purgar();
        r.telemetriaBorrada = purgado.telemetriaBorrada;
        r.episodiosBorrados = purgado.episodiosBorrados;
        // Mismo razonamiento para el OAuth del MCP: códigos con la IP de quien
        // autorizó y tokens caducados. Ver oauthGrant.purgarOAuth.
        Object.assign(r, await oauthGrant.purgarOAuth());
        ultimo = { ...r, fecha: new Date().toISOString() };
        // Sólo se registra cuando hubo algo que hacer: un barrido silencioso
        // cada diez minutos llenaría el log de líneas idénticas y haría más
        // difícil ver la que importa.
        if (r.caducadas > 0 || r.anonimizadas > 0 || r.nodosCaducados > 0
            || r.telemetriaBorrada > 0 || r.episodiosBorrados > 0
            || r.oauthCodigos > 0 || r.oauthDenylist > 0 || r.oauthRefresh > 0) {
            logger.info(r, 'Barrido de onboarding');
        }
        return r;
    } catch (err) {
        // Un fallo no puede parar el bucle: la base puede estar reiniciándose y
        // la siguiente pasada, diez minutos después, funcionará.
        logger.warn({ error: err.message }, 'Barrido de onboarding fallido');
        return null;
    } finally {
        enCurso = false;
    }
}

/**
 * Arranca el barrido. Idempotente: llamarlo dos veces no crea dos bucles.
 *
 * El temporizador va con `unref()` para que no mantenga vivo el proceso: sin
 * eso, una API que termina de servir se quedaría esperando al siguiente tick, y
 * en los tests Jest avisaría de un manejador abierto.
 */
function startSweeper(intervaloMs = INTERVALO_POR_DEFECTO) {
    if (temporizador) return temporizador;
    temporizador = setInterval(() => { pasada(); }, intervaloMs);
    temporizador.unref?.();
    // Una primera pasada al arrancar: si el proceso ha estado caído un rato,
    // hay sesiones vencidas esperando desde antes del reinicio.
    pasada();
    return temporizador;
}

function stopSweeper() {
    if (temporizador) {
        clearInterval(temporizador);
        temporizador = null;
    }
}

function status() {
    return { activo: Boolean(temporizador), enCurso, ultimo };
}

module.exports = { startSweeper, stopSweeper, pasada, status, INTERVALO_POR_DEFECTO };
