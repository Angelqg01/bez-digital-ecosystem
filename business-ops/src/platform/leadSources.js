'use strict';

/**
 * Fuentes de descubrimiento de leads para `LeadFunnel`.
 *
 * Contrato mínimo (duck typing):
 *   class Source {
 *     name: string
 *     async discover(icp, { limit }) → Array<{ company, contact, role, email?, notes?, ... }>
 *   }
 *
 * Sin dependencias externas: cada fuente sabe leer su propio backend y
 * devuelve leads normalizados. El funnel las llama en paralelo, dedupe por
 * (company + email) y las pasa por el scorer.
 *
 * Realidad sobre LinkedIn: la API self-serve NO permite buscar contactos ni
 * leer engagement en posts propios. Por eso NO hay `LinkedInScrapeSource`.
 * La forma legítima de captar leads desde LinkedIn es publicar contenido con
 * enlaces UTM'd al formulario web del tenant → `WebFormSource` los recoge.
 */

/**
 * WebFormSource — leads que llegan del formulario público del tenant.
 * Los almacena el endpoint HTTP en `store.setFact(tenantId, 'intake:queue', [...])`.
 * Aquí solo se leen y se limpian los ya procesados.
 */
class WebFormSource {
  constructor({ store, tenantId, name = 'web-form' } = {}) {
    this.store = store;
    this.tenantId = tenantId;
    this.name = name;
  }

  async discover(_icp, { limit = 50 } = {}) {
    if (!this.store?.getFact) return [];
    const queue = (await this.store.getFact({ tenantId: this.tenantId, key: 'intake:queue' })) || [];
    if (!queue.length) return [];
    const take = queue.slice(0, limit);
    const remain = queue.slice(limit);
    if (this.store.setFact) {
      await this.store.setFact({ tenantId: this.tenantId, key: 'intake:queue', value: remain });
    }
    return take.map((r) => ({ ...r, _source: this.name }));
  }
}

/**
 * OwnedListSource — listas que el tenant ya posee legítimamente (CSV importado,
 * export de un CRM previo). Se le pasan al constructor; se agotan al leer.
 */
class OwnedListSource {
  constructor({ leads = [], name = 'owned-list' } = {}) {
    this._leads = [...leads];
    this.name = name;
  }

  async discover(_icp, { limit = 50 } = {}) {
    const take = this._leads.splice(0, limit);
    return take.map((r) => ({ ...r, _source: this.name }));
  }
}

/**
 * PublicSearchSource — descubrimiento de empresas por búsqueda web pública a
 * través de un servidor MCP (Bright Data, Nimble, etc.). Solo se activa si
 * se le pasa un `mcp` conectado; sin él, devuelve [] (no falla).
 *
 * El parser es intencionalmente laxo: acepta JSON estructurado o texto plano
 * con un heurístico "Empresa — motivo" por línea; los MCPs varían mucho en
 * formato de respuesta y no queremos romper el funnel por eso.
 */
class PublicSearchSource {
  constructor({ mcp, toolName = 'search', queryBuilder = null, name = null } = {}) {
    this.mcp = mcp;
    this.toolName = toolName;
    this.name = name || `public-search:${mcp?.name || 'mcp'}`;
    this.queryBuilder = queryBuilder || PublicSearchSource.defaultQuery;
  }

  static defaultQuery(icp = {}) {
    const parts = [icp.sector, icp.pain, icp.geography].filter(Boolean);
    return parts.length ? `empresas ${parts.join(' ')} contacto director` : 'empresas potenciales cliente';
  }

  async discover(icp = {}, { limit = 20 } = {}) {
    if (!this.mcp) return [];
    let raw;
    try {
      raw = await this.mcp.execute(this.toolName, { query: this.queryBuilder(icp), question: this.queryBuilder(icp) });
    } catch (err) {
      console.warn(`[${this.name}] MCP falló: ${err.message}`);
      return [];
    }
    const leads = PublicSearchSource.parse(raw?.structured || raw?.text || '', { limit });
    return leads.map((r) => ({ ...r, _source: this.name }));
  }

  /** Extrae leads {company, notes} de la respuesta del MCP. */
  static parse(payload, { limit = 20 } = {}) {
    // 1. JSON estructurado con results/companies/leads.
    if (payload && typeof payload === 'object') {
      const arr = payload.results || payload.companies || payload.leads || payload.data || [];
      if (Array.isArray(arr)) {
        return arr.slice(0, limit).map((r) => ({
          company: r.company || r.name || r.title || null,
          contact: r.contact || r.person || null,
          role: r.role || r.title || null,
          notes: r.summary || r.snippet || r.description || null,
          url: r.url || r.link || null,
        })).filter((r) => r.company);
      }
    }
    // 2. Texto plano: una línea por lead.
    if (typeof payload === 'string' && payload.trim()) {
      const lines = payload.split('\n').map((l) => l.trim()).filter(Boolean);
      const leads = [];
      for (const line of lines) {
        // Formato heurístico "Empresa: nota" / "Empresa — nota" / "Empresa - nota".
        // El separador debe llevar espacio(s) alrededor (o ser `:`) para no partir
        // nombres tipo "solo-un-nombre".
        const m = line.match(/^(?:\d+[.)]\s*)?([^:\n]{2,80}?)\s*(?::|\s—\s|\s-\s)\s*(.{5,200})$/);
        if (m) leads.push({ company: m[1].trim(), notes: m[2].trim() });
        else if (line.length >= 3 && line.length <= 120) leads.push({ company: line });
        if (leads.length >= limit) break;
      }
      return leads;
    }
    return [];
  }
}

/**
 * LinkedInInboundSource — traducción operativa de "captar desde LinkedIn":
 * la API no permite scraping ni DMs, pero el `SocialAgent` sí publica en el
 * feed del miembro con enlaces UTM'd al formulario web. Esta fuente NO habla
 * con LinkedIn; simplemente reetiqueta los leads del `WebFormSource` cuyo
 * `utm_source === 'linkedin'` para que el aprendizaje distinga el canal.
 */
class LinkedInInboundSource {
  constructor({ webFormSource, name = 'linkedin-inbound' } = {}) {
    this.upstream = webFormSource;
    this.name = name;
  }

  async discover(icp, opts = {}) {
    const all = await this.upstream.discover(icp, opts);
    const mine = all.filter((r) => (r.utm_source || '').toLowerCase() === 'linkedin');
    // Los que no son míos vuelven a la cola para que el upstream real los sirva.
    const others = all.filter((r) => (r.utm_source || '').toLowerCase() !== 'linkedin');
    if (others.length && this.upstream.store?.setFact) {
      const q = (await this.upstream.store.getFact({ tenantId: this.upstream.tenantId, key: 'intake:queue' })) || [];
      await this.upstream.store.setFact({ tenantId: this.upstream.tenantId, key: 'intake:queue', value: [...others, ...q] });
    }
    return mine.map((r) => ({ ...r, _source: this.name }));
  }
}

module.exports = { WebFormSource, OwnedListSource, PublicSearchSource, LinkedInInboundSource };
