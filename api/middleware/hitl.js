'use strict';

/**
 * Human-in-the-loop guard.
 *
 * Deja pasar una acción de alto riesgo SOLO si existe una aprobación real,
 * concedida por otra persona, en la cola de `services/hitlQueue`.
 *
 * Versión anterior (insegura): daba por aprobada la acción si el propio
 * llamante mandaba `humanApproved: true` en el body o la cabecera
 * `x-human-approved: true`, y además solo exigía aprobación si el llamante
 * declaraba `requiresHumanApproval`. Es decir, quien ejecutaba la acción
 * decidía si necesitaba permiso y se lo concedía a sí mismo. Sobre rutas
 * SCADA / demand-response eso equivale a no tener control ninguno.
 *
 * Ahora:
 *   - La necesidad de aprobación la decide el SERVIDOR, no el cliente.
 *   - La aprobación se resuelve contra la cola por `jobId`.
 *   - Es de un solo uso (se consume) y caduca.
 *   - Quien pide no puede aprobar (segregación de funciones, en `hitlQueue.approve`).
 *   - La aprobación está atada al comando concreto que se aprobó.
 *
 * Uso:
 *   router.post('/x', authenticateToken, hitlApprove({ command: 'DEMAND_RESPONSE' }), ...)
 *   router.post('/y', authenticateToken, hitlApprove, ...)   // sigue funcionando
 */

const hitlQueue = require('../services/hitlQueue');

function actorOf(req) {
  return req.user?.userId || req.user?.id || req.user?.address || 'unknown';
}

function makeGuard(options = {}) {
  const command = options.command || 'HITL_GUARDED_ACTION';

  return function hitlGuard(req, res, next) {
    const requestedBy = actorOf(req);

    // El id de la aprobación puede venir por body, cabecera o query; lo que ya
    // no vale es una simple declaración de "esto está aprobado".
    const jobId = req.body?.approvalJobId
      || req.headers['x-hitl-job-id']
      || req.query?.approvalJobId;

    if (jobId) {
      const consumed = hitlQueue.consume(String(jobId), { command });
      if (!consumed.error) {
        req.hitlApproval = consumed;   // trazabilidad: quién aprobó y cuándo
        return next();
      }

      return res.status(428).json({
        error: 'Human approval required',
        code: 'HITL_APPROVAL_INVALID',
        reason: consumed.error,
        nextAction: 'request_human_approval',
      });
    }

    // Sin aprobación: se encola una y se le dice al operador dónde aprobarla.
    const job = hitlQueue.submit({
      jobId: `hitl_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      nodeId: req.body?.nodeId || null,
      command,
      params: req.body || {},
      requestedBy,
    });

    return res.status(428).json({
      error: 'Human approval required',
      code: 'HITL_PENDING',
      nextAction: 'request_human_approval',
      job_id: job.jobId,
      status: job.status,
      approve_url: `/api/energy/control/${job.jobId}/approve`,
      hint: 'Reenvía la petición con approvalJobId (o cabecera x-hitl-job-id) una vez aprobada por un operador distinto.',
    });
  };
}

/**
 * Acepta las dos formas: como middleware directo `hitlApprove` o como factory
 * `hitlApprove({ command })`. Express siempre llama al middleware con
 * (req, res, next), así que distinguimos por la pinta del primer argumento.
 */
function hitlApprove(...args) {
  const [first, second, third] = args;
  const usedAsMiddleware = args.length >= 3
    && first && typeof first === 'object' && first.headers !== undefined
    && typeof third === 'function';

  if (usedAsMiddleware) return makeGuard()(first, second, third);
  return makeGuard(first || {});
}

module.exports = { hitlApprove };
