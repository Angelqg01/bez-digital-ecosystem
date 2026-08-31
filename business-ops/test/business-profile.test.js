'use strict';

/**
 * Capa de perfil de negocio: el perfil compone los prompts, alimenta el
 * scoring/segmentación y veta cuentas excluidas. Verificado con el perfil
 * real de BeZhas (config/business/bezhas.json).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const BusinessProfile = require('../src/platform/BusinessProfile');
const OutreachAgent = require('../src/agents/sales/OutreachAgent');
const LeadScorerAgent = require('../src/agents/sales/LeadScorerAgent');
const ModelGateway = require('../src/cognition/ModelGateway');
const PolicyEngine = require('../src/guardrails/PolicyEngine');
const HITLGate = require('../src/core/HITLGate');
const EventBus = require('../src/core/EventBus');

const bezhas = BusinessProfile.fromFile('bezhas');

test('el perfil de BeZhas carga desde config', () => {
  assert.ok(bezhas, 'debe existir config/business/bezhas.json');
  assert.match(bezhas.company, /BeZhas/);
});

test('cuentas excluidas: Iberdrola y Santander vetadas; una naviera cualquiera no', () => {
  assert.equal(bezhas.isExcluded({ company: 'Iberdrola S.A.' }), true);
  assert.equal(bezhas.isExcluded({ company: 'Banco Santander' }), true);
  assert.equal(bezhas.isExcluded({ company: 'Maersk' }), false);
  assert.equal(bezhas.isExcluded({ company: 'Foo', tags: ['Acuerdo V1'] }), true);
});

test('segmentación por términos del perfil', () => {
  assert.equal(bezhas.segmentOf({ company: 'Autoridad Portuaria de Algeciras' }), 'puerto');
  assert.equal(bezhas.segmentOf({ company: 'Wikifarmer' }), 'marketplace');
  assert.equal(bezhas.segmentOf({ company: 'Acme Ventures', role: 'Partner VC' }), 'inversor');
  assert.equal(bezhas.segmentOf({ company: 'Panadería Paco' }), 'sin_clasificar');
});

test('preámbulo en frío: prohíbe cripto y enlaces de pago; base ofrece la analogía', () => {
  const cold = bezhas.preamble('cold');
  assert.match(cold, /PROHIBIDO en frío/);
  assert.match(cold, /jerga cripto/);
  assert.match(cold, /honestidad/i);
  const base = bezhas.preamble('base');
  assert.match(base, /Tubería de Cristal/);
});

// ── Agentes con el perfil ───────────────────────────────────────────

function salesCtx(extra = {}) {
  return {
    tenantId: 'bezhas', department: 'sales',
    model: new ModelGateway({ providers: {} }),
    guardrails: new PolicyEngine({ tenantId: 'bezhas' }),
    bus: new EventBus('bezhas'),
    business: bezhas,
    ...extra,
  };
}

test('Outreach: cuenta excluida → bloqueado, no redacta ni envía', async () => {
  const email = { name: 'email', sent: 0, async execute() { this.sent++; return { sent: true }; } };
  const agent = new OutreachAgent(salesCtx({ tools: { email }, hitl: new HITLGate({}) }));
  const out = await agent.run({ type: 'sales:hunt', payload: { lead: { company: 'Iberdrola', email: 'x@iberdrola.es' }, cold: true } });
  assert.equal(out.status, 'blocked');
  assert.match(out.reason, /excluida/);
  assert.equal(email.sent, 0, 'jamás debe enviar a una cuenta excluida');
});

test('Outreach: prospecto en frío válido → pasa por HITL (línea roja cold_outbound)', async () => {
  const email = { name: 'email', sent: 0, async execute() { this.sent++; return { sent: true }; } };
  const hitl = new HITLGate({});
  let pidio = false;
  hitl.notify = ({ approvalId }) => { pidio = true; setImmediate(() => hitl.resolve(approvalId, false, 'no ahora')); };
  const agent = new OutreachAgent(salesCtx({ tools: { email }, hitl }));
  const out = await agent.run({ type: 'sales:hunt', payload: { lead: { company: 'Puerto de Valencia', email: 'dir@pv.es' }, cold: true } });
  assert.equal(pidio, true, 'el frío debe pedir aprobación');
  assert.equal(out.send.status, 'rejected');
  assert.equal(email.sent, 0);
});

test('LeadScorer: cuenta excluida → score 0 sin gastar el modelo ni tocar el CRM', async () => {
  const crm = { name: 'crm', calls: 0, async execute() { this.calls++; return {}; } };
  const agent = new LeadScorerAgent(salesCtx({ tools: { crm } }));
  const out = await agent.run({ payload: { lead: { company: 'Banco Santander', role: 'CFO' } } });
  assert.equal(out.score, 0);
  assert.equal(out.segment, 'excluida');
  assert.equal(crm.calls, 0);
});

test('LeadScorer: lead normal recibe segmento y score numérico', async () => {
  const agent = new LeadScorerAgent(salesCtx());
  const out = await agent.run({ payload: { lead: { company: 'Autoridad Portuaria de Cádiz', role: 'Director de Operaciones' } } });
  assert.equal(out.segment, 'puerto');
  assert.equal(typeof out.score, 'number');
});

// ── Un buzón por departamento ───────────────────────────────────────────────

test('BusinessProfile: cada departamento tiene su remitente, con nombre visible', () => {
  const p = new BusinessProfile({
    company: 'BeZhas',
    email: {
      domain: 'bez.digital',
      displayName: 'BeZhas',
      default: 'hola@bez.digital',
      byDepartment: { sales: 'ventas@bez.digital', support: 'soporte@bez.digital' },
    },
  });

  assert.equal(p.senderFor('sales'), 'BeZhas · Ventas <ventas@bez.digital>');
  assert.equal(p.senderFor('support'), 'BeZhas · Soporte <soporte@bez.digital>');
  // Un departamento sin buzón propio cae al general, no se queda sin remitente.
  assert.equal(p.senderFor('legal'), 'BeZhas <hola@bez.digital>');
  assert.equal(p.senderFor(undefined), 'BeZhas <hola@bez.digital>');
});

test('BusinessProfile: un remitente de otro dominio no se usa', () => {
  const p = new BusinessProfile({
    email: { domain: 'bez.digital', default: 'hola@bez.digital', byDepartment: { sales: 'ventas@otrodominio.com' } },
  });
  // Enviar desde un dominio que SPF/DKIM no autorizan hace que DMARC lo
  // rechace: mejor caer al remitente global que generar correos que no llegan.
  assert.equal(p.senderFor('sales'), null);
});

test('BusinessProfile: sin sección de correo no se inventa ninguna dirección', () => {
  const p = new BusinessProfile({ company: 'Sin Correo SL' });
  assert.equal(p.senderFor('sales'), null);
  assert.deepEqual(p.mailboxes(), []);
});

test('BusinessProfile: el perfil real de BeZhas declara los 10 buzones bajo su dominio', () => {
  const p = BusinessProfile.fromFile('bezhas');
  const buzones = p.mailboxes();
  assert.equal(buzones.length, 11, '10 departamentos + el general');
  assert.ok(buzones.every((b) => b.endsWith('@bez.digital')), 'todos bajo el dominio declarado');

  const departamentos = ['sales', 'support', 'marketing', 'finance', 'hr', 'operations', 'blockchain', 'legal', 'treasury', 'fundraising'];
  for (const d of departamentos) {
    assert.match(p.senderFor(d), /<[^@]+@bez\.digital>$/, `${d} debe tener remitente propio`);
  }
  // Y ninguno repetido: dos departamentos con el mismo buzón harían imposible
  // saber quién escribe y dónde debe caer la respuesta.
  assert.equal(new Set(departamentos.map((d) => p.senderFor(d))).size, departamentos.length);
});

test('El agente envía desde el buzón de SU departamento, sin tocar cada agente', async () => {
  const business = BusinessProfile.fromFile('bezhas');
  const enviados = [];
  const email = { name: 'email', async execute(method, args) { enviados.push(args); return { sent: true }; } };

  const BaseAgent = require('../src/agents/BaseAgent');
  const hazAgente = (department) => new BaseAgent({
    id: `${department}.x`, name: 'X', department, business,
    tools: { email },
    guardrails: { evaluate: () => ({ allowed: true }) },
  });

  await hazAgente('sales').act({ tool: 'email', method: 'send', args: { to: 'lead@puerto.es', subject: 'Hola' } });
  await hazAgente('finance').act({ tool: 'email', method: 'send', args: { to: 'cliente@x.es', subject: 'Factura' } });

  assert.match(enviados[0].from, /ventas@bez\.digital/);
  assert.match(enviados[1].from, /facturacion@bez\.digital/);
});

test('Un remitente explícito en la acción manda sobre el del departamento', async () => {
  const business = BusinessProfile.fromFile('bezhas');
  const enviados = [];
  const email = { name: 'email', async execute(m, args) { enviados.push(args); return { sent: true }; } };
  const BaseAgent = require('../src/agents/BaseAgent');
  const agente = new BaseAgent({
    id: 'sales.x', name: 'X', department: 'sales', business,
    tools: { email }, guardrails: { evaluate: () => ({ allowed: true }) },
  });

  await agente.act({ tool: 'email', method: 'send', args: { to: 'a@b.c', from: 'ceo@bez.digital' } });
  assert.equal(enviados[0].from, 'ceo@bez.digital');
});

// ── Lo que se fundió del prompt de captación ────────────────────────────────

test('El perfil recoge los mercados y verticales del prompt de captación', () => {
  const p = BusinessProfile.fromFile('bezhas');
  const d = p.toJSON();

  for (const m of ['Singapur', 'Tokio', 'Hong Kong']) {
    assert.ok(d.markets.includes(m), `falta el mercado ${m}`);
  }
  // Segmentación real del sector: una lonja pesquera y un exportador de
  // perecederos no son "sin_clasificar", que es lo que devolvía antes.
  assert.equal(p.segmentOf({ company: 'Lonja pesquera de Vigo' }), 'agro');
  assert.equal(p.segmentOf({ company: 'Mercamadrid' }), 'agro');
  assert.equal(p.segmentOf({ company: 'Ruralia' }), 'marketplace');
  assert.equal(p.segmentOf({ company: 'Frigoríficos del Sur', notes: 'exportador de perecederos a Asia' }), 'importador_exportador');
  assert.equal(p.segmentOf({ company: 'Fondo Agrotech Ventures' }), 'inversor');
});

test('La segmentación casa palabras completas, no trozos', () => {
  const p = BusinessProfile.fromFile('bezhas');
  // "port" vivía dentro de "exportador" e "importador": con includes(), todo
  // exportador acababa clasificado como puerto y recibía el discurso de otro.
  assert.notEqual(p.segmentOf({ company: 'Exportadora Levantina' }), 'puerto');
  assert.notEqual(p.segmentOf({ notes: 'importador de fruta' }), 'puerto');
  // Y el término de verdad sigue casando.
  assert.equal(p.segmentOf({ company: 'Autoridad Portuaria de Valencia' }), 'puerto');
  assert.equal(p.segmentOf({ company: 'Puerto de Algeciras' }), 'puerto');
});

test('Las plantillas de prospección solo entran en el preámbulo en frío', () => {
  const p = BusinessProfile.fromFile('bezhas');

  const frio = p.preamble('cold');
  assert.match(frio, /ÁNGULOS DE REFERENCIA/);
  assert.match(frio, /NO un texto para copiar/, 'una plantilla copiada literal viola la regla de personalizar');
  assert.match(frio, /CANAL: principal email/);

  // El preámbulo base lo llevan los 60 agentes: no puede cargar con las
  // plantillas de prospección de uno solo.
  const base = p.preamble('base');
  assert.ok(!base.includes('ÁNGULOS DE REFERENCIA'), 'las plantillas no van en el preámbulo general');
  assert.match(base, /MERCADOS OBJETIVO/, 'los mercados sí: orientan a todo el mundo');
});

test('La firma comercial incluye web, deck y agenda', () => {
  const p = BusinessProfile.fromFile('bezhas');
  assert.match(p.signature, /bez\.digital/);
  assert.match(p.signature, /drive\.google\.com/, 'el deck público que autoriza el prompt de captación');
  assert.match(p.signature, /calendar\.app\.google/);
});

test('Las restricciones del prompt de captación siguen vigentes tras la fusión', () => {
  const p = BusinessProfile.fromFile('bezhas');
  // Las dos cuentas que el prompt nombra como excluidas (Acuerdo V1).
  assert.equal(p.isExcluded({ company: 'Iberdrola' }), true);
  assert.equal(p.isExcluded({ company: 'Banco Santander' }), true);
  // Y la prohibición de jerga cripto en frío, que el prompt también exige.
  assert.match(p.preamble('cold'), /PROHIBIDO en frío/);
});

test('El remitente viaja en la acción que aprueba el humano, no se añade después', async () => {
  const business = BusinessProfile.fromFile('bezhas');
  const BaseAgent = require('../src/agents/BaseAgent');
  let aprobada = null;

  const agente = new BaseAgent({
    id: 'sales.outreach', name: 'X', department: 'sales', business,
    tools: { email: { name: 'email', async execute() { return { sent: true }; } } },
    // Línea roja: la acción pasa por HITL antes de ejecutarse.
    guardrails: { evaluate: () => ({ allowed: false, requiresApproval: true, reason: 'envío en frío' }) },
    hitl: { request: async (req) => { aprobada = req.action; return { approved: false }; } },
  });

  await agente.act({ tool: 'email', method: 'send', args: { to: 'lead@puerto.es', subject: 'Hola' } });

  // Lo que se le enseña al humano debe ser exactamente lo que saldría: si el
  // remitente se inyectara al ejecutar, la bandeja no diría desde qué buzón se
  // envía, y una aprobación huérfana rehidratada tras un reinicio (que ejecuta
  // la acción guardada) saldría con el remitente global.
  assert.match(aprobada.args.from, /ventas@bez\.digital/,
    'la acción que se somete a aprobación ya lleva el buzón del departamento');
});

test('Identidad: asesor de BeZhas, y ante la duda se pasa a una persona', () => {
  const p = BusinessProfile.fromFile('bezhas');
  const reglas = p.toJSON().honestyRules.join(' ');

  assert.match(reglas, /Preséntate como asesor de BeZhas/);
  // El agente puede no sacar el tema, pero no puede decir que es humano: eso
  // sería engañar al cliente, y desde 2026 además choca con el AI Act.
  assert.match(reglas, /NO afirmes ser una persona/);
  assert.match(reglas, /deriva a un humano/);

  // Y la duda del cliente es motivo de escalado, no algo que el agente esquive.
  assert.ok(
    p.toJSON().humanEscalation.some((r) => /pide hablar con una persona/.test(r)),
    'preguntar con quién habla debe llevar a un humano'
  );

  // La regla viaja en el preámbulo de TODOS los modos: la pregunta puede llegar
  // en frío, en soporte o en una negociación.
  for (const modo of ['base', 'cold', 'warm']) {
    assert.match(p.preamble(modo), /asesor de BeZhas/, `falta en el modo ${modo}`);
  }
});
