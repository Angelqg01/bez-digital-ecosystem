'use strict';

/**
 * Punto de entrada. Arranca la API y, opcionalmente, aprovisiona un tenant demo.
 */
require('dotenv').config();
const { app, tenants, store } = require('./server');
const EmailConnector = require('./connectors/EmailConnector');
const CRMConnector = require('./connectors/CRMConnector');

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  // Abre la conexión de persistencia cuanto antes (falla rápido si Postgres está caído).
  await store.connect();

  // Tenant de demostración (quitar en producción).
  if (process.env.DEMO_TENANT === 'true') {
    await tenants.provision({
      tenantId: 'demo',
      plan: 'pro',
      departments: ['sales', 'support', 'marketing'],
      tools: { email: new EmailConnector({ tenantId: 'demo' }), crm: new CRMConnector({ tenantId: 'demo' }) },
    });
    console.log('Tenant demo aprovisionado.');
  }

  app.listen(PORT, () => console.log(`🚀 OPERANT en http://localhost:${PORT}`));
}

bootstrap().catch(console.error);
