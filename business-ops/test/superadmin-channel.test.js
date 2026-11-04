'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const sa = require('../src/channels/superadmin');

test('solo el chat configurado es SuperAdmin; sin configurar, nadie', () => {
  assert.equal(sa.isSuperAdmin(42, { TELEGRAM_SUPERADMIN_CHAT_ID: '42' }), true);
  assert.equal(sa.isSuperAdmin(43, { TELEGRAM_SUPERADMIN_CHAT_ID: '42' }), false);
  assert.equal(sa.isSuperAdmin(42, {}), false);
});

test('@departamento enruta; sin prefijo va a Dirección; alias desconocido no enruta', () => {
  assert.deepEqual(sa.parseDirective('@ventas Reserva Brickken'), { department: 'sales', text: 'Reserva Brickken' });
  assert.deepEqual(sa.parseDirective('@Tesorería runway'), { department: 'treasury', text: 'runway' });
  assert.equal(sa.parseDirective('¿cómo vamos?').department, 'chief');
  assert.equal(sa.parseDirective('@nadie hola').department, 'chief');
});

test('respuestas "1 sí" / "2 no"', () => {
  assert.deepEqual(sa.parseDecisionReply('1 sí'), { index: 0, approved: true });
  assert.deepEqual(sa.parseDecisionReply('2 No'), { index: 1, approved: false });
  assert.equal(sa.parseDecisionReply('hola'), null);
});

test('sendDigest solo escribe al chat del SuperAdmin y no envía sin configurar', async () => {
  const sent = [];
  const chief = { run: async () => ({
    digest: 'Todo estable.',
    decisions: [{ voice: 'Ventas', decision: 'Aceptar reparto', risk: 'sin contrato' }],
    disagreements: [{ subject: 'reparto', positions: [{ department: 'sales', position: 'aceptar' }, { department: 'legal', position: 'vetar' }] }],
  }) };
  const send = async (m) => sent.push(m);

  const none = await sa.sendDigest({ chief, reports: [], send, env: {} });
  assert.equal(none.sent, false);
  assert.equal(sent.length, 0);

  const ok = await sa.sendDigest({ chief, reports: [], send, env: { TELEGRAM_SUPERADMIN_CHAT_ID: '99' } });
  assert.equal(ok.sent, true);
  assert.equal(sent[0].to, '99');
  assert.match(sent[0].text, /1\. Ventas: Aceptar reparto/);
  assert.match(sent[0].text, /sales → aceptar \/ legal → vetar/);
});

const ENV = { TELEGRAM_SUPERADMIN_CHAT_ID: '99' };
const upd = (chatId, text) => ({ message: { chat: { id: chatId }, text } });
const mkSpace = (pending, resolved = []) => ({ hitl: {
  listPending: () => pending,
  resolve: (id, ok) => { resolved.push([id, ok]); return true; },
} });
const mkStore = () => { const f = {}; return { f, getFact: async ({ key }) => f[key], setFact: async ({ key, value }) => { f[key] = value; } }; };

test('un chat que no es el del SuperAdmin no es tratado como orden', async () => {
  const r = await sa.handleInbound({ update: upd(5, '@ventas haz algo'), tenantId: 't', space: mkSpace([]), send: async () => {}, env: ENV });
  assert.equal(r.handled, false);
});

test('el parte guarda la cola y "1 sí" aprueba esa aprobación concreta', async () => {
  const pending = [{ approvalId: 'appr_1', agentId: 'finance.token', action: 'transfer_bez', reason: 'mover activos' }];
  const resolved = []; const store = mkStore(); const sent = [];
  const send = async (m) => sent.push(m);
  const chief = { run: async ({ payload }) => ({ digest: 'ok', decisions: payload.reports.map(r => ({ voice: 'Finanzas', decision: r.decision })), disagreements: [] }) };
  const space = mkSpace(pending, resolved);

  await sa.runDigestJob({ tenantId: 't', space, chief, send, store, env: ENV });
  assert.deepEqual(store.f[sa.QUEUE_KEY], ['appr_1']);

  const r = await sa.handleInbound({ update: upd(99, '1 sí'), tenantId: 't', space, chief, send, store, env: ENV });
  assert.equal(r.handled, true);
  assert.deepEqual(resolved, [['appr_1', true]]);
});

test('@ventas ejecuta la orden en su departamento', async () => {
  let got; const sent = [];
  const r = await sa.handleInbound({
    update: upd(99, '@ventas Reserva Brickken'), tenantId: 't', space: mkSpace([]), chief: {},
    send: async (m) => sent.push(m), store: mkStore(), env: ENV,
    runDirective: async (i) => { got = i; return { result: { summary: 'reservado' } }; },
  });
  assert.equal(r.to, 'sales');
  assert.equal(got.department, 'sales');
  assert.equal(got.text, 'Reserva Brickken');
  assert.match(sent[0].text, /Ventas: reservado/);
});

test('sin chat propio usa TELEGRAM_CHAT_CEO y el propio manda si existe', () => {
  assert.equal(sa.superAdminChat({ TELEGRAM_CHAT_CEO: '7' }), '7');
  assert.equal(sa.superAdminChat({ TELEGRAM_CHAT_CEO: '7', TELEGRAM_SUPERADMIN_CHAT_ID: '8' }), '8');
  assert.equal(sa.isSuperAdmin(7, { TELEGRAM_CHAT_CEO: '7' }), true);
  assert.equal(sa.superAdminChat({}), null);
});

// ── Voz ──────────────────────────────────────────────────────────────────
const mkVoice = (over = {}) => {
  const spoken = [];
  return { spoken, repliesEnabled: true, canTranscribe: true,
    download: async () => Buffer.from('ogg'), transcribe: async () => '@ventas reserva Brickken',
    synthesize: async (t) => Buffer.from(`audio:${t}`), sendVoice: async (m) => spoken.push(m), ...over };
};

test('una nota de voz se transcribe, se ejecuta como orden y se contesta también en voz', async () => {
  const sent = []; let got; const voice = mkVoice();
  const r = await sa.handleInbound({
    update: { message: { chat: { id: 99 }, voice: { file_id: 'f1' } } }, tenantId: 't', space: mkSpace([]), chief: {},
    send: async (m) => sent.push(m), store: mkStore(), voice, env: ENV,
    runDirective: async (i) => { got = i; return { result: { summary: 'reservado' } }; },
  });
  assert.equal(r.to, 'sales');
  assert.equal(got.text, 'reserva Brickken');
  assert.match(sent[0].text, /Entendí: «@ventas reserva Brickken»/);
  assert.equal(voice.spoken.length, 1);
});

test('sin transcriptor lo dice y no inventa la orden', async () => {
  const sent = [];
  const r = await sa.handleInbound({
    update: { message: { chat: { id: 99 }, voice: { file_id: 'f1' } } }, tenantId: 't', space: mkSpace([]), chief: {},
    send: async (m) => sent.push(m), store: mkStore(), voice: mkVoice({ canTranscribe: false }), env: ENV,
    runDirective: async () => { throw new Error('no debe ejecutarse'); },
  });
  assert.equal(r.reason, 'sin_transcriptor');
  assert.match(sent[0].text, /no puedo transcribirla/);
});

test('un audio de otro chat no es una orden', async () => {
  const r = await sa.handleInbound({
    update: { message: { chat: { id: 5 }, voice: { file_id: 'f1' } } }, tenantId: 't', space: mkSpace([]),
    send: async () => {}, voice: mkVoice(), env: ENV });
  assert.equal(r.handled, false);
});

test('si la síntesis falla, el parte en texto ya salió y no se cae', async () => {
  const sent = [];
  const chief = { run: async () => ({ digest: 'ok', decisions: [], disagreements: [] }) };
  const voice = mkVoice({ synthesize: async () => { throw new Error('sin red'); } });
  const r = await sa.sendDigest({ chief, reports: [], send: async (m) => sent.push(m), voice, env: ENV });
  assert.equal(r.sent, true);
  assert.equal(sent.length, 1);
});

test('voz: transcribe por la URL del túnel de la IA local, y no por el Ollama de localhost', () => {
  const voz = require('../src/platform/voice');
  assert.equal(voz.fromEnv({ OLLAMA_URL: 'https://abc.trycloudflare.com', OLLAMA_API_KEY: 'k' }).canTranscribe, true);
  assert.equal(voz.fromEnv({ WHISPER_URL: 'http://127.0.0.1:8765' }).canTranscribe, true);
  assert.equal(voz.fromEnv({ OLLAMA_URL: 'http://localhost:11434' }).canTranscribe, false);
  assert.equal(voz.fromEnv({}).canTranscribe, false);
});

test('voz: si el túnel no responde (portátil apagado) el SuperAdmin recibe un aviso, no silencio', async () => {
  const sent = [];
  const voice = mkVoice({ transcribe: async () => { throw new Error('fetch failed'); } });
  const r = await sa.handleInbound({
    update: { message: { chat: { id: 99 }, voice: { file_id: 'f1' } } }, tenantId: 't', space: mkSpace([]), chief: {},
    send: async (m) => sent.push(m), store: mkStore(), voice, env: ENV, runDirective: async () => ({}) });
  assert.equal(r.reason, 'error_transcripcion');
  assert.match(sent[0].text, /No pude transcribir/);
});
