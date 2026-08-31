'use strict';
const BaseConnector = require('./BaseConnector');

/**
 * CalendarConnector — agendado con Cal.com (v2) o local.
 *
 * MODO REAL con CALENDAR_API_KEY (Cal.com): consulta slots y crea bookings
 * reales. Sin clave → simulado. El event type y la zona horaria se configuran
 * por env (CALCOM_EVENT_TYPE_ID, CALENDAR_TZ).
 */
const CALCOM_BASE = 'https://api.cal.com/v2';

class CalendarConnector extends BaseConnector {
  constructor({ tenantId, config = {} } = {}) {
    super({ tenantId, config });
    this.name = 'calendar';
    this.apiKey = config.apiKey || process.env.CALENDAR_API_KEY || '';
    this.eventTypeId = config.eventTypeId || process.env.CALCOM_EVENT_TYPE_ID || '';
    this.tz = config.tz || process.env.CALENDAR_TZ || 'Europe/Madrid';
    this._fetch = config.fetch || globalThis.fetch;
    this.simulated = !this.apiKey;
    this._appointments = [];
  }

  async execute(method, args = {}) {
    switch (method) {
      case 'getAvailability': return this.getAvailability(args);
      case 'scheduleMeeting': return this.scheduleMeeting(args);
      default: throw new Error(`calendar: método desconocido ${method}`);
    }
  }

  async getAvailability({ date = new Date().toISOString().split('T')[0] } = {}) {
    if (this.simulated || !this.eventTypeId) {
      return { date, slots: ['09:00', '11:30', '15:00', '16:30'], simulated: this.simulated };
    }
    const qs = new URLSearchParams({ eventTypeId: String(this.eventTypeId), startTime: `${date}T00:00:00.000Z`, endTime: `${date}T23:59:59.000Z`, timeZone: this.tz });
    const res = await this._get(`/slots/available?${qs}`);
    const day = res?.data?.slots?.[date] || [];
    return { date, slots: day.map((s) => (s.time || '').slice(11, 16)).filter(Boolean) };
  }

  async scheduleMeeting({ title = 'Reunión', date, slot, attendees = [], name, email } = {}) {
    if (!date || !slot) throw new Error('calendar: date y slot requeridos');
    if (this.simulated || !this.eventTypeId) {
      const meeting = { id: `evt_${Math.random().toString(36).slice(2, 9)}`, title, date, slot, attendees, url: `https://cal.com/sim-${Math.random().toString(36).slice(2, 5)}`, simulated: this.simulated };
      this._appointments.push(meeting);
      return meeting;
    }
    const start = `${date}T${slot}:00.000Z`;
    const booking = await this._post('/bookings', {
      eventTypeId: Number(this.eventTypeId),
      start,
      timeZone: this.tz,
      attendee: { name: name || attendees[0] || 'Invitado', email: email || attendees[0], timeZone: this.tz },
      metadata: { title },
    });
    const b = booking?.data || booking;
    return { id: b.id || b.uid, title, date, slot, url: b.meetingUrl || b.location || '', status: b.status };
  }

  async _req(path, method, body) {
    const resp = await this._fetch(`${CALCOM_BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json', 'cal-api-version': '2024-08-13' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) { const e = new Error(`cal.com: HTTP ${resp.status} ${data?.error?.message || ''}`.trim()); e.status = resp.status; throw e; }
    return data;
  }
  _get(p) { return this._req(p, 'GET'); }
  _post(p, b) { return this._req(p, 'POST', b); }
}

module.exports = CalendarConnector;
