'use strict';

/**
 * dmarc — lectura y resumen de informes DMARC agregados (RFC 7489, apéndice C).
 *
 * Los receptores (Google, Microsoft, Mimecast…) mandan al buzón de `rua` un XML
 * por día, comprimido: zip en Google, gzip en el resto. Este módulo lo abre, lo
 * normaliza y lo resume por remitente. No habla con el buzón ni con DNS: es
 * puro (bytes → objetos), así se prueba sin red.
 *
 * Contra adjuntos de terceros se limita el tamaño tras descomprimir: un zip
 * bomba en un correo entrante no puede tumbar el servicio.
 */

const zlib = require('zlib');
const { XMLParser } = require('fast-xml-parser');

const MAX_XML_BYTES = 5 * 1024 * 1024;   // un informe real pesa unos KB

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,          // los números llegan como texto: se convierten a mano
  // Por RUTA, no por nombre: `dkim`/`spf` también existen dentro de
  // policy_evaluated como un valor suelto ('pass'), y tratarlos como lista lo
  // convertía en ['pass'] y marcaba todo el tráfico como fallo.
  isArray: (name, jpath) => [
    'feedback.record',
    'feedback.record.auth_results.dkim',
    'feedback.record.auth_results.spf',
    'feedback.record.row.policy_evaluated.reason',
  ].includes(jpath),
});

/** Extrae el primer fichero de un zip (por el directorio central, que es fiable aunque haya data descriptors). */
function unzipFirst(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('zip sin directorio central');
  const centralOffset = buf.readUInt32LE(eocd + 16);
  if (buf.readUInt32LE(centralOffset) !== 0x02014b50) throw new Error('zip corrupto');
  const method = buf.readUInt16LE(centralOffset + 10);
  const compSize = buf.readUInt32LE(centralOffset + 20);
  const localOffset = buf.readUInt32LE(centralOffset + 42);
  if (buf.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('zip corrupto (cabecera local)');
  const start = localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28);
  const data = buf.subarray(start, start + compSize);
  if (method === 0) return data;
  if (method === 8) return zlib.inflateRawSync(data, { maxOutputLength: MAX_XML_BYTES });
  throw new Error(`zip con método de compresión ${method} no soportado`);
}

/** Bytes de un adjunto → texto XML (zip, gzip o XML plano). */
function toXml(buf) {
  let raw = buf;
  if (buf[0] === 0x1f && buf[1] === 0x8b) raw = zlib.gunzipSync(buf, { maxOutputLength: MAX_XML_BYTES });
  else if (buf[0] === 0x50 && buf[1] === 0x4b) raw = unzipFirst(buf);
  if (raw.length > MAX_XML_BYTES) throw new Error('informe demasiado grande');
  const xml = raw.toString('utf8');
  if (!xml.includes('<feedback')) throw new Error('el adjunto no es un informe DMARC');
  return xml;
}

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const lista = (v) => (Array.isArray(v) ? v : v === undefined ? [] : [v]);

/** XML de informe agregado → objeto normalizado. Lanza si no es un informe. */
function parseReport(xml) {
  const fb = parser.parse(xml)?.feedback;
  if (!fb) throw new Error('XML sin <feedback>');
  const meta = fb.report_metadata || {};
  const pol = fb.policy_published || {};
  const records = lista(fb.record).map((r) => {
    const row = r.row || {};
    const ev = row.policy_evaluated || {};
    const dkimAuth = lista(r.auth_results?.dkim).map((d) => ({ domain: String(d.domain || ''), result: String(d.result || '') }));
    const spfAuth = lista(r.auth_results?.spf).map((s) => ({ domain: String(s.domain || ''), result: String(s.result || '') }));
    const dkim = ev.dkim === 'pass';
    const spf = ev.spf === 'pass';
    return {
      sourceIp: String(row.source_ip || ''),
      count: num(row.count),
      headerFrom: String(r.identifiers?.header_from || ''),
      dkim, spf,
      pass: dkim || spf,                      // DMARC pasa con que UNO de los dos esté alineado
      disposition: String(ev.disposition || 'none'),
      // Solo dominios que AUTENTICARON: es la etiqueta que identifica al remitente;
      // uno que falló no dice quién es (suele ser el propio dominio suplantado).
      dkimDomains: dkimAuth.filter((d) => d.result === 'pass').map((d) => d.domain).filter(Boolean),
      spfDomains: spfAuth.filter((x) => x.result === 'pass').map((x) => x.domain).filter(Boolean),
    };
  });
  return {
    org: String(meta.org_name || 'desconocido'),
    reportId: String(meta.report_id || ''),
    begin: num(meta.date_range?.begin) * 1000 || null,
    end: num(meta.date_range?.end) * 1000 || null,
    domain: String(pol.domain || ''),
    policy: { p: String(pol.p || ''), sp: pol.sp ? String(pol.sp) : null, pct: pol.pct === undefined ? null : num(pol.pct) },
    records,
  };
}

/**
 * Resume una lista de informes ya normalizados.
 * "Remitente" = una IP de origen; la etiqueta legible sale de los dominios con
 * los que autenticó (DKIM/SPF), que es lo que de verdad dice quién es.
 */
function summarize(reports, { now = Date.now(), days = 14 } = {}) {
  const byReporter = new Map();
  const bySender = new Map();
  let messages = 0; let pass = 0;
  let begin = null; let end = null;
  const policies = new Map();

  for (const rep of reports) {
    const org = byReporter.get(rep.org) || { org: rep.org, reports: 0, messages: 0, pass: 0, fail: 0 };
    org.reports += 1;
    byReporter.set(rep.org, org);
    if (rep.begin && (begin === null || rep.begin < begin)) begin = rep.begin;
    if (rep.end && (end === null || rep.end > end)) end = rep.end;
    if (rep.policy?.p) policies.set(rep.policy.p, (policies.get(rep.policy.p) || 0) + 1);

    for (const r of rep.records) {
      messages += r.count;
      org.messages += r.count;
      const key = r.sourceIp;
      const s = bySender.get(key) || {
        sourceIp: key, label: '', messages: 0, pass: 0, fail: 0, dkimPass: 0, spfPass: 0,
        quarantined: 0, rejected: 0, domains: new Set(), reporters: new Set(),
      };
      s.messages += r.count;
      s.reporters.add(rep.org);
      if (r.pass) { s.pass += r.count; pass += r.count; org.pass += r.count; } else { s.fail += r.count; org.fail += r.count; }
      if (r.dkim) s.dkimPass += r.count;
      if (r.spf) s.spfPass += r.count;
      if (r.disposition === 'quarantine') s.quarantined += r.count;
      if (r.disposition === 'reject') s.rejected += r.count;
      for (const d of [...r.dkimDomains, ...r.spfDomains]) s.domains.add(d);
      bySender.set(key, s);
    }
  }

  const senders = [...bySender.values()].map((s) => ({
    sourceIp: s.sourceIp,
    label: [...s.domains][0] || s.sourceIp,
    domains: [...s.domains],
    reporters: [...s.reporters],
    messages: s.messages, pass: s.pass, fail: s.fail,
    dkimPass: s.dkimPass, spfPass: s.spfPass,
    quarantined: s.quarantined, rejected: s.rejected,
    passRate: s.messages ? s.pass / s.messages : null,
  })).sort((a, b) => b.fail - a.fail || b.messages - a.messages);

  const fail = messages - pass;
  const spanDays = begin && end ? (end - begin) / 86_400_000 : 0;
  const publishedP = [...policies.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  return {
    windowDays: days,
    generatedAt: new Date(now).toISOString(),
    range: begin && end ? { from: new Date(begin).toISOString(), to: new Date(end).toISOString(), spanDays: Math.round(spanDays * 10) / 10 } : null,
    reports: reports.length,
    messages, pass, fail,
    passRate: messages ? pass / messages : null,
    policy: publishedP,
    reporters: [...byReporter.values()].sort((a, b) => b.messages - a.messages),
    senders,
    failing: senders.filter((s) => s.fail > 0),
    recommendation: recommend({ messages, fail, spanDays, policy: publishedP, failing: senders.filter((s) => s.fail > 0) }),
  };
}

/** Texto de decisión. Orienta, no cambia nada: el DNS lo toca una persona. */
function recommend({ messages, fail, spanDays, policy, failing }) {
  if (!messages) return { level: 'unknown', text: 'No hay informes en la ventana: no se puede valorar el endurecimiento.' };
  if (fail > 0) {
    const quienes = failing.slice(0, 3).map((s) => `${s.label} (${s.fail})`).join(', ');
    return { level: 'blocked', text: `Hay ${fail} mensajes que no pasan DMARC desde ${failing.length} origen(es): ${quienes}. Identificar si son legítimos (alinear SPF/DKIM) o suplantación antes de endurecer.` };
  }
  if (policy === 'reject') return { level: 'done', text: 'Política en p=reject y todo el tráfico informado pasa DMARC.' };
  if (spanDays < 14) return { level: 'wait', text: `Todo pasa, pero solo hay ${Math.round(spanDays)} días de informes; esperar a tener al menos 14 antes de pasar a p=reject.` };
  return { level: 'ready', text: `Todo el tráfico informado pasa DMARC durante ${Math.round(spanDays)} días con p=${policy || '?'}. Se puede valorar pasar a p=reject (cambio de DNS, a decidir por una persona).` };
}

module.exports = { toXml, parseReport, summarize, unzipFirst, MAX_XML_BYTES };
