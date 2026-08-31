'use strict';

/**
 * hitlApprove — el guard de aprobación humana.
 *
 * Regresión de un fallo real: el guard daba por aprobada la acción si el propio
 * llamante enviaba `humanApproved: true` o la cabecera `x-human-approved: true`,
 * y solo exigía aprobación si el cliente declaraba necesitarla. Sobre rutas
 * SCADA / demand-response eso significaba no tener control ninguno.
 */

const { hitlApprove } = require('../../middleware/hitl');
const hitlQueue = require('../../services/hitlQueue');

beforeEach(() => hitlQueue._reset());

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

const reqOf = (over = {}) => ({
  headers: {},
  body: {},
  query: {},
  user: { userId: 'requester-1' },
  ...over,
});

test('la cabecera x-human-approved ya no concede paso', () => {
  const res = mockRes();
  const next = jest.fn();

  hitlApprove({ command: 'DEMAND_RESPONSE' })(
    reqOf({ headers: { 'x-human-approved': 'true' }, body: { requiresHumanApproval: true } }),
    res,
    next
  );

  expect(next).not.toHaveBeenCalled();
  expect(res.statusCode).toBe(428);
});

test('humanApproved en el body tampoco concede paso', () => {
  const res = mockRes();
  const next = jest.fn();

  hitlApprove({ command: 'DEMAND_RESPONSE' })(
    reqOf({ body: { humanApproved: true, requiresHumanApproval: true } }),
    res,
    next
  );

  expect(next).not.toHaveBeenCalled();
  expect(res.statusCode).toBe(428);
});

test('omitir requiresHumanApproval no salta el control', () => {
  const res = mockRes();
  const next = jest.fn();

  // Antes bastaba con no mandar el flag para que el guard hiciera next().
  hitlApprove({ command: 'DEMAND_RESPONSE' })(reqOf(), res, next);

  expect(next).not.toHaveBeenCalled();
  expect(res.statusCode).toBe(428);
  expect(res.body.code).toBe('HITL_PENDING');
  expect(res.body.job_id).toBeTruthy();
});

test('con una aprobación real de otro operador, pasa', () => {
  const first = mockRes();
  const next1 = jest.fn();
  const guard = hitlApprove({ command: 'DEMAND_RESPONSE' });

  guard(reqOf(), first, next1);
  const jobId = first.body.job_id;

  expect(hitlQueue.approve(jobId, 'operator-2').status).toBe('APPROVED');

  const second = mockRes();
  const next2 = jest.fn();
  guard(reqOf({ body: { approvalJobId: jobId } }), second, next2);

  expect(next2).toHaveBeenCalled();
  expect(second.statusCode).toBeNull();
});

test('la misma aprobación no sirve dos veces', () => {
  const first = mockRes();
  const guard = hitlApprove({ command: 'DEMAND_RESPONSE' });
  guard(reqOf(), first, jest.fn());
  const jobId = first.body.job_id;
  hitlQueue.approve(jobId, 'operator-2');

  guard(reqOf({ body: { approvalJobId: jobId } }), mockRes(), jest.fn());

  const replay = mockRes();
  const nextReplay = jest.fn();
  guard(reqOf({ body: { approvalJobId: jobId } }), replay, nextReplay);

  expect(nextReplay).not.toHaveBeenCalled();
  expect(replay.statusCode).toBe(428);
  expect(replay.body.reason).toBe('not_approved:CONSUMED');
});

test('el solicitante no puede aprobarse a sí mismo', () => {
  const first = mockRes();
  const guard = hitlApprove({ command: 'DEMAND_RESPONSE' });
  guard(reqOf({ user: { userId: 'requester-1' } }), first, jest.fn());
  const jobId = first.body.job_id;

  expect(hitlQueue.approve(jobId, 'requester-1')).toMatchObject({ error: 'self_approval_forbidden' });
});

test('una aprobación de otro comando no vale para este', () => {
  const guard = hitlApprove({ command: 'DEMAND_RESPONSE' });
  hitlQueue.submit({ jobId: 'otro', nodeId: 'n1', command: 'SHED_LOAD', requestedBy: 'u9' });
  hitlQueue.approve('otro', 'operator-2');

  const res = mockRes();
  const next = jest.fn();
  guard(reqOf({ body: { approvalJobId: 'otro' } }), res, next);

  expect(next).not.toHaveBeenCalled();
  expect(res.body.reason).toBe('command_mismatch:SHED_LOAD');
});
