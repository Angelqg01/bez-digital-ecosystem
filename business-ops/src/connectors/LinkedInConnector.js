'use strict';

const BaseConnector = require('./BaseConnector');

/**
 * LinkedInConnector — publicar en el feed de un miembro de LinkedIn.
 *
 * Alcance a propósito acotado a lo que LinkedIn permite sin aprobación de
 * partner (Marketing Developer Platform):
 *   - OIDC (`profile`, `email`) para saber quién soy.
 *   - `w_member_social` para publicar en el feed del miembro autenticado.
 *
 * Lo que NO hace, y por qué no:
 *   - Publicar en la página de una organización. Requiere `w_organization_social`
 *     y aprobación manual de LinkedIn Partner Program; hasta tenerla, no hay
 *     endpoint que responda.
 *   - Buscar leads/empresas. No existe endpoint público para ello en ningún
 *     tier auto-servicio — la Sales Navigator API es solo para partners.
 *
 * Línea roja: `public_post` (definida en RedLines.js) fuerza HITL antes de
 * publicar. Este conector NO añade guardrail propio; confía en que el agente
 * llama a través de `act()` con `category: 'public_post'`.
 *
 * Sin `LINKEDIN_ACCESS_TOKEN` va en modo simulado (mismo patrón que Stripe/
 * BlockchainConnector): el sistema arranca, los tests corren, y el operador
 * completa el OAuth cuando toque.
 */

const LINKEDIN_API = 'https://api.linkedin.com';
const REST_VERSION = '202409';
const MAX_POST_CHARS = 3000;   // límite documentado de LinkedIn para `commentary`

class LinkedInConnector extends BaseConnector {
  constructor({ tenantId, config = {} } = {}) {
    super({ tenantId, config });
    this.name = 'linkedin';
    this.policyCategory = 'public_post';   // por si alguien lo invoca como MCP dinámico

    this.accessToken = config.accessToken || process.env.LINKEDIN_ACCESS_TOKEN || '';
    // `memberUrn` es "urn:li:person:XXXX". Si no está y hay token, se resuelve
    // en el primer share() vía OIDC userinfo → sub.
    this.memberUrn = config.memberUrn || process.env.LINKEDIN_MEMBER_URN || '';
    this._fetch = config.fetch || globalThis.fetch;
    this.simulated = !this.accessToken;
  }

  async execute(method, args = {}) {
    switch (method) {
      case 'share': return this.share(args);
      case 'me':    return this.me();
      default: throw new Error(`linkedin: método desconocido ${method}`);
    }
  }

  /**
   * Publica un post de texto (opcionalmente con un enlace) en el feed del miembro.
   * Devuelve `{ id, url }` de la publicación.
   */
  async share({ text, articleUrl = null, visibility = 'PUBLIC' } = {}) {
    if (!text || typeof text !== 'string') throw new Error('linkedin: text requerido');
    if (text.length > MAX_POST_CHARS) {
      throw new Error(`linkedin: text supera el máximo (${MAX_POST_CHARS} caracteres)`);
    }
    if (visibility !== 'PUBLIC' && visibility !== 'CONNECTIONS') {
      throw new Error(`linkedin: visibility inválida (${visibility}); usa PUBLIC o CONNECTIONS`);
    }

    if (this.simulated) {
      const id = `urn:li:share:sim_${Math.random().toString(36).slice(2, 10)}`;
      return {
        id,
        url: `https://www.linkedin.com/feed/update/${encodeURIComponent(id)}`,
        visibility,
        author: this.memberUrn || 'urn:li:person:simulated',
        articleUrl,
        simulated: true,
      };
    }

    const author = this.memberUrn || (await this._resolveMemberUrn());
    const body = {
      author,
      commentary: text,
      visibility,
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    };
    if (articleUrl) {
      body.content = { article: { source: articleUrl } };
    }

    const res = await this._fetch(`${LINKEDIN_API}/rest/posts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': REST_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`linkedin: HTTP ${res.status} ${detail.slice(0, 200)}`.trim());
    }
    // LinkedIn devuelve la URN del post en la cabecera `x-restli-id` (o `x-linkedin-id`).
    const id = (res.headers?.get?.('x-restli-id') || res.headers?.get?.('x-linkedin-id') || '').trim();
    return {
      id,
      url: id ? `https://www.linkedin.com/feed/update/${encodeURIComponent(id)}` : null,
      visibility,
      author,
      articleUrl,
    };
  }

  /** OIDC userinfo. Solo lectura, no cuenta como efecto lateral. */
  async me() {
    if (this.simulated) {
      return { sub: 'simulated', name: 'Simulado', email: null, simulated: true };
    }
    const res = await this._fetch(`${LINKEDIN_API}/v2/userinfo`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!res.ok) throw new Error(`linkedin: userinfo HTTP ${res.status}`);
    const j = await res.json();
    return { sub: j.sub, name: j.name || null, email: j.email || null };
  }

  async _resolveMemberUrn() {
    const info = await this.me();
    if (!info?.sub) throw new Error('linkedin: no se pudo resolver memberUrn (OIDC sin sub)');
    this.memberUrn = `urn:li:person:${info.sub}`;
    return this.memberUrn;
  }
}

LinkedInConnector.MAX_POST_CHARS = MAX_POST_CHARS;
module.exports = LinkedInConnector;
