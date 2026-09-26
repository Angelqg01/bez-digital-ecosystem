/**
 * MCP público con OAuth 2.1: lo que ve un cliente de Claude, Codex o Gemini.
 *
 * El token se firma aquí con un par ES256 de usar y tirar, y la pública se
 * inyecta por OAUTH_JWT_PUBLIC_KEY para no depender del JWKS del backend.
 */
import crypto from 'node:crypto';
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

const ISSUER = 'https://api.test.bezhas';
const RECURSO = 'https://mcp.test.bezhas';
const par = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const otroPar = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });

let app: Express;

beforeAll(async () => {
    process.env.OAUTH_ISSUER = ISSUER;
    process.env.MCP_PUBLIC_URL = RECURSO;
    process.env.OAUTH_JWT_PUBLIC_KEY = par.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    // Las constantes de `auth/bearer.ts` se leen al cargar: el import va después.
    app = (await import('../http-server.js')).default as unknown as Express;
});

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

function firmar(claims: Record<string, unknown>, clave: crypto.KeyObject = par.privateKey, alg = 'ES256') {
    const ahora = Math.floor(Date.now() / 1000);
    const cuerpo = { iss: ISSUER, aud: RECURSO, sub: 'user-1', iat: ahora, exp: ahora + 600, ...claims };
    const entrada = `${b64({ alg, typ: 'JWT', kid: 'mcp-oauth-1' })}.${b64(cuerpo)}`;
    const firma = crypto.sign('sha256', Buffer.from(entrada), { key: clave, dsaEncoding: 'ieee-p1363' });
    return `${entrada}.${firma.toString('base64url')}`;
}

const rpc = (token: string | null, method: string, params: unknown = {}) => {
    const r = request(app)
        .post('/mcp')
        .set('Accept', 'application/json, text/event-stream')
        .set('Content-Type', 'application/json');
    if (token) r.set('Authorization', `Bearer ${token}`);
    return r.send({ jsonrpc: '2.0', id: 1, method, params });
};

const nombres = (r: request.Response) => (r.body.result.tools as Array<{ name: string }>).map((t) => t.name).sort();

describe('descubrimiento OAuth', () => {
    it('publica la metadata del recurso protegido (RFC 9728)', async () => {
        const r = await request(app).get('/.well-known/oauth-protected-resource').expect(200);
        expect(r.body.resource).toBe(RECURSO);
        expect(r.body.authorization_servers).toEqual([ISSUER]);
        expect(r.body.scopes_supported).toEqual(['chain.read', 'payments.quote']);

        await request(app).get('/.well-known/oauth-protected-resource/mcp').expect(200);
    });

    it('sin token responde 401 y señala dónde está la metadata', async () => {
        const r = await rpc(null, 'tools/list').expect(401);
        expect(r.headers['www-authenticate']).toBe(
            `Bearer resource_metadata="${RECURSO}/.well-known/oauth-protected-resource"`,
        );
    });
});

describe('verificación del token', () => {
    it.each([
        ['firmado con otra clave', () => firmar({ scope: 'chain.read' }, otroPar.privateKey)],
        ['caducado', () => firmar({ scope: 'chain.read', exp: Math.floor(Date.now() / 1000) - 120 })],
        ['de otro emisor', () => firmar({ scope: 'chain.read', iss: 'https://evil.example' })],
        ['para otra audiencia', () => firmar({ scope: 'chain.read', aud: 'https://otro.example' })],
        ['con alg distinto de ES256', () => firmar({ scope: 'chain.read' }, par.privateKey, 'HS256')],
    ])('rechaza un token %s', async (_caso, token) => {
        const r = await rpc(token(), 'tools/list').expect(401);
        expect(r.headers['www-authenticate']).toContain('error="invalid_token"');
    });

    it('rechaza un alg none sin firma', async () => {
        const token = `${b64({ alg: 'none' })}.${b64({ iss: ISSUER, aud: RECURSO, sub: 'x', exp: 9e9 })}.x`;
        await rpc(token, 'tools/list').expect(401);
    });
});

describe('herramientas según los scopes concedidos', () => {
    it('chain.read + payments.quote: sólo la lista pública', async () => {
        const r = await rpc(firmar({ scope: 'chain.read payments.quote' }), 'tools/list').expect(200);
        expect(nombres(r)).toEqual([
            'analyze_gas_strategy', 'blockscout_explorer', 'get_payment_quote', 'get_wallet_balance',
        ]);
    });

    it('sólo chain.read: no aparece la cotización', async () => {
        const r = await rpc(firmar({ scope: 'chain.read' }), 'tools/list').expect(200);
        expect(nombres(r)).toEqual(['analyze_gas_strategy', 'blockscout_explorer', 'get_wallet_balance']);
    });

    it('una herramienta interna no se puede invocar aunque se conozca su nombre', async () => {
        const r = await rpc(firmar({ scope: 'chain.read payments.quote' }), 'tools/call', {
            name: 'process_stripe_payment',
            arguments: {},
        }).expect(200);
        const fallo = r.body.error ?? (r.body.result?.isError ? r.body.result : null);
        expect(fallo).toBeTruthy();
        expect(JSON.stringify(r.body)).not.toMatch(/"success":\s*true/);
    });
});

describe('transporte sin estado', () => {
    it.each(['get', 'delete'] as const)('%s /mcp responde 405', async (metodo) => {
        const r = await request(app)[metodo]('/mcp').expect(405);
        expect(r.headers.allow).toBe('POST');
    });
});
