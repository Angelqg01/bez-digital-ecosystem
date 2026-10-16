'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('zlib');
const { toXml, parseReport, summarize } = require('../src/platform/dmarc');

const xml = ({ org = 'google.com', begin = 1792022400, end = 1792108799, p = 'quarantine', records } = {}) => `<?xml version="1.0"?>
<feedback><report_metadata><org_name>${org}</org_name><report_id>r-${org}-${begin}</report_id>
<date_range><begin>${begin}</begin><end>${end}</end></date_range></report_metadata>
<policy_published><domain>bezhas.com</domain><p>${p}</p><pct>100</pct></policy_published>
${records.map((r) => `<record><row><source_ip>${r.ip}</source_ip><count>${r.count}</count>
<policy_evaluated><disposition>${r.disp || 'none'}</disposition><dkim>${r.dkim}</dkim><spf>${r.spf}</spf></policy_evaluated></row>
<identifiers><header_from>bezhas.com</header_from></identifiers>
<auth_results><dkim><domain>${r.dkimDomain || 'bezhas.com'}</domain><result>${r.dkim}</result></dkim>
<spf><domain>${r.spfDomain || 'bezhas.com'}</domain><result>${r.spf}</result></spf></auth_results></record>`).join('')}
</feedback>`;

/** Zip mínimo de un fichero (método deflate), como el que manda Google. */
function zip(nombre, contenido) {
  const data = Buffer.from(contenido);
  const comp = zlib.deflateRawSync(data);
  const n = Buffer.from(nombre);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(n.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(comp.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(n.length, 28); central.writeUInt32LE(0, 42);
  const offsetCentral = local.length + n.length + comp.length;
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10); eocd.writeUInt32LE(central.length + n.length, 12); eocd.writeUInt32LE(offsetCentral, 16);
  return Buffer.concat([local, n, comp, central, n, eocd]);
}

const OK = { ip: '23.83.209.93', count: 5, dkim: 'pass', spf: 'pass' };
const MAL = { ip: '52.212.19.177', count: 4, dkim: 'fail', spf: 'fail', spfDomain: 'bezhas.com' };

test('DMARC: abre zip, gzip y XML plano', () => {
  const x = xml({ records: [OK] });
  for (const adjunto of [zip('r.xml', x), zlib.gzipSync(x), Buffer.from(x)]) {
    assert.match(toXml(adjunto), /<feedback>/);
  }
});

test('DMARC: un adjunto que no es un informe se rechaza', () => {
  assert.throws(() => toXml(Buffer.from('hola')), /no es un informe/);
  assert.throws(() => toXml(Buffer.from([0x50, 0x4b, 1, 2, 3])), /zip/);
});

test('DMARC: una bomba de descompresión no se expande sin límite', () => {
  const bomba = zlib.gzipSync(Buffer.alloc(20 * 1024 * 1024, 0x20));
  assert.throws(() => toXml(bomba));
});

test('DMARC: dkim y spf de policy_evaluated son valores, no listas', () => {
  // Regresión: tratarlos como lista convertía 'pass' en ['pass'] y todo el
  // tráfico salía como fallo (303 de 303 en el primer informe real).
  const r = parseReport(xml({ records: [OK, MAL] }));
  assert.equal(r.records[0].dkim, true);
  assert.equal(r.records[0].pass, true);
  assert.equal(r.records[1].pass, false);
  assert.deepEqual(r.records[0].dkimDomains, ['bezhas.com']);
  assert.deepEqual(r.records[1].dkimDomains, [], 'un dominio que falló no etiqueta al remitente');
});

test('DMARC: DMARC pasa con que SPF o DKIM estén alineados', () => {
  const r = parseReport(xml({ records: [{ ip: '1.1.1.1', count: 2, dkim: 'pass', spf: 'fail' }, { ip: '2.2.2.2', count: 2, dkim: 'fail', spf: 'pass' }] }));
  assert.deepEqual(r.records.map((x) => x.pass), [true, true]);
});

test('DMARC: resumen por remitente y por receptor', () => {
  const reports = [
    parseReport(xml({ org: 'google.com', records: [OK, MAL] })),
    parseReport(xml({ org: 'Mimecast', begin: 1790812800, end: 1792108799, records: [{ ...OK, count: 5 }] })),
  ];
  const d = summarize(reports);
  assert.equal(d.reports, 2);
  assert.equal(d.messages, 14);
  assert.equal(d.pass, 10);
  assert.equal(d.fail, 4);
  assert.equal(Math.round(d.passRate * 100), 71);
  assert.equal(d.senders.length, 2);
  assert.equal(d.failing[0].sourceIp, '52.212.19.177', 'los que fallan van primero');
  assert.equal(d.failing[0].label, '52.212.19.177', 'sin dominio autenticado, la etiqueta es la IP');
  assert.equal(d.senders.find((s) => s.sourceIp === OK.ip).label, 'bezhas.com');
  assert.deepEqual(d.reporters.map((r) => [r.org, r.fail]).sort(), [['Mimecast', 0], ['google.com', 4]]);
});

test('DMARC: la recomendación no endurece mientras haya fallos', () => {
  const d = summarize([parseReport(xml({ records: [OK, MAL] }))]);
  assert.equal(d.recommendation.level, 'blocked');
  assert.match(d.recommendation.text, /52\.212\.19\.177/);
});

test('DMARC: espera 14 días de datos limpios antes de proponer p=reject', () => {
  const corto = summarize([parseReport(xml({ records: [OK] }))]);
  assert.equal(corto.recommendation.level, 'wait');
  const largo = summarize([parseReport(xml({ begin: 1790000000, end: 1791500000, records: [OK] }))]);
  assert.equal(largo.recommendation.level, 'ready');
  const hecho = summarize([parseReport(xml({ p: 'reject', begin: 1790000000, end: 1791500000, records: [OK] }))]);
  assert.equal(hecho.recommendation.level, 'done');
});

test('DMARC: sin informes no inventa un veredicto', () => {
  const d = summarize([]);
  assert.equal(d.passRate, null);
  assert.equal(d.recommendation.level, 'unknown');
});
