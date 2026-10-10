'use strict';

/**
 * routes/oauth.js — Authorization Server OAuth 2.1 + PKCE del MCP de BeZhas.
 *
 * Cliente-agnóstico a propósito: no hay nada aquí específico de ChatGPT, de
 * Codex ni de Gemini/Antigravity. Los tres hablan el mismo MCP por Streamable
 * HTTP y el mismo OAuth 2.1 con PKCE — un cliente nuevo que aparezca mañana se
 * conecta sin tocar una línea de este fichero, siempre que respete el
 * protocolo. Lo que SÍ decide BeZhas es qué puede hacer una vez dentro: eso lo
 * sigue fijando el plan contratado (config/plan-entitlements.js) y el scope
 * concedido en el consentimiento, exactamente igual que con una api-key.
 *
 * No sustituye x-api-key: es una segunda vía, para cuando quien se conecta
 * necesita que una PERSONA autorice desde su navegador en vez de pegar una
 * clave. gateway-auth.js acepta ambas y las hace terminar en el mismo sitio:
 * un req.registeredApp con la forma de siempre.
 *
 * Endpoints:
 *   GET  /.well-known/oauth-authorization-server
 *   GET  /.well-known/oauth-protected-resource
 *   GET  /.well-known/jwks.json
 *   POST /oauth/register            (DCR, RFC 7591)
 *   GET  /oauth/authorize           (crea la sesión de consentimiento)
 *   GET  /oauth/authorize/:token    (pantalla — login + elegir organización)
 *   POST /oauth/authorize/:token/login
 *   POST /oauth/authorize/:token/consent
 *   POST /oauth/authorize/:token/deny
 *   POST /oauth/token               (authorization_code | refresh_token)
 *   POST /oauth/revoke              (RFC 7009)
 */

const crypto = require('crypto');
const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { query } = require('../db/pool');
const oauthTokens = require('../services/oauthTokens');
const oauthConsent = require('../services/oauthConsent');
const oauthGrant = require('../services/oauthGrant');
const logger = require('../utils/logger');
const { cspConNonce } = require('../utils/hostedPageCsp');

const router = Router();
const wellKnown = Router();

// ─────────────────────────────────────────────────────────────────────────
//  Discovery
// ─────────────────────────────────────────────────────────────────────────

wellKnown.get('/.well-known/oauth-authorization-server', (_req, res) => {
    const { ISSUER } = oauthTokens;
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({
        issuer: ISSUER,
        authorization_endpoint: `${ISSUER}/oauth/authorize`,
        token_endpoint: `${ISSUER}/oauth/token`,
        registration_endpoint: `${ISSUER}/oauth/register`,
        revocation_endpoint: `${ISSUER}/oauth/revoke`,
        jwks_uri: `${ISSUER}/.well-known/jwks.json`,
        scopes_supported: oauthConsent.SCOPES_MAXIMOS,
        // Nada de 'implicit' ni de 'plain' en PKCE: es lo que distingue 2.1 de 2.0.
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
    });
});

wellKnown.get('/.well-known/oauth-protected-resource', (_req, res) => {
    const { ISSUER, AUDIENCE } = oauthTokens;
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({
        resource: AUDIENCE,
        authorization_servers: [ISSUER],
        scopes_supported: oauthConsent.SCOPES_MAXIMOS,
        bearer_methods_supported: ['header'],
    });
});

wellKnown.get('/.well-known/jwks.json', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({ keys: [oauthTokens.claveJwkPublica()] });
});

// ─────────────────────────────────────────────────────────────────────────
//  Dynamic Client Registration (RFC 7591)
// ─────────────────────────────────────────────────────────────────────────

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, max: 20, keyGenerator: (req) => req.ip,
    message: { error: 'Too many registration attempts.' }, standardHeaders: true, legacyHeaders: false,
});

function _redirectUriValida(uri) {
    try {
        const u = new URL(uri);
        if (u.protocol === 'https:') return true;
        // Sólo localhost puede ir en HTTP, y sólo fuera de producción: es lo
        // que necesita Codex CLI en desarrollo, nunca un cliente en producción.
        return u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')
            && process.env.NODE_ENV !== 'production';
    } catch {
        return false;
    }
}

router.post('/register', registerLimiter, async (req, res) => {
    const { redirect_uris: redirectUris, client_name: clientName } = req.body || {};
    if (!Array.isArray(redirectUris) || redirectUris.length === 0 || redirectUris.some((u) => !_redirectUriValida(u))) {
        return res.status(400).json({
            error: 'invalid_redirect_uri',
            error_description: 'redirect_uris debe ser una lista no vacía de URLs HTTPS (o http://localhost fuera de producción).',
        });
    }
    if (typeof clientName !== 'string' || clientName.trim().length === 0 || clientName.length > 100) {
        return res.status(400).json({ error: 'invalid_client_metadata', error_description: 'client_name es obligatorio.' });
    }

    const clientId = `bzc_${crypto.randomBytes(16).toString('hex')}`;
    await query(
        `INSERT INTO oauth_clients (client_id, client_name, redirect_uris, client_type, registration_source)
         VALUES ($1, $2, $3, 'public', 'dcr')`,
        [clientId, clientName.trim().slice(0, 100), redirectUris]
    );
    logger.info({ clientId, clientName }, 'Cliente OAuth registrado vía DCR');

    // Cliente público: sin client_secret. El único mecanismo de autenticación
    // del cliente es PKCE — es la razón de ser de "2.1" para apps nativas/SPA.
    res.status(201).json({
        client_id: clientId,
        client_name: clientName.trim(),
        redirect_uris: redirectUris,
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
    });
});

// ─────────────────────────────────────────────────────────────────────────
//  /oauth/authorize — arranque
// ─────────────────────────────────────────────────────────────────────────

async function _cargarCliente(clientId) {
    const { rows } = await query(
        `SELECT client_id, client_name, redirect_uris, client_type, is_active FROM oauth_clients WHERE client_id = $1`,
        [clientId]
    );
    return rows[0] || null;
}

router.get('/authorize', async (req, res) => {
    const {
        client_id: clientId, redirect_uri: redirectUri, code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod, scope, state, resource, response_type: responseType,
    } = req.query;

    if (responseType !== 'code') {
        return res.status(400).json({ error: 'unsupported_response_type', error_description: 'Sólo se soporta "code" (sin implicit).' });
    }
    const client = clientId ? await _cargarCliente(String(clientId)) : null;
    if (!client || !client.is_active) {
        // Sin cliente válido no hay a dónde redirigir con seguridad: se
        // responde en JSON en vez de redirigir a una redirect_uri sin
        // verificar, que sería el propio servidor haciendo de open redirect.
        return res.status(400).json({ error: 'invalid_client', error_description: 'client_id desconocido o inactivo.' });
    }

    try {
        const sessionToken = await oauthConsent.crearSolicitud({
            client,
            redirectUri: String(redirectUri || ''),
            codeChallenge: String(codeChallenge || ''),
            codeChallengeMethod: String(codeChallengeMethod || ''),
            scope: String(scope || ''),
            state: state ? String(state) : null,
            resource: resource ? String(resource) : null,
            sourceIp: req.ip,
        });
        return res.redirect(302, `/oauth/authorize/${sessionToken}`);
    } catch (err) {
        if (err instanceof oauthConsent.OAuthConsentError) {
            return res.status(err.status || 400).json({ error: err.code, error_description: err.message });
        }
        logger.error({ error: err.message }, 'Fallo creando la solicitud de autorización OAuth');
        return res.status(500).json({ error: 'server_error' });
    }
});

// ─────────────────────────────────────────────────────────────────────────
//  Pantalla de consentimiento — autocontenida, mismo estilo que
//  routes/onboarding-pages.js y routes/checkout.js.
// ─────────────────────────────────────────────────────────────────────────

function paginaConsentimiento(token, nonce) {
    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="referrer" content="no-referrer">
<title>BeZhas — Autorizar conector</title>
<style>
  :root { --teal:#00D4AA; --gold:#FFD700; --pink:#FF6B9D; --bg:#0b0f14; --card:#121821; --line:#1e2732; --txt:#e8edf2; --dim:#8b98a5; }
  * { box-sizing:border-box; margin:0; }
  body { background:var(--bg); color:var(--txt); font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;
         min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:18px; padding:28px; width:100%; max-width:480px; }
  .brand { display:flex; align-items:center; gap:10px; margin-bottom:18px; }
  .dot { width:14px; height:14px; border-radius:50%; background:linear-gradient(135deg,var(--teal),var(--pink)); }
  h1 { font-size:19px; margin-bottom:6px; }
  .dim { color:var(--dim); font-size:13px; }
  .campo { margin-bottom:12px; }
  .campo label { display:block; font-size:11px; text-transform:uppercase; letter-spacing:.6px; color:var(--dim); margin-bottom:5px; }
  input, select { width:100%; background:#0e131a; border:1px solid var(--line); color:var(--txt);
                  border-radius:10px; padding:11px 12px; font-size:14px; font-family:inherit; }
  .scopes { background:#0e131a; border:1px solid var(--line); border-radius:12px; padding:12px 14px; margin:14px 0; font-size:13px; }
  .scopes li { margin:4px 0 4px 18px; }
  button { width:100%; border:0; padding:13px; border-radius:12px; font-size:15px; cursor:pointer; font-weight:700; margin-top:6px; }
  button.ok { background:var(--teal); color:#06251e; }
  button.no { background:transparent; color:var(--dim); border:1px solid var(--line); font-weight:400; }
  button:disabled { opacity:.5; cursor:default; }
  .aviso { color:#f66; font-size:13px; margin-top:8px; min-height:16px; }
  [hidden] { display:none !important; }
</style>
</head>
<body>
<div class="card">
  <div class="brand"><div class="dot"></div><b>BeZhas</b></div>
  <div id="cargando">Cargando…</div>

  <div id="login" hidden>
    <h1>Conecta tu asistente con BeZhas</h1>
    <p class="dim">Inicia sesión con tu cuenta de BeZhas para autorizar este conector.</p>
    <form id="f-login">
      <div class="campo"><label>Correo</label><input type="email" id="l-email" autocomplete="username" required></div>
      <div class="campo"><label>Contraseña</label><input type="password" id="l-pass" autocomplete="current-password" required></div>
      <button class="ok" type="submit" id="b-login">Entrar</button>
      <p class="aviso" id="err-login"></p>
    </form>
  </div>

  <div id="consentir" hidden>
    <h1>Autorizar conector</h1>
    <p class="dim" id="c-client"></p>
    <div class="campo"><label>Organización</label><select id="c-org"></select></div>
    <div class="scopes"><div class="dim" style="margin-bottom:6px">Este conector podrá:</div><ul id="c-scopes"></ul></div>
    <button class="ok" id="b-aprobar">Autorizar</button>
    <button class="no" id="b-denegar">Cancelar</button>
    <p class="aviso" id="err-consent"></p>
  </div>

  <div id="hecho" hidden>
    <h1>Listo</h1>
    <p class="dim">Vuelve a tu asistente: la conexión ha terminado.</p>
  </div>
  <div id="error" hidden>
    <h1 id="x-titulo">No se pudo continuar</h1>
    <p class="dim" id="x-detalle"></p>
  </div>
  <div class="dim" style="margin-top:16px;font-size:11px;text-align:center">Pantalla segura de BeZhas · no compartas esta URL</div>
</div>
<script nonce="${nonce}">
(function () {
  var TOKEN = ${JSON.stringify(token)};
  var API = '/oauth/authorize/' + TOKEN;
  var DESCRIPCIONES = { token: 'Consultar precio y datos del token BEZ', contracts: 'Consultar contratos y red', wallet: 'Consultar saldos de wallet' };

  function show(id) { ['cargando','login','consentir','hecho','error'].forEach(function (s) { document.getElementById(s).hidden = s !== id; }); }

  fetch(API + '/status', { cache: 'no-store' }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
    .then(function (res) {
      if (!res.ok) { show('error'); document.getElementById('x-detalle').textContent = res.d.error_description || 'Enlace no válido.'; return; }
      if (res.d.estado !== 'pendiente') { show('error'); document.getElementById('x-detalle').textContent = 'Esta autorización ya no está activa. Pide a tu asistente que la reinicie.'; return; }
      document.getElementById('c-client').textContent = 'Aplicación: ' + (res.d.clientName ? res.d.clientName + ' (' + res.d.clientId + ')' : res.d.clientId);
      var ul = document.getElementById('c-scopes'); ul.innerHTML = '';
      (res.d.scopeSolicitado || []).forEach(function (s) { var li = document.createElement('li'); li.textContent = DESCRIPCIONES[s] || s; ul.appendChild(li); });
      // Las organizaciones sólo viven en la memoria de ESTA pestaña (vienen del
      // login, no del sondeo): tras recargar hay que volver a identificarse.
      show('login');
    })
    .catch(function () { show('error'); document.getElementById('x-detalle').textContent = 'Fallo de red.'; });

  function cargarOrganizaciones(lista) {
    var sel = document.getElementById('c-org'); sel.innerHTML = '';
    (lista || []).forEach(function (o) {
      var opt = document.createElement('option'); opt.value = o.id;
      opt.textContent = o.nombre + (o.puedeConectar ? '' : ' — sin permiso');
      opt.disabled = !o.puedeConectar; sel.appendChild(opt);
    });
  }

  document.getElementById('f-login').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var b = document.getElementById('b-login'); b.disabled = true; b.textContent = 'Comprobando…';
    fetch(API + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
      body: JSON.stringify({ email: document.getElementById('l-email').value, password: document.getElementById('l-pass').value }) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        b.disabled = false; b.textContent = 'Entrar';
        document.getElementById('l-pass').value = '';
        if (!res.ok) { document.getElementById('err-login').textContent = res.d.error_description || 'No se pudo entrar.'; return; }
        show('consentir'); cargarOrganizaciones(res.d.organizaciones);
      })
      .catch(function () { b.disabled = false; b.textContent = 'Entrar'; document.getElementById('err-login').textContent = 'Fallo de red.'; });
  });

  document.getElementById('b-aprobar').addEventListener('click', function () {
    var b = this; b.disabled = true; b.textContent = 'Autorizando…';
    fetch(API + '/consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
      body: JSON.stringify({ organizationId: document.getElementById('c-org').value }) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) { b.disabled = false; b.textContent = 'Autorizar'; document.getElementById('err-consent').textContent = res.d.error_description || 'No se pudo autorizar.'; return; }
        window.location.href = res.d.redirect;
      })
      .catch(function () { b.disabled = false; b.textContent = 'Autorizar'; document.getElementById('err-consent').textContent = 'Fallo de red.'; });
  });

  document.getElementById('b-denegar').addEventListener('click', function () {
    fetch(API + '/deny', { method: 'POST', cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) { window.location.href = d.redirect || '#'; show('hecho'); })
      .catch(function () { show('hecho'); });
  });
})();
</script>
</body>
</html>`;
}

router.get('/authorize/:token([0-9a-f]{64})', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Robots-Tag', 'noindex');
    res.type('html').send(paginaConsentimiento(req.params.token, cspConNonce(res)));
});

function _manejarErrorConsentimiento(err, res) {
    if (err instanceof oauthConsent.OAuthConsentError) {
        return res.status(err.status || 400).json({ error: err.code, error_description: err.message });
    }
    logger.error({ error: err.message }, 'Fallo en el consentimiento OAuth');
    return res.status(500).json({ error: 'server_error' });
}

// JSON, no HTML: distinto de GET /authorize/:token (que sirve la página) para
// que no compitan por la misma URL. Lo pide el script embebido en la página.
router.get('/authorize/:token([0-9a-f]{64})/status', async (req, res) => {
    try {
        res.json(await oauthConsent.obtenerSolicitud(req.params.token));
    } catch (err) { _manejarErrorConsentimiento(err, res); }
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, max: 30, keyGenerator: (req) => req.ip,
    message: { error: 'too_many_requests' }, standardHeaders: true, legacyHeaders: false,
});

router.post('/authorize/:token([0-9a-f]{64})/login', loginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body || {};
        const r = await oauthConsent.identificar(req.params.token, { email, password });
        res.json({ organizaciones: r.organizaciones });
    } catch (err) { _manejarErrorConsentimiento(err, res); }
});

router.post('/authorize/:token([0-9a-f]{64})/consent', async (req, res) => {
    try {
        const { organizationId } = req.body || {};
        const { code, redirectUri, state } = await oauthConsent.aprobar(req.params.token, { organizationId });
        const url = new URL(redirectUri);
        url.searchParams.set('code', code);
        if (state) url.searchParams.set('state', state);
        res.json({ redirect: url.toString() });
    } catch (err) { _manejarErrorConsentimiento(err, res); }
});

router.post('/authorize/:token([0-9a-f]{64})/deny', async (req, res) => {
    try {
        const { redirectUri, state } = await oauthConsent.denegar(req.params.token);
        const url = new URL(redirectUri);
        url.searchParams.set('error', 'access_denied');
        if (state) url.searchParams.set('state', state);
        res.json({ redirect: url.toString() });
    } catch (err) { _manejarErrorConsentimiento(err, res); }
});

// ─────────────────────────────────────────────────────────────────────────
//  /oauth/token
// ─────────────────────────────────────────────────────────────────────────

const tokenLimiter = rateLimit({
    windowMs: 60 * 1000, max: 30,
    keyGenerator: (req) => `${req.body?.client_id || 'sin-cliente'}:${req.ip}`,
    message: { error: 'too_many_requests' }, standardHeaders: true, legacyHeaders: false,
});

router.post('/token', tokenLimiter, async (req, res) => {
    const { grant_type: grantType, client_id: clientId } = req.body || {};
    if (!clientId) return res.status(400).json({ error: 'invalid_request', error_description: 'client_id es obligatorio.' });

    const client = await _cargarCliente(String(clientId));
    if (!client || !client.is_active) return res.status(401).json({ error: 'invalid_client' });

    // Cliente confidencial: exige client_secret. Público (el caso normal de
    // ChatGPT/Codex vía DCR): PKCE es la única autenticación, por diseño.
    if (client.client_type === 'confidential') {
        const secreto = req.body?.client_secret;
        const { rows } = await query('SELECT client_secret_hash FROM oauth_clients WHERE client_id = $1', [clientId]);
        const hashEsperado = rows[0]?.client_secret_hash;
        if (!hashEsperado || !secreto || oauthTokens.sha256Hex(secreto) !== hashEsperado) {
            return res.status(401).json({ error: 'invalid_client' });
        }
    }

    try {
        if (grantType === 'authorization_code') {
            const { code, redirect_uri: redirectUri, code_verifier: codeVerifier } = req.body || {};
            const { appId, scope } = await oauthConsent.canjearCodigo({ code, clientId: client.client_id, redirectUri, codeVerifier });
            return res.json(await oauthGrant.emitirParInicial({ appId, clientId: client.client_id, scope }));
        }
        if (grantType === 'refresh_token') {
            const { refresh_token: refreshToken } = req.body || {};
            return res.json(await oauthGrant.rotarRefresh({ refreshToken, clientId: client.client_id }));
        }
        return res.status(400).json({ error: 'unsupported_grant_type' });
    } catch (err) {
        if (err instanceof oauthConsent.OAuthConsentError || err instanceof oauthGrant.OAuthGrantError) {
            return res.status(err.status || 400).json({ error: err.code, error_description: err.message });
        }
        logger.error({ error: err.message }, 'Fallo en /oauth/token');
        return res.status(500).json({ error: 'server_error' });
    }
});

// ─────────────────────────────────────────────────────────────────────────
//  /oauth/revoke (RFC 7009)
// ─────────────────────────────────────────────────────────────────────────

router.post('/revoke', tokenLimiter, async (req, res) => {
    const { token, client_id: clientId, token_type_hint: hint } = req.body || {};
    if (!clientId || !token) return res.status(400).json({ error: 'invalid_request' });

    // RFC 7009 §2.2: se responde 200 siempre, exista o no el token, para no
    // dar pistas de qué tokens son válidos a quien no los emitió.
    if (hint === 'access_token') {
        try {
            const claims = oauthTokens.verificarAccessToken(String(token));
            await oauthGrant.revocarAccessToken({ jti: claims.jti, expiraEn: new Date(claims.exp * 1000) });
        } catch { /* token ya inválido: nada que revocar */ }
    } else {
        await oauthGrant.revocarRefresh({ refreshToken: String(token), clientId: String(clientId) });
    }
    res.status(200).json({});
});

module.exports = { router, wellKnown };
