/**
 * lib/adsTag.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Configuración y disparo de conversiones de Google Ads.
 *
 * La etiqueta base (AW-…) la carga components/GoogleAnalytics.tsx tras el
 * consentimiento de cookies. Aquí sólo se registran conversiones concretas:
 * `send_to` es `AW-XXXXXXXXX/ETIQUETA_DE_CONVERSION`, y la etiqueta sale de
 * Google Ads (Herramientas → Conversiones). Si gtag no está cargado (sin
 * consentimiento) las llamadas son no-op.
 *
 * Qué cuenta como conversión (acción "AMIYOE-Tu marca de referencia"):
 *  - Registro completado            → app/register/page.tsx
 *  - Clic en cualquier Payment Link de Stripe (comprar BEZ-Coin, planes)
 *  - Clic en un enlace con `data-ads-conversion` (solicitar demo / piloto)
 * Los dos últimos los recoge `installAdsClickConversions` con un único
 * listener delegado, así que un botón nuevo de Stripe cuenta sin tocar nada.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || 'AW-811626838';
export const ADS_CONVERSION_LABEL =
    process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL || 'GplTCIibmIUBENbigYMD';

type ConversionOptions = {
    value?: number;
    currency?: string;
    transactionId?: string;
    newCustomer?: boolean;
};

/** Dispara una conversión de Google Ads. Devuelve false si no hay etiqueta o gtag no está cargado. */
export function trackAdsConversion({ value, currency = 'EUR', transactionId, newCustomer }: ConversionOptions = {}): boolean {
    if (typeof window === 'undefined' || !ADS_CONVERSION_LABEL) return false;
    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag !== 'function') return false;

    gtag('event', 'conversion', {
        send_to: `${ADS_ID}/${ADS_CONVERSION_LABEL}`,
        ...(value !== undefined ? { value, currency } : {}),
        ...(transactionId ? { transaction_id: transactionId } : {}),
        ...(newCustomer !== undefined ? { new_customer: newCustomer } : {}),
    });
    return true;
}

const CONVERSION_LINK_SELECTOR = [
    'a[href^="https://buy.stripe.com/"]',
    'a[href^="https://book.stripe.com/"]',
    'a[data-ads-conversion]',
].join(',');

/**
 * Cuenta como conversión los clics en enlaces de pago y de contacto comercial.
 * Todos abren pestaña nueva o mailto, así que no hace falta retrasar la
 * navegación hasta el `event_callback`. Devuelve la función para desmontarlo.
 */
export function installAdsClickConversions(): () => void {
    const handler = (e: MouseEvent) => {
        const link = (e.target as Element | null)?.closest?.(CONVERSION_LINK_SELECTOR);
        if (link) trackAdsConversion();
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
}
