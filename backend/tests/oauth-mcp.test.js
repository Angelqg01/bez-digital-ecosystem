/**
 * Authorization Server OAuth 2.1 + PKCE del MCP (routes/oauth-mcp.routes.js).
 * Base de datos simulada: cada test encola las respuestas en el orden en que
 * las consultas ocurren.
 */
const request = require('supertest');
const express = require('express');
const bcrypt = require('bcryptjs');

const mockQuery = jest.fn();
jest.mock('../db/pool', () => ({ query: (...a) => mockQuery(...a) }));
const mockTotp = { is2FAEnabled: jest.fn(() => true), verify2FAToken: jest.fn(() => false), decryptSecret: jest.fn((s) => s) };
jest.mock('../services/totp.service', () => mockTotp);

const tokens = require('../services/oauth/tokens');
const { router, wellKnown } = require('../routes/oauth-mcp.routes');

const app = express();
app.use(express.json());
app.use('/', wellKnown);
app.use('/oauth', router);

const REDIRECT = 'https://cliente.example/callback';
const CLIENTE = { client_id: 'bzc_cliente', client_name: 'Codex CLI', redirect_uris: [REDIRECT], is_active: true };
const SESION = 'a'.repeat(64);
const filaPendiente = (extra = {}) => ({
    id: 'code-1', status: 'pendiente', expires_at: new Date(Date.now() + 60_000), intentos_login: 0,
    client_id: CLIENTE.client_id, client_name: CLIENTE.client_name, redirect_uri: REDIRECT,
    scope_solicitado: ['chain.read'], state: 'st1', ...extra,
});

// jest.config.js usa resetMocks: las implementaciones se fijan en cada test.
beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    mockTotp.is2FAEnabled.mockReturnValue(true);
    mockTotp.verify2FAToken.mockReturnValue(false);
    mockTotp.decryptSecret.mockImplementation((s) => s);
});

describe('discovery', () => {
    it('metadata sin implicit y con PKCE S256 obligatorio', async () => {
        const res = await request(app).get('/.well-known/oauth-authorization-server');
        expect(res.status).toBe(200);
        expect(res.body.response_types_supported).toEqual(['code']);
        expect(res.body.code_challenge_methods_supported).toEqual(['S256']);
        expect(res.body.grant_types_supported).not.toContain('implicit');
        expect(res.body.jwks_uri).toBe(`${tokens.ISSUER}/.well-known/jwks.json`);
    });

    it('JWKS publica sólo la clave pública P-256', async () => {
        const res = await request(app).get('/.well-known/jwks.json');
        expect(res.body.keys[0]).toMatchObject({ kty: 'EC', crv: 'P-256', alg: 'ES256', kid: tokens.KID });
        expect(res.body.keys[0]).not.toHaveProperty('d');
    });
});

describe('registro dinámico', () => {
    it('rechaza redirect http fuera de localhost', async () => {
        const res = await request(app).post('/oauth/register').send({ client_name: 'x', redirect_uris: ['http://evil.example/cb'] });
        expect(res.status).toBe(400);
    });

    it('registra un cliente público sin secreto', async () => {
        const res = await request(app).post('/oauth/register').send({ client_name: 'Claude', redirect_uris: [REDIRECT] });
        expect(res.status).toBe(201);
        expect(res.body.client_id).toMatch(/^bzc_[0-9a-f]{32}$/);
        expect(res.body.token_endpoint_auth_method).toBe('none');
        expect(res.body).not.toHaveProperty('client_secret');
    });
});

describe('/oauth/authorize', () => {
    const q = (extra) => ({ response_type: 'code', client_id: CLIENTE.client_id, redirect_uri: REDIRECT,
        code_challenge: 'x'.repeat(43), code_challenge_method: 'S256', scope: 'chain.read', ...extra });

    it('cliente desconocido: 400 sin redirigir', async () => {
        const res = await request(app).get('/oauth/authorize').query(q({ client_id: 'bzc_no' }));
        expect(res.status).toBe(400);
        expect(res.headers.location).toBeUndefined();
    });

    it('rechaza PKCE plain', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [CLIENTE] });
        const res = await request(app).get('/oauth/authorize').query(q({ code_challenge_method: 'plain' }));
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('invalid_request');
    });

    it('rechaza redirect_uri no registrada (no es un open redirect)', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [CLIENTE] });
        const res = await request(app).get('/oauth/authorize').query(q({ redirect_uri: 'https://atacante.example/cb' }));
        expect(res.status).toBe(400);
    });

    it('rechaza scopes fuera de los de consulta', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [CLIENTE] });
        const res = await request(app).get('/oauth/authorize').query(q({ scope: 'payments.execute' }));
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('invalid_scope');
    });

    it('con todo válido redirige a la pantalla de consentimiento', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [CLIENTE] });
        const res = await request(app).get('/oauth/authorize').query(q());
        expect(res.status).toBe(302);
        expect(res.headers.location).toMatch(/^\/oauth\/authorize\/[0-9a-f]{64}$/);
    });
});

describe('pantalla de consentimiento', () => {
    it('el script inline lleva el nonce que autoriza su CSP y no se puede enmarcar', async () => {
        const res = await request(app).get(`/oauth/authorize/${SESION}`);
        const csp = res.headers['content-security-policy'];
        const nonce = (csp.match(/'nonce-([^']+)'/) || [])[1];
        expect(nonce).toBeTruthy();
        expect(res.text).toContain(`<script nonce="${nonce}">`);
        expect(csp).toMatch(/frame-ancestors 'none'/);
        expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    });

    it('contraseña incorrecta: mensaje genérico y cuenta el intento', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [filaPendiente()] });
        mockQuery.mockResolvedValueOnce({ rows: [] });                       // usuario no existe
        mockQuery.mockResolvedValueOnce({ rows: [{ intentos_login: 1 }] });
        const res = await request(app).post(`/oauth/authorize/${SESION}/login`).send({ email: 'x@y.com', password: 'mala' });
        expect(res.status).toBe(401);
        expect(res.body.error_description).toMatch(/4 intentos/);
    });

    it('cuenta con 2FA: pide el código y no lo acepta si es incorrecto', async () => {
        const hash = bcrypt.hashSync('buena-123', 4);
        const usuario = { id: 'u1', email: 'yo@bezhas.com', password: hash, is_2fa_enabled: true, two_factor_secret: 's' };
        mockQuery.mockResolvedValueOnce({ rows: [filaPendiente()] });
        mockQuery.mockResolvedValueOnce({ rows: [usuario] });
        const sin = await request(app).post(`/oauth/authorize/${SESION}/login`).send({ email: usuario.email, password: 'buena-123' });
        expect(sin.body.error).toBe('mfa_required');

        mockQuery.mockResolvedValueOnce({ rows: [filaPendiente()] });
        mockQuery.mockResolvedValueOnce({ rows: [usuario] });
        mockQuery.mockResolvedValueOnce({ rows: [{ intentos_login: 1 }] });
        const mal = await request(app).post(`/oauth/authorize/${SESION}/login`)
            .send({ email: usuario.email, password: 'buena-123', codigo2fa: '000000' });
        expect(mal.status).toBe(401);
    });

    it('login correcto y consentimiento: redirect con code y state', async () => {
        const hash = bcrypt.hashSync('buena-123', 4);
        mockQuery.mockResolvedValueOnce({ rows: [filaPendiente()] });
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'u1', email: 'yo@bezhas.com', password: hash, is_2fa_enabled: false }] });
        mockQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE user_id
        const login = await request(app).post(`/oauth/authorize/${SESION}/login`).send({ email: 'yo@bezhas.com', password: 'buena-123' });
        expect(login.status).toBe(200);

        mockQuery.mockResolvedValueOnce({ rows: [filaPendiente({ user_id: 'u1' })] });
        const ok = await request(app).post(`/oauth/authorize/${SESION}/consent`);
        const url = new URL(ok.body.redirect);
        expect(`${url.origin}${url.pathname}`).toBe(REDIRECT);
        expect(url.searchParams.get('code')).toMatch(/^[0-9a-f]{64}$/);
        expect(url.searchParams.get('state')).toBe('st1');
    });

    it('sin identificarse no se puede autorizar', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [filaPendiente()] });
        const res = await request(app).post(`/oauth/authorize/${SESION}/consent`);
        expect(res.status).toBe(401);
    });
});

describe('/oauth/token', () => {
    const verifier = 'v'.repeat(50);

    it('canje con PKCE correcto (form-urlencoded) emite un JWT verificable para el MCP', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [CLIENTE] });
        mockQuery.mockResolvedValueOnce({ rows: [{ user_id: 'u1', scope_concedido: ['chain.read'], redirect_uri: REDIRECT, code_challenge: tokens.retoDesdeVerifier(verifier) }] });
        const res = await request(app).post('/oauth/token').type('form')
            .send({ grant_type: 'authorization_code', client_id: CLIENTE.client_id, code: 'c', redirect_uri: REDIRECT, code_verifier: verifier });
        expect(res.status).toBe(200);
        const claims = tokens.verificarAccessToken(res.body.access_token);
        expect(claims).toMatchObject({ sub: 'u1', aud: tokens.AUDIENCE, iss: tokens.ISSUER, scope: 'chain.read' });
    });

    it('verifier incorrecto: invalid_grant', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [CLIENTE] });
        mockQuery.mockResolvedValueOnce({ rows: [{ user_id: 'u1', scope_concedido: [], redirect_uri: REDIRECT, code_challenge: tokens.retoDesdeVerifier(verifier) }] });
        const res = await request(app).post('/oauth/token').type('form')
            .send({ grant_type: 'authorization_code', client_id: CLIENTE.client_id, code: 'c', redirect_uri: REDIRECT, code_verifier: 'w'.repeat(50) });
        expect(res.body.error).toBe('invalid_grant');
    });

    it('refresh reutilizado revoca la familia entera', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [CLIENTE] });
        mockQuery.mockResolvedValueOnce({ rows: [] });
        mockQuery.mockResolvedValueOnce({ rows: [{ family_id: 'fam', used_at: new Date(), revoked_at: null }] });
        jest.spyOn(console, 'error').mockImplementation(() => {});
        const res = await request(app).post('/oauth/token').type('form')
            .send({ grant_type: 'refresh_token', client_id: CLIENTE.client_id, refresh_token: 'r'.repeat(64) });
        expect(res.body.error).toBe('invalid_grant');
        expect(String(mockQuery.mock.calls[3][0])).toMatch(/family_id = \$1/);
        console.error.mockRestore();
    });

    it('implicit no existe', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [CLIENTE] });
        const res = await request(app).post('/oauth/token').type('form').send({ grant_type: 'implicit', client_id: CLIENTE.client_id });
        expect(res.body.error).toBe('unsupported_grant_type');
    });

    it('revoke responde 200 siempre', async () => {
        const res = await request(app).post('/oauth/revoke').type('form').send({ client_id: 'bzc_x', token: 'no-existe' });
        expect(res.status).toBe(200);
    });
});

describe('claves', () => {
    it('en producción real sin claves no arranca', () => {
        const antes = { ...process.env };
        try {
            process.env.NODE_ENV = 'production';
            delete process.env.JEST_WORKER_ID;
            delete process.env.OAUTH_JWT_PRIVATE_KEY;
            delete process.env.OAUTH_JWT_PUBLIC_KEY;
            let t;
            jest.isolateModules(() => { t = require('../services/oauth/tokens'); });
            expect(() => t.claves()).toThrow(/obligatorias en producción/);
        } finally {
            process.env = antes;
        }
    });
});
