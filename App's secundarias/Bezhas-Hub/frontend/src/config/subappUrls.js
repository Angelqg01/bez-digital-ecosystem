// =============================================================================
// SubApp deep-link URLs — single source of truth (Hub = Control Plane)
// =============================================================================
// El Hub NO aloja la operativa de cada vertical: enlaza (deep-link) a la SubApp
// dedicada. Estas son las URLs canónicas.
//
// Override por entorno con Vite env vars `VITE_SUBAPP_<NAME>_URL` (p.ej. cuando
// los dominios *.bez.digital entren en producción). Los defaults son las URLs
// de Cloud Run (run.app) actualmente en producción — misma lista que el
// control-center (`secondaryApps`), para evitar drift entre superficies.
//
// Nota BZ Capital: la app Next se sirve con `basePath: '/defi'`, por lo que su
// base YA incluye `/defi` y los sub-paths se concatenan (`/defi/staking`, ...).

const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};

export const SUBAPP_URLS = {
  hub: env.VITE_SUBAPP_HUB_URL || 'https://bezhas-hub-o5xep6gbwq-ew.a.run.app',
  capital: env.VITE_SUBAPP_CAPITAL_URL || 'https://bezhas-capital-o5xep6gbwq-ew.a.run.app/defi',
  purescan: env.VITE_SUBAPP_PURESCAN_URL || 'https://bezhas-purescan-o5xep6gbwq-ew.a.run.app',
  energy: env.VITE_SUBAPP_ENERGY_URL || 'https://bezhas-energy-o5xep6gbwq-ew.a.run.app',
  cargolink: env.VITE_SUBAPP_CARGOLINK_URL || 'https://bezhas-cargolink-o5xep6gbwq-ew.a.run.app',
};

// Metadatos de presentación para los paneles "movido a SubApp".
export const SUBAPP_META = {
  capital: {
    name: 'BZ Capital',
    tagline: 'DeFi del ecosistema: staking, farming, gobernanza y tesorería',
  },
  purescan: { name: 'BZ PureScan', tagline: 'Visión artificial y trazabilidad' },
  energy: { name: 'BZ Energy', tagline: 'Virtual Power Plant y mercado energético' },
  cargolink: { name: 'BZ CargoLink', tagline: 'Trazabilidad logística y aduanera' },
  hub: { name: 'BeZhas Hub', tagline: 'Plano de control del ecosistema' },
};

/**
 * Construye la URL de deep-link a una SubApp.
 * @param {keyof typeof SUBAPP_URLS} app  clave de la SubApp
 * @param {string} [subPath]              ruta interna (p.ej. '/staking')
 * @returns {string} URL absoluta lista para `window.open` / `<a href>`
 */
export function subappUrl(app, subPath = '') {
  const base = SUBAPP_URLS[app];
  if (!base) return '#';
  if (!subPath) return base;
  return `${base.replace(/\/+$/, '')}/${String(subPath).replace(/^\/+/, '')}`;
}

export default SUBAPP_URLS;
