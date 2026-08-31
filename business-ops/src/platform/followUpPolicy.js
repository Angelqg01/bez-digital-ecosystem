'use strict';

/**
 * followUpPolicy — decide SI toca insistir a un prospecto, y cuándo.
 *
 * Función pura sobre el estado de la secuencia: sin red, sin reloj global, sin
 * modelo. Es deliberado, porque aquí el fallo no es un error visible sino un
 * daño lento: insistirle de más a un prospecto quema el contacto, mancha la
 * reputación del dominio y, con envíos comerciales en la UE, es un problema de
 * cumplimiento. Una regla de "cuándo callarse" tiene que poder probarse
 * exhaustivamente sin montar nada.
 *
 * Motivos de PARADA (definitivos, nunca se reanudan solos):
 *   - `replied`       — contestó: seguir la secuencia es no escuchar.
 *   - `opted_out`     — pidió no recibir más. Innegociable.
 *   - `bounced`       — la dirección no existe; insistir quema el dominio.
 *   - `won` / `lost`  — el trato se cerró de una forma u otra.
 *   - `exhausted`     — se agotaron los intentos previstos.
 *
 * Espaciado creciente (3, 7, 14 días): el primer recordatorio pronto es útil,
 * el cuarto a los tres días es acoso.
 */

const DEFAULT_STEPS_DAYS = [3, 7, 14];
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Cadencia por segmento, si el perfil de negocio la define.
 *
 * Viene de absorber `sales-agency`, que sí distinguía por sector mientras aquí
 * había una sola cadencia global. Un comprador de aduanas y una cooperativa no
 * responden al mismo ritmo, y forzar el mismo espaciado a todos era perder esa
 * información.
 *
 * El perfil declara los DÍAS DESDE EL PRIMER CONTACTO (`[0, 4, 9, 16, 25]`,
 * como venía escrito allí) y aquí se convierten en las esperas entre pasos que
 * espera `decide()` (`[4, 5, 7, 9]`). Se traduce en vez de guardar las esperas
 * porque el calendario es como lo piensa quien diseña la secuencia.
 */
function cadenceFor(segment, profile) {
  const cadencias = profile?.followUpCadence;
  const dias = cadencias?.[segment] || cadencias?.default;
  if (!Array.isArray(dias) || dias.length < 2) return DEFAULT_STEPS_DAYS;

  const esperas = [];
  for (let i = 1; i < dias.length; i++) {
    const salto = Number(dias[i]) - Number(dias[i - 1]);
    if (!Number.isFinite(salto) || salto <= 0) return DEFAULT_STEPS_DAYS;
    esperas.push(salto);
  }
  return esperas;
}

/** Estados que detienen la secuencia para siempre. */
const STOP_REASONS = new Set(['replied', 'opted_out', 'bounced', 'won', 'lost', 'exhausted']);

/** Horario en el que se permite enviar (hora local del prospecto, 24h). */
const SEND_WINDOW = { startHour: 8, endHour: 20 };

/**
 * @param {object} state       - { attempts, lastSentAt, stoppedReason }
 * @param {object} opts        - { now, stepsDays, respectWindow, hourOfDay, dayOfWeek }
 * @returns {{ send: boolean, reason: string, nextAt: number|null, attempt: number|null }}
 */
function decide(state = {}, opts = {}) {
  const {
    now = Date.now(),
    stepsDays = DEFAULT_STEPS_DAYS,
    respectWindow = true,
    // Hora y día LOCALES del prospecto. Se inyectan en vez de derivarlos del
    // reloj del servidor: un prospecto en Madrid y el servidor en UTC no
    // comparten "las 9 de la mañana", y enviar de madrugada es contraproducente.
    hourOfDay = null,
    dayOfWeek = null,   // 0 domingo … 6 sábado
  } = opts;

  const attempts = Number(state.attempts || 0);

  if (state.stoppedReason) {
    return { send: false, reason: `secuencia detenida: ${state.stoppedReason}`, nextAt: null, attempt: null };
  }
  if (attempts >= stepsDays.length) {
    return { send: false, reason: 'exhausted', nextAt: null, attempt: null };
  }

  // Primer contacto: lo manda OutreachAgent, no esta secuencia. Aquí se
  // empieza a contar a partir de que existe un envío previo.
  // Comparación contra null y no `!lastSentAt`: un timestamp 0 es un valor
  // legítimo y con la comprobación laxa se leía como "nunca se envió".
  if (state.lastSentAt == null) {
    return { send: false, reason: 'sin contacto previo: la secuencia arranca tras el primer envío', nextAt: null, attempt: null };
  }

  const esperaMs = stepsDays[attempts] * DAY_MS;
  const nextAt = state.lastSentAt + esperaMs;
  if (now < nextAt) {
    return { send: false, reason: 'aún no toca', nextAt, attempt: attempts + 1 };
  }

  if (respectWindow) {
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return { send: false, reason: 'fin de semana: un comercial en sábado molesta y no convierte', nextAt, attempt: attempts + 1 };
    }
    if (hourOfDay != null && (hourOfDay < SEND_WINDOW.startHour || hourOfDay >= SEND_WINDOW.endHour)) {
      return { send: false, reason: 'fuera de horario laboral', nextAt, attempt: attempts + 1 };
    }
  }

  return { send: true, reason: 'toca seguimiento', nextAt, attempt: attempts + 1 };
}

/** Estado inicial de una secuencia. */
function start({ leadKey, now = Date.now() } = {}) {
  return { leadKey, attempts: 0, lastSentAt: now, stoppedReason: null, startedAt: now };
}

/** Registra un envío hecho. Marca `exhausted` al gastar el último paso. */
function recordSent(state, { now = Date.now(), stepsDays = DEFAULT_STEPS_DAYS } = {}) {
  const attempts = Number(state.attempts || 0) + 1;
  return {
    ...state,
    attempts,
    lastSentAt: now,
    stoppedReason: attempts >= stepsDays.length ? 'exhausted' : state.stoppedReason || null,
  };
}

/** Detiene la secuencia. Idempotente: la primera razón manda. */
function stop(state, reason) {
  if (!STOP_REASONS.has(reason)) throw new Error(`motivo de parada desconocido: ${reason}`);
  if (state.stoppedReason) return state;      // ya parada: no se reescribe el motivo
  return { ...state, stoppedReason: reason };
}

// ── Persistencia de las secuencias del tenant ─────────────────────────────

const KEY = 'sales:followups';

async function loadAll({ store, tenantId }) {
  if (!store?.getFact) return {};
  return (await store.getFact({ tenantId, key: KEY })) || {};
}

async function saveOne({ store, tenantId, leadKey, state }) {
  if (!store?.setFact) return state;
  const all = await loadAll({ store, tenantId });
  all[leadKey] = state;
  await store.setFact({ tenantId, key: KEY, value: all });
  return state;
}

module.exports = {
  decide, start, recordSent, stop, loadAll, saveOne, cadenceFor,
  DEFAULT_STEPS_DAYS, STOP_REASONS, SEND_WINDOW, DAY_MS, KEY,
};
