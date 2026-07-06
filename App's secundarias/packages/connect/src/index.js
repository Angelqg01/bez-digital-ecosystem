// @bezhas/connect — outward-facing integration SDK.
//
// This is the "extension API" surface that a THIRD-PARTY platform installs to
// embed BeZhas services (Pay, CargoLink, …) inside its own UI — the same way a
// VSCode extension lets you use a 3rd-party service without leaving the editor.
//
// It is deliberately:
//   - zero-dependency (uses the global fetch in Node 18+ and every browser)
//   - framework-agnostic (no React/ethers) so it drops into WooCommerce, a
//     Shopify backend, an SAP/ODOO connector, a Cloud Function, or the browser.
//
// This file is the full Node entry: the browser-safe core (client.js) PLUS
// webhooks.js (HMAC verification, node:crypto). The embed widget imports
// client.js directly so the browser never loads node:crypto.

export { BeZhasConnect, BeZhasApiError } from './client.js';
export { default } from './client.js';

export { PayModule } from './pay.js';
export { CargoLinkModule } from './cargolink.js';
export { ServiceModule } from './service.js';
export { REGISTRY, listCapabilities, getSubAppDescriptor } from './registry.js';
export { PAYMENT_METHODS, RECEIVE_METHODS } from './pay.js';
export {
  SubscriptionModule,
  Entitlements,
  BeZhasEntitlementError,
  CORE_SUBAPPS,
} from './subscription.js';
export * as webhooks from './webhooks.js';
