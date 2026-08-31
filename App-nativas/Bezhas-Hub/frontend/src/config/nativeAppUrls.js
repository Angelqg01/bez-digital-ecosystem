// =============================================================================
// App Nativa deep-link URLs — single source of truth (Hub = Control Plane)
// =============================================================================
// El Hub NO aloja la operativa de cada vertical: enlaza (deep-link) a la App Nativa
// dedicada. Estas son las URLs canónicas.
//
// Override por entorno con Vite env vars `VITE_NATIVE_APP_<NAME>_URL` (p.ej. cuando
// los dominios *.bez.digital entren en producción). Los defaults son las URLs
// de Cloud Run (run.app) actualmente en producción — misma lista que el
// control-center (`secondaryApps`), para evitar drift entre superficies.
//
// Nota BZ Capital: la app Next se sirve con `basePath: '/defi'`, por lo que su
// base YA incluye `/defi` y los sub-paths se concatenan (`/defi/staking`, ...).

const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};

// URLs canónicas — alineadas con `NATIVE_APP_URLS` del control-center
// (control-center/frontend/app/(landing)/developers/page.tsx), fuente de verdad.
export const NATIVE_APP_URLS = {
  hub: env.VITE_NATIVE_APP_HUB_URL || 'https://bezhas-hub-o5xep6gbwq-ew.a.run.app',
  wallet: env.VITE_NATIVE_APP_WALLET_URL || 'https://bezhas-wallet-o5xep6gbwq-ew.a.run.app',
  gas: env.VITE_NATIVE_APP_GAS_URL || 'https://bezhas-gas-o5xep6gbwq-ew.a.run.app',
  edge: env.VITE_NATIVE_APP_EDGE_URL || 'https://bezhas-edge-o5xep6gbwq-ew.a.run.app',
  vision: env.VITE_NATIVE_APP_VISION_URL || 'https://bezhas-vision-o5xep6gbwq-ew.a.run.app',
  capital: env.VITE_NATIVE_APP_CAPITAL_URL || 'https://bezhas-capital-o5xep6gbwq-ew.a.run.app/defi',
  prestige: env.VITE_NATIVE_APP_PRESTIGE_URL || 'https://bezhas-prestige-o5xep6gbwq-ew.a.run.app',
  cargolink: env.VITE_NATIVE_APP_CARGOLINK_URL || 'https://bezhas-cargolink-o5xep6gbwq-ew.a.run.app',
  pay: env.VITE_NATIVE_APP_PAY_URL || 'https://bezhas-pay-o5xep6gbwq-ew.a.run.app',
  purescan: env.VITE_NATIVE_APP_PURESCAN_URL || 'https://bezhas-purescan-o5xep6gbwq-ew.a.run.app',
  sphere: env.VITE_NATIVE_APP_SPHERE_URL || 'https://bezhas-sphere-o5xep6gbwq-ew.a.run.app',
  energy: env.VITE_NATIVE_APP_ENERGY_URL || 'https://bezhas-energy-o5xep6gbwq-ew.a.run.app',
  genesis: env.VITE_NATIVE_APP_GENESIS_URL || 'https://bezhas-genesis-o5xep6gbwq-ew.a.run.app',
};

// Metadatos de presentación para los paneles "movido a App Nativa".
export const NATIVE_APP_META = {
  capital: {
    name: 'BZ Capital',
    tagline: 'DeFi del ecosistema: staking, farming, gobernanza y tesorería',
  },
  wallet: { name: 'BEZ Wallet', tagline: 'Wallet, bridge, gobernanza, validadores y gas' },
  gas: { name: 'Gas Tank Manager', tagline: 'Gestión de gas y patrocinio de transacciones' },
  edge: { name: 'Edge Node Manager', tagline: 'Nodos DePIN y recompensas' },
  vision: { name: 'BEZ Vision Scan', tagline: 'Visión artificial y trazabilidad' },
  purescan: { name: 'BZ PureScan', tagline: 'Visión artificial y trazabilidad' },
  energy: { name: 'BZ Energy', tagline: 'Virtual Power Plant y mercado energético' },
  cargolink: { name: 'BZ CargoLink', tagline: 'Trazabilidad logística y aduanera' },
  prestige: { name: 'BZ Prestige', tagline: 'Programa de fidelidad y prestigio' },
  pay: { name: 'BeZhas Pay', tagline: 'Pagos y checkout' },
  sphere: { name: 'BZ Sphere', tagline: 'Red social y comunidad' },
  genesis: { name: 'BZ Genesis', tagline: 'Identidad y agentes bio' },
  hub: { name: 'BeZhas Hub', tagline: 'Plano de control del ecosistema' },
};

/**
 * Construye la URL de deep-link a una App Nativa.
 * @param {keyof typeof NATIVE_APP_URLS} app  clave de la App Nativa
 * @param {string} [subPath]              ruta interna (p.ej. '/staking')
 * @returns {string} URL absoluta lista para `window.open` / `<a href>`
 */
export function nativeAppUrl(app, subPath = '') {
  const base = NATIVE_APP_URLS[app];
  if (!base) return '#';
  if (!subPath) return base;
  return `${base.replace(/\/+$/, '')}/${String(subPath).replace(/^\/+/, '')}`;
}

export default NATIVE_APP_URLS;
