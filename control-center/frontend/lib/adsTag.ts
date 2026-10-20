/**
 * lib/adsTag.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Configuración y disparo de conversiones de Google Ads.
 *
 * La etiqueta base (AW-…) la carga components/GoogleAnalytics.tsx tras el
 * consentimiento de cookies. Aquí sólo se registran conversiones concretas:
 * `send_to` es `AW-XXXXXXXXX/ETIQUETA_DE_CONVERSION`, y la etiqueta sale de
 * Google Ads (Herramientas → Conversiones). Sin NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL
 * las llamadas son no-op.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || 'AW-811626838';
export const ADS_CONVERSION_LABEL = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL || '';

/** Dispara una conversión de Google Ads. Devuelve false si no hay etiqueta o gtag no está cargado. */
export function trackAdsConversion(value?: number, currency = 'EUR'): boolean {
    if (typeof window === 'undefined' || !ADS_CONVERSION_LABEL) return false;
    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag !== 'function') return false;

    gtag('event', 'conversion', {
        send_to: `${ADS_ID}/${ADS_CONVERSION_LABEL}`,
        ...(value !== undefined ? { value, currency } : {}),
    });
    return true;
}
