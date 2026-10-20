const { crearAdminAutomation, CATALOG, cobertura } = require('../../services/adminAutomation');

const AHORA = Date.parse('2026-10-16T12:00:00Z');

/** query falsa: responde según un fragmento del SQL; guarda las escrituras. */
function fakeDb(respuestas = {}) {
    const escrituras = [];
    const query = jest.fn(async (sql, params) => {
        if (/INSERT INTO admin_automation_runs/.test(sql)) { escrituras.push(params); return { rows: [] }; }
        if (/FROM admin_automation_runs/.test(sql)) return { rows: respuestas.ultima ? [respuestas.ultima] : [] };
        for (const [frag, rows] of Object.entries(respuestas)) {
            if (frag !== 'ultima' && sql.includes(frag)) {
                if (rows instanceof Error) throw rows;
                return { rows };
            }
        }
        return { rows: [{ n: 0, usd: 0, desde: null }] };
    });
    return { query, escrituras };
}

function fakeOperant(extra = {}) {
    return {
        dispatchTask: jest.fn(async () => ({ taskId: 't_1', status: 'queued' })),
        resolveApproval: jest.fn(async () => ({ ok: true })),
        mailboxDmarc: jest.fn(async () => ({ reports: 3, messages: 20, fail: 0, failing: [], recommendation: {} })),
        tenantDashboard: jest.fn(async () => ({ tasks: [] })),
        auditVerify: jest.fn(async () => ({ valid: true })),
        kbIngest: jest.fn(async () => ({ ok: true })),
        funnel: jest.fn(async () => ({ pendingIntake: 0 })),
        marketingQueue: jest.fn(async () => ({ hold: false, posts: [] })),
        ...extra,
    };
}

const crear = ({ db = fakeDb(), operant = fakeOperant(), metricValues = async () => null, knowledgeStore } = {}) =>
    ({ svc: crearAdminAutomation({ query: db.query, operant, metricValues, knowledgeStore, now: () => AHORA }), db, operant });

describe('adminAutomation', () => {
    it('cada automatización cuelga de una sección del panel y de un departamento', () => {
        const secciones = ['identity', 'treasury', 'ecosystem', 'intelligence', 'obsidian', 'brainlive', 'watchdog', 'governance', 'skills'];
        for (const a of CATALOG) {
            expect(secciones).toContain(a.section);
            expect(a.department).toMatch(/^(sales|support|marketing|finance|hr|operations|legal|blockchain|treasury|fundraising)$/);
        }
        expect(new Set(CATALOG.map((a) => a.id)).size).toBe(CATALOG.length);
    });

    it('una señal con atención lanza la tarea al departamento y la registra con el actor', async () => {
        const db = fakeDb({ 'FROM plan_purchases': [{ n: 2, desde: '2026-10-15T00:00:00Z' }] });
        const { svc, operant } = crear({ db });
        const r = await svc.ejecutar('pending-plan-assignments', { actor: '0xabc' });
        expect(r).toMatchObject({ status: 'dispatched', taskId: 't_1', department: 'support' });
        expect(operant.dispatchTask).toHaveBeenCalledWith(expect.objectContaining({
            department: 'support', async: true, context: expect.objectContaining({ automationId: 'pending-plan-assignments', section: 'ecosystem' }),
        }));
        expect(operant.dispatchTask.mock.calls[0][0].input).toMatch(/2 compra/);
        expect(db.escrituras).toHaveLength(1);
        expect(db.escrituras[0][3]).toBe('0xabc');
    });

    it('sin necesidad no gasta una tarea (salvo force)', async () => {
        const { svc, operant } = crear();
        expect((await svc.ejecutar('pending-plan-assignments', { actor: 'a' })).status).toBe('skipped');
        expect(operant.dispatchTask).not.toHaveBeenCalled();
        expect((await svc.ejecutar('pending-plan-assignments', { actor: 'a', force: true })).status).toBe('dispatched');
    });

    it('la misma señal no crea la misma tarea dos veces durante el enfriamiento', async () => {
        const { createHash } = require('crypto');
        const fp = createHash('sha256').update(JSON.stringify({ n: 2 })).digest('hex');
        const db = fakeDb({
            'FROM plan_purchases': [{ n: 2, desde: '2026-10-15T00:00:00Z' }],
            ultima: { status: 'dispatched', task_id: 't_0', fingerprint: fp, created_at: new Date(AHORA - 3_600_000).toISOString() },
        });
        const { svc, operant } = crear({ db });
        const r = await svc.ejecutar('pending-plan-assignments', { actor: 'scheduler' });
        expect(r).toMatchObject({ status: 'duplicate', taskId: 't_0' });
        expect(operant.dispatchTask).not.toHaveBeenCalled();
    });

    it('si la señal cambia (otra huella) sí vuelve a lanzar', async () => {
        const db = fakeDb({
            'FROM plan_purchases': [{ n: 5, desde: '2026-10-15T00:00:00Z' }],
            ultima: { status: 'dispatched', task_id: 't_0', fingerprint: 'otra', created_at: new Date(AHORA - 3_600_000).toISOString() },
        });
        const { svc } = crear({ db });
        expect((await svc.ejecutar('pending-plan-assignments', { actor: 's' })).status).toBe('dispatched');
    });

    it('sin tabla de registro NO lanza (ni con force): se duplicaría en cada tick y no habría auditoría', async () => {
        const err = Object.assign(new Error('x'), { code: '42P01' });
        const db = fakeDb({ 'FROM plan_purchases': [{ n: 2, desde: '2026-10-15T00:00:00Z' }] });
        const base = db.query.getMockImplementation();
        db.query.mockImplementation(async (sql, p) => { if (/FROM admin_automation_runs/.test(sql)) throw err; return base(sql, p); });
        const { svc, operant } = crear({ db });
        for (const force of [false, true]) {
            const r = await svc.ejecutar('pending-plan-assignments', { actor: 's', force });
            expect(r.status).toBe('unavailable');
            expect(r.reason).toMatch(/068/);
        }
        expect(operant.dispatchTask).not.toHaveBeenCalled();
    });

    it('una señal que no se puede medir se declara no disponible, nunca "todo bien"', async () => {
        const err = Object.assign(new Error('x'), { code: '42P01' });
        const db = fakeDb({ 'FROM gateway_subscriptions': err });
        const { svc, operant } = crear({ db });
        const r = await svc.ejecutar('past-due-subscriptions', { actor: 's' });
        expect(r.status).toBe('unavailable');
        expect(r.reason).toMatch(/42P01/);
        expect(operant.dispatchTask).not.toHaveBeenCalled();
    });

    it('RAG: con muestra pequeña no actúa; con mucha laguna sí, y la tarea no lleva texto de usuarios', async () => {
        const chico = crear({ metricValues: async () => [{ labels: { resultado: 'none' }, value: 5 }] });
        expect((await chico.svc.ejecutar('rag-coverage', { actor: 's' })).status).toBe('skipped');

        const valores = [{ labels: { resultado: 'hit' }, value: 60 }, { labels: { resultado: 'weak' }, value: 25 }, { labels: { resultado: 'none' }, value: 15 }];
        const grande = crear({ metricValues: async () => valores });
        const r = await grande.svc.ejecutar('rag-coverage', { actor: 's' });
        expect(r.status).toBe('dispatched');
        expect(grande.operant.dispatchTask.mock.calls[0][0].input).toMatch(/40\.0%/);
    });

    it('DMARC y fallos de OPERANT usan el puente y solo mandan cifras', async () => {
        const operant = fakeOperant({
            mailboxDmarc: jest.fn(async () => ({ reports: 5, messages: 100, fail: 4, policy: 'quarantine', failing: [{ label: '52.212.19.177', sourceIp: '52.212.19.177', fail: 4 }], recommendation: { text: 'revisar' } })),
            tenantDashboard: jest.fn(async () => ({ tasks: [{ id: 't1', department: 'sales', type: 'x', status: 'failed' }, { id: 't2', status: 'completed' }] })),
        });
        const { svc } = crear({ operant });
        const d = await svc.ejecutar('dmarc-health', { actor: 's' });
        expect(d.status).toBe('dispatched');
        expect(operant.dispatchTask.mock.calls[0][0].input).toMatch(/52\.212\.19\.177/);
        const f = await svc.ejecutar('operant-failures', { actor: 's' });
        expect(f.status).toBe('dispatched');
    });

    it('tick recorre todo el catálogo y un fallo no corta el resto', async () => {
        const operant = fakeOperant({ auditVerify: jest.fn(async () => { throw new Error('caído'); }) });
        const { svc } = crear({ operant });
        const res = await svc.tick();
        expect(res).toHaveLength(CATALOG.length);
        expect(res.find((x) => x.id === 'audit-chain').status).toBe('unavailable');
    });

    it('resolver una aprobación exige approve/reject y deja constancia del admin', async () => {
        const { svc, operant, db } = crear();
        await expect(svc.resolverAprobacion({ approvalId: 'a1', decision: 'quizas', actor: 'x' })).rejects.toThrow(/approve o reject/);
        await svc.resolverAprobacion({ approvalId: 'a1', decision: 'approve', reason: 'ok', actor: '0xabc' });
        expect(operant.resolveApproval).toHaveBeenCalledWith(expect.objectContaining({ approvalId: 'a1', decision: 'approve', approver: 'admin:0xabc' }));
        expect(db.escrituras[0]).toEqual(expect.arrayContaining(['resolve', '0xabc', 'approve']));
    });

    it('sincroniza solo documentación PÚBLICA y global al conocimiento de OPERANT', async () => {
        const chunks = [
            { document_id: 'planes', tenant_id: null, classification: 'PUBLIC', status: 'published', title: 'Planes', chunk_index: 1, content: 'segunda' },
            { document_id: 'planes', tenant_id: null, classification: 'PUBLIC', status: 'published', title: 'Planes', chunk_index: 0, content: 'primera' },
            { document_id: 'interno', tenant_id: null, classification: 'INTERNAL', status: 'published', title: 'Interno', chunk_index: 0, content: 'secreto' },
            { document_id: 'org', tenant_id: 'org:1', classification: 'PUBLIC', status: 'published', title: 'De un cliente', chunk_index: 0, content: 'cliente' },
            { document_id: 'cuarentena', tenant_id: null, classification: 'PUBLIC', status: 'quarantined', title: 'Q', chunk_index: 0, content: 'x' },
        ];
        const { svc, operant } = crear({ knowledgeStore: { chunksVisibles: async () => chunks } });
        const r = await svc.sincronizarConocimiento({ actor: 'a' });
        expect(r).toMatchObject({ documentos: 1, enviados: 1, fallos: [] });
        expect(operant.kbIngest).toHaveBeenCalledTimes(1);
        expect(operant.kbIngest.mock.calls[0][0]).toMatchObject({ id: 'rag:planes', title: 'Planes', body: 'primera\n\nsegunda' });
    });

    describe('departamentos adicionales', () => {
        it('ventas: solo actúa con una cola de 5 o más leads', async () => {
            const poca = crear({ operant: fakeOperant({ funnel: jest.fn(async () => ({ pendingIntake: 3 })) }) });
            expect((await poca.svc.ejecutar('sales-intake-backlog', { actor: 's' })).status).toBe('skipped');
            const mucha = crear({ operant: fakeOperant({ funnel: jest.fn(async () => ({ pendingIntake: 12 })) }) });
            const r = await mucha.svc.ejecutar('sales-intake-backlog', { actor: 's' });
            expect(r).toMatchObject({ status: 'dispatched', department: 'sales' });
            expect(mucha.operant.dispatchTask.mock.calls[0][0].input).toMatch(/12 leads/);
        });

        it('marketing: solo cuentan los borradores sin aprobar que tocan en menos de 24 h', async () => {
            const h = 3_600_000;
            const posts = [
                { id: 'a', state: 'draft', network: 'linkedin', scheduledFor: AHORA + 5 * h },
                { id: 'b', state: 'draft', network: 'x', scheduledFor: AHORA + 72 * h },
                { id: 'c', state: 'approved', network: 'x', scheduledFor: AHORA + 2 * h },
            ];
            const { svc, operant } = crear({ operant: fakeOperant({ marketingQueue: jest.fn(async () => ({ hold: false, posts })) }) });
            const r = await svc.ejecutar('marketing-drafts-due', { actor: 's' });
            expect(r.status).toBe('dispatched');
            expect(operant.dispatchTask.mock.calls[0][0].input).toMatch(/1 borrador/);
        });

        it('validadores: antes de las 12:00 UTC "no ha latido hoy" no cuenta; una penalización sí', async () => {
            const db = fakeDb({ 'FROM (SELECT DISTINCT operator': [{ n: 4 }], 'FROM validator_slashes': [{ n: 0 }] });
            const manana = crearAdminAutomation({ query: db.query, operant: fakeOperant(), metricValues: async () => null, now: () => Date.parse('2026-10-16T08:00:00Z') });
            expect((await manana.ejecutar('validators-silent', { actor: 's' })).status).toBe('skipped');

            const tarde = crearAdminAutomation({ query: db.query, operant: fakeOperant(), metricValues: async () => null, now: () => Date.parse('2026-10-16T15:00:00Z') });
            expect((await tarde.ejecutar('validators-silent', { actor: 's' })).status).toBe('dispatched');

            const db2 = fakeDb({ 'FROM (SELECT DISTINCT operator': [{ n: 0 }], 'FROM validator_slashes': [{ n: 2 }] });
            const pena = crearAdminAutomation({ query: db2.query, operant: fakeOperant(), metricValues: async () => null, now: () => Date.parse('2026-10-16T08:00:00Z') });
            expect((await pena.ejecutar('validators-silent', { actor: 's' })).status).toBe('dispatched');
        });

        it('tesorería: movimientos atascados más de 24 h generan una tarea de solo análisis', async () => {
            const db = fakeDb({ 'FROM tx_intents': [{ status: 'awaiting_approval', n: 2, desde: new Date(AHORA - 40 * 3_600_000).toISOString() }] });
            const { svc, operant } = crear({ db });
            const r = await svc.ejecutar('treasury-intents-stuck', { actor: 's' });
            expect(r).toMatchObject({ status: 'dispatched', department: 'treasury' });
            expect(operant.dispatchTask.mock.calls[0][0].input).toMatch(/no apruebes ni ejecutes/i);
        });
    });

    describe('RR.HH. y fundraising', () => {
        const DIAS = 86_400_000;
        const conUltima = (id, haceDias, extra = {}) => fakeDb({
            ultima: { status: 'dispatched', task_id: 't_0', fingerprint: 'x', created_at: new Date(AHORA - haceDias * DIAS).toISOString() },
            ...extra,
        });

        it('invitaciones de equipo: solo las de más de 14 días, por rol y sin datos personales', async () => {
            const db = fakeDb({ "status = 'invited'": [{ role: 'developer', n: 2 }, { role: 'admin', n: 1 }] });
            const { svc, operant } = crear({ db });
            const r = await svc.ejecutar('team-invitations-stalled', { actor: 's' });
            expect(r).toMatchObject({ status: 'dispatched', department: 'hr' });
            const input = operant.dispatchTask.mock.calls[0][0].input;
            expect(input).toMatch(/3 invitación/);
            expect(input).not.toMatch(/@/);
        });

        it('revisión de accesos: nunca hecha o de hace más de 90 días → actúa; reciente → no', async () => {
            const miembros = { 'FROM organization_members GROUP BY': [{ status: 'active', role: 'owner', n: 2 }, { status: 'active', role: 'developer', n: 5 }, { status: 'invited', role: 'admin', n: 1 }] };
            const nunca = crear({ db: fakeDb(miembros) });
            const r0 = await nunca.svc.ejecutar('access-review-due', { actor: 's' });
            expect(r0.status).toBe('dispatched');
            expect(nunca.operant.dispatchTask.mock.calls[0][0].input).toMatch(/2 miembro\(s\) con rol owner o admin activo/);

            const vieja = crear({ db: conUltima('access-review-due', 100, miembros) });
            expect((await vieja.svc.ejecutar('access-review-due', { actor: 's' })).status).toBe('dispatched');
            const reciente = crear({ db: conUltima('access-review-due', 20, miembros) });
            expect((await reciente.svc.ejecutar('access-review-due', { actor: 's' })).status).toBe('skipped');
        });

        it('informe a inversores: usa solo métricas medidas y le dice a la tarea lo que NO se pudo medir', async () => {
            const err = Object.assign(new Error('x'), { code: '42P01' });
            const db = fakeDb({
                "FROM gateway_subscriptions WHERE status = 'active'": [{ n: 12 }],
                'FROM plan_purchases WHERE created_at': [{ n: 4 }],
                'FROM validator_heartbeats WHERE day >=': [{ n: 7 }],
                "type = 'buy'": err,
            });
            const { svc, operant } = crear({ db });
            const r = await svc.ejecutar('investor-update-due', { actor: 's' });
            expect(r.status).toBe('dispatched');
            const input = operant.dispatchTask.mock.calls[0][0].input;
            expect(input).toMatch(/"suscripcionesActivas":12/);
            expect(input).toMatch(/NO se pudieron medir: comprasBez30d, importeBez30dUsd/);
            expect(input).toMatch(/no lo rellenes ni lo estimes/);
            expect(input).toMatch(/el token es utilidad, no inversión/);
        });

        it('informe a inversores: sin ninguna métrica no hay informe; reciente, tampoco', async () => {
            const err = Object.assign(new Error('x'), { code: '42P01' });
            const roto = fakeDb({ 'FROM gateway_subscriptions': err, 'FROM plan_purchases': err, 'FROM validator_heartbeats': err, 'FROM payment_transactions': err });
            expect((await crear({ db: roto }).svc.ejecutar('investor-update-due', { actor: 's' })).status).toBe('unavailable');

            const reciente = crear({ db: conUltima('investor-update-due', 10) });
            expect((await reciente.svc.ejecutar('investor-update-due', { actor: 's' })).status).toBe('skipped');
        });

        it('si no se puede leer el registro, las revisiones periódicas no actúan', async () => {
            const err = Object.assign(new Error('x'), { code: '42P01' });
            const db = fakeDb();
            const base = db.query.getMockImplementation();
            db.query.mockImplementation(async (sql, p) => { if (/FROM admin_automation_runs/.test(sql)) throw err; return base(sql, p); });
            const { svc, operant } = crear({ db });
            for (const id of ['access-review-due', 'investor-update-due']) {
                expect((await svc.ejecutar(id, { actor: 's' })).status).toBe('unavailable');
            }
            expect(operant.dispatchTask).not.toHaveBeenCalled();
        });
    });

    describe('cobertura por departamento', () => {
        it('los 10 departamentos de OPERANT tienen al menos una señal propia', () => {
            const c = cobertura();
            expect(c).toHaveLength(10);
            expect(c.filter((x) => !x.covered)).toEqual([]);
            for (const x of c) expect(x.automations.length).toBeGreaterThan(0);
        });

        it('todo departamento de una automatización existe en OPERANT', () => {
            const validos = cobertura().map((x) => x.department);
            for (const a of CATALOG) expect(validos).toContain(a.department);
        });
    });
});
