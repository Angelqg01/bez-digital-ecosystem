/**
 * authSecrets — fuente ÚNICA del secreto y la vida de los JWT en el gateway.
 *
 * Espejo ESM de api/config/secrets.js y del authSecrets.js del Hub. El fallback
 * de desarrollo DEBE ser idéntico en los tres o el SSO entre SubApps se rompe
 * en local: un token emitido por la API core no verificaría aquí.
 *
 * Antes este archivo usaba 'bezhas-dev-secret-change-in-production' y un TTL
 * propio de 7 días, distinto del de todos los demás servicios.
 */

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Debe coincidir con api/config/secrets.js.
export const DEV_FALLBACK_SECRET = 'dev-only-secret';

export const JWT_SECRET = process.env.JWT_SECRET || (IS_PRODUCTION ? null : DEV_FALLBACK_SECRET);
if (!JWT_SECRET) {
  throw new Error('FATAL: falta JWT_SECRET en producción.');
}
if (IS_PRODUCTION && JWT_SECRET === DEV_FALLBACK_SECRET) {
  throw new Error('FATAL: JWT_SECRET tiene el valor de desarrollo en producción. Rótalo antes de desplegar.');
}

// Mismo TTL que el resto del ecosistema (ver api/config/secrets.js).
export const JWT_ACCESS_TTL = process.env.JWT_ACCESS_TTL || '24h';
export const JWT_REFRESH_TTL = process.env.JWT_REFRESH_TTL || '30d';
