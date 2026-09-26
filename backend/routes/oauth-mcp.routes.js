'use strict';

/**
 * routes/oauth-mcp.routes.js — Authorization Server OAuth 2.1 + PKCE del MCP.
 *
 * Permite que Claude, ChatGPT, Codex, Gemini/Antigravity o Cursor se conecten
 * a mcp.bezhas.com con la cuenta de BeZhas de una persona, sin pegar claves.
 * Es cliente-agnóstico: cualquiera que hable OAuth 2.1 con PKCE y registro
 * dinámico (RFC 7591) sirve.
 *
 * Reparto: este servidor (api.bezhas.com) autentica a la persona y firma el
 * token; mcp.bezhas.com (packages/mcp-server) lo verifica con la clave pública
 * de /.well-known/jwks.json. Sin nada de «implicit» ni PKCE «plain»: es lo que
 * distingue 2.1 de 2.0.
 *
 * No confundir con el login social (/api/auth/google…): eso es BeZhas como
 * CLIENTE de otros proveedores; esto es BeZhas como PROVEEDOR para el MCP.
 */

const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const pool = require('../db/pool');
const tokens = require('../services/oauth/tokens');
const consent = require('../services/oauth/consent');
const grant = require('../services/oauth/grant');

// En producción, sin claves el backend no arranca (fallo temprano y visible).
tokens.claves();

const router = express.Router();
const wellKnown = express.Router();
const formulario = express.urlencoded({ extended: false, limit: '16kb' });

const limitar = (max, windowMs = 60_000, clave = (req) => req.ip) => rateLimit({
    windowMs, max, keyGenerator: clave, standardHeaders: true, legacyHeaders: false,
    message: { error: 'too_many_requests' },
});

// ─── Discovery ──────────────────────────────────────────────────────────────
wellKnown.get('/.well-known/oauth-authorization-server', (_req, res) => {
    const { ISSUER } = tokens;
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({
        issuer: ISSUER,
        authorization_endpoint: `${ISSUER}/oauth/authorize`,
        token_endpoint: `${ISSUER}/oauth/token`,
        registration_endpoint: `${ISSUER}/oauth/register`,
        revocation_endpoint: `${ISSUER}/oauth/revoke`,
        jwks_uri: `${ISSUER}/.well-known/jwks.json`,
        scopes_supported: consent.SCOPES_MAXIMOS,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['none'],
    });
});

wellKnown.get('/.well-known/jwks.json', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({ keys: [tokens.claveJwkPublica()] });
});

// ─── Registro dinámico (RFC 7591) ───────────────────────────────────────────
function redirectValida(uri) {
    try {
        const u = new URL(uri);
        if (u.protocol === 'https:') return true;
        // http sólo para localhost y fuera de producción (Codex/Claude Code en local).
        return u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname)
            && process.env.NODE_ENV !== 'production';
    } catch {
        return false;
    }
}

router.post('/register', limitar(20, 60 * 60_000), async (req, res) => {
    const { redirect_uris: uris, client_name: nombre } = req.body || {};
    if (!Array.isArray(uris) || uris.length === 0 || uris.length > 10 || uris.some((u) => !redirectValida(u))) {
        return res.status(400).json({ error: 'invalid_redirect_uri', error_description: 'redirect_uris: URLs HTTPS (o http://localhost fuera de producción).' });
    }
    if (typeof nombre !== 'string' || !nombre.trim() || nombre.length > 100) {
        return res.status(400).json({ error: 'invalid_client_metadata', error_description: 'client_name es obligatorio.' });
    }
    const clientId = `bzc_${crypto.randomBytes(16).toString('hex')}`;
    try {
        await pool.query(
            `INSERT INTO oauth_clients (client_id, client_name, redirect_uris, client_type)
             VALUES ($1, $2, $3::jsonb, 'public')`,
            [clientId, nombre.trim(), JSON.stringify(uris)]
        );
    } catch (err) {
        console.error('[oauth] registro de cliente fallido:', err.message);
        return res.status(500).json({ error: 'server_error' });
    }
    return res.status(201).json({
        client_id: clientId, client_name: nombre.trim(), redirect_uris: uris,
        token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'],
    });
});

async function cargarCliente(clientId) {
    const { rows } = await pool.query(
        'SELECT client_id, client_name, redirect_uris, is_active FROM oauth_clients WHERE client_id = $1',
        [String(clientId)]
    );
    return rows[0] || null;
}

function responderError(err, res) {
    if (err instanceof consent.OAuthConsentError || err instanceof grant.OAuthGrantError) {
        return res.status(err.status || 400).json({ error: err.code, error_description: err.message });
    }
    console.error('[oauth]', err.message);
    return res.status(500).json({ error: 'server_error' });
}

// ─── /oauth/authorize ───────────────────────────────────────────────────────
router.get('/authorize', limitar(60), async (req, res) => {
    const q = req.query;
    if (q.response_type !== 'code') {
        return res.status(400).json({ error: 'unsupported_response_type', error_description: 'Sólo "code".' });
    }
    try {
        const client = q.client_id ? await cargarCliente(q.client_id) : null;
        if (!client || !client.is_active) {
            // Sin cliente válido no hay a dónde redirigir con seguridad.
            return res.status(400).json({ error: 'invalid_client' });
        }
        const sesion = await consent.crearSolicitud({
            client,
            redirectUri: String(q.redirect_uri || ''),
            codeChallenge: String(q.code_challenge || ''),
            codeChallengeMethod: String(q.code_challenge_method || ''),
            scope: q.scope ? String(q.scope) : undefined,
            state: q.state ? String(q.state) : null,
            sourceIp: req.ip,
        });
        return res.redirect(302, `/oauth/authorize/${sesion}`);
    } catch (err) {
        return responderError(err, res);
    }
});

/**
 * CSP con nonce SOLO para esta pantalla: el script inline de la página lleva
 * un nonce de un solo uso y nada más puede ejecutarse. frame-ancestors 'none'
 * impide enmarcarla (clickjacking sobre «Autorizar»).
 */
function cspConNonce(res) {
    const nonce = crypto.randomBytes(16).toString('base64');
    res.setHeader('Content-Security-Policy', [
        "default-src 'self'", `script-src 'self' 'nonce-${nonce}'`, "script-src-attr 'none'",
        "style-src 'self' 'unsafe-inline'", "img-src 'self' data:", "connect-src 'self'",
        "object-src 'none'", "base-uri 'none'", "form-action 'self'", "frame-ancestors 'none'",
    ].join('; '));
    return nonce;
}

// La página no lleva nada de la petición: el script saca la sesión de su propia
// URL. Así no hay dato del cliente reflejado en el HTML que escapar.
function pagina(nonce) {
    return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><meta name="referrer" content="no-referrer"><title>BeZhas — Autorizar conector</title>
<style>
:root{--teal:#00D4AA;--pink:#FF6B9D;--bg:#0b0f14;--card:#121821;--line:#1e2732;--txt:#e8edf2;--dim:#8b98a5}
*{box-sizing:border-box;margin:0}body{background:var(--bg);color:var(--txt);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:28px;width:100%;max-width:460px}
.brand{display:flex;align-items:center;gap:10px;margin-bottom:18px}.dot{width:14px;height:14px;border-radius:50%;background:linear-gradient(135deg,var(--teal),var(--pink))}
h1{font-size:19px;margin-bottom:6px}.dim{color:var(--dim);font-size:13px}.campo{margin-bottom:12px}
.campo label{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:var(--dim);margin-bottom:5px}
input{width:100%;background:#0e131a;border:1px solid var(--line);color:var(--txt);border-radius:10px;padding:11px 12px;font-size:14px}
.scopes{background:#0e131a;border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:14px 0;font-size:13px}.scopes li{margin:4px 0 4px 18px}
button{width:100%;border:0;padding:13px;border-radius:12px;font-size:15px;cursor:pointer;font-weight:700;margin-top:6px}
.ok{background:var(--teal);color:#06251e}.no{background:transparent;color:var(--dim);border:1px solid var(--line);font-weight:400}
.aviso{color:#f66;font-size:13px;margin-top:8px;min-height:16px}[hidden]{display:none!important}
</style></head><body><div class="card">
<div class="brand"><div class="dot"></div><b>BeZhas</b></div>
<div id="cargando">Cargando…</div>
<div id="login" hidden><h1>Conecta tu asistente con BeZhas</h1><p class="dim" id="l-app"></p>
<form id="f-login"><div class="campo"><label for="l-email">Correo</label><input type="email" id="l-email" autocomplete="username" required></div>
<div class="campo"><label for="l-pass">Contraseña</label><input type="password" id="l-pass" autocomplete="current-password" required></div>
<div class="campo" id="c-2fa" hidden><label for="l-2fa">Código de verificación</label><input id="l-2fa" inputmode="numeric" autocomplete="one-time-code"></div>
<button class="ok" type="submit" id="b-login">Entrar</button><p class="aviso" id="err-login"></p></form></div>
<div id="consentir" hidden><h1>Autorizar conector</h1><p class="dim" id="c-app"></p>
<div class="scopes"><div class="dim">Este conector podrá:</div><ul id="c-scopes"></ul></div>
<p class="dim">No podrá mover fondos, enviar mensajes ni cambiar nada en tu cuenta.</p>
<button class="ok" id="b-aprobar">Autorizar</button><button class="no" id="b-denegar">Cancelar</button><p class="aviso" id="err-consent"></p></div>
<div id="error" hidden><h1>No se pudo continuar</h1><p class="dim" id="x-detalle"></p></div>
<p class="dim" style="margin-top:16px;font-size:11px;text-align:center">Pantalla segura de BeZhas · no compartas esta URL</p>
</div>
<script nonce="${nonce}">
(function(){
var API=location.pathname.replace(/\/+$/,'');
function show(id){['cargando','login','consentir','error'].forEach(function(s){document.getElementById(s).hidden=s!==id;});}
function txt(id,v){document.getElementById(id).textContent=v;}
function post(ruta,cuerpo){return fetch(API+ruta,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify(cuerpo||{})}).then(function(r){return r.json().then(function(d){return{ok:r.ok,d:d};});});}
fetch(API+'/status',{cache:'no-store'}).then(function(r){return r.json().then(function(d){return{ok:r.ok,d:d};});}).then(function(res){
 if(!res.ok||res.d.estado!=='pendiente'){show('error');txt('x-detalle',(res.d&&res.d.error_description)||'Esta autorización ya no está activa. Reiníciala desde tu asistente.');return;}
 var app='Aplicación: '+(res.d.clientName||'')+' ('+res.d.clientId+')';txt('l-app',app);txt('c-app',app);
 var ul=document.getElementById('c-scopes');(res.d.scopes||[]).forEach(function(s){var li=document.createElement('li');li.textContent=s.descripcion;ul.appendChild(li);});
 show('login');
}).catch(function(){show('error');txt('x-detalle','Fallo de red.');});
document.getElementById('f-login').addEventListener('submit',function(ev){ev.preventDefault();var b=document.getElementById('b-login');b.disabled=true;
 post('/login',{email:document.getElementById('l-email').value,password:document.getElementById('l-pass').value,codigo2fa:document.getElementById('l-2fa').value||undefined}).then(function(res){
  b.disabled=false;
  if(res.ok){document.getElementById('l-pass').value='';document.getElementById('l-2fa').value='';show('consentir');return;}
  if(res.d.error==='mfa_required'){document.getElementById('c-2fa').hidden=false;}
  txt('err-login',res.d.error_description||'No se pudo entrar.');
 }).catch(function(){b.disabled=false;txt('err-login','Fallo de red.');});});
document.getElementById('b-aprobar').addEventListener('click',function(){var b=this;b.disabled=true;
 post('/consent').then(function(res){if(!res.ok){b.disabled=false;txt('err-consent',res.d.error_description||'No se pudo autorizar.');return;}window.location.href=res.d.redirect;})
 .catch(function(){b.disabled=false;txt('err-consent','Fallo de red.');});});
document.getElementById('b-denegar').addEventListener('click',function(){post('/deny').then(function(res){if(res.d&&res.d.redirect)window.location.href=res.d.redirect;});});
})();
</script></body></html>`;
}

const TOKEN_RE = '[0-9a-f]{64}';

router.get(`/authorize/:sesion(${TOKEN_RE})`, (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Robots-Tag', 'noindex');
    res.type('html').send(pagina(cspConNonce(res)));
});

router.get(`/authorize/:sesion(${TOKEN_RE})/status`, async (req, res) => {
    try { res.json(await consent.obtenerSolicitud(req.params.sesion)); } catch (err) { responderError(err, res); }
});

router.post(`/authorize/:sesion(${TOKEN_RE})/login`, limitar(30, 15 * 60_000), async (req, res) => {
    try {
        const { email, password, codigo2fa } = req.body || {};
        await consent.identificar(req.params.sesion, { email, password, codigo2fa });
        res.json({ ok: true });
    } catch (err) { responderError(err, res); }
});

function conCodigo(redirectUri, params) {
    const url = new URL(redirectUri);
    for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
    return url.toString();
}

router.post(`/authorize/:sesion(${TOKEN_RE})/consent`, async (req, res) => {
    try {
        const { code, redirectUri, state } = await consent.aprobar(req.params.sesion);
        res.json({ redirect: conCodigo(redirectUri, { code, state }) });
    } catch (err) { responderError(err, res); }
});

router.post(`/authorize/:sesion(${TOKEN_RE})/deny`, async (req, res) => {
    try {
        const { redirectUri, state } = await consent.denegar(req.params.sesion);
        res.json({ redirect: conCodigo(redirectUri, { error: 'access_denied', state }) });
    } catch (err) { responderError(err, res); }
});

// ─── /oauth/token y /oauth/revoke ──────────────────────────────────────────
const limitarToken = limitar(30, 60_000, (req) => `${req.body?.client_id || '-'}:${req.ip}`);

router.post('/token', formulario, limitarToken, async (req, res) => {
    const { grant_type: tipo, client_id: clientId } = req.body || {};
    if (!clientId) return res.status(400).json({ error: 'invalid_request', error_description: 'client_id es obligatorio.' });
    try {
        const client = await cargarCliente(clientId);
        if (!client || !client.is_active) return res.status(401).json({ error: 'invalid_client' });
        if (tipo === 'authorization_code') {
            const { code, redirect_uri: redirectUri, code_verifier: codeVerifier } = req.body;
            const { userId, scope } = await consent.canjearCodigo({ code, clientId: client.client_id, redirectUri, codeVerifier });
            return res.json(await grant.emitirParInicial({ userId, clientId: client.client_id, scope }));
        }
        if (tipo === 'refresh_token') {
            return res.json(await grant.rotarRefresh({ refreshToken: req.body.refresh_token, clientId: client.client_id }));
        }
        return res.status(400).json({ error: 'unsupported_grant_type' });
    } catch (err) {
        return responderError(err, res);
    }
});

router.post('/revoke', formulario, limitarToken, async (req, res) => {
    const { token, client_id: clientId } = req.body || {};
    if (!token || !clientId) return res.status(400).json({ error: 'invalid_request' });
    try {
        // Se revoca el refresh: el access token (10 min) caduca solo y el MCP,
        // sin base de datos, no podría consultar una lista negra.
        await grant.revocarRefresh({ refreshToken: String(token), clientId: String(clientId) });
    } catch (err) {
        console.error('[oauth] revocación fallida:', err.message);
    }
    // RFC 7009 §2.2: 200 siempre, exista o no el token.
    return res.status(200).json({});
});

module.exports = { router, wellKnown };
