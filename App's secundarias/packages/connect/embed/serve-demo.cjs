#!/usr/bin/env node
// Static server for the embed demo. Rooted at the connect PACKAGE root so both
// /embed/demo.html and its `../src/*.js` imports resolve. Zero dependencies.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..'); // package root (serves /embed and /src)
const PORT = Number(process.env.PORT || 5175);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/embed/demo.html';
  const fileAbs = path.normalize(path.join(ROOT, urlPath));
  if (!fileAbs.startsWith(ROOT)) { res.writeHead(403).end('Forbidden'); return; }
  fs.readFile(fileAbs, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); return; }
    const ext = path.extname(fileAbs).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Connect embed demo at http://localhost:${PORT}/`);
});
