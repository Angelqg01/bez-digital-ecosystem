'use strict';

/**
 * hitlQueue — real Human-In-The-Loop approval queue for critical SCADA commands
 * (Phase 5). Critical commands (SHED_LOAD, ISLANDING_MODE, demand-response) are
 * not dispatched until a human operator approves them; this replaces the old
 * passthrough middleware/hitl.js.
 *
 * Pure in-memory state machine (PENDING → APPROVED|REJECTED|EXPIRED) + ACK
 * correlation. The route layer signs + publishes on approval; the Edge's ACK is
 * recorded back here for the audit trail.
 *
 * Cada transición se REFLEJA además en business-ops (OPERANT), que es el
 * sistema de registro único de aprobaciones de la plataforma. El espejo es
 * fuego y olvido: esta cola sigue siendo dueña de su estado y no espera a
 * nadie. Ver `services/hitlMirror.js` para por qué espejo y no cliente.
 */

const hitlMirror = require('./hitlMirror');

const DEFAULT_TTL_MS = parseInt(process.env.HITL_TTL_MS || '300000', 10); // 5 min

// Cuánto vale una aprobación ya concedida antes de caducar. Una aprobación
// eterna es una llave maestra: si un operador aprueba un comando hoy, ese
// permiso no puede seguir sirviendo dentro de una semana.
const APPROVAL_TTL_MS = parseInt(process.env.HITL_APPROVAL_TTL_MS || '900000', 10); // 15 min

/** jobId → job */
const jobs = new Map();

function _expireSweep(now) {
  for (const job of jobs.values()) {
    if (job.status === 'PENDING' && now > job.expiresAt) job.status = 'EXPIRED';
    // Una aprobación concedida y nunca usada también caduca.
    if (job.status === 'APPROVED' && job.approvedAtMs && now > job.approvedAtMs + APPROVAL_TTL_MS) {
      job.status = 'EXPIRED';
    }
  }
}

/** Submit a command for approval. Returns the pending job. */
function submit({ jobId, nodeId, command, params = {}, requestedBy, now = Date.now(), ttlMs = DEFAULT_TTL_MS }) {
  if (!jobId) throw new Error('jobId required');
  const job = {
    jobId, nodeId, command, params, requestedBy,
    status: 'PENDING',
    createdAt: new Date(now).toISOString(),
    expiresAt: now + ttlMs,
    approvedBy: null, decidedAt: null, ack: null,
  };
  jobs.set(jobId, job);
  const vista = publicView(job);
  hitlMirror.mirror(vista, 'pending');
  return vista;
}

/** Approve a pending job. Returns the job (caller then signs + publishes). */
function approve(jobId, approver, now = Date.now()) {
  const job = jobs.get(jobId);
  if (!job) return { error: 'not_found' };
  _expireSweep(now);
  if (job.status !== 'PENDING') return { error: `not_pending:${job.status}` };
  // Segregación de funciones: quien pide un comando crítico no puede ser quien
  // lo aprueba. Sin esto, un operador con permiso se autoconcede el permiso.
  if (approver && job.requestedBy && String(approver) === String(job.requestedBy)) {
    return { error: 'self_approval_forbidden' };
  }
  job.status = 'APPROVED';
  job.approvedBy = approver || null;
  job.decidedAt = new Date(now).toISOString();
  job.approvedAtMs = now;
  const vista = publicView(job);
  hitlMirror.mirror(vista, 'approved');
  return vista;
}

/**
 * Consume una aprobación APPROVED. Es de un solo uso: sin esto, un jobId
 * aprobado una vez podría reutilizarse indefinidamente para repetir la acción.
 * `expect` ata la aprobación a la acción concreta que se aprobó, para que un
 * permiso de un comando no valga para otro distinto.
 */
function consume(jobId, expect = {}, now = Date.now()) {
  const job = jobs.get(jobId);
  if (!job) return { error: 'not_found' };
  _expireSweep(now);
  if (job.status !== 'APPROVED') return { error: `not_approved:${job.status}` };
  if (!job.approvedBy) return { error: 'no_approver' };
  if (expect.command && job.command !== expect.command) {
    return { error: `command_mismatch:${job.command}` };
  }
  if (expect.requestedBy && job.requestedBy && String(job.requestedBy) !== String(expect.requestedBy)) {
    return { error: 'requester_mismatch' };
  }
  job.status = 'CONSUMED';
  job.consumedAt = new Date(now).toISOString();
  const vista = publicView(job);
  hitlMirror.mirror(vista, 'consumed');
  return vista;
}

function reject(jobId, approver, reason, now = Date.now()) {
  const job = jobs.get(jobId);
  if (!job) return { error: 'not_found' };
  if (job.status !== 'PENDING') return { error: `not_pending:${job.status}` };
  job.status = 'REJECTED';
  job.approvedBy = approver || null;
  job.reason = reason || null;
  job.decidedAt = new Date(now).toISOString();
  const vista = publicView(job);
  hitlMirror.mirror(vista, 'rejected');
  return vista;
}

/** Record the Edge's ACK for a dispatched command. */
function recordAck(jobId, ack) {
  const job = jobs.get(jobId);
  if (!job) return { error: 'not_found' };
  job.ack = ack;
  job.status = ack && ack.applied ? 'APPLIED' : (ack && ack.error ? 'FAILED' : job.status);
  return publicView(job);
}

function get(jobId) { const j = jobs.get(jobId); return j ? publicView(j) : null; }

function list(status, now = Date.now()) {
  _expireSweep(now);
  return [...jobs.values()].filter((j) => !status || j.status === status).map(publicView);
}

function publicView(j) {
  return {
    jobId: j.jobId, nodeId: j.nodeId, command: j.command, params: j.params,
    status: j.status, requestedBy: j.requestedBy, approvedBy: j.approvedBy,
    createdAt: j.createdAt, decidedAt: j.decidedAt, consumedAt: j.consumedAt || null,
    ack: j.ack, reason: j.reason,
  };
}

function _reset() { jobs.clear(); }

module.exports = { submit, approve, reject, consume, recordAck, get, list, _reset };
