/** Validación de enlaces del chat. Los destinos reales los decide el servidor; esto es defensa en profundidad. */

/** Dominios propios cuyos enlaces https pueden abrirse en una pestaña nueva (mismo criterio que el servidor). */
export const TRUSTED_HOSTS = ['bezhas.com', 'www.bezhas.com'];

/** Ruta interna segura: empieza por "/", sin "//", barras invertidas, "..", codificaciones peligrosas ni caracteres raros. */
export function isSafeInternalPath(href) {
    if (typeof href !== 'string' || href.length === 0 || href.length > 200) return false;
    if (!/^\/[A-Za-z0-9\-._~/?#=&%]*$/.test(href)) return false;
    if (href.startsWith('//') || href.includes('\\') || href.includes('..')) return false;
    if (/%(2f|5c|00|0d|0a|2e)/i.test(href)) return false;
    return true;
}

/** Decide cómo pintar un enlace Markdown del modelo: interno, externo de confianza o bloqueado (texto plano). */
export function classifyLink(href) {
    if (isSafeInternalPath(href)) return { type: 'internal', href };
    if (typeof href === 'string') {
        try {
            const u = new URL(href);
            if (u.protocol === 'https:' && !u.username && !u.password && !u.port && TRUSTED_HOSTS.includes(u.hostname.toLowerCase())) {
                return { type: 'external', href: u.toString() };
            }
        } catch { /* URL inválida → bloqueado */ }
    }
    return { type: 'blocked' };
}

/** Solo se redirige al pago alojado de Stripe: https, host exacto, sin credenciales ni puerto. */
export function isStripeCheckoutUrl(href) {
    if (typeof href !== 'string' || href.length > 2000) return false;
    try {
        const u = new URL(href);
        return u.protocol === 'https:' && !u.username && !u.password && !u.port && ['checkout.stripe.com', 'billing.stripe.com'].includes(u.hostname.toLowerCase());
    } catch { return false; }
}

export function formatPrice(p, cycle = 'monthly') {
    if (cycle === 'yearly' && p.priceYearly) return `${p.priceYearly}${p.currency ? ` ${p.currency}` : ''}/año`;
    if (p.priceMonthly === undefined || p.priceMonthly === null) return '';
    if (p.priceMonthly === 0) return 'Gratis';
    return `${p.priceMonthly}${p.currency ? ` ${p.currency}` : ''}/mes`;
}

/** Mensaje legible de un error de axios del backend BeZhas. */
export function apiError(e, fallback) {
    const d = e && e.response && e.response.data;
    return (d && (d.error || d.message || (d.errors && d.errors[0] && d.errors[0].msg))) || fallback;
}
