import crypto from 'node:crypto';

/**
 * Autenticación del Brain.
 *
 * Con BRAIN_API_KEY definida, toda ruta salvo /health exige la clave en
 * `x-brain-key` o en `Authorization: Bearer <clave>`. La comparación es en
 * tiempo constante (sobre los SHA-256, para no filtrar la longitud).
 *
 * Sin clave, el Brain sólo arranca fuera de producción (desarrollo local con
 * la UI integrada y los scripts de simulación). En producción se niega a
 * arrancar: un Brain abierto deja a cualquiera escribir notas en el vault e
 * inyectar telemetría falsa en el mapa.
 *
 * En Cloud Run además va detrás de `--no-allow-unauthenticated`; el ID token
 * viaja en `X-Serverless-Authorization`, que Cloud Run valida y retira, así que
 * no choca con la clave de aquí.
 */
export function resolveBrainKey(env = process.env) {
  const key = (env.BRAIN_API_KEY || '').trim();
  if (key && key.length < 32) {
    throw new Error('BRAIN_API_KEY debe tener al menos 32 caracteres');
  }
  if (!key && env.NODE_ENV === 'production') {
    throw new Error('BRAIN_API_KEY es obligatoria en producción: el Brain no arranca abierto');
  }
  return key;
}

function digest(value) {
  return crypto.createHash('sha256').update(String(value)).digest();
}

export function presentedKey(req) {
  const header = req.get('x-brain-key');
  if (header) return header.trim();
  const auth = req.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

export function brainAuth(key, { publicPaths = ['/health'] } = {}) {
  const expected = key ? digest(key) : null;
  return function requireBrainKey(req, res, next) {
    if (!expected || publicPaths.includes(req.path)) return next();
    const given = presentedKey(req);
    if (given && crypto.timingSafeEqual(digest(given), expected)) return next();
    res.status(401).json({ success: false, error: 'Brain: clave ausente o incorrecta' });
  };
}

// Orígenes permitidos por CORS. Con clave, por defecto ninguno: al Brain sólo
// le llaman servidores (API, panel), nunca un navegador directamente.
export function corsOrigins(env = process.env, hasKey = false) {
  const list = (env.BRAIN_CORS_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
  if (list.length) return list;
  return hasKey ? false : true;
}
