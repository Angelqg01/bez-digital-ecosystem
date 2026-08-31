'use strict';

const BaseAgent = require('../BaseAgent');

/**
 * Social — prepara publicaciones para redes. PUBLICAR es línea roja
 * (comunicación pública vinculante) → pasa por aprobación humana (bot de marketing).
 */
class SocialAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'marketing.social',
      name: 'Social',
      department: 'marketing',
      modelTier: 'mid',
      capabilities: ['marketing:social'],
      systemPrompt: 'Preparas publicaciones para redes sociales: gancho, cuerpo y CTA, adaptadas al canal. Publicar requiere aprobación humana.',
    });
  }

  async run(task) {
    const draft = await this.think(`Redacta una publicación para ${task.payload?.network || 'redes'} sobre: "${task.payload?.text || ''}".`);

    // Publicar NO se hace solo: comunicación pública = línea roja → HITL.
    let publish = null;
    if (task.payload?.publish) {
      const network = String(task.payload.network || '').toLowerCase();
      // LinkedIn tiene conector real; el resto todavía cae en el stub 'social'
      // para no romper flujos existentes hasta que se añada su backend concreto.
      const target = network === 'linkedin'
        ? { tool: 'linkedin', method: 'share', args: { text: draft, articleUrl: task.payload.articleUrl || null } }
        : { tool: 'social',   method: 'publish', args: { network, body: draft } };

      publish = await this.act({
        category: 'public_post',
        audience: 'public',
        ...target,
      });
    }
    return { draft, publish, status: 'ok' };
  }
}

module.exports = SocialAgent;
