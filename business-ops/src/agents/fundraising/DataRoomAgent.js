'use strict';

const BaseAgent = require('../BaseAgent');

/**
 * DataRoomAgent — prepara el checklist de due diligence contra una lista
 * FIJA de documentos estándar, no una que el modelo componga de memoria cada
 * vez (que un due diligence real se caiga por olvidar el cap table firmado no
 * es un fallo que deba depender de qué se le ocurrió redactar al modelo hoy).
 *
 * El agente solo compara qué está presente contra la lista y redacta el
 * correo pidiendo lo que falta — no genera ni valida el contenido de ningún
 * documento legal.
 */
const CHECKLIST = {
  corporate: ['Escritura de constitución', 'Estatutos sociales', 'Libro de socios/accionistas', 'Actas de junta (últimos 2 años)'],
  captable: ['Cap table actualizada', 'Acuerdos de vesting de fundadores', 'Opciones sobre acciones (ESOP) emitidas'],
  financial: ['Estados financieros auditados (últimos 2 ejercicios)', 'Proyecciones financieras', 'Deuda pendiente y garantías'],
  legal: ['Contratos materiales con clientes/proveedores', 'Litigios en curso o potenciales', 'Propiedad intelectual registrada'],
  compliance: ['Políticas de protección de datos (RGPD)', 'Licencias y permisos regulatorios', 'KYC/AML de operaciones on-chain'],
};

class DataRoomAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'fundraising.data-room',
      name: 'Data Room',
      department: 'fundraising',
      modelTier: 'fast',
      capabilities: ['fundraising:data-room'],
      systemPrompt: 'Recibes la lista de documentos que FALTAN para el due diligence. Redacta un correo breve pidiéndolos, sin inventar documentos que no estén en la lista.',
    });
  }

  async run(task) {
    const p = task.payload || {};
    const present = new Set((p.present || []).map((d) => String(d).trim()));

    const missing = {};
    let totalMissing = 0;
    for (const [category, docs] of Object.entries(CHECKLIST)) {
      const faltan = docs.filter((d) => !present.has(d));
      if (faltan.length) { missing[category] = faltan; totalMissing += faltan.length; }
    }

    if (!totalMissing) {
      return { status: 'ok', complete: true, missing: {}, draft: null };
    }

    const lista = Object.entries(missing).map(([cat, docs]) => `${cat}: ${docs.join(', ')}`).join('\n');
    const draft = await this.think(
      `Redacta un correo breve para ${p.recipientName || 'el equipo'} pidiendo estos documentos para el due diligence:\n${lista}`,
      { useMemory: false, maxTokens: 400 },
    );

    return { status: 'ok', complete: false, missing, totalMissing, draft };
  }
}

DataRoomAgent.CHECKLIST = CHECKLIST;
module.exports = DataRoomAgent;
