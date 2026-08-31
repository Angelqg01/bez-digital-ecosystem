'use strict';

/**
 * crmMerge — decide qué campos del CRM se actualizan y cuáles se respetan.
 *
 * El riesgo de un sincronizador automático no es fallar: es "triunfar" y dejar
 * los datos peor que estaban. Casos concretos que esta función evita:
 *
 *   - **Vaciar lo que ya estaba lleno.** El agente extrae un lead de un correo
 *     donde no aparece el teléfono; sin esta regla, escribiría `phone: null`
 *     encima del teléfono bueno que alguien metió a mano.
 *   - **Pisar dato humano con dato inferido.** Si una persona corrigió el
 *     cargo, un agente no debe sobrescribirlo con lo que dedujo de una firma.
 *   - **Retroceder la etapa del funnel.** Un lead que ya está en "propuesta"
 *     no vuelve a "nuevo" porque llegue un correo suelto.
 *
 * Función pura: recibe el registro actual y el propuesto, devuelve el parche a
 * aplicar y por qué. Así se puede auditar qué habría cambiado antes de tocar
 * nada.
 */

/** Orden del funnel: nunca se retrocede automáticamente. */
const STAGES = ['nuevo', 'contactado', 'cualificado', 'propuesta', 'negociacion', 'ganado', 'perdido'];

/** Campos que, una vez puestos por una persona, un agente no sobrescribe. */
const HUMAN_OWNED = new Set(['contactName', 'role', 'phone', 'notes']);

function stageRank(stage) {
  const i = STAGES.indexOf(String(stage || '').toLowerCase());
  return i === -1 ? -1 : i;
}

function isEmpty(v) {
  return v == null || (typeof v === 'string' && v.trim() === '');
}

/**
 * @param {object} current   - lo que hay hoy en el CRM
 * @param {object} incoming  - lo que el agente propone
 * @param {object} opts      - { trustIncoming: boolean } (true = viene de un humano)
 * @returns {{ patch: object, skipped: Array<{field, reason}>, changed: string[] }}
 */
function merge(current = {}, incoming = {}, { trustIncoming = false } = {}) {
  const patch = {};
  const skipped = [];
  const changed = [];

  for (const [field, value] of Object.entries(incoming)) {
    // 1. Nunca borrar con vacío. Un dato ausente en el origen no significa
    //    "bórralo", significa "aquí no venía".
    if (isEmpty(value)) {
      if (!isEmpty(current[field])) skipped.push({ field, reason: 'no se vacía un campo que ya tiene dato' });
      continue;
    }

    // 2. Sin cambio real, no se toca (evita escrituras y ruido en el histórico).
    if (String(current[field] ?? '') === String(value)) continue;

    // 3. Etapa del funnel: solo hacia delante.
    if (field === 'stage') {
      const antes = stageRank(current.stage);
      const ahora = stageRank(value);
      if (ahora === -1) { skipped.push({ field, reason: `etapa desconocida: ${value}` }); continue; }
      if (antes > ahora && !trustIncoming) {
        skipped.push({ field, reason: `no se retrocede de "${current.stage}" a "${value}"` });
        continue;
      }
      patch.stage = value; changed.push('stage');
      continue;
    }

    // 4. Campos de propiedad humana: solo se rellenan si están vacíos.
    if (HUMAN_OWNED.has(field) && !isEmpty(current[field]) && !trustIncoming) {
      skipped.push({ field, reason: 'dato introducido por una persona: no se sobrescribe automáticamente' });
      continue;
    }

    patch[field] = value;
    changed.push(field);
  }

  return { patch, skipped, changed };
}

module.exports = { merge, stageRank, isEmpty, STAGES, HUMAN_OWNED };
