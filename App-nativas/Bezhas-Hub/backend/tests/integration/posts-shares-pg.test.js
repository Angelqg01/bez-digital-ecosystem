/**
 * Feed social y compartidos sobre un Postgres REAL (migraciones 005, 008, 009 y 025). Se salta sin base de pruebas:
 *
 *   docker run -d --name pgtest -e POSTGRES_PASSWORD=test -e POSTGRES_DB=t -p 54330:5432 postgres:16-alpine
 *   HUB_TEST_PG_URL=postgres://postgres:test@localhost:54330/t pnpm exec jest --env=node tests/integration/posts-shares-pg.test.js
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
const ADMIN = 'Bearer admin-token-de-pruebas-0123456789abcdef';

d('feed y compartidos sobre Postgres', () => {
    let pg; let Post; let Share; let app; let ana; let beto; let sinWallet; let actual;

    beforeAll(async () => {
        process.env.POSTGRES_URL = URL;
        process.env.ADMIN_TOKEN = ADMIN.slice(7);
        process.env.JWT_SECRET = 'secreto-de-pruebas-0123456789abcdef0123456789';
        jest.resetModules();
        jest.doMock('../../middleware/auth.middleware', () => ({
            protect: (req, res, next) => { if (!actual) return res.status(401).json({ error: 'no autenticado' }); req.user = actual; return next(); },
        }));
        pg = require('../../db/pool');
        await pg.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
        for (const f of ['008_logistics_bridge_fiat.sql', '009_core_users.sql', '005_social_and_events.sql', '025_posts_shares.sql']) await pg.query(sql(f));
        await pg.query(sql('025_posts_shares.sql')); // idempotente
        Post = require('../../models/pg/Post');
        Share = require('../../models/pg/Share');
        const mk = async (n, w) => (await pg.query('INSERT INTO users (username, email, wallet_address) VALUES ($1,$2,$3) RETURNING *', [n, `${n}@x.io`, w])).rows[0];
        ana = await mk('ana', '0xana'); beto = await mk('beto', '0xbeto'); sinWallet = await mk('sinwallet', null);
        app = express();
        app.use(express.json());
        app.use('/api/feed', require('../../routes/feed.routes'));
        app.use('/api/social', require('../../routes/share.routes'));
    });
    afterAll(async () => { await pg.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;'); });

    const como = (u) => { actual = u ? { id: u.id, _id: u.id, walletAddress: u.wallet_address, username: u.username } : null; };

    describe('feed', () => {
        let post;

        it('crear exige sesión y el autor sale de la identidad, no del cuerpo (sin suplantación)', async () => {
            como(null);
            expect((await request(app).post('/api/feed').send({ author: '0xana', content: 'hola' })).status).toBe(401);
            como(beto);
            const r = await request(app).post('/api/feed').send({ author: '0xana', content: 'Mi primer post', metadata: { title: 'T', tags: ['a'], evil: 'x' }, hidden: true, pinned: true });
            expect(r.status).toBe(201);
            expect(r.body).toMatchObject({ author: '0xbeto', hidden: false, pinned: false, validated: false });
            expect(r.body.metadata).not.toHaveProperty('evil');
            post = r.body;
        });

        it('valida el contenido: vacío 400, demasiado largo 413', async () => {
            como(beto);
            expect((await request(app).post('/api/feed').send({ content: '   ' })).status).toBe(400);
            expect((await request(app).post('/api/feed').send({ content: 'x'.repeat(10001) })).status).toBe(413);
        });

        it('los «me gusta» no se duplican ni se pierden con peticiones simultáneas, y el autor del like es el autenticado', async () => {
            como(ana);
            await Promise.all(Array.from({ length: 8 }, () => request(app).post(`/api/feed/${post.id}/like`).send({ author: '0xotro' })));
            expect((await Post.findById(post.id)).likes).toEqual(['0xana']);
            // Likes simultáneos de personas distintas (a través del modelo: la identidad de la ruta es una variable compartida del test).
            await Promise.all(['0xana', '0xbeto', 'sinwallet', '0xana', '0xbeto'].map((quien) => Post.like(post.id, quien)));
            expect((await Post.findById(post.id)).likes.sort()).toEqual(['0xana', '0xbeto', 'sinwallet']);
            como(beto);
            const r = await request(app).post(`/api/feed/${post.id}/unlike`);
            expect(r.body.likes.sort()).toEqual(['0xana', 'sinwallet']);
        });

        it('10 comentarios simultáneos se guardan todos (antes se pisaban) y se limita su longitud', async () => {
            como(ana);
            await Promise.all(Array.from({ length: 10 }, (_, i) => request(app).post(`/api/feed/${post.id}/comment`).send({ content: `c${i}` })));
            const g = await Post.findById(post.id);
            expect(g.comments).toHaveLength(10);
            expect(new Set(g.comments.map((c) => c.content)).size).toBe(10);
            expect(g.comments.every((c) => c.author === '0xana')).toBe(true);
            expect((await request(app).post(`/api/feed/${post.id}/comment`).send({ content: 'x'.repeat(2001) })).status).toBe(413);
            expect((await request(app).post(`/api/feed/${post.id}/comment`).send({})).status).toBe(400);
        });

        it('un id mal formado o inexistente es 404 y las acciones exigen sesión', async () => {
            como(ana);
            expect((await request(app).post('/api/feed/no-es-uuid/like')).status).toBe(404);
            expect((await request(app).post('/api/feed/00000000-0000-4000-8000-000000000000/comment').send({ content: 'x' })).status).toBe(404);
            como(null);
            expect((await request(app).post(`/api/feed/${post.id}/like`)).status).toBe(401);
            expect((await request(app).post(`/api/feed/${post.id}/comment`).send({ content: 'x' })).status).toBe(401);
        });

        it('los posts ocultos sólo los ve un administrador REAL (una cabecera Bearer cualquiera ya no basta)', async () => {
            como(ana);
            const oculto = (await request(app).post('/api/feed').send({ content: 'Contenido moderado' })).body;
            expect((await request(app).patch(`/api/feed/${oculto.id}`).send({ hidden: true })).status).toBe(401); // sin credencial de admin
            expect((await request(app).patch(`/api/feed/${oculto.id}`).set('Authorization', 'Bearer cualquiera').send({ hidden: true })).status).toBe(403);
            const m = await request(app).patch(`/api/feed/${oculto.id}`).set('Authorization', ADMIN).send({ hidden: true, pinned: true, author: 'otro', content: 'reescrito' });
            expect(m.status).toBe(200);
            expect(m.body.post).toMatchObject({ hidden: true, pinned: true, author: '0xana', content: 'Contenido moderado' }); // sólo hidden/pinned/validated
            const anonimo = (await request(app).get('/api/feed')).body.map((p) => p.id);
            const falso = (await request(app).get('/api/feed').set('Authorization', 'Bearer x')).body.map((p) => p.id);
            const admin = (await request(app).get('/api/feed').set('Authorization', ADMIN)).body.map((p) => p.id);
            expect(anonimo).not.toContain(oculto.id);
            expect(falso).not.toContain(oculto.id);
            expect(admin).toContain(oculto.id);
            expect(admin[0]).toBe(oculto.id); // fijado primero
            expect((await request(app).get('/api/feed/user/0xana')).body.map((p) => p.id)).not.toContain(oculto.id);
        });

        it('estadísticas, borrado de administrador y siembra inicial concurrente', async () => {
            const s = (await request(app).get('/api/feed/stats')).body;
            expect(s).toMatchObject({ totalPosts: 2, pinnedPosts: 1 });
            expect((await request(app).delete(`/api/feed/${post.id}`)).status).toBe(401);
            expect((await request(app).delete(`/api/feed/${post.id}`).set('Authorization', ADMIN)).status).toBe(200);
            expect((await request(app).delete(`/api/feed/${post.id}`).set('Authorization', ADMIN)).status).toBe(404);
            await pg.query('DELETE FROM posts');
            const n = await Promise.all(Array.from({ length: 4 }, () => Post.seedIfEmpty([{ author: '0xSeed', content: 'semilla', pinned: true }])));
            expect(n.reduce((a, b) => a + b, 0)).toBe(1);
            expect(await Post.count()).toBe(1);
        });
    });

    describe('oráculo de calidad sobre posts', () => {
        it('update sólo toca campos conocidos, findUnanalyzed y activeAuthors reflejan el análisis', async () => {
            await pg.query('DELETE FROM posts');
            const a = await Post.create({ author: '0xa', content: 'uno' });
            const b = await Post.create({ author: '0xa', content: 'dos' });
            await Post.create({ author: '0xb', content: 'tres' });
            expect((await Post.findUnanalyzed()).length).toBe(3);
            await Post.update(a.id, { qualityScore: 80, aiAnalyzedAt: new Date(), aiAnalysisData: { model: 'm' }, author: 'hacker', hidden: true });
            await Post.update(b.id, { $set: { qualityScore: 60, rewardAmount: 10, rewardDistributed: true } });
            const g = await Post.findById(a.id);
            expect(g).toMatchObject({ qualityScore: 80, author: '0xa', hidden: false, aiAnalysisData: { model: 'm' } });
            expect((await Post.findUnanalyzed()).length).toBe(1);
            expect(await Post.activeAuthors({ minQuality: 50 })).toEqual([{ _id: '0xa', postCount: 2, avgQuality: 70 }]);
        });
    });

    describe('compartidos', () => {
        let p1; let p2;

        beforeAll(async () => {
            await pg.query('DELETE FROM posts');
            p1 = await Post.create({ author: '0xa', content: 'post uno' });
            p2 = await Post.create({ author: '0xa', content: 'post dos' });
        });

        const compartir = (postId, platform = 'twitter', extra = {}) => request(app).post('/api/social/share').set('User-Agent', 'jest-ua').send({ postId, platform, ...extra });

        it('registra el compartido, sube el contador y paga 5 BEZ sólo la primera vez que ese usuario comparte ese post', async () => {
            como(ana);
            const r1 = await compartir(p1.id, 'twitter', { comment: 'mira' });
            expect(r1.status).toBe(200);
            expect(r1.body).toMatchObject({ success: true, totalShares: 1, todayShares: 1, reward: { tokens: 5 } });
            const r2 = await compartir(p1.id, 'facebook');
            expect(r2.body).toMatchObject({ totalShares: 2, todayShares: 2, reward: null }); // mismo post: sin recompensa
            const { rows } = await pg.query("SELECT * FROM bezcoin_transactions WHERE metadata->>'reason' = 'share_reward'");
            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({ type: 'EARN', currency: 'BEZ', wallet_address: '0xana', status: 'completed' });
            expect(Number(rows[0].amount)).toBe(5);
            expect((await Post.findById(p1.id)).shares).toBe(2);
        });

        it('valida la plataforma y el post; sin wallet se registra pero no se paga', async () => {
            como(ana);
            expect((await compartir(p1.id, 'tiktok')).status).toBe(400);
            expect((await compartir('00000000-0000-4000-8000-000000000000')).status).toBe(404);
            expect((await compartir('no-es-uuid')).status).toBe(404);
            como(sinWallet);
            const r = await compartir(p2.id, 'copy');
            expect(r.body).toMatchObject({ success: true, reward: null });
            como(null);
            expect((await compartir(p1.id)).status).toBe(401);
        });

        it('el límite de 20 al día no se salta con peticiones simultáneas: 30 compartidos, 20 recompensas', async () => {
            const posts = await Promise.all(Array.from({ length: 30 }, (_, i) => Post.create({ author: '0xa', content: `masivo ${i}` })));
            como(beto);
            const r = await Promise.all(posts.map((p) => compartir(p.id, 'native')));
            expect(r.every((x) => x.status === 200)).toBe(true);
            const pagados = await pg.query("SELECT COUNT(*)::int AS n FROM bezcoin_transactions WHERE wallet_address = '0xbeto' AND metadata->>'reason' = 'share_reward'");
            expect(pagados.rows[0].n).toBe(20);
            expect(r.filter((x) => x.body.reward)).toHaveLength(20);
            expect(r.filter((x) => x.body.limitReached).length).toBeGreaterThan(0);
        });

        it('la respuesta pública no expone IP ni user-agent y reparte por plataforma', async () => {
            const r = await request(app).get(`/api/social/share/${p1.id}`);
            expect(r.status).toBe(200);
            expect(r.body).toMatchObject({ total: 2, byPlatform: { twitter: 1, facebook: 1 } });
            const texto = JSON.stringify(r.body);
            expect(texto).not.toMatch(/ipAddress|userAgent|ip_address|user_agent|jest-ua/);
            expect(r.body.shares[0].userId).toMatchObject({ username: 'ana' });
            expect((await pg.query('SELECT ip_address, user_agent FROM post_shares WHERE post_id = $1 LIMIT 1', [p1.id])).rows[0].user_agent).toBe('jest-ua'); // se guarda, no se muestra
        });

        it('analytics es sólo de administradores y alcanzable (antes quedaba tapada por /share/:postId)', async () => {
            como(ana);
            expect((await request(app).get('/api/social/share/analytics')).status).toBe(401);
            expect((await request(app).get('/api/social/share/analytics').set('Authorization', 'Bearer x')).status).toBe(403);
            const r = await request(app).get('/api/social/share/analytics').set('Authorization', ADMIN);
            expect(r.status).toBe(200);
            expect(r.body.analytics).toMatchObject({ totalShares: expect.any(Number), byPlatform: expect.any(Array), topSharedPosts: expect.any(Array) });
            expect(r.body.analytics.totalShares).toBeGreaterThanOrEqual(33);
        });

        it('el historial de un usuario lo ve él o un administrador, no otro usuario', async () => {
            como(beto);
            expect((await request(app).get(`/api/social/share/user/${ana.id}`)).status).toBe(403);
            expect((await request(app).get(`/api/social/share/user/${beto.id}?limit=5`)).body).toMatchObject({ total: 30, hasMore: true });
            como(ana);
            expect((await request(app).get(`/api/social/share/user/${beto.id}`).set('Authorization', ADMIN)).status).toBe(200);
        });

        it('borrar: sólo el dueño, resta el contador sin bajar de cero y 404 si no existe', async () => {
            como(ana);
            const id = (await pg.query('SELECT id FROM post_shares WHERE user_id = $1 AND post_id = $2 LIMIT 1', [ana.id, p1.id])).rows[0].id;
            como(beto);
            expect((await request(app).delete(`/api/social/share/${id}`)).status).toBe(403);
            como(ana);
            expect((await request(app).delete(`/api/social/share/${id}`)).status).toBe(200);
            expect((await request(app).delete(`/api/social/share/${id}`)).status).toBe(404);
            expect((await Post.findById(p1.id)).shares).toBe(1);
            expect((await request(app).delete('/api/social/share/no-es-uuid')).status).toBe(404);
            await pg.query('UPDATE posts SET shares = 0 WHERE id = $1', [p1.id]);
            const otro = (await pg.query('SELECT id FROM post_shares WHERE post_id = $1 LIMIT 1', [p1.id])).rows[0].id;
            expect((await request(app).delete(`/api/social/share/${otro}`)).status).toBe(200);
            expect((await Post.findById(p1.id)).shares).toBe(0);
        });

        it('retención: purgeExpired borra los de más de un año; borrar el post borra sus compartidos', async () => {
            await pg.query("UPDATE post_shares SET created_at = NOW() - INTERVAL '400 days' WHERE post_id = $1", [p2.id]);
            expect(await Share.purgeExpired()).toBeGreaterThanOrEqual(1);
            expect((await pg.query('SELECT 1 FROM post_shares WHERE post_id = $1', [p2.id])).rowCount).toBe(0);
            como(ana);
            await compartir(p1.id, 'email');
            await pg.query('DELETE FROM posts WHERE id = $1', [p1.id]);
            expect((await pg.query('SELECT 1 FROM post_shares WHERE post_id = $1', [p1.id])).rowCount).toBe(0);
        });
    });
});
