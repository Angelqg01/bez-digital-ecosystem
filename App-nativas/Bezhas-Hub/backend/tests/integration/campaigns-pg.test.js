/**
 * Anunciantes y campañas sobre un Postgres REAL (migraciones 006, 008, 009, 023 y 024). Se salta sin base de pruebas:
 *
 *   docker run -d --name pgtest -e POSTGRES_PASSWORD=test -e POSTGRES_DB=t -p 54330:5432 postgres:16-alpine
 *   HUB_TEST_PG_URL=postgres://postgres:test@localhost:54330/t pnpm exec jest --env=node tests/integration/campaigns-pg.test.js
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

const futuro = (dias) => new Date(Date.now() + dias * 86400000).toISOString();
const cuerpo = (extra = {}) => ({
    name: 'Lanzamiento', objective: 'clicks',
    creative: { title: 'Título largo', description: 'Una descripción suficientemente larga', imageUrl: '/uploads/ads/a.png', destinationUrl: 'https://acme.test/promo', callToAction: 'shop-now' },
    targeting: { keywords: ['nft', 'defi'], deviceTypes: ['mobile'] },
    budget: { dailyBudget: 10, totalBudget: 100, bidAmount: 0.5 },
    schedule: { startDate: futuro(2) },
    ...extra,
});

d('anunciantes y campañas sobre Postgres', () => {
    let pg; let Campaign; let AdBalance; let app; let ana; let beto; let carla; let actual;

    beforeAll(async () => {
        process.env.POSTGRES_URL = URL;
        jest.resetModules();
        jest.doMock('../../middleware/auth.middleware', () => ({ protect: (req, _res, next) => { req.user = actual; next(); } }));
        jest.doMock('../../middleware/admin.middleware', () => ({ verifyAdminToken: (req, _res, next) => { req.admin = { id: 'a', role: 'ADMIN' }; next(); } }));
        jest.doMock('../../services/price-oracle.service', () => ({ getBezEurPrice: async () => 0.1 }));
        pg = require('../../db/pool');
        await pg.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
        for (const f of ['008_logistics_bridge_fiat.sql', '009_core_users.sql', '006_billing.sql', '023_ad_balances.sql', '024_ad_campaigns.sql']) await pg.query(sql(f));
        await pg.query(sql('024_ad_campaigns.sql')); // idempotente
        Campaign = require('../../models/pg/Campaign');
        AdBalance = require('../../models/pg/AdBalance');
        const mk = async (n) => (await pg.query('INSERT INTO users (username, email, wallet_address) VALUES ($1,$2,$3) RETURNING *', [n, `${n}@x.io`, `0x${n.padEnd(40, '0').slice(0, 40)}`])).rows[0];
        ana = await mk('ana'); beto = await mk('beto'); carla = await mk('carla');
        app = express();
        app.use(express.json());
        app.use('/api/advertiser-profile', require('../../routes/advertiserProfile.routes'));
        app.use('/api/campaigns', require('../../routes/campaigns.routes'));
        app.use('/api/admin/ads', require('../../routes/adminAds.routes'));
    });
    afterAll(async () => { await pg.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;'); });

    const como = (u) => { actual = { _id: u.id, walletAddress: u.wallet_address }; };
    const perfil = (extra = {}) => ({ businessType: 'store', projectName: 'Acme', businessGoals: ['sell-nfts', 'hack', 'sell-nfts'], companyDetails: { description: 'Tienda', evil: 'x'.repeat(5000), industry: 'retail' }, ...extra });

    describe('perfil de anunciante', () => {
        it('crea el perfil, lo actualiza después y filtra metas y claves desconocidas', async () => {
            como(ana);
            const c = await request(app).post('/api/advertiser-profile').send(perfil());
            expect(c.status).toBe(200);
            expect(c.body.message).toMatch(/creado/);
            const u = await request(app).post('/api/advertiser-profile').send(perfil({ projectName: 'Acme 2', businessGoals: ['drive-traffic'] }));
            expect(u.body.message).toMatch(/actualizado/);
            const g = (await request(app).get('/api/advertiser-profile')).body.data;
            expect(g).toMatchObject({ projectName: 'Acme 2', businessGoals: ['drive-traffic'] });
            expect(Object.keys(g.companyDetails).sort()).toEqual(['description', 'industry', 'logoUrl', 'teamSize']); // sin `evil`
        });

        it('dos envíos simultáneos del wizard dejan un solo perfil y ningún error', async () => {
            como(beto);
            const r = await Promise.all([1, 2, 3, 4].map(() => request(app).post('/api/advertiser-profile').send(perfil())));
            expect(r.every((x) => x.status === 200)).toBe(true);
            expect((await pg.query('SELECT 1 FROM advertiser_profiles WHERE user_id = $1', [beto.id])).rowCount).toBe(1);
        });

        it('check y 404 con onboarding para quien no tiene perfil; tipo de negocio inválido = 400', async () => {
            como(carla);
            expect((await request(app).get('/api/advertiser-profile')).status).toBe(404);
            expect((await request(app).get('/api/advertiser-profile/check')).body).toMatchObject({ hasProfile: false, needsOnboarding: true });
            expect((await request(app).post('/api/advertiser-profile').send(perfil({ businessType: 'mafia' }))).status).toBe(400);
        });
    });

    describe('campañas del anunciante', () => {
        let c1;

        it('sin perfil → 403; sin saldo → 400; con perfil y saldo se crea pendiente de aprobación', async () => {
            como(carla);
            expect((await request(app).post('/api/campaigns').send(cuerpo())).status).toBe(403);
            como(ana);
            const sinSaldo = await request(app).post('/api/campaigns').send(cuerpo());
            expect(sinSaldo.status).toBe(400);
            expect(sinSaldo.body).toMatchObject({ requiredAmount: 30, currentBalance: 0 });
            await AdBalance.credit(ana.id, ana.wallet_address, { fiat: 20, bez: 200, depositedEur: 40 }); // 20 + 200 x 0,1 = 40 EUR
            const ok = await request(app).post('/api/campaigns').send(cuerpo());
            expect(ok.status).toBe(201);
            expect(ok.body.campaign.status).toBe('pending_approval');
            c1 = ok.body.campaign.id;
        });

        it('el cliente no puede fijar estado, métricas ni claves de más al crear (mass assignment)', async () => {
            como(ana);
            const r = await request(app).post('/api/campaigns').send(cuerpo({ status: 'active', metrics: { spent: -5, clicks: 999 }, approvedBy: ana.id,
                creative: { ...cuerpo().creative, evil: 'x', callToAction: 'hackea' }, targeting: { keywords: ['a'], isAdmin: true, deviceTypes: ['nave'] } }));
            expect(r.status).toBe(201);
            const g = (await request(app).get(`/api/campaigns/${r.body.campaign.id}`)).body.data;
            expect(g.status).toBe('pending_approval');
            expect(g.metrics).toMatchObject({ spent: 0, clicks: 0 });
            expect(g.approvedBy).toBeNull();
            expect(g.creative).not.toHaveProperty('evil');
            expect(g.creative.callToAction).toBe('learn-more');
            expect(g.targeting).not.toHaveProperty('isAdmin');
            expect(g.targeting.deviceTypes).toEqual([]);
        });

        it('valida presupuesto, puja y fechas (mínimos del esquema y fin posterior al inicio)', async () => {
            como(ana);
            expect((await request(app).post('/api/campaigns').send(cuerpo({ budget: { dailyBudget: 1, totalBudget: 100, bidAmount: 0.5 } }))).status).toBe(400);
            expect((await request(app).post('/api/campaigns').send(cuerpo({ budget: { dailyBudget: 10, totalBudget: 100, bidAmount: 0 } }))).status).toBe(400);
            const r = await request(app).post('/api/campaigns').send(cuerpo({ schedule: { startDate: futuro(5), endDate: futuro(1) } }));
            expect(r.status).toBe(400);
            expect(r.body.error).toMatch(/fecha de fin/i);
        });

        it('lista sólo las propias con paginación y filtro, y el detalle ajeno es 404', async () => {
            como(ana);
            const l = await request(app).get('/api/campaigns?limit=1&page=1');
            expect(l.body.pagination.total).toBeGreaterThanOrEqual(2);
            expect(l.body.data).toHaveLength(1);
            expect((await request(app).get('/api/campaigns?status=active')).body.data).toEqual([]);
            como(beto);
            expect((await request(app).get('/api/campaigns')).body.data).toEqual([]);
            expect((await request(app).get(`/api/campaigns/${c1}`)).status).toBe(404);
            expect((await request(app).get('/api/campaigns/no-es-uuid')).status).toBe(400);
        });

        it('edita en pendiente (fusiona) pero rechaza límites inválidos', async () => {
            como(ana);
            const ok = await request(app).put(`/api/campaigns/${c1}`).send({ budget: { dailyBudget: 20 }, creative: { title: 'Otro título' } });
            expect(ok.status).toBe(200);
            expect(ok.body.data.budget).toMatchObject({ dailyBudget: 20, totalBudget: 100, bidAmount: 0.5 });
            expect(ok.body.data.creative).toMatchObject({ title: 'Otro título', destinationUrl: 'https://acme.test/promo' });
            expect((await request(app).put(`/api/campaigns/${c1}`).send({ budget: { dailyBudget: 1 } })).status).toBe(400);
            expect((await request(app).put(`/api/campaigns/${c1}`).send({ status: 'active', metrics: { clicks: 9 } })).body.data).toMatchObject({ status: 'pending_approval' });
            como(beto);
            expect((await request(app).put(`/api/campaigns/${c1}`).send({ name: 'robada' })).status).toBe(404);
        });

        it('borra sólo borradores propios', async () => {
            como(ana);
            const borrador = await Campaign.create(ana.id, ana.wallet_address, cuerpo(), 'draft');
            expect((await request(app).delete(`/api/campaigns/${c1}`)).status).toBe(400); // pendiente: no
            como(beto);
            expect((await request(app).delete(`/api/campaigns/${borrador.id}`)).status).toBe(404); // ajeno
            como(ana);
            expect((await request(app).delete(`/api/campaigns/${borrador.id}`)).status).toBe(200);
            expect(await Campaign.findById(borrador.id)).toBeNull();
        });

        it('analytics y resumen salen de las métricas guardadas', async () => {
            como(ana);
            await pg.query("UPDATE ad_campaigns SET impressions = 1000, clicks = 50, spent = 25, conversions = 5 WHERE id = $1", [c1]);
            const a = (await request(app).get(`/api/campaigns/${c1}/analytics`)).body.data;
            expect(a.calculated).toEqual({ ctr: '5.00%', cpc: '€0.50', cpm: '€25.00', conversionRate: '10.00%' });
            expect(a.budget).toMatchObject({ total: 100, spent: 25, remaining: 75 });
            const s = (await request(app).get('/api/campaigns/stats/summary')).body.data;
            expect(s).toMatchObject({ total: 2, totalSpent: 25, totalClicks: 50, averageCTR: '5.00', averageCPC: '0.50' });
            expect(s.byStatus.pending).toBe(2);
            await pg.query('UPDATE ad_campaigns SET impressions = 0, clicks = 0, spent = 0, conversions = 0 WHERE id = $1', [c1]);
        });
    });

    describe('administración', () => {
        let pendiente; let futura;

        it('cola de pendientes FIFO con los datos del anunciante', async () => {
            const q = (await request(app).get('/api/admin/ads/pending-queue')).body;
            expect(q.pagination.total).toBe(2);
            expect(q.data[0].advertiserId).toMatchObject({ username: 'ana', email: 'ana@x.io' });
            expect(new Date(q.data[0].createdAt) <= new Date(q.data[1].createdAt)).toBe(true);
            pendiente = q.data[0].id;
            futura = q.data[1].id;
            await pg.query("UPDATE ad_campaigns SET start_date = NOW() - INTERVAL '1 day' WHERE id = $1", [pendiente]);
        });

        it('aprobar es atómico: de 6 aprobaciones simultáneas sólo una pasa, y activa si ya debía empezar', async () => {
            const r = await Promise.all(Array.from({ length: 6 }, () => request(app).post(`/api/admin/ads/approve/${pendiente}`)));
            expect(r.filter((x) => x.status === 200)).toHaveLength(1);
            expect(r.filter((x) => x.status === 400)).toHaveLength(5);
            expect(r.find((x) => x.status === 200).body.campaign.status).toBe('active');
            const f = await request(app).post(`/api/admin/ads/approve/${futura}`);
            expect(f.body.campaign.status).toBe('approved'); // empieza en el futuro
            expect((await request(app).post('/api/admin/ads/approve/00000000-0000-4000-8000-000000000000')).status).toBe(404);
            expect((await request(app).post('/api/admin/ads/approve/no-es-uuid')).status).toBe(400);
        });

        it('rechazar exige motivo y sólo vale para pendientes', async () => {
            como(ana);
            const nueva = (await request(app).post('/api/campaigns').send(cuerpo())).body.campaign.id;
            expect((await request(app).post(`/api/admin/ads/reject/${nueva}`).send({})).status).toBe(400);
            const r = await request(app).post(`/api/admin/ads/reject/${nueva}`).send({ reason: 'Creatividad engañosa' });
            expect(r.body.campaign).toMatchObject({ status: 'rejected', rejectionReason: 'Creatividad engañosa' });
            expect((await request(app).post(`/api/admin/ads/reject/${nueva}`).send({ reason: 'otra' })).status).toBe(400);
            expect((await request(app).get('/api/admin/ads/all-campaigns?status=rejected')).body.data[0].advertiserId).toHaveProperty('walletAddress');
        });

        it('pausar y reanudar por el anunciante respeta los estados', async () => {
            como(ana);
            expect((await request(app).put(`/api/campaigns/${pendiente}`).send({ action: 'pause' })).body.data.status).toBe('paused');
            expect((await request(app).put(`/api/campaigns/${pendiente}`).send({ action: 'pause' })).status).toBe(400);
            expect((await request(app).put(`/api/campaigns/${pendiente}`).send({ action: 'resume' })).body.data.status).toBe('active');
            expect((await request(app).put(`/api/campaigns/${pendiente}`).send({ action: 'resume' })).status).toBe(400);
            expect((await request(app).put(`/api/campaigns/${pendiente}`).send({ action: 'explotar' })).status).toBe(400);
        });

        it('suspender al anunciante suspende sus campañas activas, aprobadas y pausadas, y no puede reanudar ni reactivarlas', async () => {
            como(ana);
            await request(app).put(`/api/campaigns/${pendiente}`).send({ action: 'pause' }); // pausada
            const perfilAna = (await pg.query('SELECT id FROM advertiser_profiles WHERE user_id = $1', [ana.id])).rows[0].id;
            const s = await request(app).post(`/api/admin/ads/suspend-advertiser/${perfilAna}`).send({ suspend: true, reason: 'fraude' });
            expect(s.body.advertiser).toMatchObject({ isSuspended: true });
            const estados = (await pg.query("SELECT status, suspension_reason FROM ad_campaigns WHERE advertiser_id = $1 AND id IN ($2,$3)", [ana.id, pendiente, futura])).rows;
            expect(estados.map((e) => e.status)).toEqual(['suspended', 'suspended']);
            expect((await request(app).put(`/api/campaigns/${pendiente}`).send({ action: 'resume' })).status).toBe(403); // suspendido: no reanuda nada
            expect((await request(app).post('/api/campaigns').send(cuerpo())).status).toBe(403); // no puede crear
            const act = await request(app).post(`/api/admin/ads/toggle-campaign/${pendiente}`).send({ action: 'activate' });
            expect(act.status).toBe(409); // el administrador tampoco la activa con el anunciante suspendido
            expect((await request(app).get('/api/admin/ads/advertisers?suspended=true')).body.data[0].userId).toMatchObject({ username: 'ana' });
            await request(app).post(`/api/admin/ads/suspend-advertiser/${perfilAna}`).send({ suspend: false });
            const re = await request(app).post(`/api/admin/ads/toggle-campaign/${pendiente}`).send({ action: 'activate' });
            expect(re.body.campaign.status).toBe('active');
            expect((await pg.query('SELECT suspension_reason FROM ad_campaigns WHERE id = $1', [pendiente])).rows[0].suspension_reason).toBeNull();
        });

        it('suspender una campaña concreta y anunciante inexistente = 404', async () => {
            const s = await request(app).post(`/api/admin/ads/toggle-campaign/${pendiente}`).send({ action: 'suspend', reason: 'revisión' });
            expect(s.body.campaign.status).toBe('suspended');
            expect((await request(app).post('/api/admin/ads/suspend-advertiser/00000000-0000-4000-8000-000000000000').send({ suspend: true })).status).toBe(404);
            expect((await request(app).post(`/api/admin/ads/toggle-campaign/${pendiente}`).send({ action: 'borrar' })).status).toBe(400);
        });
    });

    describe('restricciones de la tabla', () => {
        it('la base rechaza presupuesto bajo, estado inválido y fin anterior al inicio aunque la ruta falle', async () => {
            const base = [ana.id, 'Camp', 'clicks', '{"title":"t"}'];
            const ins = (daily, status, fin) => pg.query(
                `INSERT INTO ad_campaigns (advertiser_id, name, objective, creative, daily_budget, total_budget, bid_amount, start_date, end_date, status)
                 VALUES ($1,$2,$3,$4::jsonb,$5,100,0.5,NOW(),$6,$7)`, [...base, daily, fin, status]);
            await expect(ins(1, 'draft', null)).rejects.toThrow(/daily_budget/);
            await expect(ins(10, 'volando', null)).rejects.toThrow(/status/);
            await expect(ins(10, 'draft', new Date(Date.now() - 86400000))).rejects.toThrow(/ad_campaigns_dates/);
        });

        it('borrar al usuario borra sus campañas, su perfil y su saldo', async () => {
            const tmp = (await pg.query("INSERT INTO users (username, email) VALUES ('tmp','tmp@x.io') RETURNING id")).rows[0].id;
            await Campaign.create(tmp, null, cuerpo(), 'draft');
            await pg.query('DELETE FROM users WHERE id = $1', [tmp]);
            expect((await pg.query('SELECT 1 FROM ad_campaigns WHERE advertiser_id = $1', [tmp])).rowCount).toBe(0);
        });
    });
});
