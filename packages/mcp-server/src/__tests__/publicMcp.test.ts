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
import http from 'node:http';

const ISSUER = 'https://api.test.bezhas';
const RECURSO = 'https://mcp.test.bezhas';
const par = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const otroPar = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });

let app: Express;
// Backend simulado: registra la cabecera Authorization que reenvía el MCP y devuelve URLs de pago.
const recibidas: Array<{ path: string; auth?: string; body: string }> = [];
let urlPago = 'https://checkout.stripe.com/c/pay/cs_test_abcdefghij123';
let backend: http.Server;

beforeAll(async () => {
    backend = http.createServer((req, res) => {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
            recibidas.push({ path: req.url || '', auth: req.headers.authorization, body });
            res.setHeader('Content-Type', 'application/json');
            if (req.url === '/api/checkout/plans') return res.end(JSON.stringify({ success: true, plans: [{ id: 'creator', priceMonthly: 99 }] }));
            if (req.url === '/api/checkout/bez' && JSON.parse(body || '{}').amountEur < 10) {
                res.statusCode = 400;
                return res.end(JSON.stringify({ success: false, code: 'INVALID_AMOUNT', message: 'El importe debe estar entre 10 y 5000 EUR' }));
            }
            res.end(JSON.stringify({ success: true, url: urlPago, plan: 'creator', cycle: 'monthly', amount: 99, currency: 'EUR' }));
        });
    });
    await new Promise<void>((r) => backend.listen(0, '127.0.0.1', r));
    process.env.BACKEND_URL = `http://127.0.0.1:${(backend.address() as { port: number }).port}`;
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
        expect(r.body.scopes_supported).toEqual(['chain.read', 'payments.quote', 'billing.checkout']);

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
        ['con la audiencia como prefijo de otro host', () => firmar({ scope: 'chain.read', aud: `${RECURSO}.evil.example` })],
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

describe('planes y pagos por MCP (scope billing.checkout)', () => {
    const llamar = (token: string, name: string, args: unknown) => rpc(token, 'tools/call', { name, arguments: args });
    const texto = (r: request.Response) => JSON.parse(r.body.result.content[0].text);

    it('billing.checkout expone solo las tres herramientas de plan/pago', async () => {
        const r = await rpc(firmar({ scope: 'billing.checkout' }), 'tools/list').expect(200);
        expect(nombres(r)).toEqual(['create_bez_checkout', 'create_plan_checkout', 'list_plans']);
    });

    it('sin el scope no hay herramientas de pago y no se pueden invocar', async () => {
        const token = firmar({ scope: 'chain.read payments.quote' });
        const r = await rpc(token, 'tools/list').expect(200);
        expect(nombres(r).some((n) => n.includes('checkout') || n === 'list_plans')).toBe(false);
        recibidas.length = 0;
        await llamar(token, 'create_plan_checkout', { planId: 'creator', cycle: 'monthly' }).expect(200);
        expect(recibidas).toHaveLength(0);
    });

    it('reenvía el token DE LA PERSONA al backend y devuelve el enlace de Stripe', async () => {
        recibidas.length = 0;
        const token = firmar({ scope: 'billing.checkout' });
        const r = await llamar(token, 'create_plan_checkout', { planId: 'creator', cycle: 'yearly' }).expect(200);
        const out = texto(r);
        expect(out.checkoutUrl).toMatch(/^https:\/\/checkout\.stripe\.com\//);
        expect(out.notice).toMatch(/Stripe/);
        expect(recibidas[0].auth).toBe(`Bearer ${token}`);
        expect(JSON.parse(recibidas[0].body)).toEqual({ planId: 'creator', cycle: 'yearly' });
    });

    it('rechaza planes no comprables antes de llamar al backend', async () => {
        recibidas.length = 0;
        const r = await llamar(firmar({ scope: 'billing.checkout' }), 'create_plan_checkout', { planId: 'starter', cycle: 'monthly' }).expect(200);
        expect(r.body.error ?? r.body.result?.isError).toBeTruthy();
        expect(recibidas).toHaveLength(0);
    });

    it('si el backend devolviera una URL que no es de Stripe, no se entrega', async () => {
        urlPago = 'https://evil.example/pay';
        try {
            const r = await llamar(firmar({ scope: 'billing.checkout' }), 'create_bez_checkout', { amountFiat: 25, currency: 'EUR' }).expect(200);
            expect(r.body.result.isError).toBe(true);
            expect(JSON.stringify(r.body)).not.toContain('evil.example');
        } finally {
            urlPago = 'https://checkout.stripe.com/c/pay/cs_test_abcdefghij123';
        }
    });

    it('transmite el error de validación del servidor (importe fuera de rango)', async () => {
        const r = await llamar(firmar({ scope: 'billing.checkout' }), 'create_bez_checkout', { amountFiat: 5, currency: 'EUR' }).expect(200);
        expect(r.body.result.isError).toBe(true);
        expect(texto(r).code).toBe('INVALID_AMOUNT');
    });

    it('list_plans devuelve el catálogo del servidor', async () => {
        const r = await llamar(firmar({ scope: 'billing.checkout' }), 'list_plans', {}).expect(200);
        expect(texto(r).plans[0].priceMonthly).toBe(99);
    });
});
