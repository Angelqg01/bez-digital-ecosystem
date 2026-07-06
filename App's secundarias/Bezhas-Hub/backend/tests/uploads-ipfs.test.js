/**
 * Test de contrato de /api/uploads/upload-ipfs (Fase 3D — quitar mocks).
 *
 * Verifica el reemplazo del hash aleatorio (Math.random) por:
 *  - subida REAL vía ipfs.service cuando llega `content` (base64),
 *  - CID determinista + mock:true cuando no hay contenido.
 * Monta la ruta real sobre un express mínimo (sin booteo de server.js).
 */
const express = require('express');
const request = require('supertest');
const uploadsRoutes = require('../routes/uploads.routes');

function buildApp() {
    const app = express();
    app.use(express.json({ limit: '5mb' }));
    app.use('/api/uploads', uploadsRoutes);
    return app;
}

describe('/api/uploads/upload-ipfs (Fase 3D)', () => {
    const app = buildApp();
    const meta = { fileName: 'contrato.pdf', fileSize: 2048, fileType: 'application/pdf' };

    it('preserva la forma de respuesta {success, hash, url, upload}', async () => {
        const res = await request(app).post('/api/uploads/upload-ipfs').send(meta);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ success: true });
        expect(res.body).toHaveProperty('hash');
        expect(res.body).toHaveProperty('url');
        expect(res.body.upload).toMatchObject({
            fileName: meta.fileName, fileSize: meta.fileSize, fileType: meta.fileType,
        });
        expect(res.body.upload).toHaveProperty('hash', res.body.hash);
    });

    it('SIN contenido: hash determinista (mismo input → mismo hash) y mock:true', async () => {
        const a = await request(app).post('/api/uploads/upload-ipfs').send(meta);
        const b = await request(app).post('/api/uploads/upload-ipfs').send(meta);
        expect(a.body.hash).toBe(b.body.hash);          // ← antes con Math.random esto fallaba
        expect(a.body.hash).toMatch(/^Qm[0-9a-f]{44}$/); // derivado de sha256
        expect(a.body.mock).toBe(true);
    });

    it('inputs distintos → hashes distintos', async () => {
        const a = await request(app).post('/api/uploads/upload-ipfs').send(meta);
        const b = await request(app).post('/api/uploads/upload-ipfs').send({ ...meta, fileName: 'otro.pdf' });
        expect(a.body.hash).not.toBe(b.body.hash);
    });

    it('CON contenido base64: sube vía ipfs.service (real o mock honesto), size del buffer', async () => {
        const content = Buffer.from('hola mundo bezhas').toString('base64');
        const res = await request(app).post('/api/uploads/upload-ipfs').send({ ...meta, content });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.hash).toMatch(/^(Qm|baf)/); // CIDv0/v1
        expect(typeof res.body.mock).toBe('boolean');
    }, 15000);

    it('valida campos requeridos (400 sin fileName)', async () => {
        const res = await request(app).post('/api/uploads/upload-ipfs').send({ fileSize: 1, fileType: 'x' });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('errors');
    });

    it('el upload queda recuperable por /file/:hash', async () => {
        const up = await request(app).post('/api/uploads/upload-ipfs').send(meta);
        const got = await request(app).get(`/api/uploads/file/${up.body.hash}`);
        expect(got.status).toBe(200);
        expect(got.body.hash).toBe(up.body.hash);
    });
});
