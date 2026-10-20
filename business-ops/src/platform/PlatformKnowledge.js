'use strict';

/**
 * PlatformKnowledge — consulta en vivo el Knowledge Plane de la API de BeZhas
 * (POST /api/operant-knowledge/search) con la identidad del tenant.
 *
 * La API decide qué ve cada tenant: el de BeZhas, el conocimiento público; el de
 * una empresa cliente, sólo el suyo privado. OPERANT no elige el alcance: sólo
 * dice quién pregunta (su tenantId) y se autentica con la clave interna.
 *
 * Falla abierto: si la API no responde a tiempo o da error, devuelve [] y el
 * agente sigue con la KnowledgeBase local del tenant. El servicio al cliente no
 * se cae porque la API esté lenta.
 */
const TIMEOUT_MS = Number(process.env.PLATFORM_KNOWLEDGE_TIMEOUT_MS || 3000);

class PlatformKnowledge {
  constructor({ apiUrl = process.env.BEZHAS_API_URL, internalKey = process.env.INTERNAL_API_KEY, fetchImpl, timeoutMs = TIMEOUT_MS, logger = console } = {}) {
    this.apiUrl = (apiUrl || '').replace(/\/$/, '');
    this.internalKey = internalKey || '';
    this.fetch = fetchImpl || ((...a) => fetch(...a));
    this.timeoutMs = timeoutMs;
    this.logger = logger;
  }

  get enabled() {
    return Boolean(this.apiUrl && this.internalKey) && process.env.PLATFORM_KNOWLEDGE !== 'off';
  }

  /** @returns {Promise<Array<{id,title,snippet,score,source}>>} */
  async search(tenantId, query, { k = 3 } = {}) {
    if (!this.enabled || !query) return [];
    try {
      const res = await this.fetch(`${this.apiUrl}/api/operant-knowledge/search`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': this.internalKey },
        body: JSON.stringify({ tenantId, pregunta: String(query).slice(0, 300), limite: k }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) {
        this.logger.warn?.(`[PlatformKnowledge] ${tenantId}: la API respondió ${res.status}`);
        return [];
      }
      const data = await res.json();
      return (data.resultados || []).map((r) => ({
        id: r.documento,
        title: r.titulo,
        snippet: r.fragmento,
        score: Number.isFinite(r.relevancia) ? r.relevancia : null,
        source: 'bezhas',
      }));
    } catch (err) {
      this.logger.warn?.(`[PlatformKnowledge] ${tenantId}: ${err.name === 'TimeoutError' ? 'sin respuesta a tiempo' : err.message}`);
      return [];
    }
  }
}

/**
 * Envuelve la KnowledgeBase de un tenant: `search` mezcla primero el conocimiento
 * de la plataforma (vigente y filtrado por la API) y después los artículos
 * locales que no repitan título. Todo lo demás (ingest, size, hydrate…) va a la
 * KnowledgeBase original.
 */
function withPlatformKnowledge(knowledgeBase, platform, tenantId) {
  if (!knowledgeBase || !platform?.enabled) return knowledgeBase;
  return new Proxy(knowledgeBase, {
    get(target, prop, receiver) {
      if (prop !== 'search') {
        const v = Reflect.get(target, prop, receiver);
        return typeof v === 'function' ? v.bind(target) : v;
      }
      return async (query, opts = {}) => {
        const k = opts.k || 3;
        const [remotos, locales] = await Promise.all([
          platform.search(tenantId, query, { k }),
          target.search(query, opts),
        ]);
        const vistos = new Set(remotos.map((h) => String(h.title).toLowerCase()));
        const extra = locales.filter((h) => !vistos.has(String(h.title).toLowerCase()));
        return [...remotos, ...extra].slice(0, k);
      };
    },
  });
}

module.exports = { PlatformKnowledge, withPlatformKnowledge };
