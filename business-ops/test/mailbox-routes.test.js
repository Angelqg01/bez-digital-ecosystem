'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.INTERNAL_API_KEY = 'clave-de-prueba';
process.env.DATABASE_URL = '';
const { app, mailbox } = require('../src/server');

const env = (uid) => ({
  uid, envelope: { subject: `Asunto ${uid}`, from: [{ address: 'ana@puerto.es' }], date: new Date(2026, 9, uid) },
  flags: new Set(), internalDate: new Date(2026, 9, uid),
});
const imapFalso = () => ({
  connect: async () => {}, getMailboxLock: async () => ({ release() {} }),
  search: async () => [1, 2], fetch: async function* (u) { for (const x of u) yield env(x); },
  logout: async () => {},
});

async function conServidor(fn) {
  const srv = app.listen(0);
  try { return await fn(`http://127.0.0.1:${srv.address().port}`); } finally { srv.close(); }
}
const get = (base, ruta) => fetch(base + ruta, { headers: { 'x-api-key': 'clave-de-prueba' } });

test('Rutas de bandeja: solo el tenant de BeZhas lee el buzón de la plataforma', async () => {
  Object.assign(mailbox, { host: 'imap.bezhas.test', user: 'yoelceo@bezhas.com', pass: 'x', _imapFactory: imapFalso });
  await conServidor(async (base) => {
    const ok = await get(base, '/tenants/bezhas/mailbox');
    assert.equal(ok.status, 200);
    const cuerpo = await ok.json();
    assert.deepEqual(cuerpo.messages.map((m) => m.uid), [2, 1]);
    assert.equal(cuerpo.mailbox, 'yoelceo@bezhas.com');

    const ajeno = await get(base, '/tenants/acme/mailbox');
    assert.equal(ajeno.status, 403, 'otro cliente no puede leer el correo de BeZhas');
    assert.equal((await ajeno.json()).code, 'mailbox_forbidden');
  });
});

test('Rutas de bandeja: sin credenciales responde 503, no una bandeja vacía', async () => {
  Object.assign(mailbox, { host: '', user: '', pass: '' });
  await conServidor(async (base) => {
    const r = await get(base, '/tenants/bezhas/mailbox');
    assert.equal(r.status, 503);
    assert.equal((await r.json()).code, 'mailbox_not_configured');
  });
});
