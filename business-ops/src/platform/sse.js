'use strict';

/**
 * SSE — utilidades para emitir los eventos del bus de un tenant como
 * Server-Sent Events hacia el panel (tiempo real, sin websocket).
 */

// Eventos del bus que interesan al panel.
const TENANT_EVENTS = ['hitl:pending', 'task:queued', 'task:completed', 'task:failed', 'support:escalated', 'digest:ready', 'agent:tool-call'];

/** Formatea un frame SSE. */
function formatSse(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data ?? {})}\n\n`;
}

/** Resumen ligero del payload (evita volcar tareas enteras al stream). */
function summarize(name, p = {}) {
  if (name.startsWith('task:')) return { id: p.id, status: p.status, department: p.department, type: p.type };
  if (name === 'hitl:pending') return { approvalId: p.approvalId, agentId: p.agentId, reason: p.reason };
  if (name === 'support:escalated') return { category: p.category, priority: p.priority, customerId: p.customerId };
  return p;
}

/**
 * Suscribe `write` a los eventos del bus de un tenant.
 * @returns {function} cleanup que cancela todas las suscripciones.
 */
function streamTenantEvents(bus, write, events = TENANT_EVENTS) {
  const handlers = events.map((name) => {
    const h = (payload) => write(formatSse(name, summarize(name, payload)));
    bus.on(name, h);
    return [name, h];
  });
  return () => handlers.forEach(([name, h]) => bus.off(name, h));
}

module.exports = { TENANT_EVENTS, formatSse, summarize, streamTenantEvents };
