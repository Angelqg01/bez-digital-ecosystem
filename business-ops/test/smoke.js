'use strict';

/**
 * Smoke test: aprovisiona un tenant, manda una solicitud y verifica el flujo
 * completo SIN claves de API (modo simulado del ModelGateway).
 */
const TenantManager = require('../src/core/TenantManager');
const ModelGateway = require('../src/cognition/ModelGateway');
const EmailConnector = require('../src/connectors/EmailConnector');
const CRMConnector = require('../src/connectors/CRMConnector');

(async () => {
  const modelGateway = new ModelGateway({ providers: {} }); // simulado
  const tenants = new TenantManager({ modelGateway });

  await tenants.provision({
    tenantId: 'acme',
    plan: 'pro',
    departments: ['sales', 'support'],
    tools: { email: new EmailConnector({ tenantId: 'acme' }), crm: new CRMConnector({ tenantId: 'acme' }) },
  });
  console.log('✓ tenant aprovisionado');

  const taskId = await tenants.handle('acme', { text: 'Quiero una demo y precio para mi empresa', channel: 'web', customerId: 'c1' });
  console.log('✓ solicitud encolada:', taskId);

  await new Promise(r => setTimeout(r, 300)); // dejar correr la cola

  const space = tenants.get('acme');
  const task = space.orchestrator.getTask(taskId);
  console.log('✓ tarea procesada → estado:', task.status, '| departamento:', task.department);

  if (task.status === 'completed') {
    console.log('\n✅ SMOKE TEST OK — el flujo end-to-end funciona en modo simulado.');
    process.exit(0);
  } else {
    console.error('\n❌ SMOKE TEST FALLÓ:', task.error);
    process.exit(1);
  }
})();
