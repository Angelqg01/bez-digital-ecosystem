/**
 * ============================================================================
 * STRIPE — Payment Links de BezPay (Hub)
 * ============================================================================
 *
 * Catálogo de enlaces de pago alojados en Stripe para la compra de BEZ con
 * tarjeta. El enlace y la clave publicable son datos PÚBLICOS: viajan al
 * navegador en cualquier integración de Stripe y no dan acceso a nada.
 *
 * ⛔ La clave SECRETA (sk_live_…) NO va aquí, ni en ningún fichero del repo.
 *    Su sitio es GCP Secret Manager / la variable STRIPE_SECRET_KEY, que el
 *    backend lee a través de config/secrets.js. Si alguna vez aparece escrita
 *    en el código, hay que rotarla en el Dashboard de Stripe de inmediato.
 *
 * El estado del pago y la entrega de BEZ siguen siendo de BezPay: Stripe sólo
 * cobra. La confirmación llega por el webhook de Stripe, que debe verificarse
 * con STRIPE_WEBHOOK_SECRET antes de dar nada por bueno — igual que el webhook
 * cripto no se fía del body, este no debe fiarse de una llamada sin firma.
 */

'use strict';

/** Clave publicable (pk_live_…). Pública por diseño; override por env. */
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY
  || 'pk_live_51KbkSOFomr6oeXVgMdntNR53ij5aSdlP39DDEvhcR5QBvKfbSaVFQSEAZsVjBIjbKHGEKvjm7Q1WMJpadYevXuR300c2iv1Upo';

/** Enlace de compra de BEZ con tarjeta. */
const BEZ_PURCHASE_LINK = process.env.STRIPE_BEZ_PURCHASE_LINK
  || 'https://buy.stripe.com/14A5kD2A89Su4Vo3Mfew806';

const STRIPE_LINKS = Object.freeze({
  publishableKey: STRIPE_PUBLISHABLE_KEY,
  bezPurchase: Object.freeze({
    id: 'bez_purchase',
    label: 'Comprar BEZ con tarjeta',
    url: BEZ_PURCHASE_LINK,
    currencies: Object.freeze(['EUR', 'USD']),
  }),
});

/**
 * Enlace de pago para una moneda fiat, o null si no hay uno configurado.
 * @param {'EUR'|'USD'} currency
 */
function getBezPurchaseLink(currency) {
  if (!STRIPE_LINKS.bezPurchase.currencies.includes(String(currency).toUpperCase())) {
    return null;
  }
  return STRIPE_LINKS.bezPurchase.url;
}

module.exports = { STRIPE_LINKS, getBezPurchaseLink, STRIPE_PUBLISHABLE_KEY };
