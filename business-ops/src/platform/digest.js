'use strict';

/**
 * digest — el "Digest del CEO": resumen ejecutivo cross-departamento del tenant.
 *
 * Reúne los KPIs reales de la plataforma (consumo, coste, factura, soporte,
 * aprobaciones pendientes, últimas tareas) y pide al modelo un resumen para el
 * dueño del negocio. Se persiste como fact `digest:last` del tenant, así el
 * último digest sobrevive a reinicios y el panel puede mostrarlo al instante.
 *
 * Es la pieza que une los agentes proactivos con el humano: el Scheduler lo
 * genera cada día sin que nadie lo pida (acción 'digest').
 */
async function buildDigest(deps, tenantId) {
  const { tenants, usageMeter, costTracker, supportMetrics, billing, plans, modelGateway, store } = deps;
  const space = tenants.get(tenantId);
  if (!space) return null;

  const plan = space.cfg.plan;
  const usage = usageMeter.check(tenantId);
  const cost = costTracker.usageFor(tenantId);
  const support = supportMetrics ? supportMetrics.report(tenantId) : {};
  const approvals = space.hitl.listPending(tenantId);
  const tasks = space.orchestrator.recentTasks ? space.orchestrator.recentTasks(10) : [];
  const invoice = billing
    ? billing.invoicePreview(tenantId, { callsUsed: usage.used, modelCostUsd: cost.costUsd })
    : null;

  const byDept = {};
  for (const t of tasks) byDept[t.department] = (byDept[t.department] || 0) + 1;

  const kpis = {
    plan,
    llamadasUsadas: usage.used,
    llamadasRestantes: usage.remaining,
    costeIaUsd: Number(cost.costUsd.toFixed(4)),
    facturaEstimadaEur: invoice?.totalEur ?? null,
    excedenteFacturadoPor: invoice?.overageBilledBy ?? null,
    tareasRecientes: tasks.length,
    tareasPorDepartamento: byDept,
    soporte: {
      atendidos: support.handled ?? support.totalTickets ?? 0,
      resueltosSinHumano: support.resolved ?? 0,
      escalados: support.escalated ?? 0,
    },
    aprobacionesPendientes: approvals.length,
  };

  const raw = [
    `Plan: ${plan} · llamadas usadas ${usage.used}${usage.limit ? `/${usage.limit}` : ''} · coste IA $${kpis.costeIaUsd}`,
    invoice ? `Factura estimada del periodo: $${invoice.totalUsd}` : null,
    `Tareas recientes: ${tasks.length} (${Object.entries(byDept).map(([d, n]) => `${d}: ${n}`).join(', ') || 'sin actividad'})`,
    `Soporte: ${kpis.soporte.atendidos} atendidos, ${kpis.soporte.resueltosSinHumano} resueltos sin humano, ${kpis.soporte.escalados} escalados`,
    `Aprobaciones esperando decisión humana: ${approvals.length}`,
  ].filter(Boolean).join('\n');

  const res = await modelGateway.complete({
    tier: 'fast',
    system: 'Eres el asistente ejecutivo del dueño del negocio. Redacta un digest diario breve (5-8 líneas), ' +
      'directo y accionable: qué hicieron los agentes, qué espera aprobación y qué merece atención. Sin relleno.',
    messages: [{ role: 'user', content: `Datos del día:\n${raw}` }],
    maxTokens: 500,
    meta: { tenantId, agentId: 'platform.digest' },
  });

  // El gateway marca `simulated: true` cuando no hay proveedor detrás, y
  // también cuando degrada a simulado porque el proveedor falló. Eso vale como
  // respuesta del momento, pero NO debe persistirse: `lastDigest` sirve la
  // caché a todo el que no pida `?fresh=1`, así que un digest generado durante
  // un rato sin modelo se quedaba de titular fijo del panel del dueño para
  // siempre. Se vio verificando la Fase 6: la caché servía un texto
  // `[SIMULADO · model=claude-haiku-4-5]` cuando el motor configurado ya era
  // Ollama desde hacía días.
  //
  // Se mira la bandera, no el prefijo del texto: el prefijo es presentación y
  // puede cambiar; `simulated` es el dato.
  const simulado = res.simulated === true;
  const digest = { at: new Date().toISOString(), text: res.text, kpis, simulado };

  if (store?.setFact && !simulado) {
    try { await store.setFact({ tenantId, key: 'digest:last', value: digest }); }
    catch (err) { console.warn(`[digest:${tenantId}] no se pudo persistir: ${err.message}`); }
  }
  space.bus.emit('digest:ready', { tenantId, at: digest.at });
  return digest;
}

/** Último digest persistido (o null). */
async function lastDigest(store, tenantId) {
  if (!store?.getFact) return null;
  return store.getFact({ tenantId, key: 'digest:last' });
}

module.exports = { buildDigest, lastDigest };
