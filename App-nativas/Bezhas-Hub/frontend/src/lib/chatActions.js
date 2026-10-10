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

/** Payment Link de Stripe del catálogo del servidor (buy.stripe.com): https, host exacto, sin credenciales ni puerto. */
export function isStripePaymentLink(href) {
    if (typeof href !== 'string' || href.length > 2000) return false;
    try {
        const u = new URL(href);
        return u.protocol === 'https:' && !u.username && !u.password && !u.port && u.hostname.toLowerCase() === 'buy.stripe.com';
    } catch { return false; }
}

/**
 * Plan de GET /api/ai-workspace/plans → forma que pinta la ventana de planes. El servidor entrega precios en EUR
 * y los Payment Links de cada ciclo; «comprable» = tiene algún enlace de pago válido.
 */
export function normalizePlan(p) {
    if (!p || typeof p !== 'object') return null;
    const monthlyUrl = isStripePaymentLink(p.monthlyUrl) ? p.monthlyUrl : null;
    const annualUrl = isStripePaymentLink(p.annualUrl) ? p.annualUrl : null;
    return {
        ...p,
        currency: p.currency || 'EUR',
        priceMonthly: p.priceMonthly ?? p.priceEUR,
        priceYearly: p.priceYearly ?? p.yearlyEUR,
        monthlyUrl, annualUrl,
        purchasable: Boolean(monthlyUrl || annualUrl),
    };
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

/**
 * Mensaje del chat al volver de Stripe (?checkout=success|cancelled&kind=plan|bez). Sólo texto fijo: nada de la URL
 * se pinta tal cual. Devuelve null si no hay retorno de pago.
 */
export function checkoutNotice(search) {
    let q;
    try { q = new URLSearchParams(search || ''); } catch { return null; }
    const status = q.get('checkout');
    const kind = q.get('kind');
    if (status === 'cancelled') return 'Has cancelado el pago. No se ha cobrado nada.';
    if (status !== 'success') return null;
    if (kind === 'plan') return 'Pago recibido. Tu plan se activará en unos instantes, en cuanto Stripe nos lo confirme.';
    if (kind === 'bez') return 'Pago recibido. Tus BEZ se entregarán a tu wallet cuando el banco confirme el cobro (normalmente en pocos días hábiles).';
    return 'Pago recibido.';
}

const AUTH_ERRORS_ES = {
    'Invalid credentials': 'Email o contraseña incorrectos.',
    'Email or wallet already registered': 'Ese email ya tiene una cuenta. Inicia sesión o recupera tu contraseña.',
    'Valid email required': 'Escribe un email válido.',
    'Password must be at least 8 chars': 'La contraseña debe tener al menos 8 caracteres.',
    'Password required': 'Escribe tu contraseña.',
    'Invalid signature': 'La firma no es válida. Vuelve a intentarlo.',
    'Too many requests, please try again later.': 'Demasiados intentos. Espera unos minutos y vuelve a probar.',
    'Internal server error': 'El servidor no pudo completar la operación. Inténtalo de nuevo en un momento.',
};
/** Errores de acceso de la API (en inglés) en español; lo que no se conoce se deja tal cual. */
export function authErrorMessage(e, fallback) {
    const msg = apiError(e, fallback);
    return AUTH_ERRORS_ES[msg] || msg;
}
