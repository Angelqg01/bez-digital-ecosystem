'use strict';

const BaseAgent = require('../BaseAgent');

/**
 * PitchMatcherAgent — dado un lead ya puntuado, elige QUÉ producto/servicio de
 * BeZhas ofrecerle y con qué ángulo. Alimenta al OutreachAgent con un `offer`
 * concreto en vez del genérico ("validación operativa y smart escrow").
 *
 * Catálogo de SubApps BeZhas (mismo orden que en `docs/PLAN-DESARROLLO.md`):
 *   - **BEZ-Coin**            — utility token ERC20 en Polygon (métodos de pago Web3, RWA)
 *   - **QualityEscrow**       — pagos que se liberan al validar la entrega (smart escrow)
 *   - **PureScan**            — verificación KYC/AML on-chain con evidencia
 *   - **CargoLink**           — trazabilidad logística tokenizada (aduanas, puertos)
 *   - **Treasury DAO**        — gobernanza y gestión de tesorería multi-firma
 *   - **Fundraising**         — ronda tokenizada con SAFT/SAFE (para startups)
 *
 * El agente NO improvisa: elige de este catálogo por reglas antes de invocar
 * al modelo (reglas explícitas → auditables → aprenden con OutcomeTracker).
 * El modelo se usa solo para redactar el ángulo/gancho ya elegido.
 */

const SUBAPPS = {
  'bez-coin': {
    key: 'bez-coin',
    label: 'BEZ-Coin',
    pitch: 'utility token para tokenizar activos reales y liquidar pagos en la propia red',
  },
  'quality-escrow': {
    key: 'quality-escrow',
    label: 'QualityEscrow',
    pitch: 'smart escrow que libera el pago solo cuando la entrega valida las condiciones acordadas',
  },
  'pure-scan': {
    key: 'pure-scan',
    label: 'PureScan',
    pitch: 'verificación KYC/AML on-chain con evidencia inmutable para auditorías',
  },
  'cargo-link': {
    key: 'cargo-link',
    label: 'CargoLink',
    pitch: 'trazabilidad logística tokenizada, integrable con sistemas aduaneros',
  },
  'treasury-dao': {
    key: 'treasury-dao',
    label: 'Treasury DAO',
    pitch: 'gestión de tesorería multi-firma con reglas de gobernanza on-chain',
  },
  'fundraising': {
    key: 'fundraising',
    label: 'Fundraising tokenizado',
    pitch: 'ronda tokenizada con SAFT/SAFE, cap table y disbursement automatizados',
  },
};

/** Reglas heurísticas segmento → SubApp por defecto. Explícitas a propósito. */
const SEGMENT_TO_SUBAPP = {
  logistica: 'cargo-link',
  aduanas: 'cargo-link',
  puertos: 'cargo-link',
  ecommerce: 'quality-escrow',
  marketplace: 'quality-escrow',
  banca: 'pure-scan',
  fintech: 'pure-scan',
  compliance: 'pure-scan',
  startup: 'fundraising',
  seed: 'fundraising',
  serie_a: 'fundraising',
  cripto: 'bez-coin',
  web3: 'bez-coin',
  dao: 'treasury-dao',
  tesoreria: 'treasury-dao',
};

/** Palabras del texto libre (rol/notas) que refuerzan la elección. */
const KEYWORD_HINTS = [
  { re: /aduan|portuari|carga|log[ií]stic/i,        key: 'cargo-link' },
  { re: /escrow|reclamaci[oó]n|devoluci[oó]n|marketplace/i, key: 'quality-escrow' },
  { re: /kyc|aml|blanqueo|sanciones|compliance/i,   key: 'pure-scan' },
  { re: /ronda|inversi[oó]n|safe\b|saft\b|seed|serie a/i, key: 'fundraising' },
  { re: /dao|multifirma|gobernanza|tesorer/i,       key: 'treasury-dao' },
  { re: /token|erc20|polygon|utility/i,             key: 'bez-coin' },
];

class PitchMatcherAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'sales.pitch-matcher',
      name: 'Pitch Matcher',
      department: 'sales',
      modelTier: 'fast',
      capabilities: ['sales:match-pitch'],
      systemPrompt:
        'Redactas UN ángulo de venta de una sola frase (máximo 25 palabras), específico ' +
        'del negocio del prospecto y anclado en el producto ya elegido. Sin jerga cripto, ' +
        'sin promesas de rentabilidad, sin CTA (lo pone el OutreachAgent).',
    });
    // Sesgos aprendidos: { "segment:subApp" -> peso 0..2 }. Los actualiza el
    // OutcomeTracker; con Map vacío se comporta igual que las reglas base.
    this.weights = ctx.pitchWeights || new Map();
  }

  static get SUBAPPS() { return SUBAPPS; }

  /** Elige la SubApp por reglas + pesos aprendidos (SIN modelo). */
  pick({ segment = '', role = '', notes = '', explicitSubApp = null } = {}) {
    if (explicitSubApp && SUBAPPS[explicitSubApp]) return SUBAPPS[explicitSubApp];

    const candidates = new Map();
    const add = (key, w) => candidates.set(key, (candidates.get(key) || 0) + w);

    // 1. Segmento base.
    const seg = SEGMENT_TO_SUBAPP[String(segment).toLowerCase()];
    if (seg) add(seg, 1.0);

    // 2. Pistas del texto libre.
    const text = `${role} ${notes}`;
    for (const { re, key } of KEYWORD_HINTS) {
      if (re.test(text)) add(key, 0.6);
    }

    // 3. Pesos aprendidos (OutcomeTracker los multiplica).
    for (const [key, w] of candidates) {
      const learned = this.weights.get(`${segment}:${key}`) ?? 1;
      candidates.set(key, w * learned);
    }

    if (!candidates.size) return SUBAPPS['bez-coin']; // fallback más genérico
    const [key] = [...candidates.entries()].sort((a, b) => b[1] - a[1])[0];
    return SUBAPPS[key];
  }

  async run(task) {
    const lead = task.payload?.lead || {};
    const segment = task.payload?.segment
      || (this.business ? this.business.segmentOf(lead) : 'sin_clasificar');

    const subApp = this.pick({
      segment,
      role: lead.role,
      notes: lead.notes,
      explicitSubApp: task.payload?.subApp,
    });

    // El modelo redacta SOLO el ángulo de una frase para el offer del OutreachAgent.
    const angle = await this.think(
      `Prospecto: ${lead.company || 'la empresa'} (${lead.role || 'dirección'}, segmento ${segment}). ` +
      `Producto elegido: ${subApp.label} — ${subApp.pitch}. ` +
      `Redacta el ángulo (una sola frase, ≤25 palabras) que conecte ese producto con su día a día.`,
      { useMemory: false, maxTokens: 100 },
    );

    // El offer que consume OutreachAgent = ángulo + producto (así queda anclado).
    const offer = `${angle.trim().replace(/\s+/g, ' ')} (${subApp.label})`;

    return { subApp: subApp.key, subAppLabel: subApp.label, angle: angle.trim(), offer, segment, status: 'ok' };
  }
}

module.exports = PitchMatcherAgent;
