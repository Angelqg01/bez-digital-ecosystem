const request = require('supertest');
const jwt = require('jsonwebtoken');
const { makeAdminToken } = require('../helpers');

// El puente a OPERANT se simula entero: aquí se prueba la puerta de admin y el
// reparto de errores, no el runtime de OPERANT.
jest.mock('../../services/operantBridge', () => {
    class OperantUnavailableError extends Error {}
    class OperantError extends Error {
        constructor(status, body) { super(body?.error || 'x'); this.status = status; this.body = body; }
    }
    return {
        OperantUnavailableError,
        OperantError,
        configured: jest.fn(() => true),
        health: jest.fn(async () => ({ available: true, circuit: 'closed' })),
        tenantDashboard: jest.fn(async () => ({ tenantId: 'bezhas', plan: 'enterprise' })),
        listApprovals: jest.fn(async () => ({ approvals: [] })),
        auditVerify: jest.fn(async () => ({ valid: true })),
        mailboxList: jest.fn(async () => ({ total: 1, messages: [{ uid: 7 }] })),
        mailboxGet: jest.fn(async () => ({ uid: 7, text: 'hola' })),
        mailboxDmarc: jest.fn(async () => ({ reports: 2, messages: 10, pass: 10, fail: 0, failing: [], recommendation: {} })),
        dispatchTask: jest.fn(async () => ({ taskId: 't_9' })),
        resolveApproval: jest.fn(async () => ({ ok: true })),
        kbIngest: jest.fn(async () => ({ ok: true })),
    };
});
const bridge = require('../../services/operantBridge');
const app = require('../../index');

const superAdmin = () => jwt.sign(
    { role: 'SUPER_ADMIN', wallet: '0x' + '1'.repeat(40), method: 'credentials' },
    process.env.JWT_SECRET,
    { expiresIn: '2h', issuer: 'bezhas-admin-auth' },
);
const auth = (r) => r.set('Authorization', `Bearer ${superAdmin()}`);

describe('Routes: /api/admin/operant (solo lectura)', () => {
    afterEach(() => jest.clearAllMocks());

    describe('sin sesión SuperAdmin', () => {
        it.each(['/status', '/overview', '/approvals', '/audit/verify', '/mailbox', '/mailbox/7', '/mailbox/dmarc'])(
            'rechaza GET %s sin token', async (ruta) => {
                const res = await request(app).get(`/api/admin/operant${ruta}`);
                expect(res.status).toBe(401);
                expect(bridge.tenantDashboard).not.toHaveBeenCalled();
                expect(bridge.mailboxList).not.toHaveBeenCalled();
            });

        it('rechaza un JWT de usuario con role admin (otro emisor)', async () => {
            const res = await request(app).get('/api/admin/operant/mailbox')
                .set('Authorization', `Bearer ${makeAdminToken()}`);
            expect(res.status).toBe(401);
            expect(bridge.mailboxList).not.toHaveBeenCalled();
        });
    });

    describe('con sesión SuperAdmin', () => {
        it('status: salud del runtime', async () => {
            const res = await auth(request(app).get('/api/admin/operant/status'));
            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({ configured: true, tenantId: 'bezhas', runtime: { available: true } });
        });

        it('overview y approvals usan SIEMPRE el tenant de la empresa', async () => {
            await auth(request(app).get('/api/admin/operant/overview').query({ tenantId: 'cliente-ajeno' }));
            await auth(request(app).get('/api/admin/operant/approvals').query({ tenantId: 'cliente-ajeno' }));
            expect(bridge.tenantDashboard).toHaveBeenCalledWith({ tenantId: 'bezhas' });
            expect(bridge.listApprovals).toHaveBeenCalledWith({ tenantId: 'bezhas' });
        });

        it('mailbox: reenvía filtros y no deja elegir tenant', async () => {
            const res = await auth(request(app).get('/api/admin/operant/mailbox')
                .query({ q: 'dmarc', sort: 'unread', limit: '30', offset: '30', tenantId: 'otro' }));
            expect(res.status).toBe(200);
            expect(bridge.mailboxList).toHaveBeenCalledWith(expect.objectContaining({
                tenantId: 'bezhas', q: 'dmarc', sort: 'unread', limit: '30', offset: '30',
            }));
        });

        it('mailbox/:uid abre un correo', async () => {
            const res = await auth(request(app).get('/api/admin/operant/mailbox/7'));
            expect(res.body).toMatchObject({ uid: 7, text: 'hola' });
        });

        it('mailbox/dmarc es el digest (no un uid) y usa el tenant de la empresa', async () => {
            const res = await auth(request(app).get('/api/admin/operant/mailbox/dmarc').query({ days: '14', tenantId: 'otro' }));
            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({ reports: 2, fail: 0 });
            expect(bridge.mailboxDmarc).toHaveBeenCalledWith({ tenantId: 'bezhas', days: '14' });
            expect(bridge.mailboxGet).not.toHaveBeenCalled();
        });

        it('no expone escrituras sobre el buzón ni tareas libres', async () => {
            for (const ruta of ['/approvals/1', '/mailbox/7/seen', '/tasks']) {
                const res = await auth(request(app).post(`/api/admin/operant${ruta}`).send({}));
                expect([404, 405]).toContain(res.status);
            }
        });
    });

    describe('errores del puente', () => {
        it('OPERANT caído → 503, no un panel vacío', async () => {
            bridge.tenantDashboard.mockRejectedValueOnce(new bridge.OperantUnavailableError('circuito abierto'));
            const res = await auth(request(app).get('/api/admin/operant/overview'));
            expect(res.status).toBe(503);
            expect(res.body.code).toBe('OPERANT_UNAVAILABLE');
        });

        it('buzón sin configurar conserva su código', async () => {
            bridge.mailboxList.mockRejectedValueOnce(new bridge.OperantError(503, { error: 'buzón sin configurar', code: 'mailbox_not_configured' }));
            const res = await auth(request(app).get('/api/admin/operant/mailbox'));
            expect(res.status).toBe(503);
            expect(res.body.code).toBe('mailbox_not_configured');
        });

        it('un 401/403 de OPERANT no se reenvía como si fuera la sesión del admin', async () => {
            bridge.listApprovals.mockRejectedValueOnce(new bridge.OperantError(401, { error: 'x' }));
            const res = await auth(request(app).get('/api/admin/operant/approvals'));
            expect(res.status).toBe(502);
        });
    });

    describe('automatizaciones (escrituras)', () => {
        const escribe = (r) => auth(r).set('x-bezhas-admin', '1');

        it('GET /automations lista el catálogo con su señal y no lanza nada', async () => {
            const res = await auth(request(app).get('/api/admin/operant/automations'));
            expect(res.status).toBe(200);
            const ids = res.body.automations.map((a) => a.id);
            expect(ids).toEqual(expect.arrayContaining(['pending-plan-assignments', 'rag-coverage', 'dmarc-health', 'audit-chain']));
            expect(bridge.dispatchTask).not.toHaveBeenCalled();
        });

        it.each(['/automations/dmarc-health/run', '/approvals/a1/resolve', '/knowledge/sync'])(
            'rechaza POST %s sin la cabecera x-bezhas-admin', async (ruta) => {
                const res = await auth(request(app).post(`/api/admin/operant${ruta}`).send({ decision: 'approve' }));
                expect(res.status).toBe(403);
                expect(res.body.code).toBe('ADMIN_HEADER_REQUIRED');
                expect(bridge.dispatchTask).not.toHaveBeenCalled();
                expect(bridge.resolveApproval).not.toHaveBeenCalled();
            });

        it('rechaza escrituras sin sesión aunque lleven la cabecera', async () => {
            const res = await request(app).post('/api/admin/operant/automations/dmarc-health/run').set('x-bezhas-admin', '1').send({});
            expect(res.status).toBe(401);
        });

        it('run con force lanza la tarea y devuelve su id', async () => {
            const res = await escribe(request(app).post('/api/admin/operant/automations/dmarc-health/run').send({ force: true }));
            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({ status: 'dispatched', taskId: 't_9', department: 'operations' });
        });

        it('automatización desconocida → 404', async () => {
            const res = await escribe(request(app).post('/api/admin/operant/automations/inventada/run').send({}));
            expect(res.status).toBe(404);
        });

        it('resolver aprobación: valida la decisión y usa al admin como aprobador', async () => {
            const mala = await escribe(request(app).post('/api/admin/operant/approvals/a1/resolve').send({ decision: 'quizas' }));
            expect(mala.status).toBe(400);
            const ok = await escribe(request(app).post('/api/admin/operant/approvals/a1/resolve').send({ decision: 'reject', reason: 'no procede' }));
            expect(ok.status).toBe(200);
            expect(bridge.resolveApproval).toHaveBeenCalledWith(expect.objectContaining({
                tenantId: 'bezhas', approvalId: 'a1', decision: 'reject', approver: expect.stringMatching(/^admin:/),
            }));
        });

        describe('tick del programador', () => {
            const TOKEN = 'x'.repeat(40);
            afterEach(() => { delete process.env.ADMIN_AUTOMATION_TOKEN; delete process.env.ADMIN_AUTOMATION_ENABLED; });

            it('sin token configurado, la puerta del programador está cerrada', async () => {
                const res = await request(app).post('/api/admin/operant/automations/tick').set('x-automation-token', TOKEN);
                expect(res.status).toBe(401);
                expect(res.body.code).toBe('AUTOMATION_TOKEN_INVALID');
            });

            it('con el token correcto evalúa el catálogo entero', async () => {
                process.env.ADMIN_AUTOMATION_TOKEN = TOKEN;
                const res = await request(app).post('/api/admin/operant/automations/tick').set('x-automation-token', TOKEN);
                expect(res.status).toBe(200);
                expect(res.body.results.length).toBeGreaterThanOrEqual(8);
            });

            it('un token distinto no vale y un token corto nunca vale', async () => {
                process.env.ADMIN_AUTOMATION_TOKEN = TOKEN;
                expect((await request(app).post('/api/admin/operant/automations/tick').set('x-automation-token', 'y'.repeat(40))).status).toBe(401);
                process.env.ADMIN_AUTOMATION_TOKEN = 'corto';
                expect((await request(app).post('/api/admin/operant/automations/tick').set('x-automation-token', 'corto')).status).toBe(401);
            });

            it('sin token ni sesión admin → 401', async () => {
                expect((await request(app).post('/api/admin/operant/automations/tick')).status).toBe(401);
            });

            it('ADMIN_AUTOMATION_ENABLED=false lo apaga', async () => {
                process.env.ADMIN_AUTOMATION_TOKEN = TOKEN;
                process.env.ADMIN_AUTOMATION_ENABLED = 'false';
                const res = await request(app).post('/api/admin/operant/automations/tick').set('x-automation-token', TOKEN);
                expect(res.status).toBe(503);
                expect(res.body.code).toBe('AUTOMATION_DISABLED');
            });
        });
    });
});
