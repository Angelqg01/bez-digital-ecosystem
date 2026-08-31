'use strict';

/**
 * MacroSuggesterAgent — borrador de respuesta para el humano al escalar.
 *
 * Lo que se blinda, por orden de daño:
 *   1. **Amenaza legal.** Nunca se redacta respuesta de fondo: solo acuse de
 *      recibo. Un borrador que admita culpa ante quien habla de denunciar es
 *      una prueba en contra en cuanto alguien pulsa enviar.
 *   2. **Promesas en el borrador generado.** `draftGuard` revisa la SALIDA del
 *      modelo (dinero, culpa, plazos, garantías) en vez de fiarse del prompt.
 *   3. **Inventar sin base.** Sin macro ni conocimiento, se devuelve `null`:
 *      una respuesta inventada en soporte es peor que ninguna.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const macros = require('../src/platform/macros');
const draftGuard = require('../src/platform/draftGuard');
const MacroSuggesterAgent = require('../src/agents/support/MacroSuggesterAgent');
const ModelGateway = require('../src/cognition/ModelGateway');
const EventBus = require('../src/core/EventBus');

function memoryStore(initial = {}) {
  const facts = new Map(Object.entries(initial));
  const k = (t, key) => `${t}:${key}`;
  return {
    getFact: async ({ tenantId, key }) => facts.get(k(tenantId, key)),
    setFact: async ({ tenantId, key, value }) => { facts.set(k(tenantId, key), value); },
    _facts: facts,
  };
}

const ctx = (extra = {}) => ({
  tenantId: 'bezhas', department: 'support',
  model: new ModelGateway({ providers: {} }),
  bus: new EventBus('bezhas'),
  ...extra,
});

const MACRO_FACTURA = {
  id: 'm_factura',
  title: 'Cómo descargar la factura',
  body: 'Puedes descargar tus facturas desde Ajustes → Facturación.',
  category: 'billing',
  keywords: ['factura', 'descargar', 'facturación'],
};

// ── Guardarraíl legal (el más caro si falla) ─────────────────────────────

test('con amenaza legal NO se redacta respuesta de fondo, solo acuse', async () => {
  let llamadasAlModelo = 0;
  const model = { complete: async () => { llamadasAlModelo++; return { text: 'lo que sea' }; } };
  const agent = new MacroSuggesterAgent(ctx({ model }));

  const out = await agent.run({
    payload: {
      text: 'Voy a denunciaros, esto es inadmisible',
      sentiment: { signals: ['legal_threat'], severity: 'critical' },
      kbHits: [{ title: 'Política', snippet: 'algo' }],
    },
  });

  assert.equal(out.source, 'legal_hold');
  assert.equal(out.requiresLegalReview, true);
  assert.equal(llamadasAlModelo, 0, 'ni siquiera se llama al modelo');
  assert.match(out.draft, /Hemos recibido su mensaje/);
  assert.ok(!/reembolso|culpa|garantizamos/i.test(out.draft), 'el acuse no compromete nada');
});

test('el acuse legal ignora incluso una macro que encajaría', async () => {
  const store = memoryStore({ 'bezhas:support:macros': [MACRO_FACTURA] });
  const agent = new MacroSuggesterAgent(ctx({ store }));
  const out = await agent.run({
    payload: {
      text: 'Mi factura está mal y hablaré con mi abogado',
      triage: { category: 'billing' },
      sentiment: { signals: ['legal_threat'] },
    },
  });
  assert.equal(out.source, 'legal_hold');
  assert.equal(out.macro, null);
});

// ── Preferencia por la macro guardada ────────────────────────────────────

test('si hay macro que encaja, se propone esa antes que generar', async () => {
  let llamadas = 0;
  const model = { complete: async () => { llamadas++; return { text: 'generado' }; } };
  const store = memoryStore({ 'bezhas:support:macros': [MACRO_FACTURA] });
  const agent = new MacroSuggesterAgent(ctx({ store, model }));

  const out = await agent.run({
    payload: {
      text: '¿Cómo descargo mi factura del mes?',
      triage: { category: 'billing' },
      kbHits: [{ title: 'x', snippet: 'y' }],
    },
  });

  assert.equal(out.source, 'macro');
  assert.equal(out.macro.id, 'm_factura');
  assert.equal(out.draft, MACRO_FACTURA.body);
  assert.equal(llamadas, 0, 'texto ya aprobado: no hace falta el modelo');
});

test('una macro que no encaja no se propone (peor que nada)', async () => {
  const store = memoryStore({ 'bezhas:support:macros': [MACRO_FACTURA] });
  const agent = new MacroSuggesterAgent(ctx({ store }));
  const out = await agent.run({
    payload: { text: 'El nodo validador no sincroniza', triage: { category: 'technical' }, kbHits: [] },
  });
  assert.notEqual(out.source, 'macro');
});

// ── Sin base: no inventar ────────────────────────────────────────────────

test('sin macro ni conocimiento devuelve null y lo explica', async () => {
  const agent = new MacroSuggesterAgent(ctx({ store: memoryStore() }));
  const out = await agent.run({ payload: { text: 'Consulta rarísima', kbHits: [] } });

  assert.equal(out.source, 'none');
  assert.equal(out.draft, null);
  assert.equal(out.grounded, false);
  assert.match(out.note, /no inventar/i);
});

test('un fallo del modelo no rompe el ticket', async () => {
  const model = { complete: async () => { throw new Error('proveedor caído'); } };
  const agent = new MacroSuggesterAgent(ctx({ model, store: memoryStore() }));
  const out = await agent.run({ payload: { text: 'hola', kbHits: [{ title: 'a', snippet: 'b' }] } });

  assert.equal(out.status, 'ok');
  assert.equal(out.draft, null);
  assert.match(out.note, /No se pudo generar/);
});

// ── Revisión del borrador generado ───────────────────────────────────────

test('un borrador con promesas se marca, no se censura', async () => {
  const model = {
    complete: async () => ({
      text: 'Ha sido un error nuestro. Le reembolsaremos el importe en 24 horas.',
    }),
  };
  const agent = new MacroSuggesterAgent(ctx({ model, store: memoryStore() }));
  const out = await agent.run({ payload: { text: 'cobro duplicado', kbHits: [{ title: 'Cobros', snippet: 'x' }] } });

  assert.equal(out.source, 'generated');
  assert.ok(out.draft.includes('reembolsaremos'), 'el texto llega íntegro: decide la persona');
  const ids = out.warnings.map((w) => w.id);
  assert.ok(ids.includes('admision_de_culpa'));
  assert.ok(ids.includes('compromiso_economico'));
  assert.ok(ids.includes('plazo_vinculante'));
  assert.match(out.note, /revisar antes de enviar/);
});

test('un borrador prudente pasa sin avisos', async () => {
  const model = { complete: async () => ({ text: 'Lamentamos las molestias. Un compañero revisa su caso y le escribirá.' }) };
  const agent = new MacroSuggesterAgent(ctx({ model, store: memoryStore() }));
  const out = await agent.run({ payload: { text: 'algo falla', kbHits: [{ title: 'a', snippet: 'b' }] } });

  assert.deepEqual(out.warnings, []);
  assert.match(out.note, /Revísalo antes de enviar/);
});

// ── draftGuard ───────────────────────────────────────────────────────────

test('draftGuard detecta las cuatro familias de compromiso', () => {
  const casos = [
    ['Ha sido culpa nuestra, lo sentimos', 'admision_de_culpa'],
    ['Le compensaremos por las molestias', 'compromiso_economico'],
    ['Lo tendrá resuelto en 24 horas', 'plazo_vinculante'],
    ['Le garantizamos que no volverá a ocurrir', 'garantia_absoluta'],
  ];
  for (const [texto, id] of casos) {
    const r = draftGuard.review(texto);
    assert.equal(r.safe, false, `no detectó: "${texto}"`);
    assert.ok(r.findings.some((f) => f.id === id), `esperaba ${id} en "${texto}"`);
  }
});

test('draftGuard no marca una respuesta normal ni se confunde con tildes', () => {
  assert.equal(draftGuard.review('Gracias por escribirnos. Revisaremos su caso y le contamos.').safe, true);
  // Con tildes y mayúsculas debe seguir detectando.
  assert.equal(draftGuard.review('HA SIDO CULPA NUESTRA').safe, false);
  assert.equal(draftGuard.review('').safe, true);
});

test('cada aviso explica POR QUÉ es un riesgo (si no, se ignora)', () => {
  const f = draftGuard.review('Le reembolsaremos el importe').findings[0];
  assert.ok(f.why && f.why.length > 20);
  assert.ok(f.match, 'debe decir qué frase concreta lo disparó');
});

// ── Almacén y emparejamiento de macros ───────────────────────────────────

test('guardar valida y normaliza; editar conserva el contador de uso', async () => {
  const store = memoryStore();
  await macros.save({ store, tenantId: 't', macro: { title: 'Reset de contraseña', body: 'Ve a Ajustes.', category: 'HowTo' } });
  await macros.markUsed({ store, tenantId: 't', id: 'm_reset_de_contrase_a' });

  const guardadas = await macros.list({ store, tenantId: 't' });
  assert.equal(guardadas[0].category, 'howto', 'la categoría se normaliza a minúsculas');
  assert.equal(guardadas[0].uses, 1);

  await macros.save({ store, tenantId: 't', macro: { id: guardadas[0].id, title: 'Reset de contraseña', body: 'Texto nuevo.' } });
  const tras = await macros.list({ store, tenantId: 't' });
  assert.equal(tras.length, 1, 'edita, no duplica');
  assert.equal(tras[0].body, 'Texto nuevo.');
  assert.equal(tras[0].uses, 1, 'el histórico de uso no se pierde al editar');
});

test('rechaza macros sin título o sin cuerpo', async () => {
  const store = memoryStore();
  await assert.rejects(() => macros.save({ store, tenantId: 't', macro: { body: 'x' } }), /title requerido/);
  await assert.rejects(() => macros.save({ store, tenantId: 't', macro: { title: 'x' } }), /body requerido/);
});

test('el emparejamiento puntúa categoría, términos y señales', () => {
  const m = { ...MACRO_FACTURA, signals: [] };
  const conCategoria = macros.score(m, { text: 'descargar factura', category: 'billing' });
  const sinCategoria = macros.score(m, { text: 'descargar factura', category: 'technical' });
  assert.ok(conCategoria > sinCategoria, 'acertar la categoría debe puntuar más');

  const conSenal = macros.score(
    { ...MACRO_FACTURA, signals: ['churn_intent'] },
    { text: 'descargar factura', category: 'billing', signals: ['churn_intent'] },
  );
  assert.ok(conSenal > conCategoria, 'coincidir en señal suma');
});

test('las palabras clave pesan más que la categoría automática', () => {
  // Caso real que falló: "No puedo entrar, mi acceso está bloqueado" no dice
  // "error" ni "no funciona", así que el triage lo marca `general`. Si la
  // categoría pesara más que los términos, la macro de acceso —que casa con 3
  // de sus 5 palabras clave— no se propondría.
  const acceso = {
    id: 'm_acceso', title: 'Problema de acceso a la cuenta', body: '...',
    category: 'technical', keywords: ['acceso', 'entrar', 'contraseña', 'bloqueado', 'login'], signals: [],
  };
  const texto = 'No puedo entrar, mi acceso está bloqueado';

  assert.ok(macros.score(acceso, { text: texto, category: 'general' }) >= macros.MIN_SCORE,
    '3 términos acertados deben bastar aunque falle la categoría');
  assert.ok(macros.bestMatch([acceso], { text: texto, category: 'general' }), 'debe proponerse');

  assert.ok(macros.score(acceso, { text: 'algo sin relación ninguna', category: 'technical' }) < macros.MIN_SCORE,
    'la categoría sola NO basta: sin términos no hay motivo para proponer un texto concreto');
});

test('añadir palabras clave a una macro no la penaliza', () => {
  const pocas = { id: 'a', title: 'Factura', body: 'x', category: 'billing', keywords: ['factura'], signals: [] };
  const muchas = { ...pocas, id: 'b', keywords: ['factura', 'recibo', 'cobro', 'importe', 'iva', 'pago', 'abono'] };
  const ctxq = { text: 'no encuentro mi factura', category: 'billing' };
  assert.ok(macros.score(muchas, ctxq) >= macros.score(pocas, ctxq),
    'enriquecer una macro debe ayudarla, no hundirla');
});

test('bestMatch devuelve null si nada llega al umbral', () => {
  assert.equal(macros.bestMatch([MACRO_FACTURA], { text: 'nodo validador', category: 'technical' }), null);
  assert.equal(macros.bestMatch([], { text: 'lo que sea' }), null);
});

test('a igual puntuación gana la macro más usada', () => {
  const a = { ...MACRO_FACTURA, id: 'a', uses: 0 };
  const b = { ...MACRO_FACTURA, id: 'b', uses: 25 };
  const best = macros.bestMatch([a, b], { text: 'descargar factura', category: 'billing' });
  assert.equal(best.macro.id, 'b');
});

test('una macro incompleta no tumba el emparejamiento de las demás', () => {
  // Una macro guardada con un formato anterior (sin keywords/signals) hacía
  // caer score() y el humano se quedaba sin NINGUNA sugerencia.
  const incompleta = { id: 'vieja', title: 'Factura', body: 'x', category: 'billing' };
  assert.doesNotThrow(() => macros.score(incompleta, { text: 'factura', category: 'billing' }));
  assert.equal(macros.score(null, { text: 'x' }), 0);

  const best = macros.bestMatch([incompleta, MACRO_FACTURA], { text: 'descargar factura', category: 'billing' });
  assert.ok(best, 'debe seguir emparejando pese a la macro incompleta');
});

test('las macros de un tenant no se ven desde otro', async () => {
  const store = memoryStore();
  await macros.save({ store, tenantId: 'a', macro: { title: 'Solo de A', body: 'x' } });
  assert.equal((await macros.list({ store, tenantId: 'b' })).length, 0);
});
