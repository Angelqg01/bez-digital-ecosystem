'use strict';

const BaseAgent = require('../BaseAgent');
const crmMerge = require('../../platform/crmMerge');

/**
 * CRMSyncAgent — mantiene el CRM al día sin estropear lo que ya estaba bien.
 *
 * El peligro de un sincronizador no es que falle, es que funcione y deje los
 * datos peor: vaciando campos porque el origen no los traía, pisando lo que
 * corrigió una persona, o retrocediendo la etapa del funnel. Esas reglas viven
 * en `platform/crmMerge.js` (función pura) y aquí solo se aplican.
 *
 * Además, este agente **siempre dice qué NO cambió y por qué**. Un sync
 * silencioso es imposible de depurar cuando alguien pregunta "¿quién me borró
 * el teléfono?".
 *
 * Modo `dryRun`: calcula el parche sin escribir. Sirve para revisar una
 * sincronización masiva antes de lanzarla.
 */
class CRMSyncAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'sales.crm-sync',
      name: 'CRM Sync',
      department: 'sales',
      modelTier: 'fast',
      capabilities: ['sales:crm-sync'],
      systemPrompt: 'Normalizas datos de contacto para un CRM. Devuelves solo datos verificables del texto, nunca inventados.',
    });
  }

  async run(task) {
    const p = task.payload || {};
    const incoming = p.lead || p.incoming || {};
    const dryRun = !!p.dryRun;

    if (!this.tools.crm) {
      return { status: 'blocked', reason: 'sin conector de CRM configurado' };
    }
    const key = incoming.companyName || incoming.company;
    if (!key) {
      return { status: 'blocked', reason: 'el registro entrante no identifica empresa' };
    }

    // Estado actual. Si no se puede leer, NO se escribe a ciegas: sin saber
    // qué hay, cualquier escritura puede estar pisando algo bueno.
    let current = {};
    try {
      const leads = await this.act({ category: 'crm', tool: 'crm', method: 'listLeads', args: {} });
      const arr = Array.isArray(leads) ? leads : (leads?.leads || leads?.data || []);
      current = arr.find((l) => (l.companyName || l.company) === key) || {};
    } catch (err) {
      return { status: 'blocked', reason: `no se pudo leer el CRM (${err.message}): no se escribe sin saber qué hay` };
    }

    const { patch, skipped, changed } = crmMerge.merge(current, incoming, {
      trustIncoming: !!p.fromHuman,
    });

    if (!changed.length) {
      return { status: 'ok', changed: [], skipped, applied: false, note: 'Nada que actualizar.' };
    }
    if (dryRun) {
      return { status: 'ok', changed, skipped, patch, applied: false, note: 'Simulación: no se ha escrito nada.' };
    }

    const result = await this.act({
      category: 'crm',
      tool: 'crm',
      method: 'upsertLead',
      args: { companyName: key, ...patch },
    });

    await this.remember({
      task: 'sales:crm-sync',
      summary: `CRM ${key}: actualizados ${changed.join(', ')}`,
      outcome: 'ok',
    });

    return { status: 'ok', changed, skipped, patch, applied: true, crm: result };
  }
}

module.exports = CRMSyncAgent;
