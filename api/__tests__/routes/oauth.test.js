const request = require('supertest');
const bcrypt = require('bcryptjs');
const { mockQuery } = require('../helpers');
const app = require('../../index');
const oauthTokens = require('../../services/oauthTokens');

const CLIENTE_ACTIVO = {
    client_id: 'bzc_cliente1', client_name: 'Codex CLI', is_active: true, client_type: 'public',
    redirect_uris: ['https://cliente.example/callback'],
};

describe('Authorization Server OAuth 2.1 + PKCE (/oauth, /.well-known)', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('discovery', () => {
        it('publica metadata sin implicit y con PKCE S256 obligatorio', async () => {
            const res = await request(app).get('/.well-known/oauth-authorization-server');
            expect(res.status).toBe(200);
            expect(res.body.response_types_supported).toEqual(['code']);
            expect(res.body.grant_types_supported).toEqual(
                expect.arrayContaining(['authorization_code', 'refresh_token']));
            expect(res.body.grant_types_supported).not.toContain('implicit');
            expect(res.body.code_challenge_methods_supported).toEqual(['S256']);
        });

        it('el recurso protegido apunta al mismo issuer', async () => {
            const res = await request(app).get('/.well-known/oauth-protected-resource');
            expect(res.status).toBe(200);
            expect(res.body.authorization_servers).toContain(oauthTokens.ISSUER);
        });

        it('jwks.json publica sólo la clave pública EC P-256', async () => {
            const res = await request(app).get('/.well-known/jwks.json');
            expect(res.status).toBe(200);
            expect(res.body.keys[0].kty).toBe('EC');
            expect(res.body.keys[0].crv).toBe('P-256');
            expect(res.body.keys[0]).not.toHaveProperty('d'); // 'd' = componente privada de un JWK EC
        });
    });

    describe('registro dinámico de clientes (DCR)', () => {
        it('rechaza redirect_uri por HTTP fuera de localhost', async () => {
            const res = await request(app).post('/oauth/register')
                .send({ client_name: 'App maliciosa', redirect_uris: ['http://evil.example/cb'] });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('invalid_redirect_uri');
        });

        it('rechaza sin client_name', async () => {
            const res = await request(app).post('/oauth/register')
                .send({ redirect_uris: ['https://cliente.example/cb'] });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('invalid_client_metadata');
        });

        it('registra un cliente público válido y no le asigna client_secret', async () => {
            const res = await request(app).post('/oauth/register')
                .send({ client_name: 'Codex CLI', redirect_uris: ['https://cliente.example/cb'] });
            expect(res.status).toBe(201);
            expect(res.body.client_id).toMatch(/^bzc_[0-9a-f]{32}$/);
            expect(res.body.token_endpoint_auth_method).toBe('none');
            expect(res.body).not.toHaveProperty('client_secret');
        });
    });

    describe('GET /oauth/authorize', () => {
        it('sin client_id no hay a dónde redirigir: 400 en vez de redirect', async () => {
            const res = await request(app).get('/oauth/authorize').query({ response_type: 'code' });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('invalid_client');
            expect(mockQuery).not.toHaveBeenCalled();
        });

        it('client_id desconocido: 400 invalid_client', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });
            const res = await request(app).get('/oauth/authorize')
                .query({ response_type: 'code', client_id: 'bzc_no_existe' });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('invalid_client');
        });

        it('rechaza code_challenge_method=plain: PKCE es obligatorio y sólo S256', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [CLIENTE_ACTIVO] });
            const res = await request(app).get('/oauth/authorize').query({
                response_type: 'code', client_id: CLIENTE_ACTIVO.client_id,
                redirect_uri: CLIENTE_ACTIVO.redirect_uris[0],
                code_challenge: 'x'.repeat(43), code_challenge_method: 'plain',
                scope: 'token',
            });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('invalid_request');
        });

        it('rechaza un scope fuera del máximo permitido (p. ej. admin)', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [CLIENTE_ACTIVO] });
            const res = await request(app).get('/oauth/authorize').query({
                response_type: 'code', client_id: CLIENTE_ACTIVO.client_id,
                redirect_uri: CLIENTE_ACTIVO.redirect_uris[0],
                code_challenge: 'x'.repeat(43), code_challenge_method: 'S256',
                scope: 'admin',
            });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('invalid_scope');
        });

        it('rechaza una redirect_uri no registrada para ese cliente', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [CLIENTE_ACTIVO] });
            const res = await request(app).get('/oauth/authorize').query({
                response_type: 'code', client_id: CLIENTE_ACTIVO.client_id,
                redirect_uri: 'https://otro-sitio.example/cb',
                code_challenge: 'x'.repeat(43), code_challenge_method: 'S256',
                scope: 'token',
            });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('invalid_request');
        });

        it('con todo válido, crea la sesión y redirige a la pantalla de consentimiento', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [CLIENTE_ACTIVO] }); // _cargarCliente
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });  // INSERT oauth_authorization_codes
            const res = await request(app).get('/oauth/authorize').query({
                response_type: 'code', client_id: CLIENTE_ACTIVO.client_id,
                redirect_uri: CLIENTE_ACTIVO.redirect_uris[0],
                code_challenge: 'x'.repeat(43), code_challenge_method: 'S256',
                scope: 'token wallet', state: 'abc123',
            });
            expect(res.status).toBe(302);
            expect(res.headers.location).toMatch(/^\/oauth\/authorize\/[0-9a-f]{64}$/);
        });
    });

    describe('pantalla de consentimiento', () => {
        const TOKEN = 'a'.repeat(64);

        it('sirve HTML en GET /oauth/authorize/:token', async () => {
            const res = await request(app).get(`/oauth/authorize/${TOKEN}`);
            expect(res.status).toBe(200);
            expect(res.type).toBe('text/html');
            expect(res.text).toContain('BeZhas');
        });

        it.each([
            ['consentimiento OAuth', `/oauth/authorize/${'a'.repeat(64)}`],
            ['onboarding', `/o/${'a'.repeat(64)}`],
            ['checkout', `/c/${'a'.repeat(32)}`],
        ])('pantalla alojada (%s): el script inline lleva el nonce que autoriza su CSP', async (_n, ruta) => {
            // Con el CSP global de helmet (script-src 'self') el navegador
            // bloqueaba el <script> inline y la pantalla se quedaba en
            // "Cargando…". Sólo lo detecta un navegador: aquí se comprueba que
            // cabecera y HTML llevan el MISMO nonce, y que no se abre unsafe-inline.
            const res = await request(app).get(ruta);
            expect(res.status).toBe(200);
            const csp = res.headers['content-security-policy'];
            const nonce = (csp.match(/'nonce-([^']+)'/) || [])[1];
            expect(nonce).toBeTruthy();
            expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
            expect(csp).toMatch(/frame-ancestors 'none'/);
            expect(res.text).toContain(`<script nonce="${nonce}">`);
            expect(res.text).not.toMatch(/<script>/);
        });

        it('un token sin fila coincidente es "enlace no válido", no un 500', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });
            const res = await request(app).get(`/oauth/authorize/${TOKEN}/status`);
            expect(res.status).toBe(404);
            expect(res.body.error).toBe('invalid_session');
        });

        it('login con credenciales incorrectas: mensaje genérico y cuenta el intento', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'code-1', status: 'pendiente', expires_at: new Date(Date.now() + 60000), intentos_login: 0 }],
            });
            mockQuery.mockResolvedValueOnce({ rows: [] }); // usuario no existe
            mockQuery.mockResolvedValueOnce({ rows: [{ intentos_login: 1 }] }); // UPDATE intentos

            const res = await request(app).post(`/oauth/authorize/${TOKEN}/login`)
                .send({ email: 'nadie@example.com', password: 'lo-que-sea' });
            expect(res.status).toBe(401);
            expect(res.body.error).toBe('invalid_credentials');
            expect(res.body.error_description).toMatch(/4 intentos/);
        });

        it('login correcto devuelve las organizaciones de la persona', async () => {
            const hash = bcrypt.hashSync('correcta123', 4);
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'code-1', status: 'pendiente', expires_at: new Date(Date.now() + 60000), intentos_login: 0 }],
            });
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'user-1', email: 'yo@bezhas.com', username: 'yo', password_hash: hash }],
            });
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // UPDATE user_id
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'org-1', name: 'Acme', verification_status: 'verified', legacy_enterprise_id: 'ent-1', role: 'owner' }],
            });

            const res = await request(app).post(`/oauth/authorize/${TOKEN}/login`)
                .send({ email: 'yo@bezhas.com', password: 'correcta123' });
            expect(res.status).toBe(200);
            expect(res.body.organizaciones[0].puedeConectar).toBe(true);
        });

        it('consent sin organizationId: 400', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{
                    id: 'code-1', status: 'pendiente', expires_at: new Date(Date.now() + 60000),
                    user_id: 'user-1',
                }],
            });
            const res = await request(app).post(`/oauth/authorize/${TOKEN}/consent`).send({});
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('invalid_request');
        });

        it('consent válido crea/actualiza el app_registry y devuelve la redirect_uri con el code', async () => {
            const filaCodigo = {
                id: 'code-1', status: 'pendiente', expires_at: new Date(Date.now() + 60000),
                user_id: 'user-1', client_id: CLIENTE_ACTIVO.client_id,
                redirect_uri: CLIENTE_ACTIVO.redirect_uris[0],
                scope_solicitado: ['token'], state: 'abc123',
            };
            mockQuery.mockResolvedValueOnce({ rows: [filaCodigo] });               // _fila
            mockQuery.mockResolvedValueOnce({                                      // verificarMembresia
                rows: [{ id: 'org-1', name: 'Acme', legacy_enterprise_id: 'ent-1', role: 'owner' }],
            });
            mockQuery.mockResolvedValueOnce({ rows: [] });                          // SELECT app_registry existente
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'app-99' }] });           // INSERT app_registry
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });             // UPDATE oauth_authorization_codes

            const res = await request(app).post(`/oauth/authorize/${TOKEN}/consent`)
                .send({ organizationId: 'org-1' });
            expect(res.status).toBe(200);
            expect(res.body.redirect).toMatch(new RegExp(`^${CLIENTE_ACTIVO.redirect_uris[0]}\\?code=`));
            expect(res.body.redirect).toContain('state=abc123');
        });

        it('deny redirige con error=access_denied y sin exponer nada más', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'code-1', redirect_uri: CLIENTE_ACTIVO.redirect_uris[0], state: 'abc123' }],
            });
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
            const res = await request(app).post(`/oauth/authorize/${TOKEN}/deny`);
            expect(res.status).toBe(200);
            expect(res.body.redirect).toContain('error=access_denied');
        });
    });

    describe('POST /oauth/token', () => {
        it('sin client_id: 400, sin consultar oauth_clients', async () => {
            const res = await request(app).post('/oauth/token').send({ grant_type: 'authorization_code' });
            expect(res.status).toBe(400);
            // El único query permitido en esta ruta es el de auditoría global
            // (auditLog, ajeno a OAuth); nunca se llega a mirar oauth_clients.
            expect(mockQuery.mock.calls.some((c) => /oauth_clients/.test(c[0]))).toBe(false);
        });

        it('client_id desconocido: 401 invalid_client', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });
            const res = await request(app).post('/oauth/token')
                .send({ grant_type: 'authorization_code', client_id: 'bzc_fantasma', code: 'x', redirect_uri: 'https://a', code_verifier: 'y' });
            expect(res.status).toBe(401);
            expect(res.body.error).toBe('invalid_client');
        });

        it('grant_type no soportado (nada de implicit): 400', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [CLIENTE_ACTIVO] });
            const res = await request(app).post('/oauth/token')
                .send({ grant_type: 'implicit', client_id: CLIENTE_ACTIVO.client_id });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('unsupported_grant_type');
        });

        it('código inexistente/ya canjeado: invalid_grant', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [CLIENTE_ACTIVO] }); // cliente
            mockQuery.mockResolvedValueOnce({ rows: [] });               // UPDATE...RETURNING sin filas
            const res = await request(app).post('/oauth/token').send({
                grant_type: 'authorization_code', client_id: CLIENTE_ACTIVO.client_id,
                code: 'codigo-invalido', redirect_uri: CLIENTE_ACTIVO.redirect_uris[0], code_verifier: 'v'.repeat(43),
            });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('invalid_grant');
        });

        it('code_verifier que no corresponde al code_challenge original: invalid_grant', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [CLIENTE_ACTIVO] });
            mockQuery.mockResolvedValueOnce({
                rows: [{
                    app_id: 'app-1', scope_concedido: ['token'],
                    redirect_uri: CLIENTE_ACTIVO.redirect_uris[0],
                    code_challenge: oauthTokens.retoDesdeVerifier('el-verifier-correcto-de-verdad-1234567890'),
                }],
            });
            const res = await request(app).post('/oauth/token').send({
                grant_type: 'authorization_code', client_id: CLIENTE_ACTIVO.client_id,
                code: 'codigo-valido', redirect_uri: CLIENTE_ACTIVO.redirect_uris[0],
                code_verifier: 'un-verifier-que-no-es-el-correcto-nada-que-ver',
            });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('invalid_grant');
        });

        it('canje correcto de authorization_code emite access_token y refresh_token', async () => {
            const verifier = 'x'.repeat(44); // PKCE exige 43-128 caracteres (RFC 7636 §4.1)
            mockQuery.mockResolvedValueOnce({ rows: [CLIENTE_ACTIVO] });
            mockQuery.mockResolvedValueOnce({
                rows: [{
                    app_id: 'app-1', scope_concedido: ['token'],
                    redirect_uri: CLIENTE_ACTIVO.redirect_uris[0],
                    code_challenge: oauthTokens.retoDesdeVerifier(verifier),
                }],
            });
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // INSERT oauth_refresh_tokens

            const res = await request(app).post('/oauth/token').send({
                grant_type: 'authorization_code', client_id: CLIENTE_ACTIVO.client_id,
                code: 'codigo-valido', redirect_uri: CLIENTE_ACTIVO.redirect_uris[0], code_verifier: verifier,
            });
            expect(res.status).toBe(200);
            expect(res.body.token_type).toBe('Bearer');
            expect(res.body.scope).toBe('token');
            const claims = oauthTokens.verificarAccessToken(res.body.access_token);
            expect(claims.sub).toBe('app-1');
        });

        it('refresh_token reutilizado (replay) revoca TODA la familia', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [CLIENTE_ACTIVO] }); // cliente
            mockQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE condicional: ya estaba used_at, no actualiza nada
            mockQuery.mockResolvedValueOnce({ rows: [{ family_id: 'fam-1', used_at: new Date(), revoked_at: null }] }); // SELECT previo
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 3 }); // UPDATE revocar familia

            const res = await request(app).post('/oauth/token')
                .send({ grant_type: 'refresh_token', client_id: CLIENTE_ACTIVO.client_id, refresh_token: 'un-refresh-reusado' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('invalid_grant');
            const sqlRevocacionFamilia = mockQuery.mock.calls[3][0];
            expect(sqlRevocacionFamilia).toMatch(/family_id/);
            expect(sqlRevocacionFamilia).toMatch(/revoked_at = NOW\(\)/);
        });

        it('refresh_token válido rota: nunca devuelve el mismo refresh_token', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [CLIENTE_ACTIVO] });
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'rt-1', family_id: 'fam-1', app_id: 'app-1', scope: ['token'] }],
            });
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // INSERT del nuevo refresh

            const res = await request(app).post('/oauth/token')
                .send({ grant_type: 'refresh_token', client_id: CLIENTE_ACTIVO.client_id, refresh_token: 'refresh-anterior' });
            expect(res.status).toBe(200);
            expect(res.body.refresh_token).not.toBe('refresh-anterior');
            expect(res.body.access_token).toBeTruthy();
        });
    });

    describe('POST /oauth/revoke', () => {
        it('sin client_id o sin token: 400', async () => {
            expect((await request(app).post('/oauth/revoke').send({})).status).toBe(400);
        });

        it('siempre responde 200 aunque el token ya no exista (RFC 7009 §2.2)', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await request(app).post('/oauth/revoke')
                .send({ client_id: 'bzc_x', token: 'lo-que-sea', token_type_hint: 'refresh_token' });
            expect(res.status).toBe(200);
        });

        it('revoca un access_token válido metiendo su jti en la denylist', async () => {
            const { token, jti } = oauthTokens.emitirAccessToken({ appId: 'app-1', clientId: 'bzc_x', scope: ['token'] });
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // INSERT denylist
            const res = await request(app).post('/oauth/revoke')
                .send({ client_id: 'bzc_x', token, token_type_hint: 'access_token' });
            expect(res.status).toBe(200);
            expect(mockQuery.mock.calls[0][1][0]).toBe(jti);
        });
    });

    describe('autenticación del MCP vía Authorization: Bearer', () => {
        const rpc = (headers, metodo) => {
            let r = request(app).post('/api/mcp')
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json, text/event-stream');
            Object.entries(headers).forEach(([k, v]) => { r = r.set(k, v); });
            return r.send({ jsonrpc: '2.0', id: 1, method: metodo, params: {} });
        };
        const cuerpo = (res) => {
            const t = res.text || '';
            if (t.trim().startsWith('{')) return JSON.parse(t);
            const m = t.match(/^data: (.+)$/m);
            return m ? JSON.parse(m[1]) : null;
        };

        it('la URL pública /mcp (sin /api) es el mismo servidor MCP', async () => {
            // Es la que se anuncia a los clientes: en Cloud Run no hay nginx que
            // la reescriba a /api/mcp, así que la API tiene que atenderla.
            const res = await request(app).post('/mcp')
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json, text/event-stream')
                .send({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });
            expect(res.status).toBe(401);
            expect(res.headers['www-authenticate']).toMatch(/resource_metadata=/);
        });

        it('la URL pública /mcp/onboarding sigue siendo anónima', async () => {
            const res = await request(app).post('/mcp/onboarding')
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json, text/event-stream')
                .send({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });
            expect(res.status).toBe(200);
            expect(cuerpo(res)?.result?.tools?.length).toBeGreaterThan(0);
        });

        it('un 401 anuncia dónde está la metadata OAuth (descubrimiento de Claude/ChatGPT/Codex)', async () => {
            // Sin esta cabecera, un cliente que solo tiene la URL del MCP no
            // sabe a qué servidor de autorización mandar a la persona.
            const res = await rpc({}, 'tools/list');
            expect(res.status).toBe(401);
            expect(res.headers['www-authenticate']).toBe(
                `Bearer resource_metadata="${oauthTokens.ISSUER}/.well-known/oauth-protected-resource"`);
        });

        it('un Bearer con firma inválida: 401, sin llegar a consultar la denylist ni app_registry', async () => {
            const res = await rpc({ Authorization: 'Bearer esto-no-es-un-jwt' }, 'tools/list');
            expect(res.status).toBe(401);
            expect(res.body.code).toBe('OAUTH_TOKEN_INVALID');
            expect(mockQuery.mock.calls.some((c) => /oauth_token_denylist|app_registry/.test(c[0]))).toBe(false);
        });

        it('un jti en la denylist: 401 aunque el JWT en sí siga siendo válido', async () => {
            const { token } = oauthTokens.emitirAccessToken({ appId: 'app-1', clientId: 'bzc_x', scope: ['token'] });
            mockQuery.mockResolvedValueOnce({ rows: [{ 1: 1 }] }); // denylist: presente
            const res = await rpc({ Authorization: `Bearer ${token}` }, 'tools/list');
            expect(res.status).toBe(401);
            expect(res.body.code).toBe('OAUTH_TOKEN_REVOKED');
        });

        it('app_registry desactivada tras emitir el token: 403', async () => {
            const { token } = oauthTokens.emitirAccessToken({ appId: 'app-1', clientId: 'bzc_x', scope: ['token'] });
            mockQuery.mockResolvedValueOnce({ rows: [] });               // denylist vacía
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'app-1', is_active: false }] });
            const res = await rpc({ Authorization: `Bearer ${token}` }, 'tools/list');
            expect(res.status).toBe(403);
        });

        it('token válido: el scope efectivo es la intersección con lo que la app tiene HOY', async () => {
            // Se pide 'token' Y 'wallet' al emitir, pero la fila de app_registry
            // ya sólo tiene 'token' (p. ej. le retiraron 'wallet' después de
            // autorizar el conector): el catálogo listado debe reflejar sólo 'token'.
            const { token } = oauthTokens.emitirAccessToken({ appId: 'app-1', clientId: 'bzc_x', scope: ['token', 'wallet'] });
            mockQuery.mockResolvedValueOnce({ rows: [] });                                    // denylist
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'app-1', app_name: 'oauth-app', scopes: ['token'], tier: 'standard', is_active: true }] });
            mockQuery.mockResolvedValueOnce({ rows: [{ plan_id: 'business' }] });              // resolverPlan

            const { getTool } = require('../../config/mcp-tools');
            const res = await rpc({ Authorization: `Bearer ${token}` }, 'tools/list');
            const nombres = (cuerpo(res)?.result?.tools || []).map((t) => t.name);
            expect(nombres.length).toBeGreaterThan(0);
            expect(nombres.every((n) => getTool(n).scope === 'token')).toBe(true);
        });
    });
});
