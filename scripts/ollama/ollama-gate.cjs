#!/usr/bin/env node
'use strict';

/**
 * ollama-gate — pasarela con clave delante de un Ollama que se publica por un túnel.
 *
 * Ollama no tiene autenticación: ponerlo tal cual en Internet es regalar tu CPU (y los modelos) a
 * quien encuentre la URL. Esto escucha en local, exige `Authorization: Bearer <OLLAMA_GATE_KEY>` y
 * sólo deja pasar lo que OPERANT necesita: POST /api/chat, /api/generate y /api/embeddings, y
 * GET /api/tags. Nada de /api/pull, /api/delete, /api/create ni /api/push.
 *
 *   OLLAMA_GATE_KEY=<clave larga> node scripts/ollama/ollama-gate.cjs
 *   OLLAMA_GATE_PORT=11436  OLLAMA_TARGET=http://127.0.0.1:11434  (por defecto)
 */

const http = require('http');
const crypto = require('crypto');

const PORT = parseInt(process.env.OLLAMA_GATE_PORT || '11436', 10);
const TARGET = new URL(process.env.OLLAMA_TARGET || 'http://127.0.0.1:11434');
const KEY = process.env.OLLAMA_GATE_KEY || '';
const MAX_BODY = 1024 * 1024;
const PERMITIDO = new Set(['POST /api/chat', 'POST /api/generate', 'POST /api/embeddings', 'GET /api/tags']);

const h = (v) => crypto.createHash('sha256').update(String(v)).digest();
function autorizado(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  return Boolean(KEY && m && crypto.timingSafeEqual(h(m[1]), h(KEY)));
}

function crearServidor() {
  return http.createServer((req, res) => {
    const ruta = `${req.method} ${(req.url || '').split('?')[0]}`;
    if (!autorizado(req)) { res.writeHead(401).end('unauthorized'); return; }
    if (!PERMITIDO.has(ruta)) { res.writeHead(403).end('forbidden'); return; }

    let tam = 0;
    req.on('data', (c) => { tam += c.length; if (tam > MAX_BODY) { req.destroy(); } });
    const salida = http.request({
      host: TARGET.hostname, port: TARGET.port || 80, method: req.method, path: req.url,
      headers: {
        'content-type': req.headers['content-type'] || 'application/json',
        ...(req.headers['content-length'] ? { 'content-length': req.headers['content-length'] } : {}),
      },
      timeout: 120000,
    }, (r) => { res.writeHead(r.statusCode || 502, { 'content-type': r.headers['content-type'] || 'application/json' }); r.pipe(res); });
    salida.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end('ollama no disponible'); });
    salida.on('timeout', () => salida.destroy());
    req.pipe(salida);
  });
}

if (require.main === module) {
  if (!KEY || KEY.length < 24) { console.error('OLLAMA_GATE_KEY obligatoria (≥ 24 caracteres).'); process.exit(1); }
  crearServidor().listen(PORT, '127.0.0.1', () => console.log(`ollama-gate en 127.0.0.1:${PORT} → ${TARGET.origin}`));
}

module.exports = { crearServidor };
