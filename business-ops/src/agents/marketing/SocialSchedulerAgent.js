'use strict';

const BaseAgent = require('../BaseAgent');
const queue = require('../../platform/socialQueue');

/**
 * SocialSchedulerAgent — publica lo programado, cuando toca y si sigue
 * teniendo sentido publicarlo.
 *
 * Publicar en diferido es cómodo y por eso mismo peligroso: el contenido se
 * aprueba en un contexto y sale en otro. Las dos protecciones viven en
 * `platform/socialQueue.js` y este agente las respeta sin excepción:
 *
 *   - **La aprobación caduca a las 48 h.** Pasado ese plazo se vuelve a pedir
 *     en vez de publicar. Aprobar el texto no es aprobar el mundo de dentro de
 *     tres días.
 *   - **Freno de mano.** Con el hold activo no sale nada, sin revisar la cola
 *     post por post. Durante un incidente nadie tiene tiempo de eso.
 *
 * Y por encima de todo sigue la línea roja `public_communication`: cada
 * publicación pasa por `act()` con `category: 'public_post'`.
 *
 * Idempotencia: un post ya publicado nunca se republica, aunque la tarea se
 * reintente.
 */
class SocialSchedulerAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'marketing.social-scheduler',
      name: 'Social Scheduler',
      department: 'marketing',
      modelTier: 'fast',
      capabilities: ['marketing:publish-due'],
      systemPrompt: 'Gestionas una cola de publicaciones programadas. No redactas contenido nuevo.',
    });
  }

  async run(task) {
    const p = task.payload || {};
    const now = p.now ?? Date.now();

    if (!this.store) {
      return { status: 'blocked', reason: 'sin almacenamiento: no hay cola que gestionar' };
    }

    // Acciones de gestión de la cola.
    if (p.action === 'schedule') {
      const post = await queue.enqueue({ store: this.store, tenantId: this.tenantId, post: p.post || {} });
      return { status: 'ok', action: 'schedule', post };
    }
    if (p.action === 'approve') {
      const post = await queue.approve({ store: this.store, tenantId: this.tenantId, id: p.id, now });
      return { status: 'ok', action: 'approve', post };
    }
    if (p.action === 'cancel') {
      const post = await queue.cancel({ store: this.store, tenantId: this.tenantId, id: p.id });
      return { status: 'ok', action: 'cancel', post };
    }
    if (p.action === 'hold') {
      const hold = await queue.setHold({ store: this.store, tenantId: this.tenantId, active: p.active !== false, reason: p.reason, now });
      this.bus?.emit('marketing:publish_hold', { tenantId: this.tenantId, ...hold });
      return { status: 'ok', action: 'hold', hold };
    }

    // Por defecto: publicar lo que toque.
    const hold = await queue.getHold({ store: this.store, tenantId: this.tenantId });
    const posts = await queue.list({ store: this.store, tenantId: this.tenantId });
    const pendientes = queue.due(posts, { now });

    if (hold.active) {
      return {
        status: 'held',
        reason: `Publicación congelada: ${hold.reason}`,
        wouldHavePublished: pendientes.length,
        published: [], skipped: [],
      };
    }

    const published = [];
    const skipped = [];

    for (const post of pendientes) {
      const veredicto = queue.canPublish(post, { now, hold: false });

      if (!veredicto.publish) {
        // Una aprobación caducada no es un error: es que hay que volver a
        // mirarla. Se marca para que aparezca en la bandeja de revisión.
        if (veredicto.code === 'approval_stale') {
          await queue.update({ store: this.store, tenantId: this.tenantId, id: post.id, patch: { state: 'stale' } });
          this.bus?.emit('marketing:approval_stale', {
            tenantId: this.tenantId, postId: post.id, network: post.network, scheduledFor: post.scheduledFor,
          });
        }
        skipped.push({ id: post.id, network: post.network, code: veredicto.code, reason: veredicto.reason });
        continue;
      }

      // No hay conector genérico multi-red: solo LinkedIn tiene backend real.
      // Sin este chequeo, programar un post para una red sin conector tiraba
      // TODA la tanda (incluidos los posts de LinkedIn que sí podían salir),
      // porque `act()` lanzaba en vez de devolver un resultado.
      const toolName = post.network === 'linkedin' ? 'linkedin' : 'social';
      if (!this.tools[toolName]) {
        skipped.push({
          id: post.id, network: post.network, code: 'no_connector',
          reason: `sin conector configurado para "${post.network}" (solo LinkedIn tiene backend real)`,
        });
        continue;
      }

      // Línea roja: comunicación pública. El tenant puede además endurecerla.
      let result;
      try {
        result = await this.act({
          category: 'public_post',
          audience: 'public',
          tool: toolName,
          method: post.network === 'linkedin' ? 'share' : 'publish',
          args: post.network === 'linkedin'
            ? { text: post.body, articleUrl: post.articleUrl || null }
            : { network: post.network, body: post.body },
        });
      } catch (err) {
        // Un fallo de ESTE post no puede tirar el resto de la tanda.
        skipped.push({ id: post.id, network: post.network, code: 'error', reason: err.message });
        continue;
      }

      const salio = !!(result && result.status !== 'rejected' && result.status !== 'blocked' && result.status !== 'pending_approval');
      if (salio) {
        await queue.update({
          store: this.store, tenantId: this.tenantId, id: post.id,
          patch: { state: 'published', publishedAt: now, result },
        });
        published.push({ id: post.id, network: post.network, result });
      } else {
        skipped.push({ id: post.id, network: post.network, code: result?.status || 'not_sent', reason: result?.reason || 'no aprobado' });
      }
    }

    return { status: 'ok', published, skipped, due: pendientes.length };
  }
}

module.exports = SocialSchedulerAgent;
