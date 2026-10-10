process.env.KNOWLEDGE_STORE = 'memory';
const jwt = require('jsonwebtoken');
const express = require('express');
const request = require('supertest');
const { JWT_SECRET } = require('../../config/secrets');

describe('JWT: emisor y audiencia', () => {
    const { authenticateToken } = require('../../middleware/security');
    const app = express();
    app.get('/x', authenticateToken, (req, res) => res.json({ ok: true }));
    const ir = (t) => request(app).get('/x').set('Authorization', `Bearer ${t}`);
    const firmar = (extra) => jwt.sign({ userId: 1 }, JWT_SECRET, { expiresIn: '5m', ...extra });

    it('acepta el token con nuestro emisor y audiencia', async () => {
        expect((await ir(firmar({ issuer: 'bezhas-api', audience: 'bezhas-platform' }))).status).toBe(200);
    });
    it('rechaza otro emisor o audiencia', async () => {
        expect((await ir(firmar({ issuer: 'otro', audience: 'bezhas-platform' }))).status).toBe(403);
        expect((await ir(firmar({ issuer: 'bezhas-api', audience: 'otra' }))).status).toBe(403);
    });
    it('transición: el token antiguo sin iss/aud sigue valiendo', async () => {
        expect((await ir(firmar())).status).toBe(200);
    });
    it('modo estricto: el token sin iss/aud se rechaza', async () => {
        jest.resetModules();
        process.env.JWT_STRICT_CLAIMS = 'true';
        const { authenticateToken: estricto } = require('../../middleware/security');
        delete process.env.JWT_STRICT_CLAIMS;
        const a = express();
        a.get('/x', estricto, (req, res) => res.json({ ok: true }));
        expect((await request(a).get('/x').set('Authorization', `Bearer ${firmar()}`)).status).toBe(403);
    });
});

describe('techo global diario de IA', () => {
    it('al alcanzarlo cae al modo extractivo', () => {
        jest.resetModules();
        process.env.AI_GLOBAL_DAILY_CALLS = '2';
        process.env.ANTHROPIC_API_KEY = 'x';
        delete process.env.AI_PROVIDER;
        const gw = require('../../services/ai-workspace/gateway');
        gw._reiniciarPresupuesto();
        expect([gw.pickProvider(), gw.pickProvider(), gw.pickProvider()]).toEqual(['anthropic', 'anthropic', 'extractive']);
        delete process.env.AI_GLOBAL_DAILY_CALLS;
        delete process.env.ANTHROPIC_API_KEY;
    });
});

describe('aislamiento entre tenants (canarios)', () => {
    const { knowledge } = require('../../services/knowledge');
    it('B nunca recupera el documento de A, ni con mejor ranking para A', async () => {
        const A = { userId: 'a', tenantId: 'org-a', role: 'user' };
        const B = { userId: 'b', tenantId: 'org-b', role: 'user' };
        const doc = (t, texto) => knowledge.ingest(t, { title: 'Nota interna', content: texto });
        await doc(A, 'canario-alfa-zzq9 liquidación nominas proveedor ' + 'nominas '.repeat(30));
        await doc(B, 'nominas del equipo de B');
        const ctxB = await knowledge.buildContext(B, 'canario-alfa-zzq9 nominas proveedor', { topK: 5 });
        expect(JSON.stringify(ctxB)).not.toContain('canario-alfa-zzq9');
        const ctxA = await knowledge.buildContext(A, 'canario-alfa-zzq9 nominas', { topK: 5 });
        expect(JSON.stringify(ctxA)).toContain('canario-alfa-zzq9');
    });
});
