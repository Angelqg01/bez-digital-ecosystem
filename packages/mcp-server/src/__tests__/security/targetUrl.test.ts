/**
 * El auditor de páginas solo pide páginas de BeZhas (cierra el SSRF de
 * /api/mcp/playwright y de la herramienta playwright_automation).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { urlAuditable, UrlNoPermitida } from '../../security/targetUrl.js';
import app from '../../http-server.js';

describe('urlAuditable', () => {
    it('acepta las páginas de BeZhas y conserva ruta y consulta', () => {
        expect(urlAuditable('https://www.bezhas.com/precios?plan=pro')).toBe('https://www.bezhas.com/precios?plan=pro');
        expect(urlAuditable('https://API.bezhas.com/api/health')).toBe('https://api.bezhas.com/api/health');
    });

    it.each([
        ['el servidor de metadatos', 'http://169.254.169.254/computeMetadata/v1/'],
        ['un host ajeno', 'https://example.com'],
        ['un host que solo empieza por el nuestro', 'https://bezhas.com.evil.example'],
        ['http sin cifrar', 'http://www.bezhas.com'],
        ['otro puerto', 'https://www.bezhas.com:8080'],
        ['credenciales en la URL', 'https://user:pass@www.bezhas.com'],
        ['algo que no es una URL', 'no-es-una-url'],
    ])('rechaza %s', (_caso, url) => {
        expect(() => urlAuditable(url)).toThrow(UrlNoPermitida);
    });
});

describe('POST /api/mcp/playwright', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('no hace la petición a un destino fuera de la lista', async () => {
        const fetchEspia = vi.fn();
        vi.stubGlobal('fetch', fetchEspia);

        const r = await request(app)
            .post('/api/mcp/playwright')
            .send({ action: 'test_page_load', targetUrl: 'http://169.254.169.254/computeMetadata/v1/' })
            .expect(400);

        expect(r.body.status).toBe('FAILED');
        expect(fetchEspia).not.toHaveBeenCalled();
    });
});
