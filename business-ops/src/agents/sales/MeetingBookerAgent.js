'use strict';

const BaseAgent = require('../BaseAgent');

/**
 * MeetingBookerAgent — agenda la demo en el calendario real.
 *
 * Reservar es un efecto lateral de verdad: ocupa el hueco de una persona y le
 * manda una invitación a un cliente. De ahí las dos cosas que hace este agente
 * y que no son obvias:
 *
 *   1. **Idempotencia por prospecto.** Si la tarea se reintenta (o el cliente
 *      insiste), no se crean dos reuniones. Se guarda qué se reservó para cada
 *      lead y se devuelve lo ya reservado en vez de duplicar. Sin esto, un
 *      reintento automático llena la agenda de huecos fantasma.
 *   2. **No inventa disponibilidad.** Si el calendario no ofrece huecos, se
 *      dice; proponer una hora que luego no existe es peor que no proponer.
 *
 * La categoría `calendar` pasa por el PolicyEngine, así que un tenant puede
 * exigir aprobación para cada reserva con un override si lo prefiere.
 */
class MeetingBookerAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'sales.meeting-booker',
      name: 'Meeting Booker',
      department: 'sales',
      modelTier: 'fast',
      capabilities: ['sales:book-meeting'],
      systemPrompt:
        'Redactas una confirmación de reunión breve y cordial: qué día y hora, '
        + 'qué se verá en la demo y cómo cancelar. Devuelve solo el texto.',
    });
  }

  async run(task) {
    const p = task.payload || {};
    const lead = p.lead || {};
    const leadKey = String(lead.email || lead.company || '').toLowerCase();

    if (!this.tools.calendar) {
      return { status: 'blocked', reason: 'sin conector de calendario configurado', meeting: null };
    }
    if (!leadKey) {
      return { status: 'blocked', reason: 'lead sin email ni empresa: no se puede agendar', meeting: null };
    }

    // 1. ¿Ya tiene reunión? Reintentar no puede duplicarla.
    const reservas = this.store
      ? ((await this.store.getFact({ tenantId: this.tenantId, key: 'sales:meetings' })) || {})
      : {};
    if (reservas[leadKey]) {
      return {
        status: 'ok',
        alreadyBooked: true,
        meeting: reservas[leadKey],
        note: 'Ya había una reunión agendada con este prospecto; no se duplica.',
      };
    }

    // 2. Disponibilidad real. Si no hay, no se inventa una hora.
    let slots = [];
    try {
      const disp = await this.act({
        category: 'calendar',
        tool: 'calendar',
        method: 'getAvailability',
        args: { date: p.date, days: p.days || 5 },
      });
      slots = disp?.slots || disp?.available || (Array.isArray(disp) ? disp : []);
    } catch (err) {
      return { status: 'blocked', reason: `no se pudo consultar el calendario: ${err.message}`, meeting: null };
    }

    if (!slots.length) {
      return {
        status: 'no_availability',
        reason: 'El calendario no devolvió huecos libres. Mejor ofrecer alternativas a mano que proponer una hora inexistente.',
        meeting: null,
      };
    }

    const elegido = p.slot && slots.includes(p.slot) ? p.slot : slots[0];
    const fecha = p.date || new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

    // 3. Reservar.
    const meeting = await this.act({
      category: 'calendar',
      tool: 'calendar',
      method: 'scheduleMeeting',
      args: {
        title: p.title || `Demo · ${lead.company || 'prospecto'}`,
        date: fecha,
        slot: elegido,
        attendees: [lead.email].filter(Boolean),
        name: lead.contact || undefined,
        email: lead.email || undefined,
      },
    });

    // Si el PolicyEngine lo dejó pendiente o rechazado, no hay reunión que
    // guardar ni confirmación que redactar.
    if (meeting?.status === 'rejected' || meeting?.status === 'blocked' || meeting?.status === 'pending_approval') {
      return { status: meeting.status, reason: meeting.reason, meeting: null };
    }

    if (this.store) {
      reservas[leadKey] = { ...meeting, date: fecha, slot: elegido, bookedAt: new Date().toISOString() };
      await this.store.setFact({ tenantId: this.tenantId, key: 'sales:meetings', value: reservas });
    }

    const confirmation = await this.think(
      `Confirma la reunión con ${lead.contact || 'el prospecto'} de ${lead.company || 'la empresa'} `
      + `el ${fecha} a las ${elegido}.${meeting?.url ? ` Enlace: ${meeting.url}` : ''}`,
      { useMemory: false, maxTokens: 250 },
    );

    this.bus?.emit('sales:meeting_booked', { tenantId: this.tenantId, lead, date: fecha, slot: elegido });
    await this.remember({ task: 'sales:book-meeting', summary: `Demo con ${lead.company || '?'} el ${fecha} ${elegido}`, outcome: 'ok' });

    return { status: 'ok', alreadyBooked: false, meeting, date: fecha, slot: elegido, confirmation, offeredSlots: slots.slice(0, 5) };
  }
}

module.exports = MeetingBookerAgent;
