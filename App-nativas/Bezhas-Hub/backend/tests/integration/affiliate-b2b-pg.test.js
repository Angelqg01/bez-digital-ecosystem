/**
 * Afiliados y leads B2B sobre un Postgres REAL (migraciones 008, 009 y 022). Se salta sin base de pruebas:
 *
 *   docker run -d --name pgtest -e POSTGRES_PASSWORD=test -e POSTGRES_DB=t -p 54330:5432 postgres:16-alpine
 *   HUB_TEST_PG_URL=postgres://postgres:test@localhost:54330/t pnpm exec jest --env=node tests/integration/affiliate-b2b-pg.test.js
 *
 * Hace DROP SCHEMA public CASCADE: usar SÓLO una base desechable.
 */
const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');

const URL = process.env.HUB_TEST_PG_URL;
const d = URL ? describe : describe.skip;
const sql = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'db', 'migrations', f), 'utf8');

d('afiliados y leads B2B sobre Postgres', () => {
    let pg; let User; let AffiliateEvent; let B2BLead; let app; let ana; let beto; let usuarioActual; let outbound;

    beforeAll(async () => {
        process.env.POSTGRES_URL = URL;
        jest.resetModules();
        jest.doMock('../../middleware/auth.middleware', () => ({ protect: (req, _res, next) => { req.user = usuarioActual; req.log = { error: () => {} }; next(); } }));
        jest.doMock('../../services/feedback-loop.service', () => ({ log: jest.fn().mockResolvedValue(true) }));
        pg = require('../../db/pool');
        await pg.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
        await pg.query(sql('008_logistics_bridge_fiat.sql'));
        await pg.query(sql('009_core_users.sql'));
        await pg.query(sql('022_affiliate_events_b2b_leads.sql'));
        await pg.query(sql('022_affiliate_events_b2b_leads.sql')); // idempotente
        User = require('../../models/pg/User');
        AffiliateEvent = require('../../models/pg/AffiliateEvent');
        B2BLead = require('../../models/pg/B2BLead');
        outbound = require('../../services/outbound-messaging.service');
        const mk = async (n) => (await pg.query('INSERT INTO users (username, email) VALUES ($1,$2) RETURNING *', [n, `${n}@x.io`])).rows[0];
        ana = await mk('ana'); beto = await mk('beto');
        app = express();
        app.use(express.json());
        app.use('/api/affiliate', require('../../routes/affiliate.routes'));
    });
    afterAll(async () => { await pg.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;'); });

    describe('afiliados', () => {
        it('genera el código de referido una vez y lo mantiene, también con peticiones simultáneas', async () => {
            usuarioActual = { _id: ana.id };
            const resp = await Promise.all(Array.from({ length: 6 }, () => request(app).get('/api/affiliate/me')));
            const codigos = new Set(resp.map((r) => r.body.referralCode));
            expect(resp.every((r) => r.status === 200)).toBe(true);
            expect(codigos.size).toBe(1);
            const [codigo] = codigos;
            expect(codigo).toMatch(/^[a-z0-9]{10}$/);
            expect(resp[0].body.referralLink).toBe(`https://bezhas.com/join/${codigo}`);
            expect((await request(app).get('/api/affiliate/me')).body.referralCode).toBe(codigo);
            expect((await pg.query('SELECT affiliate_referral_code FROM users WHERE id = $1', [ana.id])).rows[0].affiliate_referral_code).toBe(codigo);
        });

        it('cada usuario tiene su código y un usuario inexistente da 404', async () => {
            usuarioActual = { _id: beto.id };
            const b = await request(app).get('/api/affiliate/me');
            usuarioActual = { _id: ana.id };
            const a = await request(app).get('/api/affiliate/me');
            expect(b.body.referralCode).not.toBe(a.body.referralCode);
            usuarioActual = { _id: '00000000-0000-4000-8000-000000000000' };
            expect((await request(app).get('/api/affiliate/me')).status).toBe(404);
        });

        it('cuenta clics y registros y pagina el historial sólo del afiliado', async () => {
            for (let i = 0; i < 3; i += 1) await AffiliateEvent.record({ referrerId: ana.id, eventType: 'click', ipAddress: '1.2.3.4', referralCodeUsed: 'abc' });
            await AffiliateEvent.record({ referrerId: ana.id, referredId: beto.id, eventType: 'signup' });
            await AffiliateEvent.record({ referrerId: beto.id, eventType: 'click' });
            usuarioActual = { _id: ana.id };
            expect((await request(app).get('/api/affiliate/me')).body.stats).toEqual({ clicks: 3, signups: 1 });
            const p1 = await request(app).get('/api/affiliate/history?page=1&limit=3');
            expect(p1.body.history).toHaveLength(3);
            expect(p1.body.pagination).toEqual({ currentPage: 1, totalPages: 2, totalEvents: 4 });
            const p2 = await request(app).get('/api/affiliate/history?page=2&limit=3');
            expect(p2.body.history).toHaveLength(1);
            expect(p2.body.history.every((e) => e.referrerId === ana.id)).toBe(true);
            expect((await request(app).get('/api/affiliate/history?limit=500')).status).toBe(400);
        });

        it('rechaza un tipo de evento inválido y borra los eventos con el usuario', async () => {
            await expect(AffiliateEvent.record({ referrerId: ana.id, eventType: 'hack' })).rejects.toThrow(/inválido/);
            const tmp = (await pg.query("INSERT INTO users (username, email) VALUES ('t','t@x.io') RETURNING id")).rows[0].id;
            await AffiliateEvent.record({ referrerId: tmp, eventType: 'click' });
            await pg.query('DELETE FROM users WHERE id = $1', [tmp]);
            expect((await pg.query('SELECT 1 FROM affiliate_events WHERE referrer_id = $1', [tmp])).rowCount).toBe(0);
        });
    });

    describe('leads B2B y envío con aprobación', () => {
        const borrador = (extra = {}) => ({ sector: 'logística', companyName: 'Acme SL', url: 'https://acme.test', type: 'B2B', contactEmail: ' Ventas@ACME.test ', score: 140, scoreReasons: ['sector'], ...extra });

        it('crea borradores pendientes de aprobación: email en minúsculas y score acotado a 0-100', async () => {
            const [lead, wa] = await outbound.createApprovalDrafts([borrador(), borrador({ companyName: 'Zeta', whatsappNumber: '+34600' })], 'camp-1');
            expect(lead).toMatchObject({ status: 'needs_approval', contactEmail: 'ventas@acme.test', score: 100, campaignId: 'camp-1' });
            expect(lead.outreach).toMatchObject({ channel: 'email', status: 'needs_approval' });
            expect(wa.outreach.channel).toBe('whatsapp');
        });

        it('un canal sin conector queda BLOQUEADO y no se envía nada', async () => {
            const [lead] = await outbound.createApprovalDrafts([borrador({ whatsappNumber: '+34611' })], 'camp-2');
            const spy = jest.spyOn(outbound, 'sendEmail');
            const r = await outbound.approveAndSendLead(lead.id, 'yoel');
            expect(r).toMatchObject({ success: false, blocked: true });
            expect(spy).not.toHaveBeenCalled();
            const final = await B2BLead.findById(lead.id);
            expect(final).toMatchObject({ status: 'blocked' });
            expect(final.outreach).toMatchObject({ status: 'blocked', approvedBy: 'yoel' });
            spy.mockRestore();
        });

        it('aprobaciones simultáneas: el mensaje se envía UNA sola vez', async () => {
            const [lead] = await outbound.createApprovalDrafts([borrador()], 'camp-3');
            const envio = jest.spyOn(outbound, 'sendMessage').mockImplementation(async () => { await new Promise((r) => setTimeout(r, 30)); return { success: true, providerMessageId: 'prov-1' }; });
            const resp = await Promise.all(Array.from({ length: 6 }, (_, i) => outbound.approveAndSendLead(lead.id, `admin-${i}`)));
            expect(envio).toHaveBeenCalledTimes(1);
            expect(resp.filter((r) => r.success)).toHaveLength(1);
            expect(resp.filter((r) => /not pending approval/.test(r.error || ''))).toHaveLength(5);
            const final = await B2BLead.findById(lead.id);
            expect(final).toMatchObject({ status: 'sent' });
            expect(final.outreach).toMatchObject({ status: 'sent', providerMessageId: 'prov-1' });
            expect(final.outreach.sentAt).toBeInstanceOf(Date);
            envio.mockRestore();
        });

        it('un fallo de envío deja el lead en failed con el error, y un lead enviado no se reenvía', async () => {
            const [lead] = await outbound.createApprovalDrafts([borrador()], 'camp-4');
            const envio = jest.spyOn(outbound, 'sendMessage').mockResolvedValue({ success: false, error: 'SMTP caído' });
            await outbound.approveAndSendLead(lead.id);
            expect((await B2BLead.findById(lead.id)).outreach).toMatchObject({ status: 'failed', error: 'SMTP caído' });
            expect((await outbound.approveAndSendLead(lead.id)).success).toBe(false);
            expect(envio).toHaveBeenCalledTimes(1);
            envio.mockRestore();
        });

        it('un lead inexistente o un id mal formado se responde sin enviar', async () => {
            expect(await outbound.approveAndSendLead('00000000-0000-4000-8000-000000000000')).toMatchObject({ success: false, error: 'Lead not found' });
            expect(await outbound.approveAndSendLead('no-es-un-uuid')).toMatchObject({ success: false, error: 'Lead not found' });
        });

        it('la tabla rechaza estados y tipos fuera del catálogo', async () => {
            await expect(pg.query("INSERT INTO b2b_leads (campaign_id, sector, company_name, status) VALUES ('c','s','n','enviado')")).rejects.toThrow(/status/);
            await expect(pg.query("INSERT INTO b2b_leads (campaign_id, sector, company_name, type) VALUES ('c','s','n','B2X')")).rejects.toThrow(/type/);
        });
    });
});
