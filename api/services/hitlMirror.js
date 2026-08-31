'use strict';

/**
 * hitlMirror — refleja las transiciones de la cola HITL de SCADA en
 * business-ops (OPERANT), que es el sistema de registro único de aprobaciones.
 *
 * Por qué espejo y no cliente
 * ---------------------------
 * La opción evidente era que `hitlQueue` delegase en business-ops y hubiera
 * una sola cola. Se descartó por dos motivos, y conviene dejarlos escritos
 * porque la tentación va a volver:
 *
 *  1. La interfaz de `hitlQueue` es SÍNCRONA (`submit`, `approve` y `consume`
 *     devuelven el trabajo, no una promesa). Convertirla en cliente de red
 *     obliga a hacer asíncrono todo `routes/energy.js`.
 *
 *  2. Y sobre todo: dejaría las aprobaciones de mando eléctrico dependiendo de
 *     que un segundo servicio esté vivo. Si business-ops se cae, un operador
 *     tiene que poder RECHAZAR un deslastre igual. Una aprobación que no se
 *     puede denegar es peor que no tener panel unificado.
 *
 * Así que la cola sigue siendo dueña de su propio estado, en memoria, y aquí
 * solo se refleja. Se gana el sitio único donde mirar y el registro único de
 * quién aprobó qué; no se pierde disponibilidad.
 *
 * Reglas de esta pieza: no bloquea, no lanza y no espera. Un fallo al reflejar
 * se registra y se sigue — exactamente el mismo criterio que OPERANT aplica a
 * sus avisos de Telegram, después de que un DNS caído le tumbara el proceso.
 */

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/secrets');

// Se leen en cada llamada, no al cargar el módulo: así el destino se puede
// cambiar sin reiniciar, y un test puede apuntarlo a otro sitio después de
// haber importado la cola.
const base = () => process.env.BUSINESS_OPS_URL || '';
const tenant = () => process.env.BUSINESS_OPS_TENANT || 'bezhas';
const timeoutMs = () => parseInt(process.env.BUSINESS_OPS_TIMEOUT_MS, 10) || 2000;

let fallosSeguidos = 0;
const AVISAR_CADA = 20;   // no inundar el log si el otro plano está caído

/** ¿Está configurado el espejo? Sin URL, esta pieza es un no-op silencioso. */
function enabled() {
  return Boolean(base() && JWT_SECRET);
}

/**
 * Token de servicio, de vida muy corta. Lo verifica el puente de auth de
 * business-ops con el mismo secreto que firma la API: no hay credencial nueva
 * que repartir ni que rotar por separado.
 */
function serviceToken() {
  return jwt.sign(
    { userId: 'api-hitl-mirror', address: null, role: 'service' },
    JWT_SECRET,
    { expiresIn: '2m', algorithm: 'HS256' }
  );
}

/**
 * Refleja una transición. Devuelve inmediatamente: el envío ocurre por detrás.
 *
 * @param {object} job  vista pública del trabajo (la que devuelve hitlQueue)
 * @param {string} estado  'pending' | 'approved' | 'rejected' | 'consumed'
 */
function mirror(job, estado) {
  if (!enabled() || !job || !job.jobId) return;

  const cuerpo = JSON.stringify({
    approvalId: job.jobId,
    action: job.command || 'SCADA_COMMAND',
    status: estado,
    reason: job.reason || (job.nodeId ? `nodo ${job.nodeId}` : null),
    origin: 'api:scada',
    approvedBy: job.approvedBy || null,
    agentId: job.requestedBy || null,
  });

  // Sin await a propósito: el mando no espera al espejo.
  (async () => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs());
      const res = await fetch(`${base()}/tenants/${tenant()}/hitl/mirror`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceToken()}`,
        },
        body: cuerpo,
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fallosSeguidos = 0;
    } catch (err) {
      if (fallosSeguidos % AVISAR_CADA === 0) {
        // eslint-disable-next-line no-console
        console.warn(`[hitl:mirror] no se pudo reflejar ${job.jobId} (${err.message}). La cola local sigue operativa.`);
      }
      fallosSeguidos++;
    }
  })();
}

module.exports = { mirror, enabled };
