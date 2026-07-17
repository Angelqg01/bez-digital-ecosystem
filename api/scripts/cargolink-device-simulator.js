#!/usr/bin/env node
'use strict';

/**
 * cargolink-device-simulator — EJEMPLO DE INTEGRACIÓN para clientes de BZ CargoLink.
 * =====================================================================================
 * Este script es el "mock de referencia": simula los dos mundos de entrada del
 * Hub de Ingestión Unificado contra la API REAL (sin atajos internos — solo HTTP):
 *
 *   A) Hardware propio  → e-seal + reefer logger + GPS, con firma secp256k1 opcional
 *   B) Sistema externo  → webhook estilo DHL firmado con HMAC-SHA256
 *
 * Requisitos:
 *   - API corriendo (por defecto http://localhost:3001/api/cargolink)
 *   - Una clave de actor rol pos/admin (emítela desde /admin/keys u Operarios)
 *
 * Uso:
 *   export CARGOLINK_ACTOR_KEY=bzk_live_xxx          # clave de actor pos/admin
 *   export CARGOLINK_API_URL=http://localhost:3001/api/cargolink   # opcional
 *
 *   node scripts/cargolink-device-simulator.js setup      # crea tx+geocerca+devices+provider
 *   node scripts/cargolink-device-simulator.js run        # telemetría normal (reefer+gps), Ctrl+C para parar
 *   node scripts/cargolink-device-simulator.js breach     # brecha de cadena de frío (14°C)
 *   node scripts/cargolink-device-simulator.js tamper     # e-seal abierto FUERA de la aduana → disputa crítica
 *   node scripts/cargolink-device-simulator.js provider   # webhook de tercero firmado HMAC (POD de DHL)
 *   node scripts/cargolink-device-simulator.js anchor     # merkle root del lote + prueba de inclusión
 *   node scripts/cargolink-device-simulator.js status     # telemetría + disputas + anclajes del B-UID
 *
 * El estado (B-UID, claves de dispositivo, secreto del provider) se guarda en
 * scripts/.cargolink-sim.json tras `setup` para las siguientes órdenes.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const API = (process.env.CARGOLINK_API_URL || 'http://localhost:3001/api/cargolink').replace(/\/$/, '');
const ACTOR_KEY = process.env.CARGOLINK_ACTOR_KEY || '';
const STATE_FILE = path.join(__dirname, '.cargolink-sim.json');

// Puerto de Algeciras — la zona aduanera autorizada de la demo.
const ALGECIRAS = { lat: 36.1408, lng: -5.4386 };
// Sevilla — un punto claramente FUERA de la geocerca (para el tamper).
const SEVILLA = { lat: 37.3891, lng: -5.9845 };

// ── HTTP helper (lo mismo que haría tu backend: fetch + Bearer) ──────────────
async function call(method, pathname, { key, body, raw, headers } = {}) {
  const res = await fetch(`${API}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
      ...(headers || {}),
    },
    body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${pathname} → ${res.status}: ${data.error || 'error'}`);
  return data;
}

const loadState = () => JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
const saveState = (s) => fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
const log = (label, value) => console.log(`  ${label.padEnd(22)} ${typeof value === 'string' ? value : JSON.stringify(value)}`);

function requireActorKey() {
  if (!ACTOR_KEY) {
    console.error('Falta CARGOLINK_ACTOR_KEY (clave de actor rol pos/admin, prefijo bzk_).');
    process.exit(1);
  }
}

// ── Firma edge (secp256k1) — así firma un dispositivo con secure element ─────
// El canónico que verifica el backend es EXACTAMENTE este JSON (EIP-191):
//   JSON.stringify({ deviceId, bUid, recordedAt, readings })
async function signReadings(wallet, { deviceId, bUid, recordedAt, readings }) {
  const canonical = JSON.stringify({ deviceId, bUid, recordedAt, readings });
  return wallet.signMessage(canonical);
}

// ── Comandos ─────────────────────────────────────────────────────────────────

async function setup() {
  requireActorKey();
  console.log(`\n[1/5] Creando transacción B-UID con escrow de 100 BEZ…`);
  const tx = await call('POST', '/v1/tx', {
    key: ACTOR_KEY,
    body: {
      origin: 'Algeciras, ES',
      destination: 'Frankfurt, DE',
      cargo: { type: 'pharma', description: 'Vacunas — cadena de frío 2-8°C' },
      escrowAmountBez: 100,
    },
  });
  const bUid = tx.transaction.b_uid;
  log('B-UID', bUid);

  console.log(`\n[2/5] Creando geocerca aduanera (Algeciras, radio 2 km)…`);
  const fence = await call('POST', '/v1/geofences', {
    key: ACTOR_KEY,
    body: { name: 'Aduana Algeciras', kind: 'customs', bUid, centerLat: ALGECIRAS.lat, centerLng: ALGECIRAS.lng, radiusM: 2000 },
  });
  log('geofence id', fence.geofence.id);

  console.log(`\n[3/5] Registrando reefer logger (temp/humedad, SIN firma)…`);
  const reefer = await call('POST', '/v1/iot/devices', {
    key: ACTOR_KEY,
    body: { type: 'multi', bUid, label: 'Reefer logger demo', config: { tempMin: 2, tempMax: 8, humidityMax: 85 } },
  });
  log('reefer deviceKey', reefer.deviceKey);

  console.log(`\n[4/5] Registrando e-seal CON firma secp256k1 (secure element)…`);
  const wallet = ethers.Wallet.createRandom(); // en hardware real: clave dentro del chip
  const eseal = await call('POST', '/v1/iot/devices', {
    key: ACTOR_KEY,
    body: { type: 'eseal', bUid, label: 'E-seal demo', signerAddress: wallet.address },
  });
  log('eseal deviceKey', eseal.deviceKey);
  log('eseal signer', wallet.address);

  console.log(`\n[5/5] Registrando proveedor externo (DHL_API) con mapping declarativo…`);
  const provider = await call('POST', '/v1/providers', {
    key: ACTOR_KEY,
    body: {
      name: 'DHL_API',
      kind: 'carrier',
      mapping: {
        buidField: 'shipment.reference',
        eventField: 'status',
        events: { SEAL_OPEN: 'CONTAINER_UNSEALED', POD: 'CHECKPOINT_DELIVERED' },
        systemIdField: 'device.id',
        timestampField: 'occurred_at',
        telemetryFields: {
          'location.lat': 'lat',
          'location.lng': 'lng',
          'sensors.temp_c': 'temperature',
        },
      },
    },
  });
  log('providerId', provider.provider.provider_id);
  log('provider secret', provider.secret);
  log('ingest URL', provider.ingestUrl);

  saveState({
    bUid,
    reeferKey: reefer.deviceKey,
    reeferId: reefer.device.device_id,
    esealKey: eseal.deviceKey,
    esealId: eseal.device.device_id,
    esealSignerPk: wallet.privateKey,
    providerId: provider.provider.provider_id,
    providerSecret: provider.secret,
  });
  console.log(`\nEstado guardado en ${STATE_FILE}. Siguiente: \`run\`, \`breach\`, \`tamper\`, \`provider\`, \`anchor\`.`);
}

// Telemetría normal en bucle: reefer a 4-6°C + GPS dentro de la zona.
async function run() {
  const s = loadState();
  console.log(`Streaming telemetría normal de ${s.reeferId} → ${s.bUid} (Ctrl+C para parar)…`);
  let tick = 0;
  const timer = setInterval(async () => {
    tick += 1;
    const temperature = 4 + Math.sin(tick / 3) * 1.5; // 2.5–5.5 °C: dentro de rango
    try {
      const out = await call('POST', '/v1/iot/telemetry', {
        key: s.reeferKey,
        body: {
          bUid: s.bUid,
          temperature: Number(temperature.toFixed(2)),
          humidity: 62,
          lat: ALGECIRAS.lat + tick * 0.0005, // avanzando desde el puerto
          lng: ALGECIRAS.lng + tick * 0.0005,
        },
      });
      console.log(`  #${tick} → stored=${out.stored} breaches=${out.breaches.length} temp=${temperature.toFixed(2)}°C`);
    } catch (err) {
      console.error(`  #${tick} ERROR: ${err.message}`);
    }
  }, 3000);
  process.on('SIGINT', () => { clearInterval(timer); process.exit(0); });
}

// Brecha de cadena de frío: el oráculo la gradúa (moderada → retiene escrow).
async function breach() {
  const s = loadState();
  const out = await call('POST', '/v1/iot/telemetry', {
    key: s.reeferKey,
    body: { bUid: s.bUid, temperature: 14 },
  });
  console.log('\nBrecha enviada. Veredicto del oráculo:');
  log('severidad', `${out.verdict.severity} (${out.verdict.severityLabel})`);
  log('acción', out.verdict.action);
  log('disputa', out.dispute || 'no abierta');
  log('settlement', out.verdict.settlement);
  log('webhooks', out.webhookDeliveries.length);
}

// Tamper: e-seal abierto FUERA de la geocerca aduanera → crítico, firmado.
async function tamper() {
  const s = loadState();
  const wallet = new ethers.Wallet(s.esealSignerPk);
  const recordedAt = new Date().toISOString();
  const readings = [{ metric: 'seal', state: 'open', lat: SEVILLA.lat, lng: SEVILLA.lng }];
  const signature = await signReadings(wallet, { deviceId: s.esealId, bUid: s.bUid, recordedAt, readings });

  const out = await call('POST', '/v1/iot/telemetry', {
    key: s.esealKey,
    body: { bUid: s.bUid, recordedAt, readings, signature },
  });
  console.log('\nE-seal abierto fuera de zona autorizada (payload FIRMADO):');
  log('trust level', out.trustLevel);
  log('breach', out.breaches[0]);
  log('severidad', `${out.verdict.severity} (${out.verdict.severityLabel})`);
  log('disputa', out.dispute);
  log('settlement', out.verdict.settlement);
}

// Webhook de tercero: así envía eventos un carrier/aduana con HMAC-SHA256.
async function provider() {
  const s = loadState();
  const payload = {
    status: 'POD',
    occurred_at: new Date().toISOString(),
    shipment: { reference: s.bUid },
    device: { id: 'DHL-SCAN-042' },
    location: { lat: 50.0379, lng: 8.5622 }, // FRA
    sensors: { temp_c: 5.1 },
  };
  const rawBody = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomUUID();
  // Receta HMAC (idéntica para cualquier integrador):
  //   firma = HMAC_SHA256(secret, `${timestamp}.${nonce}.${rawBody}`)
  const signature = crypto.createHmac('sha256', s.providerSecret)
    .update(`${timestamp}.${nonce}.${rawBody}`).digest('hex');

  const out = await call('POST', `/v1/ingest/${s.providerId}`, {
    raw: rawBody,
    headers: {
      'X-BeZhas-Timestamp': String(timestamp),
      'X-BeZhas-Nonce': nonce,
      'X-BeZhas-Signature': `sha256=${signature}`,
    },
  });
  console.log('\nWebhook de tercero aceptado (HMAC verificado):');
  log('provider', out.provider);
  log('eventType', out.eventType);
  log('stored', out.stored);
}

// Merkle root del lote + prueba de inclusión de la primera lectura.
async function anchor() {
  requireActorKey();
  const s = loadState();
  const anchored = await call('POST', `/v1/iot/anchor/${encodeURIComponent(s.bUid)}`, { key: ACTOR_KEY });
  console.log('\nLote consolidado en merkle root:');
  log('root', anchored.anchor.merkle_root);
  log('lecturas', anchored.anchor.leaf_count);
  log('on-chain', anchored.chain.anchored ? anchored.chain.txHash : `no (${anchored.chain.mode})`);

  const feed = await call('GET', `/v1/iot/telemetry?bUid=${encodeURIComponent(s.bUid)}&limit=200`, { key: ACTOR_KEY });
  const oldest = feed.telemetry[feed.telemetry.length - 1];
  const proof = await call('GET', `/v1/iot/proof?bUid=${encodeURIComponent(s.bUid)}&readingId=${oldest.id}`, { key: ACTOR_KEY });
  console.log(`\nPrueba de inclusión de la lectura #${oldest.id} (${oldest.metric}):`);
  log('leaf', proof.leaf);
  log('proof', `${proof.proof.length} siblings`);
  log('verificada', proof.verified);
}

async function status() {
  requireActorKey();
  const s = loadState();
  const [feed, disputes, anchors] = await Promise.all([
    call('GET', `/v1/iot/telemetry?bUid=${encodeURIComponent(s.bUid)}&limit=10`, { key: ACTOR_KEY }),
    call('GET', `/v1/disputes?bUid=${encodeURIComponent(s.bUid)}`, { key: ACTOR_KEY }),
    call('GET', `/v1/iot/anchors?bUid=${encodeURIComponent(s.bUid)}`, { key: ACTOR_KEY }),
  ]);
  console.log(`\nB-UID ${s.bUid}:`);
  log('lecturas (últimas 10)', feed.count);
  feed.telemetry.slice(0, 5).forEach((t) =>
    console.log(`    ${t.metric.padEnd(12)} ${String(t.value ?? '—').padEnd(8)} ${t.event_type || ''} ${t.breach ? 'BREACH' : ''} ${t.tamper ? 'TAMPER' : ''} [${t.trust_level}]`));
  log('disputas', disputes.disputes.map((d) => `#${d.id} sev${d.severity} ${d.action} ${d.status}`));
  log('anclajes', anchors.anchors.map((a) => `${a.merkle_root.slice(0, 14)}… (${a.leaf_count} hojas, on-chain=${a.anchored})`));
}

// ── Main ─────────────────────────────────────────────────────────────────────
const cmd = process.argv[2];
const commands = { setup, run, breach, tamper, provider, anchor, status };
if (!commands[cmd]) {
  console.log('Uso: node scripts/cargolink-device-simulator.js <setup|run|breach|tamper|provider|anchor|status>');
  process.exit(1);
}
commands[cmd]().catch((err) => { console.error(`\nERROR: ${err.message}`); process.exit(1); });
