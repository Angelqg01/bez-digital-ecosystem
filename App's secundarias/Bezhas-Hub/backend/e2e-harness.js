/**
 * e2e-harness.js — backend MÍNIMO para verificación E2E del cimiento B2B.
 * Monta las RUTAS REALES (organizations, plans, identity) + un endpoint medido,
 * contra la Postgres REAL. No arranca el monolito completo (Mongo/Redis/SDK) para
 * aislar la verificación de esta funcionalidad. Borrar tras la prueba.
 */
process.env.DATABASE_URL = process.env.DATABASE_URL
  || 'postgresql://bezhas:bezhas_password@localhost:5433/bezhas';

const express = require('express');
const app = express();
app.use(express.json());

// Rutas reales de la funcionalidad.
app.use('/api/organizations', require('./routes/organizations.routes'));
app.use('/api/plans', require('./routes/plans.routes'));
app.use('/api/identity', require('./routes/identity.routes'));

// Endpoint medido (camino M2M real: API key → tenant → meter → ApiLog).
const { apiKeyTenant, apiUsageMeter } = require('./middleware/apiKeyTenant');
const { tenancy } = require('./middleware/tenancy');
app.get('/api/echo', apiKeyTenant(), tenancy(), apiUsageMeter, (req, res) => {
  res.json({ ok: true, tenant: req.tenant, scopedBy: req.apiKeyRecord ? 'api_key' : 'header' });
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Manejador de errores → JSON (para ver fallos SQL en el E2E).
app.use((err, req, res, next) => {
  console.error('[e2e] error:', err.message);
  res.status(500).json({ error: 'Server Error', message: err.message });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`[e2e-harness] listening on :${PORT} (DB ${process.env.DATABASE_URL})`));
