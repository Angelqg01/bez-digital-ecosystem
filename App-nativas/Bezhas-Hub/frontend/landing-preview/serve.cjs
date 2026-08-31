#!/usr/bin/env node
/**
 * Servidor estático mínimo para el preview standalone de la landing.
 * Sirve la carpeta actual en 0.0.0.0:5174 sin dependencias externas.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 5174);
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
};

http.createServer((req, res) => {
    let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';
    const fileAbs = path.normalize(path.join(ROOT, urlPath));
    if (!fileAbs.startsWith(ROOT)) { res.writeHead(403).end('Forbidden'); return; }
    fs.readFile(fileAbs, (err, data) => {
        if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); return; }
        const ext = path.extname(fileAbs).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
        res.end(data);
    });
}).listen(PORT, '0.0.0.0', () => {
    console.log(`Landing preview at http://localhost:${PORT}/`);
});
