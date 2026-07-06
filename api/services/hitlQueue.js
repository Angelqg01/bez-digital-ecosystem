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
 */

const DEFAULT_TTL_MS = parseInt(process.env.HITL_TTL_MS || '300000', 10); // 5 min

/** jobId → job */
const jobs = new Map();

function _expireSweep(now) {
  for (const job of jobs.values()) {
    if (job.status === 'PENDING' && now > job.expiresAt) job.status = 'EXPIRED';
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
  return publicView(job);
}

/** Approve a pending job. Returns the job (caller then signs + publishes). */
function approve(jobId, approver, now = Date.now()) {
  const job = jobs.get(jobId);
  if (!job) return { error: 'not_found' };
  _expireSweep(now);
  if (job.status !== 'PENDING') return { error: `not_pending:${job.status}` };
  job.status = 'APPROVED';
  job.approvedBy = approver || null;
  job.decidedAt = new Date(now).toISOString();
  return publicView(job);
}

function reject(jobId, approver, reason, now = Date.now()) {
  const job = jobs.get(jobId);
  if (!job) return { error: 'not_found' };
  if (job.status !== 'PENDING') return { error: `not_pending:${job.status}` };
  job.status = 'REJECTED';
  job.approvedBy = approver || null;
  job.reason = reason || null;
  job.decidedAt = new Date(now).toISOString();
  return publicView(job);
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
    createdAt: j.createdAt, decidedAt: j.decidedAt, ack: j.ack, reason: j.reason,
  };
}

function _reset() { jobs.clear(); }

module.exports = { submit, approve, reject, recordAck, get, list, _reset };
