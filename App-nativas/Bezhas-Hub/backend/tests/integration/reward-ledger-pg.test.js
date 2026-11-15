/**
 * Recompensas en el libro de BEZ (migraciones 005, 008, 009, 025 y 027) sobre un Postgres REAL. Se salta sin base de pruebas:
 *
 *   docker run -d --name pgtest -e POSTGRES_PASSWORD=test -e POSTGRES_DB=t -p 54330:5432 postgres:16-alpine
 *   HUB_TEST_PG_URL=postgres://postgres:test@localhost:54330/t pnpm exec jest --env=node tests/integration/reward-ledger-pg.test.js
 *
 * Hace DROP SCHEMA public CASCADE: usar SÓLO una base desechable.
 */
const fs = require('fs');
const path = require('path');

const URL = process.env.HUB_TEST_PG_URL;
const d = URL ? describe : describe.skip;
const sql = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'db', 'migrations', f), 'utf8');

d('recompensas idempotentes sobre Postgres', () => {
    let pg; let ledger; let Post; let ana; let beto; let sinWallet;

    const asientos = async (extra = '') => (await pg.query(`SELECT * FROM bezcoin_transactions WHERE type = 'EARN' ${extra} ORDER BY created_at`)).rows;

    beforeAll(async () => {
        process.env.POSTGRES_URL = URL;
        jest.resetModules();
        jest.doMock('../../middleware/discordNotifier', () => ({ notifyHigh: jest.fn(), notifyMedium: jest.fn() }));
        jest.doMock('../../middleware/telegramNotifier', () => ({}));
        pg = require('../../db/pool');
        await pg.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
        for (const f of ['008_logistics_bridge_fiat.sql', '009_core_users.sql', '005_social_and_events.sql', '025_posts_shares.sql', '027_reward_ledger.sql']) await pg.query(sql(f));
        await pg.query(sql('027_reward_ledger.sql')); // idempotente
        ledger = require('../../services/rewardLedger.service');
        Post = require('../../models/pg/Post');
        const mk = async (n, w) => (await pg.query('INSERT INTO users (username, email, wallet_address) VALUES ($1,$2,$3) RETURNING *', [n, `${n}@x.io`, w])).rows[0];
        ana = await mk('ana', '0xAna0000000000000000000000000000000000AA'); beto = await mk('beto', '0xbeto'); sinWallet = await mk('sinwallet', null);
    });
    afterAll(async () => { await pg.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;'); });

    describe('earn', () => {
        it('abona un asiento EARN en BEZ con su clave de idempotencia y reconoce la wallet sin distinguir mayúsculas ni el nombre de usuario', async () => {
            const a = await ledger.earn({ identity: '0xana0000000000000000000000000000000000aa', amount: 10, reason: 't', idempotencyKey: 'k-1' });
            expect(a).toMatchObject({ credited: true, userId: ana.id, amount: 10 });
            const b = await ledger.earn({ identity: 'beto', amount: 5, reason: 't', idempotencyKey: 'k-2' });
            expect(b.credited).toBe(true);
            const filas = await asientos();
            expect(filas.map((f) => [f.currency, f.status, f.wallet_address])).toEqual([['BEZ', 'completed', ana.wallet_address], ['BEZ', 'completed', '0xbeto']]);
        });

        it('la misma recompensa no se paga dos veces, ni con peticiones simultáneas', async () => {
            const r = await Promise.all(Array.from({ length: 8 }, () => ledger.earn({ identity: 'ana', amount: 7, reason: 't', idempotencyKey: 'k-par' })));
            expect(r.filter((x) => x.credited)).toHaveLength(1);
            expect(r.filter((x) => x.reason === 'ALREADY_REWARDED')).toHaveLength(7);
            expect((await asientos("AND metadata->>'idempotencyKey' = 'k-par'"))).toHaveLength(1);
        });

        it('sin usuario o sin wallet no se paga y se explica; importes y claves inválidos se rechazan', async () => {
            expect(await ledger.earn({ identity: 'nadie', amount: 1, reason: 't', idempotencyKey: 'k-x' })).toMatchObject({ credited: false, reason: 'USER_NOT_FOUND' });
            expect(await ledger.earn({ identity: 'sinwallet', amount: 1, reason: 't', idempotencyKey: 'k-y' })).toMatchObject({ credited: false, reason: 'WALLET_REQUIRED' });
            await expect(ledger.earn({ identity: 'ana', amount: -5, reason: 't', idempotencyKey: 'k-z' })).rejects.toThrow(/inválido/);
            await expect(ledger.earn({ identity: 'ana', amount: ledger.MAX_RECOMPENSA + 1, reason: 't', idempotencyKey: 'k-z' })).rejects.toThrow(/inválido/);
            await expect(ledger.earn({ identity: 'ana', amount: 1, reason: 't' })).rejects.toThrow(/idempotencyKey/);
        });
    });

    describe('recompensa por calidad (oráculo)', () => {
        it('se premia el post UNA vez, con 8 llamadas simultáneas, y el post queda marcado', async () => {
            const p = await Post.create({ author: 'ana', content: 'post de calidad' });
            const r = await Promise.all(Array.from({ length: 8 }, () => ledger.rewardPost({ postId: p.id, author: 'ana', amount: 20 })));
            expect(r.filter((x) => x.credited)).toHaveLength(1);
            expect(await Post.findById(p.id)).toMatchObject({ rewardDistributed: true, rewardAmount: 20 });
            expect(await asientos(`AND metadata->>'postId' = '${p.id}'`)).toHaveLength(1);
        });

        it('si no se puede pagar (autor sin wallet) se deshace el reclamo y el post sigue reclamable', async () => {
            const p = await Post.create({ author: 'sinwallet', content: 'sin wallet' });
            expect(await ledger.rewardPost({ postId: p.id, author: 'sinwallet', amount: 10 })).toMatchObject({ credited: false, reason: 'WALLET_REQUIRED' });
            expect(await Post.findById(p.id)).toMatchObject({ rewardDistributed: false });
            await pg.query("UPDATE users SET wallet_address = '0xsw' WHERE id = $1", [sinWallet.id]);
            expect((await ledger.rewardPost({ postId: p.id, author: 'sinwallet', amount: 10 })).credited).toBe(true);
        });

        it('AIOracle.distributeRewards usa el libro por franjas de calidad y devuelve el motivo si no paga', async () => {
            const { AIOracle } = require('../../services/oracle.service');
            const oraculo = Object.create(AIOracle.prototype); // sin constructor: no abre conexiones a la cadena
            const p = await Post.create({ author: 'beto', content: 'otro post' });
            expect(await oraculo.distributeRewards('beto', p.id, 95)).toEqual({ success: true, amount: 50 });
            expect(await oraculo.distributeRewards('beto', p.id, 95)).toMatchObject({ success: false, reason: 'ALREADY_REWARDED' });
            const q = await Post.create({ author: 'beto', content: 'tercero' });
            expect((await oraculo.distributeRewards('beto', q.id, 72)).amount).toBe(10);
            expect((await oraculo.distributeRewards('beto', (await Post.create({ author: 'beto', content: 'cuarto' })).id, 85)).amount).toBe(20);
        });
    });

    describe('automatizaciones', () => {
        const motor = () => { const { AutomationEngine } = require('../../services/automation-engine.service'); return new AutomationEngine(); };

        it('el bono diario se paga una vez por persona y día aunque el job se repita', async () => {
            await pg.query('DELETE FROM posts');
            const a = await Post.create({ author: 'ana', content: 'a1' });
            await Post.update(a.id, { qualityScore: 90 });
            const b = await Post.create({ author: 'beto', content: 'b1' });
            await Post.update(b.id, { qualityScore: 55 });
            const e = motor();
            await e.distributeDailyRewards();
            await e.distributeDailyRewards();
            await Promise.all([e.distributeDailyRewards(), e.distributeDailyRewards()]);
            const dia = new Date().toISOString().slice(0, 10);
            const filas = await asientos(`AND metadata->>'reason' = 'daily_activity'`);
            expect(filas.map((f) => `${f.wallet_address}:${Number(f.amount)}:${f.metadata.day}`).sort())
                .toEqual([`0xAna0000000000000000000000000000000000AA:5:${dia}`, `0xbeto:5:${dia}`].sort()); // 1 post (5 BEZ) cada uno
        });

        it('los logros se desbloquean una vez con >= posts (aunque se pase de largo) y pagan en el libro', async () => {
            await pg.query('DELETE FROM posts');
            for (let i = 0; i < 12; i += 1) await Post.create({ author: 'ana', content: `p${i}` });
            const e = motor();
            await e.checkAndNotifyAchievements();
            await Promise.all([e.checkAndNotifyAchievements(), e.checkAndNotifyAchievements()]);
            const logros = (await pg.query('SELECT badge, reward FROM user_achievements WHERE user_id = $1', [ana.id])).rows;
            expect(logros).toEqual([{ badge: 'Creador Novato', reward: '50.000000' }]); // 12 >= 10, y no 50
            expect(await asientos(`AND metadata->>'reason' = 'achievement'`)).toHaveLength(1);
        });

        it('limpieza: oculta los posts de baja calidad y deja los no analizados', async () => {
            await pg.query('DELETE FROM posts');
            const malo = await Post.create({ author: 'ana', content: 'malo' });
            await Post.update(malo.id, { qualityScore: 10 });
            const bueno = await Post.create({ author: 'ana', content: 'bueno' });
            await Post.update(bueno.id, { qualityScore: 80 });
            const nuevo = await Post.create({ author: 'ana', content: 'sin analizar' });
            await motor().cleanLowQualityContent();
            expect((await Post.findById(malo.id))).toMatchObject({ hidden: true });
            expect((await Post.findById(bueno.id)).hidden).toBe(false);
            expect((await Post.findById(nuevo.id)).hidden).toBe(false);
            expect((await pg.query('SELECT hidden_reason FROM posts WHERE id = $1', [malo.id])).rows[0].hidden_reason).toBe('Low quality score');
        });

        it('las métricas salen de SQL, y la reactivación de inactivos NO reparte nada (no hay datos de actividad)', async () => {
            const m = await ledger.platformMetrics();
            expect(m).toMatchObject({ totalUsers: 3, totalPosts: 3 });
            expect(m.totalRewardsDistributed).toBeGreaterThan(0);
            const antes = (await asientos()).length;
            await motor().reengageInactiveUsers();
            expect((await asientos()).length).toBe(antes);
            await motor().calculatePlatformMetrics(); // no lanza
        });

        it('la base impide dos asientos con la misma clave aunque se escriba directamente', async () => {
            await expect(pg.query(`INSERT INTO bezcoin_transactions (user_id, wallet_address, type, amount, currency, metadata) VALUES ('u','w','EARN',1,'BEZ','{"idempotencyKey":"k-1"}')`))
                .rejects.toThrow(/uq_bezcoin_idempotency/);
        });
    });
});
