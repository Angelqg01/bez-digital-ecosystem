/**
 * Subida de archivos para NFT: sólo con plan suscrito, sin ejecutables, sin leer el contenido ni llevarlo al RAG.
 */
const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');
const { mockQuery, makeToken } = require('../helpers');

jest.mock('../../services/ipfsService', () => ({
    pinFile: jest.fn(async (buf, name) => ({ ipfsHash: 'QmTest', ipfsUri: 'ipfs://QmTest', gatewayUrl: 'https://gw/ipfs/QmTest', name })),
}));
const ipfs = require('../../services/ipfsService');
const { inspeccionarArchivo, nombreSeguro } = require('../../utils/uploadGuard');
const { _cache } = require('../../services/ai-workspace/principal');

const rutas = require('../../routes/nft-assets');
const app = () => { const a = express(); a.use('/api/nft-assets', rutas); return a; };

const ORGS = {
    1: { organization_id: 'org-a', role: 'owner', plan: 'business', app_id: 'app-a' },
    4: { organization_id: 'org-c', role: 'owner', plan: null, app_id: null }, // organización sin plan
};
beforeEach(() => {
    _cache.clear();
    ipfs.pinFile.mockClear();
    mockQuery.mockReset();
    mockQuery.mockImplementation(async (sql, params) => (/FROM organization_members/.test(sql) ? { rows: ORGS[params[0]] ? [ORGS[params[0]]] : [] } : { rows: [], rowCount: 0 }));
});

// ── Ficheros mínimos con la firma real ──
const pad = (head, n = 64) => Buffer.concat([Buffer.from(head), Buffer.alloc(n)]);
const PNG = pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPG = pad([0xff, 0xd8, 0xff, 0xe0]);
const GIF = pad(Buffer.from('GIF89a'));
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(64)]);
const MP3 = pad(Buffer.from('ID3'));
const PDF = Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');
const EXE = pad(Buffer.from('MZ'));
const ELF = pad([0x7f, 0x45, 0x4c, 0x46]);
const ZIP = pad([0x50, 0x4b, 0x03, 0x04]);
const SH = Buffer.from('#!/bin/sh\nrm -rf /\n');

const subir = (token, body, tipo, extra = {}) => {
    let r = request(app()).post('/api/nft-assets').set('Authorization', `Bearer ${token}`).set('Content-Type', tipo);
    for (const [k, v] of Object.entries(extra)) r = r.set(k, v);
    return r.send(body);
};
const token = (id) => makeToken({ userId: id, role: 'user' });

describe('sesión y plan', () => {
    it('sin token → 401 y no se anexa nada', async () => {
        const res = await request(app()).post('/api/nft-assets').set('Content-Type', 'image/png').send(PNG);
        expect(res.status).toBe(401);
        expect(ipfs.pinFile).not.toHaveBeenCalled();
    });
    it('con sesión pero SIN plan suscrito → 402 PLAN_REQUIRED', async () => {
        const res = await subir(token(4), PNG, 'image/png');
        expect(res.status).toBe(402);
        expect(res.body.code).toBe('PLAN_REQUIRED');
        expect(ipfs.pinFile).not.toHaveBeenCalled();
    });
    it('usuario sin organización (sin plan) → 402', async () => {
        expect((await subir(token(9), PNG, 'image/png')).status).toBe(402);
    });
    it('con plan: 201 con CID, hash y tipo', async () => {
        const res = await subir(token(1), PNG, 'image/png', { 'x-file-name': '../../mi foto.png' });
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ cid: 'QmTest', ipfsUri: 'ipfs://QmTest', kind: 'image', mime: 'image/png', size: PNG.length });
        expect(res.body.sha256).toMatch(/^0x[0-9a-f]{64}$/);
        expect(res.body.fileName).toBe('mi_foto.png');
        expect(ipfs.pinFile).toHaveBeenCalledWith(expect.any(Buffer), 'mi_foto.png');
    });
});

describe('ejecutables y tipos no permitidos', () => {
    it.each([
        ['exe de Windows con Content-Type de imagen', EXE, 'image/png'],
        ['exe de Windows como octet-stream', EXE, 'application/octet-stream'],
        ['ELF de Linux', ELF, 'image/jpeg'],
        ['script de shell', SH, 'text/plain'],
        ['ZIP/JAR/APK/docx', ZIP, 'application/pdf'],
    ])('%s → rechazado y sin anexar', async (_, buf, tipo) => {
        const res = await subir(token(1), buf, tipo);
        expect([415]).toContain(res.status);
        expect(ipfs.pinFile).not.toHaveBeenCalled();
    });
    it('un .exe renombrado a .png: se mira la firma, no el nombre', async () => {
        const res = await subir(token(1), EXE, 'image/png', { 'x-file-name': 'foto.png' });
        expect(res.status).toBe(415);
        expect(res.body.code).toBe('FORBIDDEN_TYPE');
    });
    it('JSON, texto y multipart no se aceptan', async () => {
        for (const tipo of ['application/json', 'text/plain', 'multipart/form-data; boundary=x']) {
            const res = await subir(token(1), Buffer.from('{"a":1}'), tipo);
            expect(res.status).toBe(415);
        }
        expect(ipfs.pinFile).not.toHaveBeenCalled();
    });
    it('el tipo declarado debe coincidir con el contenido (PNG enviado como PDF)', async () => {
        const res = await subir(token(1), PNG, 'application/pdf');
        expect(res.status).toBe(415);
        expect(res.body.code).toBe('MIME_MISMATCH');
    });
    it('desactivable con NFT_UPLOADS_ENABLED=false', async () => {
        process.env.NFT_UPLOADS_ENABLED = 'false';
        try { expect((await subir(token(1), PNG, 'image/png')).status).toBe(503); } finally { delete process.env.NFT_UPLOADS_ENABLED; }
    });
    it('sin credenciales de IPFS → 503 (no hay modo simulado)', async () => {
        ipfs.pinFile.mockRejectedValueOnce(new Error('IPFS: No Pinata credentials configured'));
        const res = await subir(token(1), PNG, 'image/png');
        expect(res.status).toBe(503);
        expect(res.body.code).toBe('IPFS_NOT_CONFIGURED');
    });
});

describe('inspeccionarArchivo', () => {
    it('acepta imagen, vídeo, audio y PDF limpios', () => {
        expect(inspeccionarArchivo(PNG, 'image/png').kind).toBe('image');
        expect(inspeccionarArchivo(JPG, 'image/jpeg').kind).toBe('image');
        expect(inspeccionarArchivo(GIF, 'image/gif').kind).toBe('image');
        expect(inspeccionarArchivo(MP4, 'video/mp4').kind).toBe('video');
        expect(inspeccionarArchivo(MP3, 'audio/mpeg').kind).toBe('audio');
        expect(inspeccionarArchivo(PDF, 'application/pdf').kind).toBe('pdf');
    });
    it('rechaza un PDF con JavaScript o archivos adjuntos', () => {
        for (const marca of ['/JavaScript', '/JS', '/Launch', '/EmbeddedFile', '/OpenAction']) {
            const pdf = Buffer.from(`%PDF-1.7\n<< ${marca} (x) >>\n%%EOF`);
            expect(() => inspeccionarArchivo(pdf, 'application/pdf')).toThrow(/contenido activo/);
        }
    });
    it('rechaza un ejecutable de Windows pegado detrás de una imagen válida (políglota)', () => {
        const poli = Buffer.concat([PNG, Buffer.from('This program cannot be run in DOS mode')]);
        expect(() => inspeccionarArchivo(poli, 'image/png')).toThrow(/ejecutable incrustado/);
    });
    it('rechaza SVG y HTML (pueden llevar scripts)', () => {
        expect(() => inspeccionarArchivo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>'), 'image/svg+xml')).toThrow(/prohibido/);
        expect(() => inspeccionarArchivo(Buffer.from('<html><body>hola</body></html>'), 'text/html')).toThrow(/prohibido/);
    });
    it('rechaza vacío y demasiado grande', () => {
        expect(() => inspeccionarArchivo(Buffer.alloc(0), 'image/png')).toThrow(/vacío/);
        expect(() => inspeccionarArchivo(Buffer.concat([PNG, Buffer.alloc(11 * 1024 * 1024)]), 'image/png')).toThrow(/10 MB/);
    });
    it('nombreSeguro quita rutas y caracteres raros', () => {
        expect(nombreSeguro('../../etc/passwd')).toBe('passwd');
        expect(nombreSeguro('C:\\x\\a b.png')).toBe('a_b.png');
        expect(nombreSeguro('..hidden')).toBe('hidden');
        expect(nombreSeguro('')).toBe('archivo');
    });
});

describe('los archivos nunca se leen ni llegan al RAG ni al modelo', () => {
    const lee = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');
    const ficherosDe = (dir) => fs.readdirSync(path.join(__dirname, '..', '..', dir)).filter((f) => f.endsWith('.js')).map((f) => [`${dir}/${f}`, lee(dir, f)]);

    it('la ruta y el validador no importan el RAG, el chat ni parsers de documentos', () => {
        const requires = (src) => (src.match(/require\([^)]*\)/g) || []).join('\n'); // sólo imports, no comentarios
        for (const src of [requires(lee('routes', 'nft-assets.js')), requires(lee('utils', 'uploadGuard.js'))]) {
            expect(src).not.toMatch(/services\/knowledge|knowledge\.service|ai-workspace\/(?:gateway|shield|hooks|conversations)/);
            expect(src).not.toMatch(/require\(['"](?:pdf-parse|pdfjs|mammoth|textract|officeparser|xlsx|tesseract|docx)/);
        }
    });
    it('el RAG y el chat no importan la subida de archivos ni el servicio IPFS', () => {
        for (const [nombre, src] of [...ficherosDe('services/knowledge'), ...ficherosDe('services/ai-workspace'), ['routes/ai-workspace.js', lee('routes', 'ai-workspace.js')]]) {
            expect({ nombre, ok: !/nft-assets|uploadGuard|ipfsService|pinFile/.test(src) }).toEqual({ nombre, ok: true });
        }
    });
    it('el contenido del archivo no se decodifica como utf8 en la ruta', () => {
        expect(lee('routes', 'nft-assets.js')).not.toMatch(/toString\(\s*['"]utf-?8['"]|\.toString\(\)/);
    });
});
