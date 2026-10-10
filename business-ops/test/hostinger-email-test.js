'use strict';

/**
 * Prueba manual del correo de Hostinger a través del EmailConnector de OPERANT
 * (no forma parte de `npm test`: envía correo de verdad).
 *
 * Uso:
 *   HOSTINGER_SMTP_USER=yoelceo@bezhas.com HOSTINGER_SMTP_PASS=… \
 *     node business-ops/test/hostinger-email-test.js [destinatario]
 * Sin variables, lee business-ops/hostinger.env.local. Sin destinatario, se escribe
 * al propio buzón.
 *
 * Comprueba dos cosas: que cada alias puede ser remitente y que el envío deja copia
 * en "Enviados" (SMTP entrega pero no guarda: la copia la añade el conector por IMAP).
 */

const fs = require('fs');
const path = require('path');
const EmailConnector = require('../src/connectors/EmailConnector');

const ENV_LOCAL = path.join(__dirname, '..', 'hostinger.env.local');
if (fs.existsSync(ENV_LOCAL)) {
  for (const linea of fs.readFileSync(ENV_LOCAL, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const BusinessProfile = require('../src/platform/BusinessProfile');

// Los remitentes salen del perfil real de OPERANT, tal como los usan los agentes: cada
// departamento con su alias y el resto con el general. Se envía una prueba por remitente
// distinto. Hostinger rechaza con 553 cualquier dirección que no sea el buzón o un alias.
const perfil = BusinessProfile.fromFile('bezhas');
const DEPARTAMENTOS = (() => {
  const vistos = new Map();
  for (const dept of ['sales', 'support', 'marketing', 'finance', 'blockchain', 'hr', 'operations', 'legal', 'treasury', 'fundraising', undefined]) {
    const from = perfil.senderFor(dept);
    if (from && !vistos.has(from)) vistos.set(from, { from, name: dept || 'general', existe: true });
    else if (from) vistos.get(from).name += `, ${dept || 'general'}`;
  }
  return [...vistos.values()];
})();

async function main() {
  const user = process.env.HOSTINGER_SMTP_USER || process.env.SMTP_USER;
  const pass = process.env.HOSTINGER_SMTP_PASS || process.env.SMTP_PASS;
  if (!user || !pass) {
    console.error('Falta HOSTINGER_SMTP_USER / HOSTINGER_SMTP_PASS (o business-ops/hostinger.env.local).');
    process.exit(1);
  }
  const destino = process.argv[2] || user;

  const conector = new EmailConnector({
    tenantId: 'bezhas',
    config: { host: process.env.HOSTINGER_SMTP_HOST || 'smtp.hostinger.com', port: Number(process.env.HOSTINGER_SMTP_PORT || 465), user, pass, from: user },
  });

  const estado = await conector.verify();
  console.log(`SMTP: ${estado.ok ? 'OK' : 'FALLO'} — ${estado.detail}`);
  if (!estado.ok) process.exit(1);
  console.log(`Destino: ${destino}\n`);

  let enviados = 0;
  let copias = 0;
  const activos = DEPARTAMENTOS;
  for (const d of DEPARTAMENTOS) {
    const r = await conector.send({
      to: destino,
      from: d.from,
      subject: `[TEST] OPERANT — ${d.name}`,
      body: `Prueba del conector de correo de OPERANT desde ${d.from}.\n${new Date().toISOString()}`,
    });
    if (r.sent) enviados++;
    if (r.sentCopy?.saved) copias++;
    console.log(`  ${d.from.padEnd(46)} ${r.sent ? 'enviado' : 'NO enviado — ' + r.reason} · copia en Enviados: ${r.sentCopy?.saved ? 'sí' : 'no' + (r.sentCopy?.reason ? ' (' + r.sentCopy.reason + ')' : '')}`);
  }
  conector.close();

  console.log(`\nEnviados ${enviados}/${activos.length} · con copia en Enviados ${copias}/${activos.length}`);
  process.exit(enviados === activos.length && copias === activos.length ? 0 : 1);
}

main().catch((err) => { console.error('Error crítico:', err.message); process.exit(1); });
