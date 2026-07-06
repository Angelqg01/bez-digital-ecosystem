'use strict';

/** hitlQueue (Phase 5) — human-in-the-loop approval state machine. */

const hitl = require('../../services/hitlQueue');

beforeEach(() => hitl._reset());

const job = (over = {}) => ({ jobId: 'scada_1', nodeId: 'n1', command: 'SHED_LOAD', params: { durationMin: 30 }, requestedBy: 'u1', ...over });

test('submit creates a PENDING job', () => {
  const j = hitl.submit(job());
  expect(j.status).toBe('PENDING');
  expect(hitl.list('PENDING')).toHaveLength(1);
});

test('approve moves PENDING → APPROVED', () => {
  hitl.submit(job());
  const a = hitl.approve('scada_1', 'operator-1');
  expect(a.status).toBe('APPROVED');
  expect(a.approvedBy).toBe('operator-1');
});

test('cannot approve a non-pending job', () => {
  hitl.submit(job());
  hitl.approve('scada_1', 'op');
  expect(hitl.approve('scada_1', 'op')).toMatchObject({ error: 'not_pending:APPROVED' });
});

test('reject moves PENDING → REJECTED with reason', () => {
  hitl.submit(job());
  const r = hitl.reject('scada_1', 'op', 'unsafe grid state');
  expect(r.status).toBe('REJECTED');
  expect(r.reason).toBe('unsafe grid state');
});

test('approving an unknown job errors', () => {
  expect(hitl.approve('nope', 'op')).toMatchObject({ error: 'not_found' });
});

test('a job expires after its TTL', () => {
  const now = 1_000_000;
  hitl.submit({ ...job(), now, ttlMs: 1000 });
  const listed = hitl.list(undefined, now + 2000);
  expect(listed[0].status).toBe('EXPIRED');
});

test('recordAck attaches the Edge result and flips status to APPLIED', () => {
  hitl.submit(job());
  hitl.approve('scada_1', 'op');
  const updated = hitl.recordAck('scada_1', { jobId: 'scada_1', accepted: true, applied: true, write: { address: 42, value: 1 } });
  expect(updated.status).toBe('APPLIED');
  expect(updated.ack.write.address).toBe(42);
});

test('recordAck with an error flips status to FAILED', () => {
  hitl.submit(job());
  hitl.approve('scada_1', 'op');
  const updated = hitl.recordAck('scada_1', { jobId: 'scada_1', accepted: true, applied: false, error: 'write_failed' });
  expect(updated.status).toBe('FAILED');
});
