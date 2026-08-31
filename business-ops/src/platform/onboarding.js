'use strict';

/**
 * onboarding — alta self-service de una empresa cliente.
 *
 * Valida el plan, limita los departamentos a los permitidos por el plan,
 * aprovisiona el tenant, fija su rate-limit y emite su clave de API.
 */
function badRequest(message) {
  const err = new Error(message);
  err.code = 'bad_request';
  return err;
}

async function signup({ tenants, apiKeys, plans, rateLimiter, billing }, { tenantId, plan = 'starter', departments, tools, businessId = null } = {}) {
  if (!tenantId) throw badRequest('tenantId requerido');
  if (!/^[a-z0-9][a-z0-9-]{1,38}$/.test(tenantId)) throw badRequest('tenantId inválido (a-z, 0-9, guiones)');

  const planDef = plans[plan];
  if (!planDef) throw badRequest(`plan inválido: ${plan}`);

  // Solo los departamentos contratables en el plan.
  const requested = departments && departments.length ? departments : planDef.departments;
  const allowed = requested.filter((d) => planDef.departments.includes(d));
  if (!allowed.length) throw badRequest('ningún departamento válido para este plan');

  await tenants.provision({ tenantId, plan, departments: allowed, tools: tools || {}, businessId });
  if (rateLimiter) rateLimiter.setLimit(tenantId, planDef.maxRequestsPerMinute);
  if (billing) await billing.subscribe(tenantId, plan);

  // Persistir el alta para poder rehidratar el tenant tras un reinicio.
  if (tenants.store && typeof tenants.store.upsertTenant === 'function') {
    await tenants.store.upsertTenant({ tenantId, plan, departments: allowed, businessId });
  }

  const apiKey = apiKeys.issue(tenantId);
  return { tenantId, plan, departments: allowed, businessId, apiKey };
}

module.exports = { signup };
