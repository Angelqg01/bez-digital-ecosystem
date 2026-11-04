/**
 * lib/analyticsEvents.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Eventos de GA4 del embudo de captación de clientes BEZ.
 *
 * Embudo → evento GA4 (marcar como "evento clave" en Analytics):
 *   registro completado        → sign_up          (recomendado por Google)
 *   wallet conectada           → wallet_connected (personalizado)
 *   clic en pago (Stripe)      → begin_checkout   (recomendado)
 *   solicitud demo / piloto    → generate_lead    (recomendado)
 *
 * Si gtag no está cargado (sin consentimiento de cookies) es no-op, igual que
 * lib/adsTag.ts. Nunca se envían datos personales: ni email, ni dirección de
 * wallet, ni importes de usuario.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type FunnelEvent = 'sign_up' | 'wallet_connected' | 'begin_checkout' | 'generate_lead';

type EventParams = Record<string, string | number | boolean>;

/** Envía un evento a GA4. Devuelve false si gtag no está disponible. */
export function trackEvent(name: FunnelEvent, params: EventParams = {}): boolean {
    if (typeof window === 'undefined') return false;
    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag !== 'function') return false;
    gtag('event', name, params);
    return true;
}

/** Como trackEvent, pero como máximo una vez por pestaña (sessionStorage). */
export function trackEventOnce(name: FunnelEvent, params: EventParams = {}): boolean {
    try {
        const key = `bezhas_ev_${name}`;
        if (sessionStorage.getItem(key)) return false;
        const sent = trackEvent(name, params);
        if (sent) sessionStorage.setItem(key, '1');
        return sent;
    } catch {
        return trackEvent(name, params);
    }
}
