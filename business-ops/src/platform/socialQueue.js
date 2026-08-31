'use strict';

/**
 * socialQueue — cola de publicaciones programadas y sus reglas de seguridad.
 *
 * El fallo característico de la publicación programada no es técnico: es que
 * un post aprobado el lunes se publique el viernes en mitad de un incidente.
 * Le ha pasado a marcas grandes — el mensaje alegre que sale automáticamente
 * el día que la empresa está en portada por un problema. Para BeZhas, con
 * activos on-chain de por medio, un post entusiasta durante un exploit sería
 * exactamente eso.
 *
 * De ahí las dos reglas que estructuran este módulo:
 *
 *   1. **La aprobación caduca.** Si el "sí" del humano tiene más horas que
 *      `APPROVAL_TTL_MS` cuando llega el momento de publicar, no se publica:
 *      se vuelve a pedir. Aprobar el contenido no es aprobar el contexto de
 *      dentro de tres días.
 *   2. **Freno de mano global.** `hold` congela TODA la cola de golpe, sin
 *      tener que ir post por post. Durante un incidente no hay tiempo de
 *      revisar una lista, y desprogramar a mano es justo lo que no se hace
 *      cuando todo el mundo está apagando el fuego.
 *
 * Funciones puras sobre el estado + persistencia por tenant. Sin modelo.
 */

const KEY = 'marketing:social_queue';
const HOLD_KEY = 'marketing:publish_hold';

/** Cuánto vale un "sí" humano antes de tener que volver a preguntar. */
const APPROVAL_TTL_MS = 48 * 60 * 60 * 1000;   // 48 h

/** Margen por el que se considera que "ya toca" (evita perder un tick justo). */
const DUE_TOLERANCE_MS = 60_000;

const STATES = ['draft', 'approved', 'published', 'cancelled', 'stale'];

class QueueError extends Error {
  constructor(message, { status = 400, code = 'invalid' } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Valida y normaliza un post antes de encolarlo. */
function validate({ id, network, body, scheduledFor, articleUrl = null } = {}) {
  const n = String(network || '').toLowerCase().trim();
  if (!n) throw new QueueError('network requerido', { code: 'network_required' });
  const b = String(body || '').trim();
  if (!b) throw new QueueError('body requerido', { code: 'body_required' });

  const when = Number(scheduledFor);
  if (!Number.isFinite(when)) throw new QueueError('scheduledFor debe ser un timestamp', { code: 'bad_schedule' });

  return {
    id: String(id || `sp_${when}_${n}_${Math.random().toString(36).slice(2, 7)}`),
    network: n,
    body: b.slice(0, 3000),
    articleUrl,
    scheduledFor: when,
    state: 'draft',
    approvedAt: null,
    publishedAt: null,
    result: null,
  };
}

/**
 * ¿Se puede publicar este post AHORA?
 * @returns {{ publish: boolean, reason: string, code: string }}
 */
function canPublish(post, { now = Date.now(), hold = false, approvalTtlMs = APPROVAL_TTL_MS } = {}) {
  if (!post) return { publish: false, reason: 'post inexistente', code: 'not_found' };

  if (hold) {
    return { publish: false, reason: 'publicación congelada (freno de mano activo)', code: 'on_hold' };
  }
  if (post.state === 'published') return { publish: false, reason: 'ya publicado', code: 'already_published' };
  if (post.state === 'cancelled') return { publish: false, reason: 'cancelado', code: 'cancelled' };

  if (post.state !== 'approved' || !post.approvedAt) {
    return { publish: false, reason: 'sin aprobación humana', code: 'not_approved' };
  }
  if (now + DUE_TOLERANCE_MS < post.scheduledFor) {
    return { publish: false, reason: 'aún no toca', code: 'not_due' };
  }

  // La aprobación caduca: el humano aprobó un contenido en un contexto, y el
  // contexto de dentro de tres días no lo aprobó nadie.
  const edad = now - post.approvedAt;
  if (edad > approvalTtlMs) {
    return {
      publish: false,
      code: 'approval_stale',
      reason: `la aprobación tiene ${Math.round(edad / 3_600_000)} h (máximo ${Math.round(approvalTtlMs / 3_600_000)} h): hay que revisarla contra el contexto actual`,
    };
  }

  return { publish: true, reason: 'listo para publicar', code: 'ok' };
}

/** Posts cuya hora ya llegó (independientemente de si podrán publicarse). */
function due(posts = [], { now = Date.now() } = {}) {
  return posts.filter((p) => ['draft', 'approved'].includes(p.state) && now + DUE_TOLERANCE_MS >= p.scheduledFor);
}

// ── Persistencia ──────────────────────────────────────────────────────────

async function list({ store, tenantId }) {
  if (!store?.getFact) return [];
  return (await store.getFact({ tenantId, key: KEY })) || [];
}

async function saveAll({ store, tenantId, posts }) {
  if (!store?.setFact) return posts;
  await store.setFact({ tenantId, key: KEY, value: posts });
  return posts;
}

async function enqueue({ store, tenantId, post }) {
  const p = validate(post);
  const all = await list({ store, tenantId });
  const i = all.findIndex((x) => x.id === p.id);
  if (i >= 0) all[i] = { ...p, ...{ state: all[i].state, approvedAt: all[i].approvedAt } };
  else all.push(p);
  await saveAll({ store, tenantId, posts: all });
  return p;
}

/** Marca un post como aprobado por una persona, con sello de tiempo. */
async function approve({ store, tenantId, id, now = Date.now() }) {
  const all = await list({ store, tenantId });
  const p = all.find((x) => x.id === id);
  if (!p) throw new QueueError('post no encontrado', { status: 404, code: 'not_found' });
  if (p.state === 'published') throw new QueueError('ya publicado', { status: 409, code: 'already_published' });
  p.state = 'approved';
  p.approvedAt = now;
  await saveAll({ store, tenantId, posts: all });
  return p;
}

async function update({ store, tenantId, id, patch }) {
  const all = await list({ store, tenantId });
  const p = all.find((x) => x.id === id);
  if (!p) throw new QueueError('post no encontrado', { status: 404, code: 'not_found' });
  Object.assign(p, patch);
  await saveAll({ store, tenantId, posts: all });
  return p;
}

async function cancel({ store, tenantId, id }) {
  return update({ store, tenantId, id, patch: { state: 'cancelled' } });
}

// ── Freno de mano ─────────────────────────────────────────────────────────

async function getHold({ store, tenantId }) {
  if (!store?.getFact) return { active: false };
  return (await store.getFact({ tenantId, key: HOLD_KEY })) || { active: false };
}

/**
 * Congela o descongela toda la publicación programada del tenant.
 * Pensado para un incidente: una llamada, todo parado.
 */
async function setHold({ store, tenantId, active, reason = null, now = Date.now() }) {
  const value = { active: !!active, reason: active ? (reason || 'sin motivo indicado') : null, since: active ? now : null };
  if (store?.setFact) await store.setFact({ tenantId, key: HOLD_KEY, value });
  return value;
}

module.exports = {
  validate, canPublish, due, list, enqueue, approve, update, cancel, saveAll,
  getHold, setHold,
  QueueError, APPROVAL_TTL_MS, DUE_TOLERANCE_MS, STATES, KEY, HOLD_KEY,
};
