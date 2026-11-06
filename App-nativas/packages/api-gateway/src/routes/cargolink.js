import express from 'express';
import { requireScope } from './auth.js';

const router = express.Router();

/**
 * /api/cargolink/* → API de BeZhas (api/routes/cargolink.js).
 *
 * Hasta 2026-11-06 el gateway tenía aquí su propia versión simulada de
 * CargoLink: B-UID con Math.random, un «análisis Gemini» con integridad fija
 * del 98 % y un despacho «vía Chainlink» que devolvía un número de levante
 * aleatorio (BZ-ASY-…). Nada de eso tocaba la base de datos ni la cadena.
 * Ahora el gateway sólo autoriza y reenvía: el ciclo de vida, los validadores,
 * los webhooks y el anclaje on-chain viven en un único sitio, la API.
 *
 * Dos credenciales distintas:
 *   - Authorization: Bearer <token del gateway> → scope subapp:enterprise.
 *   - x-api-key: <clave CargoLink por rol>      → identidad del actor en la API
 *     (pos | customs | carrier | logistics | lastmile). El token del gateway
 *     NO se reenvía: la API lo tomaría por una clave CargoLink.
 *
 * La ingesta de terceros (/v1/ingest/:providerId) no pasa por aquí: firma con
 * HMAC sobre el cuerpo crudo y un reenvío lo re-serializaría. Los proveedores
 * llaman directamente a la API.
 */

const HUB_API_URL = process.env.BEZHAS_HUB_API_URL || process.env.CORE_API_URL || 'http://localhost:3001';
const UPSTREAM_TIMEOUT_MS = Number(process.env.CARGOLINK_UPSTREAM_TIMEOUT_MS || 15000);

router.get('/health', async (_req, res) => {
  try {
    const response = await fetch(`${HUB_API_URL}/api/cargolink/health`, {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    res.status(response.status).json(await response.json());
  } catch (error) {
    res.status(502).json({ success: false, error: 'CargoLink API unreachable', code: 'UPSTREAM_UNAVAILABLE' });
  }
});

router.all('/v1/ingest/*', (_req, res) => {
  res.status(421).json({
    success: false,
    error: 'Ingest webhooks are HMAC-signed over the raw body: send them to the BeZhas API directly, not through the gateway.',
    code: 'INGEST_NOT_PROXIED',
  });
});

router.all('/*', requireScope('subapp:enterprise'), async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'Missing CargoLink role key (x-api-key). Issue one with POST /api/cargolink/v1/keys.',
      code: 'CARGOLINK_KEY_REQUIRED',
    });
  }

  // req.url conserva la ruta relativa al montaje y la query string.
  const url = `${HUB_API_URL}/api/cargolink${req.url}`;
  const hasBody = !['GET', 'HEAD'].includes(req.method);

  try {
    const response = await fetch(url, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: hasBody ? JSON.stringify(req.body || {}) : undefined,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    const text = await response.text();
    res.status(response.status);
    if ((response.headers.get('content-type') || '').includes('application/json')) {
      return res.json(text ? JSON.parse(text) : {});
    }
    return res.send(text);
  } catch (error) {
    const timedOut = error.name === 'TimeoutError';
    return res.status(timedOut ? 504 : 502).json({
      success: false,
      error: timedOut ? 'CargoLink API timed out' : 'CargoLink API unreachable',
      code: timedOut ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE',
    });
  }
});

export { router as cargolinkRouter };
