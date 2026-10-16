'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const MailboxReader = require('../src/connectors/MailboxReader');

const CRUDO = Buffer.from(
  'From: Ana <ana@puerto.es>\r\nTo: yoelceo@bezhas.com\r\nSubject: Propuesta\r\n' +
  'Date: Tue, 06 Oct 2026 10:00:00 +0000\r\nMessage-ID: <a@puerto.es>\r\nContent-Type: text/html; charset=utf-8\r\n\r\n' +
  '<p>Hola&nbsp;Yoel</p><script>alert(1)</script><p>Una demo</p>',
);

/** IMAP en memoria: 5 correos, UID 1..5; el 2 y el 4 están leídos. */
function imapFalso({ falla = null } = {}) {
  const log = { locks: [], flags: [], cierres: 0 };
  const leidos = new Set([2, 4]);
  const env = (uid) => ({
    uid, envelope: { subject: `Asunto ${uid}`, from: [{ name: 'Ana', address: 'ana@puerto.es' }], date: new Date(2026, 9, uid) },
    flags: new Set(leidos.has(uid) ? ['\\Seen'] : []), internalDate: new Date(2026, 9, uid),
  });
  return {
    log,
    factory: () => ({
      connect: async () => { if (falla) throw new Error(falla); },
      getMailboxLock: async (folder, opts) => { log.locks.push({ folder, ...opts }); return { release() {} }; },
      search: async (criterio) => (criterio.seen === false ? [1, 3, 5] : [5, 1, 3, 2, 4]),
      fetch: async function* (uids) { for (const u of uids) yield env(u); },
      fetchOne: async (uid) => (uid === 99 ? false : { ...env(uid), source: CRUDO }),
      messageFlagsAdd: async (uid, flags) => { log.flags.push({ uid, flags }); },
      logout: async () => { log.cierres++; },
    }),
  };
}

const lector = (extra = {}) => new MailboxReader({ config: { host: 'imap.bezhas.test', user: 'yoelceo@bezhas.com', pass: 'x' }, ...extra });

test('Mailbox: sin credenciales no finge una bandeja vacía', async () => {
  const antes = { ...process.env };
  for (const k of Object.keys(process.env)) if (/^(IMAP_|SMTP_|HOSTINGER_SMTP_)/.test(k)) delete process.env[k];
  try {
    const m = new MailboxReader();
    assert.equal(m.configured, false);
    await assert.rejects(() => m.list(), (e) => e.code === 'MAILBOX_NOT_CONFIGURED');
  } finally { Object.assign(process.env, antes); }
});

test('Mailbox: lista lo más nuevo primero, en solo lectura, y cierra la conexión', async () => {
  const imap = imapFalso();
  const r = await lector({ imapFactory: imap.factory }).list({ limit: 3 });
  assert.deepEqual(r.messages.map((m) => m.uid), [5, 4, 3]);
  assert.equal(r.total, 5);
  assert.equal(r.hasMore, true);
  assert.equal(r.messages[0].unread, true);
  assert.equal(r.messages[1].unread, false);
  assert.equal(imap.log.locks[0].readOnly, true, 'listar no puede modificar el buzón');
  assert.equal(imap.log.cierres, 1);
});

test('Mailbox: orden oldest, unread y paginación', async () => {
  const m = lector({ imapFactory: imapFalso().factory });
  assert.deepEqual((await m.list({ sort: 'oldest', limit: 2 })).messages.map((x) => x.uid), [1, 2]);
  assert.deepEqual((await m.list({ sort: 'unread' })).messages.map((x) => x.uid), [5, 3, 1]);
  const p2 = await m.list({ limit: 2, offset: 4 });
  assert.deepEqual(p2.messages.map((x) => x.uid), [1]);
  assert.equal(p2.hasMore, false);
});

test('Mailbox: abre un correo como texto plano, sin ejecutar HTML', async () => {
  const imap = imapFalso();
  const c = await lector({ imapFactory: imap.factory }).get({ uid: 3 });
  assert.equal(c.from, 'ana@puerto.es');
  assert.match(c.text, /Hola\s+Yoel/);
  assert.match(c.text, /Una demo/);
  assert.doesNotMatch(c.text, /<|alert/, 'ni etiquetas ni scripts');
  assert.equal(imap.log.flags.length, 0, 'abrir no marca como leído');
});

test('Mailbox: uid inválido o inexistente se distingue', async () => {
  const m = lector({ imapFactory: imapFalso().factory });
  await assert.rejects(() => m.get({ uid: 'abc' }), (e) => e.code === 'BAD_UID');
  await assert.rejects(() => m.get({ uid: 99 }), (e) => e.code === 'NOT_FOUND');
});

test('Mailbox: marcar como leído es la única escritura y abre en lectura-escritura', async () => {
  const imap = imapFalso();
  const r = await lector({ imapFactory: imap.factory }).markSeen({ uid: 5 });
  assert.deepEqual(r, { uid: 5, unread: false });
  assert.deepEqual(imap.log.flags, [{ uid: 5, flags: ['\\Seen'] }]);
  assert.equal(imap.log.locks[0].readOnly, false);
});

test('Mailbox: un servidor caído se propaga como error, no como bandeja vacía', async () => {
  const m = lector({ imapFactory: imapFalso({ falla: 'ECONNREFUSED' }).factory });
  await assert.rejects(() => m.list(), /ECONNREFUSED/);
});

test('Mailbox y correo: mail.hostinger.com (frontal sin SMTP) se corrige a smtp/imap.hostinger.com', () => {
  const EmailConnector = require('../src/connectors/EmailConnector');
  const antes = { ...process.env };
  for (const k of Object.keys(process.env)) if (/^(IMAP_|SMTP_|HOSTINGER_SMTP_)/.test(k)) delete process.env[k];
  Object.assign(process.env, { HOSTINGER_SMTP_HOST: 'mail.hostinger.com', HOSTINGER_SMTP_USER: 'yoelceo@bezhas.com', HOSTINGER_SMTP_PASS: 'x' });
  try {
    assert.equal(new EmailConnector({ tenantId: 't' }).host, 'smtp.hostinger.com');
    assert.equal(new MailboxReader().host, 'imap.hostinger.com');
  } finally {
    for (const k of Object.keys(process.env)) if (/^(IMAP_|SMTP_|HOSTINGER_SMTP_)/.test(k)) delete process.env[k];
    Object.assign(process.env, antes);
  }
});

test('Mailbox: el digest DMARC cachea por UID y separa lo que no es un informe', async () => {
  const zlib = require('zlib');
  const informe = zlib.gzipSync(`<feedback><report_metadata><org_name>x</org_name><date_range><begin>${Math.floor(Date.now() / 1000) - 3600}</begin><end>${Math.floor(Date.now() / 1000)}</end></date_range></report_metadata><policy_published><domain>bezhas.com</domain><p>quarantine</p></policy_published><record><row><source_ip>1.2.3.4</source_ip><count>3</count><policy_evaluated><disposition>none</disposition><dkim>pass</dkim><spf>pass</spf></policy_evaluated></row><identifiers><header_from>bezhas.com</header_from></identifiers></record></feedback>`);
  const correo = (adjunto) => Buffer.from(
    'From: a@b.c\r\nTo: yoelceo@bezhas.com\r\nSubject: Report domain: bezhas.com\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=B\r\n\r\n' +
    '--B\r\nContent-Type: text/plain\r\n\r\nhola\r\n--B\r\nContent-Type: application/gzip; name="r.xml.gz"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename="r.xml.gz"\r\n\r\n' +
    adjunto.toString('base64') + '\r\n--B--\r\n');
  const fuentes = { 10: correo(informe), 11: correo(Buffer.from('no es un informe')) };
  let descargas = 0;
  const factory = () => ({
    connect: async () => {}, getMailboxLock: async () => ({ release() {} }), logout: async () => {},
    search: async () => [10, 11],
    fetch: async function* (uids) { for (const u of uids) { descargas++; yield { uid: u, source: fuentes[u] }; } },
  });
  const m = lector({ imapFactory: factory });
  const d = await m.dmarcDigest({ days: 7 });
  assert.equal(d.reports, 1);
  assert.equal(d.messages, 3);
  assert.equal(d.pass, 3);
  assert.deepEqual(d.skipped.map((s) => s.uid), [11], 'el correo sin informe se anota, no se oculta');
  assert.equal(descargas, 2);

  await m.dmarcDigest({ days: 7 });
  assert.equal(descargas, 2, 'refrescar no vuelve a bajar los mismos correos');
});
