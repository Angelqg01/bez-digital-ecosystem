'use strict';

/**
 * buildDashboard — agrega en una sola estructura todo lo que el panel necesita
 * de un tenant: plan y límites, consumo y coste, factura, KPIs de Soporte,
 * aprobaciones HITL pendientes y últimas tareas. Devuelve null si no existe.
 */
function buildDashboard({ tenants, usageMeter, costTracker, supportMetrics, billing, plans }, tenantId) {
  const space = tenants.get(tenantId);
  if (!space) return null;

  const plan = space.cfg.plan;
  const planDef = (plans && plans[plan]) || {};
  const agentCalls = usageMeter.check(tenantId);
  const cost = costTracker.usageFor(tenantId);

  return {
    tenantId,
    plan,
    limits: {
      maxAgentCallsMonth: planDef.maxAgentCallsMonth,
      maxConcurrentTasks: planDef.maxConcurrentTasks,
      maxRequestsPerMinute: planDef.maxRequestsPerMinute,
    },
    agentCalls,                                  // { used, limit, remaining, allowed }
    cost,                                        // { calls, inputTokens, outputTokens, costUsd }
    invoice: billing.invoicePreview(tenantId, { callsUsed: agentCalls.used, modelCostUsd: cost.costUsd }),
    support: supportMetrics.report(tenantId),
    approvals: space.hitl.listPending(tenantId),
    policies: space.guardrails.getOverrides(),
    tasks: space.orchestrator.recentTasks(10),
  };
}

module.exports = { buildDashboard };
